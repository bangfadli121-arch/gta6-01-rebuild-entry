// vehicles.js — cars + helicopter, all forward along +Z (glTF convention).
// Hero = Kenney race.glb (CC0) repainted Skyline blue + Skyline details.
// Traffic / police = Kenney car GLBs. Procedural RoundedBox fallback if a
// GLB fails to load.
import * as THREE from "three";
import { RoundedBoxGeometry } from "../vendor/RoundedBoxGeometry.min.js";

const BLUE = 0x1e56d8;

// Find the named wheel nodes of a Kenney car (wheel-front-left, etc.).
export function findWheels(car) {
  const wheels = [];
  car.traverse((o) => {
    if (o.isMesh && o.name && o.name.startsWith("wheel")) wheels.push(o);
  });
  return wheels;
}

// ---- Hero Skyline from the Kenney race.glb ----
export function buildSkyline(raceModel) {
  const car = new THREE.Group();
  if (raceModel) {
    const body = raceModel.clone(true);
    // repaint the body mesh Skyline blue (keep wheels as-is)
    const blueMat = new THREE.MeshStandardMaterial({ color: BLUE, metalness: 0.7, roughness: 0.3 });
    body.traverse((o) => {
      if (o.isMesh && o.name === "body") o.material = blueMat;
    });
    // Kenney race car is ~2 wide x 2.56 long; scale to Skyline size (2.0 x 4.6)
    const box = new THREE.Box3().setFromObject(body);
    const size = new THREE.Vector3(); box.getSize(size);
    const s = Math.min(2.0 / (size.x || 1), 4.6 / (size.z || 1));
    body.scale.setScalar(s);
    // centre on ground
    const box2 = new THREE.Box3().setFromObject(body);
    body.position.y -= box2.min.y;
    car.add(body);
    car.userData.wheels = findWheels(body);
    car.userData.kenney = true;
  } else {
    // procedural fallback: rounded low coupe, forward +Z
    const fallback = buildProceduralCoupe(BLUE);
    car.add(fallback);
    car.userData.wheels = fallback.userData.wheels;
  }
  // --- Skyline identity details (added on top, forward +Z) ---
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181f, metalness: 0.4, roughness: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.15 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, metalness: 0.3, roughness: 0.4 });
  // GT spoiler (rear, -Z): thin wing on two struts. The wing spans the
  // car's WIDTH (x) — a wing running lengthwise (0.5 x, 1.9 z) reads as a
  // center fin from behind, not a spoiler.
  const wing = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.06, 0.5, 1, 0.03), new THREE.MeshStandardMaterial({ color: BLUE, metalness: 0.7, roughness: 0.3 }));
  wing.position.set(0, 1.28, -2.25); wing.rotation.x = 0.1; car.add(wing);
  for (const sx of [-0.7, 0.7]) {
    const strut = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.4, 0.08, 1, 0.02), dark);
    strut.position.set(sx, 1.02, -2.25); car.add(strut);
  }
  // twin white stripes over the top (hood / roof / trunk)
  for (const sx of [-0.3, 0.3]) {
    const stripe = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.02, 4.3, 1, 0.01), white);
    stripe.position.set(sx, 1.38, 0); car.add(stripe);
  }
  // 4 round chrome-ring taillights (rear face, -Z)
  for (const tx of [-0.62, -0.22, 0.22, 0.62]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 20), chrome);
    ring.position.set(tx, 0.62, -2.32); car.add(ring);
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), new THREE.MeshBasicMaterial({ color: 0xff2a1e }));
    lamp.position.set(tx, 0.62, -2.33); lamp.rotation.y = Math.PI; car.add(lamp);
  }
  // round headlights (front, +Z)
  for (const hx of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    hl.position.set(hx, 0.6, 2.32); car.add(hl);
  }
  // white side skirts
  for (const s of [-1, 1]) {
    const skirt = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.1, 3.6, 1, 0.03), white);
    skirt.position.set(s * 1.0, 0.26, 0); car.add(skirt);
  }
  return car;
}

// Procedural fallback coupe (rounded, forward +Z) — used only if race.glb fails.
function buildProceduralCoupe(color) {
  const car = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101c26, metalness: 0.9, roughness: 0.12 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.62, 4.6, 1, 0.14), mat);
  body.position.y = 0.55; car.add(body);
  const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.5, 2.2, 1, 0.12), glass);
  cabin.position.set(0, 1.05, -0.3); car.add(cabin);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.5], [0.95, 1.5], [-0.95, -1.5], [0.95, -1.5]]) {
    const wg = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 18), dark);
    tire.rotation.z = Math.PI / 2; wg.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 1, roughness: 0.2 }));
    rim.rotation.z = Math.PI / 2; wg.add(rim);
    wg.position.set(wx, 0.4, wz);
    car.add(wg); wheels.push(wg);
  }
  car.userData.wheels = wheels;
  return car;
}

// ---- Traffic car from a Kenney GLB (cloned) ----
export function buildTrafficCar(model) {
  if (!model) return buildProceduralCoupe(0xd94f4f);
  const car = model.clone(true);
  const box = new THREE.Box3().setFromObject(car);
  const size = new THREE.Vector3(); box.getSize(size);
  const s = Math.min(2.0 / (size.x || 1), 4.4 / (size.z || 1));
  car.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(car);
  car.position.y -= box2.min.y;
  car.userData.wheels = findWheels(car);
  return car;
}

// ---- Police interceptor from the Kenney police.glb ----
export function buildPoliceCar(policeModel) {
  let car;
  if (policeModel) {
    car = policeModel.clone(true);
    const box = new THREE.Box3().setFromObject(car);
    const size = new THREE.Vector3(); box.getSize(size);
    const s = Math.min(2.0 / (size.x || 1), 4.4 / (size.z || 1));
    car.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(car);
    car.position.y -= box2.min.y;
    car.userData.wheels = findWheels(car);
  } else {
    car = buildProceduralCoupe(0x1a1a1e);
  }
  // light bar (red/blue, flashing via combat.js / updateTraffic).
  // BIG: wide white base + tall beacons, so it reads as POLICE from 30m+.
  const bar = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.1, 0.4, 1, 0.02), new THREE.MeshStandardMaterial({ color: 0xf2f2ee }));
  base.position.y = 1.14; bar.add(base);
  const red = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.26, 0.34, 1, 0.04), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
  red.position.set(-0.42, 1.3, 0); bar.add(red);
  const blue = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.26, 0.34, 1, 0.04), new THREE.MeshBasicMaterial({ color: 0x2050ff }));
  blue.position.set(0.42, 1.3, 0); bar.add(blue);
  bar.userData.red = red; bar.userData.blue = blue;
  car.add(bar);
  car.userData.lightBar = bar;
  // black-white two-tone: black roof panel + black side stripes, so the
  // cruiser reads as POLICE at a glance (the Kenney texture is mostly
  // white, so at distance it looked like any white traffic car).
  const black = new THREE.MeshStandardMaterial({ color: 0x0c0e12, metalness: 0.4, roughness: 0.5 });
  const roof = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.06, 1.7, 1, 0.02), black);
  roof.position.set(0, 1.08, -0.2); car.add(roof);
  for (const s of [-1, 1]) {
    const stripe = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.34, 3.4, 1, 0.02), black);
    stripe.position.set(s * 1.0, 0.62, 0); car.add(stripe);
  }
  return car;
}

// ---- Police helicopter (procedural, RoundedBox parts) ----
export function buildHelicopter() {
  const heli = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, metalness: 0.6, roughness: 0.35 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, metalness: 0.4, roughness: 0.4 });
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.2, 6, 12), bodyMat);
  fus.rotation.x = Math.PI / 2; heli.add(fus);
  const belly = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.7, 2.6, 1, 0.15), whiteMat);
  belly.position.y = -0.6; heli.add(belly);
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), new THREE.MeshStandardMaterial({ color: 0x9fd8e8, metalness: 0.9, roughness: 0.1 }));
  cockpit.scale.set(0.9, 0.8, 1.1); cockpit.position.set(0, 0.25, 1.5); heli.add(cockpit);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 3.6, 8), bodyMat);
  boom.rotation.x = Math.PI / 2; boom.position.set(0, 0.35, -2.8); heli.add(boom);
  // white stripe along the tail boom: the dark navy heli needs a bright
  // mark to read against the dusk sky at a glance.
  const boomStripe = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.1, 3.2, 1, 0.02), whiteMat);
  boomStripe.position.set(0, 0.68, -2.8); heli.add(boomStripe);
  const fin = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.3, 0.15, 1, 0.05), bodyMat);
  fin.position.set(0, 0.9, -4.4); heli.add(fin);
  const tailRotor = new THREE.Group();
  const tr1 = new THREE.Mesh(new RoundedBoxGeometry(0.12, 1.6, 0.08, 1, 0.02), new THREE.MeshStandardMaterial({ color: 0x222226 }));
  tailRotor.add(tr1);
  const tr2 = tr1.clone(); tr2.rotation.z = Math.PI / 2; tailRotor.add(tr2);
  tailRotor.position.set(0.4, 0.5, -4.5); heli.add(tailRotor);
  const mainRotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.5, roughness: 0.5 });
  for (let i = 0; i < 2; i++) {
    // 8.6m blades (was 7.2): a wider rotor disc reads bigger in frame.
    const blade = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.07, 8.6, 1, 0.03), bladeMat);
    if (i === 1) blade.rotation.y = Math.PI / 2;
    mainRotor.add(blade);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 8), bladeMat);
  mast.position.y = -0.3; mainRotor.add(mast);
  mainRotor.position.y = 1.5; heli.add(mainRotor);
  for (const s of [-0.7, 0.7]) {
    const skid = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.09, 3.0, 1, 0.03), bladeMat);
    skid.position.set(s, -1.25, 0); heli.add(skid);
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.5, 0.09, 1, 0.02), bladeMat);
      leg.position.set(s, -1.0, sz); heli.add(leg);
    }
  }
  // spotlight cone: wider + more opaque (was r4.2 / 0.22) so the beam is
  // unmistakable in the chase frame.
  const cone = new THREE.Mesh(new THREE.ConeGeometry(5.0, 16, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  cone.position.set(0, -9, 1.2); cone.rotation.x = Math.PI; heli.add(cone);
  const spot = new THREE.SpotLight(0xfff2b0, 60, 60, 0.35, 0.5, 1.2);
  spot.position.set(0, -1, 1.2);
  const spotTarget = new THREE.Object3D(); spotTarget.position.set(0, -18, 1.2);
  heli.add(spotTarget); spot.target = spotTarget; heli.add(spot);
  heli.userData.mainRotor = mainRotor; heli.userData.tailRotor = tailRotor; heli.userData.cone = cone;
  return heli;
}
