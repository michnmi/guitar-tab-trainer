import { state } from './state.js';
import { midiToFret, $ } from './utils.js';

export function renderStaticTab(exercise) {
    const container = $("staticTab");
    if (!container) return; // Guard in case element missing
    container.innerHTML = '';

    const track = document.createElement('div');
    track.className = 'tab-track';

    let maxBeat = 0;
    exercise.notes.forEach(n => {
        const beat = n.beat || 0;
        maxBeat = Math.max(maxBeat, beat);
    });

    // Round up to nearest measure (4 beats)
    const totalMeasures = Math.ceil((maxBeat + 4) / 4);

    for (let m = 0; m < totalMeasures; m++) {
        const measureDiv = document.createElement('div');
        measureDiv.className = 'tab-measure';
        measureDiv.dataset.barIndex = m;

        // Add Measure Number
        const num = document.createElement('div');
        num.className = 'tab-measure-number';
        num.textContent = m + 1;
        measureDiv.appendChild(num);

        // Draw 6 String Lines
        for (let s = 0; s < 6; s++) {
            const line = document.createElement('div');
            line.className = 'tab-string-line';
            line.style.top = (20 + s * 16) + 'px';
            measureDiv.appendChild(line);
        }

        // Click handler for selection
        measureDiv.addEventListener('click', () => toggleBarSelection(m));
        track.appendChild(measureDiv);
    }

    exercise.notes.forEach(event => {
        const notesToRender = event.type === 'chord' ? event.notes : [event];

        notesToRender.forEach(note => {
            const beat = event.beat;
            const measureIndex = Math.floor(beat / 4);
            const beatInMeasure = beat % 4;

            const targetMeasure = track.children[measureIndex];
            if (!targetMeasure) return;

            const noteEl = document.createElement('div');
            noteEl.className = 'tab-note-marker';

            let visualLineIndex, fretNum;

            if (note.string !== undefined) {
                // --- MusicXML Path ---
                // MusicXML: String 1 = High E, String 6 = Low E
                // Tab View: Line 0 = High E, Line 5 = Low E
                // Formula: string - 1
                visualLineIndex = note.string - 1;
                fretNum = note.fret;
            } else {
                // --- Internal MIDI Path ---
                // Utils: Index 0 = Low E, Index 5 = High E
                // Tab View: Line 0 = High E, Line 5 = Low E
                // Formula: 5 - index
                const calc = midiToFret(note.midi);
                if (!calc) return;
                visualLineIndex = 5 - calc.string;
                fretNum = calc.fret;
            }

            noteEl.textContent = fretNum;

            // Apply calculated top position
            noteEl.style.top = (20 + visualLineIndex * 16) + 'px';

            // Horizontal Position
            const leftPercent = (beatInMeasure / 4) * 100;
            noteEl.style.left = `calc(${leftPercent}% + 10px)`; // +10px padding

            targetMeasure.appendChild(noteEl);
        });
    });

    container.appendChild(track);
}

let selectedStartBar = -1;
let selectedEndBar = -1;

function toggleBarSelection(barIndex) {
    if (selectedStartBar === -1 || (selectedStartBar !== -1 && selectedEndBar !== -1)) {
        // Start new selection
        selectedStartBar = barIndex;
        selectedEndBar = -1;
    } else {
        // Complete range
        if (barIndex < selectedStartBar) {
            selectedEndBar = selectedStartBar;
            selectedStartBar = barIndex;
        } else {
            selectedEndBar = barIndex;
        }
    }

    // Update UI
    const measures = document.querySelectorAll('.tab-measure');
    measures.forEach((m, idx) => {
        m.classList.remove('selected');
        const end = selectedEndBar === -1 ? selectedStartBar : selectedEndBar;
        if (idx >= selectedStartBar && idx <= end && selectedStartBar !== -1) {
            m.classList.add('selected');
        }
    });

    // Update State
    const startBeat = selectedStartBar * 4;
    const endBeat = (selectedEndBar === -1 ? selectedStartBar : selectedEndBar) * 4 + 4;

    state.loopStartBeat = startBeat;
    state.loopEndBeat = endBeat;

    if (state.loopStartBeat >= 0) {
        const loopCheck = $("loopMode");
        if (loopCheck) loopCheck.checked = true;
        state.isLooping = true;
    }
}