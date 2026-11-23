// EMBER BAY vehicles — round 5, written from zero.
// No boxy cars: every body is an extruded sloped side-profile with bevels,
// wheels are lathed, lights are round cylinders with chrome rings.
const THREE = window.THREE;

// Side profile of a sleek coupe: X = length (front +X), Y = height.
// Sloped hood, raked glass, dome roof, sloped trunk — no 90-degree corners.
function coupeProfile(L, H) {
  const s = new THREE.Shape();
  const f = L / 2, r = -L / 2;
  s.moveTo(r + 0.25, 0.28);
  s.lineTo(f - 0.55, 0.28);                    // bottom edge (sills)
  s.quadraticCurveTo(f + 0.05, 0.30, f + 0.02, 0.62);   // front bumper curve
  s.quadraticCurveTo(f - 0.15, 0.78, f - 0.75, 0.86);   // nose -> hood
  s.lineTo(f - 1.55, 0.98);                    // hood, gentle slope
  s.quadraticCurveTo(f - 1.95, 1.02, f - 2.05, 1.22);   // windshield base
  s.lineTo(f - 2.75, H - 0.06);                // raked windshield
  s.quadraticCurveTo(f - 2.95, H, f - 3.15, H);         // roof front dome
  s.lineTo(r + 1.15, H);                       // roof
  s.quadraticCurveTo(r + 0.85, H - 0.02, r + 0.55, H - 0.22); // rear glass slope
  s.lineTo(r + 0.15, 0.92);                    // sloped trunk
  s.quadraticCurveTo(r - 0.02, 0.62, r - 0.02, 0.45);   // tail curve
  s.quadraticCurveTo(r + 0.05, 0.28, r + 0.25, 0.28);   // rear bumper
  return s;
}
function extrudeProfile(shape, width, mat) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 2, curveSegments: 10,
  });
  geo.translate(0, 0, -width / 2);
  return new THREE.Mesh(geo, mat);
}
function wheel(r = 0.4) {
  const g = new THREE.Group();
  const pts = [];
  pts.push(new THREE.Vector2(0.02, 0.02));
  pts.push(new THREE.Vector2(r * 0.72, 0.02));
  pts.push(new THREE.Vector2(r * 0.95, r * 0.35));
  pts.push(new THREE.Vector2(r, r * 0.6));
  pts.push(new THREE.Vector2(r * 0.95, r * 0.9));
  pts.push(new THREE.Vector2(r * 0.7, r));
  pts.push(new THREE.Vector2(0.02, r));
  const tire = new THREE.Mesh(new THREE.LatheGeometry(pts, 18),
    new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.95 }));
  tire.rotation.x = Math.PI / 2; g.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.52, r * 0.52, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: 0xd8d8e0, metalness: 0.85, roughness: 0.25 }));
  hub.rotation.x = Math.PI / 2; g.add(hub);
  // one spoke bar (cheap, spins visibly with the wheel)
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.09, r * 1.5, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.7, roughness: 0.35 }));
  spoke.position.z = 0.17; g.add(spoke);
  g.userData.spoke = spoke;
  return g;
}
// Wrap a car's parts so the model faces +Z (the heading convention):
// the coupe profile is built with length along +X; rotating the inner group
// by -90 deg maps +X -> +Z, so rotation.y = heading faces the direction of travel.
function orientCar(car) {
  const inner = new THREE.Group();
  while (car.children.length) inner.add(car.children[0]);
  inner.rotation.y = -Math.PI / 2;
  car.add(inner);
  return car;
}
function roundLight(radius, color, emissive) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.18, 8, 20),
    new THREE.MeshStandardMaterial({ color: 0xe8e8f0, metalness: 0.9, roughness: 0.2 }));
  g.add(ring);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.9, 20),
    new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 1.2 }));
  lens.position.z = 0.02; g.add(lens);
  return g;
}

export function makeSkyline() {
  const car = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: 0x1e56d8, metalness: 0.65, roughness: 0.28 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf5f5f0, metalness: 0.3, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.9, roughness: 0.12 });
  const body = extrudeProfile(coupeProfile(4.7, 1.32), 1.86, blue);
  car.add(body);
  // raked glass cabin, slightly inset and darker
  const cabin = extrudeProfile(coupeProfile(2.6, 1.30), 1.55, glass);
  cabin.position.set(-0.25, 0.06, 0); cabin.scale.set(1, 0.92, 1);
  car.add(cabin);
  // twin white stripes over hood / roof / trunk
  for (const sx of [-0.24, 0.24]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 3.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(sx, 1.335, -0.1); car.add(stripe);
  }
  // GT spoiler: thin wing on two struts
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.9),
    new THREE.MeshStandardMaterial({ color: 0x1e56d8, metalness: 0.65, roughness: 0.28 }));
  wing.position.set(-2.32, 1.42, 0); wing.rotation.y = 0.12; car.add(wing);
  for (const sz of [-0.7, 0.7]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), blue);
    strut.position.set(-2.32, 1.22, sz); car.add(strut);
  }
  // 4 round chrome-ring taillights on the sloped tail
  for (const sz of [-0.62, -0.21, 0.21, 0.62]) {
    const tl = roundLight(0.13, 0xff2a22, 0xff2a22);
    tl.position.set(-2.42, 0.72, sz); tl.rotation.y = -Math.PI / 2 + 0.45; car.add(tl);
  }
  // round headlights
  for (const sz of [-0.62, 0.62]) {
    const hl = roundLight(0.16, 0xfff2c8, 0xfff2c8);
    hl.position.set(2.38, 0.68, sz); hl.rotation.y = Math.PI / 2 - 0.25; car.add(hl);
  }
  // white side skirts + fender bulges + mirrors
  for (const sz of [-0.98, 0.98]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.1), white);
    skirt.position.set(0, 0.22, sz); car.add(skirt);
    const mirror = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), blue);
    mirror.scale.set(1.4, 0.8, 0.7); mirror.position.set(0.95, 1.05, sz * 1.12); car.add(mirror);
  }
  for (const [wx, wz] of [[1.55, -0.95], [1.55, 0.95], [-1.55, -0.95], [-1.55, 0.95]]) {
    const bulge = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.5, 4, 10), blue);
    bulge.rotation.x = Math.PI / 2; bulge.rotation.z = 0; bulge.scale.set(1, 1, 0.5);
    bulge.position.set(wx, 0.55, wz); car.add(bulge);
  }
  // wheels
  const wheels = [];
  for (const [wx, wz] of [[1.55, -1.0], [1.55, 1.0], [-1.55, -1.0], [-1.55, 1.0]]) {
    const w = wheel(0.4); w.position.set(wx, 0.4, wz); car.add(w); wheels.push(w);
  }
  car.userData.wheels = wheels;
  car.userData.length = 4.7; car.userData.width = 2.04;
  return orientCar(car);
}

export function makeTrafficCar(colorHex) {
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.5, roughness: 0.35 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.9, roughness: 0.12 });
  const body = extrudeProfile(coupeProfile(4.2 + Math.random() * 0.5, 1.28), 1.8, paint);
  car.add(body);
  const cabin = extrudeProfile(coupeProfile(2.3, 1.26), 1.5, glass);
  cabin.position.set(-0.2, 0.05, 0); cabin.scale.set(1, 0.9, 1); car.add(cabin);
  for (const sz of [-0.6, 0.6]) {
    const hl = roundLight(0.13, 0xfff2c8, 0xfff2c8);
    hl.position.set(2.15, 0.62, sz); hl.rotation.y = Math.PI / 2 - 0.25; car.add(hl);
    const tl = roundLight(0.11, 0xff2a22, 0xff2a22);
    tl.position.set(-2.2, 0.66, sz); tl.rotation.y = -Math.PI / 2 + 0.4; car.add(tl);
  }
  const wheels = [];
  for (const [wx, wz] of [[1.45, -0.95], [1.45, 0.95], [-1.45, -0.95], [-1.45, 0.95]]) {
    const w = wheel(0.38); w.position.set(wx, 0.38, wz); car.add(w); wheels.push(w);
  }
  car.userData.wheels = wheels;
  return orientCar(car);
}

export function makePoliceCar() {
  const car = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.4, roughness: 0.35 });
  const black = new THREE.MeshStandardMaterial({ color: 0x14141c, metalness: 0.5, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101820, metalness: 0.9, roughness: 0.12 });
  const body = extrudeProfile(coupeProfile(4.6, 1.3), 1.86, white);
  car.add(body);
  // black hood + trunk + doors (two-tone interceptor)
  const hood = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ color: 0x14141c }));
  hood.rotation.x = -Math.PI / 2; hood.position.set(1.55, 1.0, 0); car.add(hood);
  for (const sz of [-0.94, 0.94]) {
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.55), new THREE.MeshBasicMaterial({ color: 0x14141c }));
    door.position.set(-0.2, 0.72, sz); door.rotation.y = sz > 0 ? 0 : Math.PI; car.add(door);
  }
  const cabin = extrudeProfile(coupeProfile(2.5, 1.28), 1.55, glass);
  cabin.position.set(-0.25, 0.05, 0); cabin.scale.set(1, 0.9, 1); car.add(cabin);
  // light bar: red + blue emissive, on a slim base
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 1.3), black);
  barBase.position.set(-0.35, 1.36, 0); car.add(barBase);
  const red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.55),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }));
  red.position.set(-0.35, 1.44, -0.33); car.add(red);
  const blu = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x2020ff, emissive: 0x2020ff, emissiveIntensity: 2 }));
  blu.position.set(-0.35, 1.44, 0.33); car.add(blu);
  car.userData.lightBar = { red, blu };
  // push bar
  const push = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 1.5), black);
  push.position.set(2.42, 0.45, 0); car.add(push);
  for (const sz of [-0.6, 0.6]) {
    const hl = roundLight(0.15, 0xfff2c8, 0xfff2c8);
    hl.position.set(2.36, 0.66, sz); hl.rotation.y = Math.PI / 2 - 0.25; car.add(hl);
  }
  const wheels = [];
  for (const [wx, wz] of [[1.5, -1.0], [1.5, 1.0], [-1.5, -1.0], [-1.5, 1.0]]) {
    const w = wheel(0.4); w.position.set(wx, 0.4, wz); car.add(w); wheels.push(w);
  }
  car.userData.wheels = wheels;
  return orientCar(car);
}

export function makeHelicopter() {
  const heli = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c2c44, metalness: 0.5, roughness: 0.35 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.3, roughness: 0.4 });
  // rounded fuselage
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(1.1, 2.2, 6, 14), bodyMat);
  fus.rotation.z = Math.PI / 2; fus.scale.set(1, 1, 0.85); heli.add(fus);
  // glass cockpit (dark bubble, front)
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0x0e1a24, metalness: 0.9, roughness: 0.08 }));
  glass.scale.set(1.1, 0.85, 0.9); glass.position.set(1.7, -0.15, 0); heli.add(glass);
  // tail boom (tapered) + fin + tail rotor
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 4.2, 10), bodyMat);
  boom.rotation.z = Math.PI / 2 - 0.12; boom.position.set(-3.4, 0.35, 0); heli.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.12), white);
  fin.position.set(-5.4, 0.9, 0); fin.rotation.z = 0.25; heli.add(fin);
  const tailRotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.5, 0.05), white);
    b.rotation.z = i * Math.PI / 2; tailRotor.add(b);
  }
  tailRotor.position.set(-5.4, 0.6, 0.35); heli.add(tailRotor);
  // main rotor (two long blades) + mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 8), white);
  mast.position.y = 1.35; heli.add(mast);
  const rotor = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 7.2),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    blade.rotation.y = i * Math.PI / 2; rotor.add(blade);
  }
  rotor.position.y = 1.75; heli.add(rotor);
  heli.userData.rotor = rotor; heli.userData.tailRotor = tailRotor;
  // skids
  for (const sz of [-0.8, 0.8]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 6), white);
    skid.rotation.z = Math.PI / 2; skid.position.set(0.3, -1.35, sz); heli.add(skid);
    for (const sx of [-0.9, 0.9]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), white);
      strut.position.set(sx, -1.1, sz); heli.add(strut);
    }
  }
  // spotlight cone + real spotlight
  const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
  cone.rotation.x = Math.PI; cone.position.set(0.5, -5, 0); heli.add(cone);
  const spot = new THREE.SpotLight(0xfff2c8, 60, 60, 0.35, 0.5, 1.2);
  spot.position.set(0.5, -1.2, 0);
  const spotTarget = new THREE.Object3D(); spotTarget.position.set(0.5, -16, 0);
  heli.add(spotTarget); spot.target = spotTarget; heli.add(spot);
  heli.userData.spot = spot;
  return heli;
}

// Simple arcade car state.
export function makeCarState(x, z, heading) {
  return { x, z, heading, speed: 0, steer: 0 };
}
export function updateCar(s, input, dt, colliders, bounds = 205) {
  const accel = input.forward ? 14 : input.back ? -10 : 0;
  const maxF = 26, maxR = -10;
  s.speed += accel * dt;
  if (!input.forward && !input.back) s.speed *= Math.max(0, 1 - 1.6 * dt);
  s.speed = Math.max(maxR, Math.min(maxF, s.speed));
  if (Math.abs(s.speed) > 0.2) {
    const steerAmt = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    s.heading += steerAmt * 1.7 * dt * Math.sign(s.speed) * Math.min(1, Math.abs(s.speed) / 8);
  }
  const nx = s.x + Math.sin(s.heading) * s.speed * dt;
  const nz = s.z + Math.cos(s.heading) * s.speed * dt;
  // building collision (circle)
  let blocked = false;
  for (const c of colliders) {
    const dx = nx - c.x, dz = nz - c.z;
    if (dx * dx + dz * dz < (c.r + 1.6) * (c.r + 1.6)) { blocked = true; break; }
  }
  if (!blocked && Math.abs(nx) < bounds && Math.abs(nz) < bounds) { s.x = nx; s.z = nz; }
  else s.speed *= 0.4;
  return s;
}
