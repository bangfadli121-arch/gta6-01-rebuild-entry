// EMBER BAY — Heat Line: people.js
// One job: pedestrians. Thirty-six walkers with their own colours and
// routes along the sidewalks; they stroll, pause, and scatter when shots
// are fired or a car bears down on them. v6: denser crowds, skin-tone
// and hat variety, and spawnNear() so staged shots can put people
// exactly where the camera looks.
EB.people = (function () {
  var peds = [];
  var COUNT = 60; // v11: denser sidewalks (was 36) — fadli: kota harus padet
  var SHIRTS = [0xd94a4a, 0x2a6ad9, 0xd9a44a, 0x4ad97a, 0xe8e8e8, 0xff4ad9, 0x2a9a8a, 0x8a5a2a, 0xff6b3d, 0x7a5cff, 0x2ec4b6, 0xffd23e];
  var PANTS = [0x22252a, 0x3a4a6a, 0x6a5a3a, 0x4a2a3a];
  var SKINS = [0xd9a986, 0x8a5a3a, 0xf2c9a0, 0x6a3a22, 0xe8b88a];
  var HATS = [0xd94a4a, 0x2a6ad9, 0xffd23e, 0x22252a, 0x4ad97a];

  function makePedMesh(shirt, pants) {
    var g = new THREE.Group();
    var legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.24),
      new THREE.MeshLambertMaterial({ color: pants }));
    legs.position.y = 0.4; g.add(legs);
    var torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.3),
      new THREE.MeshLambertMaterial({ color: shirt }));
    torso.position.y = 1.11; g.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 10),
      new THREE.MeshLambertMaterial({ color: EB.util.pick(SKINS) }));
    head.position.y = 1.62; g.add(head);
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0x1c1410 }));
    hair.position.y = 1.66; g.add(hair);
    if (Math.random() < 0.35) {
      // Hat: a cap dome, or a wide-brim sun hat on the beach.
      if (Math.random() < 0.5) {
        var cap = new THREE.Mesh(new THREE.SphereGeometry(0.23, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          new THREE.MeshLambertMaterial({ color: EB.util.pick(HATS) }));
        cap.position.y = 1.68; g.add(cap);
      } else {
        var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 12),
          new THREE.MeshLambertMaterial({ color: EB.util.pick(HATS) }));
        brim.position.y = 1.74; g.add(brim);
        var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.14, 10),
          new THREE.MeshLambertMaterial({ color: EB.util.pick(HATS) }));
        crown.position.y = 1.8; g.add(crown);
      }
    }
    g.traverse(function (m) { if (m.isMesh) m.castShadow = true; });
    return g;
  }

  function spawnPedAt(x, z) {
    var mesh = makePedMesh(EB.util.pick(SHIRTS), EB.util.pick(PANTS));
    var ped = {
      mesh: mesh, x: x, z: z,
      heading: Math.random() * Math.PI * 2, speed: EB.util.rand(1.1, 2.2),
      pause: 0, flee: 0, bob: Math.random() * 6,
    };
    mesh.position.set(ped.x, 0, ped.z);
    mesh.rotation.y = ped.heading;
    EB.world.scene().add(mesh);
    peds.push(ped);
    return ped;
  }

  function spawnPed() {
    // v8: spawn on a sidewalk, never on the road (roadPoint() used to
    // put them on the asphalt centreline).
    var p = EB.world.sidewalkPoint();
    return spawnPedAt(p.x, p.z);
  }

  return {
    init: function () { for (var i = 0; i < COUNT; i++) spawnPed(); },
    list: function () { return peds; },
    // Staged shots: put `n` walkers on the sidewalk around (x, z).
    // v8: the old spread straddled the road (e.g. chase anchors x=184
    // and x=200 around the x=192 coastal road put walkers on the
    // asphalt between lanes) — clamp every staged walker to a sidewalk.
    spawnNear: function (x, z, n) {
      for (var i = 0; i < n; i++) {
        var px = x + EB.util.rand(-9, 9), pz = z + EB.util.rand(-14, 14);
        var cp = EB.world.clampToSidewalk(px, pz);
        spawnPedAt(cp.x, cp.z);
      }
    },
    // Everyone within radius runs away from (x, z).
    scatter: function (x, z, radius) {
      for (var i = 0; i < peds.length; i++) {
        var p = peds[i];
        if (EB.util.dist2(p.x, p.z, x, z) < radius) {
          p.flee = 3;
          p.heading = EB.util.angleTo(x, z, p.x, p.z);
        }
      }
    },
    update: function (dt) {
      var pp = EB.game.playerPos();
      var pc = EB.vehicles.playerCar();
      for (var i = 0; i < peds.length; i++) {
        var p = peds[i];
        p.bob += dt * 7;
        if (p.flee > 0) {
          p.flee -= dt;
          p.speed = 4.2;
        } else {
          p.speed = EB.util.lerp(p.speed, EB.util.rand(1.1, 2.0), 0.01);
          if (p.pause > 0) { p.pause -= dt; continue; }
          if (Math.random() < 0.004) { p.pause = EB.util.rand(1, 3); continue; }
          if (Math.random() < 0.01) p.heading += EB.util.rand(-1.2, 1.2);
        }
        // A fast car nearby also scares them off the road.
        if (pc && EB.util.dist2(p.x, p.z, pc.x, pc.z) < 6 && Math.abs(pc.speed) > 6) {
          p.flee = 2; p.heading = EB.util.angleTo(pc.x, pc.z, p.x, p.z);
        }
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        var pos = EB.world.collide(p.x, p.z, 0.5);
        p.x = pos.x; p.z = pos.z;
        // v8: never stand on asphalt — wandering and fleeing walkers
        // used to drift onto the road (collide() only knows buildings).
        // Push back onto the nearest sidewalk and turn along it instead
        // of grinding the curb.
        var cp = EB.world.clampToSidewalk(p.x, p.z);
        if (cp.x !== p.x || cp.z !== p.z) {
          p.x = cp.x; p.z = cp.z;
          p.heading += (Math.random() < 0.5 ? -1 : 1) * EB.util.rand(0.8, 1.6);
        }
        p.mesh.position.set(p.x, Math.abs(Math.sin(p.bob)) * 0.06, p.z);
        p.mesh.rotation.y = p.heading;
        // Keep them roughly near the player so the streets feel alive.
        if (EB.util.dist2(p.x, p.z, pp.x, pp.z) > 190) {
          p.x = pp.x + EB.util.rand(-60, 60); p.z = pp.z + EB.util.rand(-60, 60);
          // v8: the far respawn could also land on a road — clamp it too.
          var cp2 = EB.world.clampToSidewalk(p.x, p.z);
          p.x = cp2.x; p.z = cp2.z;
          p.mesh.position.set(p.x, Math.abs(Math.sin(p.bob)) * 0.06, p.z);
        }
      }
    },
  };
})();
