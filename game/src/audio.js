// audio.js — 3 synth radio stations (WebAudio, no assets).
const STATIONS = [
  { name: "EMBER FM", base: 110, wave: "sawtooth", tempo: 112 },
  { name: "NEON WAVE", base: 164, wave: "square", tempo: 96 },
  { name: "PALM CHILL", base: 220, wave: "sine", tempo: 72 },
];

export class Radio {
  constructor() {
    this.ctx = null; this.on = false; this.station = 0; this.nodes = [];
    this.nextNote = 0; this.timer = null; this.current = null;
  }
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; } }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    return !!this.ctx;
  }
  stationName() { return STATIONS[this.station].name; }
  toggle() { this.on = !this.on; if (this.on) this.start(); else this.stop(); return this.on; }
  next() { this.station = (this.station + 1) % STATIONS.length; if (this.on) { this.stop(); this.start(); } }
  start() {
    if (!this.ensure()) return;
    const st = STATIONS[this.station];
    const step = 60 / st.tempo / 2;
    const scale = [0, 3, 5, 7, 10, 12, 15];
    let i = 0;
    const tick = () => {
      if (!this.on || !this.ctx) return;
      const o = this.ctx.createOscillator(); o.type = st.wave;
      const f = st.base * Math.pow(2, scale[i % scale.length] / 12);
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, this.ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + step * 0.95);
      o.connect(g).connect(this.ctx.destination);
      o.start(); o.stop(this.ctx.currentTime + step);
      // keep the live oscillator so stop() silences it at once instead of
      // letting the current note ring out to the end of its step
      if (this.current) { try { this.current.stop(); } catch { /* already stopped */ } }
      this.current = o;
      i++;
      this.timer = setTimeout(tick, step * 1000);
    };
    tick();
  }
  stop() { if (this.timer) clearTimeout(this.timer); this.timer = null; if (this.current) { try { this.current.stop(); } catch { /* already stopped */ } this.current = null; } }
}
