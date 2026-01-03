# Guitar Tab Trainer - Development Notes

## Current State
- Working MVP with hardcoded E-A-D-G-B-E note sequence
- YIN pitch detection algorithm for monophonic guitar input
- Two modes: Practice (timing-forgiving) and Rhythm (strict timing)
- Basic note display showing all notes at once
- Go backend serving static files from `/web/` directory

## Identified Fixes (Not Yet Implemented)
1. **YIN Algorithm Division by Zero** (`web/index.html:212`)
2. **Array Bounds Safety** in pitch detection loops
3. **Multiple Mic Initialization Prevention**
4. **Timing Precision Issues** with metronome drift
5. **getUserMedia Error Handling** improvements
6. **State Cleanup** on stop button

## Next Major Feature: Yousician-Style Visual Tab Display

### Current Display Problem
- All notes shown simultaneously as static list
- No visual guitar fretboard representation
- No progressive note revelation or timing animation

### Desired Yousician-Style Display
```
E |----3-------|  (high E string, 3rd fret approaching hit zone)
B |------------|
G |------------|
D |----2-------|  (D string, 2nd fret approaching)
A |------------|
E |------------|  (low E string)
    ^
  hit zone
```

### Implementation Plan
1. **Guitar Fretboard Layout**
   - 6 horizontal strings (E-A-D-G-B-E bottom to top)
   - Hit zone on left where notes should be played
   - Timeline flows right-to-left toward hit zone

2. **MIDI to Fret Conversion System**
   ```javascript
   const TUNING = [40, 45, 50, 55, 59, 64]; // MIDI values for standard tuning
   function midiToFret(midi) {
     // Convert MIDI note to string/fret combination
     // Prefer lower frets, avoid open strings for clarity
   }
   ```

3. **Timeline Animation System**
   - Notes spawn at `beatNow + LOOKAHEAD_BEATS`
   - Animate position based on remaining time to target beat
   - Remove notes after they pass hit zone

4. **Visual Components**
   - String lines (horizontal)
   - Hit zone (vertical target area on left)
   - Fret numbers (animated elements moving along strings)
   - Timing feedback (visual hit/miss indicators)

5. **Key Parameters**
   - `LOOKAHEAD_BEATS = 4` (notes appear 4 beats early)
   - `HIT_ZONE_WIDTH = 60px`
   - `STRING_HEIGHT = 40px`
   - `NOTE_TRAVEL_DISTANCE = 400px`

### Technical Implementation
- Replace current `.notes` container with guitar fretboard (SVG/Canvas/CSS)
- Add note spawning system based on `currentBeat + lookahead`
- Create smooth animations for right-to-left note movement
- Update hit detection to work with visual timing
- Add string/fret highlighting for successful hits
- Maintain existing audio logic and pitch detection

## Future Considerations (Discussed but Deferred)
- **Different Tab Loading**: JSON files, Go API endpoints, or URL parameters
- **Multiple tab files** in `/web/tabs/` directory
- **User-customizable exercises**

## Code Structure
- `main.go`: Go HTTP server serving static files
- `web/index.html`: Single-page app with embedded CSS/JS
- Audio pipeline: Microphone → Web Audio API → YIN → MIDI → Note matching
- Current song definition: `web/index.html:130-137` (hardcoded array)