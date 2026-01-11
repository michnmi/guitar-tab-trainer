import { CONSTANTS } from './utils.js';

export const state = {
    practicing: false,
    audioCtx: null,
    analyser: null,
    micStream: null,
    rafId: null,

    // Audio Engine State
    lastRms: 0,
    ignoreUntil: 0,
    lastTriggerAt: 0,
    lastMidiRounded: -1,
    stableCount: 0,
    startTime: 0,
    nextMetroTime: 0,
    metronomeStartTime: null,

    // Song / Exercise State
    bpm: 90,
    currentExercise: null,
    events: [],
    nextIdx: 0,
    visualNotes: new Map(), // id -> visualElement
    nextNoteId: 0,
    inputAttemptedDuringWindow: new Set(), // indices of events

    // Scoring
    successCount: 0,
    failCount: 0,
    skippedCount: 0,
    exerciseCompleted: false,
    exerciseEndBeat: 0,
    autoStopScheduled: false,

    // Looping
    isLooping: false,
    loopWait: false, // <--- ADD THIS LINE
    loopStartBeat: 0,
    loopEndBeat: 0,

    // Calibration
    hardwareCalibration: {
        isCalibrated: false,
        noiseFloor: -90,
        signalPeak: -30,
        optimalThreshold: -50,
        quality: 0
    },
    adaptiveCalibration: {
        enabled: true,
        history: [], // Stores last 5 seconds of peak levels
        noiseFloor: -60,
        signalPeak: -20,
        confidence: 0,
        adaptiveThreshold: -40
    },

    // UI Toggles
    debugMode: false // New Toggle for Console Logs
};

// Travel distance for notes in pixels (calculated on resize)
export let noteTravelDistance = 800;

export function setNoteTravelDistance(dist) {
    noteTravelDistance = dist;
}