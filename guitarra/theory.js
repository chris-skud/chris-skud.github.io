/*
 * theory.js — pure music + fretboard math for the practice coach.
 * No DOM, no deps. Standard-tuning guitar geometry plus note helpers used by
 * the interactive fretboard and the note-finding quiz.
 */
(() => {
  const NOTE_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // The twelve natural/likely roots the quiz can call. Natural notes are the
  // priority for fretboard mapping, so they lead; accidentals follow.
  const QUIZ_NOTES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'C#', 'D#', 'F#', 'G#', 'A#'];

  // Standard tuning. Index 0 = high e (string 1), index 5 = low E (string 6).
  // open = MIDI note number of the open string.
  const STRINGS = [
    { num: 1, name: 'e', open: 64 },
    { num: 2, name: 'B', open: 59 },
    { num: 3, name: 'G', open: 55 },
    { num: 4, name: 'D', open: 50 },
    { num: 5, name: 'A', open: 45 },
    { num: 6, name: 'E', open: 40 },
  ];

  const FRET_COUNT = 12; // 0 (nut) .. 12

  // pitch class (0–11) of a given string/fret.
  function pcAt(stringIndex, fret) {
    return (STRINGS[stringIndex].open + fret) % 12;
  }
  // MIDI number of a given string/fret.
  function midiAt(stringIndex, fret) {
    return STRINGS[stringIndex].open + fret;
  }
  function noteName(pc) {
    return NOTE_SHARP[((pc % 12) + 12) % 12];
  }
  function pcOf(name) {
    return NOTE_SHARP.indexOf(name);
  }
  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Intervals from a root, semitone -> short label (for the interval viewer).
  const INTERVALS = [
    { semis: 0,  short: 'R',  name: 'Root / Unison' },
    { semis: 1,  short: 'b2', name: 'Minor 2nd' },
    { semis: 2,  short: '2',  name: 'Major 2nd' },
    { semis: 3,  short: 'b3', name: 'Minor 3rd' },
    { semis: 4,  short: '3',  name: 'Major 3rd' },
    { semis: 5,  short: '4',  name: 'Perfect 4th' },
    { semis: 6,  short: 'b5', name: 'Tritone' },
    { semis: 7,  short: '5',  name: 'Perfect 5th' },
    { semis: 8,  short: 'b6', name: 'Minor 6th' },
    { semis: 9,  short: '6',  name: 'Major 6th' },
    { semis: 10, short: 'b7', name: 'Minor 7th' },
    { semis: 11, short: '7',  name: 'Major 7th' },
    { semis: 12, short: '8',  name: 'Octave' },
  ];

  // Inlay dot positions on a guitar neck.
  const SINGLE_DOTS = [3, 5, 7, 9];
  const DOUBLE_DOTS = [12];

  window.Theory = {
    NOTE_SHARP, QUIZ_NOTES, STRINGS, FRET_COUNT, INTERVALS, SINGLE_DOTS, DOUBLE_DOTS,
    pcAt, midiAt, noteName, pcOf, midiToFreq,
  };
})();
