// Ember Bay — entry point: renderer, cameras, the player on foot and
// in the car, and the main loop that wires every system together.
(function () {
  var EB = window.EB || (window.EB = {});
  var scene, camera, renderer;
  var playerMesh = null;
  var onFoot = { x: -6, z: 84, heading: Math.PI / 2 };
  var camMode = 'chase';
  var frames = 0, lastNow = 0;

  EB.playerPos = { x: -6, z: 88, heading: Math.PI / 2 };

  function makePlayerMesh() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35),
      new THREE.MeshLambertMaterial({ color: 0xff2e63 }));
    body.position.y = 0.95; g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshLambertMaterial({ color: 0xffd9b3 }));
    head.position.y = 1.62; g.add(head);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x222233 });
    [-0.15, 0.15].forEach(function (x) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), legMat);
      leg.position.set(x, 0.28, 0); g.add(leg);
    });
    return g;
  }

  function collideBuildings(x, z, radius) {
    var blocks = EB.world.blocks;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var dx = x - b.x, dz = z - b.z;
      if (Math.abs(dx) < b.w / 2 + radius && Math.abs(dz) < b.d / 2 + radius) {
        var px = b.w / 2 + radius - Math.abs(dx);
        var pz = b.d / 2 + radius - Math.abs(dz);
        if (px < pz) x = b.x + (dx > 0 ? 1 : -1) * (b.w / 2 + radius);
        else z = b.z + (dz > 0 ? 1 : -1) * (b.d / 2 + radius);
      }
    }
    return { x: x, z: z };
  }

  function updateCamera() {
    if (camMode === 'cover') {
      // aerial three-quarter from above the beach, looking at city + volcano
      camera.position.set(-30 + Math.sin(EB.state.time * 0.03) * 3, 82, 182);
      camera.lookAt(0, -5, -30);
      return;
    }
    if (EB.state.inCar && EB.vehicles.player) {
      var p = EB.vehicles.player;
      var back = 11 + Math.abs(p.speed) * 0.12;
      camera.position.set(
        p.x - Math.sin(p.heading) * back,
        5.5 + Math.abs(p.speed) * 0.03,
        p.z - Math.cos(p.heading) * back);
      camera.lookAt(p.x + Math.sin(p.heading) * 8, 2, p.z + Math.cos(p.heading) * 8);
      return;
    }
    camera.position.set(
      onFoot.x - Math.sin(onFoot.heading) * 7, 4.2,
      onFoot.z - Math.cos(onFoot.heading) * 7);
    camera.lookAt(
      onFoot.x + Math.sin(onFoot.heading) * 6, 1.5,
      onFoot.z + Math.cos(onFoot.heading) * 6);
  }

  function handleKeys() {
    var inp = EB.input;
    if (inp.wasPressed('KeyE')) {
      if (EB.state.inCar) {
        var p = EB.vehicles.player;
        EB.state.inCar = false;
        onFoot.x = p.x + Math.cos(p.heading) * 2;
        onFoot.z = p.z - Math.sin(p.heading) * 2;
        onFoot.heading = p.heading;
        playerMesh.visible = true;
        EB.state.speedMph = 0;
        EB.setMessage('On foot. Press E near your car to get back in.');
      } else {
        var p2 = EB.vehicles.player;
        var d = Math.hypot(p2.x - onFoot.x, p2.z - onFoot.z);
        if (d < 5) {
          EB.state.inCar = true; playerMesh.visible = false;
          EB.setMessage('Back behind the wheel.');
        } else EB.setMessage('Too far from your car.');
      }
    }
    if (inp.wasPressed('KeyF') && !EB.state.inCar) {
      var t = EB.vehicles.nearestTraffic(onFoot.x, onFoot.z, 7);
      if (t) {
        EB.vehicles.stealCar(scene, t);
        EB.state.inCar = true; playerMesh.visible = false;
        if (EB.audio) EB.audio.crash();
      } else EB.setMessage('No car close enough to jack. Get closer to traffic.');
    }
    if (inp.wasPressed('KeyM')) { EB.state.missionKills = 0; EB.missions.start(scene); }
    if (inp.wasPressed('KeyR')) {
      EB.state.radioIndex = (EB.state.radioIndex + 1) % EB.CONFIG.radio.length;
      EB.setMessage('Radio: ' + EB.CONFIG.radio[EB.state.radioIndex].name);
    }
    if (inp.wasPressed('KeyV')) EB.state.radioOn = !EB.state.radioOn;
    if (inp.wasPressed('KeyG')) {
      var panel = document.getElementById('garage-panel');
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
      document.getElementById('garage-cash').textContent = '$' + EB.state.money;
    }
    if (inp.wasPressed('KeyP')) {
      EB.state.paused = !EB.state.paused;
      EB.setMessage(EB.state.paused ? 'Paused. Press P to resume.' : 'Resumed.');
    }
    for (var k = 0; k < 7; k++) {
      if (inp.wasPressed('Digit' + (k + 1))) EB.combat.selectWeapon(k);
    }
    if (inp.isMouseDown() && !EB.state.inCar && EB.state.started) {
      EB.combat.shoot(scene, camera, { x: onFoot.x, y: 0, z: onFoot.z });
    }
  }

  function loop(now) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
    lastNow = now;
    if (EB.state.paused) { renderer.render(scene, camera); return; }
    EB.state.time += dt;

    if (EB.state.started) {
      handleKeys();
      var inp = EB.input.axis();
      if (EB.shots.name && EB.state.inCar) {
        // screenshot mode: the hero car holds its composed pose while the
        // city, traffic and police keep moving around it
        var p = EB.vehicles.player;
        var disp = { cover: 0, drive: 42, chase: 58, mission: 35 }[EB.shots.name] || 0;
        p.speed = disp / 2.2;
        EB.state.speedMph = disp;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
        var spin = p.speed * dt * 2.4;
        for (var wi = 0; wi < p.mesh.userData.wheels.length; wi++) p.mesh.userData.wheels[wi].rotation.x += spin;
        EB.playerPos.x = p.x; EB.playerPos.z = p.z; EB.playerPos.heading = p.heading;
        if (EB.audio) EB.audio.setEngine(Math.abs(p.speed) / p.maxSpeed, true);
      } else if (EB.state.inCar) {
        var nitro = (EB.input.keys.ShiftLeft || EB.input.keys.ShiftRight) && EB.state.upgrades.nitro > 0;
        EB.vehicles.steerPlayer(dt, inp);
        if (nitro && EB.vehicles.player.speed > 10) EB.vehicles.player.speed += 14 * dt;
        var p = EB.vehicles.player;
        var hit = collideBuildings(p.x, p.z, 1.6);
        p.x = hit.x; p.z = hit.z;
        EB.playerPos.x = p.x; EB.playerPos.z = p.z; EB.playerPos.heading = p.heading;
      } else {
        var sp = 6;
        var mx = Math.sin(onFoot.heading) * inp.forward + Math.cos(onFoot.heading) * inp.steer;
        var mz = Math.cos(onFoot.heading) * inp.forward - Math.sin(onFoot.heading) * inp.steer;
        if (inp.forward !== 0 || inp.steer !== 0) onFoot.heading = Math.atan2(mx, mz);
        onFoot.x += mx * sp * dt; onFoot.z += mz * sp * dt;
        var hit2 = collideBuildings(onFoot.x, onFoot.z, 0.6);
        onFoot.x = hit2.x; onFoot.z = hit2.z;
        playerMesh.position.set(onFoot.x, 0, onFoot.z);
        playerMesh.rotation.y = onFoot.heading;
        EB.playerPos.x = onFoot.x; EB.playerPos.z = onFoot.z; EB.playerPos.heading = onFoot.heading;
        EB.state.speedMph = 0;
        if (EB.audio) EB.audio.setEngine(0, false);
      }
      EB.vehicles.updateTraffic(dt);
      EB.people.updateWalkers(dt);
      // in screenshot mode the police hold their composed positions so
      // they never drive between the camera and the hero car
      if (!EB.shots.name) EB.vehicles.updatePolice(dt, EB.playerPos.x, EB.playerPos.z);
      EB.people.updateHeli(dt, EB.playerPos.x, EB.playerPos.z);
      EB.combat.dispatch(scene, EB.playerPos.x, EB.playerPos.z);
      EB.combat.lowerWanted(dt);
      EB.missions.update(scene, dt, EB.playerPos.x, EB.playerPos.z);
    }

    EB.world.update(dt, EB.state.time);
    updateCamera();
    EB.hud.update();
    EB.hud.drawMinimap();
    renderer.render(scene, camera);
    frames++;
    if (frames === 5) window.__EB_READY__ = true;
  }

  EB.main = {
    setCameraMode: function (m) { camMode = m; },

    init: function () {
      scene = new THREE.Scene();
      EB.mainScene = scene;
      camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      document.getElementById('game-canvas').appendChild(renderer.domElement);

      EB.world.build(scene);
      EB.world.buildSky(scene);
      EB.world.addBillboards(scene);
      EB.vehicles.spawnPlayerCar(scene, -6, 88, Math.PI / 2);
      EB.vehicles.spawnTraffic(scene, 26);
      EB.people.spawnWalkers(scene, 42);
      playerMesh = makePlayerMesh();
      playerMesh.position.set(onFoot.x, 0, onFoot.z);
      playerMesh.visible = false;
      scene.add(playerMesh);
      EB.hud.build();

      var saved = EB.save.read();
      var startBtn = document.getElementById('start-btn');
      var contBtn = document.getElementById('continue-btn');
      if (saved) contBtn.style.display = 'inline-block';
      startBtn.addEventListener('click', function () { EB.main.startGame(false); });
      contBtn.addEventListener('click', function () { EB.main.startGame(true); });
      document.getElementById('garage-close').addEventListener('click', function () {
        document.getElementById('garage-panel').style.display = 'none';
      });
      document.querySelectorAll('#garage-panel button[data-up]').forEach(function (b) {
        b.addEventListener('click', function () { EB.main.buyUpgrade(b.getAttribute('data-up')); });
      });

      window.addEventListener('resize', function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });

      EB.missions.start(scene);
      var shot = EB.shots.read();
      if (shot) {
        document.getElementById('start-screen').style.display = 'none';
        EB.shots.apply(scene);
      }
      requestAnimationFrame(loop);
    },

    startGame: function (useSave) {
      if (useSave) EB.save.apply(EB.save.read());
      EB.state.started = true;
      EB.state.missionKills = 0;
      document.getElementById('start-screen').style.display = 'none';
      if (EB.audio) EB.audio.unlock();
      EB.missions.start(scene);
      EB.setMessage('Welcome to Ember Bay. Press M for your mission.');
    },

    buyUpgrade: function (kind) {
      var cost = { engine: 400, armor: 350, nitro: 300 }[kind];
      var up = EB.state.upgrades;
      if (up[kind] >= 3) { EB.setMessage(kind + ' is already maxed.'); return; }
      if (EB.state.money < cost) { EB.setMessage('Not enough cash for ' + kind + ' ($' + cost + ').'); return; }
      EB.state.money -= cost; up[kind]++;
      EB.setMessage(kind + ' upgraded to level ' + up[kind] + '.');
      if (EB.audio) EB.audio.blip(990, 0.15);
      EB.save.write();
    }
  };
})();
