// EMBER BAY — people: pedestrians who live on the sidewalks.
// They travel along sidewalk lanes (a road line + side offset), so by
// construction they are never on asphalt. Gunshots or near-misses make
// them scatter; clampToSidewalk is the safety net.
(function () {
  var EB = window.EB || (window.EB = {});
  var scene = null, peds = [];
  var SHIRTS = [0xff6b6b, 0xffd75e, 0x2ec4b6, 0x7ec8e3, 0xffb3a7, 0x7ed957, 0xf2f2f2, 0x8a2be2, 0xff9a3c, 0x18b58a];
  var SKINS = [0xe8b98a, 0xc98a5e, 0x8a5a32, 0xf2c9a0];

  function makePedMesh(shirt, skin) {
    var g = new THREE.Group();
    var legMat = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
    var shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
    var skinMat = new THREE.MeshLambertMaterial({ color: skin });
    var legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.55, 0.2), legMat);
    legL.position.set(0, 0.28, 0.11); g.add(legL);
    var legR = legL.clone(); legR.position.z = -0.11; g.add(legR);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.55), shirtMat);
    torso.position.y = 0.86; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), skinMat);
    head.position.y = 1.38; g.add(head);
    g.userData.legL = legL; g.userData.legR = legR;
    return g;
  }

  function spawnPed() {
    var lines = [];
    for (var v = -200; v <= 200; v += 40) lines.push(v);
    var horizontal = Math.random() < 0.5;
    var L = lines[Math.floor(Math.random() * lines.length)];
    var side = Math.random() < 0.5 ? -1 : 1;
    var off = 6.5 + Math.random() * 1.5;
    // never use the outer sidewalk of an edge road (it is beach, not city)
    if (L === 200) side = -1;
    if (L === -200) side = 1;
    // spawn mid-block: at least 9 m from any crossing road, never on asphalt
    var along = 0;
    for (var tries = 0; tries < 20; tries++) {
      along = -195 + Math.random() * 390;
      var nl = Math.round((along + 200) / 40) * 40 - 200;
      if (Math.abs(along - nl) >= 9) break;
    }
    var dir = Math.random() < 0.5 ? 1 : -1;
    var shirt = SHIRTS[Math.floor(Math.random() * SHIRTS.length)];
    var skin = SKINS[Math.floor(Math.random() * SKINS.length)];
    var g = makePedMesh(shirt, skin);
    scene.add(g);
    var ped = {
      group: g, axis: horizontal ? "x" : "z", line: L, side: side, off: off,
      along: along, dir: dir, speed: 1.1 + Math.random() * 0.7,
      heading: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2),
      flee: 0, swing: Math.random() * 6.28, x: 0, z: 0
    };
    peds.push(ped);
    return ped;
  }

  function syncPed(ped) {
    if (ped.axis === "x") { ped.x = ped.along; ped.z = ped.line + ped.side * ped.off; }
    else { ped.x = ped.line + ped.side * ped.off; ped.z = ped.along; }
    ped.group.position.set(ped.x, 0, ped.z);
    ped.group.rotation.y = ped.heading;
  }

  function update(dt, time) {
    peds.forEach(function (ped) {
      var sp = ped.speed * (ped.flee > 0 ? 2.6 : 1);
      if (ped.flee > 0) ped.flee -= dt;
      ped.along += ped.dir * sp * dt;
      if (ped.along > 200) { ped.along = 200; ped.dir = -1; }
      if (ped.along < -200) { ped.along = -200; ped.dir = 1; }
      // at an intersection, ALWAYS turn onto the crossing road's near
      // sidewalk before the asphalt — never walk across a road.
      var nearest = Math.round((ped.along + 200) / 40) * 40 - 200;
      var distToLine = ped.along - nearest;
      var approaching = (ped.dir > 0 && distToLine < 0) || (ped.dir < 0 && distToLine > 0);
      if (approaching && Math.abs(distToLine) < 9) {
        var off = 6.5 + Math.random() * 1.5;
        var oldSide = ped.side;
        if (ped.axis === "x") {
          ped.axis = "z"; ped.line = nearest; ped.side = ped.dir > 0 ? -1 : 1; ped.off = off;
          if (nearest === 200) ped.side = -1;
          if (nearest === -200) ped.side = 1;
          ped.dir = oldSide; // walk away from the road just left, never turn back at once
          ped.heading = ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2;
          ped.along = ped.z;
        } else {
          ped.axis = "x"; ped.line = nearest; ped.side = ped.dir > 0 ? -1 : 1; ped.off = off;
          if (nearest === 200) ped.side = -1;
          if (nearest === -200) ped.side = 1;
          ped.dir = oldSide;
          ped.heading = ped.dir > 0 ? 0 : Math.PI;
          ped.along = ped.x;
        }
      }
      // keep heading in sync with axis/dir
      ped.heading = ped.axis === "x" ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
      syncPed(ped);
      // walk cycle
      ped.swing += dt * (ped.flee > 0 ? 11 : 6);
      var s = Math.sin(ped.swing) * 0.5;
      ped.group.userData.legL.rotation.x = s;
      ped.group.userData.legR.rotation.x = -s;
      ped.group.position.y = Math.abs(Math.sin(ped.swing)) * 0.05;
    });
  }

  function flee(x, z, radius) {
    peds.forEach(function (ped) {
      var d = Math.hypot(ped.x - x, ped.z - z);
      if (d < radius) {
        ped.flee = 2.5 + Math.random() * 2;
        // run away from the scare
        if (ped.axis === "x") ped.dir = ped.x >= x ? 1 : -1;
        else ped.dir = ped.z >= z ? 1 : -1;
      }
    });
  }

  function build(sc) {
    scene = sc;
    for (var i = 0; i < EB.config.PED_COUNT; i++) { var p = spawnPed(); syncPed(p); }
  }

  EB.people = {
    build: build, update: update, flee: flee,
    list: function () { return peds; },
    count: function () { return peds.length; }
  };
})();
