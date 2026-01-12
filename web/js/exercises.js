import { state } from './state.js';
import { CONSTANTS, $ } from './utils.js';
import { renderStaticTab } from './tab-renderer.js';
import { clearVisualNotes } from './visuals.js'; // <--- NEW IMPORT

// --- BUILT-IN EXERCISE LOADING ---

export async function loadAvailableExercises() {
    const select = $("exercise");
    if (!select) return;

    select.innerHTML = "<option>Loading...</option>";

    const exerciseFiles = [
        'basic-strings.json',
        'chromatic-scale.json',
        'simple-melody.json',
        'house-of-rising-sun.json'
    ];

    const loadedExercises = [];

    // 1. Add Metronome Only
    loadedExercises.push({
        name: "Metronome Only",
        description: "Just metronome clicks, no tabs",
        bpm: 90,
        difficulty: "metronome",
        notes: [],
        fileName: "metronome-only"
    });

    // 2. Fetch JSON files
    for (const fileName of exerciseFiles) {
        try {
            const res = await fetch(`exercises/${fileName}?v=${Date.now()}`);
            if (res.ok) {
                const ex = await res.json();
                ex.fileName = fileName;
                loadedExercises.push(ex);
            }
        } catch (e) {
            console.warn(`Skipping ${fileName}:`, e);
        }
    }

    // 3. Populate Dropdown
    select.innerHTML = "";
    loadedExercises.forEach(ex => {
        const option = document.createElement("option");
        option.value = ex.fileName;
        option.textContent = ex.name;
        select.appendChild(option);
    });

    // 4. Handle Selection
    select.onchange = () => {
        const selected = loadedExercises.find(e => e.fileName === select.value);
        if (selected) loadExercise(selected);
    };

    // Load first one by default
    if (loadedExercises.length > 0) {
        loadExercise(loadedExercises[0]);
    }
}

// --- CORE LOAD FUNCTION ---

export function loadExercise(exercise) {
    // --- NEW: FORCE RESET WHEN SWITCHING EXERCISES ---
    // 1. Stop the loop
    state.practicing = false;
    if (state.rafId) {
        cancelAnimationFrame(state.rafId);
        state.rafId = null;
    }

    // 2. Reset Start/Stop Buttons
    const btnStart = $("btnStart");
    const btnStop = $("btnStop");
    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;

    // 3. Clear visuals from previous run
    clearVisualNotes();

    // 4. Reset Status text
    const status = $("status");
    if (status) status.textContent = "Ready.";
    // -------------------------------------------------

    // Update State
    state.currentExercise = exercise;
    state.events = exercise.notes.map(n => ({
        ...n,
        hit: false,
        miss: false,
        skipped: false,
        judged: false,
        visualNote: null
    }));

    state.nextIdx = 0;
    state.successCount = 0;
    state.failCount = 0;
    state.skippedCount = 0;
    state.exerciseCompleted = false;
    state.exerciseEndBeat = 0;
    state.autoStopScheduled = false;

    if (exercise.bpm) state.bpm = exercise.bpm;

    // Update UI Elements
    if ($("bpm")) $("bpm").value = state.bpm;
    if ($("bpmNum")) $("bpmNum").value = state.bpm;
    if ($("bpmDisplay")) $("bpmDisplay").textContent = state.bpm;

    // Reset loop state
    state.isLooping = false;
    state.loopStartBeat = 0;
    state.loopEndBeat = 0;
    if ($("loopMode")) $("loopMode").checked = false;

    console.log(`Loaded exercise: ${exercise.name} with ${state.events.length} events.`);

    // Render Tabs
    renderStaticTab(exercise);
}

// --- MUSICXML UPLOAD LOGIC ---

export function setupMusicXMLUpload() {
    const uploadSection = $("uploadSection");
    const fileInput = $("musicxmlFile");
    const uploadStatus = $("uploadStatus");

    if (!fileInput) return;

    fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

    uploadSection.addEventListener("dragover", (e) => {
        e.preventDefault();
        uploadSection.classList.add("dragover");
    });
    uploadSection.addEventListener("dragleave", (e) => {
        e.preventDefault();
        uploadSection.classList.remove("dragover");
    });
    uploadSection.addEventListener("drop", (e) => {
        e.preventDefault();
        uploadSection.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });

    function showUploadStatus(msg, type) {
        if (uploadStatus) {
            uploadStatus.textContent = msg;
            uploadStatus.className = `upload-status ${type}`;
        }
    }

    function handleFile(file) {
        if (!file) return;
        const ext = file.name.toLowerCase().split('.').pop();

        if (!['mxl', 'xml', 'musicxml'].includes(ext)) {
            showUploadStatus("Invalid file type. Use .mxl, .xml, or .musicxml", "error");
            return;
        }

        showUploadStatus("Reading file...", "");

        if (ext === 'mxl') {
            const reader = new FileReader();
            reader.onload = (e) => extractMXLFile(e.target.result, file.name);
            reader.readAsArrayBuffer(file);
        } else {
            const reader = new FileReader();
            reader.onload = (e) => processMusicXMLFile(e.target.result, file.name);
            reader.readAsText(file);
        }
    }

    function extractMXLFile(buffer, fileName) {
        if (!window.JSZip) {
            showUploadStatus("JSZip library not loaded.", "error");
            return;
        }

        window.JSZip.loadAsync(buffer).then(zip => {
            const scoreFile = Object.values(zip.files).find(f => f.name.endsWith('.xml') && !f.name.startsWith('META-INF'));
            if (scoreFile) {
                scoreFile.async("text").then(xml => processMusicXMLFile(xml, fileName));
            } else {
                showUploadStatus("No XML score found in .mxl file.", "error");
            }
        }).catch(e => {
            console.error(e);
            showUploadStatus("Failed to unzip file.", "error");
        });
    }

    function processMusicXMLFile(xmlContent, fileName) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
            const exercise = convertMusicXMLToExercise(xmlDoc, fileName);

            if (exercise) {
                loadExercise(exercise);
                showUploadStatus(`Loaded: ${exercise.name}`, "success");

                const select = $("exercise");
                const opt = document.createElement("option");
                opt.text = `[Upload] ${exercise.name}`;
                opt.value = "UPLOADED";
                select.add(opt, 0);
                select.value = "UPLOADED";
            }
        } catch (e) {
            console.error(e);
            showUploadStatus("Error parsing MusicXML.", "error");
        }
    }

    function convertMusicXMLToExercise(xmlDoc, fileName) {
        // --- IMPROVED TITLE PARSING ---
        let title = fileName;

        // 1. Check <work-title>
        const workTitle = xmlDoc.querySelector("work-title")?.textContent;
        if (workTitle) title = workTitle;

        // 2. Check <movement-title>
        const movTitle = xmlDoc.querySelector("movement-title")?.textContent;
        if (movTitle) title = movTitle;

        // 3. Check <credit> with type="title"
        const credits = xmlDoc.querySelectorAll("credit");
        credits.forEach(c => {
            const type = c.querySelector("credit-type")?.textContent || c.getAttribute("type");
            if (type === "title") {
                const words = c.querySelector("credit-words")?.textContent;
                if (words) title = words;
            }
        });

        // Get BPM
        let bpm = 120;
        const tempo = xmlDoc.querySelector("per-minute")?.textContent;
        if (tempo) bpm = parseInt(tempo);

        const notes = [];
        let currentBeat = 0;

        const measures = xmlDoc.querySelectorAll("measure");

        measures.forEach(measure => {
            const measureNotes = measure.querySelectorAll("note");

            measureNotes.forEach(note => {
                const isChord = note.querySelector("chord");
                const isRest = note.querySelector("rest");

                let duration = 1.0;
                const type = note.querySelector("type")?.textContent;
                if (type === 'whole') duration = 4;
                else if (type === 'half') duration = 2;
                else if (type === 'quarter') duration = 1;
                else if (type === 'eighth') duration = 0.5;
                else if (type === '16th') duration = 0.25;

                if (isRest) {
                    currentBeat += duration;
                    return;
                }

                const pitch = note.querySelector("pitch");
                if (!pitch) return;

                const step = pitch.querySelector("step")?.textContent;
                const octave = parseInt(pitch.querySelector("octave")?.textContent || 4);
                const alter = parseInt(pitch.querySelector("alter")?.textContent || 0);

                const noteMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
                const midi = 12 * (octave + 1) + noteMap[step] + alter;

                let string, fret;
                const tech = note.querySelector("technical");
                if (tech) {
                    string = parseInt(tech.querySelector("string")?.textContent);
                    fret = parseInt(tech.querySelector("fret")?.textContent);
                }

                const noteObj = {
                    beat: currentBeat,
                    midi: midi,
                    string: string ? string : undefined,
                    fret: fret !== undefined ? fret : undefined
                };

                if (isChord && notes.length > 0) {
                    const prev = notes[notes.length - 1];
                    if (prev.type === 'chord') {
                        prev.notes.push(noteObj);
                    } else {
                        notes[notes.length - 1] = {
                            type: 'chord',
                            beat: prev.beat,
                            notes: [prev, noteObj]
                        };
                    }
                } else {
                    notes.push(noteObj);
                    currentBeat += duration;
                }
            });
        });

        return {
            name: title,
            bpm: bpm,
            notes: notes,
            difficulty: "custom"
        };
    }
}
