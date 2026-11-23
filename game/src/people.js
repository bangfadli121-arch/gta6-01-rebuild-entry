import * as THREE from "three";
import { RoundedBoxGeometry } from "../vendor/RoundedBoxGeometry.js";
// people.js — pedestrians (varied, sidewalk-clamped, walking) and the
// hero Kade Venn (jacket, hair, pants, shoes, walk animation).
import { CFG } from "./config.js";

const SHIRTS = [0xff5a8a, 0x2ec4b6, 0xffd76a, 0x7ed957, 0x7ec8e3, 0xff8a5e, 0xb07fd6, 0xf2f2ee, 0xff7fa8, 0x4a9e3f];
const PANTS = [0x2a2a33, 0x3a4a6b, 0x5a3a2a, 0x4a4a52, 0x1c2733];
const SKINS = [0xf2c9a0, 0xd9a066, 0x8a5a34, 0xffd9b0];

// A pedestrian: torso + head + hair/cap + legs that swing while walking.
export function buildPedestrian(seed) {
  const r = mulberry(seed);
  const g = new THREE.Group();
  const shirt = SHIRTS[Math.floor(r() * SHIRTS.length)];
  const pants = PANTS[Math.floor(r() * PANTS.length)];
  const skin = SKINS[Math.floor(r() * SKINS.length)];
  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.72, 0.36, 1, 0.08),
    new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.05; g.add(torso);
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.4, 0.38, 1, 0.08), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.62; g.add(head);
  if (r() < 0.45) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: [0xff2a1e, 0x2e6f9e, 0xffd76a, 0x222226][Math.floor(r() * 4)] }));
    cap.position.y = 1.85; g.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshLambertMaterial({ color: [0x1a1a1a, 0x4a2e12, 0x8a8a8a][Math.floor(r() * 3)] }));
    hair.scale.y = 0.6; hair.position.y = 1.82; g.add(hair);
  }
  const legs = [];
  for (const s of [-0.16, 0.16]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.68, 0.24, 1, 0.05), new THREE.MeshLambertMaterial({ color: pants }));
    leg.position.set(s, 0.36, 0); g.add(leg); legs.push(leg);
  }
  const arms = [];
  for (const s of [-0.38, 0.38]) {
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.6, 0.18, 1, 0.05), new THREE.MeshLambertMaterial({ color: shirt }));
    arm.position.set(s, 1.05, 0); g.add(arm); arms.push(arm);
  }
  g.userData.legs = legs; g.userData.arms = arms;
  return g;
}

function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sidewalk lanes: pedestrians walk parallel to roads, on the sidewalk strip
// (road edge + sidewalk width). Never on asphalt.
export function sidewalkLane() {
  // pick a road line, then a side, then a position along it
  // (use the inner 9 roads so the outer sidewalk never passes the
  // ±205 wrap boundary and lands on the edge road's asphalt)
  const road = (Math.floor(Math.random() * 9) - 4) * CFG.roadSpacing;
  const side = Math.random() < 0.5 ? -1 : 1;
  const off = CFG.roadWidth / 2 + 1.2 + Math.random() * 2.2; // on the sidewalk
  const along = (Math.random() * 2 - 1) * 200;
  if (Math.random() < 0.5) return { x: road + side * off, z: along, dir: along > 0 ? 1 : -1, axis: "z" };
  return { x: along, z: road + side * off, dir: along > 0 ? 1 : -1, axis: "x" };
}

export class PedCrowd {
  constructor(scene) {
    this.scene = scene;
    this.peds = [];
    for (let i = 0; i < CFG.pedCount; i++) {
      const p = buildPedestrian(1000 + i * 77);
      const lane = sidewalkLane();
      p.position.set(lane.x, 0, lane.z);
      p.userData.lane = lane;
      p.userData.speed = 1.1 + Math.random() * 0.9;
      p.userData.phase = Math.random() * Math.PI * 2;
      p.userData.turnAt = 4 + Math.random() * 10;
      scene.add(p);
      this.peds.push(p);
    }
  }
  update(dt, t) {
    for (const p of this.peds) {
      const u = p.userData;
      u.turnAt -= dt;
      if (u.turnAt <= 0) {
        // usually just turn around and walk back along the SAME lane
        // (teleporting to a new lane pops visibly); sometimes switch streets
        if (Math.random() < 0.7) {
          u.lane.dir *= -1;
        } else {
          const lane = sidewalkLane();
          p.position.x = lane.x; p.position.z = lane.z;
          u.lane = lane;
        }
        u.turnAt = 6 + Math.random() * 12;
      }
      const lane = u.lane;
      const step = u.speed * dt * lane.dir;
      if (lane.axis === "z") p.position.z += step; else p.position.x += step;
      // wrap around the city edge
      if (p.position.x > 205) p.position.x = -205;
      if (p.position.x < -205) p.position.x = 205;
      if (p.position.z > 205) p.position.z = -205;
      if (p.position.z < -205) p.position.z = 205;
      // face movement direction
      p.rotation.y = lane.axis === "z" ? (lane.dir > 0 ? 0 : Math.PI) : (lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      // walk swing
      const sw = Math.sin(t * 7 + u.phase) * 0.45;
      u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
      u.arms[0].rotation.x = -sw * 0.7; u.arms[1].rotation.x = sw * 0.7;
    }
  }
  // test helper: how many are on asphalt right now.
  // A ped walks ALONGSIDE one road (its lane axis), so it is only "on
  // road" if it is within the asphalt half-width of THAT road's
  // centerline; crossing a perpendicular road at an intersection (on the
  // sidewalk / crosswalk) does not count.
  onRoadCount() {
    let n = 0;
    for (const p of this.peds) {
      const lane = p.userData.lane;
      if (lane.axis === "z") {
        const fx = Math.abs(((p.position.x % CFG.roadSpacing) + CFG.roadSpacing * 1.5) % CFG.roadSpacing - CFG.roadSpacing / 2);
        if (fx < CFG.roadWidth / 2) n++;
      } else {
        const fz = Math.abs(((p.position.z % CFG.roadSpacing) + CFG.roadSpacing * 1.5) % CFG.roadSpacing - CFG.roadSpacing / 2);
        if (fz < CFG.roadWidth / 2) n++;
      }
    }
    return n;
  }
}

// Hero Kade Venn: teal jacket, dark hair, jeans, white shoes, walk animation.
export function buildHero() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f7a6e });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xf2c9a0 });
  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.78, 0.4, 1, 0.1), jacket);
  torso.position.y = 1.08; g.add(torso);
  // jacket collar + zipper stripe
  const collar = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.14, 0.06, 1, 0.03), new THREE.MeshLambertMaterial({ color: 0x0f3a34 }));
  collar.position.set(0, 1.44, 0.21); g.add(collar);
  const zip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.02), new THREE.MeshLambertMaterial({ color: 0xd8dde2 }));
  zip.position.set(0, 1.08, 0.21); g.add(zip);
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.42, 0.4, 1, 0.09), skin);
  head.position.y = 1.68; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.scale.set(1, 0.65, 1); hair.position.y = 1.9; g.add(hair);
  const legs = [];
  for (const s of [-0.17, 0.17]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.72, 0.26, 1, 0.06), jeans);
    leg.position.set(s, 0.38, 0); g.add(leg); legs.push(leg);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.12, 0.42, 1, 0.04), new THREE.MeshLambertMaterial({ color: 0xf5f5f0 }));
    shoe.position.set(s, 0.06, 0.06); g.add(shoe);
  }
  const arms = [];
  for (const s of [-0.4, 0.4]) {
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.64, 0.2, 1, 0.06), jacket);
    arm.position.set(s, 1.08, 0); g.add(arm); arms.push(arm);
  }
  g.userData.legs = legs; g.userData.arms = arms;
  return g;
}
