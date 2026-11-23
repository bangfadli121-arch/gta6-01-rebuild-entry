// main.js — EMBER BAY game loop: player, driving, traffic, cameras,
// start screen, pause map, garage, radio, save, and the __ember test API.
// Assets (Kenney GLBs, CC0) are loaded first; every builder has a
// procedural fallback if a GLB fails to load.
import * as THREE from "three";
import { CFG } from "./config.js";
import { buildWorld } from "./world.js";
import { buildSkyline, buildTrafficCar, buildPoliceCar } from "./vehicles.js";
import { PedCrowd, buildHero } from "./people.js";
import { Missions } from "./missions.js";
import { Combat } from "./combat.js";
import { Radio } from "./audio.js";
import { Input } from "./input.js";
import { HUD } from "./hud.js";
import { saveGame, loadGame } from "./save.js";
import { stageShot } from "./shots.js";
import { loadGLB, CARS, BUILDINGS, PROPS } from "./assets.js";

const $ = (id) => document.getElementById(id);

const state = {
  started: false, cash: 250, respect: 0, mission: 1, weaponIdx: 0, weapon: "FISTS",
  wanted: 0, wantedTimer: 0, hp: 100, playerX: 24, playerZ: 164, heading: 0,
  speed: 0, inCar: false, raceIdx: 0, cratesGot: 0, escapeLeft: 0,
  radioOn: false, stationName: "EMBER FM", toast: "", toastTimer: 0,
  objective: null, streetName: "Coastal Rd", heroCarPos: { x: 24, z: 164 },
};

const errors = [];
window.addEventListener("error", (e) => errors.push(String(e.message || e.error)));

let renderer, scene, camera, clock;
let world, hero, heroCar, crowd, missions, combat, hud, radio, input;
let traffic = [];
let camMode = "foot";
let dragYaw = 0;
let fpsAcc = 0, fpsN = 0, fps = 0;
let paused = false;
let assets = {};

function streetNameAt(x, z) {
  if (x > 150) return "Coastal Rd";
  if (z > 100) return "Cinder Rd";
  for (const d of CFG.districts) if (Math.abs(x - d.cx) < d.w / 2 && Math.abs(z - d.cz) < d.d / 2) return d.name + " Ave";
  return "Ember Blvd";
}

async function loadAssets() {
  const jobs = [];
  const put = (obj, key, path) => jobs.push(loadGLB(path).then((m) => { obj[key] = m; }));
  assets.cars = {};
  for (const [k, p] of Object.entries(CARS)) put(assets.cars, k, p);
  assets.buildings = {};
  for (const [k, list] of Object.entries(BUILDINGS)) {
    assets.buildings[k] = [];
    list.forEach((p, i) => jobs.push(loadGLB(p).then((m) => { assets.buildings[k][i] = m; })));
  }
  assets.props = {};
  for (const [k, p] of Object.entries(PROPS)) put(assets.props, k, p);
  await Promise.all(jobs);
  // drop failed loads
  for (const k of Object.keys(assets.buildings)) assets.buildings[k] = assets.buildings[k].filter(Boolean);
  const loaded = Object.values(assets.cars).filter(Boolean).length + Object.values(assets.buildings).flat().length + Object.values(assets.props).filter(Boolean).length;
  console.log("assets loaded:", loaded);
  return assets;
}

async function init() {
  const params = new URLSearchParams(location.search);
  // ?noaa=1 disables antialiasing (software-rendered test harness runs
  // much faster without MSAA; the real game keeps AA on by default)
  const noaa = params.get("noaa") === "1";
  renderer = new THREE.WebGLRenderer({ antialias: !noaa });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  $("app").appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2000);
  clock = new THREE.Clock();
  input = new Input();
  radio = new Radio();
  hud = new HUD(state);

  await loadAssets();
  world = buildWorld(scene, assets);

  // hero character
  hero = buildHero();
  hero.position.set(state.playerX, 0, state.playerZ);
  scene.add(hero);

  // hero Skyline (Kenney race.glb repainted blue, or procedural fallback)
  heroCar = buildSkyline(assets.cars.race);
  heroCar.position.set(24, 0, 164);
  heroCar.rotation.y = Math.PI / 2;
  scene.add(heroCar);

  // traffic: 22 Kenney cars looping along road lanes (forward +Z)
  const trafficModels = [assets.cars.sedan, assets.cars.sedanSports, assets.cars.hatchSports, assets.cars.suv, assets.cars.van, assets.cars.taxi, assets.cars.truck].filter(Boolean);
  for (let i = 0; i < CFG.trafficCount; i++) {
    const model = trafficModels.length ? trafficModels[i % trafficModels.length] : null;
    const c = buildTrafficCar(model);
    const lane = (Math.floor(Math.random() * 11) - 5) * CFG.roadSpacing;
    const vertical = Math.random() < 0.5;
    const off = (Math.random() < 0.5 ? -1 : 1) * 3;
    const along = (Math.random() * 2 - 1) * 200;
    c.position.set(vertical ? lane + off : along, 0, vertical ? along : lane + off);
    c.userData = { vertical, lane: lane + off, dir: Math.random() < 0.5 ? 1 : -1, speed: 6 + Math.random() * 6 };
    scene.add(c); traffic.push(c);
  }

  crowd = new PedCrowd(scene);
  missions = new Missions(scene, state);
  combat = new Combat(scene, state, () => buildPoliceCar(assets.cars.police));
  missions.setMission(1);
  updateObjective();

  // start screen
  $("start-btn").addEventListener("click", () => startGame(false));
  $("continue-btn").addEventListener("click", () => startGame(true));
  if (!loadGame()) $("continue-btn").style.display = "none";
  input.onKey = (code) => {
    if (!state.started) return;
    if (code === "KeyM" || code === "Escape") togglePause();
    if (code === "KeyR") { state.radioOn = radio.toggle(); state.stationName = radio.stationName(); state.toast = radio.on ? "Radio: " + radio.stationName() : "Radio off"; }
    if (code === "KeyN") { if (radio.ctx) radio.ctx.suspend(); state.toast = "Muted"; }
    if (code === "KeyP") { saveGame(state); state.toast = "Progress saved"; }
    if (code === "KeyG") { state.toast = "Garage: Skyline tuned +10 respect"; state.respect += 10; }
    if (code === "KeyQ") { const w = combat.cycleWeapon(); state.toast = "Weapon: " + w; }
  };
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  // drag to look (clamped)
  let dragging = false, lastX = 0;
  renderer.domElement.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; });
  window.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragYaw = Math.max(-0.6, Math.min(0.6, dragYaw + (e.clientX - lastX) * 0.003));
    lastX = e.clientX;
  });
  window.addEventListener("pointerup", () => { dragging = false; });

  // staged shots
  const shot = params.get("shot");
  if (params.get("autostart") === "1" || shot) {
    startGame(false);
    if (shot) {
      setTimeout(() => stageShot(shot, api), 600);
      setTimeout(() => { window.__ember.ready = true; }, 2500);
    }
  }
  window.__ember = api;
  window.__ember.ready = !shot;
  animate();
}

function startGame(fromSave) {
  if (fromSave) {
    const s = loadGame();
    if (s) { state.cash = s.cash; state.respect = s.respect; state.mission = s.mission; state.weaponIdx = s.weaponIdx; state.playerX = s.x; state.playerZ = s.z; }
  }
  state.started = true;
  $("start").classList.add("hidden");
  $("pause").classList.add("hidden");
  missions.setMission(state.mission);
  updateObjective();
}

function togglePause() {
  paused = !paused;
  $("pause").classList.toggle("hidden", !paused);
  if (paused) hud.drawBigMap();
}

function updateObjective() {
  state.objective = missions.objectiveFor(state.mission);
}

function nearestCarDist() {
  let best = 1e9, bestCar = null;
  const cars = [heroCar, ...traffic];
  for (const c of cars) {
    const d = Math.hypot(c.position.x - state.playerX, c.position.z - state.playerZ);
    if (d < best) { best = d; bestCar = c; }
  }
  state.nearestCar = bestCar;
  return best;
}

function updatePlayer(dt) {
  const w = input.down("KeyW") || input.down("ArrowUp");
  const s = input.down("KeyS") || input.down("ArrowDown");
  const a = input.down("KeyA") || input.down("ArrowLeft");
  const d = input.down("KeyD") || input.down("ArrowRight");
  if (state.inCar) {
    $("prompt").classList.add("hidden");
    const accel = w ? 22 : s ? -14 : 0;
    state.speed += accel * dt;
    state.speed *= Math.pow(0.4, dt);
    state.speed = Math.max(-10, Math.min(30, state.speed));
    if (a) state.heading += 1.9 * dt * Math.sign(state.speed || 1);
    if (d) state.heading -= 1.9 * dt * Math.sign(state.speed || 1);
    const nx = state.playerX + Math.sin(state.heading) * state.speed * dt;
    const nz = state.playerZ + Math.cos(state.heading) * state.speed * dt;
    state.playerX = Math.max(-205, Math.min(300, nx));
    state.playerZ = Math.max(-205, Math.min(205, nz));
    heroCar.position.set(state.playerX, 0, state.playerZ);
    heroCar.rotation.y = state.heading;
    // spin wheels around their axle (local X for +Z-forward cars)
    for (const wh of heroCar.userData.wheels || []) wh.rotation.x += state.speed * dt * 2.2;
    hero.visible = false;
    if (input.tap("KeyE")) {
      state.inCar = false; hero.visible = true;
      hero.position.set(state.playerX + 2.5, 0, state.playerZ);
      state.speed = 0;
    }
    if (Math.abs(state.speed) > 20 && state.mission !== 5) {
      state.speedTimer = (state.speedTimer || 0) + dt;
      if (state.speedTimer > 12) { combat.setWanted(state.wanted + 1); state.speedTimer = 0; }
    }
  } else {
    const sp = 5.2;
    let mx = 0, mz = 0;
    if (w) mz -= 1; if (s) mz += 1; if (a) mx -= 1; if (d) mx += 1;
    if (mx || mz) {
      const len = Math.hypot(mx, mz); mx /= len; mz /= len;
      state.playerX += mx * sp * dt;
      state.playerZ += mz * sp * dt;
      state.heading = Math.atan2(mx, mz);
      state.speed = sp;
      const sw = Math.sin(performance.now() / 90) * 0.5;
      hero.userData.legs[0].rotation.x = sw; hero.userData.legs[1].rotation.x = -sw;
      hero.userData.arms[0].rotation.x = -sw * 0.7; hero.userData.arms[1].rotation.x = sw * 0.7;
    } else state.speed = 0;
    state.playerX = Math.max(-205, Math.min(300, state.playerX));
    state.playerZ = Math.max(-205, Math.min(205, state.playerZ));
    hero.position.set(state.playerX, 0, state.playerZ);
    hero.rotation.y = state.heading;
    const nd = nearestCarDist();
    const prompt = $("prompt");
    if (nd < 5.5) {
      prompt.textContent = "E — GET IN";
      prompt.classList.remove("hidden");
      if (input.tap("KeyE")) {
        state.inCar = true;
        state.playerX = state.nearestCar.position.x;
        state.playerZ = state.nearestCar.position.z;
        state.heading = state.nearestCar.rotation.y;
        prompt.classList.add("hidden");
      }
    } else prompt.classList.add("hidden");
    if (input.tap("KeyF") && nd < 8 && state.nearestCar !== heroCar) {
      const c = state.nearestCar;
      heroCar.position.copy(c.position);
      heroCar.rotation.y = c.rotation.y;
      state.playerX = c.position.x; state.playerZ = c.position.z;
      state.heading = c.rotation.y;
      state.inCar = true;
      state.toast = "Carjacked!";
    }
  }
  state.streetName = streetNameAt(state.playerX, state.playerZ);
  state.heroCarPos = { x: heroCar.position.x, z: heroCar.position.z };
}

function updateTraffic(dt) {
  for (const c of traffic) {
    const u = c.userData;
    const step = u.speed * dt * u.dir;
    if (u.vertical) {
      c.position.z += step;
      if (c.position.z > 205) c.position.z = -205;
      if (c.position.z < -205) c.position.z = 205;
      c.rotation.y = u.dir > 0 ? 0 : Math.PI;
    } else {
      c.position.x += step;
      if (c.position.x > 205) c.position.x = -205;
      if (c.position.x < -205) c.position.x = 205;
      c.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    for (const wh of c.userData.wheels || []) wh.rotation.x += u.speed * dt * 2.2 * u.dir;
  }
}

function updateCamera(dt) {
  const px = state.playerX, pz = state.playerZ;
  if (camMode === "cover") {
    // low oblique aerial along the coastal road (v11d framing): beach + sea
    // on the right, city on the left, volcano far ahead — NOT a high diorama.
    // lookAt nudged east so more sea fills the right third of the frame.
    camera.position.set(220, 45, 235);
    camera.lookAt(125, 12, -8);
    return;
  }
  // closer chase/foot cameras so the hero + hero car read BIG in frame
  const back = state.inCar ? 10.5 : 6.5;
  const height = state.inCar ? 4.3 : 2.8;
  const ang = state.heading + Math.PI + dragYaw;
  const tx = px + Math.sin(ang) * back;
  const tz = pz + Math.cos(ang) * back;
  const desired = new THREE.Vector3(tx, height, tz);
  // snap when far away (e.g. right after a staged-shot teleport) so the
  // first rendered frame already frames the car/hero; otherwise lerp
  if (camera.position.distanceTo(desired) > 30) camera.position.copy(desired);
  else camera.position.lerp(desired, Math.min(1, dt * 4));
  const look = new THREE.Vector3(px + Math.sin(state.heading) * 6, state.inCar ? 1.2 : 1.6, pz + Math.cos(state.heading) * 6);
  camera.lookAt(look);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.1, clock.getDelta() || 0.016);
  const t = clock.elapsedTime;
  if (!paused && state.started) {
    updatePlayer(dt);
    updateTraffic(dt);
    crowd.update(dt, t);
    missions.update(dt, t, { x: state.playerX, z: state.playerZ }, state.inCar);
    combat.update(dt, t, { x: state.playerX, z: state.playerZ }, state.heading, state.speed);
    world.update(t, dt);
    updateObjective();
    hud.update();
  }
  updateCamera(dt);
  fpsAcc += dt; fpsN++;
  if (fpsAcc >= 1) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  renderer.render(scene, camera);
  input.endFrame();
}

const api = {
  get state() { return state; },
  get ready() { return this._ready; },
  set ready(v) { this._ready = v; },
  _ready: false,
  get fps() { return fps; },
  get errors() { return errors; },
  get scene() { return scene; },
  nearestCarDist,
  warp(x, z) { state.playerX = x; state.playerZ = z; hero.position.set(x, 0, z); },
  setPlayer(x, z, heading, inCar) {
    state.playerX = x; state.playerZ = z; state.heading = heading; state.inCar = inCar;
    hero.position.set(x, 0, z); hero.rotation.y = heading;
    hero.visible = !inCar;
    if (inCar) { heroCar.position.set(x, 0, z); heroCar.rotation.y = heading; $("prompt").classList.add("hidden"); }
    camMode = inCar ? "chase" : "foot";
  },
  setMission(mi) { missions.setMission(mi); updateObjective(); },
  setWanted(n) { combat.setWanted(n); },
  setCamera(mode) { camMode = mode; if (mode === "cover") { camera.position.set(220, 45, 235); camera.lookAt(125, 12, -8); } },
  setSpeed(mph) { state.speed = mph / 2.2; },
  placeHeliForShot() {
    // heli ahead of the car (in the chase camera's view), not behind it.
    // The orbit in combat.update() positions it from this angle, so set
    // the angle even if the heli mesh does not exist yet.
    // Offset +0.55 rad east of straight-ahead: dead-ahead puts the heli
    // right over the EMBER BAY billboard (same x as the gantry); ~10m to
    // the side keeps it fully in frame AND the billboard readable.
    combat.heliAngle = -Math.PI / 2 + 0.55;
    if (combat.heli) {
      combat.heli.position.set(
        state.playerX + Math.cos(combat.heliAngle) * 20,
        13.5,
        state.playerZ + Math.sin(combat.heliAngle) * 20 - 8);
    }
  },
  info() {
    let meshes = 0; scene.traverse((o) => { if (o.isMesh) meshes++; });
    return { meshes, buildings: world.buildings.length, peds: crowd.peds.length, traffic: traffic.length, onRoad: crowd.onRoadCount() };
  },
};

init();
