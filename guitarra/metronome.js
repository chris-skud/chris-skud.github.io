/*
 * metronome.js — the metronome UI widget, bound to the Web Audio scheduler in
 * audio.js. Mount one into a block; it owns a single Metronome instance and
 * cleans it up on destroy(). The "log this tempo" button feeds Store directly
 * so the climbing number is captured the moment you hit it (spec §3.1).
 */
(() => {
  const A = window.AudioEngine;

  const PATTERNS = [
    { id: 'downbeat', label: 'Downbeat' },
    { id: 'backbeat', label: '2 & 4' },
    { id: 'all', label: 'All' },
    { id: 'off', label: 'Silent' },
  ];

  // opts: { drillId, drillLabel, defaultPattern, onLog(bpm) }
  function mount(container, opts = {}) {
    const m = new A.Metronome();
    if (opts.startBpm) m.bpm = opts.startBpm;
    else if (opts.drillId && window.Store) {
      const last = window.Store.lastTempo(opts.drillId);
      if (last) m.bpm = last;
    }
    m.setPattern(opts.defaultPattern || 'downbeat');

    container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'metro';
    container.appendChild(root);

    // Beat pulse dots.
    const pulse = document.createElement('div');
    pulse.className = 'metro-pulse';
    const dots = [];
    for (let i = 0; i < m.beatsPerBar; i++) {
      const d = document.createElement('span');
      d.className = 'metro-dot';
      pulse.appendChild(d);
      dots.push(d);
    }
    root.appendChild(pulse);

    m.onBeat = (beat) => {
      dots.forEach((d, i) => d.classList.toggle('on', i === beat));
      dots[beat].classList.toggle('accent', m.pattern[beat] === 2);
    };

    // BPM readout + stepper.
    const bpmRow = document.createElement('div');
    bpmRow.className = 'metro-bpm';
    const minus = mkBtn('−', 'metro-step');
    const plus = mkBtn('+', 'metro-step');
    const bpmVal = document.createElement('div');
    bpmVal.className = 'metro-bpmval';
    const bpmNum = document.createElement('span');
    bpmNum.className = 'metro-num';
    bpmNum.textContent = m.bpm;
    const bpmUnit = document.createElement('span');
    bpmUnit.className = 'metro-unit';
    bpmUnit.textContent = 'BPM';
    bpmVal.append(bpmNum, bpmUnit);
    bpmRow.append(minus, bpmVal, plus);
    root.appendChild(bpmRow);

    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = 40; slider.max = 220; slider.value = m.bpm;
    slider.className = 'metro-slider';
    root.appendChild(slider);

    function setBpm(v) {
      m.bpm = Math.max(40, Math.min(220, v));
      bpmNum.textContent = m.bpm;
      slider.value = m.bpm;
    }
    minus.addEventListener('click', () => setBpm(m.bpm - 1));
    plus.addEventListener('click', () => setBpm(m.bpm + 1));
    slider.addEventListener('input', () => setBpm(+slider.value));

    // Accent pattern toggle.
    const patRow = document.createElement('div');
    patRow.className = 'metro-patterns';
    const patBtns = [];
    PATTERNS.forEach((p) => {
      const b = mkBtn(p.label, 'metro-pat');
      if (p.id === m.patternName) b.classList.add('active');
      b.addEventListener('click', () => {
        m.setPattern(p.id);
        patBtns.forEach((x) => x.classList.toggle('active', x === b));
      });
      patRow.appendChild(b);
      patBtns.push(b);
    });
    root.appendChild(patRow);

    // Transport.
    const transport = document.createElement('div');
    transport.className = 'metro-transport';
    const play = mkBtn('▶ Start', 'btn btn-primary metro-play');
    play.addEventListener('click', () => {
      m.toggle();
      play.textContent = m.isPlaying ? '■ Stop' : '▶ Start';
      play.classList.toggle('playing', m.isPlaying);
      if (!m.isPlaying) dots.forEach((d) => d.classList.remove('on', 'accent'));
    });
    transport.appendChild(play);

    if (opts.drillId) {
      const log = mkBtn('Log this tempo', 'btn metro-log');
      log.addEventListener('click', () => {
        window.Store.logTempo(opts.drillId, m.bpm);
        log.textContent = `Logged ${m.bpm} ✓`;
        log.classList.add('done');
        setTimeout(() => { log.textContent = 'Log this tempo'; log.classList.remove('done'); }, 1600);
        if (opts.onLog) opts.onLog(m.bpm);
      });
      transport.appendChild(log);
    }
    root.appendChild(transport);

    return { destroy: () => m.stop(), metronome: m };
  }

  function mkBtn(text, cls) {
    const b = document.createElement('button');
    b.className = cls;
    b.textContent = text;
    return b;
  }

  window.MetronomeWidget = { mount };
})();
