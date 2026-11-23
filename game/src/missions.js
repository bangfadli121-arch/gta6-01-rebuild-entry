// EMBER BAY — Heat Line: missions.js
// One job: the story. Eight missions with live objectives, a pulsing
// marker, crates, checkpoints and the Rust Crew, plus mission complete /
// fail handling with cash, respect and auto-save.
EB.missions = (function () {
  var marker = null, markerRing = null, markerLight = null;
  var target = null;      // {x, z, label}
  var crates = [];
  var enemies = [];
  var checkpoints = [];
  var cpIndex = 0;
  var drops = [];
  var dropIndex = 0;
  var timer = 0, timerMax = 0;
  var active = false;
  var mara = null;

  function makeMarker() {
    marker = new THREE.Group();
    // v10: the UNMISSABLE marker (Brisa Bay rule) — a glowing ground
    // DISC + the vertical light beam + a FLOATING INVERTED TRIANGLE
    // above it, all in high-contrast yellow. Three stacked signals,
    // so the objective reads from anywhere in the city.
    var disc = new THREE.Mesh(
      new THREE.CircleGeometry(3.4, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.32,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.12; marker.add(disc);
    marker.userData.disc = disc;
    var beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.6, 26, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 13; marker.add(beam);
    markerRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.2, 0.22, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    markerRing.rotation.x = Math.PI / 2; markerRing.position.y = 0.5; marker.add(markerRing);
    var diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.9),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    diamond.position.y = 5; marker.add(diamond);
    marker.userData.diamond = diamond;
    // Inverted triangle (cone, point down) floating above the marker.
    var tri = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.6, 4),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    tri.rotation.x = Math.PI;
    tri.position.y = 9; marker.add(tri);
    marker.userData.tri = tri;
    markerLight = new THREE.PointLight(0xffd23e, 60, 30);
    markerLight.position.y = 4; marker.add(markerLight);
    marker.visible = false;
    EB.world.scene().add(marker);
  }

  function setTarget(x, z, label) {
    target = { x: x, z: z, label: label || "" };
    marker.position.set(x, 0, z);
    marker.visible = true;
    if (EB.hud) EB.hud.setObjective(EB.MISSIONS[EB.state.missionIndex].name, EB.MISSIONS[EB.state.missionIndex].objective);
  }

  function clearTarget() { target = null; marker.visible = false; }

  function clearCrates() {
    crates.forEach(function (c) { EB.world.scene().remove(c.mesh); });
    crates = [];
  }
  function clearEnemies() {
    enemies.forEach(function (e) { EB.world.scene().remove(e.mesh); });
    enemies = [];
  }
  function clearCheckpoints() {
    checkpoints.forEach(function (c) { EB.world.scene().remove(c.mesh); });
    checkpoints = [];
  }

  function spawnCrate(x, z) {
    var mesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshLambertMaterial({ color: 0xd9a44a, emissive: 0x332200 }));
    mesh.position.set(x, 0.7, z);
    mesh.castShadow = true;
    EB.world.scene().add(mesh);
    crates.push({ mesh: mesh, x: x, z: z, taken: false });
  }

  function spawnEnemy(x, z) {
    var g = new THREE.Group();
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.25),
      new THREE.MeshLambertMaterial({ color: 0x22252a }));
    legs.position.y = 0.4; g.add(legs);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.62, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x8a1a1a }));
    torso.position.y = 1.11; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
    head.position.y = 1.62; g.add(head);
    var band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.32),
      new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    band.position.y = 1.7; g.add(band);
    var gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111214 }));
    gun.position.set(0.3, 1.15, 0.4); g.add(gun);
    g.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    g.position.set(x, 0, z);
    EB.world.scene().add(g);
    enemies.push({ mesh: g, x: x, z: z, hp: 60, shootCd: 1, alive: true });
  }

  function spawnCheckpoint(x, z, n) {
    var mesh = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.35, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0xff4ad9 }));
    mesh.add(ring);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6.4, 6),
      new THREE.MeshBasicMaterial({ color: 0xff4ad9 }));
    post.position.set(3.2, 0, 0); mesh.add(post);
    var post2 = post.clone(); post2.position.x = -3.2; mesh.add(post2);
    mesh.position.set(x, 3.2, z);
    EB.world.scene().add(mesh);
    checkpoints.push({ mesh: mesh, x: x, z: z, n: n, done: false });
  }

  function spawnMara(x, z) {
    if (mara) { EB.world.scene().remove(mara); mara = null; }
    var g = new THREE.Group();
    var dress = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.3, 10),
      new THREE.MeshLambertMaterial({ color: 0x2a6ad9 }));
    dress.position.y = 0.65; g.add(dress);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.28),
      new THREE.MeshLambertMaterial({ color: 0x2a6ad9 }));
    torso.position.y = 1.5; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xe8b88a }));
    head.position.y = 1.95; g.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8),
      new THREE.MeshLambertMaterial({ color: 0x1c1410 }));
    hair.position.y = 2.05; hair.scale.y = 1.4; g.add(hair);
    g.position.set(x, 0, z);
    EB.world.scene().add(g);
    mara = g;
    return g;
  }

  function startMission(i) {
    active = true;
    clearCrates(); clearEnemies(); clearCheckpoints();
    cpIndex = 0; dropIndex = 0; timer = 0;
    var m = EB.MISSIONS[i];
    EB.say("MISSION " + m.id + ": " + m.name + " — " + m.short);
    EB.bigSay(m.name.toUpperCase(), 2400);
    if (EB.hud) EB.hud.setObjective(m.name, m.objective);
    if (i === 0) {
      var fc = EB.vehicles.firstCar;
      setTarget(fc.x, fc.z, "First car");
    } else if (i === 1) {
      spawnMara(-185, -175);
      setTarget(-185, -175, "Mara");
    } else if (i === 2) {
      [[150, -190], [190, -130], [130, -100], [185, -185]].forEach(function (p, n) {
        spawnCheckpoint(p[0], p[1], n + 1);
      });
      setTarget(150, -190, "Gate 1/4");
    } else if (i === 3) {
      [[-20, 130], [20, 160], [-40, 170]].forEach(function (p) { spawnCrate(p[0], p[1]); });
      [[-10, 140], [30, 150], [-30, 150]].forEach(function (p) { spawnEnemy(p[0], p[1]); });
      setTarget(-20, 130, "Crate 1/3");
    } else if (i === 4) {
      EB.setWanted(3);
      timer = 60; timerMax = 60;
      setTarget(EB.game.playerPos().x, EB.game.playerPos().z, "Survive");
      EB.say("Lose the heat — 60 seconds clean!");
    } else if (i === 5) {
      EB.setWanted(4);
      timer = 90; timerMax = 90;
      setTarget(-160, 120, "Hideout");
    } else if (i === 6) {
      drops = [[-185, -175, "Drop 1 — Portside"], [160, -160, "Drop 2 — Neon Row"], [0, -185, "Drop 3 — Old Market"]];
      setTarget(drops[0][0], drops[0][1], drops[0][2]);
    } else if (i === 7) {
      var gt = EB.vehicles.emberGT;
      setTarget(gt.x, gt.z, "The Ember GT");
      EB.say("The gold Ember GT is in Cinder Docks. Take it.");
    }
  }

  function completeMission() {
    var m = EB.MISSIONS[EB.state.missionIndex];
    EB.state.missionDone[EB.state.missionIndex] = true;
    EB.addCash(m.reward);
    EB.addRespect(m.respect);
    EB.audio.cash(); EB.audio.mission();
    EB.bigSay("MISSION COMPLETE — " + m.name.toUpperCase(), 3000);
    EB.say("+" + EB.util.fmtMoney(m.reward) + "  •  +" + m.respect + " respect");
    clearTarget(); clearCrates(); clearEnemies(); clearCheckpoints();
    if (mara) { EB.world.scene().remove(mara); mara = null; }
    EB.save.save();
    if (EB.state.missionIndex >= EB.MISSIONS.length - 1) {
      EB.state.storyComplete = true;
      EB.bigSay("THE EMBER CROWN IS YOURS", 4000);
      EB.say("Story complete — free roam Ember Bay, Kade.");
      active = false;
      if (EB.hud) EB.hud.setObjective("Free roam", "Story complete. Cruise Ember Bay, raise respect, lose the heat.");
      return;
    }
    EB.state.missionIndex++;
    startMission(EB.state.missionIndex);
  }

  function failMission(reason) {
    EB.audio.fail();
    EB.bigSay(reason || "BUSTED", 3000);
    EB.state.health = 100;
    EB.setWanted(0);
    EB.game.respawn();
    startMission(EB.state.missionIndex);
  }

  function update(dt) {
    if (!active || !EB.state.started || EB.state.paused) return;
    var i = EB.state.missionIndex;
    var p = EB.game.playerPos();
    if (marker.visible) {
      markerRing.rotation.z += dt * 1.5;
      marker.userData.diamond.position.y = 5 + Math.sin(performance.now() / 300) * 0.5;
      marker.userData.diamond.rotation.y += dt * 2;
      // v10: the inverted triangle bobs + spins, and the ground disc
      // pulses — the marker is alive, not a static pole.
      var tri = marker.userData.tri;
      if (tri) {
        tri.position.y = 9 + Math.sin(performance.now() / 280) * 0.6;
        tri.rotation.y += dt * 2.4;
      }
      var disc = marker.userData.disc;
      if (disc) disc.material.opacity = 0.26 + 0.1 * Math.sin(performance.now() / 350);
    }
    crates.forEach(function (c) { if (!c.taken) c.mesh.rotation.y += dt; });
    // Enemy gang shoots back.
    enemies.forEach(function (e) {
      if (!e.alive) return;
      e.shootCd -= dt;
      var d = EB.util.dist2(e.x, e.z, p.x, p.z);
      e.mesh.lookAt(p.x, 0, p.z);
      if (d < 42 && e.shootCd <= 0) {
        e.shootCd = 1.3;
        EB.combat.enemyShoot(e.x, 1.3, e.z, p.x, 1.2, p.z);
        if (Math.random() < 0.4) EB.game.damagePlayer(4, "gang");
      }
    });
    if (i === 2) {
      var cp = checkpoints[cpIndex];
      if (cp && EB.util.dist2(p.x, p.z, cp.x, cp.z) < 6) {
        cp.done = true;
        EB.world.scene().remove(cp.mesh);
        EB.audio.pickup();
        cpIndex++;
        if (cpIndex >= checkpoints.length) { completeMission(); return; }
        var next = checkpoints[cpIndex];
        setTarget(next.x, next.z, "Gate " + (cpIndex + 1) + "/4");
        EB.say("Gate " + cpIndex + "/4 — next gate marked");
      }
    } else if (i === 3) {
      var left = 0;
      crates.forEach(function (c) {
        if (!c.taken && EB.util.dist2(p.x, p.z, c.x, c.z) < 4) {
          c.taken = true; EB.world.scene().remove(c.mesh);
          EB.audio.pickup(); EB.say("Crate secured");
        }
        if (!c.taken) left++;
      });
      if (left > 0) {
        var first = null;
        crates.forEach(function (c) { if (!c.taken && !first) first = c; });
        if (first) setTarget(first.x, first.z, "Crate — " + left + " left");
      } else { completeMission(); return; }
    } else if (i === 4) {
      timer -= dt;
      if (EB.hud) EB.hud.setObjective("Getaway Driver", "Stay free — " + Math.ceil(timer) + "s left  •  Wanted " + EB.state.wanted + "★");
      if (timer <= 0) {
        EB.setWanted(0);
        completeMission(); return;
      }
    } else if (i === 5) {
      timer -= dt;
      if (EB.util.dist2(p.x, p.z, -160, 120) < 10) { completeMission(); return; }
      if (timer <= 0) { failMission("AIR ONE BOXED YOU IN"); return; }
      if (EB.hud) EB.hud.setObjective("Air One", "Reach the hideout — " + Math.ceil(timer) + "s  •  " + Math.round(EB.util.dist2(p.x, p.z, -160, 120)) + "m");
    } else if (i === 6) {
      var d = drops[dropIndex];
      if (d && EB.util.dist2(p.x, p.z, d[0], d[1]) < 8) {
        EB.audio.pickup(); EB.say("Drop " + (dropIndex + 1) + " made");
        dropIndex++;
        if (dropIndex >= drops.length) { completeMission(); return; }
        setTarget(drops[dropIndex][0], drops[dropIndex][1], drops[dropIndex][2]);
      }
    } else if (i === 7) {
      var gt = EB.vehicles.emberGT;
      if (!gt.isPlayer && EB.vehicles.playerCar() !== gt) {
        setTarget(gt.x, gt.z, "The Ember GT");
      } else if (EB.vehicles.playerCar() === gt) {
        setTarget(200, 140, "Sunset Beach");
        if (EB.util.dist2(p.x, p.z, 200, 140) < 14) { completeMission(); return; }
      }
    } else if (i === 1) {
      if (EB.util.dist2(p.x, p.z, -185, -175) < 9) { completeMission(); return; }
    }
  }

  return {
    init: function () { makeMarker(); },
    start: startMission,
    startFirst: function () { EB.state.missionIndex = 0; startMission(0); },
    update: update,
    complete: completeMission,
    fail: failMission,
    target: function () { return target; },
    enemies: function () { return enemies; },
    timer: function () { return timer; },
    timerMax: function () { return timerMax; },
    // v9: stage progress for the mission card's progress bar —
    // {done, total, label}, or null when the mission has no stages.
    progress: function () {
      if (!active) return null;
      var i = EB.state.missionIndex;
      if (i === 2) return { done: cpIndex, total: 4, label: "GATE " + cpIndex + "/4" };
      if (i === 3) {
        var left = 0;
        crates.forEach(function (c) { if (!c.taken) left++; });
        return { done: 3 - left, total: 3, label: "CRATE " + (3 - left) + "/3" };
      }
      if (i === 4) return { done: Math.max(0, timerMax - timer), total: timerMax || 60, label: "ESCAPE " + Math.ceil(timer) + "s" };
      if (i === 5) return { done: Math.max(0, timerMax - timer), total: timerMax || 90, label: "HIDEOUT " + Math.ceil(timer) + "s" };
      if (i === 6) return { done: dropIndex, total: 3, label: "DROP " + dropIndex + "/3" };
      return null;
    },
    isActive: function () { return active; },
    // Mission 1 completes the moment the player enters the first car.
    onEnterCar: function (car) {
      if (EB.state.missionIndex === 0 && active && car.isFirstCar) completeMission();
    },
    // Called by combat when an enemy is killed.
    onEnemyKilled: function (e) {
      e.alive = false;
      EB.world.scene().remove(e.mesh);
      EB.state.kills++;
      EB.addRespect(15);
      EB.say("Rust Crew down  •  +15 respect");
    },
  };
})();
