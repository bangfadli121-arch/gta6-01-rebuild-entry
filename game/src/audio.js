// Ember Bay — synthesized sound: four radio stations, engine hum and
// effects. Everything is WebAudio oscillators; no audio files are loaded.
(function () {
  var EB = window.EB || (window.EB = {});
  var ctx = null, master = null, radioGain = null, engineOsc = null, engineGain = null;
  var radioTimer = null, step = 0;

  var SCALES = {
    synthwave: [55, 65.41, 82.41, 98, 110, 130.81, 164.81],
    chill: [130.81, 164.81, 196, 220, 261.63, 329.63],
    rock: [73.42, 82.41, 98, 110, 123.47, 146.83],
    talk: [110, 110, 130.81, 98]
  };

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      radioGain = ctx.createGain(); radioGain.gain.value = 0.16; radioGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 55;
      engineGain = ctx.createGain(); engineGain.gain.value = 0.0; engineGain.connect(master);
      engineOsc.connect(engineGain); engineOsc.start();
      return true;
    } catch (e) { return false; }
  }

  function note(freq, dur, type, vol, when) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(radioGain);
    o.start(when); o.stop(when + dur + 0.05);
  }

  function radioBeat() {
    if (!ctx || !EB.state.radioOn) return;
    var st = EB.CONFIG.radio[EB.state.radioIndex];
    var scale = SCALES[st.style] || SCALES.synthwave;
    var now = ctx.currentTime + 0.02;
    var root = scale[step % scale.length];
    if (st.style === 'synthwave') {
      note(root * 2, 0.22, 'square', 0.16, now);
      note(root, 0.45, 'sawtooth', 0.10, now);
      if (step % 4 === 0) note(root / 2, 0.5, 'triangle', 0.22, now);
    } else if (st.style === 'chill') {
      note(root, 0.9, 'sine', 0.18, now);
      if (step % 2 === 0) note(root * 1.5, 0.7, 'sine', 0.10, now + 0.1);
    } else if (st.style === 'rock') {
      note(root, 0.18, 'sawtooth', 0.20, now);
      if (step % 2 === 1) note(root * 2, 0.12, 'square', 0.12, now);
      if (step % 8 === 0) note(root / 2, 0.4, 'triangle', 0.25, now);
    } else {
      if (step % 3 === 0) note(180 + (step % 5) * 12, 0.08, 'square', 0.08, now);
      note(root / 2, 0.3, 'triangle', 0.10, now);
    }
    step++;
  }

  EB.audio = {
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!radioTimer) radioTimer = setInterval(radioBeat, 240);
    },
    setEngine: function (speed01, on) {
      if (!ctx || !engineOsc) return;
      engineOsc.frequency.value = 50 + speed01 * 160;
      engineGain.gain.value = on ? 0.03 + speed01 * 0.05 : 0.0;
    },
    blip: function (freq, dur) {
      if (!ensure()) return;
      note(freq || 880, dur || 0.12, 'sine', 0.25, ctx.currentTime);
    },
    shot: function () {
      if (!ensure()) return;
      var o = ctx.createOscillator(), g = ctx.createGain(), n = ctx.currentTime;
      o.type = 'square'; o.frequency.setValueAtTime(220, n);
      o.frequency.exponentialRampToValueAtTime(40, n + 0.12);
      g.gain.setValueAtTime(0.35, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.14);
      o.connect(g); g.connect(master); o.start(n); o.stop(n + 0.16);
    },
    crash: function () {
      if (!ensure()) return;
      var o = ctx.createOscillator(), g = ctx.createGain(), n = ctx.currentTime;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(90, n);
      o.frequency.exponentialRampToValueAtTime(30, n + 0.25);
      g.gain.setValueAtTime(0.4, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.3);
      o.connect(g); g.connect(master); o.start(n); o.stop(n + 0.32);
    },
    siren: function () {
      if (!ensure()) return;
      var o = ctx.createOscillator(), g = ctx.createGain(), n = ctx.currentTime;
      o.type = 'sine';
      o.frequency.setValueAtTime(700, n);
      o.frequency.linearRampToValueAtTime(1100, n + 0.4);
      o.frequency.linearRampToValueAtTime(700, n + 0.8);
      g.gain.setValueAtTime(0.06, n); g.gain.exponentialRampToValueAtTime(0.001, n + 0.85);
      o.connect(g); g.connect(master); o.start(n); o.stop(n + 0.9);
    }
  };
})();
