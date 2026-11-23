import * as THREE from "three";
import { RoundedBoxGeometry } from "../vendor/RoundedBoxGeometry.min.js";
// combat.js — weapon wheel, wanted level, police chase + roadblock + heli.
import { CFG } from "./config.js";
import { buildPoliceCar, buildHelicopter } from "./vehicles.js";

export class Combat {
  constructor(scene, state, makePolice) {
    this.scene = scene;
    this.state = state;
    this.makePolice = makePolice || (() => buildPoliceCar(null));
    this.police = [];
    this.roadblocks = [];
    this.heli = null;
    this.heliAngle = 0;
  }

  setWanted(n) {
    this.state.wanted = Math.max(0, Math.min(5, n));
    this.syncPolice();
  }

  syncPolice() {
    const want = this.state.wanted >= 2 ? 2 : this.state.wanted >= 1 ? 1 : 0;
    while (this.police.length < want) {
      const p = this.makePolice();
      this.scene.add(p); this.police.push({ mesh: p, speed: 14 + Math.random() * 4, offset: Math.random() * Math.PI * 2 });
    }
    while (this.police.length > want) {
      const p = this.police.pop(); this.scene.remove(p.mesh);
    }
    // roadblock at 3+ stars
    if (this.state.wanted >= 3 && this.roadblocks.length === 0) {
      for (const s of [-6, 0, 6]) {
        const b = new THREE.Mesh(new RoundedBoxGeometry(2.2, 1.1, 1.2, 1, 0.12),
          new THREE.MeshLambertMaterial({ color: 0xff5a2a }));
        b.position.set(42 + s, 0.55, -42);
        this.scene.add(b); this.roadblocks.push(b);
      }
    }
    if (this.state.wanted < 3) {
      for (const b of this.roadblocks) this.scene.remove(b);
      this.roadblocks = [];
    }
    // helicopter at 4+ stars
    if (this.state.wanted >= 4 && !this.heli) {
      this.heli = buildHelicopter();
      this.scene.add(this.heli);
    }
    if (this.state.wanted < 4 && this.heli) {
      this.scene.remove(this.heli); this.heli = null;
    }
  }

  cycleWeapon() {
    const cur = this.state.weaponIdx;
    let next = (cur + 1) % CFG.weapons.length;
    for (let i = 0; i < CFG.weapons.length; i++) {
      const w = CFG.weapons[next];
      if (this.state.respect >= w.lock) { this.state.weaponIdx = next; this.state.weapon = w.name; return w.name; }
      next = (next + 1) % CFG.weapons.length;
    }
    return CFG.weapons[cur].name;
  }

  update(dt, t, playerPos, playerAngle, speed) {
    // police chase: circle in behind the player, flashing light bars
    this.police.forEach((p, i) => {
      const a = playerAngle + Math.PI + p.offset + Math.sin(t * 0.4 + i) * 0.4;
      const r = 12 + Math.sin(t * 0.7 + i * 2) * 3;
      const tx = playerPos.x + Math.cos(a) * r, tz = playerPos.z + Math.sin(a) * r;
      p.mesh.position.x += (tx - p.mesh.position.x) * Math.min(1, dt * 1.5);
      p.mesh.position.z += (tz - p.mesh.position.z) * Math.min(1, dt * 1.5);
      p.mesh.rotation.y = Math.atan2(playerPos.x - p.mesh.position.x, playerPos.z - p.mesh.position.z);
      const bar = p.mesh.userData.lightBar;
      if (bar) {
        const on = Math.floor(t * 6 + i) % 2 === 0;
        bar.userData.red.material.color.setHex(on ? 0xff2020 : 0x550000);
        bar.userData.blue.material.color.setHex(on ? 0x101050 : 0x2050ff);
      }
    });
    // heli orbits overhead, fully visible, spotlight on the player.
    // Close + low (radius 12, height 9m — was 20 / 13.5): the heli sits
    // in the upper frame, BIG, instead of a small dot at the top edge
    // (fadli: "polisi heli mana").
    if (this.heli) {
      this.heliAngle += dt * 0.35;
      this.heli.position.set(
        playerPos.x + Math.cos(this.heliAngle) * 12,
        9 + Math.sin(t * 0.8) * 1.0,
        playerPos.z + Math.sin(this.heliAngle) * 12 - 8);
      this.heli.rotation.y = -this.heliAngle;
      this.heli.userData.mainRotor.rotation.y = t * 22;
      this.heli.userData.tailRotor.rotation.z = t * 30;
      this.heli.userData.cone.position.set(1.2, -9, 0);
      // aim the cone at the player
      const dx = playerPos.x - this.heli.position.x, dz = playerPos.z - this.heli.position.z;
      this.heli.userData.cone.rotation.z = Math.atan2(dx, -9) * 0.4;
      this.heli.userData.cone.rotation.x = Math.PI + Math.atan2(dz, -9) * 0.4;
    }
    // wanted decays slowly when driving calmly
    if (this.state.wanted > 0 && Math.abs(speed) < 2 && this.state.mission !== 5) {
      this.state.wantedTimer = (this.state.wantedTimer || 0) + dt;
      if (this.state.wantedTimer > 25) { this.setWanted(this.state.wanted - 1); this.state.wantedTimer = 0; }
    } else this.state.wantedTimer = 0;
  }
}
