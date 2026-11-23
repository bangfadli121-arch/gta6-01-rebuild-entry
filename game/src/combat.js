// EMBER BAY — combat: 7 weapons, tracers + muzzle flash, the wanted
// system (1-5), police chase, roadblocks at 3 stars, Air One at 4, busts.
(function () {
  var EB = window.EB || (window.EB = {});
  var C = EB.config;
  var scene = null, camera = null;
  var wanted = 0, crimeTimer = 0, lastShot = 0, roadblock = null;
  var tracers = [], onBusted = null, onWantedChange = null;

  function build(sc, cam) { scene = sc; camera = cam; }

  function aimDir(ctx) {
    if (ctx.inCar && ctx.car) return { x: Math.cos(ctx.car.heading), z: -Math.sin(ctx.car.heading) };
    return { x: Math.cos(ctx.heading), z: -Math.sin(ctx.heading) };
  }

  function spawnTracer(from, to) {
    var geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z)]);
    var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 }));
    scene.add(line);
    tracers.push({ line: line, t: 0.09 });
  }

  function muzzle(pos) {
    var f = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffdf6b, transparent: true, opacity: 0.95 }));
    f.position.set(pos.x, pos.y, pos.z);
    scene.add(f);
    tracers.push({ line: f, t: 0.06, flash: true });
  }

  function shoot(ctx) {
    var now = performance.now() / 1000;
    var w = C.WEAPONS[EB.state.weapon];
    if (now - lastShot < 1 / w.rate) return false;
    lastShot = now;
    var origin = { x: ctx.x, y: ctx.inCar ? 1.4 : 1.5, z: ctx.z };
    var dir = aimDir(ctx);
    muzzle(origin);
    var range = w.range;
    var end = { x: origin.x + dir.x * range, y: origin.y, z: origin.z + dir.z * range };
    var hit = null, hitDist = range;
    // nearest entity inside a narrow cone in front
    function consider(tx, tz, radius, obj) {
      var dx = tx - origin.x, dz = tz - origin.z, d = Math.hypot(dx, dz);
      if (d > range || d < 0.5) return;
      var dot = (dx * dir.x + dz * dir.z) / d;
      var spread = radius / Math.max(d, 1) + 0.02;
      if (dot > 1 - spread && d < hitDist) { hit = obj; hitDist = d; }
    }
    EB.vehicles.policeCars().forEach(function (c) { consider(c.x, c.z, 2.2, { type: "police", car: c }); });
    EB.vehicles.trafficCars().forEach(function (c) { if (!c.parked) consider(c.x, c.z, 2.0, { type: "traffic", car: c }); });
    EB.people.list().forEach(function (p) { consider(p.x, p.z, 0.8, { type: "ped", ped: p }); });
    if (hit) {
      end = { x: origin.x + dir.x * hitDist, y: origin.y, z: origin.z + dir.z * hitDist };
      if (hit.type === "police") {
        hit.car.hp = (hit.car.hp || 100) - w.dmg;
        if (hit.car.hp <= 0) {
          explode(hit.car.x, hit.car.z);
          EB.vehicles.despawnOne(hit.car);
          EB.state.respect = Math.min(1000, EB.state.respect + 15);
          addWanted(1);
        }
      } else if (hit.type === "traffic") {
        addWanted(1);
        EB.people.flee(hit.car.x, hit.car.z, 20);
      } else if (hit.type === "ped") {
        EB.people.flee(hit.ped.x, hit.ped.z, 25);
        addWanted(1);
      }
    } else {
      EB.people.flee(origin.x + dir.x * 10, origin.z + dir.z * 10, 14);
    }
    spawnTracer(origin, end);
    if (w.name === "FISTS" || w.name === "BAT") EB.audio.blip(180, 0.06, "square", 0.2);
    else EB.audio.blip(w.name === "SHOTGUN" ? 120 : 320, 0.07, "square", 0.28);
    crimeTimer = 0;
    return true;
  }

  function explode(x, z) {
    for (var i = 0; i < 5; i++) {
      var s = new THREE.Mesh(new THREE.SphereGeometry(1 + Math.random(), 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff6a1e : 0xffd75e, transparent: true, opacity: 0.85 }));
      s.position.set(x + (Math.random() - 0.5) * 3, 1 + Math.random() * 2, z + (Math.random() - 0.5) * 3);
      scene.add(s);
      tracers.push({ line: s, t: 0.5, flash: true, grow: true });
    }
    EB.audio.blip(70, 0.4, "sawtooth", 0.4);
  }

  function addWanted(n) {
    var before = wanted;
    wanted = Math.max(0, Math.min(5, wanted + n));
    crimeTimer = 0;
    if (wanted !== before && onWantedChange) onWantedChange(wanted);
  }
  function setWanted(n) {
    wanted = Math.max(0, Math.min(5, n));
    crimeTimer = 0;
    if (onWantedChange) onWantedChange(wanted);
  }

  function ensurePolice() {
    var want = wanted;
    var have = EB.vehicles.policeCars().length;
    if (have < want) EB.vehicles.spawnPolice(want - have);
    if (have > want) {
      var list = EB.vehicles.policeCars();
      for (var i = list.length - 1; i >= want; i--) EB.vehicles.despawnOne(list[i]);
    }
  }

  function ensureRoadblock(ctx) {
    if (wanted >= 3 && !roadblock) {
      var ahead = 38;
      var rx = ctx.x + Math.cos(ctx.heading) * ahead, rz = ctx.z - Math.sin(ctx.heading) * ahead;
      var cars = [];
      [-3.2, 3.2].forEach(function (off) {
        var perp = ctx.heading + Math.PI / 2;
        var c = EB.vehicles.makeCar("police", 0xf5f5f5, rx + Math.cos(perp) * off, rz - Math.sin(perp) * off, ctx.heading + Math.PI / 2);
        c.roadblock = true; c.speed = 0;
        cars.push(c);
      });
      roadblock = cars;
    } else if (wanted < 3 && roadblock) {
      roadblock.forEach(function (c) { EB.vehicles.despawnOne(c); });
      roadblock = null;
    }
  }

  function update(dt, ctx) {
    // tracers fade
    for (var i = tracers.length - 1; i >= 0; i--) {
      var tr = tracers[i];
      tr.t -= dt;
      if (tr.flash) tr.line.material.opacity = Math.max(0, tr.t * 10);
      if (tr.grow) tr.line.scale.multiplyScalar(1 + dt * 3);
      if (tr.t <= 0) { scene.remove(tr.line); if (tr.line.geometry) tr.line.geometry.dispose(); tracers.splice(i, 1); }
    }
    // wanted decay when quiet
    crimeTimer += dt;
    if (wanted > 0 && crimeTimer > 25) { setWanted(wanted - 1); crimeTimer = 0; }
    ensurePolice();
    ensureRoadblock(ctx);
    // helicopter at 4+
    EB.vehicles.setHeliVisible(wanted >= 4);
    if (wanted >= 4) EB.vehicles.updateHeli(dt, ctx.x, ctx.z, ctx.heading, performance.now() / 1000);
    // busted?
    var busted = false;
    EB.vehicles.policeCars().forEach(function (c) {
      var d = Math.hypot(c.x - ctx.x, c.z - ctx.z);
      if (d < 3.4 && c.bustedTimer > 2) busted = true;
    });
    if (busted && onBusted) onBusted();
  }

  function reset() {
    wanted = 0; crimeTimer = 0;
    EB.vehicles.despawnPolice();
    if (roadblock) { roadblock.forEach(function (c) { EB.vehicles.despawnOne(c); }); roadblock = null; }
    EB.vehicles.setHeliVisible(false);
  }

  EB.combat = {
    build: build, shoot: shoot, update: update, reset: reset,
    addWanted: addWanted, setWanted: setWanted,
    wanted: function () { return wanted; },
    setOnBusted: function (fn) { onBusted = fn; },
    setOnWantedChange: function (fn) { onWantedChange = fn; }
  };
})();
