import * as THREE from "three";
import { RoundedBoxGeometry } from "../vendor/RoundedBoxGeometry.js";
import { mergeGeometries } from "../vendor/utils/BufferGeometryUtils.js";
// world.js — EMBER BAY island: sky, ground, roads, beach, sea, volcano,
// ~120 buildings with canvas window-grid facades, palms, lamps, billboard.
import { CFG } from "./config.js";

function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function hexCss(n) { return "#" + n.toString(16).padStart(6, "0"); }

// Facade texture: neat grid of small windows on a colored wall + darker base.
function facadeTex(base, floors, cols) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = hexCss(base); g.fillRect(0, 0, w, h);
    // subtle vertical shading
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "rgba(0,0,0,0.18)"); grad.addColorStop(0.5, "rgba(255,255,255,0.06)"); grad.addColorStop(1, "rgba(0,0,0,0.18)");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const cw = w / cols, ch = h / floors;
    for (let r = 0; r < floors; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = Math.random() < 0.22;
        g.fillStyle = lit ? "#ffd98a" : "#1c2733";
        g.fillRect(c * cw + cw * 0.22, r * ch + ch * 0.25, cw * 0.56, ch * 0.5);
        g.fillStyle = "rgba(255,255,255,0.25)";
        g.fillRect(c * cw + cw * 0.22, r * ch + ch * 0.25, cw * 0.56, ch * 0.12);
      }
    }
    // ground floor: darker shop band
    g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(0, h - ch * 0.9, w, ch * 0.9);
  });
}

function awningTex(c1, c2) {
  return canvasTex(128, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect((i * w) / 8, 0, w / 8, h); }
    g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(0, h - 6, w, 6);
  });
}

function signTex(text, bg, fg) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.font = "bold 52px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function roadTex() {
  // dark asphalt with centre dashes + edge lines (drawn once, repeated along length)
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = "#2e2e33"; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.fillStyle = "#e8e8d8";
    g.fillRect(w / 2 - 3, 20, 6, 60); g.fillRect(w / 2 - 3, 140, 6, 60);
    g.fillStyle = "rgba(232,232,216,0.7)";
    g.fillRect(4, 0, 3, h); g.fillRect(w - 7, 0, 3, h);
  });
}

export function buildWorld(scene, assets) {
  const P = CFG.palette;
  const world = { buildings: [], palms: [], signs: [], billboard: null, volcano: null, update: null };
  const A = assets || {};
  const hasKenney = !!(A.buildings && A.buildings.mid && A.buildings.mid.length);

  // ---------- sky dome + sun + clouds ----------
  const skyGeo = new THREE.SphereGeometry(900, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(P.skyTop) }, mid: { value: new THREE.Color(P.skyMid) }, low: { value: new THREE.Color(P.skyLow) } },
    vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low; void main(){ float h = normalize(vP).y; vec3 c = h > 0.08 ? mix(mid, top, smoothstep(0.08, 0.38, h)) : mix(low, mid, smoothstep(-0.05, 0.08, h)); gl_FragColor = vec4(c, 1.0); }",
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  // big low sun (west) — smaller disc + much smaller halo so it reads as a
  // sun, not a giant pale-orange balloon in the chase/drive frame
  const sun = new THREE.Mesh(new THREE.CircleGeometry(48, 32), new THREE.MeshBasicMaterial({ color: 0xffe9a0, fog: false }));
  sun.position.set(-520, 150, -320); sun.lookAt(0, 40, 0); scene.add(sun);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(66, 32), new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.18, fog: false }));
  glow.position.copy(sun.position).multiplyScalar(0.999); glow.lookAt(0, 40, 0); scene.add(glow);
  // drifting clouds — bright white, puffy (not flat slabs)
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cg = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(14 + Math.random() * 10, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, fog: false }));
      puff.position.set(j * 16 - 16, Math.random() * 4, Math.random() * 8 - 4);
      puff.scale.y = 0.6; cg.add(puff);
    }
    cg.position.set(Math.random() * 900 - 450, 150 + Math.random() * 90, Math.random() * 700 - 350);
    scene.add(cg); clouds.push(cg);
  }

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0xffe0b0, 0x4a6a5a, 1.25); scene.add(hemi);
  const sunLight = new THREE.DirectionalLight(0xffc98a, 1.9);
  sunLight.position.set(-300, 220, -180); scene.add(sunLight);
  scene.fog = new THREE.Fog(0xff9a5e, 260, 980);

  // ---------- ground: grass base ----------
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: P.grass }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = 0; scene.add(grass);

  // ---------- roads (grid) ----------
  const rTex = roadTex();
  rTex.wrapS = rTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: rTex });
  const roadLines = [];
  for (let i = -5; i <= 5; i++) {
    const c = i * CFG.roadSpacing;
    roadLines.push({ x: c, z: 0, w: CFG.roadWidth, len: 420, rot: 0 });
    roadLines.push({ x: 0, z: c, w: CFG.roadWidth, len: 420, rot: 1 });
  }
  for (const r of roadLines) {
    const t = rTex.clone(); t.needsUpdate = true; t.repeat.set(1, r.len / 64);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r.rot ? r.len : r.w, r.rot ? r.w : r.len),
      new THREE.MeshLambertMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2;
    if (r.rot) m.rotation.z = Math.PI / 2;
    m.position.set(r.x, 0.02, r.z); scene.add(m);
  }
  // sidewalks: light strips along roads (thin boxes, slightly raised)
  const walkMat = new THREE.MeshLambertMaterial({ color: P.sidewalk });
  for (let i = -5; i <= 5; i++) {
    const c = i * CFG.roadSpacing;
    for (const s of [-1, 1]) {
      const sw1 = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 420), walkMat);
      sw1.position.set(c + s * (CFG.roadWidth / 2 + 2.2), 0.09, 0); scene.add(sw1);
      const sw2 = new THREE.Mesh(new THREE.BoxGeometry(420, 0.18, 2.5), walkMat);
      sw2.position.set(0, 0.09, c + s * (CFG.roadWidth / 2 + 2.2)); scene.add(sw2);
    }
  }
  // zebra crossings on the main coastal road (x = 168) and centre road
  const zebraMat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
  for (const zc of [-84, 0, 84, 168]) {
    for (let s = 0; s < 6; s++) {
      const z = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9), zebraMat);
      z.rotation.x = -Math.PI / 2; z.position.set(168 - 5 + s * 2, 0.05, zc); scene.add(z);
    }
  }

  // ---------- beach + sea ----------
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CFG.sandEnd - CFG.beachX, 900), new THREE.MeshLambertMaterial({ color: P.sand }));
  sand.rotation.x = -Math.PI / 2; sand.position.set((CFG.beachX + CFG.sandEnd) / 2, 0.03, 0); scene.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(420, 900), new THREE.MeshLambertMaterial({ color: P.sea }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(CFG.sandEnd + 210, 0.01, 0); scene.add(sea);
  // gentle wave lines on the sea
  const waveMat = new THREE.MeshBasicMaterial({ color: 0xbff0e8, transparent: true, opacity: 0.5 });
  for (let i = 0; i < 8; i++) {
    const wv = new THREE.Mesh(new THREE.PlaneGeometry(60 + Math.random() * 80, 1.2), waveMat);
    wv.rotation.x = -Math.PI / 2; wv.position.set(CFG.sandEnd + 30 + Math.random() * 200, 0.04, Math.random() * 700 - 350);
    scene.add(wv);
  }
  // 3 sailboats — big and close to shore so they read clearly in the cover
  const boats = [];
  for (const [bx, bz, sc] of [[312, -120, 1.6], [336, 60, 1.9], [318, 210, 1.5]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 3.4), new THREE.MeshLambertMaterial({ color: 0xf5f0e0 }));
    hull.position.y = 0.8; boat.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 9), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
    mast.position.y = 5.5; boat.add(mast);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0); sailShape.lineTo(0, 8); sailShape.lineTo(5.5, 0.5); sailShape.closePath();
    const sail = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshLambertMaterial({ color: [0xffffff, 0xffd76a, 0xff8a5e][boats.length % 3], side: THREE.DoubleSide }));
    sail.position.set(0.3, 1.6, 0); boat.add(sail);
    boat.position.set(bx, 0.2, bz); boat.scale.setScalar(sc);
    scene.add(boat); boats.push(boat);
  }

  // ---------- volcano ----------
  const volc = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(CFG.volcano.r, CFG.volcano.h, 24),
    new THREE.MeshLambertMaterial({ color: 0x6b3a26 }));
  cone.position.y = CFG.volcano.h / 2; volc.add(cone);
  // lava streaks (orange cones slightly above surface)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const streak = new THREE.Mesh(new THREE.ConeGeometry(3.2, 34, 6), new THREE.MeshBasicMaterial({ color: 0xff5a1e }));
    streak.position.set(Math.cos(a) * 24, 30, Math.sin(a) * 24);
    streak.rotation.z = Math.cos(a) * 0.5; streak.rotation.x = -Math.sin(a) * 0.5;
    volc.add(streak);
  }
  // crater glow
  const crater = new THREE.Mesh(new THREE.CircleGeometry(9, 20), new THREE.MeshBasicMaterial({ color: 0xff7a1e }));
  crater.rotation.x = -Math.PI / 2; crater.position.y = CFG.volcano.h - 0.5; volc.add(crater);
  // smoke puffs (animated): a layered, drifting plume — puffs spread
  // sideways as they rise and flatten, so it reads as smoke, not one balloon.
  // fog:false — the orange distance fog would tint them grey-brown.
  const smoke = [];
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(5 + i * 1.2, 10, 8),
      new THREE.MeshLambertMaterial({ color: i < 2 ? 0xe8d8c8 : 0xd8cec2, transparent: true, opacity: 0.75, fog: false }));
    puff.position.set((i % 3 - 1) * 7, CFG.volcano.h + i * 8, ((i * 7) % 3 - 1) * 7);
    puff.scale.y = 0.7;
    volc.add(puff); smoke.push(puff);
  }
  volc.position.set(CFG.volcano.x, 0, CFG.volcano.z);
  scene.add(volc);
  world.volcano = volc;

  // ---------- buildings ----------
  // Grid blocks: for each block (between roads), place 2x2 sub-plots with a building each.
  const awnColors = [["#ff5a5a", "#ffffff"], ["#2ec4b6", "#ffffff"], ["#ff9a4d", "#ffffff"], ["#7ed957", "#ffffff"], ["#7ec8e3", "#ffffff"]];
  const roofColors = [0xb8442c, 0x3f6d8e, 0x2f6f4f, 0x8e3b2f, 0x2ea6a0];
  let signIdx = 0;
  const rand = mulberry32(20261123);
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const blockCenters = [];
  for (let gx = -4; gx <= 4; gx++) {
    for (let gz = -4; gz <= 4; gz++) {
      const bx = gx * CFG.roadSpacing + CFG.roadSpacing / 2;
      const bz = gz * CFG.roadSpacing + CFG.roadSpacing / 2;
      if (bx > CFG.beachX - 30) continue; // beach side stays open
      if (Math.hypot(bx - CFG.volcano.x, bz - CFG.volcano.z) < 95) continue; // volcano clearing
      blockCenters.push([bx, bz]);
    }
  }
  // district lookup
  function districtAt(x, z) {
    for (const d of CFG.districts) if (Math.abs(x - d.cx) < d.w / 2 && Math.abs(z - d.cz) < d.d / 2) return d;
    return CFG.districts[2];
  }

  for (const [bx, bz] of blockCenters) {
    // 2x2 sub-plots, each ~16m, skip some for variety (plazas)
    for (const [ox, oz] of [[-9, -9], [9, -9], [-9, 9], [9, 9]]) {
      if (rand() < 0.25) continue; // plaza gap
      const x = bx + ox, z = bz + oz;
      const d = districtAt(x, z);
      const w = 11 + rand() * 5, dep = 11 + rand() * 5;
      const floors = 1 + Math.floor(rand() * rand() * 7); // mostly low, few tall
      const h = 4 + floors * 3.4;
      // --- Kenney building (80%) or procedural window-grid building (20%) ---
      let b = null;
      let roofH = h; // world-space roof height (for rooftop clutter)
      let isKenney = false;
      if (hasKenney && rand() < 0.8) {
        const pool = floors >= 5 ? A.buildings.tall : d.name === "Cinder Docks" ? A.buildings.industrial : d.name === "Palm Heights" ? A.buildings.house : (rand() < 0.5 ? A.buildings.mid : A.buildings.low);
        const src = pool[Math.floor(rand() * pool.length)];
        if (src) {
          b = src.clone(true);
          isKenney = true;
          // pastel tint (the Kenney colormap is muted grey/beige — multiply
          // by a light pastel so the city reads colorful like v11d)
          const tint = [0xffd9c9, 0xc9ffd9, 0xffe9a8, 0xc9e9ff, 0xffc9e0, 0xfff2cc, 0xd9c9ff, 0xc9fff2][Math.floor(rand() * 8)];
          b.traverse((o) => {
            if (o.isMesh && o.material && o.material.map) {
              o.material = o.material.clone();
              o.material.color.setHex(tint);
            }
          });
          // fit into the plot (uniform scale, ground at y=0)
          const box = new THREE.Box3().setFromObject(b);
          const size = new THREE.Vector3(); box.getSize(size);
          const s = Math.min(w / (size.x || 1), h / (size.y || 1), dep / (size.z || 1));
          b.scale.setScalar(Math.max(s, 0.5));
          const box2 = new THREE.Box3().setFromObject(b);
          b.position.y -= box2.min.y;
          roofH = box2.max.y - box2.min.y;
          // NOTE: rooftop clutter is added to the SCENE below (not as a
          // child of the scaled group — a child would inherit the scale
          // and float 60-180m up as a giant slab).
        }
      }
      if (!b) {
        // procedural fallback: window-grid facade + parapet + roof + awning + sign
        const base = Math.random() < 0.5 ? d.base : pickVar(d.base, rand);
        const tex = facadeTex(base, Math.max(2, floors), 3 + Math.floor(rand() * 2));
        const bmat = new THREE.MeshLambertMaterial({ map: tex });
        b = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, dep), bmat);
        body.position.y = h / 2; b.add(body);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.7, dep + 0.5), new THREE.MeshLambertMaterial({ color: d.accent }));
        trim.position.y = h + 0.35; b.add(trim);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w - 1, 0.4, dep - 1), new THREE.MeshLambertMaterial({ color: roofColors[Math.floor(rand() * roofColors.length)] }));
        roof.position.y = h + 0.9; b.add(roof);
        if (rand() < 0.7) {
          const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 2.2), new THREE.MeshLambertMaterial({ color: 0x9aa4a8 }));
          ac.position.set((rand() - 0.5) * (w - 4), h + 1.6, (rand() - 0.5) * (dep - 4)); b.add(ac);
        }
        if (rand() < 0.25) {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 10), new THREE.MeshLambertMaterial({ color: 0x7a6a5a }));
          tank.position.set((rand() - 0.5) * (w - 4), h + 2, (rand() - 0.5) * (dep - 4)); b.add(tank);
        }
        if (floors >= 5 && rand() < 0.4) {
          const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 2.2, dep * 0.5),
            new THREE.MeshLambertMaterial({ color: 0x7ed8c0, transparent: true, opacity: 0.85 }));
          crown.position.y = h + 2; b.add(crown);
        }
        if (floors <= 3 && rand() < 0.55) {
          const [c1, c2] = awnColors[Math.floor(rand() * awnColors.length)];
          const at = awningTex(c1, c2);
          const awn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, 2.6), new THREE.MeshLambertMaterial({ map: at, side: THREE.DoubleSide }));
          awn.position.set(0, 3.4, dep / 2 + 0.7); awn.rotation.x = -0.5; b.add(awn);
        }
        if (floors >= 2 && floors <= 5 && rand() < 0.3) {
          const label = CFG.signs[signIdx++ % CFG.signs.length];
          const st = signTex(label, "#1c2733", "#ffd76a");
          const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: st }));
          sign.position.set(0, h * 0.72, dep / 2 + 0.15); b.add(sign);
          world.signs.push(sign);
        }
      }
      b.position.set(x, 0, z);
      scene.add(b);
      world.buildings.push(b);
      // glowing name sign on ~25% of Kenney buildings (top 1-2 rule: every
      // building gets a saturated base + window grid + a BIG lit name sign).
      // Kept small so the aerial cover does not drown in sign clutter.
      if (isKenney && rand() < 0.25) {
        const label = CFG.signs[signIdx++ % CFG.signs.length];
        const st = signTex(label, "#1c2733", "#ffd76a");
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(9, w * 0.8), 2.0), new THREE.MeshBasicMaterial({ map: st }));
        sign.position.set(x, roofH * 0.72, z + dep / 2 + 0.15);
        scene.add(sign);
        world.signs.push(sign);
      }
      // east-face (road-facing) sign + striped awning — the wall the
      // coastal road sees is otherwise a blank slab (the big grey wall
      // in the chase shot). Small + high + rare: a big low sign looms
      // over the chase camera and hides the billboard.
      if (isKenney && rand() < 0.15) {
        const label2 = CFG.signs[signIdx++ % CFG.signs.length];
        const st2 = signTex(label2, "#1c2733", "#ffd76a");
        const signE = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(7, dep * 0.7), 1.8), new THREE.MeshBasicMaterial({ map: st2 }));
        signE.position.set(x + w / 2 + 0.15, roofH * 0.8, z);
        signE.rotation.y = Math.PI / 2;
        scene.add(signE);
        world.signs.push(signE);
      }
      if (isKenney && rand() < 0.4) {
        const [c1, c2] = awnColors[Math.floor(rand() * awnColors.length)];
        const at = awningTex(c1, c2);
        const awnG = new THREE.Group();
        const awn = new THREE.Mesh(new THREE.PlaneGeometry(dep * 0.9, 2.6), new THREE.MeshLambertMaterial({ map: at, side: THREE.DoubleSide }));
        awn.rotation.x = -0.5; awnG.add(awn);
        awnG.position.set(x + w / 2 + 0.7, 3.4, z);
        awnG.rotation.y = Math.PI / 2;
        scene.add(awnG);
      }
      // rooftop clutter on Kenney buildings (world space, sits on the roof)
      if (isKenney && rand() < 0.6) {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 2.2), new THREE.MeshLambertMaterial({ color: 0x9aa4a8 }));
        ac.position.set(x + (rand() - 0.5) * (w - 4), roofH + 0.55, z + (rand() - 0.5) * (dep - 4));
        scene.add(ac);
      }
      if (isKenney && rand() < 0.35) {
        const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 2.4, 10), new THREE.MeshLambertMaterial({ color: 0x7a6a5a }));
        tank.position.set(x + (rand() - 0.5) * (w - 4), roofH + 1.2, z + (rand() - 0.5) * (dep - 4));
        scene.add(tank);
      }
      if (isKenney && rand() < 0.3) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), new THREE.MeshLambertMaterial({ color: 0x3a3a3e }));
        ant.position.set(x + (rand() - 0.5) * (w - 4), roofH + 2.5, z + (rand() - 0.5) * (dep - 4));
        scene.add(ant);
        const cross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), new THREE.MeshLambertMaterial({ color: 0x3a3a3e }));
        cross.position.set(ant.position.x, roofH + 4.6, ant.position.z);
        scene.add(cross);
      }
    }
  }

  // ---------- Cinder Docks props: shipping containers, tank, chimney ----------
  if (A.props) {
    const conts = [A.props.containerA, A.props.containerB, A.props.containerC].filter(Boolean);
    for (let i = 0; i < 9 && conts.length; i++) {
      const c = conts[i % conts.length].clone(true);
      const box = new THREE.Box3().setFromObject(c);
      const size = new THREE.Vector3(); box.getSize(size);
      c.scale.setScalar(3.2 / (size.x || 1));
      const box2 = new THREE.Box3().setFromObject(c);
      c.position.y -= box2.min.y;
      // grid sits NORTH of the Dockside marker (z=-84) so no container
      // looms in the mission camera's foreground
      c.position.set(-150 + (i % 3) * 14, 0, -132 + Math.floor(i / 3) * 12);
      c.rotation.y = (i % 2) * 0.12;
      scene.add(c);
    }
    // bench + bin on the east sidewalk by the Dockside marker (-126,-84):
    // the mission frame otherwise reads as an empty road (v11d has a bench
    // + bin in this exact spot). Fixed here, not random, so it is always in
    // the mission shot.
    const mkBench = new THREE.Group();
    const mkSeat = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.18, 0.7, 1, 0.05), new THREE.MeshLambertMaterial({ color: 0x8a5a34 }));
    mkSeat.position.y = 0.55; mkBench.add(mkSeat);
    const mkBack = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.7, 0.15, 1, 0.05), new THREE.MeshLambertMaterial({ color: 0x8a5a34 }));
    mkBack.position.set(0, 1, -0.3); mkBench.add(mkBack);
    mkBench.position.set(-112, 0, -88); mkBench.rotation.y = -Math.PI / 2;
    scene.add(mkBench);
    const mkBin = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 1.1, 10), new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
    mkBin.position.set(-112, 0.55, -80); scene.add(mkBin);
    if (A.props.tank) {
      const tank = A.props.tank.clone(true);
      tank.scale.setScalar(3);
      tank.position.set(-170, 0, -60);
      scene.add(tank);
    }
    if (A.props.chimney) {
      const ch = A.props.chimney.clone(true);
      ch.scale.setScalar(4);
      ch.position.set(-180, 0, -140);
      scene.add(ch);
    }
  }

  // ---------- palms (curved trunk + drooping fronds) ----------
  function makePalm(s = 1) {
    const palm = new THREE.Group();
    const trunkPts = [];
    for (let i = 0; i <= 5; i++) trunkPts.push(new THREE.Vector3(Math.sin(i * 0.35) * 0.7, i * 1.6, 0));
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trunkPts), 8, 0.32, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a5a34 }));
    palm.add(trunk);
    const top = trunkPts[5];
    // all 7 fronds + nut merged into ONE geometry (1 draw call, not 8)
    const frondGeos = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const fg = new THREE.SphereGeometry(2.4, 8, 6);
      fg.scale(1.5, 0.22, 0.55);
      fg.rotateZ(0.35);
      fg.rotateY(-a);
      fg.translate(top.x + Math.cos(a) * 2.2, top.y + 0.4, Math.sin(a) * 2.2);
      frondGeos.push(fg);
    }
    const nutGeo = new THREE.SphereGeometry(0.5, 8, 6);
    nutGeo.translate(top.x, top.y + 0.3, top.z);
    frondGeos.push(nutGeo);
    const fronds = new THREE.Mesh(mergeGeometries(frondGeos), new THREE.MeshLambertMaterial({ color: 0x4fae54 }));
    palm.add(fronds);
    palm.scale.setScalar(s);
    return palm;
  }
  function makeTree() {
    const t = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 2.4, 6), new THREE.MeshLambertMaterial({ color: 0x6b4a2f }));
    trunk.position.y = 1.2; t.add(trunk);
    // 3 canopy blobs merged into one geometry (1 draw call)
    const blobGeos = [];
    for (let i = 0; i < 3; i++) {
      const bg = new THREE.SphereGeometry(1.8 - i * 0.4, 8, 6);
      bg.translate((Math.random() - 0.5), 2.8 + i * 0.9, (Math.random() - 0.5));
      blobGeos.push(bg);
    }
    const canopy = new THREE.Mesh(mergeGeometries(blobGeos), new THREE.MeshLambertMaterial({ color: 0x57b25e }));
    t.add(canopy);
    return t;
  }
  // palm row along the beach
  for (let z = -260; z <= 260; z += 26) {
    const p = makePalm(0.9 + rand() * 0.4);
    p.position.set(CFG.beachX + 6 + rand() * 8, 0, z + rand() * 6);
    scene.add(p); world.palms.push(p);
  }
  // scattered trees in blocks
  for (let i = 0; i < 46; i++) {
    const t = rand() < 0.6 ? makePalm(0.8 + rand() * 0.3) : makeTree();
    const x = (rand() * 2 - 1) * 190, z = (rand() * 2 - 1) * 190;
    if (Math.abs(x % CFG.roadSpacing) < 9 || Math.abs(z % CFG.roadSpacing) < 9) continue;
    if (x > CFG.beachX - 20) continue;
    t.position.set(x, 0, z); scene.add(t); world.palms.push(t);
  }
  // beach umbrellas — big and numerous so they read from the aerial cover
  const umbCols = [0xff5a8a, 0x2ec4b6, 0xffd76a, 0x7ed957, 0xff8a5e];
  for (let i = 0; i < 20; i++) {
    const u = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0xf5f0e0 }));
    pole.position.y = 1.6; u.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.4, 10), new THREE.MeshLambertMaterial({ color: umbCols[i % umbCols.length] }));
    top.position.y = 3.6; u.add(top);
    u.position.set(CFG.beachX + 10 + rand() * 70, 0, -260 + i * 28 + rand() * 10);
    scene.add(u);
  }

  // ---------- street lamps (Kenney GLB if available) + benches + bins ----------
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2e });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = -4; i <= 4; i++) {
    for (const z of [-126, -42, 42, 126]) {
      const x = i * CFG.roadSpacing + 8;
      if (A.props && A.props.lampCurved) {
        const lamp = A.props.lampCurved.clone(true);
        lamp.scale.setScalar(2.2);
        lamp.position.set(x, 0, z);
        scene.add(lamp);
      } else {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), lampMat);
        pole.position.set(x, 2.7, z); scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), bulbMat);
        bulb.position.set(x, 5.5, z); scene.add(bulb);
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.18, 0.7, 1, 0.05), new THREE.MeshLambertMaterial({ color: 0x8a5a34 }));
    seat.position.y = 0.55; bench.add(seat);
    const back = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.7, 0.15, 1, 0.05), new THREE.MeshLambertMaterial({ color: 0x8a5a34 }));
    back.position.set(0, 1, -0.3); bench.add(back);
    bench.position.set((rand() * 2 - 1) * 180, 0, (rand() * 2 - 1) * 180);
    scene.add(bench);
  }

  // ---------- EMBER BAY billboard gantry (high, clear of the HUD) ----------
  const gantry = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  for (const s of [-16.5, 16.5]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(1.2, 19, 1.2), postMat);
    post.position.set(s, 9.5, 0); gantry.add(post);
  }
  const boardTex = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = "#1a1030"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ff2ea6"; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = "#ffffff"; g.font = "bold 110px Arial, sans-serif"; g.textAlign = "center";
    g.fillText("EMBER BAY", w / 2, 118);
    g.fillStyle = "#ffd76a"; g.font = "bold 44px Arial, sans-serif";
    g.fillText("NEON ROW  •  OPEN ALL NIGHT", w / 2, 198);
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(34, 8.5), new THREE.MeshBasicMaterial({ map: boardTex }));
  board.position.y = 17.5; gantry.add(board);
  // small second board behind (depth cue)
  const board2 = new THREE.Mesh(new THREE.PlaneGeometry(34, 8.5), new THREE.MeshBasicMaterial({ map: boardTex }));
  board2.position.y = 17.5; board2.rotation.y = Math.PI; gantry.add(board2);
  gantry.position.set(168, 0, 84); // over the coastal road, north of the cover view
  scene.add(gantry);
  world.billboard = gantry;

  // ---------- update (clouds drift, smoke rises, boats bob) ----------
  world.update = (t, dt) => {
    for (const c of clouds) { c.position.x += dt * 1.5; if (c.position.x > 480) c.position.x = -480; }
    smoke.forEach((p, i) => {
      const ph = (t * 6 + i * 9) % 72; // rise 0..72m above the crater
      p.position.y = CFG.volcano.h + ph;
      // drift sideways + spread as they rise, flatten, fade out at the top
      p.position.x = Math.sin(t * 0.4 + i) * (2 + ph * 0.35) + (i % 3 - 1) * (4 + ph * 0.12);
      p.position.z = Math.cos(t * 0.3 + i * 1.7) * (2 + ph * 0.3) + ((i * 7) % 3 - 1) * (4 + ph * 0.1);
      const s = 1 + ph / 40; p.scale.set(s, s * 0.7, s);
      p.material.opacity = 0.8 * (1 - ph / 90);
    });
    boats.forEach((b, i) => { b.position.y = 0.2 + Math.sin(t * 0.8 + i * 2) * 0.25; b.rotation.z = Math.sin(t * 0.6 + i) * 0.03; });
  };

  return world;
}

function pickVar(base, rand) {
  const r = (base >> 16) & 255, g = (base >> 8) & 255, b = base & 255;
  const f = 0.82 + rand() * 0.36;
  return ((Math.min(255, r * f) | 0) << 16) | ((Math.min(255, g * f) | 0) << 8) | (Math.min(255, b * f) | 0);
}
