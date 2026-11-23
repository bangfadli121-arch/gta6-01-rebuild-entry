// Ember Bay — the 8 story missions. Each mission is a list of steps
// (drive to a point, race checkpoints, lose the cops, shoot guards,
// beat a timer). The marker beacon and the HUD objective follow the
// current step; finishing a mission pays cash and respect.
(function () {
  var EB = window.EB || (window.EB = {});

  // step targets are [x, z] on the island map
  function missionSteps(id) {
    switch (id) {
      case 1: return [
        { type: 'goto', x: -34, z: 88, text: 'Drive to the Neon Row billboard' },
        { type: 'goto', x: 58, z: 60, text: 'Meet Sable at the taco stand' }
      ];
      case 2: return [
        { type: 'goto', x: -112, z: -56, text: 'Drop-off 1/3: west apartments' },
        { type: 'goto', x: 84, z: -112, text: 'Drop-off 2/3: north villas' },
        { type: 'goto', x: 112, z: 28, text: 'Drop-off 3/3: east marina' }
      ];
      case 3: return [
        { type: 'race', x: -112, z: 56, text: 'Race checkpoint 1/4' },
        { type: 'race', x: -112, z: -112, text: 'Race checkpoint 2/4' },
        { type: 'race', x: 84, z: -112, text: 'Race checkpoint 3/4' },
        { type: 'race', x: 84, z: 56, text: 'Race checkpoint 4/4: finish!' }
      ];
      case 4: return [
        { type: 'escape', x: 0, z: 0, text: 'Lose the cops, then reach the safehouse', target: [-120, 84] }
      ];
      case 5: return [
        { type: 'goto', x: 126, z: -28, text: 'Reach the harbor warehouse' },
        { type: 'combat', x: 126, z: -28, text: 'Take down 4 guards, then grab the package', kills: 4 }
      ];
      case 6: return [
        { type: 'goto', x: -56, z: -112, text: 'Roadblock 1/2: smash through' },
        { type: 'goto', x: 56, z: -112, text: 'Roadblock 2/2: smash through' },
        { type: 'goto', x: 0, z: -168, text: 'Reach the volcano road' }
      ];
      case 7: return [
        { type: 'timed', x: 0, z: -168, text: 'Timed climb: volcano overlook in 90s', seconds: 90 }
      ];
      case 8: return [
        { type: 'combat', x: 28, z: -56, text: 'Stop the rival boss car — shoot it out', kills: 1, boss: true },
        { type: 'goto', x: -34, z: 88, text: 'Return to Neon Row. You are the Ember King.' }
      ];
      default: return [];
    }
  }

  EB.missions = {
    steps: [], timer: 0, bossCar: null,

    current: function () {
      var i = EB.state.missionIndex;
      if (i < 0 || i >= EB.CONFIG.missions.length) return null;
      return EB.CONFIG.missions[i];
    },

    start: function (scene) {
      var m = this.current();
      if (!m) return;
      this.steps = missionSteps(m.id);
      EB.state.missionStep = 0;
      this.timer = 0;
      EB.state.objective = m.name + ': ' + (this.steps[0] ? this.steps[0].text : '');
      this.showStep(scene);
      EB.setMessage('Mission started: ' + m.name);
      if (EB.audio) EB.audio.blip(660, 0.2);
    },

    showStep: function (scene) {
      var s = this.steps[EB.state.missionStep];
      if (!s) return;
      EB.state.objective = this.current().name + ': ' + s.text;
      var tx = s.target ? s.target[0] : s.x, tz = s.target ? s.target[1] : s.z;
      if (s.type === 'escape') { EB.world.placeMarker(scene, tx, tz); return; }
      EB.world.placeMarker(scene, s.x, s.z);
    },

    stepTarget: function () {
      var s = this.steps[EB.state.missionStep];
      if (!s) return null;
      if (s.type === 'escape') return { x: s.target[0], z: s.target[1] };
      return { x: s.x, z: s.z };
    },

    completeStep: function (scene) {
      EB.state.missionStep++;
      EB.addMoney(50);
      if (EB.audio) EB.audio.blip(880, 0.15);
      if (EB.state.missionStep >= this.steps.length) this.completeMission(scene);
      else this.showStep(scene);
    },

    completeMission: function (scene) {
      var m = this.current();
      if (!m) return;
      EB.addMoney(m.reward); EB.addRespect(m.respect);
      EB.state.missionDone[EB.state.missionIndex] = true;
      EB.setMessage('Mission complete: ' + m.name + ' +$' + m.reward + ' +' + m.respect + ' respect');
      if (EB.audio) { EB.audio.blip(990, 0.2); }
      EB.world.hideMarker();
      EB.state.missionIndex++;
      if (EB.state.missionIndex >= EB.CONFIG.missions.length) {
        EB.state.objective = 'You own Ember Bay. Free roam!';
        EB.save.write();
        return;
      }
      EB.state.missionStep = 0;
      this.start(scene);
      EB.save.write();
    },

    failMission: function (scene) {
      EB.setMessage('Mission failed: ' + (this.current() ? this.current().name : '') + ' — try again (press M)');
      EB.world.hideMarker();
      EB.state.hp = 100;
    },

    update: function (scene, dt, px, pz) {
      var s = this.steps[EB.state.missionStep];
      if (!s || !EB.state.started) return;
      if (s.type === 'timed') {
        this.timer += dt;
        var left = Math.max(0, Math.ceil(s.seconds - this.timer));
        EB.state.objective = this.current().name + ': ' + left + 's left — reach the overlook';
        if (this.timer >= s.seconds) { this.failMission(scene); return; }
      }
      if (s.type === 'combat') {
        var need = s.kills || 1;
        if (EB.state.missionKills >= need) {
          EB.state.missionKills = 0;
          this.completeStep(scene);
        }
        return;
      }
      if (s.type === 'escape') {
        if (EB.state.wanted === 0) {
          var t = this.stepTarget();
          if (Math.hypot(px - t.x, pz - t.z) < 9) this.completeStep(scene);
        }
        return;
      }
      var d = Math.hypot(px - s.x, pz - s.z);
      if (d < 9) this.completeStep(scene);
    }
  };
})();
