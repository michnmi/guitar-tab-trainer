import { state, noteTravelDistance, setNoteTravelDistance } from './state.js';
import { CONSTANTS, $, midiToName, freqToMidi, secondsToBeats, beatsToSeconds, timingWindowBeats } from './utils.js';
import {
    updateVisualNotes, renderNotes, showHitZoneFeedback, showFullScreenFeedback,
    clearVisualNotes, updateScoreDisplay, addDebugEntry, clearDebugLog, copyDebugToClipboard,
    addPracticeHistoryEntry, updatePracticeHistoryDisplay, clearPracticeHistory
} from './visuals.js';
import { yinPitch, hybridDetection, tryMatchPlayed, metroTick } from './audio-engine.js';
import { loadAvailableExercises, setupMusicXMLUpload, loadExercise as loadExerciseOriginal } from './exercises.js';
import { startHardwareCalibration, updateCalibrationStatus, setFftThreshold, updateAdaptiveCalibration } from './calibration.js';
import { renderStaticTab } from './tab-renderer.js';

// Global access for debug buttons
window.startHardwareCalibration = startHardwareCalibration;
window.clearDebugLog = clearDebugLog;
window.copyDebugToClipboard = copyDebugToClipboard;

function resetPractice() {
    state.practicing = false;

    if (state.rafId) cancelAnimationFrame(state.rafId);

    state.successCount = 0;
    state.failCount = 0;
    state.skippedCount = 0;
    state.startTime = 0;
    state.lastMetroBeat = -1;
    state.stableCount = 0;
    state.lastTriggerAt = 0;
    state.inputAttemptedDuringWindow = new Set();
    state.visualNotes.clear();
    state.nextNoteId = 0;
    state.exerciseCompleted = false;
    state.autoStopScheduled = false;
    state.metronomeStartTime = null;

    state.nextIdx = 0;
    if (state.events) {
        state.events.forEach(ev => {
            ev.hit = false;
            ev.miss = false;
            ev.skipped = false;
            ev.judged = false;
            ev.visualNote = null;
        });
    }

    const fb = $("fretboard");
    if (fb) {
        fb.innerHTML = `
        <div class="strings-container">
          <div class="string e-high"></div>
          <div class="string b"></div>
          <div class="string g"></div>
          <div class="string d"></div>
          <div class="string a"></div>
          <div class="string e-low"></div>
        </div>
        <div class="hit-zone"></div>
        <div class="string-label" style="top: 45px;">e</div>
        <div class="string-label" style="top: 105px;">B</div>
        <div class="string-label" style="top: 165px;">G</div>
        <div class="string-label" style="top: 225px;">D</div>
        <div class="string-label" style="top: 285px;">A</div>
        <div class="string-label" style="top: 345px;">E</div>
      `;
    }

    updateScoreDisplay();
    const btnStart = $("btnStart");
    const btnStop = $("btnStop");
    const status = $("status");

    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;
    if (status) status.textContent = "Stopped.";

    const lastNote = $("lastNote");
    if (lastNote) lastNote.textContent = "—";

    const lastNoteMeta = $("lastNoteMeta");
    if (lastNoteMeta) lastNoteMeta.textContent = "—";

    const nowDiv = $("now");
    if (nowDiv) nowDiv.textContent = "—";
}

function loadExercise(exercise) {
    loadExerciseOriginal(exercise);
    renderStaticTab(exercise);

    state.isLooping = false;
    state.loopStartBeat = 0;
    state.loopEndBeat = 0;
    if ($("loopMode")) $("loopMode").checked = false;
}

function currentBeat(time) {
    if (state.startTime === 0) return 0;
    const elapsed = time - state.startTime;
    return secondsToBeats(elapsed, state.bpm);
}

function getCurrentExpectedEvent(beatNow) {
    const lookahead = 4;
    for (let i = state.nextIdx; i < state.events.length; i++) {
        const ev = state.events[i];
        if (ev.beat > beatNow + lookahead) break;
        if (!ev.judged && Math.abs(ev.beat - beatNow) < 1.0) {
            return ev;
        }
    }
    return null;
}

function judgeMisses(beatNow) {
    const windowBeats = timingWindowBeats(state.bpm);

    state.events.forEach((ev, index) => {
        // --- DELETE THE WRONG CODE THAT WAS HERE ---

        // This should be the only logic inside the loop:
        if (!ev.judged && beatNow > ev.beat + windowBeats) {
            ev.judged = true;
            const wasAttempted = state.inputAttemptedDuringWindow.has(index);

            if (wasAttempted) {
                ev.miss = true;
                state.failCount++;
                showHitZoneFeedback(false, false);
                addDebugEntry(`❌ MISS: Expected ${ev.type === 'chord' ? 'chord' : midiToName(ev.midi)} at beat ${ev.beat.toFixed(2)}`);
            } else {
                ev.skipped = true;
                state.skippedCount++;
                showHitZoneFeedback(false, true);
                addDebugEntry(`⊝ SKIP: Expected ${ev.type === 'chord' ? 'chord' : midiToName(ev.midi)} at beat ${ev.beat.toFixed(2)}`);
            }

            updateScoreDisplay();
            const status = $("status");
            if (status) status.textContent = wasAttempted ? "✗ miss" : "⊝ skip";
        }
    });

    while (state.nextIdx < state.events.length && state.events[state.nextIdx].judged) {
        state.nextIdx++;
    }
}

let lastDebugTime = 0;

function loop() {
    if (!state.practicing) return;

    try {
        const now = state.audioCtx.currentTime;
        let beatNow = currentBeat(now);

        if (state.isLooping && state.loopEndBeat > 0) {
            if (beatNow >= state.loopEndBeat) {

                // 1. Reset Events for the loop
                state.events.forEach(ev => {
                    if (ev.beat >= state.loopStartBeat && ev.beat < state.loopEndBeat) {
                        ev.hit = false;
                        ev.miss = false;
                        ev.skipped = false;
                        ev.judged = false;
                        ev.visualNote = null;
                    }
                });

                state.nextIdx = state.events.findIndex(e => e.beat >= state.loopStartBeat);
                if (state.nextIdx === -1) state.nextIdx = 0;

                clearVisualNotes();

                // 2. Decide: Wait or Seamless?
                if (state.loopWait) {
                    // WAIT MODE: Jump back to 4 beats BEFORE the start
                    const waitBeats = 4;
                    // Calculate new start time so that 'now' equals 'loopStart - 4'
                    state.startTime = now - beatsToSeconds(state.loopStartBeat - waitBeats, state.bpm);
                    // Update beatNow so visuals render correctly immediately
                    beatNow = state.loopStartBeat - waitBeats;

                    addDebugEntry("⏳ Loop Wait (4 beats)...");
                } else {
                    // SEAMLESS MODE: Immediate restart
                    const overshoot = beatNow - state.loopEndBeat;
                    const newBeatTime = state.loopStartBeat + overshoot;
                    state.startTime = now - beatsToSeconds(newBeatTime, state.bpm);
                    beatNow = newBeatTime;

                    addDebugEntry("🔄 Loop Restart");
                }
            }
        }
        updateVisualNotes(beatNow);

        const skipAudioProcessing = now < state.ignoreUntil;
        if (beatNow < 0) {
            $("now").textContent = `count-in… beat=${beatNow.toFixed(2)} @ ${state.bpm} BPM`;
        } else {
            $("now").textContent = `beat=${beatNow.toFixed(3)} @ ${state.bpm} BPM`;
        }

        if ($("metroOn").checked) {
            if (now >= state.nextMetroTime && state.nextMetroTime > 0) {
                const currentBeatInt = Math.floor(beatNow);
                const barPos = ((currentBeatInt % CONSTANTS.BEATS_PER_BAR) + CONSTANTS.BEATS_PER_BAR) % CONSTANTS.BEATS_PER_BAR;
                if (!state.isLooping || (beatNow >= state.loopStartBeat && beatNow < state.loopEndBeat)) {
                    metroTick(barPos === 0);
                }
                let nextTime = state.nextMetroTime + beatsToSeconds(1, state.bpm);
                if (nextTime < now + 0.05) nextTime = now + beatsToSeconds(1, state.bpm);
                state.nextMetroTime = nextTime;
            }
        }

        let freq = null, conf = 0, rms = 0, onset = false;
        let detectionMethod = "none";
        let chordDetectionResult = null;

        if (!skipAudioProcessing) {
            try {
                const buf = new Float32Array(state.analyser.fftSize);
                state.analyser.getFloatTimeDomainData(buf);
                const expectedEvent = getCurrentExpectedEvent(beatNow);

                const detection = hybridDetection(state.analyser, buf, state.audioCtx.sampleRate, expectedEvent);
                detectionMethod = detection.method;

                if (detection.method.includes('yin')) {
                    freq = detection.result.freq;
                    conf = detection.result.conf;
                    rms = detection.result.rms;
                } else if (detection.method === 'fft' || detection.method.includes('override')) {
                    chordDetectionResult = detection.result;
                    if (detection.result.freq) {
                        freq = detection.result.freq;
                        conf = detection.result.conf;
                        rms = detection.result.rms;
                    }
                    if (detection.method === 'fft') {
                        let rmsSum = 0;
                        for (let i = 0; i < buf.length; i++) rmsSum += buf[i] * buf[i];
                        rms = Math.sqrt(rmsSum / buf.length);
                        conf = chordDetectionResult ? chordDetectionResult.confidence : 0;
                    }
                }

                onset = rms > 0.004 || rms > state.lastRms * 1.2;
                state.lastRms = 0.9 * state.lastRms + 0.1 * rms;
                updateAdaptiveCalibration(state.analyser, rms, onset && rms > 0.001);

            } catch (error) {
                console.error(error);
            }
        }

        // --- RAW AUDIO DEBUG LOG (TOGGLEABLE) ---
        if (state.debugMode && rms > 0.002 && conf > 0.5 && freq) {
            const detectedNote = midiToName(Math.round(freqToMidi(freq)));
            console.log(`RAW AUDIO: ${detectedNote} (${freq.toFixed(1)}Hz) | Conf: ${conf.toFixed(2)} | RMS: ${rms.toFixed(4)} | Beat: ${beatNow.toFixed(2)}`);
        }

        if (state.debugMode && (now - lastDebugTime > 2)) {
            console.log(`🎤 AUDIO HEARTBEAT: RMS=${rms.toFixed(5)} Conf=${conf.toFixed(2)} Freq=${freq ? freq.toFixed(1) : 'null'}`);
            lastDebugTime = now;
        }
        // ----------------------------------------

        $("level").value = Math.min(1, rms * 20);
        if ($("levelText")) $("levelText").textContent = `rms=${rms.toFixed(4)}`;

        let shouldProcessDetection = false;
        if (!skipAudioProcessing) {
            const beatDurationSec = 60 / state.bpm;
            const adaptiveCooldown = Math.min(CONSTANTS.COOLDOWN_SEC, beatDurationSec * 0.3);
            const canTrigger = (now - state.lastTriggerAt) > adaptiveCooldown;
            const canTriggerChord = (now - state.lastTriggerAt) > (adaptiveCooldown * 0.5);

            if (freq) {
                let midiFloat = freqToMidi(freq);
                let midiRounded = Math.round(midiFloat);

                if (midiRounded !== null) {
                    if (state.lastMidiRounded === midiRounded) state.stableCount++;
                    else { state.lastMidiRounded = midiRounded; state.stableCount = 1; }
                } else { state.stableCount = 0; }

                const isStrongSignal = rms > 0.0005 && conf > 0.30;
                const validSignal = onset || isStrongSignal;
                shouldProcessDetection = !state.exerciseCompleted && validSignal && state.stableCount >= CONSTANTS.STABLE_FRAMES && canTrigger;
            }
            else if (detectionMethod === 'fft' && chordDetectionResult) {
                state.stableCount = CONSTANTS.STABLE_FRAMES;
                shouldProcessDetection = !state.exerciseCompleted && chordDetectionResult && canTriggerChord;
            }

            if (shouldProcessDetection) {
                state.lastTriggerAt = now;
                let verdict = null;

                if (freq) {
                    verdict = tryMatchPlayed(beatNow, freq);
                    $("lastNote").textContent = midiToName(Math.round(freqToMidi(freq)));
                    $("lastNote").classList.add("flash");
                } else if (detectionMethod === 'fft') {
                    const expectedEvent = getCurrentExpectedEvent(beatNow);
                    if (expectedEvent && expectedEvent.type === "chord") {
                        const beatDuration = 60 / state.bpm;
                        const earlyTolerance = Math.max(0.15, Math.min(0.4, (0.25 / beatDuration)));
                        const timingDiff = beatNow - expectedEvent.beat;

                        if (timingDiff >= -earlyTolerance) {
                            const success = chordDetectionResult.success || false;
                            const eventIndex = state.events.indexOf(expectedEvent);
                            if (eventIndex !== -1) state.inputAttemptedDuringWindow.add(eventIndex);

                            if (success) {
                                verdict = {
                                    ok: true,
                                    expected: expectedEvent.notes[0].midi,
                                    detected: expectedEvent.notes[0].midi,
                                    timingBeats: timingDiff,
                                    expectedBeat: expectedEvent.beat,
                                    isChord: true
                                };
                                expectedEvent.hit = true;
                                expectedEvent.judged = true;
                                const detectedNames = chordDetectionResult.detectedNotes.map(n => midiToName(n.midi)).join('+');
                                $("lastNote").textContent = detectedNames;
                                $("lastNote").classList.add("flash");
                            }
                        }
                    }
                }

                if (verdict) {
                    const detectedName = midiToName(Math.round(verdict.detected));
                    const expectedName = midiToName(verdict.expected);

                    $("lastNoteMeta").textContent = `detected=${detectedName}`;

                    if (verdict.ok) {
                        const timing = verdict.timingBeats;
                        let timingLabel = "";
                        if (timing < -0.05) timingLabel = " (Early)";
                        else if (timing > 0.05) timingLabel = " (Late)";
                        else timingLabel = " (Perfect)";

                        $("lastNote").style.outlineColor = "#1a7f37";
                        $("status").textContent = `✓ correct${timingLabel}`;

                        let logMessage = "";
                        if (verdict.isChord) {
                            logMessage = `🎵 CHORD ✓ HIT${timingLabel} | Beat ${verdict.expectedBeat.toFixed(2)}`;
                        } else {
                            logMessage = `🎵 NOTE ✓ HIT${timingLabel} | Detected: ${detectedName} | Timing: Δ${verdict.timingBeats.toFixed(2)}`;
                        }
                        addDebugEntry(logMessage);

                        state.successCount++;
                        showFullScreenFeedback(true);
                        showHitZoneFeedback(true);
                        updateScoreDisplay();
                    } else {
                        $("lastNote").style.outlineColor = "#b42318";
                        $("status").textContent = "✗ wrong note";
                    }
                }
                setTimeout(() => $("lastNote").classList.remove("flash"), 200);
            }

            judgeMisses(beatNow);
            renderNotes();
        } else {
            judgeMisses(beatNow);
            renderNotes();
        }

        if (!state.exerciseCompleted && state.events.length > 0 && !state.isLooping) {
            const allNotesJudged = state.events.every(ev => ev.judged);
            if (allNotesJudged) {
                state.exerciseCompleted = true;
                const lastNoteBeat = Math.max(...state.events.map(ev => ev.beat));
                state.exerciseEndBeat = lastNoteBeat + 4;
                $("status").textContent = "exercise complete...";
            }
        }

        if (state.exerciseCompleted && !state.autoStopScheduled && beatNow >= state.exerciseEndBeat) {
            state.autoStopScheduled = true;
            $("btnStop").click();
            return;
        }

    } catch (criticalError) {
        console.error("CRITICAL LOOP ERROR:", criticalError);
        state.practicing = false;
        $("status").textContent = "Error in loop. Check console.";
    }

    state.rafId = requestAnimationFrame(loop);
}

// ... (EVENT LISTENERS) ...

// 1. Enable Mic Button
$("btnMic").addEventListener("click", async () => {
    try {
        if (state.audioCtx || state.micStream) {
            console.log("Microphone already initialized");
            return;
        }

        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        state.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
            }
        });

        const src = state.audioCtx.createMediaStreamSource(state.micStream);
        state.analyser = state.audioCtx.createAnalyser();
        state.analyser.fftSize = 8192;
        src.connect(state.analyser);

        $("micStatus").textContent = "Enabled ✓ (listening)";
        $("status").textContent = "mic ready";
        $("btnStart").disabled = false;
        $("btnMic").textContent = "Mic Enabled ✓";
        $("btnMic").disabled = true;
    } catch (e) {
        console.error(e);
        $("micStatus").textContent = "Error accessing mic";
        alert("Microphone access needed!");
    }
});

// 2. Start/Stop
$("btnStart").addEventListener("click", async () => {
    if (!state.audioCtx) {
        state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        state.analyser = state.audioCtx.createAnalyser();
        state.analyser.fftSize = 2048;
        try {
            state.micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false, latency: 0 } });
            const micSource = state.audioCtx.createMediaStreamSource(state.micStream);
            micSource.connect(state.analyser);
        } catch (e) { alert("Microphone access needed!"); return; }
    }
    if (state.audioCtx.state === "suspended") await state.audioCtx.resume();

    resetPractice();
    state.practicing = true;

    const bpm = state.bpm;
    const secondsPerBeat = 60 / bpm;

    const countInCheckbox = $("countInOn");
    const countInBeats = (countInCheckbox && countInCheckbox.checked) ? 4 : 0;
    const countInSeconds = countInBeats * secondsPerBeat;

    const now = state.audioCtx.currentTime + 0.1;
    state.startTime = now + countInSeconds;

    state.nextMetroTime = state.startTime - countInSeconds;

    if ($("loopMode") && $("loopMode").checked) {
        state.isLooping = true;
        addDebugEntry(`🔄 Looping Bars: Beats ${state.loopStartBeat}-${state.loopEndBeat}`);
    } else {
        state.isLooping = false;
    }

    $("btnStart").disabled = true;
    $("btnStop").disabled = false;
    $("status").textContent = "Practicing...";
    clearDebugLog();

    if (state.events && state.events.length > 0) {
        const exerciseNotes = state.events.map((ev, i) => {
            if (ev.type === "chord") return `${i + 1}: Chord`;
            return `${i + 1}: ${midiToName(ev.midi)}`;
        }).join(", ");
        addDebugEntry(`🎼 EXERCISE START: ${exerciseNotes}`);
    }

    loop();
});

$("btnStop").addEventListener("click", () => {
    const totalEvents = state.successCount + state.failCount + state.skippedCount;

    if (state.practicing && totalEvents > 0) {
        addPracticeHistoryEntry();
        addDebugEntry(`💾 SAVED PRACTICE: ${state.successCount}✓ ${state.failCount}✗ ${state.skippedCount}⊝`);
    }

    resetPractice();

    if (state.audioCtx) state.audioCtx.suspend();
});

// 3. Loop Mode
$("loopMode").addEventListener("change", (e) => {
    state.isLooping = e.target.checked;
});

// --- NEW LISTENER HERE ---
$("loopWait").addEventListener("change", (e) => {
    state.loopWait = e.target.checked;
});

// 4. BPM and Threshold Controls
function setBpm(val) {
    state.bpm = parseInt(val);
    $("bpm").value = state.bpm;
    $("bpmNum").value = state.bpm;
}
$("bpm").addEventListener("input", (e) => setBpm(e.target.value));
$("bpmNum").addEventListener("change", (e) => setBpm(e.target.value));

$("fftThreshold").addEventListener("input", (e) => setFftThreshold(e.target.value));
$("fftThresholdNum").addEventListener("change", (e) => setFftThreshold(e.target.value));

// NEW: Debug Toggle Listener
$("debugMode").addEventListener("change", (e) => {
    state.debugMode = e.target.checked;
});

// 5. Calibration Buttons
$("btnCalibrate").addEventListener("click", () => {
    if (!state.audioCtx || !state.analyser) {
        alert("Please enable microphone access first!");
        return;
    }
    startHardwareCalibration();
});

function closeCalibrationModal() {
    $("calibrationModal").style.display = "none";
    $("calibrationOverlay").style.display = "none";
}

$("skipCalibration").addEventListener("click", () => {
    state.hardwareCalibration.isCalibrated = false;
    updateCalibrationStatus();
    closeCalibrationModal();
});

$("closeCalibration").addEventListener("click", closeCalibrationModal);
$("calibrationOverlay").addEventListener("click", closeCalibrationModal);

$("adaptiveCalibration").addEventListener("change", (e) => {
    state.adaptiveCalibration.enabled = e.target.checked;
});

$("resetCalibration").addEventListener("click", () => {
    state.adaptiveCalibration.noiseFloor = -60;
    state.adaptiveCalibration.signalPeak = -20;
    state.adaptiveCalibration.confidence = 0;
});

// 6. Debug Buttons
$("clearDebug").addEventListener("click", clearDebugLog);
$("copyDebug").addEventListener("click", copyDebugToClipboard);
$("clearHistory").addEventListener("click", () => {
    clearPracticeHistory();
});

// 7. Window Resize
window.addEventListener('resize', () => {
    const fretboard = $("fretboard");
    if (fretboard) {
        const width = fretboard.offsetWidth;
        setNoteTravelDistance(width - CONSTANTS.HIT_ZONE_X - 40);
    }
});

// --- INITIALIZATION ---
window.dispatchEvent(new Event('resize'));

setupMusicXMLUpload();
loadAvailableExercises();
setFftThreshold(-40);
updateCalibrationStatus();