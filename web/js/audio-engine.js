import { state } from './state.js';
import { CONSTANTS, midiToFreq, freqToMidi, midiToName, centsDiff, timingWindowBeats, $ } from './utils.js';

export function yinPitch(buffer, sampleRate) {
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
    rms = Math.sqrt(rms / buffer.length);
    if (rms < CONSTANTS.MIN_RMS) return { freq: null, conf: 0, rms };

    const threshold = 0.20;
    const bufferSize = buffer.length;
    const maxTau = Math.floor(sampleRate / 50);
    const minTau = Math.floor(sampleRate / 1000);

    const d = new Float32Array(maxTau + 1);
    for (let tau = minTau; tau <= maxTau; tau++) {
        let sum = 0;
        const maxI = Math.max(0, bufferSize - tau);
        for (let i = 0; i < maxI; i++) {
            const delta = buffer[i] - buffer[i + tau];
            sum += delta * delta;
        }
        d[tau] = sum;
    }

    const cmndf = new Float32Array(maxTau + 1);
    cmndf[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
        runningSum += d[tau];
        cmndf[tau] = runningSum === 0 ? 1 : d[tau] * tau / runningSum;
    }

    let tauEstimate = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
        if (tau < cmndf.length && cmndf[tau] < threshold) {
            while (tau + 1 <= maxTau && tau + 1 < cmndf.length && cmndf[tau + 1] < cmndf[tau]) tau++;
            tauEstimate = tau;
            break;
        }
    }
    if (tauEstimate === -1 || tauEstimate >= cmndf.length) return { freq: null, conf: 0, rms };

    const x0 = tauEstimate > 1 ? tauEstimate - 1 : tauEstimate;
    const x2 = tauEstimate + 1 <= maxTau && tauEstimate + 1 < cmndf.length ? tauEstimate + 1 : tauEstimate;
    const s0 = x0 < cmndf.length ? cmndf[x0] : 1;
    const s1 = tauEstimate < cmndf.length ? cmndf[tauEstimate] : 1;
    const s2 = x2 < cmndf.length ? cmndf[x2] : 1;

    const a = (s0 + s2 - 2 * s1) / 2;
    const b = (s2 - s0) / 2;
    const betterTau = (Math.abs(a) > 1e-10) ? (tauEstimate - b / (2 * a)) : tauEstimate;

    const freq = sampleRate / betterTau;
    const conf = Math.max(0, Math.min(1, 1 - cmndf[tauEstimate]));
    return { freq, conf, rms };
}

export function detectChord(analyser, targetNotes, sampleRate) {
    try {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        analyser.getFloatFrequencyData(dataArray);

        const nyquist = sampleRate / 2;
        const freqPerBin = nyquist / bufferLength;

        let ENERGY_THRESHOLD;
        const fftInput = document.getElementById("fftThreshold");

        if (state.hardwareCalibration.isCalibrated && state.hardwareCalibration.quality > 0.3) {
            ENERGY_THRESHOLD = state.hardwareCalibration.optimalThreshold;
        } else if (state.adaptiveCalibration.enabled && state.adaptiveCalibration.confidence > 0.3) {
            ENERGY_THRESHOLD = state.adaptiveCalibration.adaptiveThreshold;
        } else {
            ENERGY_THRESHOLD = parseFloat(fftInput ? fftInput.value : -40);
        }

        ENERGY_THRESHOLD = ENERGY_THRESHOLD - 12;

        let detectedCount = 0;
        const detectedNotes = [];

        if (!targetNotes || targetNotes.length === 0) {
            return { success: false, detectedCount: 0, requiredCount: 0, detectedNotes: [], confidence: 0, majorityThreshold: 0 };
        }

        for (const noteData of targetNotes) {
            const targetMidi = noteData.midi;
            const fundamentalFreq = midiToFreq(targetMidi);
            const harmonicFreq = fundamentalFreq * 2;
            const fundamentalBin = Math.round(fundamentalFreq / freqPerBin);
            const harmonicBin = Math.round(harmonicFreq / freqPerBin);

            let fundamentalEnergy = -Infinity;
            let harmonicEnergy = -Infinity;

            if (fundamentalBin >= 0 && fundamentalBin < bufferLength) {
                for (let i = Math.max(0, fundamentalBin - 1); i <= Math.min(bufferLength - 1, fundamentalBin + 1); i++) {
                    if (i < dataArray.length) fundamentalEnergy = Math.max(fundamentalEnergy, dataArray[i]);
                }
            }
            if (harmonicBin >= 0 && harmonicBin < bufferLength) {
                for (let i = Math.max(0, harmonicBin - 1); i <= Math.min(bufferLength - 1, harmonicBin + 1); i++) {
                    if (i < dataArray.length) harmonicEnergy = Math.max(harmonicEnergy, dataArray[i]);
                }
            }

            const detected = fundamentalEnergy > ENERGY_THRESHOLD || harmonicEnergy > ENERGY_THRESHOLD;

            if (detected) {
                detectedCount++;
                detectedNotes.push({ midi: targetMidi, freq: fundamentalFreq, fundamentalEnergy, harmonicEnergy });
            }
        }

        let minimumThreshold;
        if (targetNotes.length <= 2) {
            minimumThreshold = targetNotes.length;
        } else {
            minimumThreshold = Math.ceil(targetNotes.length * 0.7);
        }

        minimumThreshold = Math.max(1, minimumThreshold);

        const anyDetected = detectedCount >= minimumThreshold;

        return {
            success: anyDetected,
            detectedCount,
            requiredCount: targetNotes.length,
            detectedNotes,
            confidence: detectedCount / targetNotes.length,
            majorityThreshold: minimumThreshold,
            isStrong: detectedCount >= targetNotes.length
        };

    } catch (error) {
        console.error("FFT Error", error);
        return { success: false, detectedCount: 0, requiredCount: 0 };
    }
}

export function hybridDetection(analyser, timeDomainBuffer, sampleRate, expectedEvent) {
    const yinResult = yinPitch(timeDomainBuffer, sampleRate);

    // --- SPECIAL HANDLING FOR HIGH FREQUENCY NOTES ---
    if (expectedEvent && expectedEvent.type === "note") {
        const expectedFreq = midiToFreq(expectedEvent.midi);

        if (expectedFreq > 300) {
            if (yinResult.freq && yinResult.freq < 250) {
                const fftResult = detectChord(analyser, [expectedEvent], sampleRate);
                if (fftResult.success) {
                    return {
                        method: 'fft-filtered',
                        result: { freq: expectedFreq, conf: 0.9, rms: yinResult.rms }
                    };
                }
                return { method: 'silence', result: { freq: null, conf: 0, rms: yinResult.rms } };
            }

            if (yinResult.freq === null || yinResult.conf < 0.4) {
                const fftResult = detectChord(analyser, [expectedEvent], sampleRate);
                if (fftResult.success) {
                    return {
                        method: 'fft-high-note',
                        result: { freq: expectedFreq, conf: 0.85, rms: yinResult.rms }
                    };
                }
            }
        }
    }

    if (expectedEvent && expectedEvent.type === "note") {
        let needsFallback = false;
        if (yinResult.freq === null || yinResult.conf < 0.5) {
            needsFallback = true;
        } else {
            const detectedMidi = freqToMidi(yinResult.freq);
            const expectedMidi = expectedEvent.midi;
            if (Math.abs(detectedMidi - expectedMidi) > 1.5) {
                needsFallback = true;
            }
        }

        if (needsFallback) {
            const fftResult = detectChord(analyser, [expectedEvent], sampleRate);
            if (fftResult.success) {
                return {
                    method: 'fft-override',
                    result: { freq: midiToFreq(expectedEvent.midi), conf: 0.9, rms: yinResult.rms }
                };
            }
        }
    }

    if (expectedEvent && expectedEvent.type === "chord" && expectedEvent.notes && expectedEvent.notes.length > 1) {
        try {
            const chordResult = detectChord(analyser, expectedEvent.notes, sampleRate);
            return { method: 'fft', result: chordResult };
        } catch (fftError) {
            return { method: 'yin-fallback', result: yinResult };
        }
    }

    return { method: 'yin', result: yinResult };
}

export function tryMatchPlayed(beatNow, playedFreq) {
    const win = Math.max(timingWindowBeats(state.bpm), 0.30);
    const beatDuration = 60 / state.bpm;
    const earlyWindowSeconds = 0.25;
    const earlyToleranceBeats = (earlyWindowSeconds / beatDuration);
    const earlyTolerance = Math.max(0.15, Math.min(0.4, earlyToleranceBeats));

    let bestDb = Infinity;
    let targetIdx = -1;

    for (let i = 0; i < state.events.length; i++) {
        const ev = state.events[i];
        if (ev.hit) continue;

        const timingDiff = beatNow - ev.beat;

        if (timingDiff >= -earlyTolerance && timingDiff <= win) {
            if (Math.abs(timingDiff) < bestDb) {
                bestDb = Math.abs(timingDiff);
                targetIdx = i;
            }
        }
    }

    if (targetIdx === -1) return null;

    const ev = state.events[targetIdx];
    let isMatch = false;
    let correctedMidi = freqToMidi(playedFreq);
    let centsOff = 0;

    if (ev.type === "chord") {
        for (const chordTone of ev.notes) {
            const rawMidi = freqToMidi(playedFreq);
            const semitonesDiff = Math.abs(rawMidi - chordTone.midi);
            const octaveDiff = Math.abs(semitonesDiff % 12);
            if (octaveDiff <= 1 || octaveDiff >= 11) {
                isMatch = true;
                break;
            }
        }
    } else {
        const rawMidi = freqToMidi(playedFreq);
        const diff = rawMidi - ev.midi;
        const absDiff = Math.abs(diff);

        if (absDiff <= 1 || Math.abs(absDiff - 12) <= 1) {
            isMatch = true;
            correctedMidi = rawMidi;
            centsOff = centsDiff(rawMidi, ev.midi);
        }
    }

    if (isMatch) {
        state.inputAttemptedDuringWindow.add(targetIdx);
        ev.hit = true;
        ev.judged = true;
        return { ok: true, expected: ev.type === "chord" ? ev.notes[0].midi : ev.midi, detected: correctedMidi, centsOff: centsOff, timingBeats: beatNow - ev.beat, expectedBeat: ev.beat, isChord: ev.type === "chord" };
    } else {
        // --- CHECK DEBUG MODE BEFORE LOGGING WARNINGS ---
        if (state.debugMode) {
            const expectedName = ev.type === "chord" ? "Chord" : midiToName(ev.midi);
            const detectedName = midiToName(Math.round(freqToMidi(playedFreq)));

            if (Math.abs(freqToMidi(playedFreq) - ev.midi) < 24) {
                console.warn(`Mismatch: Exp ${expectedName} vs Det ${detectedName} (Freq: ${playedFreq.toFixed(1)}) @ Beat ${beatNow.toFixed(2)}`);
            }
        }

        return { ok: false, expected: ev.type === "chord" ? ev.notes[0].midi : ev.midi, detected: correctedMidi, centsOff: 100, timingBeats: beatNow - ev.beat, expectedBeat: ev.beat, isChord: ev.type === "chord" };
    }
}

export function metroTick(isDownbeat) {
    if (!state.audioCtx) return;
    const ctx = state.audioCtx;

    state.ignoreUntil = Math.max(state.ignoreUntil, ctx.currentTime + 0.12);

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = isDownbeat ? 1200 : 880;

    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.20, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.07);
}