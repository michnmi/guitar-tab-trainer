import { state } from './state.js';
import { CONSTANTS, $ } from './utils.js';

export function setFftThreshold(val) {
    const v = parseFloat(val);
    const fftInput = $("fftThreshold");
    const fftDisplay = $("fftThresholdDisplay");
    if (fftInput) fftInput.value = v;
    if (fftDisplay) fftDisplay.textContent = v;
}

export function updateCalibrationStatus() {
    const statusEl = $("calibrationStatus");
    if (!statusEl) return;

    if (state.hardwareCalibration.isCalibrated) {
        statusEl.textContent = `Calibrated (Quality: ${(state.hardwareCalibration.quality * 100).toFixed(0)}%)`;
        statusEl.style.color = state.hardwareCalibration.quality > 0.5 ? "#1a7f37" : "#d29922";
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
        alert("Please start audio first!");
        return;
    }

    state.hardwareCalibration.isCalibrating = true;
    state.hardwareCalibration.currentString = 0;
    state.hardwareCalibration.stringData = [];

    const strings = ["Low E", "A", "D", "G", "B", "High E"];
    let step = 0;

    const overlay = document.createElement('div');
    overlay.id = 'calibrationOverlay';
    overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.85); z-index: 1000;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: white; font-family: sans-serif;
  `;
    document.body.appendChild(overlay);

    function runStep() {
        if (step >= strings.length) {
            finishCalibration(overlay);
            return;
        }

        overlay.innerHTML = `
      <h2 style="font-size: 2em; margin-bottom: 20px;">Calibrating ${strings[step]}</h2>
      <p style="font-size: 1.2em;">Strum the <strong>${strings[step]}</strong> string openly and let it ring.</p>
      <div style="width: 200px; height: 10px; background: #333; margin-top: 20px; border-radius: 5px;">
        <div id="calibProgress" style="width: 0%; height: 100%; background: #007bff; border-radius: 5px; transition: width 0.2s;"></div>
      </div>
    `;

        let samples = [];
        let startTime = Date.now();
        const duration = 2000;

        const interval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(100, (elapsed / duration) * 100);
            const progEl = document.getElementById('calibProgress');
            if (progEl) progEl.style.width = progress + '%';

            const buf = new Float32Array(state.analyser.fftSize);
            state.analyser.getFloatTimeDomainData(buf);

            let rms = 0;
            for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
            rms = Math.sqrt(rms / buf.length);

            const bufferLength = state.analyser.frequencyBinCount;
            const dataArray = new Float32Array(bufferLength);
            state.analyser.getFloatFrequencyData(dataArray);
            let maxDb = -100;
            for (let i = 0; i < bufferLength; i++) {
                if (dataArray[i] > maxDb) maxDb = dataArray[i];
            }

            samples.push({ rms, maxDb });

            if (elapsed >= duration) {
                clearInterval(interval);
                state.hardwareCalibration.stringData.push(processSamples(samples));
                step++;
                runStep();
            }
        }, 50);
    }

    runStep();
}

function processSamples(samples) {
    const avgRms = samples.reduce((sum, s) => sum + s.rms, 0) / samples.length;
    const maxDb = samples.reduce((max, s) => Math.max(max, s.maxDb), -100);
    return { avgRms, maxDb };
}

function finishCalibration(overlay) {
    state.hardwareCalibration.isCalibrating = false;
    state.hardwareCalibration.isCalibrated = true;
    state.hardwareCalibration.timestamp = Date.now();

    const avgSignal = state.hardwareCalibration.stringData.reduce((sum, d) => sum + d.maxDb, 0) / 6;
    state.hardwareCalibration.averageSignal = avgSignal;
    state.hardwareCalibration.optimalThreshold = avgSignal - 15;
    state.hardwareCalibration.quality = 1.0;

    setFftThreshold(state.hardwareCalibration.optimalThreshold);
    updateCalibrationStatus();

    overlay.innerHTML = `
    <h2 style="color: #4caf50;">Calibration Complete!</h2>
    <p>Optimal Threshold set to: ${state.hardwareCalibration.optimalThreshold.toFixed(1)} dB</p>
    <button onclick="document.getElementById('calibrationOverlay').remove()" 
      style="padding: 10px 20px; font-size: 1.2em; cursor: pointer; margin-top: 20px;">
      Done
    </button>
  `;
}

export function updateAdaptiveCalibration(analyser, currentRms, isNoteActive) {
    if (!state.adaptiveCalibration.enabled || state.hardwareCalibration.isCalibrated) return;

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