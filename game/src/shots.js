// EMBER BAY — shots: staged setups for the 4 screenshots (?shot=cover|
// drive|chase|mission). Each sets mission, wanted, player/car placement
// and (for the cover) a fixed aerial camera. main.js raises
// window.__shotReady once the staged scene has rendered.
(function () {
  var EB = window.EB || (window.EB = {});
  var name = null, coverCam = null, staged = false;

  function stage(n) {
    name = n;
    var st = EB.state, g = EB.game;
    if (!st || !g) return;
    st.started = true;
    EB.hud.setStartVisible(false);
    if (n === "cover") {
      // JOB 3/8, aerial three-quarter view from over the sea
      EB.missions.start(2);
      g.placePlayerInCar(200, 90, Math.PI / 2, 24);
      g.setSpeed(36); // ~54 mph
      EB.combat.setWanted(3);
      coverCam = { pos: [250, 85, 165], look: [115, 0, -15] };
    } else if (n === "drive") {
      // JOB 2/8, chase cam behind the Skyline on the coastal road, beach right
      EB.missions.start(1);
      g.placePlayerInCar(200, 150, Math.PI / 2, 30);
      g.setSpeed(30); // ~45 mph
      EB.combat.setWanted(0);
      coverCam = null;
    } else if (n === "chase") {
      // JOB 5/8, wanted 4, helicopter + spotlight, traffic ahead, gantry overhead
      EB.missions.start(4);
      g.placePlayerInCar(198, 96, Math.PI / 2, 38);
      g.setSpeed(38);
      EB.combat.setWanted(4);
      coverCam = null;
    } else if (n === "mission") {
      // JOB 4/8, on foot at the first crate, marker beam overhead
      EB.missions.start(3);
      g.placePlayerOnFoot(-126, 154, Math.PI);
      EB.combat.setWanted(2);
      coverCam = null;
    }
    st.missionDirty = true;
    staged = true;
  }

  function param() {
    var m = /[?&]shot=([a-z]+)/.exec(location.search);
    return m ? m[1] : null;
  }

  EB.shots = {
    stage: stage, param: param,
    name: function () { return name; },
    coverCam: function () { return coverCam; },
    isStaged: function () { return staged; }
  };
})();
