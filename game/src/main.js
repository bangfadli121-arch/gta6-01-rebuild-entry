// EMBER BAY — Heat Line: main.js
// One job: run the game. Boots every module, owns the player (on foot and
// in a car), the chase camera, carjacking, wanted decay, pause, garage
// purchases and the main loop.
EB.game = (function () {
  var foot = null;          // player mesh on foot
  var footX = 24, footZ = 24, footHeading = 0, footSpeed = 0;
  var camYaw = 0, camDist = 10.5, camHeight = 3.6, camMode = "chase";
  var dragYaw = 0, dragPitch = 0;
  var hiddenTimer = 0;
  var clock = null;
  var startedAt = 0;

  function makeFootMesh() {
    var g = new THREE.Group();
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.8, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x2a3a5a }));
    legs.position.y = 0.4; g.add(legs);
    var jacket = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.62, 0.32),
      new THREE.MeshLambertMaterial({ color: 0xff6a1a }));
    jacket.position.y = 1.11; g.add(jacket);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10),
      new THREE.MeshLambertMaterial({ color: 0xd9a986 }));
    head.position.y = 1.62; g.add(head);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.23, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x14161c }));
    cap.position.y = 1.78; g.add(cap);
    g.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    g.position.set(footX, 0, footZ);
    EB.world.scene().add(g);
    return g;
  }

  function enterCar(car, jacked) {
    EB.vehicles.setPlayerCar(car);
    EB.state.inCar = true; EB.state.carId = car.id;
    foot.visible = false;
    if (jacked) {
      EB.state.carsStolen++;
      EB.setWanted(EB.state.wanted + 1);
      EB.say("Carjacked! The Bay PD is on you");
      EB.audio.siren(true);
    }
    EB.missions.onEnterCar(car);
  }

  function exitCar() {
    var car = EB.vehicles.playerCar();
    if (!car) return;
    EB.state.inCar = false;
    car.speed = 0;
    footX = car.x + Math.cos(car.heading) * 2.4;
    footZ = car.z - Math.sin(car.heading) * 2.4;
    footHeading = car.heading;
    foot.visible = true;
    foot.position.set(footX, 0, footZ);
    EB.vehicles.setPlayerCar(null);
    EB.state.carId = -1;
    EB.audio.engine(false, 0);
  }

  function tryEnterCar(jacked) {
    var p = { x: footX, z: footZ };
    // v10: wider enter radius (was 7 m) — the carjack prompt shows at
    // the same range, so the key you see is the key that works.
    var car = EB.vehicles.nearestCar(p.x, p.z, 8.5);
    if (!car) { EB.say("No car close enough"); return; }
    if (car.isPolice) { EB.say("That's a police car — bad idea"); return; }
    var isJack = jacked || car.isTraffic || (car.kind === "civilian" && !car.isFirstCar && !car.isEmberGT);
    if (car.isEmberGT) { EB.setWanted(EB.state.wanted + 2); EB.say("The Ember GT is yours — run!"); }
    enterCar(car, isJack);
  }

  function updateOnFoot(dt) {
    var axes = EB.input.moveAxes();
    var d = EB.input.mouseDelta();
    dragYaw -= d.x * 0.004; dragPitch = EB.util.clamp(dragPitch + d.y * 0.003, -0.4, 0.5);
    // Movement is relative to where the CAMERA looks (its world direction),
    // not to the player's facing: W must always walk away from the camera.
    var v = new THREE.Vector3();
    EB.world.camera().getWorldDirection(v);
    var fwdX = v.x, fwdZ = v.z;
    var fl = Math.hypot(fwdX, fwdZ) || 1;
    fwdX /= fl; fwdZ /= fl;
    var rightX = -fwdZ, rightZ = fwdX;
    var moveX = 0, moveZ = 0;
    if (axes.y !== 0 || axes.x !== 0) {
      moveX = fwdX * axes.y + rightX * axes.x;
      moveZ = fwdZ * axes.y + rightZ * axes.x;
      var len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len; moveZ /= len;
      footHeading = EB.util.angleLerp(footHeading, Math.atan2(moveX, moveZ), EB.util.clamp(12 * dt, 0, 1));
    }
    var sprint = EB.input.down("ShiftLeft") || EB.input.down("ShiftRight");
    var target = (axes.y !== 0 || axes.x !== 0) ? (sprint ? 9 : 5) : 0;
    footSpeed = EB.util.lerp(footSpeed, target, EB.util.clamp(10 * dt, 0, 1));
    footX += moveX * footSpeed * dt;
    footZ += moveZ * footSpeed * dt;
    var pos = EB.world.collide(footX, footZ, 0.6);
    footX = pos.x; footZ = pos.z;
    foot.position.set(footX, Math.abs(Math.sin(performance.now() / 130)) * 0.05 * (footSpeed / 9), footZ);
    foot.rotation.y = footHeading;
    EB.state.speedMph = 0;
    EB.state.playerX = footX; EB.state.playerZ = footZ; EB.state.playerHeading = footHeading;
    EB.audio.engine(false, 0);
  }

  function updateCamera(dt) {
    var target = this.playerPos();
    var heading = this.playerHeading();
    var cam = EB.world.camera();
    if (camMode === "aerial") {
      // v9 AERIAL (top 1-2 cover style): a high oblique camera south-
      // east of the player, looking north-west across the road into
      // the city — beach + palms in the foreground, the coastal road
      // and traffic in the midground, skyline + volcano behind. The
      // offset rides with the player so the hero car stays in frame
      // while it auto-drives; the look target sits well ahead of the
      // car so the city fills the frame, not the road behind it.
      // right = (-fz, fx); back = (-fx, -fz).
      var fx = Math.sin(heading), fz = Math.cos(heading);
      var ax = target.x - fz * 34 - fx * 40, az = target.z + fx * 34 - fz * 40;
      // v9: look 70 m ahead and 12 m up (was 55 m / 2 m) — tilted up
      // just enough that the volcano's crater + smoke fit in the top
      // of the frame while the hero car stays in the lower third.
      var lx = target.x + fx * 70, lz = target.z + fz * 70;
      var k = EB.util.clamp(6 * dt, 0, 1);
      cam.position.x = EB.util.lerp(cam.position.x, ax, k);
      cam.position.y = EB.util.lerp(cam.position.y, 48, k);
      cam.position.z = EB.util.lerp(cam.position.z, az, k);
      cam.lookAt(lx, 12, lz);
      camYaw = heading;
      return;
    }
    var behind = heading + Math.PI + dragYaw;
    var dist = camDist, height = camHeight + dragPitch * 4;
    var wantX = target.x + Math.sin(behind) * dist;
    var wantZ = target.z + Math.cos(behind) * dist;
    cam.position.x = EB.util.lerp(cam.position.x, wantX, EB.util.clamp(6 * dt, 0, 1));
    cam.position.y = EB.util.lerp(cam.position.y, height, EB.util.clamp(6 * dt, 0, 1));
    cam.position.z = EB.util.lerp(cam.position.z, wantZ, EB.util.clamp(6 * dt, 0, 1));
    // v10: the player sits in the LOWER centre of the frame (look
    // slightly above the player, not at the player's feet), and the
    // road runs long and straight ahead.
    cam.lookAt(target.x, 1.9, target.z);
    camYaw = behind;
    // v10: one mouse drag can NEVER flip the camera 180° — the drag
    // yaw is clamped to ±0.6 rad and snaps back fast when released,
    // so the third-person camera stays stable (Brisa Bay rule).
    dragYaw = EB.util.clamp(dragYaw, -0.6, 0.6);
    if (!EB.input.isMouseDown()) dragYaw = EB.util.lerp(dragYaw, 0, EB.util.clamp(2.5 * dt, 0, 1));
  }

  function updateWanted(dt) {
    if (EB.state.wanted <= 0) return;
    var p = this.playerPos();
    var near = false;
    EB.vehicles.cars().forEach(function (c) {
      if (c.isPolice && EB.util.dist2(p.x, p.z, c.x, c.z) < 55) near = true;
    });
    if (!near) {
      hiddenTimer += dt;
      if (hiddenTimer > 9) {
        EB.setWanted(EB.state.wanted - 1);
        hiddenTimer = 0;
        if (EB.state.wanted === 0) EB.say("You lost them — heat's off");
      }
    } else hiddenTimer = 0;
  }

  function updateKeys() {
    if (EB.input.pressed("Escape")) {
      if (EB.state.mapOpen) {
        EB.state.mapOpen = false;
        EB.state.paused = false;
        EB.hud.showMap(false);
      } else if (EB.state.garageOpen) EB.hud.toggleGarage(true);
      else if (EB.state.wheelOpen) EB.hud.toggleWheel(true);
      else {
        EB.state.paused = !EB.state.paused;
        EB.hud.showPause(EB.state.paused);
      }
    }
    if (EB.input.pressed("KeyP")) EB.save.save();
    // v10: M opens the pause MAP (city map + progression stats);
    // mute moved to N (M was undocumented mute, never in the HUD hints).
    if (EB.input.pressed("KeyM") && EB.state.started && !EB.state.garageOpen && !EB.state.wheelOpen) {
      EB.state.mapOpen = !EB.state.mapOpen;
      EB.state.paused = EB.state.mapOpen;
      EB.hud.showMap(EB.state.mapOpen);
    }
    if (EB.input.pressed("KeyN")) {
      var muted = EB.audio.toggleMute();
      EB.say(muted ? "Muted" : "Sound on");
    }
    if (EB.input.pressed("KeyR")) EB.audio.cycleStation();
    if (EB.input.pressed("KeyG")) {
      EB.hud.toggleGarage();
      EB.state.paused = EB.state.garageOpen;
      EB.hud.showPause(false);
    }
    if (EB.state.started && !EB.state.paused && !EB.state.garageOpen && !EB.state.wheelOpen) {
      if (EB.input.pressed("KeyE")) {
        if (EB.state.inCar) exitCar();
        else tryEnterCar(false);
      }
      if (EB.input.pressed("KeyF") && !EB.state.inCar) tryEnterCar(true);
    }
  }

  var api = {
    init: function () {
      var canvas = document.getElementById("scene");
      EB.world.init(canvas);
      EB.audio.init();
      EB.vehicles.init();
      EB.people.init();
      EB.missions.init();
      EB.combat.init();
      EB.hud.init();
      foot = makeFootMesh();
      clock = new THREE.Clock();
      window.EB.game = api;
      window.__game = api;
      // Screenshot staging (?shot=...) or the start screen.
      var shot = EB.shots.param();
      if (shot) {
        EB.shots.apply(shot);
      } else {
        EB.hud.showHud(false);
        EB.hud.showStart(true);
      }
      requestAnimationFrame(function (t) { api.loop(t); });
    },
    loop: function () {
      var dt = Math.min(clock.getDelta(), 0.05);
      // UI keys (Esc / G / P / M / R) are always processed, even while
      // paused — otherwise an open garage could never be closed again,
      // because the paused loop would stop reading keys entirely.
      if (EB.state.started) updateKeys();
      if (EB.state.started && !EB.state.paused) {
        EB.state.timePlayed += dt;
        if (EB.state.inCar) {
          EB.state.speedMph = EB.vehicles.drivePlayer(dt);
          var pc = EB.vehicles.playerCar();
          if (pc) { EB.state.playerX = pc.x; EB.state.playerZ = pc.z; EB.state.playerHeading = pc.heading; }
          var d = EB.input.mouseDelta();
          dragYaw -= d.x * 0.004; dragPitch = EB.util.clamp(dragPitch + d.y * 0.003, -0.4, 0.5);
        } else {
          updateOnFoot(dt);
        }
        EB.vehicles.update(dt);
        EB.people.update(dt);
        EB.missions.update(dt);
        EB.combat.update(dt);
        updateWanted.call(api, dt);
        // Slow health regen when the heat is off.
        if (EB.state.wanted === 0 && EB.state.health < 100) {
          EB.state.health = Math.min(100, EB.state.health + 3 * dt);
        }
        EB.hud.update(dt);
      } else {
        // Behind the start screen the city still lives a little.
        EB.vehicles.update(0);
      }
      updateCamera.call(api, dt);
      EB.world.renderer().render(EB.world.scene(), EB.world.camera());
      EB.input.endFrame();
      requestAnimationFrame(function () { api.loop(); });
    },
    playerPos: function () {
      if (EB.state.inCar && EB.vehicles.playerCar()) {
        var c = EB.vehicles.playerCar();
        return { x: c.x, z: c.z };
      }
      return { x: footX, z: footZ };
    },
    playerHeading: function () {
      if (EB.state.inCar && EB.vehicles.playerCar()) return EB.vehicles.playerCar().heading;
      return footHeading;
    },
    damagePlayer: function (n, src) {
      if (!EB.state.started || EB.state.paused) return;
      var reduction = 1 - Math.min(0.3, (EB.state.armorLevel - 1) * 0.1);
      EB.state.health -= n * reduction;
      if (EB.state.health <= 0) {
        EB.state.health = 0;
        EB.missions.fail(src === "gang" ? "THE RUST CREW GOT YOU" : "BUSTED");
      }
    },
    respawn: function () {
      if (EB.vehicles.playerCar()) EB.vehicles.setPlayerCar(null);
      EB.state.inCar = false; EB.state.carId = -1;
      footX = 0; footZ = 24; footHeading = 0;
      foot.visible = true;
      foot.position.set(footX, 0, footZ);
      EB.state.health = 100;
    },
    warpPlayerToCar: function (car, x, z, heading) {
      car.x = x; car.z = z; car.heading = heading; car.speed = 0;
      car.group.position.set(x, 0, z); car.group.rotation.y = heading;
      EB.vehicles.setPlayerCar(car);
      EB.state.inCar = true; EB.state.carId = car.id;
      foot.visible = false;
      EB.state.playerX = x; EB.state.playerZ = z; EB.state.playerHeading = heading;
    },
    warpPlayerOnFoot: function (x, z, heading) {
      if (EB.vehicles.playerCar()) EB.vehicles.setPlayerCar(null);
      EB.state.inCar = false;
      footX = x; footZ = z; footHeading = heading;
      foot.visible = true;
      foot.position.set(x, 0, z);
      EB.state.playerX = x; EB.state.playerZ = z; EB.state.playerHeading = heading;
    },
    setCameraMode: function (mode) {
      camMode = mode;
      if (mode === "cover") { camDist = 8.5; camHeight = 3.2; }
      else if (mode === "foot") { camDist = 7.5; camHeight = 3.2; }
      // v11: chase/drive camera a touch CLOSER (was 10.5/3.6) so the
      // hero car reads bigger in the frame — fadli wants the car to
      // read as a car, not a small box on the road.
      else { camDist = 9.2; camHeight = 3.3; }
      // Snap the camera behind the player so the first frame is framed.
      var p = this.playerPos();
      var behind = this.playerHeading() + Math.PI;
      var cam = EB.world.camera();
      if (mode === "aerial") {
        // v9: snap straight to the high oblique aerial position (see
        // updateCamera for the offset math) so the first frame is the
        // poster, not a low chase shot lerping upward.
        var h = this.playerHeading();
        var fx = Math.sin(h), fz = Math.cos(h);
        cam.position.set(p.x - fz * 34 - fx * 40, 48, p.z + fx * 34 - fz * 40);
        cam.lookAt(p.x + fx * 70, 12, p.z + fz * 70);
        return;
      }
      cam.position.set(p.x + Math.sin(behind) * camDist, camHeight, p.z + Math.cos(behind) * camDist);
      cam.lookAt(p.x, 1.6, p.z);
    },
    startNew: function () {
      EB.save.clear();
      EB.state.cash = 250; EB.state.respect = 0; EB.state.rankIndex = 0;
      EB.state.health = 100; EB.state.wanted = 0; EB.state.weapon = 0;
      EB.state.missionIndex = 0; EB.state.storyComplete = false;
      EB.state.missionDone = [false, false, false, false, false, false, false, false];
      EB.state.engineLevel = 1; EB.state.armorLevel = 1; EB.state.paintIndex = 0;
      EB.state.timePlayed = 0; EB.state.kills = 0; EB.state.carsStolen = 0;
      this.beginPlay();
      EB.missions.startFirst();
    },
    startContinue: function () {
      if (EB.save.load()) {
        this.beginPlay();
        if (EB.state.storyComplete) {
          EB.hud.setObjective("Free roam", "Story complete. Cruise Ember Bay, raise respect, lose the heat.");
        } else {
          EB.missions.start(EB.state.missionIndex);
        }
        EB.say("Welcome back, Kade");
      } else {
        this.startNew();
      }
    },
    beginPlay: function () {
      EB.audio.unlock();
      EB.audio.init();
      EB.hud.showStart(false);
      EB.hud.showHud(true);
      EB.state.started = true;
      EB.state.paused = false;
      startedAt = performance.now();
      this.warpPlayerOnFoot(EB.state.playerX || 24, EB.state.playerZ || 24, EB.state.playerHeading || 0);
      EB.hud.refreshWanted(); EB.hud.refreshWeapon(); EB.hud.refreshRadio();
    },
    buyUpgrade: function (kind) {
      if (kind === "engine") {
        if (EB.state.engineLevel >= 4) { EB.say("Engine is maxed"); return; }
        var ec = 800 * EB.state.engineLevel;
        if (EB.state.cash < ec) { EB.say("Not enough cash for the engine"); return; }
        EB.state.cash -= ec; EB.state.engineLevel++;
        EB.say("Engine Lv " + EB.state.engineLevel + " installed");
      } else if (kind === "armor") {
        if (EB.state.armorLevel >= 4) { EB.say("Armor is maxed"); return; }
        var ac = 600 * EB.state.armorLevel;
        if (EB.state.cash < ac) { EB.say("Not enough cash for armor"); return; }
        EB.state.cash -= ac; EB.state.armorLevel++;
        EB.say("Armor Lv " + EB.state.armorLevel + " installed");
      } else if (kind === "paint") {
        if (EB.state.cash < 300) { EB.say("Not enough cash for paint"); return; }
        EB.state.cash -= 300;
        EB.state.paintIndex = (EB.state.paintIndex + 1) % EB.PAINTS.length;
        var car = EB.vehicles.playerCar();
        if (car) {
          car.group.children.forEach(function (m) {
            if (m.isMesh && m.material && m.material.color && m.geometry && m.geometry.type === "BoxGeometry") {
              m.material.color.setHex(EB.PAINT_HEX[EB.state.paintIndex]);
            }
          });
        }
        EB.say("Repainted: " + EB.PAINTS[EB.state.paintIndex]);
      }
      EB.audio.cash();
      EB.hud.refreshGarage();
    },
    footMesh: function () { return foot; },
    // v10: the chase camera's yaw, so the minimap's compass N can
    // rotate with the camera instead of sitting fixed at the top.
    cameraYaw: function () { return camYaw; },
    startedAtMs: function () { return startedAt; },
  };
  return api;
})();

window.addEventListener("DOMContentLoaded", function () {
  try {
    EB.game.init();
  } catch (err) {
    window.__gameError = String(err && err.stack || err);
    document.body.insertAdjacentHTML("beforeend",
      '<pre id="boot-error" style="position:fixed;inset:auto 0 0 0;background:#400;color:#fff;padding:8px;z-index:99">' +
      String(err && err.stack || err) + "</pre>");
  }
});
