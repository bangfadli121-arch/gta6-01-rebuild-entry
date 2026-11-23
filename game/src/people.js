// Ember Bay — people: pedestrians on the sidewalks and the police
// helicopter that circles the player at high wanted levels.
(function () {
  var EB = window.EB || (window.EB = {});
  var SKINS = [0xffd9b3, 0xc98d5f, 0x8a5a3b, 0xf2c89b];
  var SHIRTS = [0xff5f8f, 0x3fa7d6, 0xffd23f, 0x2fae6e, 0xf2e3c6, 0x9b5de5, 0xff8c42, 0xffffff];

  function makePersonMesh(shirt, skin) {
    var g = new THREE.Group();
    var body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32),
      new THREE.MeshLambertMaterial({ color: shirt }));
    body.position.y = 0.95; g.add(body);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshLambertMaterial({ color: skin }));
    head.position.y = 1.6; g.add(head);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x222233 });
    [-0.14, 0.14].forEach(function (x) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.55, 0.22), legMat);
      leg.position.set(x, 0.28, 0); g.add(leg);
    });
    return g;
  }

  EB.people = {
    walkers: [], heli: null, heliAngle: 0,

    spawnWalkers: function (scene, count) {
      for (var i = 0; i < count; i++) {
        var mesh = makePersonMesh(
          SHIRTS[Math.floor(Math.random() * SHIRTS.length)],
          SKINS[Math.floor(Math.random() * SKINS.length)]);
        scene.add(mesh);
        this.walkers.push({
          mesh: mesh,
          x: -140 + Math.random() * 280,
          z: -140 + Math.random() * 224,
          heading: Math.random() * Math.PI * 2,
          speed: 1 + Math.random() * 1.4,
          pause: 0,
          hp: 30
        });
      }
    },

    updateWalkers: function (dt) {
      for (var i = 0; i < this.walkers.length; i++) {
        var w = this.walkers[i];
        if (w.hp <= 0) continue;
        if (w.pause > 0) { w.pause -= dt; continue; }
        w.x += Math.sin(w.heading) * w.speed * dt;
        w.z += Math.cos(w.heading) * w.speed * dt;
        if (w.x < -145 || w.x > 145 || w.z < -145 || w.z > 92 || Math.random() < 0.002) {
          w.heading = Math.random() * Math.PI * 2;
          w.x = Math.max(-145, Math.min(145, w.x));
          w.z = Math.max(-145, Math.min(92, w.z));
          w.pause = 1 + Math.random() * 3;
        }
        w.mesh.position.set(w.x, 0, w.z);
        w.mesh.rotation.y = w.heading;
        w.mesh.position.y = Math.abs(Math.sin(EB.state.time * 6 + i)) * 0.06;
      }
    },

    spawnHeli: function (scene) {
      if (this.heli) return;
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5),
        new THREE.MeshLambertMaterial({ color: 0x1a2a4a }));
      g.add(body);
      var rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x222222 }));
      rotor.position.y = 1.1; g.add(rotor);
      g.userData.rotor = rotor;
      var light = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      light.position.set(0, -0.9, 1.5); g.add(light);
      g.userData.light = light;
      scene.add(g);
      this.heli = g;
    },

    removeHeli: function (scene) {
      if (!this.heli) return;
      scene.remove(this.heli); this.heli = null;
    },

    updateHeli: function (dt, px, pz) {
      if (!this.heli) return;
      this.heliAngle += dt * 0.35;
      var r = this.heliRadius || 26;
      var h = this.heliHeight || 34;
      this.heli.position.set(px + Math.cos(this.heliAngle) * r, h + Math.sin(EB.state.time * 0.7) * 2, pz + Math.sin(this.heliAngle) * r);
      this.heli.rotation.y = -this.heliAngle;
      this.heli.userData.rotor.rotation.y += dt * 22;
      this.heli.userData.light.material.color.setHex(Math.floor(EB.state.time * 2) % 2 ? 0xffffff : 0xff2222);
    },

    nearestWalker: function (x, z, maxD) {
      var best = null, bd = maxD;
      for (var i = 0; i < this.walkers.length; i++) {
        var w = this.walkers[i];
        if (w.hp <= 0) continue;
        var d = Math.hypot(w.x - x, w.z - z);
        if (d < bd) { bd = d; best = w; }
      }
      return best;
    }
  };
})();
