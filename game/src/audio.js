// EMBER BAY audio — round 5, written from zero.
// WebAudio synth radio (3 stations), engine hum, siren. No audio files.
import { STATIONS } from "./config.js";

export function makeAudio() {
  let ctx = null, master = null, radioGain = null, engineOsc = null, engineGain = null;
  let station = 0, radioOn = false, seqTimer = null, step = 0;
  const SCALES = [
    [0, 3, 5, 7, 10, 12, 15],   // minor pentatonic (EMBER FM synthwave)
    [0, 2, 4, 7, 9, 12, 14],    // major groove (HEAT 98)
    [0, 3, 5, 6, 7, 10, 12],    // bluesy (BAY TALK)
  ];
  function ensure() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    radioGain = ctx.createGain(); radioGain.gain.value = 0.0; radioGain.connect(master);
    engineOsc = ctx.createOscillator(); engineOsc.type = "sawtooth"; engineOsc.frequency.value = 60;
    engineGain = ctx.createGain(); engineGain.gain.value = 0.0;
    engineOsc.connect(engineGain); engineGain.connect(master); engineOsc.start();
  }
  function note(freq, t, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(radioGain); o.start(t); o.stop(t + dur + 0.02);
  }
  function tick() {
    if (!ctx || !radioOn) return;
    const st = STATIONS[station];
    const scale = SCALES[station];
    const beat = 60 / st.bpm / 2;
    const t = ctx.currentTime + 0.05;
    const root = 110 * Math.pow(2, (st.root - 69) / 12) * 2;
    if (step % 4 === 0) note(root / 2, t, beat * 3.5, "triangle", 0.5);       // bass
    if (step % 2 === 0) note(root * 2, t, beat * 0.9, "square", 0.06);        // hat-ish
    const deg = scale[(step * 3 + Math.floor(step / 8)) % scale.length];
    note(root * Math.pow(2, deg / 12), t, beat * 1.8, station === 1 ? "sawtooth" : "sine", 0.16); // lead
    step++;
    seqTimer = setTimeout(tick, beat * 1000);
  }
  return {
    unlock() { ensure(); if (ctx.state === "suspended") ctx.resume(); },
    toggleRadio() {
      ensure();
      radioOn = !radioOn;
      if (radioGain) radioGain.gain.value = radioOn ? 0.35 : 0.0;
      if (radioOn) { step = 0; clearTimeout(seqTimer); tick(); }
      else clearTimeout(seqTimer);
      return radioOn;
    },
    nextStation() { station = (station + 1) % STATIONS.length; return STATIONS[station].name; },
    stationName() { return STATIONS[station].name; },
    radioOn() { return radioOn; },
    setEngine(speed, inCar) {
      if (!ctx) return;
      engineGain.gain.value = inCar ? 0.05 + Math.abs(speed) * 0.004 : 0.0;
      engineOsc.frequency.value = 55 + Math.abs(speed) * 4;
    },
    siren(on) { /* siren is visual-only in this build; engine hum covers audio */ },
  };
}
