// EMBER BAY missions — round 5, written from zero.
// 8 story missions. Marker = glowing disc + light beam + ring + diamond + cone.
const THREE = window.THREE;
import { MISSIONS } from "./config.js";

export function makeMarker(color = 0xffd23e) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.12, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }));
  disc.position.y = 0.1; g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.18; g.add(ring);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.4, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  beam.position.y = 15; g.add(beam);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.4),
    new THREE.MeshBasicMaterial({ color }));
  diamond.position.y = 4.6; g.add(diamond);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.2, 4),
    new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
  cone.rotation.x = Math.PI; cone.position.y = 7; g.add(cone);
  g.userData.diamond = diamond;
  return g;
}

// Mission targets (world coords). Checkpoints for the race.
const RACE_GATES = [
  { x: -20, z: -60 }, { x: 60, z: 20 }, { x: -60, z: 100 }, { x: 20, z: -140 },
];
const CRATES = [
  { x: -140, z: -120 }, { x: -160, z: 40 }, { x: -120, z: 140 },
];
const DROPS = [
  { x: 140, z: -100 }, { x: -40, z: 160 }, { x: 100, z: 60 },
];

export function makeMissionSystem(scene, state) {
  const marker = makeMarker();
  scene.add(marker);
  const crates = [];
  for (const c of CRATES) {
    const crate = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.8 }));
    // bevel the crate look with edge lines
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry),
      new THREE.LineBasicMaterial({ color: 0x7a4a10 }));
    box.add(edge); box.position.y = 0.8; crate.add(box);
    crate.position.set(c.x, 0, c.z); crate.visible = false; scene.add(crate);
    crates.push(crate);
  }
  const sys = {
    marker, crates, gate: 0, crateCount: 0, dropCount: 0, timer: 0,
    setMission(i) {
      state.mission = i;
      this.gate = 0; this.crateCount = 0; this.dropCount = 0; this.timer = 0;
      crates.forEach(c => c.visible = (i === 4));
      const t = this.target();
      if (t) { marker.visible = true; marker.position.set(t.x, 0, t.z); }
      else marker.visible = false;
    },
    target() {
      const m = state.mission;
      if (m === 1) return state.heroCarPos;           // the Skyline
      if (m === 2) return { x: -160, z: 60 };        // Mara at Portside
      if (m === 3) return RACE_GATES[this.gate];     // race gates
      if (m === 4) return CRATES[this.crateCount];   // crates
      if (m === 5) return null;                      // survive (no marker)
      if (m === 6) return { x: 160, z: 160 };        // escape point, Sunset Beach
      if (m === 7) return DROPS[this.dropCount];     // drops
      if (m === 8) return { x: 20, z: -20 };         // Ember GT, Neon Row
      return null;
    },
    update(dt, ctx) {
      marker.userData.diamond.rotation.y += dt * 2;
      marker.userData.diamond.position.y = 4.2 + Math.sin(performance.now() * 0.003) * 0.4;
      const m = state.mission;
      if (m === 5) { // Getaway Driver: 60 s timer
        this.timer += dt;
        if (this.timer >= 60) { ctx.completeMission(); }
        return;
      }
      if (m === 6) { // Air One: reach the escape point
        const t = this.target();
        if (ctx.distTo(t) < 6) ctx.completeMission();
        return;
      }
      const t = this.target();
      if (!t) return;
      const d = ctx.distTo(t);
      if (m === 1 && ctx.inCar && d < 8) { ctx.completeMission(); return; }
      if (m === 2 && d < 6) { ctx.completeMission(); return; }
      if (m === 3 && d < 7) {
        this.gate++;
        if (this.gate >= RACE_GATES.length) { ctx.completeMission(); return; }
        const nt = this.target(); marker.position.set(nt.x, 0, nt.z);
        return;
      }
      if (m === 4 && d < 3.5 && !ctx.inCar) {
        crates[this.crateCount].visible = false;
        this.crateCount++;
        if (this.crateCount >= CRATES.length) { ctx.completeMission(); return; }
        const nt = this.target(); marker.position.set(nt.x, 0, nt.z);
        crates[this.crateCount].visible = true;
        return;
      }
      if (m === 7 && d < 6) {
        this.dropCount++;
        if (this.dropCount >= DROPS.length) { ctx.completeMission(); return; }
        const nt = this.target(); marker.position.set(nt.x, 0, nt.z);
        return;
      }
      if (m === 8 && d < 6) { ctx.completeMission(); return; }
    },
    missionInfo() {
      const m = MISSIONS[state.mission - 1];
      let obj = m.obj, stage = "";
      if (state.mission === 3) stage = `GATE ${this.gate}/4`;
      if (state.mission === 4) stage = `CRATE ${this.crateCount}/3`;
      if (state.mission === 5) stage = `ESCAPE ${Math.max(0, 60 - Math.floor(this.timer))}s`;
      if (state.mission === 7) stage = `DROP ${this.dropCount}/3`;
      return { title: m.title, obj, next: m.next, stage };
    },
  };
  sys.setMission(1);
  return sys;
}
