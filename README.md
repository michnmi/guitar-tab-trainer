# 🎸 Guitar Tab Trainer - Yousician-Style Web App

A **web-based guitar practice app** with a visual fretboard interface inspired by Yousician.

Play along with animated guitar tablature that moves across your screen in real-time. The app listens through your microphone and provides instant feedback on your timing and pitch accuracy.

**Key Features:**
- 🎯 **Visual Timeline**: Notes move across a guitar fretboard from right to left
- 🎵 **Timing-Based Scoring**: Hit notes exactly when they reach the green line
- 🎸 **Multiple Exercises**: JSON-based exercise system with built-in songs
- 📊 **Detailed Scoring**: Track hits, misses, and skipped notes with accuracy percentage
- 🎤 **Live Audio Detection**: Real-time pitch detection with octave correction
- 🥁 **Built-in Metronome**: Helps maintain steady rhythm during practice

No plugins. No native apps. Just your browser and a microphone.

---

## ✨ Features

### 🎸 **Visual Guitar Interface**
- Large, animated fretboard with 6 strings (E-A-D-G-B-E)
- Rectangular notes showing fret numbers that move right-to-left
- Note width represents timing duration for better rhythm visualization
- Hit zone with real-time visual feedback (green/red/orange)

### 🎯 **Timing & Scoring System**
- **Timing-based matching**: Hit notes when left edge reaches green line
- **Three-category scoring**: Hits ✓, Misses ✗, Skipped ⊝
- **Smart detection**: Distinguishes wrong notes vs. no input
- **Real-time accuracy**: Live percentage calculation with score tracking

### 🎵 **Audio Engine**
- **YIN pitch detection**: Robust monophonic note detection
- **Octave correction**: Handles harmonic detection errors
- **Microphone input**: Web Audio API with noise filtering
- **Timing precision**: Fixed metronome drift issues

### 🎼 **Exercise System**
- **JSON-based exercises**: Easy to create and modify
- **Multiple built-in songs**: Basic strings, chromatic scales, House of the Rising Sun
- **Difficulty levels**: Beginner to intermediate exercises
- **BPM control**: Adaptive timing windows based on tempo

### 🐳 **Technical**
- Pure web technology (no plugins required)
- Dockerized deployment
- Responsive layout with focus on fretboard
- Real-time visual feedback system

---

## 🎮 How to Play

1. **Setup**:
   - Click "Enable Mic" and allow microphone access
   - Put on headphones (prevents metronome feedback)
   - Select an exercise from the dropdown
   - Adjust BPM as needed (slower = easier)

2. **Playing**:
   - Click "Start" to begin
   - Watch rectangular notes move from right to left across the fretboard
   - Play the correct fret when the left edge of each note reaches the green line
   - Note width shows how long to sustain each note

3. **Scoring**:
   - **✓ Hit**: Correct note played at the right time
   - **✗ Miss**: Wrong note played during timing window
   - **⊝ Skip**: No note played when timing window expired

## 🚧 Current Limitations

- **Monophonic only**: One note at a time (no chords)
- **Pitch-based detection**: Detects what you played, not which fret/string
- **Timing-based only**: Removed practice mode - all exercises require proper timing
- **Best with headphones**: Prevents metronome feedback into microphone

---

## 🧩 How it Works

### **Visual Timeline System**
1. Notes spawn from the rightmost edge of the fretboard
2. They move left at constant speed based on BPM
3. Hit timing = when left edge reaches the green line
4. Visual feedback triggers when right edge passes the line

### **Audio Detection Pipeline**
1. Browser captures audio via `getUserMedia`
2. Web Audio API analyzes audio in real-time
3. **YIN algorithm** detects fundamental frequency
4. **Octave correction** handles harmonic detection errors
5. Pitch is stabilized across multiple frames
6. **Timing window matching** finds notes within beat tolerance

### **Scoring Logic**
1. **Input tracking**: System monitors if any guitar input detected during note windows
2. **Three-way classification**:
   - Hit = correct pitch + timing
   - Miss = wrong pitch detected
   - Skip = no input detected
3. **Real-time feedback**: Visual effects trigger immediately

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

### **Creating Custom Exercises**
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
