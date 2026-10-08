/*
 * audio.js — Web Audio engine for the practice coach.
 *
 * Two responsibilities:
 *   1. A sample-accurate metronome that schedules clicks ahead of time on the
 *      audio clock (the "Tale of Two Clocks" pattern). setInterval only wakes
 *      us up to top up the schedule — it never times a click itself.
 *   2. A small plucked-string synth so tapping a fret plays the right pitch.
 *
 * Exposed as window.AudioEngine (window.Audio is the HTMLAudioElement ctor).
 */
(() => {
  let ctx = null;
  let master = null;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.9;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // ---- Plucked-string voice (Karplus-Strong-ish: a quick filtered decay) ----
  function playFreq(freq, when, gain = 0.6) {
    const c = ensureCtx();
    const t = when || c.currentTime;

    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 2; // a touch of octave to read as "plucked"

    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4500, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + 0.5);

    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);

    const g2 = c.createGain();
    g2.gain.value = 0.25;

    osc1.connect(g);
    osc2.connect(g2).connect(g);
    g.connect(lp).connect(master);

    osc1.start(t); osc2.start(t);
    osc1.stop(t + 1.5); osc2.stop(t + 1.5);
  }

  function playMidi(midi, when, gain) {
    playFreq(440 * Math.pow(2, (midi - 69) / 12), when, gain);
  }

  // ---- Metronome click ----
  // accent 2 = strong (downbeat / backbeat), 1 = normal, 0 = silent.
  function click(when, accent) {
    if (accent === 0) return;
    const c = ensureCtx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'square';
    osc.frequency.value = accent === 2 ? 1500 : 900;
    const peak = accent === 2 ? 0.5 : 0.28;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    osc.connect(g).connect(master);
    osc.start(when);
    osc.stop(when + 0.06);
  }

  // ---- Scheduler ----
  const LOOKAHEAD_MS = 25;      // how often the timer wakes to refill the queue
  const SCHEDULE_AHEAD = 0.12;  // how far ahead (s) we schedule audio

  class Metronome {
    constructor() {
      this.bpm = 90;
      this.beatsPerBar = 4;
      // accent value per beat index; default accents the downbeat.
      this.pattern = [2, 1, 1, 1];
      this.isPlaying = false;
      this.currentBeat = 0;
      this.nextNoteTime = 0;
      this.timerId = null;
      this.queue = [];          // {beat, time} pending visual pulses
      this.onBeat = null;       // callback(beatIndex) fired at audible time
      this._raf = null;
    }

    setPattern(name) {
      const n = this.beatsPerBar;
      if (name === 'downbeat') this.pattern = Array.from({ length: n }, (_, i) => (i === 0 ? 2 : 1));
      else if (name === 'backbeat') this.pattern = Array.from({ length: n }, (_, i) => (i % 2 === 1 ? 2 : 1));
      else if (name === 'all') this.pattern = Array.from({ length: n }, () => 1);
      else if (name === 'off') this.pattern = Array.from({ length: n }, (_, i) => (i === 0 ? 2 : 0));
      this.patternName = name;
    }

    _advance() {
      this.nextNoteTime += 60.0 / this.bpm;
      this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
    }

    _scheduler() {
      const c = ensureCtx();
      while (this.nextNoteTime < c.currentTime + SCHEDULE_AHEAD) {
        const accent = this.pattern[this.currentBeat] ?? 1;
        click(this.nextNoteTime, accent);
        this.queue.push({ beat: this.currentBeat, time: this.nextNoteTime });
        this._advance();
      }
    }

    _draw() {
      if (!this.isPlaying) return;
      const c = ensureCtx();
      while (this.queue.length && this.queue[0].time <= c.currentTime) {
        const ev = this.queue.shift();
        if (this.onBeat) this.onBeat(ev.beat);
      }
      this._raf = requestAnimationFrame(() => this._draw());
    }

    start() {
      if (this.isPlaying) return;
      const c = ensureCtx();
      this.isPlaying = true;
      this.currentBeat = 0;
      this.nextNoteTime = c.currentTime + 0.08;
      this.queue = [];
      this.timerId = setInterval(() => this._scheduler(), LOOKAHEAD_MS);
      this._scheduler();
      this._draw();
    }

    stop() {
      this.isPlaying = false;
      if (this.timerId) clearInterval(this.timerId);
      this.timerId = null;
      if (this._raf) cancelAnimationFrame(this._raf);
      this.queue = [];
    }

    toggle() { this.isPlaying ? this.stop() : this.start(); }
  }

  window.AudioEngine = { ensureCtx, playMidi, playFreq, Metronome };
})();
