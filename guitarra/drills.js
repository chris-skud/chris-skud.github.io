/*
 * drills.js — the methodology, encoded as data (spec §2, §5). The session
 * runner reads this and nothing else; edit drills here without touching UI.
 *
 * A block declares which tools it mounts:
 *   metronome   — show the built-in metronome (with a "log this tempo" button)
 *   fretboard   — show the interactive SVG fretboard
 *   quiz        — show the note-finding quiz (logs a score)
 *   intervals   — show the interval viewer on the fretboard
 *   caged       — show the five CAGED shape diagrams
 * `logTempo` / `logScore` flag what gets written to the progress record.
 */
(() => {
  // Resource links (spec §7), surfaced next to the drill they support.
  const R = {
    signals:  { label: 'Signals Music Studio',        url: 'https://www.youtube.com/@SignalsMusicStudio' },
    justin:   { label: 'JustinGuitar',                url: 'https://www.justinguitar.com/' },
    scotty:   { label: 'Absolutely Understand Guitar', url: 'https://www.youtube.com/@scottywest' },
    lauren:   { label: 'Lauren Bateman',              url: 'https://www.youtube.com/@LaurenBatemanGuitar' },
  };

  // Shared warm-up — identical structure every day (spec §2, §8 injury note).
  const WARMUP = {
    id: 'warmup',
    title: 'Warm-up',
    minutes: 5,
    tools: ['metronome'],
    logTempo: true,
    drillId: 'warmup-spider',
    drillLabel: 'Chromatic spider',
    headline: 'Chromatic spider + Em hold-and-lift',
    steps: [
      'One note per click. Shuffle the finger order every pass — 1-4-2-3, 2-1-4-3, 3-1-4-2 — never plain 1-2-3-4.',
      'Last ~30s: hold an open Em and lift/replace one finger at a time (finger independence).',
    ],
    caution: 'Clean over fast. Ease the pinky in — back off the moment anything strains.',
    resource: R.lauren,
  };

  // Helper to keep block authoring terse.
  const block = (o) => Object.assign({ tools: [], steps: [] }, o);

  const DAYS = {
    A: {
      key: 'A',
      name: 'Triads & voicings',
      summary: 'Major/minor triads up the neck through inversions; clean, quiet voicings.',
      blocks: [
        WARMUP,
        block({
          id: 'dexterity', title: 'Dexterity', minutes: 8,
          headline: 'Clean triad independence',
          drillId: 'A-dex', drillLabel: 'Triad independence', logTempo: true,
          tools: ['metronome'],
          steps: [
            'Fret a top-three-string triad. Pick each string in turn — every note must ring; unfretted strings stay dead silent.',
            'Roll the fingertips so you mute by touch, not by luck. Slow tempo, perfect cleanliness.',
          ],
          resource: R.lauren,
        }),
        block({
          id: 'fretboard', title: 'Fretboard', minutes: 12,
          headline: 'Triad shapes through inversions',
          tools: ['fretboard', 'intervals'],
          steps: [
            'Play a major triad on the top-three strings, then move up through root / 1st / 2nd inversion.',
            'Repeat on the middle string set. Say each note name out loud as you land it.',
            'Use the fretboard below to check shapes; tap any fret to hear it.',
          ],
          resource: R.signals,
        }),
        block({
          id: 'application', title: 'Application', minutes: 10,
          headline: 'Re-voice a song you know',
          tools: ['metronome'],
          steps: [
            'Take a song you already play with open chords. Replace at least two of them with higher triad voicings.',
            'Comp it through once at a comfortable tempo. The goal is a usable new sound, not perfection.',
          ],
          resource: R.signals,
        }),
      ],
    },

    B: {
      key: 'B',
      name: 'Fretboard mapping',
      summary: 'Find notes on low E & A, then octaves outward, then hear intervals.',
      blocks: [
        WARMUP,
        block({
          id: 'dexterity', title: 'Dexterity', minutes: 8,
          headline: 'String skipping',
          drillId: 'B-dex', drillLabel: 'String skipping', logTempo: true,
          tools: ['metronome'],
          steps: [
            'Pick across non-adjacent strings (E→D, A→G) one note per click. Clean attack, no neighbouring-string noise.',
            'Alternate picking throughout. Keep the picking hand relaxed.',
          ],
        }),
        block({
          id: 'fretboard', title: 'Fretboard', minutes: 12,
          headline: 'Note-finding quiz',
          tools: ['quiz'], logScore: true,
          steps: [
            'The quiz calls a note — tap every place it appears on the low E and A strings before the timer runs out.',
            'Then build the octave shape outward from each root. Sing the note as you find it.',
          ],
          resource: R.justin,
        }),
        block({
          id: 'application', title: 'Application', minutes: 10,
          headline: 'Find the root in three positions',
          tools: ['fretboard'],
          steps: [
            "Pick a song. Find its root note in three different neck positions on the low strings.",
            'Play the song rooted from each — notice how the available voicings change with position.',
          ],
        }),
      ],
    },

    C: {
      key: 'C',
      name: 'CAGED & connections',
      summary: 'One chord through all five CAGED shapes; comp low vs. high register.',
      blocks: [
        WARMUP,
        block({
          id: 'dexterity', title: 'Dexterity', minutes: 8,
          headline: 'Barre-to-barre transitions',
          drillId: 'C-dex', drillLabel: 'Barre transitions', logTempo: true,
          tools: ['metronome'],
          steps: [
            'Move one barre chord between two positions in time with the click. Every string rings on the landing beat.',
            'Lift slightly between shapes — glide, don’t crush. Add positions as it cleans up.',
          ],
        }),
        block({
          id: 'fretboard', title: 'Fretboard', minutes: 12,
          headline: 'One chord, five CAGED shapes',
          tools: ['caged', 'fretboard'],
          steps: [
            'Take one chord and play it through the C, A, G, E and D shapes climbing the neck.',
            'Then comp a short progression in a low register, then again up high using these shapes.',
          ],
          resource: R.signals,
        }),
        block({
          id: 'application', title: 'Application', minutes: 10,
          headline: 'Verse low / chorus high',
          tools: ['metronome'],
          steps: [
            'Take a progression and play the “verse” in low voicings, the “chorus” up high — same chords, more lift.',
            'Dynamics from register alone. That is the whole trick.',
          ],
        }),
      ],
    },

    D: {
      key: 'D',
      name: 'Groove & transitions',
      summary: 'Backbeat metronome on 2 & 4; clean changes; a picking pattern that is the hook.',
      blocks: [
        WARMUP,
        block({
          id: 'dexterity', title: 'Dexterity', minutes: 8,
          headline: 'Fingerpicking / hybrid pattern',
          drillId: 'D-dex', drillLabel: 'Picking pattern', logTempo: true,
          tools: ['metronome'],
          steps: [
            'Loop a fingerpicking or hybrid-picking pattern over one chord until it is even and automatic.',
            'Switch on the metronome’s backbeat accent (2 & 4) and lock the pattern to it.',
          ],
          accentDefault: 'backbeat',
        }),
        block({
          id: 'fretboard', title: 'Groove', minutes: 12,
          headline: 'Clean changes on the backbeat',
          tools: ['metronome'],
          steps: [
            'Metronome accenting beats 2 & 4. Change chords cleanly, landing exactly on the click.',
            'Keep the strumming hand moving even through the change — the groove never stops.',
          ],
          accentDefault: 'backbeat',
        }),
        block({
          id: 'application', title: 'Application', minutes: 10,
          headline: 'Make the picking pattern the hook',
          tools: ['metronome'],
          steps: [
            'Write a short part where the picking pattern itself is the hook — not the chords under it.',
            'If it’s memorable on its own, you’ve got a song part.',
          ],
        }),
      ],
    },
  };

  const REST = {
    key: 'rest',
    name: 'Rest / play for fun',
    summary: 'No drills, no timer. Pick something up and just play — it still counts for your streak.',
    blocks: [],
  };

  window.Drills = { DAYS, REST, ORDER: ['A', 'B', 'C', 'D'], RESOURCES: R };
})();
