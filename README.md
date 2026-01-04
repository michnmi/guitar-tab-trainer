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

## 🤖 AI Development Assistant

This project was developed with significant assistance from **Claude (Anthropic)** via Claude Code.

---

*Guitar Tab Trainer - Learn guitar with visual timing and real-time feedback* 🎸
