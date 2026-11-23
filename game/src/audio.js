// EMBER BAY — Heat Line: audio.js
// One job: every sound, synthesized live with WebAudio. No audio files.
// Three radio stations are little step sequencers; engine, siren, gunfire
// and pickups are oscillators and noise shaped by envelopes.
EB.audio = (function () {
  var ctx = null, master = null, musicGain = null, engineOsc = null,
    engineGain = null, sirenOsc = null, sirenGain = null, sirenLfo = null,
    musicTimer = null, step = 0, started = false;

  // Chord roots per station (Hz), one bar = 8 steps.
  var STATION_CHORDS = [
    null,
    [110, 130.8, 164.8, 196],   // Ember FM: warm A-minor-ish drive
    [98, 123.5, 146.8, 185],    // Neon Wave: G-minor synth pulse
    [87.3, 103.8, 130.8, 155.6],// Cinder Talk: low F groove
  ];

  function ensure() {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.16; musicGain.connect(master);
      engineGain = ctx.createGain(); engineGain.gain.value = 0; engineGain.connect(master);
      engineOsc = ctx.createOscillator(); engineOsc.type = "sawtooth";
      engineOsc.frequency.value = 60; engineOsc.connect(engineGain); engineOsc.start();
      sirenGain = ctx.createGain(); sirenGain.gain.value = 0; sirenGain.connect(master);
      sirenOsc = ctx.createOscillator(); sirenOsc.type = "sine"; sirenOsc.frequency.value = 750;
      sirenOsc.connect(sirenGain); sirenOsc.start();
      sirenLfo = ctx.createOscillator(); sirenLfo.type = "sine"; sirenLfo.frequency.value = 0.55;
      var lfoGain = ctx.createGain(); lfoGain.gain.value = 320;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency); sirenLfo.start();
      return true;
    } catch (e) { ctx = null; return false; }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || EB.state.muted) return;
    if (ctx.state === "suspended") ctx.resume();
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur);
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!ensure() || EB.state.muted) return;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lowpass || 1200;
    var g = ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master); src.start();
  }

  function playStep() {
    if (!ctx || EB.state.radio === 0 || EB.state.muted) return;
    var station = EB.RADIO_STATIONS[EB.state.radio];
    var chords = STATION_CHORDS[EB.state.radio];
    var bar = Math.floor(step / 8) % chords.length;
    var root = chords[bar];
    var beat = step % 8;
    var beatDur = 60 / station.tempo / 2;
    // Bass on beats 0, 3, 4, 6.
    if (beat === 0 || beat === 3 || beat === 4 || beat === 6) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = station.wave; o.frequency.value = root / 2;
      g.gain.setValueAtTime(0.5, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beatDur * 1.8);
      o.connect(g); g.connect(musicGain); o.start(); o.stop(ctx.currentTime + beatDur * 2);
    }
    // Sparkle lead on off-beats.
    if (beat % 2 === 1) {
      var notes = [1, 1.5, 2, 2.5];
      var o2 = ctx.createOscillator(), g2 = ctx.createGain();
      o2.type = "sine"; o2.frequency.value = root * notes[(step >> 1) % 4];
      g2.gain.setValueAtTime(0.22, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + beatDur);
      o2.connect(g2); g2.connect(musicGain); o2.start(); o2.stop(ctx.currentTime + beatDur);
    }
    step++;
  }

  function startMusic() {
    if (musicTimer || !ensure()) return;
    var station = EB.RADIO_STATIONS[EB.state.radio];
    if (!station || station.tempo === 0) return;
    musicTimer = setInterval(playStep, (60 / station.tempo / 2) * 1000);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  return {
    init: function () { ensure(); started = true; },
    unlock: function () { if (ensure() && ctx.state === "suspended") ctx.resume(); },
    setStation: function (i) {
      EB.state.radio = ((i % EB.RADIO_STATIONS.length) + EB.RADIO_STATIONS.length) % EB.RADIO_STATIONS.length;
      stopMusic();
      if (EB.state.radio > 0) startMusic();
      if (EB.hud) EB.hud.refreshRadio();
    },
    cycleStation: function () { this.setStation(EB.state.radio + 1); },
    engine: function (on, speedFrac) {
      if (!ensure()) return;
      var target = on ? 0.05 + 0.06 * EB.util.clamp(speedFrac || 0, 0, 1) : 0;
      engineGain.gain.setTargetAtTime(EB.state.muted ? 0 : target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + 140 * EB.util.clamp(speedFrac || 0, 0, 1), ctx.currentTime, 0.1);
    },
    siren: function (on) {
      if (!ensure()) return;
      sirenGain.gain.setTargetAtTime(on && !EB.state.muted ? 0.045 : 0, ctx.currentTime, 0.3);
    },
    shot: function () { noiseBurst(0.14, 0.5, 2400); blip(160, 0.09, "square", 0.16, 60); },
    enemyShot: function () { noiseBurst(0.1, 0.22, 1600); },
    pickup: function () { blip(660, 0.1, "sine", 0.25); setTimeout(function () { blip(990, 0.16, "sine", 0.25); }, 90); },
    cash: function () { blip(880, 0.1, "triangle", 0.25); setTimeout(function () { blip(1174, 0.2, "triangle", 0.25); }, 110); },
    mission: function () { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { blip(f, 0.22, "triangle", 0.28); }, i * 120); }); },
    fail: function () { blip(220, 0.4, "sawtooth", 0.22, 110); },
    beep: function () { blip(1200, 0.07, "sine", 0.18); },
    crash: function () { noiseBurst(0.25, 0.4, 700); },
    toggleMute: function () {
      EB.state.muted = !EB.state.muted;
      if (master && ctx) master.gain.value = EB.state.muted ? 0 : 0.5;
      return EB.state.muted;
    },
    isStarted: function () { return started; },
  };
})();
