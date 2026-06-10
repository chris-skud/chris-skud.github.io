/*
 * render.js — turns Theory data into DOM. Pure rendering helpers used by
 * both index.html (the picker) and scale.html (the detail page).
 */

const T = window.Theory;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Markers (single + double dots) at the usual neck inlay positions.
const SINGLE_DOTS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_DOTS = [12, 24];

// ---------------------------------------------------------------------------
// Full fretboard with note names
// ---------------------------------------------------------------------------

// scaleNotes: array of {pc, name}. rootPc highlights the tonic.
// strings defaults to the guitar set; pass T.BASS_STRINGS for bass.
function renderFullFretboard(scaleNotes, rootPc, strings) {
  const stringList = strings || T.STRINGS;
  const byPc = new Map(scaleNotes.map((n) => [n.pc, n]));
  const frets = T.FRET_COUNT;

  const board = el('div', 'fb');
  board.style.setProperty('--frets', frets + 1);

  // Fret-number row across the top.
  const header = el('div', 'fb-row fb-fretnums');
  header.appendChild(el('div', 'fb-string-label', ''));
  for (let f = 0; f <= frets; f++) {
    const cell = el('div', 'fb-fretnum', String(f));
    if (f === 0) cell.classList.add('nut-num');
    if (DOUBLE_DOTS.includes(f)) cell.classList.add('inlay-double');
    else if (SINGLE_DOTS.includes(f)) cell.classList.add('inlay');
    header.appendChild(cell);
  }
  board.appendChild(header);

  // One row per string (highest at top → lowest at bottom).
  for (const str of stringList) {
    const row = el('div', 'fb-row');
    row.appendChild(el('div', 'fb-string-label', str.name));
    for (let f = 0; f <= frets; f++) {
      const cell = el('div', 'fb-cell');
      if (f === 0) cell.classList.add('fb-nut');
      const pc = (str.open + f) % 12;
      const note = byPc.get(pc);
      if (note) {
        const dot = el('span', 'note', note.name);
        if (pc === rootPc) dot.classList.add('root');
        cell.appendChild(dot);
      }
      row.appendChild(cell);
    }
    board.appendChild(row);
  }
  return board;
}

// ---------------------------------------------------------------------------
// Chord inversion mini-diagram (one inversion, top-3 strings)
// ---------------------------------------------------------------------------

function renderInversion(inv) {
  const frets = inv.notes.map((n) => n.fret);
  const minF = Math.min(...frets);
  const maxF = Math.max(...frets);
  // A small window around the shape; always show at least 4 fret slots.
  let start = Math.max(0, minF - 1);
  let end = Math.max(maxF + 1, start + 3);
  if (start === 0) end = Math.max(end, 3);

  const wrap = el('div', 'inv');
  wrap.appendChild(el('div', 'inv-title', inv.name));

  const grid = el('div', 'inv-grid');
  grid.style.setProperty('--cols', end - start + 1 + 1); // +1 for string label col

  // Header: fret numbers for this window.
  grid.appendChild(el('div', 'inv-corner', ''));
  for (let f = start; f <= end; f++) {
    grid.appendChild(el('div', 'inv-fretnum', String(f)));
  }

  // inv.notes is low→high; show high string on top to match the big board.
  for (let i = inv.notes.length - 1; i >= 0; i--) {
    const n = inv.notes[i];
    grid.appendChild(el('div', 'inv-string-label', n.string.name));
    for (let f = start; f <= end; f++) {
      const cell = el('div', 'inv-cell');
      if (f === 0) cell.classList.add('inv-nut');
      if (f === n.fret) {
        const dot = el('span', 'inv-dot', n.note);
        if (n.label === 'R') dot.classList.add('root');
        cell.appendChild(dot);
      }
      grid.appendChild(cell);
    }
  }
  wrap.appendChild(grid);
  return wrap;
}

function renderChordCard(triad) {
  const card = el('div', 'chord-card');
  const head = el('div', 'chord-head');
  head.appendChild(el('span', 'chord-name', triad.name));
  head.appendChild(el('span', 'chord-meta',
    `${roman(triad.degree, triad.quality)} · ${triad.quality} · ` +
    triad.tones.map((t) => t.name).join(' ')));
  card.appendChild(head);

  const invs = T.triadInversionsOnSet(triad, T.TOP3_SET);
  const row = el('div', 'inv-row');
  invs.forEach((inv) => row.appendChild(renderInversion(inv)));
  card.appendChild(row);
  return card;
}

function roman(degree, quality) {
  const base = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][degree - 1];
  if (quality === 'minor') return base.toLowerCase();
  if (quality === 'diminished') return base.toLowerCase() + '°';
  if (quality === 'augmented') return base + '+';
  return base;
}

window.Render = { el, renderFullFretboard, renderChordCard, roman };
