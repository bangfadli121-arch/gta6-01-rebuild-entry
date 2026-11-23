// Ember Bay — vehicles: the player car, traffic cars and carjacking.
// Cars are box-built with cabins, wheels and headlights; traffic follows
// the street grid and turns at intersections.
(function () {
  var EB = window.EB || (window.EB = {});
  var TRAFFIC_COLORS = [0xd83a3a, 0x3fa7d6, 0xf2e3c6, 0x2fae6e, 0xffd23f, 0x888899, 0xff8c42, 0x9b5de5];

  function makeCarMesh(color, isPolice) {
    var g = new THREE.Group();
    var bodyMat = new THREE.MeshLambertMaterial({ color: color });
    var glassMat = new THREE.MeshLambertMaterial({ color: 0x182233 });
    var body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
    body.position.y = 0.65; g.add(body);
    var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2), glassMat);
    cabin.position.set(0, 1.3, -0.2); g.add(cabin);
    var wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    var wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    g.userData.wheels = [];
    [[-1.05, 1.5], [1.05, 1.5], [-1.05, -1.5], [1.05, -1.5]].forEach(function (p) {
      var w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.42, p[1]);
      g.add(w); g.userData.wheels.push(w);
    });
    var lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    [-0.7, 0.7].forEach(function (x) {
      var l = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), lightMat);
      l.position.set(x, 0.7, 2.32); g.add(l);
    });
    if (isPolice) {
      var bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5),
        new THREE.MeshBasicMaterial({ color: 0x2255ff }));
      bar.position.set(0, 1.78, -0.2); g.add(bar);
      var bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.52),
        new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      bar2.position.set(0.4, 1.78, -0.2); g.add(bar2);
    }
    return g;
  }

  EB.vehicles = {
    player: null, traffic: [], police: [],
    heroColor: 0xff2e63,

    spawnPlayerCar: function (scene, x, z, heading) {
      var mesh = makeCarMesh(this.heroColor, false);
      mesh.position.set(x, 0, z); mesh.rotation.y = heading || 0;
      scene.add(mesh);
      this.player = {
        mesh: mesh, x: x, z: z, heading: heading || 0,
        speed: 0, maxSpeed: 34, nitro: 0, hp: 100
      };
      return this.player;
    },

    spawnTraffic: function (scene, count) {
      var C = EB.CONFIG;
      for (var i = 0; i < count; i++) {
        var color = TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
        var mesh = makeCarMesh(color, false);
        scene.add(mesh);
        var horizontal = i % 2 === 0;
        var street = -140 + Math.floor(Math.random() * 11) * C.streetGap;
        var t = {
          mesh: mesh, horizontal: horizontal,
          x: horizontal ? -140 + Math.random() * 280 : street,
          z: horizontal ? street : -140 + Math.random() * 224,
          dir: Math.random() < 0.5 ? 1 : -1,
          speed: 7 + Math.random() * 5,
          color: color
        };
        this.traffic.push(t);
      }
    },

    spawnPoliceCar: function (scene, x, z) {
      var mesh = makeCarMesh(0x1a1a22, true);
      mesh.position.set(x, 0, z); scene.add(mesh);
      var p = { mesh: mesh, x: x, z: z, heading: 0, speed: 0 };
      this.police.push(p);
      return p;
    },

    clearPolice: function (scene) {
      for (var i = 0; i < this.police.length; i++) scene.remove(this.police[i].mesh);
      this.police = [];
    },

    steerPlayer: function (dt, input) {
      var p = this.player;
      if (!p) return;
      var up = EB.state.upgrades;
      var accel = 16 + up.engine * 4;
      var top = p.maxSpeed + up.engine * 3;
      if (input.forward > 0) p.speed += accel * dt;
      else if (input.forward < 0) p.speed -= (p.speed > 0 ? 22 : 9) * dt;
      else p.speed -= Math.sign(p.speed) * 7 * dt;
      if (input.brake) p.speed -= Math.sign(p.speed) * 26 * dt;
      if (Math.abs(p.speed) < 0.15 && input.forward === 0) p.speed = 0;
      if (p.speed > top) p.speed = top;
      if (p.speed < -12) p.speed = -12;
      var steer = input.steer * (p.speed >= 0 ? 1 : -1);
      p.heading -= steer * 1.9 * dt * Math.min(1, Math.abs(p.speed) / 9);
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      // stay on the island
      if (p.x < -150) { p.x = -150; p.speed *= 0.5; }
      if (p.x > 150) { p.x = 150; p.speed *= 0.5; }
      if (p.z < -150) { p.z = -150; p.speed *= 0.5; }
      if (p.z > 122) { p.z = 122; p.speed *= 0.5; }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      var spin = p.speed * dt * 2.4;
      for (var i = 0; i < p.mesh.userData.wheels.length; i++) p.mesh.userData.wheels[i].rotation.x += spin;
      EB.state.speedMph = Math.abs(p.speed) * 2.2;
      if (EB.audio) EB.audio.setEngine(Math.abs(p.speed) / top, true);
    },

    updateTraffic: function (dt) {
      for (var i = 0; i < this.traffic.length; i++) {
        var t = this.traffic[i];
        if (t.horizontal) {
          t.x += t.dir * t.speed * dt;
          if (t.x > 140) { t.x = -140; t.z = -140 + Math.floor(Math.random() * 9) * 28; }
          if (t.x < -140) { t.x = 140; t.z = -140 + Math.floor(Math.random() * 9) * 28; }
          t.mesh.rotation.y = t.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          t.z += t.dir * t.speed * dt;
          if (t.z > 84) { t.z = -140; t.x = -140 + Math.floor(Math.random() * 11) * 28; }
          if (t.z < -140) { t.z = 84; t.x = -140 + Math.floor(Math.random() * 11) * 28; }
          t.mesh.rotation.y = t.dir > 0 ? Math.PI : 0;
        }
        t.mesh.position.set(t.x, 0, t.z);
      }
    },

    updatePolice: function (dt, playerX, playerZ) {
      for (var i = 0; i < this.police.length; i++) {
        var p = this.police[i];
        var dx = playerX - p.x, dz = playerZ - p.z;
        var d = Math.sqrt(dx * dx + dz * dz) || 1;
        var want = Math.atan2(dx, dz);
        var diff = want - p.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        p.speed = Math.min(30, p.speed + 12 * dt);
        if (d < 4) p.speed = 6;
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        p.mesh.position.set(p.x, 0, p.z);
        p.mesh.rotation.y = p.heading;
      }
    },

    nearestTraffic: function (x, z, maxD) {
      var best = null, bd = maxD;
      for (var i = 0; i < this.traffic.length; i++) {
        var t = this.traffic[i];
        var d = Math.hypot(t.x - x, t.z - z);
        if (d < bd) { bd = d; best = t; }
      }
      return best;
    },

    stealCar: function (scene, t) {
      // remove the traffic car from circulation, player takes its colour
      var idx = this.traffic.indexOf(t);
      if (idx >= 0) this.traffic.splice(idx, 1);
      scene.remove(t.mesh);
      this.heroColor = t.color;
      this.spawnPlayerCar(scene, t.x, t.z, t.mesh.rotation.y);
      EB.state.carsStolen++;
      EB.state.wanted = Math.min(EB.CONFIG.maxWanted, EB.state.wanted + 1);
      EB.setMessage('Car jacked! The cops are onto you.');
      return this.player;
    }
  };
})();
