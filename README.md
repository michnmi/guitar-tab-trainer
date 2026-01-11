# 🎸 Guitar Tab Trainer - Yousician-Style Web App

A **web-based guitar practice app** with a visual fretboard interface inspired by Yousician.

Play along with animated guitar tablature that moves across your screen in real-time. The app listens through your microphone and provides instant feedback on your timing and pitch accuracy.

**Key Features:**
- 🎯 **Visual Timeline**: Notes move across a guitar fretboard from right to left
- 🔄 **Practice Mode**: Loop specific measures with optional "breathing room" between loops
- 🎼 **Interactive Tabs**: Clickable tablature view to select practice ranges
- 🎵 **Timing-Based Scoring**: Hit notes exactly when they reach the green line
- 📊 **Practice History**: Track your session stats, accuracy, and improvements over time
- 🎤 **Live Audio Detection**: Real-time pitch detection with octave correction
- 🛠 **Advanced Calibration**: Auto-calibration and manual hardware setup for optimal detection
- 📁 **MusicXML Import**: Upload your own .mxl/.xml/.musicxml files for instant practice

No plugins. No native apps. Just your browser and a microphone.

---

## ✨ Features

### 🎸 **Visual Guitar Interface**
- Large, animated fretboard with 6 strings (E-A-D-G-B-E)
- **Interactive Static Tab**: View the full song tablature and click measures to set loop points
- Note width represents timing duration for better rhythm visualization
- **Chord visualization**: Multiple notes grouped with dotted borders for chord recognition

### 🛠 **Practice Tools**
- **Loop Mode**: Select specific bars in the tab view to practice difficult sections repeatedly
- **Breathing Room (+4 Beat Wait)**: Optional toggle to pause and count-in (4 beats) between loop iterations, giving you time to reset your hands
- **Practice History**: Logs every attempt with accuracy %, hits, misses, and skips
- **Debug Console**: View real-time audio detection logs to diagnose microphone issues

### 🎵 **Advanced Audio Engine**
- **Hybrid Detection System**: Automatic switching between YIN (single notes) and FFT (chords)
- **Smart algorithm selection**: Detects single notes vs chords and uses optimal detection method
- **Hardware Calibration**: Guided wizard to calibrate for your specific guitar and microphone volume
- **Adaptive Thresholds**: System learns your background noise floor to prevent false triggers

### 🎼 **Exercise System**
- **MusicXML Support**: Drag & drop support for .mxl, .xml, and .musicxml files (MuseScore, Guitar Pro, etc.)
- **Built-in Songs**: Includes Basic Strings, Chromatic Scales, and House of the Rising Sun
- **BPM Control**: Adjust speed from 40 to 200 BPM

---

## 🎮 How to Play

1. **Setup**:
   - Click "Enable Mic" and allow microphone access.
   - **Calibrate**: Use the "Calibrate Hardware" button for the best experience.
   - Select an exercise or drag-and-drop a MusicXML file.

2. **Practice Controls**:
   - **Looping**: Click a measure in the "Practice Selector" tab view to select it. Click another measure to define a range. Check "Loop Selected Bars" to enable.
   - **+4 Beat Wait**: Enable this toggle to add a 4-beat count-in before every loop restart. This helps you reset and prepare for the next attempt.
   - **BPM**: Slow down the tempo using the slider to learn difficult parts.

3. **Playing**:
   - Click "Start".
   - Play the correct fret when the note reaches the green line.
   - **Chord Support**: For chord groups (dotted borders), play all notes simultaneously.

4. **Scoring**:
   - **✓ Hit**: Correct note/chord played at the right time.
   - **✗ Miss**: Wrong note played.
   - **⊝ Skip**: No note played.
   - check the "Practice History" panel to see your progress.

---

## 🧩 Technical Architecture

The project has been refactored into a modular ES6 architecture for maintainability:

- **`main.js`**: Core application loop and event orchestration
- **`audio-engine.js`**: YIN and FFT pitch detection algorithms
- **`visuals.js`**: Rendering of the animated fretboard and feedback effects
- **`tab-renderer.js`**: Drawing the static, interactive tablature view
- **`state.js`**: Centralized state management
- **`exercises.js`**: JSON and MusicXML parsing/loading logic
- **`calibration.js`**: Hardware calibration wizards and adaptive threshold logic

---

## 🐳 Build & Run (Docker – recommended)

### Requirements

- Docker (recent version)
- A browser with microphone access (Chrome, Firefox, Safari)

### Build the image

```bash
docker build -t guitar-tab-trainer .
```

### Run the container 

```bash
docker run --rm -p 8080:8080 guitar-tab-trainer
```

### Open the app

[http://localhost:8080](http://localhost:8080)

---

## 🎼 Exercise System

### **Built-in Exercises**
- **Basic Strings**: Learn open string names (E-A-D-G-B-E)
- **Chromatic Scale**: Half-step progression practice
- **Simple Melody**: Frets 0-3 melodic patterns
- **House of the Rising Sun**: Classic fingerpicking exercise

### **Import Your Own Music**
Upload MusicXML files from your favorite notation software:
- **MuseScore**: Export as .mxl (compressed MusicXML)
- **Sibelius**: Export as MusicXML
- **Finale**: Export as MusicXML
- **Guitar Pro**: Export as MusicXML (if supported)
- **Online sources**: Many sheet music sites provide MusicXML downloads

### **Creating Custom Exercises**

**Option 1: Upload MusicXML (Recommended)**
- Export from any notation software as .mxl, .xml, or .musicxml
- Drag and drop onto the upload area
- Automatic conversion with smart title extraction

**Option 2: Manual JSON Creation**
Create JSON files in `/web/exercises/` directory:

```json
{
  "name": "My Exercise",
  "description": "Custom practice routine",
  "bpm": 100,
  "difficulty": "beginner",
  "notes": [
    { "beat": 0, "midi": 40 },
    { "beat": 1, "midi": 45 }
  ]
}
```

**String + Fret Notation**:
- Use format: `StringName + FretNumber`
- Examples: `E0` (open low E), `A2` (A string 2nd fret), `e0` (open high E)

## 🎯 Practice Tips

- **Use headphones**: Prevents metronome feedback into microphone
- **Start slow**: Lower BPM until you can hit notes consistently
- **Clean picking**: Pluck one string at a time, let notes ring
- **Open strings first**: A and D strings are easier to detect than low E
- **Quiet environment**: Avoid background noise near microphone
- **Watch the rectangles**: Width shows note duration, practice sustaining

---

## 📚 Resources & References

### **Technical Documentation**
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)**: Real-time audio processing and analysis
- **[getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)**: Microphone access for browser applications
- **[YIN Algorithm](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C8/C8S2_F0-Estimation.html)**: Fundamental frequency detection for pitch analysis
- **[MIDI Note Numbers](https://www.inspiredacoustics.com/en/MIDI_note_numbers_and_center_frequencies)**: Standard for musical note representation

### **Guitar Fretboard MIDI Reference**

Guitar tuning: **E-A-D-G-B-E** (low to high)

| **Fret** | **E (6th)** | **A (5th)** | **D (4th)** | **G (3rd)** | **B (2nd)** | **E (1st)** |
|----------|-------------|-------------|-------------|-------------|-------------|-------------|
| **0**    | 40 (E2)     | 45 (A2)     | 50 (D3)     | 55 (G3)     | 59 (B3)     | 64 (E4)     |
| **1**    | 41 (F2)     | 46 (A#2)    | 51 (D#3)    | 56 (G#3)    | 60 (C4)     | 65 (F4)     |
| **2**    | 42 (F#2)    | 47 (B2)     | 52 (E3)     | 57 (A3)     | 61 (C#4)    | 66 (F#4)    |
| **3**    | 43 (G2)     | 48 (C3)     | 53 (F3)     | 58 (A#3)    | 62 (D4)     | 67 (G4)     |
| **4**    | 44 (G#2)    | 49 (C#3)    | 54 (F#3)    | 59 (B3)     | 63 (D#4)    | 68 (G#4)    |
| **5**    | 45 (A2)     | 50 (D3)     | 55 (G3)     | 60 (C4)     | 64 (E4)     | 69 (A4)     |
| **6**    | 46 (A#2)    | 51 (D#3)    | 56 (G#3)    | 61 (C#4)    | 65 (F4)     | 70 (A#4)    |
| **7**    | 47 (B2)     | 52 (E3)     | 57 (A3)     | 62 (D4)     | 66 (F#4)    | 71 (B4)     |
| **8**    | 48 (C3)     | 53 (F3)     | 58 (A#3)    | 63 (D#4)    | 67 (G4)     | 72 (C5)     |
| **9**    | 49 (C#3)    | 54 (F#3)    | 59 (B3)     | 64 (E4)     | 68 (G#4)    | 73 (C#5)    |
| **10**   | 50 (D3)     | 55 (G3)     | 60 (C4)     | 65 (F4)     | 69 (A4)     | 74 (D5)     |
| **11**   | 51 (D#3)    | 56 (G#3)    | 61 (C#4)    | 66 (F#4)    | 70 (A#4)    | 75 (D#5)    |
| **12**   | 52 (E3)     | 57 (A3)     | 62 (D4)     | 67 (G4)     | 71 (B4)     | 76 (E5)     |

**Usage Example**:
```json
{
  "name": "Open Strings",
  "notes": [
    { "beat": 0, "midi": 40 },  // Low E string (6th string, fret 0)
    { "beat": 1, "midi": 45 },  // A string (5th string, fret 0)
    { "beat": 2, "midi": 50 },  // D string (4th string, fret 0)
    { "beat": 3, "midi": 64 }   // High E string (1st string, fret 0)
  ]
}
```

---

## 🤖 AI Development Assistant

This project was developed with significant assistance from **Claude (Anthropic)** via Claude Code.

---

*Guitar Tab Trainer - Learn guitar with visual timing and real-time feedback* 🎸
