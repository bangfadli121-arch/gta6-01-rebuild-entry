// EMBER BAY — Heat Line: combat.js
// One job: fighting. Four weapons on a wheel, hitscan shots with tracers
// and muzzle flash, gang enemies that shoot back, and the wanted heat
// that violence earns.
EB.combat = (function () {
  var tracers = [];
  var lastShotAt = 0;
  var flash = null;

  function makeFlash() {
    flash = new THREE.PointLight(0xffc861, 0, 18);
    EB.world.scene().add(flash);
  }

  function addTracer(from, to, color) {
    var geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color || 0xffe9a8, transparent: true, opacity: 0.95 }));
    EB.world.scene().add(line);
    tracers.push({ line: line, life: 0.12 });
  }

  // Hitscan from a point in a direction. Returns what was hit, if anything.
  function hitscan(from, dir, range, damage, isPlayer) {
    var best = null, bestD = range;
    // Enemies.
    EB.missions.enemies().forEach(function (e) {
      if (!e.alive) return;
      var toE = { x: e.x - from.x, z: e.z - from.z };
      var d = Math.sqrt(toE.x * toE.x + toE.z * toE.z);
      if (d > range || d < 0.5) return;
      var dot = (toE.x * dir.x + toE.z * dir.z) / d;
      if (dot > 0.985 && d < bestD) { bestD = d; best = { kind: "enemy", obj: e, d: d }; }
    });
    // Pedestrians (shooting one is a crime — wanted goes up).
    EB.people.list().forEach(function (p) {
      var toP = { x: p.x - from.x, z: p.z - from.z };
      var d = Math.sqrt(toP.x * toP.x + toP.z * toP.z);
      if (d > range || d < 0.5) return;
      var dot = (toP.x * dir.x + toP.z * dir.z) / d;
      if (dot > 0.985 && d < bestD) { bestD = d; best = { kind: "ped", obj: p, d: d }; }
    });
    // Traffic / police cars.
    EB.vehicles.cars().forEach(function (c) {
      var toC = { x: c.x - from.x, z: c.z - from.z };
      var d = Math.sqrt(toC.x * toC.x + toC.z * toC.z);
      if (d > range || d < 0.5) return;
      var dot = (toC.x * dir.x + toC.z * dir.z) / d;
      if (dot > 0.98 && d < bestD) { bestD = d; best = { kind: "car", obj: c, d: d }; }
    });
    var end = {
      x: from.x + dir.x * bestD,
      y: from.y,
      z: from.z + dir.z * bestD,
    };
    addTracer(from, end);
    if (!best) return null;
    if (best.kind === "enemy") {
      best.obj.hp -= damage;
      if (best.obj.hp <= 0) EB.missions.onEnemyKilled(best.obj);
      else EB.audio.beep();
    } else if (best.kind === "ped") {
      if (isPlayer) {
        EB.setWanted(EB.state.wanted + 1);
        EB.people.scatter(best.obj.x, best.obj.z, 40);
        EB.say("You shot a civilian — wanted up!");
      }
    } else if (best.kind === "car") {
      best.obj.hp -= damage;
      if (best.obj.isPolice && isPlayer) EB.setWanted(EB.state.wanted + 1);
    }
    return best;
  }

  function playerShoot() {
    var now = performance.now() / 1000;
    var w = EB.WEAPONS[EB.state.weapon];
    if (now - lastShotAt < 1 / w.rate) return;
    lastShotAt = now;
    if (w.name === "FISTS") {
      // A punch: short range, no tracer, no noise.
      var p = EB.game.playerPos();
      var h = EB.game.playerHeading();
      var dir = { x: Math.sin(h), z: Math.cos(h) };
      hitscan({ x: p.x, y: 1.2, z: p.z }, dir, w.range, w.damage, true);
      return;
    }
    var pos = EB.game.playerPos();
    var heading = EB.game.playerHeading();
    var spread = (Math.random() - 0.5) * 2 * w.spread;
    var dir2 = { x: Math.sin(heading + spread), z: Math.cos(heading + spread) };
    hitscan({ x: pos.x, y: 1.4, z: pos.z }, dir2, w.range, w.damage, true);
    if (flash) {
      flash.position.set(pos.x + dir2.x * 1.2, 1.5, pos.z + dir2.z * 1.2);
      flash.intensity = 90;
      setTimeout(function () { if (flash) flash.intensity = 0; }, 60);
    }
    EB.audio.shot();
    if (EB.state.wanted < 1 && EB.state.started) EB.setWanted(1);
  }

  return {
    init: function () { makeFlash(); },
    update: function (dt) {
      for (var i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        tracers[i].line.material.opacity = Math.max(0, tracers[i].life / 0.12);
        if (tracers[i].life <= 0) {
          EB.world.scene().remove(tracers[i].line);
          tracers.splice(i, 1);
        }
      }
      if (EB.input.pressed("KeyQ")) EB.hud.toggleWheel();
      var pick = EB.input.anyPressed(["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6", "Digit7"]);
      if (pick) this.selectWeapon(parseInt(pick.slice(-1), 10) - 1);
      if (EB.input.isMouseDown() && EB.state.started && !EB.state.paused && !EB.state.wheelOpen && !EB.state.garageOpen) {
        playerShoot();
      }
    },
    selectWeapon: function (i) {
      if (i < 0 || i >= EB.WEAPONS.length) return;
      // v10: locked weapons (BAT/SHOTGUN/SNIPER) refuse with a clear
      // message naming the rank that unlocks them.
      var w = EB.WEAPONS[i];
      if (EB.state.respect < (w.unlockRespect || 0)) {
        var rank = EB.RANKS[EB.util.rankFor(w.unlockRespect)].name;
        EB.say(w.name + " is LOCKED — reach " + rank + " (" + w.unlockRespect + " respect)");
        return;
      }
      EB.state.weapon = i;
      if (EB.hud) EB.hud.refreshWeapon();
      EB.say(EB.WEAPONS[i].name + " equipped");
    },
    // A gang member fires at the player: red tracer + sound + sometimes a hit.
    enemyShoot: function (x, y, z, tx, ty, tz) {
      addTracer({ x: x, y: y, z: z }, { x: tx, y: ty, z: tz }, 0xff4040);
      EB.audio.enemyShot();
    },
    shootNow: playerShoot,
  };
})();
