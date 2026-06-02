(() => {
  const NOTE_NAMES  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const URL_NAMES   = ['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B'];

  // MIDI 36 (C2) to MIDI 72 (C5)
  const MIDI_START = 36;
  const MIDI_END   = 72;

  // Salamander Grand Piano — Yamaha C5 samples recorded by Alexander Holm
  // (Creative Commons), hosted by Tone.js. Samples sit every minor third
  // (A, C, D#, F#), so each played note is at most 1 semitone away from a
  // real recorded sample and we pitch-shift via the `detune` AudioParam.
  const SAMPLE_BASE  = 'https://tonejs.github.io/audio/salamander/';
  const SAMPLE_MIDIS = [33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72];

  function midiInfo(midi) {
    const name = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return { name, octave, isBlack: name.includes('#') };
  }
  function midiToFile(midi) {
    return `${URL_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;
  }

  // ---------- Audio ----------
  let audioCtx = null;
  let masterBus = null;
  const buffers = new Map();
  let samplesReady = false;

  function ensureCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterBus = audioCtx.createGain();
      masterBus.gain.value = 1.0;
      masterBus.connect(audioCtx.destination);
    }
    return audioCtx;
  }

  async function loadSamples(onProgress) {
    const ctx = ensureCtx();
    let done = 0;
    await Promise.all(SAMPLE_MIDIS.map(async m => {
      const url = SAMPLE_BASE + midiToFile(m);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to load ${url}`);
      const arr = await resp.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      buffers.set(m, buf);
      done++;
      onProgress(done, SAMPLE_MIDIS.length);
    }));
    samplesReady = true;
  }

  function nearestSample(midi) {
    let best = SAMPLE_MIDIS[0];
    let bestDist = Math.abs(midi - best);
    for (const s of SAMPLE_MIDIS) {
      const d = Math.abs(midi - s);
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return best;
  }

  // Multiple sources can ring at once (sympathetic decay); we track the
  // newest source per note so a repeat strike can quickly damp the prior one.
  const activeVoices = new Map();

  function playNote(midi) {
    if (!samplesReady) return;
    const ctx = ensureCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const sampleMidi = nearestSample(midi);
    const buf = buffers.get(sampleMidi);
    if (!buf) return;

    // Quickly damp the prior strike on this same key.
    const prior = activeVoices.get(midi);
    if (prior) dampVoice(prior, 0.04);

    const src = ctx.createBufferSource();
    src.buffer = buf;
    // Primary pitch shift: cents via detune. Fallback to playbackRate for
    // older Safari (per the article).
    const cents = (midi - sampleMidi) * 100;
    if ('detune' in src) {
      src.detune.value = cents;
    } else {
      src.playbackRate.value = Math.pow(2, cents / 1200);
    }

    const g = ctx.createGain();
    g.gain.value = 0.85;

    src.connect(g).connect(masterBus);
    src.start(0);

    const voice = { src, g };
    activeVoices.set(midi, voice);
    src.onended = () => {
      if (activeVoices.get(midi) === voice) activeVoices.delete(midi);
    };
  }

  function dampVoice(voice, releaseSec) {
    const ctx = audioCtx;
    const now = ctx.currentTime;
    try {
      voice.g.gain.cancelScheduledValues(now);
      voice.g.gain.setValueAtTime(voice.g.gain.value, now);
      voice.g.gain.linearRampToValueAtTime(0.0001, now + releaseSec);
      voice.src.stop(now + releaseSec + 0.01);
    } catch (e) { /* already stopped */ }
  }

  // ---------- Build keyboard ----------
  const piano = document.getElementById('piano');
  const blackLayer = document.getElementById('blackKeys');
  const hint = document.querySelector('.hint');

  const whiteMidis = [];
  for (let m = MIDI_START; m <= MIDI_END; m++) {
    if (!midiInfo(m).isBlack) whiteMidis.push(m);
  }
  const totalWhite = whiteMidis.length;

  whiteMidis.forEach(m => {
    const { name, octave } = midiInfo(m);
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

  for (let m = MIDI_START; m <= MIDI_END; m++) {
    if (!midiInfo(m).isBlack) continue;

    const whiteIdx = whiteMidis.indexOf(m - 1);
    if (whiteIdx === -1) continue;

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

  // ---------- Boot ----------
  hint.textContent = 'Loading piano samples…';
  loadSamples((done, total) => {
    hint.textContent = `Loading piano samples… ${done}/${total}`;
  }).then(() => {
    hint.textContent = 'Click any key to play · C2 – C5 · Salamander Grand Piano';
  }).catch(err => {
    console.error(err);
    hint.textContent = 'Failed to load piano samples. Check your network connection.';
  });
})();
