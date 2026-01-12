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
    loopWait: false,
    loopStartBeat: 0,
    loopEndBeat: 0,

    // --- NEW: Data Storage (Add these lines) ---
    debugLog: [],        // Stores the log messages
    practiceHistory: [], // Stores your session scores
    // -------------------------------------------

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
        history: [],
        noiseFloor: -60,
        signalPeak: -20,
        confidence: 0,
        adaptiveThreshold: -40,
        // Safety defaults in case they are accessed before init
        activeSamples: 0,
        silentSamples: 0,
        minSamples: 100
    },

    // UI Toggles
    debugMode: false
};

// Travel distance for notes in pixels (calculated on resize)
export let noteTravelDistance = 800;

export function setNoteTravelDistance(dist) {
    noteTravelDistance = dist;
}