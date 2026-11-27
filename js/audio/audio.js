// Synthetisches Audio über WebAudio – keine externen Dateien.
// Dauerklänge (Motor, Reifen, Wind) + Registry für Einmal-Sounds.
// Neue Sounds: SOUNDS.name = (audio, opts) => { ... } und audio.play('name').

export const SOUNDS = {
  beep: (a, { freq = 660, dur = 0.18 } = {}) => a.tone(freq, dur, 'square', 0.25),
  go: (a) => {
    a.tone(990, 0.45, 'square', 0.28);
    a.tone(1485, 0.45, 'triangle', 0.12);
  },
  checkpoint: (a) => {
    a.tone(880, 0.12, 'triangle', 0.3);
    a.tone(1320, 0.22, 'triangle', 0.3, 0.09);
  },
  finish: (a) => {
    [523, 659, 784, 1047].forEach((f, i) => a.tone(f, 0.35, 'triangle', 0.28, i * 0.11));
    a.tone(1568, 0.6, 'sine', 0.15, 0.44);
  },
  record: (a) => {
    [784, 988, 1175, 1568].forEach((f, i) => a.tone(f, 0.25, 'square', 0.12, 0.5 + i * 0.08));
  },
  impact: (a, { strength = 10 } = {}) => {
    const g = Math.min(0.6, 0.12 + strength / 40);
    a.noise(0.25, g, 500 + strength * 30);
    a.tone(70, 0.18, 'sine', g * 0.8);
  },
  land: (a, { strength = 8 } = {}) => {
    a.noise(0.2, Math.min(0.45, strength / 35), 350);
    a.tone(55, 0.2, 'sine', Math.min(0.5, strength / 25));
  },
  boost: (a) => a.sweep(300, 1400, 0.35, 0.18),
  respawn: (a) => a.sweep(900, 300, 0.25, 0.12),
  click: (a) => a.tone(520, 0.05, 'square', 0.12),
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem('jgtrack.muted') === '1'; } catch { /* egal */ }
  }

  // Muss in einer Nutzer-Geste aufgerufen werden (Autoplay-Regeln)
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = (this.ctx = new Ctx());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    // Rauschpuffer
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    // Motor: zwei Oszillatoren durch Tiefpass
    this.engine = ctx.createGain();
    this.engine.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    this.engineFilter = lp;
    this.osc1 = ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc2 = ctx.createOscillator();
    this.osc2.type = 'square';
    const o2g = ctx.createGain();
    o2g.gain.value = 0.35;
    this.osc1.connect(lp);
    this.osc2.connect(o2g).connect(lp);
    lp.connect(this.engine).connect(this.master);
    this.osc1.start();
    this.osc2.start();

    // Reifenquietschen und Fahrtwind
    this.skid = this.loopNoise('bandpass', 1800, 6);
    this.wind = this.loopNoise('lowpass', 600, 0.7);
  }

  loopNoise(type, freq, Q) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return { gain: g, filter: f };
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('jgtrack.muted', m ? '1' : '0'); } catch { /* egal */ }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  // Dauerklänge pro Frame aktualisieren
  update({ speedRatio = 0, throttle = 0, slip = 0, grounded = true, active = true }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const r = Math.min(1.3, Math.abs(speedRatio));
    const base = 55 + r * 170 + throttle * 18;
    this.osc1.frequency.setTargetAtTime(base, t, 0.05);
    this.osc2.frequency.setTargetAtTime(base * 0.5, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(500 + r * 1800 + throttle * 400, t, 0.08);
    this.engine.gain.setTargetAtTime(active ? 0.07 + throttle * 0.07 + r * 0.05 : 0, t, 0.08);
    const skid = active && grounded ? Math.min(1, Math.max(0, (slip - 3) / 10)) : 0;
    this.skid.gain.gain.setTargetAtTime(skid * 0.22, t, 0.05);
    this.wind.gain.gain.setTargetAtTime(active ? r * r * 0.25 : 0, t, 0.1);
    this.wind.filter.frequency.setTargetAtTime(400 + r * 1200, t, 0.1);
  }

  play(name, opts) {
    if (!this.ctx || this.muted) return;
    SOUNDS[name]?.(this, opts);
  }

  // --- Bausteine für Einmal-Sounds ---
  tone(freq, dur, type = 'sine', vol = 0.2, delay = 0) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur, vol, cutoff) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  sweep(from, to, dur, vol) {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}
