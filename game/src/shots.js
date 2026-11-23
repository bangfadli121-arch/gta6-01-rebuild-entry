// EMBER BAY screenshot staging — round 5, written from zero.
// ?shot=cover|drive|chase|mission positions the world + camera for each render.
// Cover matches v11d's composition; chase keeps the billboard clear of the HUD.
export function stageShot(name, g) {
  const S = g.state;
  if (name === "cover") {
    // aerial three-quarter: city dense left, beach + sea + sailboats right,
    // volcano + sunset behind, billboard readable, hero car on the beach road.
    g.setCar(180, -20, 0, true);
    S.mission = 3; S.cash = 250; S.respect = 0; S.wanted = 3; S.hp = 100;
    g.missions.setMission(3);
    g.cameraMode = "cover";
    g.coverCam = { pos: [290, 135, 240], look: [-20, 0, -10] };
    g.combat.setWanted(0);
    return;
  }
  if (name === "drive") {
    // beach road, hero Skyline big + close, billboard ahead (not blocking HUD),
    // beach + palms on the right, city on the left.
    g.setCar(180, 80, Math.PI, true);
    S.mission = 2; S.cash = 250; S.wanted = 0; S.hp = 100;
    g.missions.setMission(2);
    g.cameraMode = "chase";
    g.cameraDist = 8.5; g.cameraHeight = 3.4; g.cameraFov = 55;
    g.combat.setWanted(0);
    return;
  }
  if (name === "chase") {
    // getaway: police behind, helicopter close + high with the spotlight cone
    // clearly visible, billboard off to the left so it never covers the HUD.
    g.setCar(20, -60, Math.PI, true);
    S.mission = 5; S.cash = 250; S.wanted = 4; S.hp = 100;
    g.missions.setMission(5);
    g.combat.setWanted(4);
    g.cameraMode = "chase";
    g.cameraDist = 8.5; g.cameraHeight = 3.4; g.cameraFov = 55;
    // heli far ahead + low so it stays inside the frame with its cone
    const h = g.combat.heliMesh;
    if (h) { h.position.set(30, 8.5, -80); }
    // police interceptors close ahead, left + right of the road
    const pm = g.combat.policeMeshes;
    if (pm[0]) { pm[0].position.set(14, 0, -78); pm[0].rotation.y = Math.PI; }
    if (pm[1]) { pm[1].position.set(27, 0, -72); pm[1].rotation.y = Math.PI; }
    return;
  }
  if (name === "mission") {
    // on foot at the Dockside crates: colorful towers + palms around, marker
    // beam + diamond + ring clearly visible, no dominant grey wall.
    S.mission = 4; S.cash = 250; S.wanted = 2; S.hp = 100;
    g.setPlayer(-140, -100, Math.PI);
    g.missions.setMission(4);
    g.combat.setWanted(0);
    g.cameraMode = "follow";
    g.cameraDist = 9; g.cameraHeight = 3.5;
    return;
  }
}
