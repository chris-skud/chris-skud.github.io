/*
 * fretboard.js — SVG fretboard rendering, the note-finding quiz, and the CAGED
 * chord-box diagrams. Drawn as SVG so it stays crisp and tappable (spec §3.2).
 * Tapping a fret plays the pitch via the audio engine.
 */
(() => {
  const T = window.Theory;
  const A = window.AudioEngine;
  const SVGNS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs) {
    const n = document.createElementNS(SVGNS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  // ---- Big horizontal fretboard --------------------------------------------
  // opts: {
  //   maxFret, onTap(stringIdx, fret, midi),
  //   showAllNotes:bool, highlightPcs:[pc], rootPc, intervalRoot:pc,
  //   markers:[{string,fret,label,kind}], litStrings:[idx]
  // }
  function renderFretboard(opts = {}) {
    const maxFret = opts.maxFret ?? T.FRET_COUNT;
    const strings = T.STRINGS; // high e .. low E (top row = high e)
    const padL = 30, padT = 26, fretW = 52, rowH = 34, padR = 14, padB = 16;
    const cols = maxFret + 1;
    const W = padL + cols * fretW + padR;
    const H = padT + strings.length * rowH + padB;

    const root = svg('svg', {
      viewBox: `0 0 ${W} ${H}`, class: 'fbsvg', width: '100%',
      preserveAspectRatio: 'xMinYMid meet',
    });

    const colX = (f) => padL + f * fretW + fretW / 2;       // dot center for fret f
    const rowY = (i) => padT + i * rowH + rowH / 2;

    // Wood board background.
    root.appendChild(svg('rect', {
      x: padL + fretW, y: padT - 4, width: (cols - 1) * fretW, height: strings.length * rowH + 8,
      fill: 'var(--wood-soft)', rx: 4,
    }));

    // Inlay dots.
    for (let f = 1; f <= maxFret; f++) {
      const mid = (rowY(0) + rowY(strings.length - 1)) / 2;
      if (T.DOUBLE_DOTS.includes(f)) {
        root.appendChild(svg('circle', { cx: colX(f), cy: rowY(1), r: 4, fill: 'var(--line)' }));
        root.appendChild(svg('circle', { cx: colX(f), cy: rowY(4), r: 4, fill: 'var(--line)' }));
      } else if (T.SINGLE_DOTS.includes(f)) {
        root.appendChild(svg('circle', { cx: colX(f), cy: mid, r: 4, fill: 'var(--line)' }));
      }
    }

    // Fret wires (vertical). The nut (after the open column) is thick.
    for (let f = 0; f <= maxFret; f++) {
      const x = padL + (f + 1) * fretW;
      root.appendChild(svg('line', {
        x1: x, y1: padT, x2: x, y2: padT + strings.length * rowH,
        stroke: f === 0 ? 'var(--ink)' : 'var(--line)', 'stroke-width': f === 0 ? 4 : 2,
      }));
    }
    // Fret numbers.
    for (let f = 1; f <= maxFret; f++) {
      const t = svg('text', { x: colX(f), y: padT - 10, class: 'fb-num', 'text-anchor': 'middle' });
      t.textContent = f;
      root.appendChild(t);
    }

    const lit = opts.litStrings ? new Set(opts.litStrings) : null;
    const highlight = opts.highlightPcs ? new Set(opts.highlightPcs) : null;
    const markerMap = new Map();
    (opts.markers || []).forEach((m) => markerMap.set(m.string + ':' + m.fret, m));

    // String lines + open-string labels + per-fret tap targets.
    strings.forEach((s, i) => {
      const dim = lit && !lit.has(i);
      const y = rowY(i);
      root.appendChild(svg('line', {
        x1: padL, y1: y, x2: padL + cols * fretW, y2: y,
        stroke: dim ? 'var(--line)' : 'var(--string)', 'stroke-width': 1 + (5 - i) * 0.25,
        opacity: dim ? 0.4 : 1,
      }));
      const lbl = svg('text', { x: 10, y: y + 4, class: 'fb-strlabel' });
      lbl.textContent = s.name;
      root.appendChild(lbl);

      for (let f = 0; f <= maxFret; f++) {
        const midi = T.midiAt(i, f);
        const pc = midi % 12;
        const cx = colX(f), cy = y;

        // Transparent tap target.
        const hit = svg('rect', {
          x: padL + f * fretW, y: y - rowH / 2, width: fretW, height: rowH,
          fill: 'transparent', class: 'fb-hit', 'data-s': i, 'data-f': f,
        });
        hit.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          A.playMidi(midi);
          flash(cx, cy);
          if (opts.onTap) opts.onTap(i, f, midi);
        });
        root.appendChild(hit);

        // Decide whether to draw a marker here.
        const explicit = markerMap.get(i + ':' + f);
        const showByPc = highlight && highlight.has(pc);
        if (!explicit && !showByPc && !opts.showAllNotes) continue;

        let label, kind = 'note';
        if (explicit) { label = explicit.label; kind = explicit.kind || 'note'; }
        else if (opts.intervalRoot != null && (showByPc || opts.showAllNotes)) {
          const semis = ((pc - opts.intervalRoot) % 12 + 12) % 12;
          label = T.INTERVALS[semis].short;
          if (semis === 0) kind = 'root';
        } else {
          label = T.noteName(pc);
          if (opts.rootPc != null && pc === opts.rootPc) kind = 'root';
        }

        const g = svg('g', { class: 'fb-marker fb-' + kind });
        g.appendChild(svg('circle', { cx, cy, r: 12 }));
        const tx = svg('text', { x: cx, y: cy + 4, 'text-anchor': 'middle' });
        tx.textContent = label;
        g.appendChild(tx);
        root.appendChild(g);
      }
    });

    function flash(cx, cy) {
      const c = svg('circle', { cx, cy, r: 12, class: 'fb-flash' });
      root.appendChild(c);
      setTimeout(() => c.remove(), 260);
    }

    return root;
  }

  // ---- Note-finding quiz ----------------------------------------------------
  // Calls a random note; the player taps every spot it appears on the lit
  // strings before time runs out. Logs correct/total/seconds via onLog.
  class NoteQuiz {
    constructor(container, opts = {}) {
      this.container = container;
      this.litStrings = opts.litStrings || [5, 4]; // low E, A
      this.seconds = opts.seconds || 30;
      this.onLog = opts.onLog || (() => {});
      this.maxFret = opts.maxFret ?? T.FRET_COUNT;
      this.render();
    }

    targets(pc) {
      const out = [];
      this.litStrings.forEach((si) => {
        for (let f = 0; f <= this.maxFret; f++) {
          if (T.pcAt(si, f) === pc) out.push(si + ':' + f);
        }
      });
      return out;
    }

    start() {
      this.targetPc = T.pcOf(T.QUIZ_NOTES[Math.floor(Math.random() * T.QUIZ_NOTES.length)]);
      this.remaining = new Set(this.targets(this.targetPc));
      this.total = this.remaining.size;
      this.found = [];
      this.startedAt = Date.now();
      this.active = true;
      this.timeLeft = this.seconds;
      this.render();
      this.tick = setInterval(() => {
        this.timeLeft -= 1;
        if (this.timeLeft <= 0) this.finish();
        else this.updateStatus();
      }, 1000);
    }

    handleTap(si, f) {
      if (!this.active) return;
      const key = si + ':' + f;
      if (this.remaining.has(key)) {
        this.remaining.delete(key);
        this.found.push({ string: si, fret: f, label: '✓', kind: 'answer' });
        if (!this.remaining.size) this.finish();
        else this.render();
      } else if (T.pcAt(si, f) !== this.targetPc) {
        // Brief wrong-marker flash.
        this.found.push({ string: si, fret: f, label: '✗', kind: 'wrong' });
        this.render();
        setTimeout(() => {
          this.found = this.found.filter((m) => !(m.string === si && m.fret === f && m.kind === 'wrong'));
          if (this.active) this.render();
        }, 500);
      }
    }

    finish() {
      this.active = false;
      clearInterval(this.tick);
      const correct = this.total - this.remaining.size;
      const secs = Math.min(this.seconds, Math.round((Date.now() - this.startedAt) / 1000));
      // Reveal any missed targets.
      this.remaining.forEach((key) => {
        const [s, f] = key.split(':').map(Number);
        this.found.push({ string: s, fret: f, label: '·', kind: 'missed' });
      });
      this.lastResult = { correct, total: this.total, secs };
      this.onLog(correct, this.total, secs);
      this.render();
    }

    updateStatus() {
      if (this.statusEl) {
        this.statusEl.textContent =
          `Find every ${T.noteName(this.targetPc)} · ${this.timeLeft}s · ${this.total - this.remaining.size}/${this.total}`;
      }
    }

    render() {
      this.container.innerHTML = '';
      const status = document.createElement('div');
      status.className = 'quiz-status';
      this.statusEl = status;
      if (!this.targetPc) status.textContent = 'Tap “New note” to start.';
      else if (this.active)
        status.textContent = `Find every ${T.noteName(this.targetPc)} · ${this.timeLeft}s · ${this.total - this.remaining.size}/${this.total}`;
      else {
        const r = this.lastResult;
        status.textContent = `${T.noteName(this.targetPc)}: ${r.correct}/${r.total} in ${r.secs}s — logged.`;
      }
      this.container.appendChild(status);

      const board = renderFretboard({
        maxFret: this.maxFret,
        litStrings: this.litStrings,
        markers: this.found,
        onTap: (si, f) => this.handleTap(si, f),
      });
      const wrap = document.createElement('div');
      wrap.className = 'board-wrap';
      wrap.appendChild(board);
      this.container.appendChild(wrap);

      const btn = document.createElement('button');
      btn.className = 'btn quiz-new';
      btn.textContent = this.active ? 'Restart' : 'New note';
      btn.addEventListener('click', () => this.start());
      this.container.appendChild(btn);
    }
  }

  // ---- CAGED chord-box diagrams --------------------------------------------
  // The five open shapes the system is named after. frets are low E .. high e;
  // -1 = muted, 0 = open.
  const CAGED = [
    { shape: 'C', name: 'C major', frets: [-1, 3, 2, 0, 1, 0] },
    { shape: 'A', name: 'A major', frets: [-1, 0, 2, 2, 2, 0] },
    { shape: 'G', name: 'G major', frets: [3, 2, 0, 0, 0, 3] },
    { shape: 'E', name: 'E major', frets: [0, 2, 2, 1, 0, 0] },
    { shape: 'D', name: 'D major', frets: [-1, -1, 0, 2, 3, 2] },
  ];

  function renderChordBox(def) {
    const stringsN = 6, fretsN = 4;
    const padT = 22, padL = 14, cw = 22, rh = 26, padB = 8;
    const W = padL * 2 + (stringsN - 1) * cw, H = padT + fretsN * rh + padB;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chordbox', width: W, height: H });

    const x = (i) => padL + i * cw; // string i (0 = low E on the left)
    // Nut.
    s.appendChild(svg('line', { x1: padL, y1: padT, x2: padL + (stringsN - 1) * cw, y2: padT, stroke: 'var(--ink)', 'stroke-width': 4 }));
    for (let f = 1; f <= fretsN; f++) {
      const y = padT + f * rh;
      s.appendChild(svg('line', { x1: padL, y1: y, x2: padL + (stringsN - 1) * cw, y2: y, stroke: 'var(--line)', 'stroke-width': 1.5 }));
    }
    for (let i = 0; i < stringsN; i++) {
      s.appendChild(svg('line', { x1: x(i), y1: padT, x2: x(i), y2: padT + fretsN * rh, stroke: 'var(--line)', 'stroke-width': 1.5 }));
    }
    def.frets.forEach((fr, i) => {
      const xi = x(i);
      if (fr === -1) {
        const t = svg('text', { x: xi, y: padT - 7, class: 'cb-mark', 'text-anchor': 'middle' });
        t.textContent = '×'; s.appendChild(t);
      } else if (fr === 0) {
        s.appendChild(svg('circle', { cx: xi, cy: padT - 11, r: 5, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 1.5 }));
      } else {
        s.appendChild(svg('circle', { cx: xi, cy: padT + (fr - 0.5) * rh, r: 8, fill: 'var(--accent)' }));
      }
    });
    return s;
  }

  function renderCaged(container) {
    container.innerHTML = '';
    CAGED.forEach((def) => {
      const cell = document.createElement('div');
      cell.className = 'cb-cell';
      const h = document.createElement('div');
      h.className = 'cb-title';
      h.textContent = def.shape + ' shape';
      cell.appendChild(h);
      cell.appendChild(renderChordBox(def));
      container.appendChild(cell);
    });
  }

  window.Fretboard = { renderFretboard, NoteQuiz, renderCaged, CAGED };
})();
