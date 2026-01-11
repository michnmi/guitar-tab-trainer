import { state, noteTravelDistance } from './state.js';
import { CONSTANTS, midiToFret, midiToName, $ } from './utils.js';

export function clearVisualNotes() {
    for (const [noteId, noteData] of state.visualNotes) {
        if (noteData.element && noteData.element.parentNode) {
            noteData.element.remove();
        }
    }
    state.visualNotes.clear();
    state.nextNoteId = 0;
}

export function createVisualNote(eventData, fretInfo) {
    const noteId = state.nextNoteId++;
    const fretboard = $("fretboard");

    if (eventData.type === "chord") {
        return createVisualChord(eventData, noteId);
    }

    const noteElement = document.createElement("div");
    noteElement.className = "fret-note";

    const actualFretInfo = fretInfo || midiToFret(eventData.midi);
    if (!actualFretInfo) return null;

    if (actualFretInfo.fret === 0) {
        noteElement.textContent = "O";
        noteElement.style.fontSize = "20px";
        noteElement.classList.add("open-string");
    } else {
        noteElement.textContent = actualFretInfo.fret.toString();
    }

    const currentEventIndex = state.events.findIndex(e => e === eventData);
    let noteDuration = 1.0;

    if (currentEventIndex >= 0 && currentEventIndex < state.events.length - 1) {
        const nextEvent = state.events[currentEventIndex + 1];
        noteDuration = nextEvent.beat - eventData.beat;
    }

    const baseWidth = 80;
    const widthPerBeat = 100;
    const noteWidth = Math.max(baseWidth, noteDuration * widthPerBeat);

    noteElement.style.width = noteWidth + "px";
    const startX = CONSTANTS.HIT_ZONE_X + noteTravelDistance;
    noteElement.style.left = "0px";
    noteElement.style.top = actualFretInfo.y + "px";
    noteElement.style.transform = `translate3d(${startX}px, -50%, 0)`;

    fretboard.appendChild(noteElement);

    const noteData = {
        element: noteElement,
        eventData: eventData,
        fretInfo: actualFretInfo,
        noteId: noteId,
        spawned: false,
        duration: noteDuration,
        feedbackShown: false
    };

    state.visualNotes.set(noteId, noteData);
    return noteData;
}

export function createVisualChord(eventData, baseNoteId) {
    const fretboard = $("fretboard");
    const chordElements = [];
    const chordNoteData = [];

    const currentEventIndex = state.events.findIndex(e => e === eventData);
    let noteDuration = 1.0;

    if (currentEventIndex >= 0 && currentEventIndex < state.events.length - 1) {
        const nextEvent = state.events[currentEventIndex + 1];
        noteDuration = nextEvent.beat - eventData.beat;
    }

    const baseWidth = 80;
    const widthPerBeat = 100;
    const noteWidth = Math.max(baseWidth, noteDuration * widthPerBeat);
    const startX = CONSTANTS.HIT_ZONE_X + noteTravelDistance;

    const chordContainer = document.createElement("div");
    chordContainer.className = "chord-container";
    chordContainer.style.position = "absolute";
    chordContainer.style.left = "0px";
    chordContainer.style.top = "0px";
    chordContainer.style.transform = `translate3d(${startX}px, 0, 0)`;
    chordContainer.style.pointerEvents = "none";

    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < eventData.notes.length; i++) {
        const chordNote = eventData.notes[i];
        const noteId = baseNoteId + i * 0.1;
        let fretInfo;

        if (chordNote.string && chordNote.fret !== undefined) {
            const STRING_NAMES = ["E", "A", "D", "G", "B", "E"];
            fretInfo = {
                string: chordNote.string - 1,
                fret: chordNote.fret,
                y: CONSTANTS.STRING_POSITIONS[6 - chordNote.string],
                stringName: STRING_NAMES[6 - chordNote.string]
            };
        } else {
            fretInfo = midiToFret(chordNote.midi);
        }

        if (!fretInfo) continue;

        const noteElement = document.createElement("div");
        noteElement.className = "fret-note chord-member";

        if (fretInfo.fret === 0) {
            noteElement.textContent = "O";
            noteElement.style.fontSize = "20px";
            noteElement.classList.add("open-string");
        } else {
            noteElement.textContent = fretInfo.fret.toString();
        }

        noteElement.style.width = noteWidth + "px";
        noteElement.style.left = "0px";
        noteElement.style.top = fretInfo.y + "px";
        noteElement.style.transform = `translate3d(0px, -50%, 0)`;

        chordContainer.appendChild(noteElement);
        chordElements.push(noteElement);

        minY = Math.min(minY, fretInfo.y);
        maxY = Math.max(maxY, fretInfo.y);

        const noteData = {
            element: noteElement,
            eventData: eventData,
            fretInfo: fretInfo,
            noteId: noteId,
            spawned: false,
            duration: noteDuration,
            feedbackShown: false,
            chordIndex: i,
            isChordMember: true,
            container: chordContainer
        };

        chordNoteData.push(noteData);
        state.visualNotes.set(noteId, noteData);
    }

    if (chordElements.length > 1) {
        const chordGroup = document.createElement("div");
        chordGroup.className = "chord-group";
        const groupHeight = maxY - minY + 70;
        const groupWidth = noteWidth + 24;
        const groupTop = minY - 35;

        chordGroup.style.width = groupWidth + "px";
        chordGroup.style.height = groupHeight + "px";
        chordGroup.style.left = "-12px";
        chordGroup.style.top = groupTop + "px";
        chordGroup.style.transform = "none";

        chordContainer.appendChild(chordGroup);

        chordNoteData.forEach(noteData => {
            noteData.chordGroup = chordGroup;
        });
    }

    fretboard.appendChild(chordContainer);
    return chordNoteData[0];
}

export function updateVisualNotes(beatNow) {
    const notesToRemove = [];
    for (const event of state.events) {
        if (!event.visualNote && beatNow >= event.beat - CONSTANTS.LOOKAHEAD_BEATS && !event.judged) {
            // Check loop constraints
            if (state.isLooping && (event.beat < state.loopStartBeat || event.beat >= state.loopEndBeat)) continue;

            let noteData = null;
            if (event.type === "chord") {
                noteData = createVisualNote(event, null);
            } else {
                const fretInfo = midiToFret(event.midi);
                if (fretInfo) {
                    noteData = createVisualNote(event, fretInfo);
                }
            }
            if (noteData) {
                event.visualNote = noteData;
                noteData.spawned = true;
            }
        }
    }

    for (const [noteId, noteData] of state.visualNotes) {
        const event = noteData.eventData;
        const timeToHit = event.beat - beatNow;
        const progress = (CONSTANTS.LOOKAHEAD_BEATS - timeToHit) / CONSTANTS.LOOKAHEAD_BEATS;
        const currentX = CONSTANTS.HIT_ZONE_X + noteTravelDistance * (1 - progress);

        if (noteData.isChordMember && noteData.container) {
            if (noteData.chordIndex === 0) {
                noteData.container.style.transform = `translate3d(${currentX}px, 0, 0)`;
            }
        } else {
            noteData.element.style.transform = `translate3d(${currentX}px, -50%, 0)`;
        }

        if (event.hit && !noteData.element.classList.contains("hit")) {
            noteData.element.classList.add("hit");
            if (noteData.chordGroup) noteData.chordGroup.classList.add("hit");
        }
        if (event.miss && !noteData.element.classList.contains("miss")) {
            noteData.element.classList.add("miss");
            if (noteData.chordGroup) noteData.chordGroup.classList.add("miss");
        }
        if (event.skipped && !noteData.element.classList.contains("skipped")) {
            noteData.element.classList.add("skipped");
            if (noteData.chordGroup) noteData.chordGroup.classList.add("skipped");
        }

        if (timeToHit < -1 || (state.isLooping && event.beat >= state.loopEndBeat)) {
            notesToRemove.push(noteId);
        }
    }

    for (const noteId of notesToRemove) {
        const noteData = state.visualNotes.get(noteId);
        if (noteData && noteData.element && noteData.element.parentNode) {
            noteData.element.remove();
            if (noteData.isChordMember && noteData.chordIndex === 0 && noteData.chordGroup && noteData.chordGroup.parentNode) {
                noteData.chordGroup.remove();
            }
        }
        state.visualNotes.delete(noteId);
        if (noteData && noteData.eventData) noteData.eventData.visualNote = null;
    }
}

export function updateScoreDisplay() {
    const sc = $("successCount");
    const fc = $("failCount");
    const skc = $("skippedCount");
    const acc = $("accuracy");

    if (sc) sc.textContent = state.successCount;
    if (fc) fc.textContent = state.failCount;
    if (skc) skc.textContent = state.skippedCount;

    const total = state.successCount + state.failCount + state.skippedCount;
    const accuracy = total === 0 ? 0 : Math.round((state.successCount / total) * 100);
    if (acc) acc.textContent = accuracy + "%";
}

export function showHitZoneFeedback(isHit, isSkipped = false) {
    const hitZone = $("fretboard").querySelector(".hit-zone");
    hitZone.classList.remove("hit-feedback", "miss-feedback", "skip-feedback");
    if (isHit) {
        hitZone.classList.add("hit-feedback");
    } else if (isSkipped) {
        hitZone.classList.add("skip-feedback");
    } else {
        hitZone.classList.add("miss-feedback");
    }
    setTimeout(() => {
        hitZone.classList.remove("hit-feedback", "miss-feedback", "skip-feedback");
    }, 300);
}

export function showFullScreenFeedback(isHit) {
    const overlay = $("feedbackOverlay");
    if (!overlay) return;
    overlay.classList.remove("hit", "miss");
    if (isHit) overlay.classList.add("hit");
    else overlay.classList.add("miss");
    setTimeout(() => {
        overlay.classList.remove("hit", "miss");
    }, 200);
}

export function addDebugEntry(entry) {
    const timestamp = new Date().toLocaleTimeString();
    const debugEntry = `[${timestamp}] ${entry}`;
    state.debugLog.push(debugEntry);
    updateDebugDisplay();
}

export function updateDebugDisplay() {
    const debugLogElement = $("debugLog");
    if (debugLogElement) {
        debugLogElement.innerHTML = state.debugLog.join('<br>') || '<div style="opacity: 0.6;">No debug entries yet...</div>';
        debugLogElement.scrollTop = debugLogElement.scrollHeight;
    }
}

export function clearDebugLog() {
    state.debugLog = [];
    updateDebugDisplay();
}

export function copyDebugToClipboard() {
    const debugText = state.debugLog.join('\n');
    navigator.clipboard.writeText(debugText).then(() => {
        const btn = $("copyDebug");
        const originalText = btn.textContent;
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = originalText; }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
}

export function renderNotes() {
    // Legacy function support
}

// --- NEW HISTORY FUNCTIONS ---

export function addPracticeHistoryEntry() {
    const timestamp = new Date().toLocaleString();
    const exerciseName = state.currentExercise ? state.currentExercise.name : "Unknown Exercise";

    const total = state.successCount + state.failCount + state.skippedCount;
    const accuracy = total === 0 ? 0 : Math.round((state.successCount / total) * 100);

    const historyEntry = {
        timestamp,
        exercise: exerciseName,
        bpm: state.bpm,
        hits: state.successCount,
        misses: state.failCount,
        skips: state.skippedCount,
        accuracy: accuracy,
        total: total
    };

    state.practiceHistory.push(historyEntry);
    updatePracticeHistoryDisplay();
}

export function updatePracticeHistoryDisplay() {
    const historyElement = $("practiceHistory");
    if (!historyElement) return;

    if (state.practiceHistory.length === 0) {
        historyElement.innerHTML = '<div style="opacity: 0.6; text-align: center; padding: 20px;">No practice sessions yet. Complete an exercise to see your history!</div>';
        return;
    }

    const historyHtml = state.practiceHistory.slice(-10).reverse().map(entry => {
        const accuracyColor = entry.accuracy >= 90 ? '#1a7f37' : entry.accuracy >= 70 ? '#ff9900' : '#b42318';
        return `
      <div style="border-bottom: 1px solid #ddd; padding: 8px 0; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: bold; margin-bottom: 2px;">${entry.exercise}</div>
          <div style="font-size: 11px; opacity: 0.7;">${entry.timestamp}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: bold; color: ${accuracyColor};">${entry.accuracy}%</div>
          <div style="font-size: 11px;">${entry.bpm} BPM | ${entry.hits}✓ ${entry.misses}✗ ${entry.skips}⊝</div>
        </div>
      </div>
    `;
    }).join('');

    historyElement.innerHTML = historyHtml;
    historyElement.scrollTop = 0;
}

export function clearPracticeHistory() {
    state.practiceHistory = [];
    updatePracticeHistoryDisplay();
}