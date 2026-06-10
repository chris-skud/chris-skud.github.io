/*
 * theory.js — pure music-theory engine for the fretboard explorer.
 * No DOM, no dependencies. Everything here is data + math so it can be
 * unit-reasoned about independently of how it gets drawn.
 */

// ---------------------------------------------------------------------------
// Notes & spelling
// ---------------------------------------------------------------------------

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CHROMATIC_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHROMATIC_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// The twelve roots offered in the UI, with a canonical display name each.
const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

// Parse a note name like "F#", "Bb", "D" into its letter + pitch class (0–11).
function parseNote(name) {
  const letter = name[0];
  let pc = LETTER_PC[letter];
  for (const ch of name.slice(1)) {
    if (ch === '#') pc = (pc + 1) % 12;
    else if (ch === 'b') pc = (pc + 11) % 12;
  }
  return { letter, pc, name };
}

// Spell a pitch class onto a chosen letter, producing the right accidental.
function spellOnLetter(letterIndex, desiredPc) {
  const letter = LETTERS[letterIndex];
  let diff = ((desiredPc - LETTER_PC[letter]) % 12 + 12) % 12;
  if (diff > 6) diff -= 12; // pick the nearer accidental (e.g. -1 over +11)
  let acc = '';
  if (diff > 0) acc = '#'.repeat(diff);
  else if (diff < 0) acc = 'b'.repeat(-diff);
  return letter + acc;
}

// Does a root display name lean flat? Used when spelling non-diatonic scales.
function rootPrefersFlats(rootName) {
  return rootName.includes('b') || rootName === 'F';
}

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

// intervals = semitone offsets from the root for each scale degree.
const SCALES = {
  'major':            { name: 'Major',            intervals: [0, 2, 4, 5, 7, 9, 11] },
  'natural-minor':    { name: 'Natural Minor',    intervals: [0, 2, 3, 5, 7, 8, 10] },
  'harmonic-minor':   { name: 'Harmonic Minor',   intervals: [0, 2, 3, 5, 7, 8, 11] },
  'melodic-minor':    { name: 'Melodic Minor',    intervals: [0, 2, 3, 5, 7, 9, 11] },
  'dorian':           { name: 'Dorian',           intervals: [0, 2, 3, 5, 7, 9, 10] },
  'phrygian':         { name: 'Phrygian',         intervals: [0, 1, 3, 5, 7, 8, 10] },
  'lydian':           { name: 'Lydian',           intervals: [0, 2, 4, 6, 7, 9, 11] },
  'mixolydian':       { name: 'Mixolydian',       intervals: [0, 2, 4, 5, 7, 9, 10] },
  'locrian':          { name: 'Locrian',          intervals: [0, 1, 3, 5, 6, 8, 10] },
  'major-pentatonic': { name: 'Major Pentatonic', intervals: [0, 2, 4, 7, 9] },
  'minor-pentatonic': { name: 'Minor Pentatonic', intervals: [0, 3, 5, 7, 10] },
  'blues':            { name: 'Blues',            intervals: [0, 3, 5, 6, 7, 10] },
};

const SCALE_ORDER = Object.keys(SCALES);

// Build the spelled notes of a scale rooted at rootName.
function buildScale(rootName, scaleKey) {
  const def = SCALES[scaleKey];
  const root = parseNote(rootName);
  const rootLetterIndex = LETTERS.indexOf(root.letter);
  const heptatonic = def.intervals.length === 7;
  const flats = rootPrefersFlats(rootName);

  return def.intervals.map((semis, i) => {
    const pc = (root.pc + semis) % 12;
    let name;
    if (heptatonic) {
      // One letter per degree gives proper enharmonic spelling.
      name = spellOnLetter((rootLetterIndex + i) % 7, pc);
    } else {
      name = (flats ? CHROMATIC_FLAT : CHROMATIC_SHARP)[pc];
    }
    return { pc, name, semis, degree: i + 1 };
  });
}

// The step pattern ("2 - 2 - 1 - ...") for the header line.
function stepPattern(scaleKey) {
  const iv = SCALES[scaleKey].intervals;
  const steps = [];
  for (let i = 1; i < iv.length; i++) steps.push(iv[i] - iv[i - 1]);
  steps.push(12 - iv[iv.length - 1]); // wrap back to the octave
  return steps;
}

// ---------------------------------------------------------------------------
// Diatonic chords (triads stacked in thirds within the scale)
// ---------------------------------------------------------------------------

function triadQuality(thirdSemis, fifthSemis) {
  if (thirdSemis === 4 && fifthSemis === 7) return { suffix: '',    label: 'major' };
  if (thirdSemis === 3 && fifthSemis === 7) return { suffix: 'm',   label: 'minor' };
  if (thirdSemis === 3 && fifthSemis === 6) return { suffix: 'dim', label: 'diminished' };
  if (thirdSemis === 4 && fifthSemis === 8) return { suffix: 'aug', label: 'augmented' };
  return { suffix: '?', label: 'other' };
}

// Only well-defined for 7-note scales. Returns one triad per scale degree.
function diatonicTriads(scaleNotes) {
  if (scaleNotes.length !== 7) return [];
  return scaleNotes.map((root, i) => {
    const third = scaleNotes[(i + 2) % 7];
    const fifth = scaleNotes[(i + 4) % 7];
    const thirdSemis = ((third.pc - root.pc) % 12 + 12) % 12;
    const fifthSemis = ((fifth.pc - root.pc) % 12 + 12) % 12;
    const q = triadQuality(thirdSemis, fifthSemis);
    return {
      name: root.name + q.suffix,
      quality: q.label,
      degree: i + 1,
      rootPc: root.pc,
      thirdPc: third.pc,
      fifthPc: fifth.pc,
      tones: [root, third, fifth],
    };
  });
}

// ---------------------------------------------------------------------------
// Fretboard geometry
// ---------------------------------------------------------------------------

// Standard tuning, string 1 (high e) first → string 6 (low E) last.
const STRINGS = [
  { num: 1, name: 'e', open: 64 },
  { num: 2, name: 'B', open: 59 },
  { num: 3, name: 'G', open: 55 },
  { num: 4, name: 'D', open: 50 },
  { num: 5, name: 'A', open: 45 },
  { num: 6, name: 'E', open: 40 },
];

// Standard 4-string bass tuning, string 1 (G) first → string 4 (low E) last.
const BASS_STRINGS = [
  { num: 1, name: 'G', open: 43 },
  { num: 2, name: 'D', open: 38 },
  { num: 3, name: 'A', open: 33 },
  { num: 4, name: 'E', open: 28 },
];

// Instruments selectable in the UI. Bass hides the chord-inversion section
// (no B/high-e strings → triad inversions aren't idiomatic on bass).
const INSTRUMENTS = {
  guitar: { name: 'Guitar', strings: STRINGS,      showChords: true },
  bass:   { name: 'Bass',   strings: BASS_STRINGS, showChords: false },
};

const FRET_COUNT = 15; // 0 (nut) through 15

// ---------------------------------------------------------------------------
// Triad inversions on a 3-string set
// ---------------------------------------------------------------------------

// Find a compact fret position for a desired pitch class on a string.
function fretCandidates(openMidi, desiredPc) {
  const base = ((desiredPc - (openMidi % 12)) % 12 + 12) % 12;
  return [base, base + 12];
}

/*
 * For a triad on a given 3-string set, return the three close-voiced
 * inversions. stringSet is three string objects ordered LOW pitch → HIGH
 * pitch. Each inversion lists, per string (low→high), the fret + label.
 */
function triadInversionsOnSet(triad, stringSet) {
  const R = triad.rootPc, T = triad.thirdPc, F = triad.fifthPc;
  const tones = triad.tones; // [root, third, fifth] spelled notes
  const labelFor = (pc) => (pc === R ? 'R' : pc === T ? '3' : '5');
  const noteFor  = (pc) => (pc === R ? tones[0].name : pc === T ? tones[1].name : tones[2].name);

  // Desired pitch-class order from low string to high string per inversion.
  const inversions = [
    { name: 'Root', order: [R, T, F] },
    { name: '1st inversion', order: [T, F, R] },
    { name: '2nd inversion', order: [F, R, T] },
  ];

  return inversions.map((inv) => {
    // Per string, two octave candidates; pick the combo with the tightest span.
    const candidatesPerString = stringSet.map((s, idx) =>
      fretCandidates(s.open, inv.order[idx])
    );
    let best = null;
    for (const a of candidatesPerString[0]) {
      for (const b of candidatesPerString[1]) {
        for (const c of candidatesPerString[2]) {
          const frets = [a, b, c];
          const span = Math.max(...frets) - Math.min(...frets);
          const maxF = Math.max(...frets);
          const score = span * 100 + maxF; // tight first, then low on the neck
          if (!best || score < best.score) best = { frets, score };
        }
      }
    }
    return {
      name: inv.name,
      notes: stringSet.map((s, idx) => ({
        string: s,
        fret: best.frets[idx],
        pc: inv.order[idx],
        label: labelFor(inv.order[idx]),
        note: noteFor(inv.order[idx]),
      })),
    };
  });
}

// The top-3 string set (G, B, e) ordered low → high, for chord inversions.
const TOP3_SET = [STRINGS[2], STRINGS[1], STRINGS[0]]; // G(55), B(59), e(64)

// ---------------------------------------------------------------------------
// Exports (attach to window for the no-bundler setup)
// ---------------------------------------------------------------------------

window.Theory = {
  LETTERS, ROOTS, SCALES, SCALE_ORDER, STRINGS, BASS_STRINGS, INSTRUMENTS,
  FRET_COUNT, TOP3_SET,
  parseNote, buildScale, stepPattern, diatonicTriads,
  triadInversionsOnSet,
};
