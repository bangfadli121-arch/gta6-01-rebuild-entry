// EMBER BAY — vehicles: hero Skyline (extruded side profile: sloped hood,
// raked glass, dome roof, sloped trunk — no 90-degree corners), rounded
// traffic cars, police cruisers and the Air One helicopter.
(function () {
  var EB = window.EB || (window.EB = {});
  var C = EB.config;
  var scene = null;
  var allCars = [], traffic = [], police = [], heli = null, heliSpot = null;
  var playerCarObj = null, parkedCar = null, gtCar = null, currentCarRef = null;

  function phong(color, shine) { return new THREE.MeshPhongMaterial({ color: color, shininess: shine || 70, specular: 0x888888 }); }
  function lam(color) { return new THREE.MeshLambertMaterial({ color: color }); }

  // Side silhouette of a car: x = length (-2.2 rear .. +2.2 front), y = height.
  function profileGeo(kind) {
    var s = new THREE.Shape();
    if (kind === "skyline" || kind === "gt") {
      s.moveTo(-2.2, 0.32); s.lineTo(-2.2, 0.92); s.lineTo(-1.72, 1.14); s.lineTo(-0.95, 1.30);
      s.lineTo(-0.1, 1.31); s.lineTo(0.55, 1.22); s.lineTo(1.05, 1.02); s.lineTo(1.85, 0.82);
      s.lineTo(2.2, 0.62); s.lineTo(2.2, 0.3); s.closePath();
    } else {
      s.moveTo(-2.05, 0.32); s.lineTo(-2.05, 0.85); s.lineTo(-1.5, 1.05); s.lineTo(-0.7, 1.18);
      s.lineTo(0.3, 1.16); s.lineTo(1.0, 0.95); s.lineTo(1.8, 0.75); s.lineTo(2.05, 0.58);
      s.lineTo(2.05, 0.3); s.closePath();
    }
    var g = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, steps: 1 });
    g.translate(0, 0, -0.95);
    return g;
  }

  function wheelMesh() {
    var w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.32, 14), lam(0x151515));
    w.rotation.x = Math.PI / 2;
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 10), lam(0xbbbbbb));
    hub.rotation.x = Math.PI / 2;
    var g = new THREE.Group(); g.add(w); g.add(hub);
    return g;
  }

  function buildCarMesh(kind, color) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(profileGeo(kind), phong(color, kind === "skyline" || kind === "gt" ? 110 : 55));
    g.add(body);
    // glass band (windshield + side glass + rear glass)
    var glass = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.34, 1.7), new THREE.MeshPhongMaterial({ color: 0x101c26, shininess: 140, specular: 0xaaaaaa }));
    glass.position.set(-0.1, 1.12, 0); glass.rotation.z = -0.06;
    g.add(glass);
    // wheels
    [[1.35, 1.0], [1.35, -1.0], [-1.35, 1.0], [-1.35, -1.0]].forEach(function (p) {
      var w = wheelMesh(); w.position.set(p[0], 0.4, p[1]); g.add(w);
    });
    if (kind === "skyline" || kind === "gt") {
      // fender bulges
      [[1.35, 1.0], [1.35, -1.0], [-1.35, 1.0], [-1.35, -1.0]].forEach(function (p) {
        var f = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), phong(color, 90));
        f.scale.set(1.15, 0.55, 0.5); f.position.set(p[0], 0.72, p[1] * 0.98); g.add(f);
      });
      // rounded bumpers
      var bf = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 1.95), phong(color, 90));
      bf.position.set(2.18, 0.5, 0); g.add(bf);
      var br = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 1.95), phong(color, 90));
      br.position.set(-2.18, 0.5, 0); g.add(br);
      // mirrors
      [[0.75, 1.06], [0.75, -1.06]].forEach(function (p) {
        var m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.14), lam(0x222222));
        m.position.set(p[0], 1.02, p[1]); g.add(m);
      });
      // twin white stripes over hood, roof, trunk
      [-0.35, 0.35].forEach(function (z) {
        var st = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.03, 0.28), lam(0xf5f5f5));
        st.position.set(0, 1.315, z); st.rotation.z = 0.0; g.add(st);
      });
      // white side skirts
      [1.02, -1.02].forEach(function (z) {
        var sk = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.16, 0.06), lam(0xf5f5f5));
        sk.position.set(0, 0.36, z); g.add(sk);
      });
      // GT spoiler
      var sp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 1.9), phong(color, 110));
      sp.position.set(-2.15, 1.28, 0); sp.rotation.z = 0.12; g.add(sp);
      [[-2.3, 0.7], [-2.3, -0.7]].forEach(function (p) {
        var sup = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), lam(0x222222));
        sup.position.set(p[0], 1.1, p[1]); g.add(sup);
      });
      // 4 round chrome-ring taillights, tilted ~25 deg onto the sloped tail
      [-0.62, -0.21, 0.21, 0.62].forEach(function (z) {
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16), lam(0xcccccc));
        ring.position.set(-2.24, 0.86, z); ring.rotation.y = Math.PI / 2; ring.rotation.x = 0.44; g.add(ring);
        var lamp = new THREE.Mesh(new THREE.CircleGeometry(0.11, 14), new THREE.MeshBasicMaterial({ color: 0xff2a22 }));
        lamp.position.set(-2.26, 0.86, z); lamp.rotation.y = -Math.PI / 2; lamp.rotation.x = 0.44; g.add(lamp);
      });
      // taillight bar glow
      var bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 1.7), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
      bar.position.set(-2.25, 1.02, 0); bar.rotation.z = 0.44; g.add(bar);
      // round headlights
      [-0.6, 0.6].forEach(function (z) {
        var hl = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
        hl.position.set(2.26, 0.68, z); hl.rotation.y = Math.PI / 2; g.add(hl);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 8, 16), lam(0xdddddd));
        ring.position.set(2.25, 0.68, z); ring.rotation.y = Math.PI / 2; g.add(ring);
      });
    } else {
      // simple rear + front lights
      var tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.5), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
      tl.position.set(-2.1, 0.7, 0); g.add(tl);
      var hd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.5), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
      hd.position.set(2.1, 0.62, 0); g.add(hd);
    }
    return g;
  }

  function makeCar(kind, color, x, z, heading) {
    var group = buildCarMesh(kind, color);
    group.position.set(x, 0, z);
    group.rotation.y = heading || 0;
    scene.add(group);
    var car = { kind: kind, color: color, group: group, x: x, z: z, heading: heading || 0, speed: 0, maxSpeed: 34, accel: 14, steer: 0, isPlayer: false, bustedTimer: 0, axis: "x", lane: 0, dir: 1, turnAt: 0 };
    allCars.push(car);
    return car;
  }

  function sync(car) { car.group.position.set(car.x, 0, car.z); car.group.rotation.y = car.heading; }

  function spawnTraffic() {
    var colors = [0xe8e8e8, 0xd81e2c, 0xf2a516, 0x2ec4b6, 0x7ec8e3, 0xffb3a7, 0x8a2be2, 0x18b58a, 0x333333, 0xffd75e];
    var lines = [];
    for (var v = -200; v <= 200; v += 40) lines.push(v);
    for (var i = 0; i < C.TRAFFIC_COUNT; i++) {
      var horizontal = Math.random() < 0.5;
      var L = lines[Math.floor(Math.random() * lines.length)];
      var along = -190 + Math.random() * 380;
      var dir = Math.random() < 0.5 ? 1 : -1;
      var laneOff = (Math.random() < 0.5 ? -1 : 1) * 2.2;
      var car;
      if (horizontal) car = makeCar("traffic", colors[i % colors.length], along, L + laneOff, dir > 0 ? 0 : Math.PI);
      else car = makeCar("traffic", colors[i % colors.length], L + laneOff, along, dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      car.axis = horizontal ? "x" : "z";
      car.lane = L; car.dir = dir; car.speed = 7 + Math.random() * 6;
      car.maxSpeed = 10 + Math.random() * 5;
      car.turnAt = Math.floor(Math.random() * 40) * 40 - 200;
      traffic.push(car);
    }
  }

  function updateTraffic(dt) {
    traffic.forEach(function (car) {
      var step = car.speed * dt;
      if (car.axis === "x") car.x += car.dir * step; else car.z += car.dir * step;
      // at an intersection, sometimes turn onto the crossing road
      var along = car.axis === "x" ? car.x : car.z;
      var nearest = Math.round((along + 200) / 40) * 40 - 200;
      if (Math.abs(along - nearest) < 1.5 && Math.random() < dt * 0.3) {
        var off = (Math.random() < 0.5 ? -1 : 1) * 2.2;
        if (car.axis === "x") {
          car.axis = "z"; car.dir = Math.random() < 0.5 ? 1 : -1;
          car.heading = car.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
          car.x = nearest + off;
        } else {
          car.axis = "x"; car.dir = Math.random() < 0.5 ? 1 : -1;
          car.heading = car.dir > 0 ? 0 : Math.PI;
          car.z = nearest + off;
        }
      }
      if (car.x > 205) car.x = -205; if (car.x < -205) car.x = 205;
      if (car.z > 205) car.z = -205; if (car.z < -205) car.z = 205;
      sync(car);
    });
  }

  function spawnPolice(n) {
    while (police.length < n) {
      var p = EB.game ? EB.game.playerPos() : { x: 0, z: 0 };
      var a = Math.random() * Math.PI * 2, d = 55 + Math.random() * 30;
      var car = makeCar("police", 0xf5f5f5, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, 0);
      // black doors + light bar
      var door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.06), lam(0x1a1a1a));
      door.position.set(0, 0.75, 1.0); car.group.add(door);
      var door2 = door.clone(); door2.position.z = -1.0; car.group.add(door2);
      var lb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 1.2), new THREE.MeshBasicMaterial({ color: 0x2255ff }));
      lb.position.set(-0.1, 1.45, 0); car.group.add(lb);
      var lb2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      lb2.position.set(-0.1, 1.45, 0.62); car.group.add(lb2);
      car.maxSpeed = 30; car.accel = 16;
      police.push(car);
    }
  }
  function despawnPolice() {
    police.forEach(function (c) { scene.remove(c.group); var i = allCars.indexOf(c); if (i >= 0) allCars.splice(i, 1); });
    police = [];
  }
  function despawnOne(car) {
    if (!car) return;
    scene.remove(car.group);
    var i = allCars.indexOf(car); if (i >= 0) allCars.splice(i, 1);
    var pi = police.indexOf(car); if (pi >= 0) police.splice(pi, 1);
    var ti = traffic.indexOf(car); if (ti >= 0) traffic.splice(ti, 1);
  }

  function updatePolice(dt, px, pz, playerInCar) {
    police.forEach(function (car) {
      var dx = px - car.x, dz = pz - car.z, dist = Math.hypot(dx, dz);
      var want = Math.atan2(-dz, dx);
      var diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      car.speed = Math.min(car.maxSpeed, car.speed + car.accel * dt);
      if (dist < 6) car.speed = Math.max(4, car.speed - 10 * dt);
      car.x += Math.cos(car.heading) * car.speed * dt;
      car.z += -Math.sin(car.heading) * car.speed * dt;
      var p = EB.world.collideCircle({ x: car.x, z: car.z }, 1.7);
      car.x = p.x; car.z = p.z;
      if (dist < 3.2) car.bustedTimer += dt; else car.bustedTimer = 0;
      sync(car);
    });
  }

  function buildHelicopter() {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 10), lam(0x1a2a3a));
    body.scale.set(1.6, 0.9, 1); g.add(body);
    var tail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.2, 5, 8), lam(0x1a2a3a));
    tail.rotation.z = Math.PI / 2; tail.position.set(-3.6, 0.4, 0); g.add(tail);
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), lam(0x222222));
    rotor.position.y = 2.1; g.add(rotor);
    var tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), lam(0x222222));
    tailRotor.position.set(-6, 0.6, 0); g.add(tailRotor);
    var skid1 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 0.12), lam(0x333333));
    skid1.position.set(0, -1.9, 0.9); g.add(skid1);
    var skid2 = skid1.clone(); skid2.position.z = -0.9; g.add(skid2);
    var glass = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshPhongMaterial({ color: 0x9ad1e0, shininess: 120, specular: 0xffffff }));
    glass.scale.set(1, 0.6, 0.9); glass.position.set(2.6, 0.2, 0); g.add(glass);
    var spot = new THREE.Mesh(new THREE.ConeGeometry(7, 40, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff6c8, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    spot.position.y = -21; g.add(spot);
    g.userData.rotor = rotor; g.userData.tailRotor = tailRotor; g.userData.spot = spot;
    scene.add(g);
    heli = g;
    return g;
  }

  function updateHeli(dt, px, pz, heading, t) {
    if (!heli) return;
    // hover ahead-above-right of the player so the chase camera sees it + its spotlight
    var fx = Math.cos(heading || 0), fz = -Math.sin(heading || 0);
    var rx = -fz, rz = fx; // right of the heading
    var a = t * 0.3;
    var bx = px + fx * 30 + rx * 8 + Math.cos(a) * 4, bz = pz + fz * 30 + rz * 8 + Math.sin(a) * 4;
    heli.position.set(bx, 14 + Math.sin(t * 0.5) * 1.5, bz);
    heli.rotation.y = -a;
    heli.userData.rotor.rotation.y += dt * 22;
    heli.userData.tailRotor.rotation.x += dt * 30;
  }

  function build(sc) {
    scene = sc;
    // hero skyline (player) — parked on the sidewalk by the spawn
    playerCarObj = makeCar("skyline", 0x1e56d8, 30, 152, Math.PI / 2);
    playerCarObj.isPlayer = true;
    playerCarObj.maxSpeed = 38;
    // white parked car for mission 1
    parkedCar = makeCar("traffic", 0xf5f5f5, 24, 168, Math.PI / 2);
    parkedCar.parked = true;
    // Ember GT (gold) for the finale
    gtCar = makeCar("gt", 0xf2a516, 168, 150, -Math.PI / 2);
    gtCar.parked = true;
    buildHelicopter();
    heli.visible = false;
    spawnTraffic();
  }

  EB.vehicles = {
    build: build, makeCar: makeCar, sync: sync, spawnTraffic: spawnTraffic, updateTraffic: updateTraffic,
    spawnPolice: spawnPolice, despawnPolice: despawnPolice, despawnOne: despawnOne, updatePolice: updatePolice,
    updateHeli: updateHeli,
    cars: function () { return allCars; },
    trafficCars: function () { return traffic; },
    policeCars: function () { return police; },
    playerCar: function () { return currentCarRef || playerCarObj; },
    skyline: function () { return playerCarObj; },
    setCurrentCar: function (c) { currentCarRef = c; },
    parkedCar: function () { return parkedCar; },
    gtCar: function () { return gtCar; },
    heli: function () { return heli; },
    setHeliVisible: function (v) { if (heli) heli.visible = v; }
  };
})();
