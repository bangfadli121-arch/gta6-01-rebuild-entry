// Ember Bay — combat, wanted level and the police response.
// Shooting is a raycast from the camera; the wanted level drives how
// many police cars chase, when roadblocks appear and when the
// helicopter shows up.
(function () {
  var EB = window.EB || (window.EB = {});

  EB.combat = {
    lastShot: 0, roadblocks: [], sirenAt: 0,

    selectWeapon: function (i) {
      if (i < 0 || i >= EB.CONFIG.weapons.length) return;
      EB.state.weaponIndex = i;
      EB.setMessage(EB.CONFIG.weapons[i].name + ' ready');
    },

    shoot: function (scene, camera, playerPos) {
      var now = EB.state.time;
      var w = EB.CONFIG.weapons[EB.state.weaponIndex];
      if (now - this.lastShot < w.rate) return false;
      if (EB.state.ammo[EB.state.weaponIndex] <= 0 && EB.state.ammo[EB.state.weaponIndex] !== Infinity) {
        EB.setMessage('Out of ammo — grab a new weapon (press 1-7 to switch)');
        return false;
      }
      this.lastShot = now;
      if (EB.state.ammo[EB.state.weaponIndex] !== Infinity) EB.state.ammo[EB.state.weaponIndex]--;
      if (EB.audio) EB.audio.shot();
      // flash line from the player toward the aim point
      var dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      var origin = new THREE.Vector3(playerPos.x, playerPos.y + 1.4, playerPos.z);
      var end = origin.clone().add(dir.multiplyScalar(w.range));
      this.flash(scene, origin, end);
      var hit = this.rayHit(origin, dir, w.range);
      if (hit) this.applyHit(scene, hit, w);
      else if (EB.state.wanted < 1 && Math.random() < 0.25) this.raiseWanted(1);
      return true;
    },

    flash: function (scene, a, b) {
      var geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
      scene.add(line);
      setTimeout(function () { scene.remove(line); }, 70);
    },

    rayHit: function (origin, dir, range) {
      // nearest walker / police / traffic car along the ray
      var best = null, bd = range;
      function test(x, z, y, radius, kind, ref) {
        var dx = x - origin.x, dz = z - origin.z;
        var along = dx * dir.x + dz * dir.z;
        if (along < 0 || along > bd) return;
        var px = origin.x + dir.x * along, pz = origin.z + dir.z * along;
        var perp = Math.hypot(px - x, pz - z);
        if (perp < radius + 0.6) { bd = along; best = { kind: kind, ref: ref, dist: along }; }
      }
      for (var i = 0; i < EB.people.walkers.length; i++) {
        var w = EB.people.walkers[i];
        if (w.hp > 0) test(w.x, w.z, 1, 0.6, 'walker', w);
      }
      for (var j = 0; j < EB.vehicles.police.length; j++) {
        var p = EB.vehicles.police[j];
        test(p.x, p.z, 1, 2.2, 'police', p);
      }
      for (var k = 0; k < EB.vehicles.traffic.length; k++) {
        var t = EB.vehicles.traffic[k];
        test(t.x, t.z, 1, 2.2, 'traffic', t);
      }
      return best;
    },

    applyHit: function (scene, hit, w) {
      if (hit.kind === 'walker') {
        hit.ref.hp -= w.damage;
        if (hit.ref.hp <= 0) {
          hit.ref.mesh.visible = false;
          EB.state.kills++;
          EB.state.missionKills = (EB.state.missionKills || 0) + 1;
          this.raiseWanted(1);
          EB.setMessage('Target down.');
        }
      } else if (hit.kind === 'police') {
        EB.state.kills++;
        EB.state.missionKills = (EB.state.missionKills || 0) + 1;
        this.raiseWanted(1);
        EB.setMessage('Cop down! Wanted level rising.');
      } else if (hit.kind === 'traffic') {
        this.raiseWanted(1);
        if (EB.audio) EB.audio.crash();
        EB.setMessage('You shot up a car. Witnesses called the cops.');
      }
    },

    raiseWanted: function (n) {
      EB.state.wanted = Math.min(EB.CONFIG.maxWanted, EB.state.wanted + n);
      if (EB.state.wanted >= 3) EB.setMessage('Wanted level ' + EB.state.wanted + ' — helicopter inbound!');
    },

    lowerWanted: function (dt) {
      if (EB.state.wanted > 0) {
        EB.state.wantedTimer = (EB.state.wantedTimer || 0) + dt;
        if (EB.state.wantedTimer > 25) {
          EB.state.wanted--; EB.state.wantedTimer = 0;
          EB.setMessage('Heat cooling off. Wanted level ' + EB.state.wanted);
        }
      }
    },

    dispatch: function (scene, px, pz) {
      var want = EB.state.wanted;
      var have = EB.vehicles.police.length;
      var need = want === 0 ? 0 : want === 1 ? 1 : want === 2 ? 2 : want === 3 ? 3 : 4;
      if (have < need) {
        var a = Math.random() * Math.PI * 2;
        EB.vehicles.spawnPoliceCar(scene, px + Math.cos(a) * 60, pz + Math.sin(a) * 60);
        if (EB.audio && EB.state.time - this.sirenAt > 4) { EB.audio.siren(); this.sirenAt = EB.state.time; }
      }
      if (want === 0 && have > 0) EB.vehicles.clearPolice(scene);
      if (want >= 3) EB.people.spawnHeli(scene);
      else EB.people.removeHeli(scene);
      this.updateRoadblocks(scene, px, pz, want);
    },

    updateRoadblocks: function (scene, px, pz, want) {
      var need = want >= 3 ? 2 : want >= 4 ? 3 : 0;
      while (this.roadblocks.length < need) {
        var a = Math.random() * Math.PI * 2;
        var grp = new THREE.Group();
        for (var i = -1; i <= 1; i++) {
          var car = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 4.4),
            new THREE.MeshLambertMaterial({ color: 0x1a1a22 }));
          car.position.set(i * 3.2, 0.6, 0); grp.add(car);
          var cone = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8),
            new THREE.MeshLambertMaterial({ color: 0xff6a00 }));
          cone.position.set(i * 3.2, 0.55, 3); grp.add(cone);
        }
        grp.position.set(px + Math.cos(a) * 45, 0, pz + Math.sin(a) * 45);
        grp.rotation.y = a;
        scene.add(grp);
        this.roadblocks.push(grp);
      }
      while (this.roadblocks.length > need) {
        var old = this.roadblocks.pop();
        scene.remove(old);
      }
    },

    playerHit: function (dmg) {
      var armor = EB.state.upgrades.armor;
      EB.state.hp -= Math.max(1, dmg - armor * 2);
      if (EB.state.hp <= 0) {
        EB.state.hp = 0;
        EB.setMessage('Wasted! You wake up at the hospital, -$200.');
        EB.state.money = Math.max(0, EB.state.money - 200);
        EB.state.wanted = 0;
        EB.state.hp = 100;
        if (EB.missions) EB.missions.failMission(EB.mainScene);
      }
    }
  };
})();
