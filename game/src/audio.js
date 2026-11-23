// EMBER BAY — audio: 3 synth radio stations on WebAudio, plus one-shots.
// No audio files; everything is synthesized. Mute lives on N.
(function () {
  var EB = window.EB || (window.EB = {});
  var ctx = null, master = null, muted = false, timer = null, step = 0, station = -1;

  var STATIONS = [
    { name: "EMBER FM", bpm: 96, wave: "sawtooth", bass: [0, 0, 7, 0, 5, 0, 3, 7], lead: [12, 15, 19, 15, 12, 10, 7, 10], root: 110 },
    { name: "NEON WAVE", bpm: 122, wave: "square", bass: [0, 3, 5, 3, 0, 8, 7, 5], lead: [12, 19, 24, 19, 15, 12, 15, 19], root: 130.8 },
    { name: "CINDER TALK", bpm: 80, wave: "triangle", bass: [0, 0, 0, 5, 0, 0, 3, 5], lead: [7, 12, 10, 12, 15, 12, 10, 7], root: 98 }
  ];

  function ensure() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function note(freq, dur, wave, vol, when) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(master);
    o.start(when); o.stop(when + dur + 0.02);
  }

  function tick() {
    if (station < 0 || !ctx) return;
    var st = STATIONS[station];
    var spb = 60 / st.bpm / 2;
    var now = ctx.currentTime + 0.05;
    var b = st.bass[step % st.bass.length];
    var l = st.lead[step % st.lead.length];
    note(st.root * Math.pow(2, b / 12), spb * 1.8, st.wave, 0.5, now);
    if (step % 2 === 0) note(st.root * 2 * Math.pow(2, l / 12), spb * 0.9, "sine", 0.22, now);
    if (step % 4 === 2) note(st.root * 4, spb * 0.4, "sine", 0.10, now);
    step++;
    timer = setTimeout(tick, spb * 1000);
  }

  function setStation(i) {
    station = i;
    if (timer) { clearTimeout(timer); timer = null; }
    step = 0;
    if (i >= 0 && ensure()) tick();
    return station >= 0 ? STATIONS[station].name : "RADIO OFF";
  }

  function cycle() {
    var next = station + 1;
    if (next > 2) next = -1;
    return setStation(next);
  }

  function blip(freq, dur, wave, vol) {
    if (muted || !ensure()) return;
    note(freq, dur || 0.08, wave || "sine", vol || 0.25, ctx.currentTime);
  }

  function setMuted(m) {
    muted = m;
    if (master) master.gain.value = muted ? 0 : 0.16;
    if (muted && timer) { clearTimeout(timer); timer = null; }
    else if (!muted && station >= 0) tick();
    return muted;
  }

  EB.audio = { STATIONS: STATIONS, ensure: ensure, setStation: setStation, cycle: cycle, blip: blip, setMuted: setMuted, isMuted: function () { return muted; }, station: function () { return station; } };
})();
