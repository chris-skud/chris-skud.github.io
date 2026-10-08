# Guitar Practice Coach — Project Spec

A handoff document for building a web app. This is a personal practice tool for an intermediate guitarist (indie folk rock, also a singer) who wants to improve **fretboard knowledge** and **dexterity** through deliberate practice, weighted toward **songwriting and comping** rather than lead/shred.

---

## 1. Guiding principle

The difference between *practice* and *noodling* is a tempo target and a feedback loop. Every feature should serve one of three jobs:

1. Tell the user exactly what to do right now.
2. Give them a metronome and a number to beat.
3. Remember that number so they can watch it climb over weeks.

If a feature doesn't support one of those, it's out of scope for the MVP.

This is a **single-page web app, no backend required** for the first three phases. It should work well on a phone or propped-up tablet while the user is actually holding a guitar, and be installable to a home screen (PWA-friendly).

---

## 2. The practice methodology the app encodes

The app is not a generic trainer — it runs *this specific* session structure. Build the content in, don't make the user design it.

### Daily session shape (~35 min, four timed blocks)

1. **Warm-up (5 min):** chromatic "spider" with shuffled finger orders (e.g. 1-4-2-3, 2-1-4-3 — never plain 1-2-3-4), one note per metronome click, plus ~30s of an "Em-hold-and-lift" finger-independence drill. Emphasis on clean over fast; ease the pinky in to avoid strain.
2. **Dexterity (8 min):** the day's technique.
3. **Fretboard (12 min):** the day's knowledge target.
4. **Application (10 min):** immediately use what was just drilled in a real musical context — write or comp something over a loop/progression. This is the most important block for this user; it's where theory becomes a song.

### Four day-types (auto-rotating; user can also pick a "rest / play-for-fun" day)

- **Day A — Triads & voicings.** Major/minor triads on the top-three and middle string sets, moving up the neck through inversions. Dexterity: clean independence so unfretted strings stay quiet. Application: replace open chords in a known song with higher triad voicings.
- **Day B — Fretboard mapping.** Note-finding on low E and A strings first, then octave shapes outward, then intervals (seeing *and* singing intervals — ties ear to hands). Dexterity: string skipping. Application: find a song's root in three neck positions.
- **Day C — CAGED & connections.** One chord through all five CAGED shapes up the neck; then a full progression comped in low vs. high registers. Dexterity: clean barre-to-barre transitions in time. Application: verse low / chorus high for dynamics without changing chords.
- **Day D — Groove & transitions.** Metronome accenting beats 2 and 4; clean chord changes; add a fingerpicking / hybrid-picking pattern. Application: write a part where the picking pattern *is* the hook.

### Metronome discipline (applies to every drill)

Find the fastest tempo that is *perfectly clean*, drop ~15 bpm, live there for the session, log the number, and only nudge up when clean feels effortless. **Speed is a byproduct of accuracy, not a separate goal.**

---

## 3. Feature spec

### Core — the guided session runner (the whole product in miniature)

- Home screen picks today's day-type (A/B/C/D auto-rotating, plus a rest-day option).
- Runs the four blocks as a guided flow with a per-block countdown timer.
- Each block shows: the specific drill for that day, a short instruction, and the tools it needs (metronome, fretboard, etc.).
- At the end, prompts the user to log the tempos/scores they hit.

### The four supporting pillars

1. **Metronome** — built in (not a separate app). Adjustable BPM, accent patterns including beats 2 & 4, a visual pulse, and a "log this tempo" button that feeds straight into the progress record. Use the **Web Audio API** for tight timing (do not rely on `setInterval` alone for the click — schedule audio events ahead).
2. **Interactive fretboard** — drawn as **SVG** so it stays crisp and tappable. Displays notes, intervals, triad shapes, and the five CAGED shapes. Tapping a fret plays the pitch (Web Audio). Also powers a **note-finding quiz**: calls a random note ("find every G on low E and A"), runs a timer, user taps answers, score is logged.
3. **Interval ear-training** — plays an interval (or a reference note to sing back), user identifies it, app shows where that interval sits on the neck. The guitarist-plus-singer crossover; high value for this user.
4. **Progress log** — saves every tempo and quiz score, charts them over time, and tracks a simple consistency streak. The climbing line is what keeps practice deliberate.

### Later additions (post-MVP)

- Loop / backing-track player for the application block.
- Record-and-playback button to check whether a voicing was actually clean.
- Contextual resource links embedded next to the drill they teach (see §7).

---

## 4. Tech stack & architecture

- **Front end:** React (single-page app).
- **Fretboard rendering:** SVG (tappable, scalable).
- **Audio (metronome click + note playback):** Web Audio API with look-ahead scheduling.
- **Persistence:** browser-side storage (e.g. `localStorage` / IndexedDB) so tempo history and streaks survive across sessions — no account or server needed for the MVP. Keep the storage layer behind a small module so it can later be swapped for a real backend without touching UI code.
- **Deploy target:** static host (GitHub Pages / Vercel / Netlify). Make it a PWA so it can be added to a phone home screen.
- **No backend** for Phases 1–3.

---

## 5. Suggested data model (persisted locally)

```
PracticeSession {
  id: string
  date: ISO string
  dayType: "A" | "B" | "C" | "D" | "rest"
  blocks: {
    warmup:      { completed: bool, notes?: string }
    dexterity:   { drill: string, tempoBpm?: number, completed: bool }
    fretboard:   { drill: string, quizScore?: number, completed: bool }
    application: { completed: bool, notes?: string }
  }
}

TempoLog      { drillId: string, date: ISO string, bpm: number }
QuizResult    { quizId: string, date: ISO string, correct: number, total: number, seconds: number }
Streak        { current: number, longest: number, lastPracticedDate: ISO string }
```

Keep day-type definitions and drill content in a single config/data file so drills can be edited without touching component logic.

---

## 6. Build order (ship usable increments)

- **Phase 1 — usable on day one:** session runner + working metronome + day-type rotation.
- **Phase 2:** interactive SVG fretboard + note-finding quiz.
- **Phase 3:** progress log + charts + streak.
- **Phase 4:** interval ear-training, record/playback, embedded resources.

---

## 7. Resources to embed (Phase 4)

- **Signals Music Studio (Jake Lizzio)** — best fit given the songwriting angle; theory taught through the fretboard. His triad, CAGED, and interval videos map onto Days A–C.
- **JustinGuitar** — structured intermediate theory; his fretboard-trainer is a good reference for the Day B note drills.
- **Absolutely Understand Guitar (Scotty West)** — deep, systematic theory series for going further.
- **Lauren Bateman** — clear finger-independence videos for the dexterity block.

Embed/link these contextually, next to the drill they support — not in a separate "resources" dump.

---

## 8. Non-goals / notes

- Not a generic guitar trainer or tab library; it runs this specific methodology.
- Lead/shred speed vocabulary is deprioritized — favor voicings, harmony, and clean comping.
- Don't gate the core session behind accounts, logins, or a backend.
- Injury caution: warm-up emphasizes clean-and-slow and easing in the pinky; surface that reminder in the warm-up block.
