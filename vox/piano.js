(() => {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const BLACK_NOTES = ['C#', 'D#', 'F#', 'G#', 'A#'];

  // MIDI 36 (C2) to MIDI 72 (C5)
  const MIDI_START = 36;
  const MIDI_END = 72;

  function midiToNote(midi) {
    const name = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return { name, octave, isBlack: name.includes('#') };
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  let audioCtx = null;
  function getAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function playNote(midi) {
    const ctx = getAudio();
    const now = ctx.currentTime;
    const freq = midiToFreq(midi);

    const master = ctx.createGain();
    master.connect(ctx.destination);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(0.35, now + 0.005);
    master.gain.exponentialRampToValueAtTime(0.08, now + 0.4);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    // Layered harmonics for piano-like timbre
    const partials = [
      { ratio: 1,     gain: 1.0,  type: 'triangle' },
      { ratio: 2,     gain: 0.35, type: 'sine' },
      { ratio: 3,     gain: 0.15, type: 'sine' },
      { ratio: 4,     gain: 0.08, type: 'sine' },
      { ratio: 0.5,   gain: 0.12, type: 'sine' },
    ];

    partials.forEach(p => {
      const osc = ctx.createOscillator();
      osc.type = p.type;
      osc.frequency.value = freq * p.ratio;
      const g = ctx.createGain();
      g.gain.value = p.gain;
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 2.3);
    });
  }

  const piano = document.getElementById('piano');
  const blackLayer = document.getElementById('blackKeys');

  // First pass: collect all white keys and remember their index
  const whiteMidis = [];
  for (let m = MIDI_START; m <= MIDI_END; m++) {
    if (!midiToNote(m).isBlack) whiteMidis.push(m);
  }
  const totalWhite = whiteMidis.length;

  // Build white keys
  whiteMidis.forEach(m => {
    const { name, octave } = midiToNote(m);
    const key = document.createElement('div');
    key.className = 'white-key';
    key.dataset.midi = m;

    const label = document.createElement('div');
    label.className = 'note-label';
    if (name === 'C') {
      const reg = document.createElement('div');
      reg.className = 'register';
      reg.textContent = `${name}${octave}`;
      label.appendChild(reg);
    } else {
      label.textContent = name;
    }
    key.appendChild(label);

    attachKey(key, m);
    piano.appendChild(key);
  });

  // Build black keys, positioned by percentage relative to white key count
  for (let m = MIDI_START; m <= MIDI_END; m++) {
    const info = midiToNote(m);
    if (!info.isBlack) continue;

    // Position: black key sits between the preceding white key (m-1) and following white key (m+1).
    // Find index of preceding white key.
    const precedingWhiteMidi = m - 1;
    const whiteIdx = whiteMidis.indexOf(precedingWhiteMidi);
    if (whiteIdx === -1) continue;

    // Place black key centered on the boundary between whiteIdx and whiteIdx+1.
    // Each white key occupies (100 / totalWhite)% of width.
    const whiteWidthPct = 100 / totalWhite;
    const blackWidthPct = whiteWidthPct * 0.62;
    const centerPct = (whiteIdx + 1) * whiteWidthPct;
    const leftPct = centerPct - blackWidthPct / 2;

    const bk = document.createElement('div');
    bk.className = 'black-key';
    bk.dataset.midi = m;
    bk.style.left = leftPct + '%';
    bk.style.width = blackWidthPct + '%';

    attachKey(bk, m);
    blackLayer.appendChild(bk);
  }

  function attachKey(el, midi) {
    const trigger = (e) => {
      e.preventDefault();
      playNote(midi);
      el.classList.add('active');
    };
    const release = () => el.classList.remove('active');

    el.addEventListener('mousedown', trigger);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
    el.addEventListener('touchstart', trigger, { passive: false });
    el.addEventListener('touchend', release);
  }
})();
