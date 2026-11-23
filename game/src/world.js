// EMBER BAY world — round 5, written from zero.
// HD rule: nothing is a bare 90-degree box. Buildings are beveled extrusions
// from rounded-rectangle shapes; windows are glowing canvas-texture planes;
// palms have curved tube trunks + drooping frond ellipsoids; roofs vary.
const THREE = window.THREE;
import { GRID, PALETTE, SIGNS, districtAt, ROAD_HALF, WALK_HALF } from "./config.js";

function mulberry(seed) {
  let t = seed >>> 0;
  return () => { t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}

// ---------- canvas texture helpers ----------
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function facadeTex(base, lit) {
  // Window grid with warm dusk glow — small windows, wide spacing, mostly dark
  // with a few warm lit panes (reads as windows, not a checkerboard).
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const cols = 3, rows = 6, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = ((r * 5 + c * 7) % 7) === 0;
      g.fillStyle = on ? lit : "rgba(24,32,46,0.92)";
      g.fillRect(c * cw + 9, r * ch + 9, cw - 18, ch - 18);
      g.fillStyle = "rgba(255,255,255,0.14)";
      g.fillRect(c * cw + 9, r * ch + 9, cw - 18, 3);
    }
  });
}
function signTex(text, bg, fg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.font = "bold 56px Arial, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 2);
  });
}
function awningTex(c1, c2) {
  return canvasTex(128, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, h); }
    g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(0, h - 10, w, 10);
  });
}
function umbrellaTex(c1) {
  return canvasTex(128, 128, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? c1 : "#fff7e8";
      g.beginPath(); g.moveTo(w / 2, h / 2);
      g.arc(w / 2, h / 2, w / 2, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2); g.fill();
    }
  });
}
function roadTex() {
  // One tile = one 40 m block: asphalt + center dashes + a crosswalk band.
  return canvasTex(64, 512, (g, w, h) => {
    g.fillStyle = "#2b2f36"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#f5f0e0";
    for (let y = 30; y < h; y += 64) g.fillRect(w / 2 - 2, y, 4, 26); // center dashes
    for (let i = 0; i < 8; i++) g.fillRect(6 + i * 7, h - 26, 4, 20); // crosswalk band
  });
}
const ROAD_TEX = roadTex();
ROAD_TEX.wrapS = THREE.RepeatWrapping; ROAD_TEX.wrapT = THREE.RepeatWrapping;
ROAD_TEX.repeat.set(1, 10); // tile = one 40 m block, repeats along the 410 m road
function skyTex() {
  return canvasTex(16, 512, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0.0, "#2e5aa8"); gr.addColorStop(0.35, "#5a7ac8");
    gr.addColorStop(0.52, "#ff8c42"); gr.addColorStop(0.72, "#ffb347"); gr.addColorStop(1, "#ffd9a0");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

function roundedRectShape(w, d, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function beveledBox(w, h, d, r, mat) {
  const geo = new THREE.ExtrudeGeometry(roundedRectShape(w, d, Math.min(r, w / 2 - 0.1, d / 2 - 0.1)), {
    depth: h, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.35, bevelSegments: 1, curveSegments: 4,
  });
  geo.rotateX(-Math.PI / 2); // shape XY -> XZ ground plane, extrude up
  geo.translate(0, h, 0);
  return new THREE.Mesh(geo, mat);
}

const FACADES = [
  facadeTex("#3fae8a", "#ffe9a8"), facadeTex("#e86a92", "#ffe9a8"),
  facadeTex("#5a8fd6", "#ffe9a8"), facadeTex("#e8b45a", "#fff2c8"),
  facadeTex("#7ed957", "#ffe9a8"), facadeTex("#b06ad6", "#ffe9a8"),
];
const AWNINGS = [awningTex("#ff5a5a", "#fff7e8"), awningTex("#2ec4b6", "#fff7e8"), awningTex("#ff8c1a", "#fff7e8")];

export function buildWorld(scene) {
  const rnd = mulberry(20261123);
  const updaters = [];
  const buildings = [];   // {x,z,w,d,h,district}
  const palmSpots = [];
  const colliders = [];   // {x,z,r} circles for driving collision

  // ----- sky, sun, fog -----
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(55, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffd76a, fog: false }));
  sun.position.set(-420, 210, -620); scene.add(sun);
  const sunGlow = new THREE.Mesh(new THREE.SphereGeometry(85, 20, 16),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.25, fog: false }));
  sunGlow.position.copy(sun.position); scene.add(sunGlow);
  scene.fog = new THREE.Fog(0xff9a5a, 280, 1050);
  scene.add(new THREE.HemisphereLight(0x8fb8ff, 0xff9a5a, 0.95));
  const dirLight = new THREE.DirectionalLight(0xffe0b0, 1.6);
  dirLight.position.set(-300, 400, 200); scene.add(dirLight);

  // ----- ground, sea, beach -----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x86c06a, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; scene.add(ground);
  const cityBase = new THREE.Mesh(new THREE.PlaneGeometry(430, 430),
    new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 1 }));
  cityBase.rotation.x = -Math.PI / 2; cityBase.position.y = 0; scene.add(cityBase);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(700, 1400),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.35, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(560, -0.02, 0); scene.add(sea);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(6, 1400),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(212, 0.03, 0); scene.add(foam);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(24, 430),
    new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }));
  beach.rotation.x = -Math.PI / 2; beach.position.set(200, 0.01, 0); scene.add(beach);

  // ----- volcano (NW, inland) -----
  const volc = new THREE.Group();
  const conePts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; conePts.push(new THREE.Vector2(95 * (1 - t) + 6, 95 * t)); }
  const cone = new THREE.Mesh(new THREE.LatheGeometry(conePts, 24),
    new THREE.MeshStandardMaterial({ color: PALETTE.volcano, roughness: 1, flatShading: true }));
  volc.add(cone);
  const lava = new THREE.Mesh(new THREE.ConeGeometry(10, 26, 12),
    new THREE.MeshStandardMaterial({ color: PALETTE.lava, emissive: 0xff4400, emissiveIntensity: 1.6 }));
  lava.position.y = 92; volc.add(lava);
  const lavaFlow = new THREE.Mesh(new THREE.PlaneGeometry(7, 60),
    new THREE.MeshBasicMaterial({ color: 0xff6a1e }));
  lavaFlow.rotation.x = -Math.PI / 2; lavaFlow.rotation.z = 0.5; lavaFlow.position.set(28, 46, 30); volc.add(lavaFlow);
  const smoke = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(9 + rnd() * 8, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, transparent: true, opacity: 0.55 }));
    s.position.set((rnd() - 0.5) * 18, 105 + i * 9, (rnd() - 0.5) * 18);
    s.userData.phase = rnd() * 6.28; volc.add(s); smoke.push(s);
  }
  volc.position.set(-300, 0, -300); scene.add(volc);
  updaters.push(t => { smoke.forEach((s, i) => { s.position.y = 105 + i * 9 + Math.sin(t * 0.5 + s.userData.phase) * 2.5; s.position.x += Math.sin(t * 0.3 + i) * 0.02; }); });

  // ----- roads, sidewalks, lamps (markings baked into one texture per road) -----
  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: ROAD_TEX });
  const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
  const roadLen = 410;
  for (const s of GRID.streets) {
    for (const horiz of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, ROAD_HALF * 2), asphaltMat);
      road.rotation.x = -Math.PI / 2; road.rotation.z = horiz ? 0 : Math.PI / 2;
      road.position.set(horiz ? 0 : s, 0.02, horiz ? s : 0); scene.add(road);
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, WALK_HALF - ROAD_HALF), walkMat);
        walk.rotation.x = -Math.PI / 2; walk.rotation.z = horiz ? 0 : Math.PI / 2;
        walk.position.set(horiz ? 0 : s + side * (ROAD_HALF + (WALK_HALF - ROAD_HALF) / 2), 0.04,
          horiz ? s + side * (ROAD_HALF + (WALK_HALF - ROAD_HALF) / 2) : 0);
        scene.add(walk);
      }
    }
  }
  // lamps at corners (sparse)
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.6, metalness: 0.5 });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const sx of GRID.streets) for (const sz of GRID.streets) {
    if ((sx + sz) % 160 !== 0) continue;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 8), lampPoleMat);
    pole.position.set(sx + 6.5, 3.25, sz + 6.5); scene.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), lampPoleMat);
    arm.rotation.z = Math.PI / 2; arm.position.set(sx + 5.6, 6.4, sz + 6.5); scene.add(arm);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lampGlowMat);
    bulb.position.set(sx + 4.6, 6.3, sz + 6.5); scene.add(bulb);
  }

  // ----- buildings -----
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fe8c8, roughness: 0.15, metalness: 0.55, emissive: 0x1a5a44, emissiveIntensity: 0.25 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 });
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 1 });
  const bodyMats = [0x3fae8a, 0xe86a92, 0x5a8fd6, 0xe8b45a, 0x7ed957, 0xb06ad6, 0xff9a6a, 0x4ac8d6]
    .map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  let signIdx = 0;
  for (let bi = 0; bi < GRID.streets.length - 1; bi++) {
    for (let bj = 0; bj < GRID.streets.length - 1; bj++) {
      const x0 = GRID.streets[bi] + WALK_HALF, x1 = GRID.streets[bi + 1] - WALK_HALF;
      const z0 = GRID.streets[bj] + WALK_HALF, z1 = GRID.streets[bj + 1] - WALK_HALF;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      // 2x2 sub-plots; skip some for parks/plazas
      const plots = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      for (const [px, pz] of plots) {
        if (rnd() < 0.16) continue; // park / plaza gap
        const w = 8 + rnd() * 4, d = 8 + rnd() * 4;
        const bx = cx + px * (x1 - x0) / 4, bz = cz + pz * (z1 - z0) / 4;
        const dist = districtAt(bx, bz);
        const tall = rnd() < 0.15;
        const h = tall ? 22 + rnd() * 10 : 6 + rnd() * 9;
        const mat = tall && rnd() < 0.5 ? glassMat : bodyMats[Math.floor(rnd() * bodyMats.length)];
        const b = beveledBox(w, h, d, 1.1, mat);
        b.position.set(bx, 0, bz); b.rotation.y = (rnd() < 0.5 ? 0 : Math.PI / 2) * 0 + (rnd() - 0.5) * 0.06;
        scene.add(b);
        buildings.push({ x: bx, z: bz, w, d, h, district: dist.name });
        colliders.push({ x: bx, z: bz, r: Math.max(w, d) * 0.62 });
        // roofline: parapet ring, sloped pyramid, or glass crown
        const roll = rnd();
        if (roll < 0.45) {
          const par = beveledBox(w + 0.6, 0.9, d + 0.6, 0.5, parapetMat);
          par.position.set(bx, h + 0.4, bz); scene.add(par);
        } else if (roll < 0.7) {
          const pyr = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.2, 4), roofMat);
          pyr.position.set(bx, h + 1.6, bz); pyr.rotation.y = Math.PI / 4; scene.add(pyr);
        } else if (tall) {
          const crown = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.32, Math.min(w, d) * 0.4, 2.4, 8),
            new THREE.MeshStandardMaterial({ color: 0x2ec4b6, emissive: 0x0a5a50, emissiveIntensity: 0.7 }));
          crown.position.set(bx, h + 1.2, bz); scene.add(crown);
        }
        // glowing window plane on the street-facing side
        const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 1.2, Math.min(h - 1.5, 14)),
          new THREE.MeshBasicMaterial({ map: FACADES[Math.floor(rnd() * FACADES.length)] }));
        const facingEast = Math.abs(bx) > Math.abs(bz);
        face.position.set(bx + (facingEast ? w / 2 + 0.42 : 0), Math.min(h / 2 + 0.5, 8.5), bz + (facingEast ? 0 : d / 2 + 0.42));
        face.rotation.y = facingEast ? Math.PI / 2 : 0;
        scene.add(face);
        // shop awning (~55%) + big readable sign (~30% of mid-rises)
        if (h < 18 && rnd() < 0.55) {
          const aw = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.85, 1.6),
            new THREE.MeshBasicMaterial({ map: AWNINGS[Math.floor(rnd() * AWNINGS.length)], side: THREE.DoubleSide }));
          aw.position.set(bx + (facingEast ? w / 2 + 0.55 : 0), 3.1, bz + (facingEast ? 0 : d / 2 + 0.55));
          aw.rotation.y = facingEast ? Math.PI / 2 : 0; aw.rotation.x = -0.15;
          scene.add(aw);
        }
        if (h >= 10 && h < 26 && rnd() < 0.3) {
          const st = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.75),
            new THREE.MeshBasicMaterial({ map: signTex(SIGNS[signIdx++ % SIGNS.length], "#1c1c28", "#ffe9a8") }));
          st.position.set(bx, h * 0.72, bz + d / 2 + 0.5); scene.add(st);
        }
      }
    }
  }

  // ----- palms (curved tube trunk + drooping frond ellipsoids) -----
  function makePalm(scale = 1) {
    const g = new THREE.Group();
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.7, 2.6, 0.2), new THREE.Vector3(1.5, 5.2, 0.4));
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.22, 7),
      new THREE.MeshStandardMaterial({ color: 0x8a6a44, roughness: 1 }));
    g.add(trunk);
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2fae4e, roughness: 0.9, flatShading: true });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const frond = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), frondMat);
      frond.scale.set(1.7, 0.14, 0.55);
      frond.position.set(1.5 + Math.cos(a) * 1.5, 5.6, 0.4 + Math.sin(a) * 1.5);
      frond.rotation.y = -a; frond.rotation.z = -0.55;
      g.add(frond);
    }
    const nuts = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x6a4a22, roughness: 1 }));
    nuts.position.set(1.5, 5.2, 0.4); g.add(nuts);
    g.scale.setScalar(scale);
    return g;
  }
  function makeLeafyTree() {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 8),
      new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 }));
    trunk.position.y = 1.2; g.add(trunk);
    const greens = [0x3aa84a, 0x58c24a, 0x2e9e5a];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5 - i * 0.25, 1),
        new THREE.MeshStandardMaterial({ color: greens[i % 3], roughness: 1, flatShading: true }));
      s.position.set((rnd() - 0.5) * 1.2, 3 + i * 0.9, (rnd() - 0.5) * 1.2); g.add(s);
    }
    return g;
  }
  // palms along beach + scattered in districts
  for (let z = -180; z <= 180; z += 24) {
    const p = makePalm(0.9 + rnd() * 0.5); p.position.set(206 + rnd() * 6, 0, z + (rnd() - 0.5) * 8);
    p.rotation.y = rnd() * 6.28; scene.add(p); palmSpots.push({ x: p.position.x, z: p.position.z });
  }
  for (let i = 0; i < 28; i++) {
    const x = (rnd() - 0.5) * 380, z = (rnd() - 0.5) * 380;
    if (Math.abs(x) > 190 || Math.abs(z) > 190) continue;
    const p = rnd() < 0.6 ? makePalm(0.8 + rnd() * 0.4) : makeLeafyTree();
    p.position.set(x, 0, z); p.rotation.y = rnd() * 6.28; scene.add(p);
  }

  // ----- beach umbrellas + sailboats -----
  for (let i = 0; i < 14; i++) {
    const x = 198 + rnd() * 10, z = -170 + rnd() * 340;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xf5f0e0 }));
    pole.position.set(x, 1.3, z); scene.add(pole);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 10),
      new THREE.MeshBasicMaterial({ map: umbrellaTex(["#ff5a5a", "#2ec4b6", "#ff8c1a"][i % 3]) }));
    um.position.set(x, 2.9, z); scene.add(um);
  }
  const sailboats = [];
  for (let i = 0; i < 3; i++) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    hull.scale.set(2.2, 0.55, 0.8); hull.position.y = 0.3; boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 5.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a4632 }));
    mast.position.y = 3; boat.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0); sailShape.lineTo(0, 5); sailShape.lineTo(2.6, 0.6); sailShape.lineTo(0, 0);
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape),
      new THREE.MeshBasicMaterial({ color: 0xfff7e8, side: THREE.DoubleSide }));
    sail.position.set(0.1, 0.8, 0); boat.add(sail);
    boat.position.set(250 + i * 45, 0, -90 + i * 85);
    boat.rotation.y = -0.5 + i * 0.3; scene.add(boat); sailboats.push(boat);
  }
  updaters.push(t => { sailboats.forEach((b, i) => { b.position.y = Math.sin(t * 0.7 + i * 2) * 0.25; b.rotation.z = Math.sin(t * 0.5 + i) * 0.03; }); });

  // ----- EMBER BAY billboard (high gantry over the beach road; clear of the chase eyeline) -----
  const bb = new THREE.Group();
  const bbTex = signTex("EMBER BAY", "#1c1c28", "#ff5a9a");
  const bbFace = new THREE.Mesh(new THREE.PlaneGeometry(34, 8.5),
    new THREE.MeshBasicMaterial({ map: bbTex }));
  bbFace.position.y = 0; bb.add(bbFace);
  const bbSub = new THREE.Mesh(new THREE.PlaneGeometry(34, 2.1),
    new THREE.MeshBasicMaterial({ map: signTex("NEON ROW • OPEN ALL NIGHT", "#1c1c28", "#ffe9a8") }));
  bbSub.position.y = -5.2; bb.add(bbSub);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 13, 8),
      new THREE.MeshStandardMaterial({ color: 0x2c2c34, roughness: 0.6, metalness: 0.4 }));
    leg.position.set(side * 15, -11, 0); bb.add(leg);
  }
  bb.position.set(180, 17.5, -20); bb.rotation.y = 0; scene.add(bb);

  // ----- street props: benches, bins -----
  const benchMat = new THREE.MeshStandardMaterial({ color: 0xa86432, roughness: 1 });
  for (let i = 0; i < 24; i++) {
    const x = GRID.streets[Math.floor(rnd() * GRID.streets.length)] + (rnd() < 0.5 ? -6.8 : 6.8);
    const z = (rnd() - 0.5) * 360;
    const bench = new THREE.Group();
    const seat = beveledBox(2.2, 0.5, 0.8, 0.15, benchMat); seat.position.y = 0.5; bench.add(seat);
    const back = beveledBox(2.2, 0.9, 0.18, 0.08, benchMat); back.position.set(0, 1.0, -0.35); bench.add(back);
    bench.position.set(x, 0, z); bench.rotation.y = rnd() * 6.28; scene.add(bench);
  }

  return { updaters, buildings, palmSpots, colliders, sailboats };
}
