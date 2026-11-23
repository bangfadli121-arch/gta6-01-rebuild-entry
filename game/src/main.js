// EMBER BAY — main: boot, state, game loop, camera, on-foot + driving,
// enter/exit/carjack, garage, saves, and the EB.game API the harness uses.
(function () {
  var EB = window.EB || (window.EB = {});
  var C = EB.config;

  var state = {
    started: false, paused: false, cash: C.START_CASH, respect: 0, hp: 100,
    missionIndex: 0, missionDirty: true, inCar: false, inGT: false,
    wheelOpen: false, garageOpen: false, mapOpen: false,
    weapon: 0, upgrades: { engine: 0, armor: 0, paint: 0 }, paint: 0,
    radioLabel: "RADIO OFF", nearCar: null, nearCarKind: null, speed: 0,
    px: 24, pz: 164, heading: Math.PI / 2, muted: false
  };
  EB.state = state;

  var renderer, scene, camera, clock;
  var playerMesh = null, currentCar = null, dragYaw = 0, camYaw = 0;
  var shotFrames = 0, time = 0, bustedUntil = 0;
  var SPAWN = { x: 24, z: 164, heading: Math.PI / 2 };

  function buildPlayerMesh() {
    var g = new THREE.Group();
    var skin = new THREE.MeshLambertMaterial({ color: 0xc98a5e });
    var jacket = new THREE.MeshLambertMaterial({ color: 0x1e56d8 });
    var pants = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.6, 0.22), pants); legL.position.set(0, 0.3, 0.12); g.add(legL);
    var legR = legL.clone(); legR.position.z = -0.12; g.add(legR);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.68, 0.58), jacket); torso.position.y = 0.95; g.add(torso);
    var armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.6, 0.14), jacket); armL.position.set(0, 0.95, 0.38); g.add(armL);
    var armR = armL.clone(); armR.position.z = -0.38; g.add(armR);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 8), skin); head.position.y = 1.5; g.add(head);
    var hair = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.44), new THREE.MeshLambertMaterial({ color: 0x1a1a1a })); hair.position.y = 1.68; g.add(hair);
    g.userData.legL = legL; g.userData.legR = legR;
    scene.add(g);
    return g;
  }

  function boot() {
    var canvas = document.getElementById("c");
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xe88a4a, 260, 950);
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(250, 120, 180);
    var hemi = new THREE.HemisphereLight(0x8fb8ff, 0x8a5a3a, 0.85);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffb347, 1.5);
    sun.position.set(-300, 160, -200);
    scene.add(sun);
    var amb = new THREE.AmbientLight(0x604a6a, 0.5);
    scene.add(amb);
    EB.world.build(scene);
    EB.vehicles.build(scene);
    EB.people.build(scene);
    EB.missions.build(scene);
    EB.combat.build(scene, camera);
    playerMesh = buildPlayerMesh();
    currentCar = EB.vehicles.playerCar();
    EB.vehicles.setCurrentCar(currentCar);
    EB.input.bind(canvas);
    EB.hud.build();
    EB.missions.setOnComplete(onMissionComplete);
    EB.combat.setOnBusted(onBusted);
    EB.game = game;
    // continue?
    var save = EB.save.read();
    if (save) EB.hud.setContinueVisible(true, "JOB " + (save.missionIndex + 1) + "/8 · $" + save.cash);
    // shot staging
    var shot = EB.shots.param();
    if (shot) {
      state.started = true;
      EB.hud.setStartVisible(false);
      EB.shots.stage(shot);
    }
    window.addEventListener("resize", function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    clock = { last: performance.now() };
    requestAnimationFrame(loop);
  }

  function onMissionComplete(d, ctx) {
    state.cash += d.cash;
    state.respect = Math.min(1000, state.respect + d.respect);
    state.missionDirty = true;
    EB.hud.showToast("JOB COMPLETE  +$" + d.cash + "  ·  Respect +" + d.respect);
    if (EB.missions.index() >= 4) EB.combat.setWanted(0);
    var more = EB.missions.advance();
    if (!more) {
      EB.hud.showToast("THE EMBER CROWN IS YOURS — Ember Bay bows to its King.");
      EB.combat.setWanted(0);
    } else {
      var nd = EB.missions.def();
      if (nd.wanted) EB.combat.setWanted(nd.wanted);
    }
    state.missionIndex = EB.missions.index();
    autoSave();
  }

  function autoSave() {
    if (!state.started) return;
    EB.save.write({ cash: state.cash, respect: state.respect, missionIndex: EB.missions.index(), weapon: state.weapon, upgrades: state.upgrades, paint: state.paint, px: state.px, pz: state.pz, heading: state.heading, inCar: state.inCar, hp: state.hp });
  }

  function onBusted() {
    state.cash = Math.max(0, state.cash - 100);
    state.respect = Math.max(0, state.respect - 30);
    EB.combat.reset();
    EB.hud.showBusted(true);
    bustedUntil = time + 3;
    // respawn on foot at the garage
    exitCar();
    state.px = 40; state.pz = 120; state.heading = Math.PI / 2;
    state.hp = 100;
    setTimeout(function () { EB.hud.showBusted(false); }, 3000);
  }

  function nearestCar(maxD) {
    var best = null, bd = maxD;
    EB.vehicles.cars().forEach(function (c) {
      if (c === currentCar && state.inCar) return;
      var d = Math.hypot(c.x - state.px, c.z - state.pz);
      if (d < bd) { bd = d; best = c; }
    });
    return best;
  }

  function enterCar(car) {
    currentCar = car;
    EB.vehicles.setCurrentCar(car);
    state.inCar = true;
    state.inGT = car.kind === "gt";
    if (car.parked) car.parked = false;
    playerMesh.visible = false;
    EB.audio.blip(240, 0.1, "square", 0.25);
  }

  function exitCar() {
    if (!state.inCar || !currentCar) return;
    state.px = currentCar.x + Math.cos(currentCar.heading + Math.PI / 2) * 2.4;
    state.pz = currentCar.z - Math.sin(currentCar.heading + Math.PI / 2) * 2.4;
    state.heading = currentCar.heading;
    state.inCar = false; state.inGT = false;
    playerMesh.visible = true;
  }

  function carjack(car) {
    // pull the driver out: the traffic car becomes the player's
    var ti = EB.vehicles.trafficCars().indexOf(car);
    if (ti >= 0) EB.vehicles.trafficCars().splice(ti, 1);
    EB.people.flee(car.x, car.z, 18);
    EB.combat.addWanted(2);
    state.respect = Math.min(1000, state.respect + 5);
    EB.hud.showToast("CARJACKED — the heat is on you now");
    enterCar(car);
  }

  function buyUpgrade(id) {
    var g = C.GARAGE.filter(function (x) { return x.id === id; })[0];
    var lvl = state.upgrades[id] || 0;
    if (lvl >= 3) return;
    var cost = g.cost[lvl];
    if (state.cash < cost) { EB.hud.showToast("Not enough cash"); return; }
    state.cash -= cost;
    state.upgrades[id] = lvl + 1;
    if (id === "paint") {
      state.paint = (state.paint + 1) % C.PAINTS.length;
      var sky = EB.vehicles.skyline();
      if (sky) { sky.color = C.PAINTS[state.paint]; sky.group.children[0].material = new THREE.MeshPhongMaterial({ color: C.PAINTS[state.paint], shininess: 110, specular: 0x888888 }); }
      state.respect = Math.min(1000, state.respect + 15);
    }
    if (id === "engine" && currentCar) currentCar.maxSpeed = 38 * (1 + 0.12 * state.upgrades.engine);
    EB.audio.blip(880, 0.15, "sine", 0.3);
    EB.hud.refreshGarage();
    EB.hud.showToast(g.name + " LV" + (lvl + 1) + " installed");
    autoSave();
  }

  function startGame(fromSave) {
    var save = fromSave ? EB.save.read() : null;
    if (save) {
      state.cash = save.cash; state.respect = save.respect; state.weapon = save.weapon || 0;
      state.upgrades = save.upgrades || { engine: 0, armor: 0, paint: 0 };
      state.paint = save.paint || 0; state.hp = save.hp || 100;
      state.px = save.x; state.pz = save.z; state.heading = save.heading || 0;
      EB.missions.start(save.missionIndex || 0);
      state.inCar = !!save.inCar;
      if (state.inCar) { enterCar(currentCar); }
    } else {
      state.px = SPAWN.x; state.pz = SPAWN.z; state.heading = SPAWN.heading;
      EB.missions.start(0);
    }
    state.started = true;
    state.missionDirty = true;
    EB.hud.setStartVisible(false);
    EB.audio.ensure();
  }

  // ---- per-frame ----
  function update(dt) {
    var inp = EB.input;
    // global keys
    if (inp.wasPressed("KeyM") || inp.wasPressed("Escape")) {
      if (state.wheelOpen) { state.wheelOpen = false; EB.hud.setWheelOpen(false); }
      else if (state.garageOpen) { state.garageOpen = false; EB.hud.setGarageOpen(false); }
      else if (state.started) { state.mapOpen = !state.mapOpen; EB.hud.setMapOpen(state.mapOpen); }
    }
    if (inp.wasPressed("KeyQ") && state.started && !state.mapOpen && !state.garageOpen) {
      state.wheelOpen = !state.wheelOpen; EB.hud.setWheelOpen(state.wheelOpen);
      if (state.wheelOpen) EB.hud.refreshWheel();
    }
    if (inp.wasPressed("KeyG") && state.started && !state.mapOpen && !state.wheelOpen) {
      state.garageOpen = !state.garageOpen; EB.hud.setGarageOpen(state.garageOpen);
    }
    if (inp.wasPressed("KeyR") && state.started) state.radioLabel = EB.audio.cycle();
    if (inp.wasPressed("KeyN")) { state.muted = EB.audio.setMuted(!state.muted); EB.hud.showToast(state.muted ? "MUTED" : "SOUND ON"); }
    if (inp.wasPressed("KeyP") && state.started) { autoSave(); EB.hud.showToast("Game saved"); }
    if (state.wheelOpen) {
      for (var k = 0; k < 7; k++) {
        if (inp.wasPressed("Digit" + (k + 1))) {
          var w = C.WEAPONS[k];
          if (state.respect >= w.unlock) { state.weapon = k; EB.hud.refreshWheel(); EB.hud.refreshWeaponBar(); }
          else EB.hud.showToast(w.name + " unlocks at respect " + w.unlock);
        }
      }
    } else {
      for (var k2 = 0; k2 < 7; k2++) {
        if (inp.wasPressed("Digit" + (k2 + 1)) && state.respect >= C.WEAPONS[k2].unlock) state.weapon = k2;
      }
    }
    if (!state.started || state.mapOpen || state.garageOpen || state.wheelOpen) {
      // still render; world idles
      EB.vehicles.updateTraffic(dt * 0.3);
      return;
    }
    // camera drag
    dragYaw += inp.drag.dx * 0.004;
    dragYaw = Math.max(-0.6, Math.min(0.6, dragYaw));
    if (!inp.drag.active) dragYaw *= (1 - dt * 1.2);

    var near = nearestCar(8.5);
    state.nearCar = near;
    state.nearCarKind = near ? near.kind : null;

    if (inp.wasPressed("KeyE")) {
      if (state.inCar) exitCar();
      else if (near) {
        if (near.kind === "traffic" && !near.parked) carjack(near);
        else enterCar(near);
      }
    }
    if (inp.wasPressed("KeyF") && !state.inCar) {
      if (near && near.kind === "traffic" && !near.parked) carjack(near);
      else if (near) enterCar(near);
    }
    if (inp.wasPressed("Space") || inp.mouse.clicked) {
      EB.combat.shoot({ x: state.px, z: state.pz, heading: state.heading, inCar: state.inCar, car: currentCar });
    }

    if (state.inCar && currentCar) {
      var car = currentCar;
      var top = 38 * (1 + 0.12 * (state.upgrades.engine || 0));
      var thr = inp.throttle();
      if (thr > 0) car.speed = Math.min(top, car.speed + car.accel * dt);
      else if (thr < 0) {
        if (car.speed > 0.5) car.speed = Math.max(0, car.speed - 26 * dt);
        else car.speed = Math.max(-9, car.speed - 9 * dt);
      } else {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
      }
      var steer = inp.axis();
      var turnRate = 2.0 * Math.min(1, Math.abs(car.speed) / 13);
      car.heading += steer * turnRate * dt * (car.speed < 0 ? -1 : 1);
      car.x += Math.cos(car.heading) * car.speed * dt;
      car.z += -Math.sin(car.heading) * car.speed * dt;
      // sand drag + sea wall
      if (car.x > 205) car.speed *= (1 - dt * 0.8);
      if (car.x > 246) { car.x = 246; car.speed *= 0.4; }
      car.x = Math.max(-235, Math.min(320, car.x));
      car.z = Math.max(-235, Math.min(255, car.z));
      var before = { x: car.x, z: car.z };
      EB.world.collideCircle(car, 1.7);
      if (Math.hypot(car.x - before.x, car.z - before.z) > 0.01) car.speed *= 0.55;
      // bump traffic cars
      EB.vehicles.cars().forEach(function (o) {
        if (o === car) return;
        var d = Math.hypot(o.x - car.x, o.z - car.z);
        if (d < 3.4 && d > 0.01) {
          var push = (3.4 - d) / 2;
          var nx = (car.x - o.x) / d, nz = (car.z - o.z) / d;
          car.x += nx * push; car.z += nz * push;
          car.speed *= 0.85;
          if (o.kind === "traffic" && !o.parked) { o.speed = Math.max(0, o.speed - 4 * dt); }
        }
      });
      state.px = car.x; state.pz = car.z; state.heading = car.heading;
      state.speed = car.speed;
      EB.vehicles.sync(car);
    } else {
      // on foot
      var walk = 4.2 * (inp.down("ShiftLeft") || inp.down("ShiftRight") ? 1.8 : 1);
      var fwd = (inp.down("KeyW") || inp.down("ArrowUp") ? 1 : 0) - (inp.down("KeyS") || inp.down("ArrowDown") ? 1 : 0);
      var turn = (inp.down("KeyD") || inp.down("ArrowRight") ? 1 : 0) - (inp.down("KeyA") || inp.down("ArrowLeft") ? 1 : 0);
      state.heading -= turn * 2.4 * dt;
      state.px += Math.cos(state.heading) * fwd * walk * dt;
      state.pz += -Math.sin(state.heading) * fwd * walk * dt;
      if (state.px > 246) state.px = 246;
      state.px = Math.max(-235, Math.min(320, state.px));
      state.pz = Math.max(-235, Math.min(255, state.pz));
      EB.world.collideCircle(state, 0.6);
      var swing = Math.sin(time * 9) * (fwd !== 0 ? 0.5 : 0);
      playerMesh.userData.legL.rotation.x = swing;
      playerMesh.userData.legR.rotation.x = -swing;
      playerMesh.position.set(state.px, 0, state.pz);
      playerMesh.rotation.y = state.heading;
      playerMesh.visible = true;
      state.speed = fwd !== 0 ? walk : 0;
      // walking into the parked white car area keeps the prompt live
    }

    // world life
    EB.vehicles.updateTraffic(dt);
    EB.people.update(dt, time);
    EB.missions.update(dt, { x: state.px, z: state.pz, inCar: state.inCar, inGT: state.inGT, car: currentCar }, time);
    EB.vehicles.updatePolice(dt, state.px, state.pz, state.inCar);
    EB.combat.update(dt, { x: state.px, z: state.pz, heading: state.heading, inCar: state.inCar, car: currentCar });
    // smoke + boats drift
    EB.world.smokePuffs.forEach(function (p, i) {
      p.position.y += p.userData.drift * dt;
      p.position.x += Math.sin(time * 0.4 + i) * dt * 0.6;
      if (p.position.y > 150) p.position.y = 84;
    });
    EB.world.sailboats.forEach(function (b, i) {
      b.position.y = 0.1 + Math.sin(time * 0.8 + i * 2) * 0.25;
      b.rotation.z = Math.sin(time * 0.6 + i) * 0.04;
    });
    state.missionIndex = EB.missions.index();
  }

  function updateCamera(dt) {
    var cc = EB.shots.coverCam();
    if (cc) {
      if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
      camera.position.set(cc.pos[0], cc.pos[1], cc.pos[2]);
      camera.lookAt(cc.look[0], cc.look[1], cc.look[2]);
      return;
    }
    var target, dist, height, lookAhead;
    if (state.inCar && currentCar) {
      if (camera.fov !== 52) { camera.fov = 52; camera.updateProjectionMatrix(); }
      var cy = currentCar.heading + dragYaw;
      dist = 10.5; height = 3.6; lookAhead = 7;
      var bx = currentCar.x - Math.cos(cy) * dist, bz = currentCar.z + Math.sin(cy) * dist;
      camera.position.set(bx, height, bz);
      camera.lookAt(currentCar.x + Math.cos(currentCar.heading) * lookAhead, 2.2, currentCar.z - Math.sin(currentCar.heading) * lookAhead);
    } else if (state.started) {
      if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
      var py = state.heading + dragYaw;
      dist = 7; height = 3.5;
      camera.position.set(state.px - Math.cos(py) * dist, height, state.pz + Math.sin(py) * dist);
      camera.lookAt(state.px, 1.5, state.pz);
    } else {
      // attract orbit behind the start screen
      var a = time * 0.05;
      camera.position.set(120 + Math.cos(a) * 130, 95, 120 + Math.sin(a) * 130);
      camera.lookAt(-20, 10, -40);
    }
  }

  function loop() {
    requestAnimationFrame(loop);
    var now = performance.now();
    var dt = Math.min(0.05, (now - clock.last) / 1000);
    clock.last = now;
    time += dt;
    if (bustedUntil > 0 && time > bustedUntil) bustedUntil = 0;
    update(dt);
    updateCamera(dt);
    EB.hud.update(dt);
    renderer.render(scene, camera);
    EB.input.endFrame();
    if (EB.shots.isStaged()) {
      shotFrames++;
      if (shotFrames === 12) window.__shotReady = true;
    }
  }

  var game = {
    playerPos: function () { return { x: state.px, z: state.pz, heading: state.heading }; },
    warpPlayerOnFoot: function (x, z, heading) {
      if (state.inCar) exitCar();
      state.px = x; state.pz = z; state.heading = heading || 0;
      playerMesh.position.set(x, 0, z);
    },
    startGame: startGame,
    placePlayerInCar: function (x, z, heading, speed) {
      var car = EB.vehicles.skyline();
      car.x = x; car.z = z; car.heading = heading; car.speed = speed || 0;
      EB.vehicles.sync(car);
      currentCar = car; EB.vehicles.setCurrentCar(car);
      state.px = x; state.pz = z; state.heading = heading;
      state.inCar = true; state.inGT = false;
      playerMesh.visible = false;
    },
    placePlayerOnFoot: function (x, z, heading) {
      if (state.inCar) exitCar();
      state.px = x; state.pz = z; state.heading = heading;
      playerMesh.position.set(x, 0, z);
      playerMesh.visible = true;
    },
    setSpeed: function (v) { if (currentCar) currentCar.speed = v; state.speed = v; },
    speedMph: function () { return Math.abs(state.speed) * 2.237; },
    buyUpgrade: buyUpgrade,
    state: state
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
