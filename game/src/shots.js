// Ember Bay — screenshot presets. ?shot=cover|drive|chase|mission sets
// the camera, the player car and the wanted level so each screenshot is
// a real render of the game code in a chosen state.
(function () {
  var EB = window.EB || (window.EB = {});

  EB.shots = {
    name: null,

    read: function () {
      try {
        var q = new URLSearchParams(window.location.search);
        this.name = q.get('shot');
      } catch (e) { this.name = null; }
      return this.name;
    },

    // called once the scene exists, before the first frame
    apply: function (scene) {
      var shot = this.name;
      if (!shot) return false;
      EB.state.started = true;
      var P = EB.vehicles.player;
      if (shot === 'cover') {
        // aerial three-quarter from above the beach, looking at city + volcano
        EB.main.setCameraMode('cover');
        if (P) {
          P.x = -2; P.z = 102; P.heading = Math.PI / 2; P.speed = 0;
          P.mesh.scale.set(3, 3, 3);
          P.mesh.position.set(P.x, 0, P.z);
          P.mesh.rotation.y = P.heading;
        }
        // put three traffic cars on the coastal road for a living street
        for (var ci = 0; ci < 3 && ci < EB.vehicles.traffic.length; ci++) {
          var tc = EB.vehicles.traffic[ci];
          tc.horizontal = true; tc.z = 88; tc.x = -52 + ci * 46; tc.dir = 1;
        }
        EB.world.hideMarker();
        EB.state.wanted = 0;
        EB.state.missionIndex = 1; EB.state.missionStep = 0;
        EB.state.objective = 'Pizza Run: Drop-off 1/3 — west apartments';
        return true;
      }
      if (shot === 'drive') {
        EB.main.setCameraMode('chase');
        if (P) { P.x = -40; P.z = 88; P.heading = Math.PI / 2; P.speed = 18; }
        EB.state.wanted = 0;
        return true;
      }
      if (shot === 'chase') {
        EB.main.setCameraMode('chase');
        if (P) { P.x = 10; P.z = 60; P.heading = Math.PI / 2; P.speed = 26; }
        EB.state.wanted = 3;
        EB.combat.dispatch(scene, P.x, P.z);
        EB.combat.dispatch(scene, P.x, P.z);
        // pull two police cars into the frame: both head-on in the
        // oncoming lane, so they read as a chase without blocking the camera
        for (var pi = 0; pi < EB.vehicles.police.length && pi < 2; pi++) {
          var pc = EB.vehicles.police[pi];
          if (pi === 0) { pc.x = P.x + 45; pc.z = P.z - 2; }
          else { pc.x = P.x + 30; pc.z = P.z + 10; }
          pc.heading = Math.atan2(P.x - pc.x, P.z - pc.z);
          pc.speed = 0;
          pc.mesh.position.set(pc.x, 0, pc.z);
          pc.mesh.rotation.y = pc.heading;
        }
        EB.people.heliHeight = 13; EB.people.heliRadius = 42;
        EB.people.spawnHeli(scene);
        return true;
      }
      if (shot === 'mission') {
        EB.main.setCameraMode('chase');
        if (P) { P.x = -84; P.z = 20; P.heading = Math.PI; P.speed = 12; }
        EB.state.missionIndex = 1;
        EB.missions.start(scene);
        EB.state.wanted = 1;
        return true;
      }
      return false;
    }
  };
})();
