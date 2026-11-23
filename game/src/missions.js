// EMBER BAY — missions: 8 story jobs, one glowing marker (ground disc +
// light beam + ring + floating diamond + cone), crates and checkpoints.
(function () {
  var EB = window.EB || (window.EB = {});
  var C = EB.config;
  var scene = null, marker = null, diamond = null, crateMeshes = [];
  var index = 0, sub = 0, timer = 0, collected = 0, done = false, finishedStory = false;
  var onComplete = null;

  function buildMarker() {
    marker = new THREE.Group();
    var disc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24), new THREE.MeshBasicMaterial({ color: 0xffd75e, transparent: true, opacity: 0.45, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; marker.add(disc);
    var ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.16, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffd75e }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.12; marker.add(ring);
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 26, 12, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 13; marker.add(beam);
    diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.1), new THREE.MeshBasicMaterial({ color: 0xffd75e }));
    diamond.position.y = 5.5; marker.add(diamond);
    var cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.8, 4), new THREE.MeshBasicMaterial({ color: 0xff2fb3 }));
    cone.rotation.x = Math.PI; cone.position.y = 8.2; marker.add(cone);
    scene.add(marker);
  }

  function clearCrates() {
    crateMeshes.forEach(function (m) { scene.remove(m); });
    crateMeshes = [];
  }

  function spawnCrates(targets) {
    clearCrates();
    targets.forEach(function (t) {
      var c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshLambertMaterial({ color: 0xf2a516, emissive: 0x442200 }));
      c.position.set(t.x, 0.8, t.z);
      scene.add(c); crateMeshes.push(c);
    });
  }

  function def() { return C.MISSIONS[Math.min(index, C.MISSIONS.length - 1)]; }

  function currentTarget() {
    if (finishedStory) return null;
    var d = def();
    if (d.type === "race" || d.type === "drops") return d.targets[Math.min(sub, d.targets.length - 1)];
    if (d.type === "crates") {
      for (var i = 0; i < d.targets.length; i++) if (!crateMeshes[i] || crateMeshes[i].visible) return d.targets[i];
      return d.targets[d.targets.length - 1];
    }
    if (d.type === "escape" || d.type === "heli") return null;
    return d.target;
  }

  function start(i) {
    index = i; sub = 0; collected = 0; done = false;
    var d = def();
    timer = d.seconds || 0;
    clearCrates();
    if (d.type === "crates") spawnCrates(d.targets);
    var t = currentTarget();
    if (t && marker) { marker.position.set(t.x, 0, t.z); marker.visible = true; }
    else if (marker) marker.visible = false;
  }

  function complete(ctx) {
    if (done) return;
    done = true;
    var d = def();
    EB.audio.blip(660, 0.15, "sine", 0.3);
    setTimeout(function () { EB.audio.blip(880, 0.2, "sine", 0.3); }, 160);
    if (onComplete) onComplete(d, ctx);
  }

  function near(x, z, tx, tz, r) { return Math.hypot(x - tx, z - tz) < r; }

  function update(dt, ctx, time) {
    if (finishedStory || done) return;
    var d = def();
    if (marker && marker.visible) {
      diamond.rotation.y = time * 1.6;
      diamond.position.y = 5.5 + Math.sin(time * 2) * 0.4;
      marker.children[1].scale.setScalar(1 + Math.sin(time * 3) * 0.06);
    }
    var t = currentTarget();
    if (t && marker) { marker.position.set(t.x, 0, t.z); marker.visible = true; }
    if (d.type === "enterCar") {
      if (ctx.inCar) complete(ctx);
    } else if (d.type === "reach") {
      if (t && near(ctx.x, ctx.z, t.x, t.z, 9)) complete(ctx);
    } else if (d.type === "race") {
      if (t && near(ctx.x, ctx.z, t.x, t.z, 10)) {
        sub++; EB.audio.blip(520, 0.12, "square", 0.25);
        if (sub >= d.targets.length) complete(ctx);
      }
    } else if (d.type === "crates") {
      for (var i = 0; i < d.targets.length; i++) {
        if (crateMeshes[i] && crateMeshes[i].visible && near(ctx.x, ctx.z, d.targets[i].x, d.targets[i].z, 4.5)) {
          crateMeshes[i].visible = false; collected++;
          EB.audio.blip(740, 0.12, "square", 0.25);
          EB.people.flee(d.targets[i].x, d.targets[i].z, 12);
        }
      }
      if (collected >= d.targets.length) complete(ctx);
    } else if (d.type === "drops") {
      if (t && near(ctx.x, ctx.z, t.x, t.z, 9)) {
        sub++; EB.audio.blip(520, 0.12, "square", 0.25);
        if (sub >= d.targets.length) complete(ctx);
      }
    } else if (d.type === "escape" || d.type === "heli") {
      timer -= dt;
      if (timer <= 0) complete(ctx);
    } else if (d.type === "stealGT") {
      if (ctx.inGT) complete(ctx);
    }
  }

  function progress() {
    var d = def();
    if (d.type === "race" || d.type === "drops") return { segments: d.targets.length, done: sub, bar: sub / d.targets.length, label: (d.type === "race" ? "GATE " : "DROP ") + sub + "/" + d.targets.length };
    if (d.type === "crates") return { segments: 3, done: collected, bar: collected / 3, label: "CRATE " + collected + "/3" };
    if (d.type === "escape" || d.type === "heli") return { segments: 0, done: 0, bar: Math.max(0, timer / (d.seconds || 1)), label: (d.type === "escape" ? "ESCAPE " : "HELI ") + Math.ceil(Math.max(0, timer)) + "s" };
    return { segments: 0, done: 0, bar: done ? 1 : 0, label: "" };
  }

  function advance() {
    if (index >= C.MISSIONS.length - 1) { finishedStory = true; if (marker) marker.visible = false; return false; }
    start(index + 1);
    return true;
  }

  function build(sc) {
    scene = sc;
    buildMarker();
    start(0);
  }

  EB.missions = {
    build: build, start: start, update: update, advance: advance, progress: progress,
    currentTarget: currentTarget, def: def,
    index: function () { return index; },
    isDone: function () { return done; },
    storyDone: function () { return finishedStory; },
    setOnComplete: function (fn) { onComplete = fn; },
    wantedFor: function () { var d = def(); return d.wanted || 0; }
  };
})();
