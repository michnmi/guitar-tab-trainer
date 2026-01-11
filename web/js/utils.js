export const $ = (id) => document.getElementById(id);

export const CONSTANTS = {
    MIN_RMS: 0.0005,
    STABLE_FRAMES: 2,
    CENTS_TOLERANCE: 40,
    COOLDOWN_SEC: 0.25,
    DEFAULT_BPM: 90,
    BEATS_PER_BAR: 4,
    TUNING: [40, 45, 50, 55, 59, 64],
    STRING_NAMES: ["E", "A", "D", "G", "B", "E"],
    STRING_POSITIONS: [345, 285, 225, 165, 105, 45],
    LOOKAHEAD_BEATS: 4,
    HIT_ZONE_X: 60,
    MAX_FRET: 12
};

export function midiToName(midi) {
    const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const n = names[midi % 12];
    const oct = Math.floor(midi / 12) - 1;
    return `${n}${oct}`;
}

export function freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export function centsDiff(midiFloat, midiInt) {
    return (midiFloat - midiInt) * 100;
}

export function secondsToBeats(seconds, bpm) {
    return (seconds * bpm) / 60;
}

export function beatsToSeconds(beats, bpm) {
    return (beats * 60) / bpm;
}

export function timingWindowBeats(bpm) {
    // Widened window: 0.35 multiplier instead of 0.25
    return Math.max(0.25, Math.min(0.80, (120 / bpm) * 0.35));
}

export function midiToFret(midiNote) {
    const candidates = [];
    for (let stringIdx = 0; stringIdx < CONSTANTS.TUNING.length; stringIdx++) {
        const openStringMidi = CONSTANTS.TUNING[stringIdx];
        const fret = midiNote - openStringMidi;
        if (fret >= 0 && fret <= CONSTANTS.MAX_FRET) {
            candidates.push({
                string: stringIdx,
                fret: fret,
                y: CONSTANTS.STRING_POSITIONS[stringIdx],
                stringName: CONSTANTS.STRING_NAMES[stringIdx]
            });
        }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.fret - b.fret);
    return candidates[0];
}