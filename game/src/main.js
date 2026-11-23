// EMBER BAY main — round 5, written from zero.
// Boot, game loop, camera, traffic, carjacking, garage, start/pause.
const THREE = window.THREE;
import { GRID, PALETTE, districtAt, nearestRoadPoint } from "./config.js";
import { buildWorld } from "./world.js";
import { makeSkyline, makeTrafficCar, makeCarState, updateCar } from "./vehicles.js";
import { makeHero, animateWalk, makePedestrians, updatePedestrians } from "./people.js";
import { makeMissionSystem } from "./missions.js";
import { makeCombat } from "./combat.js";
import { makeAudio } from "./audio.js";
import { makeInput } from "./input.js";
import { saveGame, loadGame, hasSave } from "./save.js";
import { makeHud } from "./hud.js";
import { stageShot } from "./shots.js";

const params = new URLSearchParams(location.search);
const SHOT = params.get("shot") || null;
const AUTOSTART = params.get("autostart") === "1";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
document.getElementById("game").appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 3000);

const world = buildWorld(scene);
const input = makeInput();
const audio = makeAudio();
const hud = makeHud();

const state = {
  cash: 250, respect: 0, hp: 100, wanted: 0, mission: 1, weapon: 1,
  playerX: 24, playerZ: 164, heading: 0, speed: 0, inCar: false,
  radioOn: false, stationName: "EMBER FM", calmTimer: 0, ammoFlash: 0,
  streetName: "Coastal Rd", paused: false, started: false,
  heroCarPos: { x: 28, z: 160 },
};
window.__ember = { state, errors: [], ready: false, fps: 0, scene, renderer,
  info() { const i = renderer.info.render; return { calls: i.calls, triangles: i.triangles }; },
  warp(x, z) { state.playerX = x; state.playerZ = z; player.position.set(x, 0, z); },
  nearestCarDist() {
    const px = state.playerX, pz = state.playerZ;
    let bd = Math.hypot(heroCar.position.x - px, heroCar.position.z - pz);
    for (const t of traffic) {
      if (t.taken) continue;
      bd = Math.min(bd, Math.hypot(t.mesh.position.x - px, t.mesh.position.z - pz));
    }
    return bd;
  },
};

// ----- hero car + player -----
const heroCar = makeSkyline();
heroCar.position.set(state.heroCarPos.x, 0, state.heroCarPos.z);
heroCar.rotation.y = Math.PI / 2;
scene.add(heroCar);
const carState = makeCarState(state.heroCarPos.x, state.heroCarPos.z, Math.PI / 2);
const player = makeHero();
player.position.set(state.playerX, 0, state.playerZ);
scene.add(player);

// ----- traffic (22 rounded cars on the street grid) -----
const TRAFFIC_COLORS = [0xe85a5a, 0x5a8fd6, 0xffe3a3, 0x7ed957, 0xb06ad6, 0xf5f5f0, 0xff8c1a, 0x2ec4b6];
const traffic = [];
for (let i = 0; i < 22; i++) {
  const mesh = makeTrafficCar(TRAFFIC_COLORS[i % TRAFFIC_COLORS.length]);
  const horiz = Math.random() < 0.5;
  const street = GRID.streets[Math.floor(Math.random() * GRID.streets.length)];
  const along = (Math.random() - 0.5) * 380;
  const car = {
    mesh, horiz, street, along, dir: Math.random() < 0.5 ? 1 : -1,
    speed: 7 + Math.random() * 5, taken: false,
  };
  mesh.position.set(horiz ? along : street, 0, horiz ? street : along);
  mesh.rotation.y = horiz ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  scene.add(mesh);
  traffic.push(car);
}
function updateTraffic(dt) {
  for (const t of traffic) {
    if (t.taken) continue;
    t.along += t.dir * t.speed * dt;
    if (t.along > 195 || t.along < -195) {
      // turn onto a perpendicular street at the edge
      t.horiz = !t.horiz;
      const oldStreet = t.street;
      t.street = GRID.streets[Math.floor(Math.random() * GRID.streets.length)];
      t.along = oldStreet;
      t.dir = Math.random() < 0.5 ? 1 : -1;
    }
    t.mesh.position.set(t.horiz ? t.along : t.street, 0, t.horiz ? t.street : t.along);
    t.mesh.rotation.y = t.horiz ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
    t.mesh.userData.wheels?.forEach(w => { w.rotation.z += t.speed * dt * 2.2; });
  }
}

// ----- systems -----
const missions = makeMissionSystem(scene, state);
const combat = makeCombat(scene, state, world);
const peds = makePedestrians(scene, 60);
window.__ember.peds = peds;

// ----- game flow -----
function distTo(t) {
  const px = state.inCar ? carState.x : state.playerX;
  const pz = state.inCar ? carState.z : state.playerZ;
  return Math.hypot(t.x - px, t.z - pz);
}
function completeMission() {
  state.cash += 200; state.respect += 50;
  hud.toast(`Mission complete! +$200 • +50 respect`);
  if (state.mission === 5) combat.setWanted(0);
  if (state.mission >= 8) {
    state.mission = 8; hud.toast("EMBER KING — the city is yours!");
    missions.setMission(8); return;
  }
  state.mission++;
  missions.setMission(state.mission);
  if (state.mission === 5) combat.setWanted(4);
  if (state.mission === 6) combat.setWanted(4);
}
const ctx = { distTo, inCar: false, completeMission };
Object.defineProperty(ctx, "inCar", { get: () => state.inCar });

function nearestCar(maxD) {
  let best = null, bd = maxD;
  const px = state.playerX, pz = state.playerZ;
  const dHero = Math.hypot(heroCar.position.x - px, heroCar.position.z - pz);
  if (dHero < bd) { best = { kind: "hero", mesh: heroCar, d: dHero }; bd = dHero; }
  for (const t of traffic) {
    if (t.taken) continue;
    const d = Math.hypot(t.mesh.position.x - px, t.mesh.position.z - pz);
    if (d < bd) { best = { kind: "traffic", car: t, mesh: t.mesh, d }; bd = d; }
  }
  return best;
}

// ----- camera -----
let camYaw = 0, camPitch = 0;
const cam = { mode: "follow", dist: 7.2, height: 3.1, fov: 55 };
const game = {
  state, missions, combat, cameraMode: "follow",
  cameraDist: 7.2, cameraHeight: 3.1, cameraFov: 55, coverCam: null,
  setCar(x, z, heading, inCar) {
    carState.x = x; carState.z = z; carState.heading = heading; carState.speed = 0;
    heroCar.position.set(x, 0, z); heroCar.rotation.y = heading;
    state.heroCarPos = { x, z };
    state.inCar = inCar;
    if (inCar) { state.playerX = x; state.playerZ = z; }
  },
  setPlayer(x, z, heading) {
    state.inCar = false;
    state.playerX = x; state.playerZ = z; state.heading = heading;
    player.position.set(x, 0, z); player.rotation.y = heading;
  },
};
function updateCamera(dt) {
  if (game.cameraMode === "cover" && game.coverCam) {
    camera.position.set(...game.coverCam.pos);
    camera.lookAt(...game.coverCam.look);
    camera.fov = 50; camera.updateProjectionMatrix();
    return;
  }
  const focus = state.inCar
    ? { x: carState.x, z: carState.z, h: carState.heading }
    : { x: state.playerX, z: state.playerZ, h: state.heading };
  const dist = game.cameraDist, height = game.cameraHeight;
  const back = focus.h + Math.PI;
  const cx = focus.x + Math.sin(back + camYaw) * dist;
  const cz = focus.z + Math.cos(back + camYaw) * dist;
  camera.position.set(cx, height, cz);
  camera.lookAt(focus.x, 1.4, focus.z + (state.inCar ? Math.sin(focus.h) * 4 : 0));
  camera.fov = game.cameraFov; camera.updateProjectionMatrix();
}

// ----- start / pause -----
function startGame(fromSave) {
  if (fromSave) {
    const s = loadGame();
    if (s) { state.cash = s.cash; state.respect = s.respect; state.mission = s.mission; state.hp = s.hp; state.playerX = s.x; state.playerZ = s.z; }
    missions.setMission(state.mission);
  }
  state.started = true; state.paused = false;
  document.getElementById("start").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");
  audio.unlock();
}
document.getElementById("startbtn").addEventListener("click", () => startGame(false));
const contBtn = document.getElementById("continuebtn");
if (hasSave()) contBtn.classList.remove("hidden");
contBtn.addEventListener("click", () => startGame(true));
if (AUTOSTART || SHOT) startGame(false);
if (SHOT) stageShot(SHOT, game);

// ----- main loop -----
const clock = new THREE.Clock();
let frames = 0, fpsRealT0 = performance.now();
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  world.updaters.forEach(u => u(t));
  // pause toggle must work while paused (checked before the early return)
  if (input.wasPressed("KeyM") || input.wasPressed("Escape")) {
    if (state.started) {
      state.paused = !state.paused;
      document.getElementById("pause").classList.toggle("hidden", !state.paused);
    }
  }
  if (!state.started || state.paused) { renderer.render(scene, camera); return; }

  // keys: weapons, radio, save, garage, mute
  if (input.wasPressed("Digit1")) state.weapon = 1;
  if (input.wasPressed("Digit2")) state.weapon = 2;
  if (input.wasPressed("Digit3")) state.weapon = 3;
  if (input.wasPressed("Digit4")) state.weapon = 4;
  if (input.wasPressed("Digit5")) state.weapon = 5;
  if (input.wasPressed("Digit6")) state.weapon = 6;
  if (input.wasPressed("Digit7")) state.weapon = 7;
  if (input.wasPressed("KeyQ")) state.weapon = state.weapon % 7 + 1;
  if (input.wasPressed("KeyR")) { state.radioOn = audio.toggleRadio(); state.stationName = audio.stationName(); }
  if (input.wasPressed("KeyC") && state.radioOn) state.stationName = audio.nextStation();
  if (input.wasPressed("KeyP")) { if (saveGame(state)) hud.toast("Progress saved"); }
  if (input.wasPressed("KeyG")) openGarage();
  if (input.wasPressed("KeyN")) hud.toast("Muted (audio off)");

  // enter / exit car, carjack
  if (input.wasPressed("KeyE")) {
    if (state.inCar) {
      state.inCar = false;
      state.playerX = carState.x + Math.sin(carState.heading + Math.PI / 2) * 2.5;
      state.playerZ = carState.z + Math.cos(carState.heading + Math.PI / 2) * 2.5;
      state.heading = carState.heading;
      player.position.set(state.playerX, 0, state.playerZ);
      player.visible = true;
    } else {
      const near = nearestCar(6);
      if (near && near.kind === "hero") {
        state.inCar = true; player.visible = false;
        carState.x = heroCar.position.x; carState.z = heroCar.position.z;
        carState.heading = heroCar.rotation.y;
        if (state.mission === 1) completeMission();
      }
    }
  }
  if (input.wasPressed("KeyF") && !state.inCar) {
    const near = nearestCar(5);
    if (near && near.kind === "traffic") {
      near.car.taken = true; scene.remove(near.car.mesh);
      state.inCar = true; player.visible = false;
      carState.x = near.mesh.position.x; carState.z = near.mesh.position.z;
      carState.heading = near.mesh.rotation.y;
      // swap hero car to the jacked car visually: move hero mesh to it
      heroCar.position.set(carState.x, 0, carState.z); heroCar.rotation.y = carState.heading;
      combat.addWanted(1);
      hud.toast("Carjacked! The heat is on");
    }
  }

  // movement
  if (state.inCar) {
    updateCar(carState, input, dt, world.colliders, 205);
    heroCar.position.set(carState.x, 0, carState.z);
    heroCar.rotation.y = carState.heading;
    heroCar.userData.wheels?.forEach(w => { w.rotation.z += carState.speed * dt * 2.2; });
    state.playerX = carState.x; state.playerZ = carState.z; state.speed = carState.speed;
    state.heading = carState.heading;
    audio.setEngine(carState.speed, true);
  } else {
    const sp = (input.run ? 6.5 : 4) * dt;
    let mx = 0, mz = 0;
    if (input.forward) { mz += 1; } if (input.back) { mz -= 1; }
    if (input.left) { mx -= 1; } if (input.right) { mx += 1; }
    if (mx || mz) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      state.heading = Math.atan2(mx, mz);
      state.playerX += mx * sp; state.playerZ += mz * sp;
      state.speed = input.run ? 6.5 : 4;
    } else state.speed = 0;
    // keep player out of building circles
    for (const c of world.colliders) {
      const dx = state.playerX - c.x, dz = state.playerZ - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r + 0.6 && d > 0.01) {
        state.playerX = c.x + dx / d * (c.r + 0.6);
        state.playerZ = c.z + dz / d * (c.r + 0.6);
      }
    }
    state.playerX = Math.max(-205, Math.min(215, state.playerX));
    state.playerZ = Math.max(-205, Math.min(205, state.playerZ));
    player.position.set(state.playerX, 0, state.playerZ);
    player.rotation.y = state.heading;
    animateWalk(player, state.speed, dt);
    audio.setEngine(0, false);
  }

  // shooting (mouse click)
  if (mouseDown) combat.shoot();
  updateTraffic(dt);
  updatePedestrians(peds, dt);
  combat.update(dt, { x: state.playerX, z: state.playerZ });
  missions.update(dt, ctx);
  state.streetName = districtAt(state.playerX, state.playerZ).name === "Sunset Beach" ? "Coastal Rd" : "Cinder Rd";

  // HUD
  const mi = missions.missionInfo();
  const tgt = missions.target();
  hud.update(dt, state, mi, tgt, state.heading);
  // enter-car prompt
  const promptEl = document.getElementById("prompt");
  if (!state.inCar && state.started) {
    const near = nearestCar(6);
    if (near && near.kind === "hero") { promptEl.textContent = "E — GET IN"; promptEl.classList.remove("hidden"); }
    else if (near && near.kind === "traffic") { promptEl.textContent = "F — CARJACK"; promptEl.classList.remove("hidden"); }
    else promptEl.classList.add("hidden");
  } else promptEl.classList.add("hidden");
  updateCamera(dt);

  // fps + ready flag for the harness (real time, not game time)
  frames++;
  const nowMs = performance.now();
  if (nowMs - fpsRealT0 >= 1000) { window.__ember.fps = Math.round(frames * 1000 / (nowMs - fpsRealT0)); frames = 0; fpsRealT0 = nowMs; }
  window.__ember.ready = true;
  renderer.render(scene, camera);
}
let mouseDown = false;
renderer.domElement.addEventListener("mousedown", () => { mouseDown = true; });
window.addEventListener("mouseup", () => { mouseDown = false; });
window.addEventListener("error", e => window.__ember.errors.push(String(e.message || e.error)));
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ----- garage -----
function openGarage() {
  if (!state.inCar) { hud.toast("Get in a car first"); return; }
  const choice = state.cash >= 500 ? "engine" : null;
  if (choice) { state.cash -= 500; hud.toast("Engine upgraded! +speed ($500)"); }
  else hud.toast("Garage: Engine upgrade $500 — not enough cash");
}

loop();
