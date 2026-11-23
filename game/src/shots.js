// EMBER BAY — Heat Line: shots.js
// One job: staged screenshot states. ?shot=cover|drive|chase|mission puts
// the live game into a busy, readable frame and raises window.__shotReady
// once the scene has rendered, so the maker can capture real renders of
// this code. Nothing here is a mockup: every shot is the game running.
EB.shots = (function () {
  var applied = null;

  function placePlayerInCar(car, x, z, heading) {
    EB.game.warpPlayerToCar(car, x, z, heading);
  }

  function stageCommon() {
    EB.hud.showStart(false);
    EB.hud.showHud(true);
    EB.state.started = true;
    EB.state.paused = false;
  }

  function applyCover() {
    // v9 AERIAL POSTER (top 1-2 style): the camera rides HIGH and
    // OBLIQUE south-east of the hero car, looking NORTH-WEST — beach
    // + palms in the foreground, the coastal road + traffic in the
    // midground, the city + EMBER BAY gantry + volcano behind. The
    // cover sells the PLACE, not just the car.
    stageCommon();
    EB.state.missionIndex = 2;
    EB.missions.start(2);
    EB.setWanted(3);
    var car = EB.vehicles.firstCar;
    // v5: the player drives 10 deg WEST of north (heading PI + 0.18),
    // so the coastal road runs DIAGONALLY through the frame — the city
    // fills the left two-thirds, the road vanishes upper-right, and the
    // beach sits on the right edge instead of swallowing half the shot.
    // (Due-north staging put the 10 m road on the left and 70 m of
    // mostly-empty sand on the right.) The volcano sits ~1 deg off the
    // new view centre; the EMBER BAY gantry sits ~10 deg right of it.
    placePlayerInCar(car, 192, 168, Math.PI + 0.18);
    car.speed = 16;
    EB.state.autoDrive = true;
    var police = EB.vehicles.makeCar({ kind: "police", x: 188, z: 96, heading: Math.PI, color: 0xf2f2f2, maxSpeed: 30 });
    police.speed = 8;
    var police2 = EB.vehicles.makeCar({ kind: "police", x: 196, z: 72, heading: Math.PI, color: 0xf2f2f2, maxSpeed: 30 });
    police2.speed = 8;
    var t1 = EB.vehicles.makeCar({ kind: "traffic", x: 188, z: 120, heading: Math.PI, color: 0xff4ad9, maxSpeed: 10 });
    t1.speed = 6;
    var t2 = EB.vehicles.makeCar({ kind: "taxi", x: 196, z: 0, heading: 0, color: 0xffd23e, maxSpeed: 10 });
    t2.speed = 6;
    var t3 = EB.vehicles.makeCar({ kind: "traffic", x: 196, z: 48, heading: Math.PI, color: 0x2ec4b6, maxSpeed: 10 });
    t3.speed = 6;
    var t4 = EB.vehicles.makeCar({ kind: "traffic", x: 188, z: 24, heading: Math.PI, color: 0x3ed95a, maxSpeed: 10 });
    t4.speed = 5;
    // v5: two more glossy cars so the coastal road reads dense and
    // alive — a white sedan ahead and a red sedan close in front.
    // v10: the white sedan ahead is a second BLUE-WHITE SKYLINE —
    // the hero car reads twice on the coastal road (player car below,
    // this one mid-frame), rear 3/4 toward the aerial camera. (A
    // parked show car on the beach was tried first and is geometrically
    // invisible: this high camera looks only 17 deg down, so anything
    // closer than ~45 m falls below the bottom edge of the frame.)
    var t5 = EB.vehicles.makeCar({ kind: "skyline", x: 196, z: 140, heading: Math.PI, color: 0x1e56d8, maxSpeed: 10, sporty: true });
    t5.speed = 6;
    var t6 = EB.vehicles.makeCar({ kind: "traffic", x: 188, z: 152, heading: Math.PI, color: 0xff4a4a, maxSpeed: 10 });
    t6.speed = 5;
    // v6: the road is BUSY — four more cars in both lanes, three parked
    // cars at the curbs, and pedestrians on the sidewalks + boardwalk,
    // so the cover reads as a living street, not an empty road.
    var t7 = EB.vehicles.makeCar({ kind: "traffic", x: 196, z: 88, heading: 0, color: 0x2a9df4, maxSpeed: 10 });
    t7.speed = 6;
    var t8 = EB.vehicles.makeCar({ kind: "traffic", x: 188, z: 60, heading: Math.PI, color: 0x7a5cff, maxSpeed: 10 });
    t8.speed = 5;
    var t9 = EB.vehicles.makeCar({ kind: "traffic", x: 196, z: 160, heading: 0, color: 0xffd23e, maxSpeed: 10 });
    t9.speed = 6;
    var t10 = EB.vehicles.makeCar({ kind: "traffic", x: 196, z: 116, heading: 0, color: 0xffffff, maxSpeed: 10 });
    t10.speed = 5;
    EB.vehicles.makeCar({ kind: "traffic", x: 185.5, z: 135, heading: Math.PI, color: 0xff4a4a, maxSpeed: 0 });
    EB.vehicles.makeCar({ kind: "traffic", x: 185.5, z: 40, heading: Math.PI, color: 0x2a9df4, maxSpeed: 0 });
    EB.vehicles.makeCar({ kind: "traffic", x: 198.5, z: 130, heading: 0, color: 0x2ec4b6, maxSpeed: 0 });
    // v9: two more small colourful cars (coral + lime) so the traffic
    // reads varied like the top entries' covers.
    var t11 = EB.vehicles.makeCar({ kind: "traffic", x: 196, z: 108, heading: Math.PI, color: 0xff8a7a, maxSpeed: 10 });
    t11.speed = 6;
    var t12 = EB.vehicles.makeCar({ kind: "traffic", x: 188, z: 84, heading: Math.PI, color: 0x7ed957, maxSpeed: 10 });
    t12.speed = 5;
    EB.people.spawnNear(184, 130, 3);
    EB.people.spawnNear(200, 100, 3);
    EB.people.spawnNear(208, 80, 3);
    // v9: one more sidewalk group in the aerial foreground.
    EB.people.spawnNear(184, 90, 2);
    // v9: AERIAL cover camera (top 1-2 style) — high oblique over the
    // beach, looking north-west across the road into the city. The
    // cover sells the PLACE, not just the car. (Gameplay chase-cam
    // for the other shots is unchanged.)
    EB.game.setCameraMode("aerial");
    EB.say("MISSION 3: Neon Row Nights — Gate 1/4");
  }

  function applyDrive() {
    // Drive WEST down the z=64 road toward Portside — the mission's own
    // direction (Mara waits at the docks) — into the sunset: the golden
    // sun disc hangs over the skyline ahead, cross traffic and a taxi
    // in the frame, palms and shopfronts on both sides.
    stageCommon();
    EB.state.missionIndex = 1;
    EB.missions.start(1);
    EB.setWanted(0);
    var car = EB.vehicles.firstCar;
    placePlayerInCar(car, 96, 64, -Math.PI / 2);
    car.speed = 16;
    EB.state.autoDrive = true;
    var t1 = EB.vehicles.makeCar({ kind: "traffic", x: 32, z: 61, heading: -Math.PI / 2, color: 0x4ad97a, maxSpeed: 10 });
    t1.speed = 5;
    var t2 = EB.vehicles.makeCar({ kind: "taxi", x: 0, z: 67, heading: Math.PI / 2, color: 0xffd23e, maxSpeed: 10 });
    t2.speed = 5;
    var t3 = EB.vehicles.makeCar({ kind: "traffic", x: -32, z: 61, heading: -Math.PI / 2, color: 0xff4ad9, maxSpeed: 10 });
    t3.speed = 5;
    // v6: denser drive shot — more traffic in both directions + people
    // on the sidewalks.
    var t4 = EB.vehicles.makeCar({ kind: "traffic", x: -64, z: 67, heading: Math.PI / 2, color: 0x2a9df4, maxSpeed: 10 });
    t4.speed = 5;
    var t5 = EB.vehicles.makeCar({ kind: "traffic", x: 64, z: 67, heading: Math.PI / 2, color: 0xffd23e, maxSpeed: 10 });
    t5.speed = 5;
    var t6 = EB.vehicles.makeCar({ kind: "traffic", x: -96, z: 61, heading: -Math.PI / 2, color: 0xffffff, maxSpeed: 10 });
    t6.speed = 5;
    EB.people.spawnNear(88, 72, 3);
    EB.people.spawnNear(32, 56, 2);
    EB.people.spawnNear(-32, 72, 2);
    EB.game.setCameraMode("chase");
  }

  function applyChase() {
    stageCommon();
    EB.state.missionIndex = 4;
    EB.missions.start(4); // getaway: wanted 3 + 60s timer
    EB.setWanted(4);      // helicopter joins at 4 stars
    var car = EB.vehicles.firstCar;
    // v6: start at z=120, not z=64 — at z=64 the player sat 16 m south
    // of the EMBER BAY gantry (z=48) and its two posts filled the frame
    // as giant black bars. From z=120 the gantry reads at proper scale.
    placePlayerInCar(car, 192, 120, Math.PI);
    car.speed = 20;
    EB.state.autoDrive = true;
    // Police drive the SAME way, just ahead, so they stay in frame at
    // shot time (head-on cars pass the player before the shutter, and
    // chasers behind the chase camera are never seen). The helicopter
    // is parked ahead-above so its spotlight beam crosses the frame.
    var p1 = EB.vehicles.makeCar({ kind: "police", x: 188, z: 88, heading: Math.PI, color: 0xf2f2f2, maxSpeed: 31 });
    p1.speed = 15;
    var p2 = EB.vehicles.makeCar({ kind: "police", x: 196, z: 80, heading: Math.PI, color: 0xf2f2f2, maxSpeed: 31 });
    p2.speed = 15;
    var p3 = EB.vehicles.makeCar({ kind: "police", x: 188, z: 96, heading: Math.PI, color: 0xf2f2f2, maxSpeed: 31 });
    p3.speed = 24;
    // v7b: one chaser staged CLOSE in the right lane at the player's
    // own speed, so a police car with its blinking light bar + POLICE
    // doors reads large in the chase frame (the three chasers ahead
    // were too small to identify at this distance).
    var p4 = EB.vehicles.makeCar({ kind: "police", x: 196, z: 102, heading: Math.PI, color: 0xf2f2f2, maxSpeed: 31 });
    p4.speed = 20;
    // v6: traffic in the getaway lane + people on the sidewalks.
    var ct1 = EB.vehicles.makeCar({ kind: "traffic", x: 196, z: 104, heading: Math.PI, color: 0xff4a4a, maxSpeed: 10 });
    ct1.speed = 8;
    var ct2 = EB.vehicles.makeCar({ kind: "traffic", x: 188, z: 64, heading: Math.PI, color: 0x2ec4b6, maxSpeed: 10 });
    ct2.speed = 8;
    EB.people.spawnNear(184, 90, 2);
    EB.people.spawnNear(200, 110, 2);
    // v7: the chase shot flies Air One LOW (see updateHeli) so the
    // helicopter + its searchlight beam are in the frame, not above it.
    // v7b: angle offset +0.85 puts the heli NORTH-EAST of the player
    // (right side, over the beach) — dead-ahead (-PI/2) parked it
    // directly in front of the EMBER BAY sign and it occluded the
    // sign's subtitle as a black box. Now the beam slants down-left
    // across the frame toward the player instead.
    EB.state.heliShot = true;
    var heli = EB.vehicles.heli();
    if (heli) heli.angle = -Math.PI / 2 + 0.85;
    EB.game.setCameraMode("chase");
  }

  function applyMission() {
    stageCommon();
    EB.state.missionIndex = 3;
    EB.missions.start(3); // crates + Rust Crew in Cinder Docks
    EB.setWanted(2);
    // On the road by the first crate (-20,130) and the Rust Crew guard
    // (-10,140): the crate, its light beam and the guard are all in
    // frame ahead of the player, skyline behind them — no empty lawn.
    // v9: stand closer (was -26,122) so the crate reads big, not lost
    // in the grass.
    EB.game.warpPlayerOnFoot(-24, 127, 0.6);
    EB.people.spawnNear(-30, 110, 3);
    EB.game.setCameraMode("foot");
  }

  var STAGES = { cover: applyCover, drive: applyDrive, chase: applyChase, mission: applyMission };

  return {
    param: function () {
      try { return new URLSearchParams(window.location.search).get("shot"); } catch (e) { return null; }
    },
    apply: function (name) {
      if (applied || !STAGES[name]) return false;
      applied = name;
      STAGES[name]();
      // Let the renderer draw a few frames, then signal readiness.
      var n = 0;
      var tick = function () {
        n++;
        if (n >= 4) { window.__shotReady = true; return; }
        requestAnimationFrame(tick);
      };
      setTimeout(function () { requestAnimationFrame(tick); }, 900);
      return true;
    },
    applied: function () { return applied; },
  };
})();
