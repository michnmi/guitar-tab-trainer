import { state } from './state.js';
import { CONSTANTS, $ } from './utils.js';
import { renderStaticTab } from './tab-renderer.js';
import { clearVisualNotes } from './visuals.js';

// --- SHARED STATE ---
// We move this to the top level so both 'loadAvailableExercises' and
// 'setupMusicXMLUpload' can access the same list of courses.
// Each course is: { id, name, readme, exercises: [exercise, ...] }
// A "course" is a group of exercises; built-in standalone exercises and
// uploaded MusicXML files live under the synthetic 'builtin' course.
let loadedCourses = [];

// --- BUILT-IN EXERCISE LOADING ---

// Subfolders of web/exercises/ that hold a course bundle (manifest.json +
// README.md + exercise JSON files). There's no build step or server-side
// directory listing, so — same as exerciseFiles below — new courses must be
// added here by hand.
const courseFolders = [
    'am_minor_guitar_course'
];

function getCourseById(id) {
    return loadedCourses.find(c => c.id === id);
}

function populateExerciseSelect(course) {
    const exerciseSelect = $("exercise");
    if (!exerciseSelect) return;
    exerciseSelect.innerHTML = "";
    course.exercises.forEach(ex => {
        const option = document.createElement("option");
        option.value = ex.fileName;
        option.textContent = ex.name;
        exerciseSelect.appendChild(option);
    });
}

export async function loadAvailableExercises() {
    const courseSelect = $("course");
    const exerciseSelect = $("exercise");
    if (!exerciseSelect) return;

    exerciseSelect.innerHTML = "<option>Loading...</option>";

    const exerciseFiles = [
        'basic-strings.json',
        'chromatic-scale.json',
        'simple-melody.json',
        'house-of-rising-sun.json',
        'warmup-alternate-picking-triplets-round1.json'
    ];

    // Reset list
    loadedCourses = [];

    // 1. Build the built-in "course": Metronome Only + the standalone exercise files
    const builtinCourse = { id: 'builtin', name: 'Built-in Exercises', readme: null, exercises: [] };

    builtinCourse.exercises.push({
        name: "Metronome Only",
        description: "Just metronome clicks, no tabs",
        bpm: 90,
        difficulty: "metronome",
        notes: [],
        fileName: "metronome-only"
    });

    for (const fileName of exerciseFiles) {
        try {
            const res = await fetch(`exercises/${fileName}?v=${Date.now()}`);
            if (res.ok) {
                const ex = await res.json();
                ex.fileName = fileName;
                builtinCourse.exercises.push(ex);
            }
        } catch (e) {
            console.warn(`Skipping ${fileName}:`, e);
        }
    }

    loadedCourses.push(builtinCourse);

    // 2. Load course bundles (manifest.json + README.md + exercise files)
    for (const folder of courseFolders) {
        try {
            const manifestRes = await fetch(`exercises/${folder}/manifest.json?v=${Date.now()}`);
            if (!manifestRes.ok) continue;
            const manifest = await manifestRes.json();

            let readme = null;
            try {
                const readmeRes = await fetch(`exercises/${folder}/README.md?v=${Date.now()}`);
                if (readmeRes.ok) readme = await readmeRes.text();
            } catch (e) {
                console.warn(`No README for course ${folder}:`, e);
            }

            const course = { id: folder, name: manifest.course || folder, readme, exercises: [] };

            for (const entry of manifest.exercises) {
                try {
                    const res = await fetch(`exercises/${folder}/${entry.filename}?v=${Date.now()}`);
                    if (res.ok) {
                        const ex = await res.json();
                        ex.fileName = `${folder}/${entry.filename}`;
                        course.exercises.push(ex);
                    }
                } catch (e) {
                    console.warn(`Skipping ${folder}/${entry.filename}:`, e);
                }
            }

            loadedCourses.push(course);
        } catch (e) {
            console.warn(`Skipping course ${folder}:`, e);
        }
    }

    // 3. Populate the course dropdown
    if (courseSelect) {
        courseSelect.innerHTML = "";
        loadedCourses.forEach(course => {
            const option = document.createElement("option");
            option.value = course.id;
            option.textContent = course.name;
            courseSelect.appendChild(option);
        });

        courseSelect.onchange = () => {
            const course = getCourseById(courseSelect.value);
            if (!course) return;
            populateExerciseSelect(course);
            updateCourseInfoPanel(course);
            if (course.exercises.length > 0) loadExercise(course.exercises[0]);
        };
    }

    // 4. Populate the exercise dropdown for the first course
    const firstCourse = loadedCourses[0];
    populateExerciseSelect(firstCourse);
    updateCourseInfoPanel(firstCourse);

    exerciseSelect.onchange = () => {
        const course = getCourseById(courseSelect ? courseSelect.value : firstCourse.id) || firstCourse;
        const selected = course.exercises.find(e => e.fileName === exerciseSelect.value);
        if (selected) loadExercise(selected);
    };

    // Load first exercise of the first course by default
    if (firstCourse.exercises.length > 0) {
        loadExercise(firstCourse.exercises[0]);
    }
}

// --- COURSE INFO PANEL (README.md) ---

function updateCourseInfoPanel(course) {
    const infoPanel = $("courseInfo");
    const infoContent = $("courseInfoContent");
    if (!infoPanel || !infoContent) return;

    if (!course.readme) {
        infoPanel.style.display = "none";
        infoContent.innerHTML = "";
        return;
    }

    infoPanel.style.display = "";
    infoPanel.open = false;
    infoContent.innerHTML = renderMarkdownLite(course.readme);
}

// Minimal Markdown -> HTML renderer for course README files: headers (#/##/###),
// bullet/numbered lists, bold, and inline code. No dependency, no build step —
// just enough for the course README format.
function renderMarkdownLite(md) {
    const lines = md.split('\n');
    let html = '';
    let inList = false;

    const closeList = () => {
        if (inList) {
            html += '</ul>';
            inList = false;
        }
    };

    for (let rawLine of lines) {
        const line = rawLine.trimEnd();

        const h3 = line.match(/^### (.*)/);
        const h2 = line.match(/^## (.*)/);
        const h1 = line.match(/^# (.*)/);
        if (h3) { closeList(); html += `<h4>${inlineMd(h3[1])}</h4>`; continue; }
        if (h2) { closeList(); html += `<h3>${inlineMd(h2[1])}</h3>`; continue; }
        if (h1) { closeList(); html += `<h2>${inlineMd(h1[1])}</h2>`; continue; }

        const listItem = line.match(/^(?:-|\d+\.)\s+(.*)/);
        if (listItem) {
            if (!inList) { html += '<ul>'; inList = true; }
            html += `<li>${inlineMd(listItem[1])}</li>`;
            continue;
        }

        closeList();
        if (line.trim() === '') continue;
        html += `<p>${inlineMd(line)}</p>`;
    }
    closeList();
    return html;
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineMd(text) {
    let t = escapeHtml(text);
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/`(.+?)`/g, '<code>$1</code>');
    return t;
}

// --- CORE LOAD FUNCTION ---

export function loadExercise(exercise) {
    // 1. Stop the loop and cancel animation
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

    // Update State
    state.currentExercise = exercise;
    // Deep copy notes to ensure we don't mutate the original definition
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

    const timeSigBeats = exercise.timeSigBeats || 4;
    const timeSigUnit = exercise.timeSigUnit || 4;
    state.beatsPerBar = (timeSigBeats * 4) / timeSigUnit;

    // Update UI Elements
    if ($("bpm")) $("bpm").value = state.bpm;
    if ($("bpmNum")) $("bpmNum").value = state.bpm;
    if ($("bpmDisplay")) $("bpmDisplay").textContent = state.bpm;
    if ($("timeSigBeats")) $("timeSigBeats").value = timeSigBeats;
    if ($("timeSigUnit")) $("timeSigUnit").value = timeSigUnit;

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
                // 1. Give it a unique ID so the dropdown can distinguish it
                const uniqueId = "uploaded-" + Date.now();
                exercise.fileName = uniqueId;

                // 2. Uploads live under the built-in course, alongside the
                // standalone exercise files.
                const builtinCourse = loadedCourses.find(c => c.id === 'builtin');
                builtinCourse.exercises.unshift(exercise);

                // 3. Switch the course dropdown to "Built-in" and rebuild the
                // exercise dropdown so the new upload shows up.
                const courseSelect = $("course");
                if (courseSelect) courseSelect.value = 'builtin';
                populateExerciseSelect(builtinCourse);
                updateCourseInfoPanel(builtinCourse);

                // 4. Give it a distinct label and select it, then load it.
                const exerciseSelect = $("exercise");
                const opt = Array.from(exerciseSelect.options).find(o => o.value === uniqueId);
                if (opt) opt.text = `[Upload] ${exercise.name}`;
                exerciseSelect.value = uniqueId;

                loadExercise(exercise);
                showUploadStatus(`Loaded: ${exercise.name} (detected ${exercise.timeSigBeats}/${exercise.timeSigUnit} time)`, "success");
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
        let transposeSemitones = 0;
        let timeSigBeats = 4;
        let timeSigUnit = 4;
        // <divisions> = how many <duration> units make up one quarter note. This is the
        // authoritative way to convert a note's <duration> into beats — unlike the <type>
        // element (quarter/eighth/16th/...), it already accounts for dotted notes and
        // tuplets (e.g. a triplet 16th's <duration> is scaled by its 3:2 ratio), so we
        // don't need to special-case those separately.
        let divisions = 1;
        const typeDurationFallback = { whole: 4, half: 2, quarter: 1, eighth: 0.5, '16th': 0.25, '32nd': 0.125, '64th': 0.0625 };

        const measures = xmlDoc.querySelectorAll("measure");

        measures.forEach(measure => {
            // Guitar parts are commonly notated an octave above sounding pitch;
            // <transpose> tells us the semitone offset to get the real (sounding) pitch.
            const transpose = measure.querySelector("transpose");
            if (transpose) {
                const chromatic = parseInt(transpose.querySelector("chromatic")?.textContent || "0");
                const octaveChange = parseInt(transpose.querySelector("octave-change")?.textContent || "0");
                transposeSemitones = chromatic + octaveChange * 12;
            }

            const time = measure.querySelector("time");
            if (time) {
                timeSigBeats = parseInt(time.querySelector("beats")?.textContent || "4");
                timeSigUnit = parseInt(time.querySelector("beat-type")?.textContent || "4");
            }

            const divisionsEl = measure.querySelector("divisions");
            if (divisionsEl) divisions = parseInt(divisionsEl.textContent) || divisions;

            const measureNotes = measure.querySelectorAll("note");

            measureNotes.forEach(note => {
                const isChord = note.querySelector("chord");
                const isRest = note.querySelector("rest");

                const durationEl = note.querySelector("duration");
                let duration;
                if (durationEl) {
                    duration = parseInt(durationEl.textContent) / divisions;
                } else {
                    // Grace notes and similar have no <duration>; fall back to <type>.
                    const type = note.querySelector("type")?.textContent;
                    duration = typeDurationFallback[type] ?? 1.0;
                }

                if (isRest) {
                    // Merge consecutive <rest> elements into a single rest span — MusicXML
                    // often splits one silence into several rests for beaming/typesetting
                    // reasons, but a practice event per fragment would be over-fragmented.
                    const prev = notes[notes.length - 1];
                    if (prev && prev.type === 'rest' && Math.abs(prev.beat + prev.duration - currentBeat) < 1e-6) {
                        prev.duration += duration;
                    } else {
                        notes.push({ type: 'rest', beat: currentBeat, duration });
                    }
                    currentBeat += duration;
                    return;
                }

                const pitch = note.querySelector("pitch");
                if (!pitch) return;

                const step = pitch.querySelector("step")?.textContent;
                const octave = parseInt(pitch.querySelector("octave")?.textContent || 4);
                const alter = parseInt(pitch.querySelector("alter")?.textContent || 0);

                const noteMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
                const midi = 12 * (octave + 1) + noteMap[step] + alter + transposeSemitones;

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

                // A <tie type="stop"> means this note is the sustained continuation of
                // the previous one (same pitch, no re-attack) — unlike a <slur>, it's
                // not a separate pluck. Don't create a second practice event for it;
                // just let time pass, so the tied-from note's effective duration (via
                // the gap to whatever event comes next) covers the full held length.
                const isTieStop = Array.from(note.querySelectorAll("tie")).some(t => t.getAttribute("type") === "stop");
                const prevIsPlainNote = notes.length > 0 && !notes[notes.length - 1].type;

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
                } else if (isTieStop && prevIsPlainNote) {
                    currentBeat += duration;
                } else {
                    notes.push(noteObj);
                    currentBeat += duration;
                }
            });
        });

        console.log(`MusicXML parse: ${measures.length} measures, time signature ${timeSigBeats}/${timeSigUnit}, transpose ${transposeSemitones} semitones, bpm ${bpm}`);

        return {
            name: title,
            bpm: bpm,
            notes: notes,
            difficulty: "custom",
            timeSigBeats: timeSigBeats,
            timeSigUnit: timeSigUnit
        };
    }
}
