// EMBER BAY combat + wanted — round 5, written from zero.
// Weapon wheel (1-7 / Q), hitscan shooting, wanted 1-5, police pursuit,
// roadblock at 3 stars, helicopter at 4 stars with spotlight.
const THREE = window.THREE;
import { WEAPONS } from "./config.js";
import { makePoliceCar, makeHelicopter, makeCarState, updateCar } from "./vehicles.js";

export function makeCombat(scene, state, world) {
  const police = [];   // {mesh, state, lightPhase}
  const heli = { mesh: null, active: false };
  let roadblock = [];
  let wanted = 0;
  let shootCooldown = 0;
  let muzzle = null;

  function spawnPolice(x, z) {
    const mesh = makePoliceCar();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const p = { mesh, car: makeCarState(x, z, 0), lightPhase: Math.random() * 6 };
    police.push(p);
    return p;
  }
  function spawnHeli() {
    if (heli.mesh) return;
    const mesh = makeHelicopter();
    mesh.position.set(state.playerX + 30, 22, state.playerZ - 20);
    scene.add(mesh);
    heli.mesh = mesh; heli.active = true;
  }
  function removeHeli() {
    if (!heli.mesh) return;
    scene.remove(heli.mesh); heli.mesh = null; heli.active = false;
  }
  function setRoadblock(on) {
    if (on && roadblock.length === 0) {
      const ahead = { x: state.playerX + Math.sin(state.heading) * 30, z: state.playerZ + Math.cos(state.heading) * 30 };
      for (let i = -1; i <= 1; i++) {
        const mesh = makePoliceCar();
        const px = ahead.x + Math.cos(state.heading) * i * 4;
        const pz = ahead.z - Math.sin(state.heading) * i * 4;
        mesh.position.set(px, 0, pz); mesh.rotation.y = state.heading + Math.PI / 2;
        scene.add(mesh); roadblock.push(mesh);
      }
    } else if (!on && roadblock.length) {
      roadblock.forEach(m => scene.remove(m)); roadblock = [];
    }
  }

  function setWanted(n) {
    wanted = Math.max(0, Math.min(5, n));
    state.wanted = wanted;
    if (wanted >= 4) spawnHeli(); else removeHeli();
    setRoadblock(wanted >= 3);
    while (police.length < Math.min(wanted, 3)) {
      spawnPolice(state.playerX + (Math.random() - 0.5) * 60, state.playerZ + (Math.random() - 0.5) * 60);
    }
    while (police.length > Math.min(wanted, 3)) {
      const p = police.pop(); scene.remove(p.mesh);
    }
  }
  function addWanted(n) { setWanted(wanted + n); }
  function coolDown(dt) {
    if (wanted > 0) {
      state.calmTimer += dt;
      if (state.calmTimer > 25) { setWanted(0); state.calmTimer = 0; }
    } else state.calmTimer = 0;
  }

  function shoot() {
    if (shootCooldown > 0) return;
    const w = WEAPONS[state.weapon - 1];
    if (state.respect < w.lock) return;
    shootCooldown = w.name === "SMG" ? 0.12 : w.name === "RIFLE" ? 0.25 : 0.4;
    // muzzle flash
    if (!muzzle) {
      muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      scene.add(muzzle);
    }
    const px = state.playerX, pz = state.playerZ;
    muzzle.position.set(px + Math.sin(state.heading) * 1.2, 1.3, pz + Math.cos(state.heading) * 1.2);
    muzzle.visible = true;
    setTimeout(() => { if (muzzle) muzzle.visible = false; }, 60);
    // hitscan: nearest police car within 30 m and 25 deg of facing
    let best = null, bd = 30;
    for (const p of police) {
      const dx = p.mesh.position.x - px, dz = p.mesh.position.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > bd) continue;
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(((ang - state.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (diff < 0.45) { best = p; bd = d; }
    }
    if (best) {
      scene.remove(best.mesh);
      police.splice(police.indexOf(best), 1);
      state.respect += 25; state.cash += 50;
      addWanted(1);
    }
    state.ammoFlash = 1;
  }

  function update(dt, playerPos) {
    shootCooldown = Math.max(0, shootCooldown - dt);
    coolDown(dt);
    // police pursuit: steer toward player, simple chase
    for (const p of police) {
      const dx = playerPos.x - p.mesh.position.x, dz = playerPos.z - p.mesh.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 2) {
        const targetHeading = Math.atan2(dx, dz);
        let diff = ((targetHeading - p.car.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        p.car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
        const input = { forward: dist > 6, back: false, left: diff > 0.15, right: diff < -0.15 };
        updateCar(p.car, input, dt, world.colliders, 205);
        p.mesh.position.set(p.car.x, 0, p.car.z);
        p.mesh.rotation.y = p.car.heading;
        // spin wheels
        p.mesh.userData.wheels?.forEach(w => { w.rotation.z += p.car.speed * dt * 2.2; });
        // flashing light bar
        p.lightPhase += dt * 9;
        const on = Math.sin(p.lightPhase) > 0;
        if (p.mesh.userData.lightBar) {
          p.mesh.userData.lightBar.red.material.emissiveIntensity = on ? 2.5 : 0.15;
          p.mesh.userData.lightBar.blu.material.emissiveIntensity = on ? 0.15 : 2.5;
        }
        // ram the player
        if (dist < 2.6) { state.hp = Math.max(0, state.hp - 12 * dt); }
      }
    }
    // helicopter: hover above player, spotlight tracks, rotor spins
    if (heli.mesh) {
      const h = heli.mesh;
      const tx = playerPos.x + 10, tz = playerPos.z - 8;
      h.position.x += (tx - h.position.x) * Math.min(1, dt * 0.8);
      h.position.z += (tz - h.position.z) * Math.min(1, dt * 0.8);
      h.position.y = 10 + Math.sin(performance.now() * 0.001) * 1.0;
      h.userData.rotor.rotation.y += dt * 22;
      h.userData.tailRotor.rotation.z += dt * 30;
      h.rotation.y = Math.atan2(playerPos.x - h.position.x, playerPos.z - h.position.z) + Math.PI;
      // spotlight aims at the player
      h.userData.spot.target.position.set(playerPos.x - h.position.x, -20, playerPos.z - h.position.z);
      h.userData.spot.target.updateMatrixWorld();
      if (Math.hypot(playerPos.x - h.position.x, playerPos.z - h.position.z) < 12) {
        state.hp = Math.max(0, state.hp - 6 * dt);
      }
    }
  }

  return {
    get wanted() { return wanted; },
    setWanted, addWanted, shoot, update,
    get policeCount() { return police.length; },
    get heliActive() { return heli.active; },
    get heliMesh() { return heli.mesh; },
    get policeMeshes() { return police.map(p => p.mesh); },
  };
}
