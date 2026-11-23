// shots.js — staged screenshot setups (?shot=cover|drive|chase|mission).
// Each stage positions the player/camera to match the v11d compositions.
export function stageShot(name, api) {
  const s = api.state;
  if (name === "cover") {
    // aerial three-quarter over the coastal road, beach + sea on the right.
    // Hero Skyline ON the coastal road (x=168), well south of the billboard
    // so it stays visible (it drives north ~35m during the settle and must
    // not end up hidden behind the billboard at z=84).
    api.setPlayer(168, 140, Math.PI, true);
    api.setMission(3);
    api.setWanted(3);
    api.setCamera("cover");
    api.setSpeed(55);
  } else if (name === "drive") {
    // in the Skyline on the coastal road, beach on the right, billboard ahead.
    // Start well south (z=185) so after the ~35m settle the car is ~65m
    // from the billboard — fully in frame, never cut off at the top.
    api.setPlayer(168, 185, Math.PI, true);
    api.setMission(2);
    api.setWanted(0);
    api.setCamera("chase");
    api.setSpeed(55);
    api.placePoliceForShot();
  } else if (name === "chase") {
    // getaway: wanted 4, heli + police visible, gantry billboard ahead.
    // Start at z=170 so after the settle the billboard (~50m ahead) reads
    // fully in frame like the v11d chase, instead of sitting behind the car.
    api.setPlayer(168, 170, Math.PI, true);
    api.setMission(5);
    api.setWanted(4);
    api.setCamera("chase");
    api.setSpeed(64);
    api.placeHeliForShot();
    api.placePoliceForShot();
  } else if (name === "mission") {
    // on foot at the Dockside marker, crates + buildings around.
    // Hero faces SOUTH (heading 0) toward the crates at (-126,-84); the
    // foot camera sits north of him so the crates are in frame ahead and
    // the volcano (north-west) stays BEHIND the camera, not looming over it.
    api.setPlayer(-126, -100, 0, false);
    api.setMission(4);
    api.setWanted(2);
    api.setCamera("foot");
    api.setSpeed(0);
  }
}
