/*
 * storage.js — the only module that touches persistence. Everything else goes
 * through window.Store, so the localStorage backing can later be swapped for a
 * real API without changing any UI code (spec §4).
 *
 * Stored under a single namespaced key as one JSON blob:
 *   { sessions:[PracticeSession], tempos:[TempoLog], quizzes:[QuizResult], streak:Streak }
 */
(() => {
  const KEY = 'guitarra.v1';

  const empty = () => ({
    sessions: [],
    tempos: [],
    quizzes: [],
    streak: { current: 0, longest: 0, lastPracticedDate: null },
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      return Object.assign(empty(), JSON.parse(raw));
    } catch (e) {
      console.warn('storage read failed, starting fresh', e);
      return empty();
    }
  }

  function save(db) {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('storage write failed', e);
    }
  }

  const todayStr = () => new Date().toISOString().slice(0, 10);
  function daysBetween(a, b) {
    const ms = new Date(b + 'T00:00') - new Date(a + 'T00:00');
    return Math.round(ms / 86400000);
  }

  // ---- Streak: count consecutive calendar days with a logged session ----
  function touchStreak(db) {
    const today = todayStr();
    const s = db.streak;
    if (s.lastPracticedDate === today) return s; // already counted today
    if (!s.lastPracticedDate) s.current = 1;
    else {
      const gap = daysBetween(s.lastPracticedDate, today);
      s.current = gap === 1 ? s.current + 1 : 1;
    }
    s.longest = Math.max(s.longest, s.current);
    s.lastPracticedDate = today;
    return s;
  }

  const api = {
    getAll: load,
    getSessions: () => load().sessions,
    getTempos: () => load().tempos,
    getQuizzes: () => load().quizzes,
    getStreak: () => load().streak,

    // Persist a completed session and advance the streak. Returns the session.
    saveSession(session) {
      const db = load();
      session.id = session.id || ('s_' + Date.now());
      session.date = session.date || new Date().toISOString();
      db.sessions.push(session);
      touchStreak(db);
      save(db);
      return session;
    },

    logTempo(drillId, bpm) {
      const db = load();
      const entry = { drillId, date: new Date().toISOString(), bpm };
      db.tempos.push(entry);
      save(db);
      return entry;
    },

    logQuiz(quizId, correct, total, seconds) {
      const db = load();
      const entry = { quizId, date: new Date().toISOString(), correct, total, seconds };
      db.quizzes.push(entry);
      save(db);
      return entry;
    },

    // Last logged bpm for a drill (so the metronome can resume where you were).
    lastTempo(drillId) {
      const t = load().tempos.filter((x) => x.drillId === drillId);
      return t.length ? t[t.length - 1].bpm : null;
    },

    // Which day-type to suggest next: rotate A→B→C→D→A past the last real session.
    suggestedDayType() {
      const real = load().sessions.filter((s) => s.dayType !== 'rest');
      if (!real.length) return 'A';
      const order = ['A', 'B', 'C', 'D'];
      const last = real[real.length - 1].dayType;
      return order[(order.indexOf(last) + 1) % order.length];
    },

    reset() {
      save(empty());
    },

    export() {
      return JSON.stringify(load(), null, 2);
    },
  };

  window.Store = api;
})();
