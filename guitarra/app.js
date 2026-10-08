/*
 * app.js — the session runner and progress views that tie the pieces together.
 * A tiny imperative router over one #app node; each view tears down its timers
 * and audio widgets before the next renders (so no metronome keeps ticking).
 */
(() => {
  const { DAYS, REST, ORDER } = window.Drills;
  const Store = window.Store;
  const FB = window.Fretboard;
  const T = window.Theory;

  const app = document.getElementById('app');
  let teardown = []; // fns to run before navigating away

  function go(renderFn) {
    teardown.forEach((fn) => { try { fn(); } catch (e) {} });
    teardown = [];
    app.innerHTML = '';
    renderFn();
    window.scrollTo(0, 0);
  }

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function dayName(key) {
    return key === 'rest' ? REST.name : `Day ${key} — ${DAYS[key].name}`;
  }

  // ===========================================================================
  // Home
  // ===========================================================================
  function renderHome() {
    const suggested = Store.suggestedDayType();
    const streak = Store.getStreak();

    const head = el('header', 'masthead');
    head.appendChild(el('h1')).innerHTML = '<span class="accent">Practice</span> Coach';
    head.appendChild(el('p', 'sub', 'Tell me what to do, give me a number to beat, remember it. ~35 minutes, four blocks.'));
    app.appendChild(head);

    // Streak strip.
    const strip = el('div', 'streakstrip');
    strip.appendChild(streakChip('Current streak', `${streak.current}`, 'day' + (streak.current === 1 ? '' : 's')));
    strip.appendChild(streakChip('Longest', `${streak.longest}`, 'day' + (streak.longest === 1 ? '' : 's')));
    const sessions = Store.getSessions();
    strip.appendChild(streakChip('Sessions', `${sessions.length}`, 'logged'));
    app.appendChild(strip);

    // Today's suggestion.
    app.appendChild(el('p', 'picker-label', "Today's session"));
    const card = el('div', 'today-card');
    const d = DAYS[suggested];
    card.appendChild(el('div', 'today-badge', `Day ${suggested}`));
    const body = el('div', 'today-body');
    body.appendChild(el('div', 'today-name', d.name));
    body.appendChild(el('div', 'today-sum', d.summary));
    card.appendChild(body);
    const startBtn = el('button', 'btn btn-primary today-start', 'Start');
    startBtn.addEventListener('click', () => startSession(suggested));
    card.appendChild(startBtn);
    app.appendChild(card);

    // Pick a different day.
    app.appendChild(el('p', 'picker-label', 'Or pick a day-type'));
    const grid = el('div', 'day-grid');
    ORDER.forEach((k) => {
      const b = el('button', 'day-btn' + (k === suggested ? ' suggested' : ''));
      b.appendChild(el('span', 'day-btn-key', k));
      b.appendChild(el('span', 'day-btn-name', DAYS[k].name));
      b.addEventListener('click', () => startSession(k));
      grid.appendChild(b);
    });
    const rest = el('button', 'day-btn day-rest');
    rest.appendChild(el('span', 'day-btn-key', '☼'));
    rest.appendChild(el('span', 'day-btn-name', 'Rest / play for fun'));
    rest.addEventListener('click', () => startSession('rest'));
    grid.appendChild(rest);
    app.appendChild(grid);

    // Footer nav.
    const nav = el('div', 'home-nav');
    const prog = el('button', 'btn', 'View progress →');
    prog.addEventListener('click', () => go(renderProgress));
    nav.appendChild(prog);
    app.appendChild(nav);
  }

  function streakChip(label, big, small) {
    const c = el('div', 'streakchip');
    c.appendChild(el('div', 'streakchip-num', big));
    c.appendChild(el('div', 'streakchip-lbl', label + ' · ' + small));
    return c;
  }

  // ===========================================================================
  // Session runner
  // ===========================================================================
  function startSession(key) {
    if (key === 'rest') return go(() => renderRest());
    const day = DAYS[key];
    const state = {
      key, day, index: 0,
      completed: {}, // blockId -> true
    };
    go(() => renderBlock(state));
  }

  function renderBlock(state) {
    const { day } = state;
    const block = day.blocks[state.index];
    const total = day.blocks.length;

    // Top bar: where am I.
    const bar = el('div', 'session-bar');
    const back = el('button', 'linkbtn', '← Exit');
    back.addEventListener('click', () => go(renderHome));
    bar.appendChild(back);
    bar.appendChild(el('div', 'session-day', dayName(state.key)));
    app.appendChild(bar);

    // Block progress pips.
    const pips = el('div', 'pips');
    day.blocks.forEach((b, i) => {
      const p = el('div', 'pip' + (i === state.index ? ' active' : '') + (state.completed[b.id] ? ' done' : ''));
      p.title = b.title;
      pips.appendChild(p);
    });
    app.appendChild(pips);

    // Block header + timer.
    const headRow = el('div', 'block-head');
    const titleWrap = el('div');
    titleWrap.appendChild(el('div', 'block-kicker', `Block ${state.index + 1} of ${total} · ${block.minutes} min`));
    titleWrap.appendChild(el('h2', 'block-title', block.title));
    titleWrap.appendChild(el('div', 'block-headline', block.headline));
    headRow.appendChild(titleWrap);
    headRow.appendChild(buildTimer(block.minutes));
    app.appendChild(headRow);

    // Steps.
    if (block.steps && block.steps.length) {
      const ol = el('ol', 'steps');
      block.steps.forEach((s) => ol.appendChild(el('li', null, s)));
      app.appendChild(ol);
    }
    if (block.caution) {
      const c = el('div', 'caution');
      c.appendChild(el('span', 'caution-icon', '⚠'));
      c.appendChild(el('span', null, block.caution));
      app.appendChild(c);
    }

    // Tools.
    const tools = el('div', 'tools');
    app.appendChild(tools);
    mountTools(block, tools);

    // Resource link.
    if (block.resource) {
      const res = el('div', 'resource');
      res.appendChild(el('span', 'resource-lbl', 'Watch / reference:'));
      const a = el('a', 'resource-link', block.resource.label);
      a.href = block.resource.url; a.target = '_blank'; a.rel = 'noopener';
      res.appendChild(a);
      app.appendChild(res);
    }

    // Nav.
    const nav = el('div', 'block-nav');
    if (state.index > 0) {
      const prev = el('button', 'btn', '← Previous');
      prev.addEventListener('click', () => { state.index--; go(() => renderBlock(state)); });
      nav.appendChild(prev);
    }
    const isLast = state.index === total - 1;
    const next = el('button', 'btn btn-primary', isLast ? 'Finish session' : 'Next block →');
    next.addEventListener('click', () => {
      state.completed[block.id] = true;
      if (isLast) finishSession(state);
      else { state.index++; go(() => renderBlock(state)); }
    });
    nav.appendChild(next);
    app.appendChild(nav);
  }

  // Countdown timer; auto-runs, pausable. Cleaned up on navigation.
  function buildTimer(minutes) {
    let remaining = minutes * 60;
    let running = true;
    const wrap = el('div', 'timer');
    const time = el('div', 'timer-time');
    const btn = el('button', 'timer-btn', 'Pause');
    wrap.append(time, btn);

    function fmt(s) {
      const m = Math.floor(s / 60), ss = s % 60;
      return `${m}:${String(ss).padStart(2, '0')}`;
    }
    function paint() {
      time.textContent = fmt(Math.max(0, remaining));
      wrap.classList.toggle('overtime', remaining <= 0);
    }
    paint();
    const id = setInterval(() => {
      if (!running) return;
      remaining--;
      if (remaining <= 0) { remaining = 0; running = false; btn.textContent = 'Done'; wrap.classList.add('overtime'); }
      paint();
    }, 1000);
    btn.addEventListener('click', () => {
      if (remaining <= 0) return;
      running = !running;
      btn.textContent = running ? 'Pause' : 'Resume';
    });
    teardown.push(() => clearInterval(id));
    return wrap;
  }

  // Mount whatever widgets a block asks for.
  function mountTools(block, container) {
    (block.tools || []).forEach((tool) => {
      const panel = el('div', 'tool-panel');
      container.appendChild(panel);
      if (tool === 'metronome') {
        const h = window.MetronomeWidget.mount(panel, {
          drillId: block.drillId,
          drillLabel: block.drillLabel,
          defaultPattern: block.accentDefault || 'downbeat',
          onLog: () => {},
        });
        teardown.push(h.destroy);
      } else if (tool === 'fretboard') {
        mountFretboardTool(panel);
      } else if (tool === 'intervals') {
        mountIntervalTool(panel);
      } else if (tool === 'quiz') {
        const q = new FB.NoteQuiz(panel, {
          onLog: (correct, total, secs) => Store.logQuiz('low-e-a-notes', correct, total, secs),
        });
        teardown.push(() => clearInterval(q.tick));
      } else if (tool === 'caged') {
        const wrap = el('div', 'caged');
        panel.appendChild(el('div', 'tool-label', 'The five shapes'));
        panel.appendChild(wrap);
        FB.renderCaged(wrap);
      }
    });
  }

  function mountFretboardTool(panel) {
    panel.appendChild(el('div', 'tool-label', 'Fretboard — tap a fret to hear it'));
    const controls = el('div', 'fb-controls');
    let showAll = false;
    const toggle = el('button', 'btn fb-toggle', 'Show note names');
    controls.appendChild(toggle);
    panel.appendChild(controls);
    const boardWrap = el('div', 'board-wrap');
    panel.appendChild(boardWrap);
    function draw() {
      boardWrap.innerHTML = '';
      boardWrap.appendChild(FB.renderFretboard({ showAllNotes: showAll }));
    }
    toggle.addEventListener('click', () => {
      showAll = !showAll;
      toggle.textContent = showAll ? 'Hide note names' : 'Show note names';
      toggle.classList.toggle('active', showAll);
      draw();
    });
    draw();
  }

  function mountIntervalTool(panel) {
    panel.appendChild(el('div', 'tool-label', 'Intervals — pick a root, see the shapes'));
    const roots = el('div', 'root-row');
    let rootPc = 0; // C
    const boardWrap = el('div', 'board-wrap');
    function draw() {
      boardWrap.innerHTML = '';
      boardWrap.appendChild(FB.renderFretboard({ showAllNotes: true, intervalRoot: rootPc }));
    }
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach((nm, pc) => {
      const b = el('button', 'root-mini' + (pc === 0 ? ' active' : ''), nm);
      b.addEventListener('click', () => {
        rootPc = pc;
        roots.querySelectorAll('.root-mini').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        draw();
      });
      roots.appendChild(b);
    });
    panel.appendChild(roots);
    panel.appendChild(boardWrap);
    draw();
  }

  // ---- Rest day -------------------------------------------------------------
  function renderRest() {
    const bar = el('div', 'session-bar');
    const back = el('button', 'linkbtn', '← Exit');
    back.addEventListener('click', () => go(renderHome));
    bar.appendChild(back);
    bar.appendChild(el('div', 'session-day', REST.name));
    app.appendChild(bar);

    const card = el('div', 'rest-card');
    card.appendChild(el('h2', 'block-title', 'Rest / play for fun'));
    card.appendChild(el('p', null, REST.summary));
    const done = el('button', 'btn btn-primary', 'Done — count it');
    done.addEventListener('click', () => {
      Store.saveSession({ dayType: 'rest', blocks: {} });
      go(renderDone.bind(null, 'rest'));
    });
    card.appendChild(done);
    app.appendChild(card);
  }

  // ---- Finish ---------------------------------------------------------------
  function finishSession(state) {
    const blocks = {};
    state.day.blocks.forEach((b) => { blocks[b.id] = { completed: !!state.completed[b.id] }; });
    Store.saveSession({ dayType: state.key, blocks });
    go(() => renderDone(state.key));
  }

  function renderDone(key) {
    const streak = Store.getStreak();
    const card = el('div', 'done-card');
    card.appendChild(el('div', 'done-check', '✓'));
    card.appendChild(el('h2', 'block-title', 'Session logged'));
    card.appendChild(el('p', null, `${dayName(key)} — nice. Streak: ${streak.current} day${streak.current === 1 ? '' : 's'}.`));
    const row = el('div', 'block-nav');
    const home = el('button', 'btn', 'Home');
    home.addEventListener('click', () => go(renderHome));
    const prog = el('button', 'btn btn-primary', 'See progress →');
    prog.addEventListener('click', () => go(renderProgress));
    row.append(home, prog);
    card.appendChild(row);
    app.appendChild(card);
  }

  // ===========================================================================
  // Progress
  // ===========================================================================
  function renderProgress() {
    const bar = el('div', 'session-bar');
    const back = el('button', 'linkbtn', '← Home');
    back.addEventListener('click', () => go(renderHome));
    bar.appendChild(back);
    bar.appendChild(el('div', 'session-day', 'Progress'));
    app.appendChild(bar);

    const streak = Store.getStreak();
    const strip = el('div', 'streakstrip');
    strip.appendChild(streakChip('Current streak', `${streak.current}`, 'day' + (streak.current === 1 ? '' : 's')));
    strip.appendChild(streakChip('Longest', `${streak.longest}`, 'day' + (streak.longest === 1 ? '' : 's')));
    strip.appendChild(streakChip('Sessions', `${Store.getSessions().length}`, 'logged'));
    app.appendChild(strip);

    // Tempo charts, one per drill that has data.
    const tempos = Store.getTempos();
    const byDrill = groupBy(tempos, (t) => t.drillId);
    const drillNames = {
      'warmup-spider': 'Warm-up spider', 'A-dex': 'Triad independence',
      'B-dex': 'String skipping', 'C-dex': 'Barre transitions', 'D-dex': 'Picking pattern',
    };
    app.appendChild(el('p', 'picker-label', 'Tempo — fastest clean BPM'));
    if (!tempos.length) {
      app.appendChild(el('div', 'empty', 'No tempos logged yet. Hit “Log this tempo” during a drill.'));
    } else {
      Object.keys(byDrill).forEach((id) => {
        const pts = byDrill[id].map((t, i) => ({ x: i, y: t.bpm, date: t.date }));
        app.appendChild(chartCard(drillNames[id] || id, pts, 'BPM'));
      });
    }

    // Quiz accuracy.
    const quizzes = Store.getQuizzes();
    app.appendChild(el('p', 'picker-label', 'Note-finding — accuracy'));
    if (!quizzes.length) {
      app.appendChild(el('div', 'empty', 'No quiz results yet. Run the note-finding quiz on a Day B session.'));
    } else {
      const pts = quizzes.map((q, i) => ({ x: i, y: Math.round((q.correct / q.total) * 100), date: q.date }));
      app.appendChild(chartCard('Low E & A note quiz', pts, '%', 0, 100));
    }

    // Data controls.
    const ctl = el('div', 'home-nav');
    const exp = el('button', 'btn', 'Export data');
    exp.addEventListener('click', () => {
      const blob = new Blob([Store.export()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'guitarra-progress.json';
      a.click();
    });
    const reset = el('button', 'btn btn-danger', 'Reset all data');
    reset.addEventListener('click', () => {
      if (confirm('Erase all sessions, tempos, quiz scores and streak? This cannot be undone.')) {
        Store.reset();
        go(renderProgress);
      }
    });
    ctl.append(exp, reset);
    app.appendChild(ctl);
  }

  function chartCard(title, pts, unit, forceMin, forceMax) {
    const card = el('div', 'chart-card');
    const head = el('div', 'chart-head');
    head.appendChild(el('span', 'chart-title', title));
    const latest = pts[pts.length - 1].y;
    const first = pts[0].y;
    const delta = latest - first;
    head.appendChild(el('span', 'chart-latest', `${latest}${unit === '%' ? '%' : ' ' + unit}` + (pts.length > 1 ? `  (${delta >= 0 ? '+' : ''}${delta})` : '')));
    card.appendChild(head);
    card.appendChild(lineChart(pts, unit, forceMin, forceMax));
    return card;
  }

  // Minimal inline SVG line chart.
  function lineChart(pts, unit, forceMin, forceMax) {
    const W = 320, H = 110, padL = 30, padR = 10, padT = 10, padB = 18;
    const ys = pts.map((p) => p.y);
    let ymin = forceMin != null ? forceMin : Math.min(...ys);
    let ymax = forceMax != null ? forceMax : Math.max(...ys);
    if (ymin === ymax) { ymin -= 5; ymax += 5; }
    const span = ymax - ymin;
    const n = pts.length;
    const x = (i) => padL + (n === 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
    const y = (v) => padT + (1 - (v - ymin) / span) * (H - padT - padB);

    const SVGNS = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', `0 0 ${W} ${H}`);
    s.setAttribute('class', 'linechart');
    s.setAttribute('width', '100%');

    // y gridlines (min / mid / max).
    [ymin, (ymin + ymax) / 2, ymax].forEach((v) => {
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('x1', padL); ln.setAttribute('x2', W - padR);
      ln.setAttribute('y1', y(v)); ln.setAttribute('y2', y(v));
      ln.setAttribute('stroke', 'var(--line)'); ln.setAttribute('stroke-width', 1);
      s.appendChild(ln);
      const tx = document.createElementNS(SVGNS, 'text');
      tx.setAttribute('x', 2); tx.setAttribute('y', y(v) + 3);
      tx.setAttribute('class', 'chart-axis');
      tx.textContent = Math.round(v);
      s.appendChild(tx);
    });

    // Line.
    if (n > 1) {
      const path = document.createElementNS(SVGNS, 'polyline');
      path.setAttribute('points', pts.map((p, i) => `${x(i)},${y(p.y)}`).join(' '));
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'var(--accent)');
      path.setAttribute('stroke-width', 2.5);
      path.setAttribute('stroke-linejoin', 'round');
      s.appendChild(path);
    }
    // Dots.
    pts.forEach((p, i) => {
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', x(i)); c.setAttribute('cy', y(p.y)); c.setAttribute('r', 3.5);
      c.setAttribute('fill', i === n - 1 ? 'var(--root)' : 'var(--accent)');
      s.appendChild(c);
    });
    return s;
  }

  function groupBy(arr, keyFn) {
    const out = {};
    arr.forEach((x) => { const k = keyFn(x); (out[k] = out[k] || []).push(x); });
    return out;
  }

  // Boot.
  go(renderHome);

  // Register the service worker (PWA install) — best effort.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
