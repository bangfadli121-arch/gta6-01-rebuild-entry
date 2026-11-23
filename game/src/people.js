// EMBER BAY people — round 5, written from zero.
// Hero Kade Venn: jacket, hair, pants, shoes, walk swing — not a plain block.
// Pedestrians: varied colors/clothes, walk on sidewalks ONLY (sidewalk clamp).
const THREE = window.THREE;
import { clampToSidewalk, onRoad, GRID } from "./config.js";

function limbMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
}
function capsule(r, len, mat) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
}

// Hero: dark teal jacket, black hair, dark jeans, white sneakers.
export function makeHero() {
  const g = new THREE.Group();
  const skin = limbMat(0xe8b88a), jacket = limbMat(0x1e5a6a), jeans = limbMat(0x2c3a5a),
        hairM = limbMat(0x1a1210), shoeM = limbMat(0xf5f5f0);
  // torso (jacket) — capsule, slightly tapered look via scale
  const torso = capsule(0.26, 0.42, jacket); torso.position.y = 1.12; torso.scale.set(1.15, 1, 0.8); g.add(torso);
  // jacket collar + zipper stripe
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 14), limbMat(0x143e4c));
  collar.rotation.x = Math.PI / 2; collar.position.y = 1.42; g.add(collar);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.03), limbMat(0xd8d8d8));
  zip.position.set(0, 1.12, 0.24); g.add(zip);
  // head + hair
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), skin);
  head.position.y = 1.62; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
  hair.position.y = 1.66; hair.scale.set(1, 0.9, 1); g.add(hair);
  // arms (capsules, pivot at shoulder)
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.32, 1.38, 0);
    const arm = capsule(0.09, 0.42, jacket); arm.position.y = -0.28; pivot.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
    hand.position.y = -0.56; pivot.add(hand);
    g.add(pivot); arms.push(pivot);
  }
  // legs (pivot at hip) + shoes
  const legs = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side * 0.13, 0.82, 0);
    const leg = capsule(0.11, 0.5, jeans); leg.position.y = -0.34; pivot.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.3), shoeM);
    shoe.position.set(0, -0.68, 0.05); pivot.add(shoe);
    g.add(pivot); legs.push(pivot);
  }
  g.userData = { arms, legs, walkPhase: 0 };
  return g;
}
export function animateWalk(person, speed, dt) {
  const u = person.userData;
  u.walkPhase += dt * (4 + Math.abs(speed) * 1.4);
  const s = Math.min(1, Math.abs(speed) / 3);
  const swing = Math.sin(u.walkPhase) * 0.55 * s;
  u.legs[0].rotation.x = swing; u.legs[1].rotation.x = -swing;
  u.arms[0].rotation.x = -swing * 0.8; u.arms[1].rotation.x = swing * 0.8;
  person.position.y = Math.abs(Math.sin(u.walkPhase)) * 0.04 * s;
}

const PED_SHIRTS = [0xe85a5a, 0x5a8fd6, 0x7ed957, 0xffb347, 0xb06ad6, 0x2ec4b6, 0xf5f5f0, 0xff7ad9];
const PED_PANTS = [0x2c3a5a, 0x3a3a3a, 0x5a4632, 0x1e5a6a];
const PED_SKIN = [0xe8b88a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0];

export function makePedestrian(rnd) {
  const g = new THREE.Group();
  const shirt = limbMat(PED_SHIRTS[Math.floor(rnd() * PED_SHIRTS.length)]);
  const pants = limbMat(PED_PANTS[Math.floor(rnd() * PED_PANTS.length)]);
  const skin = limbMat(PED_SKIN[Math.floor(rnd() * PED_SKIN.length)]);
  const torso = capsule(0.24, 0.4, shirt); torso.position.y = 1.08; torso.scale.set(1.1, 1, 0.8); g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), skin);
  head.position.y = 1.58; g.add(head);
  if (rnd() < 0.35) { // hat
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.1, 12),
      limbMat([0xffb347, 0x2ec4b6, 0xe85a5a][Math.floor(rnd() * 3)]));
    hat.position.y = 1.76; g.add(hat);
  } else { // hair cap
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
      limbMat(0x1a1210));
    hair.position.y = 1.62; g.add(hair);
  }
  const arms = [], legs = [];
  for (const side of [-1, 1]) {
    const ap = new THREE.Group(); ap.position.set(side * 0.3, 1.34, 0);
    const arm = capsule(0.08, 0.4, shirt); arm.position.y = -0.26; ap.add(arm);
    g.add(ap); arms.push(ap);
    const lp = new THREE.Group(); lp.position.set(side * 0.12, 0.8, 0);
    const leg = capsule(0.1, 0.48, pants); leg.position.y = -0.32; lp.add(leg);
    g.add(lp); legs.push(lp);
  }
  g.userData = { arms, legs, walkPhase: rnd() * 6.28 };
  return g;
}

export function makePedestrians(scene, count = 60) {
  const rnd = (() => { let t = 987654; return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; }; })();
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePedestrian(rnd);
    // spawn on a sidewalk: pick a street, offset onto its sidewalk band
    const street = GRID.streets[Math.floor(rnd() * GRID.streets.length)];
    const along = (rnd() - 0.5) * 380;
    const side = rnd() < 0.5 ? -1 : 1;
    const p = { x: 0, z: 0 };
    if (rnd() < 0.5) { p.x = street + side * 6.8; p.z = along; }
    else { p.x = along; p.z = street + side * 6.8; }
    clampToSidewalk(p);
    mesh.position.set(p.x, 0, p.z);
    mesh.rotation.y = rnd() * Math.PI * 2;
    scene.add(mesh);
    peds.push({
      mesh, heading: rnd() * Math.PI * 2, speed: 0.8 + rnd() * 0.9,
      turnTimer: 2 + rnd() * 4,
    });
  }
  return peds;
}
export function updatePedestrians(peds, dt) {
  for (const p of peds) {
    p.turnTimer -= dt;
    if (p.turnTimer <= 0) {
      p.turnTimer = 2 + Math.random() * 4;
      // turn onto the other axis or reverse — always along a sidewalk
      p.heading += (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) * (Math.random() < 0.7 ? 1 : 2);
    }
    const nx = p.mesh.position.x + Math.sin(p.heading) * p.speed * dt;
    const nz = p.mesh.position.z + Math.cos(p.heading) * p.speed * dt;
    if (onRoad(nx, nz) || Math.abs(nx) > 198 || Math.abs(nz) > 198) {
      p.heading += Math.PI / 2; // turn away from road / edge
      continue;
    }
    p.mesh.position.x = nx; p.mesh.position.z = nz;
    p.mesh.rotation.y = p.heading;
    animateWalk(p.mesh, p.speed, dt);
  }
}
