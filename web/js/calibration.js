import { state } from './state.js';
import { CONSTANTS, $, freqToMidi, midiToName } from './utils.js';
import { yinPitch } from './audio-engine.js';

export function setFftThreshold(val) {
    const v = parseFloat(val);
    const fftInput = $("fftThreshold");
    const fftDisplay = $("fftThresholdNum");
    if (fftInput) fftInput.value = v;
    if (fftDisplay) fftDisplay.value = v;
}

export function updateCalibrationStatus() {
    const statusEl = $("calibrationStatus");
    if (!statusEl) return;

    if (state.hardwareCalibration.isCalibrated) {
        statusEl.textContent = `Calibrated (Threshold: ${state.hardwareCalibration.optimalThreshold.toFixed(0)}dB)`;
        statusEl.style.color = "#1a7f37";
        statusEl.style.fontWeight = "bold";
    } else if (state.adaptiveCalibration.enabled) {
        statusEl.textContent = "Adaptive Mode Active";
        statusEl.style.color = "#0969da";
    } else {
        statusEl.textContent = "Not Calibrated";
        statusEl.style.color = "#666";
    }
}

export function startHardwareCalibration() {
    if (!state.audioCtx) {
        alert("Please start audio first (Enable Mic)!");
        return;
    }

    state.hardwareCalibration.isCalibrating = true;
    state.hardwareCalibration.stringData = [];

    // MIDI values for standard tuning: E2, A2, D3, G3, B3, E4
    const stringTargets = [
        { name: "Low E", midi: 40 },
        { name: "A", midi: 45 },
        { name: "D", midi: 50 },
        { name: "G", midi: 55 },
        { name: "B", midi: 59 },
        { name: "High E", midi: 64 }
    ];

    let step = 0;
    let detectionPhase = "listening"; // 'listening' or 'recording'
    let recordingStartTime = 0;
    const RECORD_DURATION = 2000;
    let animationFrameId;

    // Create Overlay
    const overlay = document.createElement('div');
    overlay.id = 'calibrationOverlay';
    overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.9); z-index: 2000;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: white; font-family: system-ui, sans-serif;
  `;
    document.body.appendChild(overlay);

    // Buffers for data collection
    let currentSamples = [];

    function renderStep() {
        if (step >= stringTargets.length) {
            finishCalibration(overlay);
            return;
        }

        const target = stringTargets[step];

        let statusHtml = "";
        if (detectionPhase === "listening") {
            statusHtml = `<div style="color: #ffc107; font-size: 1.5em; margin-top: 10px;">👂 Listening... Play the open string</div>`;
        } else {
            statusHtml = `<div style="color: #28a745; font-size: 1.5em; margin-top: 10px;">✅ Detected! Recording levels...</div>`;
        }

        overlay.innerHTML = `
      <h2 style="font-size: 2.5em; margin-bottom: 10px; font-weight: 800;">${target.name} String</h2>
      <p style="font-size: 1.2em; opacity: 0.8;">Play the open <strong>${target.name}</strong> string cleanly and let it ring.</p>
      
      ${statusHtml}

      <div style="width: 300px; height: 16px; background: #333; margin-top: 30px; border-radius: 8px; overflow: hidden; border: 1px solid #555;">
        <div id="calibProgress" style="width: 0%; height: 100%; background: #007bff; transition: width 0.1s linear;"></div>
      </div>
      
      <div id="debugPitch" style="margin-top: 20px; font-family: monospace; opacity: 0.5;"></div>

      <button id="btnCancelCalib" style="margin-top: 40px; background: transparent; border: 1px solid #666; color: #888; padding: 8px 16px; cursor: pointer; border-radius: 4px;">Cancel</button>
    `;

        document.getElementById("btnCancelCalib").onclick = () => {
            cancelAnimationFrame(animationFrameId);
            overlay.remove();
            state.hardwareCalibration.isCalibrating = false;
        };

        // Reset Logic for next step
        detectionPhase = "listening";
        currentSamples = [];
        detectLoop();
    }

    function detectLoop() {
        if (!state.hardwareCalibration.isCalibrating) return;

        const analyser = state.analyser;
        const bufferLength = analyser.fftSize;
        const timeBuf = new Float32Array(bufferLength);
        analyser.getFloatTimeDomainData(timeBuf);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i];
        const rms = Math.sqrt(sum / timeBuf.length);

        // Detect Pitch
        const pitchResult = yinPitch(timeBuf, state.audioCtx.sampleRate);

        const target = stringTargets[step];
        const debugEl = document.getElementById("debugPitch");

        if (detectionPhase === "listening") {
            // WAIT FOR SIGNAL LOGIC
            // Threshold: RMS > 0.005 and Pitch Confidence > 0.4
            if (rms > 0.005 && pitchResult.conf > 0.4 && pitchResult.freq) {
                const detectedMidi = freqToMidi(pitchResult.freq);
                const noteName = midiToName(Math.round(detectedMidi));

                // Allow +/- 3 semitones tolerance (in case untuned)
                if (Math.abs(detectedMidi - target.midi) < 3) {
                    detectionPhase = "recording";
                    recordingStartTime = Date.now();
                    // Update UI immediately to show green
                    const statusDiv = overlay.querySelector('div[style*="font-size: 1.5em"]');
                    if (statusDiv) {
                        statusDiv.innerHTML = "✅ Detected! Recording levels...";
                        statusDiv.style.color = "#28a745";
                    }
                } else {
                    if (debugEl) debugEl.textContent = `Heard ${noteName} (Expected ${target.name})`;
                }
            } else {
                if (debugEl) debugEl.textContent = `Waiting for signal... (rms: ${rms.toFixed(4)})`;
            }
        }

        if (detectionPhase === "recording") {
            const elapsed = Date.now() - recordingStartTime;
            const progress = Math.min(100, (elapsed / RECORD_DURATION) * 100);

            const progEl = document.getElementById('calibProgress');
            if (progEl) progEl.style.width = progress + '%';

            // Collect frequency data for max dB calculation
            const freqBins = new Float32Array(analyser.frequencyBinCount);
            analyser.getFloatFrequencyData(freqBins);
            let maxDb = -100;
            for (let f = 0; f < freqBins.length; f++) if (freqBins[f] > maxDb) maxDb = freqBins[f];

            currentSamples.push({ rms, maxDb });

            if (elapsed >= RECORD_DURATION) {
                // Done with this string
                state.hardwareCalibration.stringData.push(processSamples(currentSamples));
                step++;
                renderStep(); // Next string
                return; // Stop this loop
            }
        }

        animationFrameId = requestAnimationFrame(detectLoop);
    }

    renderStep();
}

function processSamples(samples) {
    if (samples.length === 0) return { avgRms: 0, maxDb: -50 };
    // We want the average 'loud' signal, not the decay tail
    // Sort by maxDb desc, take top 50%
    samples.sort((a, b) => b.maxDb - a.maxDb);
    const topSlice = samples.slice(0, Math.ceil(samples.length * 0.5));

    const avgSignal = topSlice.reduce((sum, s) => sum + s.maxDb, 0) / topSlice.length;
    return { maxDb: avgSignal };
}

function finishCalibration(overlay) {
    state.hardwareCalibration.isCalibrating = false;
    state.hardwareCalibration.isCalibrated = true;
    state.hardwareCalibration.timestamp = Date.now();

    // Calculate average peak across all strings
    const avgSignal = state.hardwareCalibration.stringData.reduce((sum, d) => sum + d.maxDb, 0) / 6;
    state.hardwareCalibration.averageSignal = avgSignal;

    // Set optimal threshold: Peak - 15dB (give some headroom)
    // Ensure it doesn't go below -55dB or above -10dB
    let optimal = avgSignal - 15;
    optimal = Math.max(-55, Math.min(-10, optimal));

    state.hardwareCalibration.optimalThreshold = optimal;
    state.hardwareCalibration.quality = 1.0;

    // Apply it
    setFftThreshold(optimal);
    updateCalibrationStatus();

    // Disable adaptive mode if we have hard calibration
    if ($("adaptiveCalibration")) $("adaptiveCalibration").checked = false;
    state.adaptiveCalibration.enabled = false;

    overlay.innerHTML = `
    <h2 style="color: #4caf50; font-size: 3em; margin-bottom: 20px;">Calibration Complete!</h2>
    <div style="font-size: 1.2em; margin-bottom: 30px;">
        <p>Your average signal is <strong>${avgSignal.toFixed(1)} dB</strong>.</p>
        <p>Optimal Threshold set to: <strong>${optimal.toFixed(1)} dB</strong></p>
    </div>
    <button id="btnFinishCalib" 
      style="padding: 12px 30px; font-size: 1.2em; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 50px;">
      Start Practicing
    </button>
  `;

    document.getElementById("btnFinishCalib").onclick = () => overlay.remove();
}

export function updateAdaptiveCalibration(analyser, currentRms, isNoteActive) {
    if (!state.adaptiveCalibration.enabled || state.hardwareCalibration.isCalibrated) return;

    // Safety Init for properties that might not be in state.js
    if (typeof state.adaptiveCalibration.activeSamples === 'undefined') state.adaptiveCalibration.activeSamples = 0;
    if (typeof state.adaptiveCalibration.silentSamples === 'undefined') state.adaptiveCalibration.silentSamples = 0;
    if (typeof state.adaptiveCalibration.minSamples === 'undefined') state.adaptiveCalibration.minSamples = 100;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatFrequencyData(dataArray);

    let currentMaxDb = -100;
    for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > currentMaxDb) currentMaxDb = dataArray[i];
    }

    if (!isNoteActive) {
        state.adaptiveCalibration.silentSamples++;
        state.adaptiveCalibration.noiseFloor = (state.adaptiveCalibration.noiseFloor * 0.99) + (currentMaxDb * 0.01);
    } else {
        state.adaptiveCalibration.activeSamples++;
        state.adaptiveCalibration.signalPeak = (state.adaptiveCalibration.signalPeak * 0.95) + (currentMaxDb * 0.05);
    }

    if (state.adaptiveCalibration.activeSamples > state.adaptiveCalibration.minSamples) {
        const dynamicRange = state.adaptiveCalibration.signalPeak - state.adaptiveCalibration.noiseFloor;
        if (dynamicRange > 10) {
            const newThreshold = state.adaptiveCalibration.noiseFloor + (dynamicRange * 0.4);
            state.adaptiveCalibration.adaptiveThreshold = newThreshold;
            state.adaptiveCalibration.confidence = Math.min(1.0, state.adaptiveCalibration.activeSamples / 500);

            if (state.adaptiveCalibration.confidence > 0.5) {
                setFftThreshold(newThreshold);
            }
        }
    }
}