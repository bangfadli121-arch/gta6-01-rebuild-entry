import * as THREE from "three";
import { RoundedBoxGeometry } from "../vendor/RoundedBoxGeometry.min.js";
// missions.js — 8 story missions, objective markers, checkpoints, crates.
import { CFG } from "./config.js";

export class Missions {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.marker = null;
    this.checkpoints = [];
    this.crates = [];
    this.timer = 0;
    this.buildMarker();
  }

  buildMarker() {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.12; g.add(disc);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 7; g.add(beam);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(0.9),
      new THREE.MeshBasicMaterial({ color: 0xffd76a }));
    diamond.position.y = 5.2; g.add(diamond);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xff9a4d }));
    cone.rotation.x = Math.PI; cone.position.y = 1.6; g.add(cone);
    g.userData.diamond = diamond;
    this.marker = g;
    scene_add(this.scene, g);
  }

  // objective positions per mission
  objectiveFor(mi) {
    switch (mi) {
      case 1: return { x: 24, z: 164 };            // hero car spawn
      case 2: return { x: -168, z: 126 };          // Mara at Portside
      case 3: return { x: 84, z: 84 };             // race start (Neon Row)
      case 4: return { x: -126, z: -84 };          // Cinder Docks crates
      case 5: return { x: 0, z: 0 };               // getaway (anywhere)
      case 6: return { x: 120, z: -120 };          // Air One pickup
      case 7: return { x: -84, z: -126 };          // Cinder Run drops
      case 8: return { x: 168, z: 42 };            // Ember GT (coastal road)
      default: return { x: 0, z: 0 };
    }
  }

  setMission(mi) {
    this.state.mission = mi;
    this.clearDynamic();
    const o = this.objectiveFor(mi);
    this.marker.position.set(o.x, 0, o.z);
    this.marker.visible = mi !== 5;
    if (mi === 3) {
      // 4 race checkpoints around Neon Row
      const pts = [[84, 84], [126, 42], [126, -42], [42, -84]];
      pts.forEach(([x, z], i) => {
        const cp = new THREE.Mesh(new THREE.TorusGeometry(3, 0.3, 8, 24),
          new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffd76a : 0x2ec4b6 }));
        cp.position.set(x, 2.5, z); cp.rotation.y = Math.PI / 2;
        this.scene.add(cp); this.checkpoints.push(cp);
      });
      this.state.raceIdx = 0;
    }
    if (mi === 4 || mi === 7) {
      const base = mi === 4 ? [-126, -84] : [-84, -126];
      for (let i = 0; i < 3; i++) {
        const crate = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.4, 1.4, 1, 0.12),
          new THREE.MeshLambertMaterial({ color: 0xffd76a }));
        crate.position.set(base[0] + (i - 1) * 6, 0.7, base[1] + (i % 2) * 5);
        this.scene.add(crate); this.crates.push(crate);
      }
      this.state.cratesGot = 0;
    }
    if (mi === 5) this.timer = 60;
    if (mi === 6) this.state.wanted = 4;
  }

  clearDynamic() {
    for (const c of this.checkpoints) this.scene.remove(c);
    for (const c of this.crates) this.scene.remove(c);
    this.checkpoints = []; this.crates = [];
  }

  update(dt, t, playerPos, inCar) {
    if (this.marker.visible) {
      this.marker.userData.diamond.rotation.y = t * 1.5;
      this.marker.userData.diamond.position.y = 5.2 + Math.sin(t * 2) * 0.35;
    }
    const mi = this.state.mission;
    const o = this.objectiveFor(mi);
    const d = Math.hypot(playerPos.x - o.x, playerPos.z - o.z);
    // mission 1: enter the car
    if (mi === 1 && inCar) this.complete("First Wheels complete — $200");
    // mission 2: reach Mara
    if (mi === 2 && d < 8) this.complete("Portside Pickup complete — $300");
    // mission 3: race checkpoints
    if (mi === 3 && this.checkpoints.length) {
      const cp = this.checkpoints[this.state.raceIdx];
      // pulse the NEXT checkpoint so the player always sees where to go
      if (cp) { const s = 1 + Math.sin(t * 5) * 0.12; cp.scale.set(s, s, s); }
      if (cp && Math.hypot(playerPos.x - cp.position.x, playerPos.z - cp.position.z) < 7) {
        this.state.raceIdx++;
        if (this.state.raceIdx >= this.checkpoints.length) this.complete("Neon Row Nights — you won the race! $500");
        else this.state.toast = `Checkpoint ${this.state.raceIdx}/4`;
      }
    }
    // missions 4 & 7: crates
    if ((mi === 4 || mi === 7) && this.crates.length) {
      for (let i = this.crates.length - 1; i >= 0; i--) {
        const c = this.crates[i];
        if (Math.hypot(playerPos.x - c.position.x, playerPos.z - c.position.z) < 3.2) {
          this.scene.remove(c); this.crates.splice(i, 1);
          this.state.cratesGot++;
          this.state.toast = `Crate ${this.state.cratesGot}/3`;
          if (this.state.cratesGot >= 3) this.complete(mi === 4 ? "Dockside Trouble complete — $400" : "Cinder Run complete — $500");
        }
      }
    }
    // mission 5: survive 60s
    if (mi === 5) {
      this.timer -= dt;
      this.state.escapeLeft = Math.max(0, this.timer);
      if (this.timer <= 0) this.complete("Getaway Driver — you lost the heat! $450");
    }
    // mission 6: reach the pickup while heli hunts (complete on arrival)
    if (mi === 6 && d < 8) this.complete("Air One — you slipped the heli! $550");
    // mission 8: reach the Ember GT
    if (mi === 8 && d < 8) this.complete("The Ember Crown — the Ember GT is yours! $1000");
  }

  complete(msg) {
    const reward = { 1: 200, 2: 300, 3: 500, 4: 400, 5: 450, 6: 550, 7: 500, 8: 1000 }[this.state.mission] || 0;
    this.state.cash += reward;
    this.state.respect += 120;
    this.state.toast = msg;
    this.state.wanted = Math.max(0, this.state.wanted - 2);
    if (this.state.mission >= 8) {
      this.state.toast = "EMBER KING — the island is yours!";
      this.state.mission = 8;
    } else {
      this.setMission(this.state.mission + 1);
    }
  }
}

function scene_add(scene, obj) { scene.add(obj); }
