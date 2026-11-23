// EMBER BAY — world: the island city. Seeded, deterministic.
// Ground (roads, sidewalks, beach, sea) is one painted canvas texture;
// buildings are boxes with per-size window-grid textures, striped awnings
// and big readable signs. Peds never walk on asphalt: sidewalkPoint /
// clampToSidewalk keep them on the pavements.
(function () {
  var EB = window.EB || (window.EB = {});
  var C = EB.config, G = C.GRID;

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var rng = mulberry32(20261123);

  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function rr(a, b) { return a + rng() * (b - a); }

  var scene = null, colliders = [], blocks = [], noBuild = [{ x: 192, z: 48, r: 16 }, { x: 192, z: -64, r: 16 }];
  var VOLCANO = { x: -170, z: -170, r: 58, h: 95 };
  var smokePuffs = [], sailboats = [], billboardMesh = null;

  // ---- canvas helpers ----
  function cv(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
  function tex(canvas) { var t = new THREE.CanvasTexture(canvas); t.anisotropy = 1; t.colorSpace = THREE.SRGBColorSpace; return t; }
  function hex(n) { return "#" + ("000000" + n.toString(16)).slice(-6); }

  // ---- ground: one 2048 canvas for x,z in [-240, 320] ----
  var GS = 2048 / 560, GO = 240;
  function gx(x) { return (x + GO) * GS; }
  function gz(z) { return (z + GO) * GS; }
  var groundCanvas = null;

  function paintGround() {
    var pair = cv(2048, 2048), c = pair[0], g = pair[1];
    // grass base
    g.fillStyle = "#69b34c"; g.fillRect(0, 0, 2048, 2048);
    for (var i = 0; i < 2600; i++) {
      g.fillStyle = rng() < 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,60,0,0.06)";
      g.fillRect(rng() * 2048, rng() * 2048, rr(4, 26), rr(4, 26));
    }
    // sea (east) + beach sand
    g.fillStyle = "#2fb3a3"; g.fillRect(gx(250), 0, 2048 - gx(250), 2048);
    g.fillStyle = "#1d8a9e";
    for (var w = 0; w < 26; w++) { g.fillRect(gx(252), rng() * 2048, 2048 - gx(252), 2); }
    g.fillStyle = "#f2d8a0"; g.fillRect(gx(205), 0, gx(250) - gx(205), 2048);
    g.fillStyle = "rgba(255,255,255,0.25)";
    for (var s = 0; s < 40; s++) { g.fillRect(gx(205) + rng() * (gx(250) - gx(205)), rng() * 2048, rr(6, 20), 3); }
    // sidewalks (light grey, tiled) then asphalt roads
    var lines = [];
    for (var v = G.min; v <= G.max; v += G.spacing) lines.push(v);
    g.strokeStyle = "rgba(0,0,0,0.10)"; g.lineWidth = 1;
    lines.forEach(function (L) {
      g.fillStyle = "#cfc8bd";
      g.fillRect(gx(L - G.walkHalf), 0, (G.walkHalf * 2) * GS, 2048);
      g.fillRect(0, gz(L - G.walkHalf), 2048, (G.walkHalf * 2) * GS);
      // tile seams
      for (var t = -240; t < 320; t += 8) {
        g.beginPath(); g.moveTo(gx(L - G.walkHalf), gz(t)); g.lineTo(gx(L + G.walkHalf), gz(t)); g.stroke();
        g.beginPath(); g.moveTo(gx(t), gz(L - G.walkHalf)); g.lineTo(gx(t), gz(L + G.walkHalf)); g.stroke();
      }
    });
    // asphalt with mottled square patches
    lines.forEach(function (L) {
      g.fillStyle = "#2b2b33";
      g.fillRect(gx(L - G.roadHalf), 0, (G.roadHalf * 2) * GS, 2048);
      g.fillRect(0, gz(L - G.roadHalf), 2048, (G.roadHalf * 2) * GS);
      for (var p = 0; p < 260; p++) {
        var px = gx(L - G.roadHalf) + rng() * (G.roadHalf * 2) * GS, pz = rng() * 2048;
        g.fillStyle = rng() < 0.5 ? "rgba(255,255,255,0.045)" : "rgba(0,0,0,0.09)";
        g.fillRect(px, pz, rr(7, 16), rr(7, 16));
      }
      // lane dashes
      g.fillStyle = "rgba(255,255,255,0.75)";
      for (var d = -220; d < 220; d += 12) {
        g.fillRect(gx(L) - 1.5, gz(d), 3, 5 * GS);
        g.fillRect(gx(d), gz(L) - 1.5, 5 * GS, 3);
      }
      // crosswalks at every intersection
      lines.forEach(function (M) {
        for (var k = -2; k <= 2; k++) {
          g.fillRect(gx(L - 4 + k * 1.8), gz(M - 6), 1.1 * GS, 12 * GS);
          g.fillRect(gx(M - 6), gz(L - 4 + k * 1.8), 12 * GS, 1.1 * GS);
        }
      });
    });
    groundCanvas = c;
    return tex(c);
  }

  // ---- building textures ----
  var bTexCache = {};
  function buildingTexture(color, cols, rows) {
    var key = color + "|" + cols + "|" + rows;
    if (bTexCache[key]) return bTexCache[key];
    var pair = cv(128, 256), c = pair[0], g = pair[1];
    g.fillStyle = hex(color); g.fillRect(0, 0, 128, 256);
    g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(0, 0, 128, 10);
    var cw = 128 / cols, ch = 256 / rows;
    for (var r = 0; r < rows; r++) for (var cc = 0; cc < cols; cc++) {
      var lit = rng() < 0.14;
      g.fillStyle = lit ? "#ffd75e" : "#1c2733";
      g.fillRect(cc * cw + cw * 0.22, r * ch + ch * 0.25, cw * 0.56, ch * 0.5);
      g.fillStyle = "rgba(255,255,255,0.16)";
      g.fillRect(cc * cw + cw * 0.22, r * ch + ch * 0.25, cw * 0.56, 2);
    }
    var t = tex(c);
    bTexCache[key] = t;
    return t;
  }
  function glassTexture() {
    var pair = cv(64, 256), c = pair[0], g = pair[1];
    var gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#a8e8c8"); gr.addColorStop(0.55, "#5fd4a8"); gr.addColorStop(1, "#2aa882");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    g.fillStyle = "rgba(10,40,30,0.55)";
    for (var r = 0; r < 14; r++) for (var cc = 0; cc < 3; cc++) g.fillRect(6 + cc * 20, 8 + r * 18, 14, 10);
    return tex(c);
  }
  function signTexture(text, sub, bg, fg) {
    var pair = cv(512, 128), c = pair[0], g = pair[1];
    g.fillStyle = bg; g.fillRect(0, 0, 512, 128);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(6, 6, 500, 116);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 56px Arial";
    g.fillText(text, 256, sub ? 52 : 64, 480);
    if (sub) { g.font = "bold 26px Arial"; g.fillText(sub, 256, 100, 480); }
    return tex(c);
  }
  function awningTexture(color) {
    var pair = cv(128, 64), c = pair[0], g = pair[1];
    for (var i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#ffffff" : hex(color); g.fillRect(i * 16, 0, 16, 64); }
    g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0, 48, 128, 16);
    return tex(c);
  }
  function billboardTexture() {
    var pair = cv(1024, 320), c = pair[0], g = pair[1];
    g.fillStyle = "#14082e"; g.fillRect(0, 0, 1024, 320);
    g.strokeStyle = "#ff2fb3"; g.lineWidth = 10; g.strokeRect(10, 10, 1004, 300);
    g.strokeStyle = "rgba(255,47,179,0.4)"; g.lineWidth = 22; g.strokeRect(22, 22, 980, 276);
    g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "900 150px Arial"; g.fillText("EMBER BAY", 512, 130, 960);
    g.fillStyle = "#ffb3a7"; g.font = "bold 54px Arial";
    g.fillText("NEON ROW • OPEN ALL NIGHT", 512, 250, 940);
    return tex(c);
  }

  // ---- shared geometry/materials ----
  var boxGeo = new THREE.BoxGeometry(1, 1, 1);
  var cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  var coneGeo = new THREE.ConeGeometry(1, 1, 10);
  var sphereGeo = new THREE.SphereGeometry(1, 12, 10);
  var matCache = {};
  function mat(color, opts) {
    var key = color + "|" + JSON.stringify(opts || {});
    if (!matCache[key]) {
      var o = opts || {};
      matCache[key] = new THREE.MeshLambertMaterial({ color: color, emissive: o.emissive || 0x000000, emissiveIntensity: o.ei || 1, transparent: !!o.transparent, opacity: o.opacity == null ? 1 : o.opacity });
    }
    return matCache[key];
  }
  function phong(color, shininess) {
    var key = "p" + color + "|" + shininess;
    if (!matCache[key]) matCache[key] = new THREE.MeshPhongMaterial({ color: color, shininess: shininess || 60, specular: 0x666666 });
    return matCache[key];
  }
  function box(w, h, d, material, x, y, z, ry) {
    var m = new THREE.Mesh(boxGeo, material);
    m.scale.set(w, h, d); m.position.set(x, y, z);
    if (ry) m.rotation.y = ry;
    m.castShadow = false; m.receiveShadow = false;
    scene.add(m);
    return m;
  }

  // ---- placement helpers ----
  function roadLines() { var a = []; for (var v = G.min; v <= G.max; v += G.spacing) a.push(v); return a; }
  function nearestLine(v) { return Math.round((v - G.min) / G.spacing) * G.spacing + G.min; }
  function isOnRoad(x, z) {
    if (x < -205 || x > 205 || z < -205 || z > 205) return false;
    return Math.abs(x - nearestLine(x)) < G.roadHalf || Math.abs(z - nearestLine(z)) < G.roadHalf;
  }
  function inNoBuild(x, z) {
    for (var i = 0; i < noBuild.length; i++) { var nb = noBuild[i]; if (Math.hypot(x - nb.x, z - nb.z) < nb.r) return true; }
    if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.r + 12) return true;
    return false;
  }
  function sidewalkPoint() {
    var lines = roadLines(), horizontal = rng() < 0.5;
    var L = pick(lines), along = rr(-195, 195), off = (G.roadHalf + 1.5 + rng() * 1.5) * (rng() < 0.5 ? -1 : 1);
    if (horizontal) return { x: along, z: L + off };
    return { x: L + off, z: along };
  }
  function clampToSidewalk(p) {
    if (!isOnRoad(p.x, p.z)) return p;
    var lx = nearestLine(p.x), lz = nearestLine(p.z);
    var dx = Math.abs(p.x - lx), dz = Math.abs(p.z - lz);
    if (dx < G.roadHalf && dx <= dz) p.x = lx + (p.x >= lx ? 1 : -1) * (G.roadHalf + 1.5);
    else if (dz < G.roadHalf) p.z = lz + (p.z >= lz ? 1 : -1) * (G.roadHalf + 1.5);
    return p;
  }
  function collideCircle(p, r) {
    for (var i = 0; i < colliders.length; i++) {
      var b = colliders[i];
      var nx = Math.max(b.x0, Math.min(p.x, b.x1)), nz = Math.max(b.z0, Math.min(p.z, b.z1));
      var ddx = p.x - nx, ddz = p.z - nz, d2 = ddx * ddx + ddz * ddz;
      if (d2 < r * r) {
        if (d2 < 0.0001) { p.x = b.x1 + r; continue; }
        var d = Math.sqrt(d2);
        p.x = nx + ddx / d * r; p.z = nz + ddz / d * r;
      }
    }
    return p;
  }
  function districtAt(x, z) {
    for (var i = 0; i < C.DISTRICTS.length; i++) { var d = C.DISTRICTS[i]; if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d.name; }
    return "Ember Bay";
  }
  function streetAt(x, z) {
    var ix = Math.round((x - G.min) / G.spacing), iz = Math.round((z - G.min) / G.spacing);
    var dx = Math.abs(x - nearestLine(x)), dz = Math.abs(z - nearestLine(z));
    if (dx <= dz) return C.STREET_NAMES[ix % C.STREET_NAMES.length];
    return C.STREET_NAMES[iz % C.STREET_NAMES.length];
  }

  // ---- builders ----
  function buildSky() {
    var pair = cv(64, 512), c = pair[0], g = pair[1];
    var gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, "#14205c"); gr.addColorStop(0.3, "#4a3a9e"); gr.addColorStop(0.45, "#e85d3d");
    gr.addColorStop(0.62, "#ff8a3c"); gr.addColorStop(0.8, "#ffb347"); gr.addColorStop(1, "#ffd75e");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
    var sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), new THREE.MeshBasicMaterial({ map: tex(c), side: THREE.BackSide, fog: false }));
    scene.add(sky);
    var sun = new THREE.Mesh(new THREE.CircleGeometry(58, 32), new THREE.MeshBasicMaterial({ color: 0xffdf6b, fog: false }));
    sun.position.set(-620, 210, -420); sun.lookAt(0, 40, 0);
    scene.add(sun);
    var sunGlow = new THREE.Mesh(new THREE.CircleGeometry(70, 32), new THREE.MeshBasicMaterial({ color: 0xff9a3c, fog: false, transparent: true, opacity: 0.35 }));
    sunGlow.position.set(-622, 210, -422); sunGlow.lookAt(0, 40, 0);
    scene.add(sunGlow);
    // clouds
    for (var i = 0; i < 12; i++) {
      var cl = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, fog: false }));
      cl.scale.set(rr(18, 42), rr(4, 7), rr(10, 18));
      cl.position.set(rr(-500, 500), rr(150, 260), rr(-500, 300));
      scene.add(cl);
    }
  }

  function buildGround() {
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), new THREE.MeshLambertMaterial({ map: paintGround() }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(40, 0, 40);
    scene.add(ground);
    // sea swell plane slightly above, translucent
    var sea = new THREE.Mesh(new THREE.PlaneGeometry(90, 560), new THREE.MeshLambertMaterial({ color: 0x2fb3a3, transparent: true, opacity: 0.25 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(295, 0.15, 40);
    scene.add(sea);
  }

  function buildVolcano() {
    var pair = cv(256, 256), c = pair[0], g = pair[1];
    g.fillStyle = "#4a2c22"; g.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 26; i++) {
      g.strokeStyle = rng() < 0.5 ? "#ff6a1e" : "#8a3d1e"; g.lineWidth = rr(2, 6);
      var x0 = 60 + rng() * 136;
      g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + rr(-30, 30), 256); g.stroke();
    }
    var cone = new THREE.Mesh(new THREE.ConeGeometry(VOLCANO.r, VOLCANO.h, 18), new THREE.MeshLambertMaterial({ map: tex(c) }));
    cone.position.set(VOLCANO.x, VOLCANO.h / 2 - 2, VOLCANO.z);
    scene.add(cone);
    var lava = new THREE.Mesh(new THREE.CircleGeometry(13, 16), new THREE.MeshBasicMaterial({ color: 0xff7a1e }));
    lava.rotation.x = -Math.PI / 2; lava.position.set(VOLCANO.x, VOLCANO.h - 1, VOLCANO.z);
    scene.add(lava);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(13, 2.4, 8, 18), mat(0x3a2018));
    rim.rotation.x = Math.PI / 2; rim.position.set(VOLCANO.x, VOLCANO.h - 2, VOLCANO.z);
    scene.add(rim);
    for (var p = 0; p < 6; p++) {
      var puff = new THREE.Mesh(sphereGeo, new THREE.MeshLambertMaterial({ color: 0xcfc8c0, transparent: true, opacity: 0.55 }));
      puff.scale.set(rr(9, 15), rr(6, 9), rr(9, 15));
      puff.position.set(VOLCANO.x + rr(-8, 8), VOLCANO.h + 6 + p * 7, VOLCANO.z + rr(-8, 8));
      puff.userData.drift = rr(0.3, 0.8);
      scene.add(puff); smokePuffs.push(puff);
    }
  }

  function buildBuildings() {
    var lines = roadLines();
    var glassTex = glassTexture();
    var blockColor = {};
    var bi = 0;
    for (var bx = 0; bx < 10; bx++) for (var bz = 0; bz < 10; bz++) {
      var x0 = lines[bx] + G.walkHalf, z0 = lines[bz] + G.walkHalf;
      var x1 = lines[bx + 1] - G.walkHalf, z1 = lines[bz + 1] - G.walkHalf;
      var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      var district = districtAt(cx, cz);
      var bc = pick(C.BUILDING_COLORS);
      blocks.push({ x0: x0, z0: z0, x1: x1, z1: z1, color: bc, district: district });
      blockColor[bx + "," + bz] = bc;
      for (var sx = 0; sx < 2; sx++) for (var sz = 0; sz < 2; sz++) {
        if (rng() > 0.52) continue;
        var px = x0 + 2 + sx * 11 + 5.5, pz = z0 + 2 + sz * 11 + 5.5;
        if (px > 196 || inNoBuild(px, pz)) continue;
        var w = rr(8, 12), d = rr(8, 12);
        var central = Math.hypot(cx, cz) < 90;
        var h = central ? rr(10, 30) : rr(7, 16);
        if (district === "Neon Row" && rng() < 0.22) h = rr(24, 38);
        var glass = (district === "Neon Row" && rng() < 0.10) || (district === "Sunset Beach" && rng() < 0.12) || (rng() < 0.05);
        var color = glass ? pick(C.GLASS_COLORS) : (rng() < 0.6 ? bc : pick(C.BUILDING_COLORS));
        var cols = Math.max(2, Math.round(w / 3)), rows = Math.max(2, Math.round(h / 3.6));
        var sideMat = glass
          ? new THREE.MeshPhongMaterial({ map: glassTex, shininess: 90, specular: 0x99ccbb })
          : new THREE.MeshLambertMaterial({ map: buildingTexture(color, cols, rows) });
        var roofMat = mat(0x3a3340);
        var mats = [sideMat, sideMat, roofMat, roofMat, sideMat, sideMat];
        var b = new THREE.Mesh(boxGeo, mats);
        b.scale.set(w, h, d); b.position.set(px, h / 2, pz);
        scene.add(b);
        colliders.push({ x0: px - w / 2, z0: pz - d / 2, x1: px + w / 2, z1: pz + d / 2 });
        // flat roof cap + occasional roof box
        if (rng() < 0.15) box(w * 0.5, 1.2, d * 0.5, mat(0x555066), px + rr(-1, 1), h + 0.6, pz + rr(-1, 1));
        // striped awning on low shops
        if (h < 12 && rng() < 0.55) {
          var aw = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 2.2), new THREE.MeshLambertMaterial({ map: awningTexture(pick([0xd81e2c, 0x2ec4b6, 0xff9a3c, 0x7ed957])), side: THREE.DoubleSide }));
          aw.position.set(px, 3.2, pz + d / 2 + 1.0); aw.rotation.x = -0.5;
          scene.add(aw);
        }
        // big readable sign on mid-rises
        if (h >= 10 && h <= 26 && rng() < 0.30) {
          var signText = C.SIGNS[bi++ % C.SIGNS.length];
          var sm = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(11, w * 0.95), 2.8), new THREE.MeshBasicMaterial({ map: signTexture(signText, null, pick(["#14082e", "#7a1020", "#0b3d5c", "#123f2a"]), "#ffffff") }));
          sm.position.set(px, h * 0.72, pz + d / 2 + 0.12);
          scene.add(sm);
        }
      }
    }
    // far skyline towers (glass, beyond the grid)
    for (var f = 0; f < 8; f++) {
      var fx = rr(-230, -205), fz = rr(-200, 200);
      if (inNoBuild(fx, fz)) continue;
      var fh = rr(30, 52), fw = rr(12, 18);
      var t = new THREE.Mesh(boxGeo, new THREE.MeshPhongMaterial({ map: glassTex, shininess: 90, specular: 0x99ccbb }));
      t.scale.set(fw, fh, fw); t.position.set(fx, fh / 2, fz);
      scene.add(t);
    }
  }

  function buildProps() {
    // palms along sidewalks + beach
    var trunkMat = mat(0x8a6a42), frondMat = mat(0x2fae5f);
    function palm(x, z, s) {
      var g = new THREE.Group();
      var trunk = new THREE.Mesh(cylGeo, trunkMat);
      trunk.scale.set(0.28 * s, 5.5 * s, 0.28 * s); trunk.position.y = 2.75 * s; g.add(trunk);
      var crown = new THREE.Mesh(coneGeo, frondMat);
      crown.scale.set(2.6 * s, 2.4 * s, 2.6 * s); crown.position.y = 6.4 * s; g.add(crown);
      var crown2 = new THREE.Mesh(coneGeo, frondMat);
      crown2.scale.set(2.0 * s, 1.6 * s, 2.0 * s); crown2.position.y = 7.2 * s; g.add(crown2);
      g.position.set(x, 0, z);
      scene.add(g);
    }
    for (var i = 0; i < 46; i++) { var p = sidewalkPoint(); if (p.x < 200) palm(p.x, p.z, rr(0.85, 1.25)); }
    for (var b = 0; b < 22; b++) palm(rr(210, 244), rr(-200, 200), rr(0.9, 1.3));
    // beach umbrellas + towels
    var umCols = [0xff5b8a, 0xffd75e, 0x2ec4b6, 0xff9a3c];
    for (var u = 0; u < 16; u++) {
      var ux = rr(212, 244), uz = rr(-190, 190);
      var pole = new THREE.Mesh(cylGeo, mat(0xe8e0d0));
      pole.scale.set(0.09, 2.4, 0.09); pole.position.set(ux, 1.2, uz); scene.add(pole);
      var um = new THREE.Mesh(coneGeo, mat(pick(umCols)));
      um.scale.set(2.2, 1.1, 2.2); um.position.set(ux, 2.8, uz); scene.add(um);
      if (rng() < 0.7) box(1.8, 0.08, 0.9, mat(pick(umCols)), ux + rr(-2, 2), 0.1, uz + rr(-2, 2), rr(0, 3));
    }
    // sailboats on the sea
    for (var s = 0; s < 3; s++) {
      var sb = new THREE.Group();
      var hull = new THREE.Mesh(boxGeo, mat(0xf5f0e0));
      hull.scale.set(4.4, 1, 1.6); hull.position.y = 0.5; sb.add(hull);
      var mast = new THREE.Mesh(cylGeo, mat(0x6a4a2a));
      mast.scale.set(0.12, 6, 0.12); mast.position.y = 3.5; sb.add(mast);
      var sail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 4.6, 3), mat(pick([0xffffff, 0xffd75e, 0x2ec4b6])));
      sail.scale.set(1, 1, 0.25); sail.position.set(0.4, 4, 0); sb.add(sail);
      sb.position.set(rr(262, 310), 0.1, [-120, 10, 130][s] + rr(-15, 15));
      sb.rotation.y = rr(-0.4, 0.4);
      scene.add(sb); sailboats.push(sb);
    }
    // street lamps, benches, bins
    for (var l = 0; l < 24; l++) {
      var lp = sidewalkPoint();
      var pole = new THREE.Mesh(cylGeo, mat(0x22242e));
      pole.scale.set(0.12, 6.4, 0.12); pole.position.set(lp.x, 3.2, lp.z); scene.add(pole);
      var lamp = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
      lamp.scale.set(0.5, 0.35, 0.5); lamp.position.set(lp.x, 6.5, lp.z); scene.add(lamp);
    }
    for (var bn = 0; bn < 14; bn++) {
      var bp = sidewalkPoint();
      box(2.4, 0.5, 0.9, mat(0x8a5a32), bp.x, 0.55, bp.z, rr(0, 3));
      box(0.5, 0.5, 0.5, mat(0x2e7d4f), bp.x + rr(-3, 3), 0.35, bp.z + rr(-3, 3));
    }
    // Portside container yard + cranes
    for (var cn = 0; cn < 18; cn++) {
      var cxp = rr(-200, -60), czp = rr(-200, -120);
      box(rr(5, 7), 2.6, 2.6, mat(pick([0xd81e2c, 0x2ec4b6, 0xf2a516, 0x7ec8e3])), cxp, 1.3 + (cn % 3) * 2.6, czp, rr(0, 1.57));
    }
    for (var cr = 0; cr < 2; cr++) {
      var crx = -150 + cr * 60, crz = -150;
      box(2, 34, 2, mat(0xf2a516), crx, 17, crz);
      box(26, 2, 2, mat(0xf2a516), crx + 8, 32, crz);
      box(3, 4, 3, mat(0x333333), crx + 16, 29.5, crz);
    }
  }

  function buildGantries() {
    // two EMBER BAY gantries spanning the coastal road (x=200)
    [{ z: 48 }, { z: -64 }].forEach(function (gz0, idx) {
      var z = gz0.z;
      box(1.2, 13, 1.2, mat(0x1c1c26), 192, 6.5, z);
      box(1.2, 13, 1.2, mat(0x1c1c26), 208, 6.5, z);
      var panel = new THREE.Mesh(new THREE.PlaneGeometry(18, 5.6), new THREE.MeshBasicMaterial({ map: billboardTexture(), side: THREE.DoubleSide }));
      panel.position.set(200, 11.5, z);
      scene.add(panel);
      var beam = box(17.5, 0.8, 0.8, mat(0x1c1c26), 200, 14.6, z);
      if (idx === 0) billboardMesh = panel;
    });
  }

  // ---- minimap painting ----
  function drawMinimap(ctx2d, size, px, pz, heading, objective, big) {
    var S = size, sc = S / 560, ox = 240 * sc, oz = 240 * sc;
    var X = function (x) { return (x + 240) * sc; }, Z = function (z) { return (z + 240) * sc; };
    ctx2d.clearRect(0, 0, S, S);
    ctx2d.save();
    ctx2d.beginPath(); ctx2d.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); ctx2d.clip();
    ctx2d.fillStyle = "#1a2438"; ctx2d.fillRect(0, 0, S, S);
    // sea + beach
    ctx2d.fillStyle = "#2fb3a3"; ctx2d.fillRect(X(250), 0, S, S);
    ctx2d.fillStyle = "#f2d8a0"; ctx2d.fillRect(X(205), 0, X(250) - X(205), S);
    // pastel mosaic blocks
    blocks.forEach(function (b) {
      ctx2d.fillStyle = hex(b.color);
      ctx2d.fillRect(X(b.x0) + 0.5, Z(b.z0) + 0.5, (b.x1 - b.x0) * sc - 1, (b.z1 - b.z0) * sc - 1);
    });
    // roads
    ctx2d.strokeStyle = "#22222e"; ctx2d.lineWidth = Math.max(1, 7 * sc);
    var lines = roadLines();
    lines.forEach(function (L) {
      ctx2d.beginPath(); ctx2d.moveTo(X(L), 0); ctx2d.lineTo(X(L), S); ctx2d.stroke();
      ctx2d.beginPath(); ctx2d.moveTo(0, Z(L)); ctx2d.lineTo(S, Z(L)); ctx2d.stroke();
    });
    // volcano
    ctx2d.fillStyle = "#4a2c22";
    ctx2d.beginPath(); ctx2d.moveTo(X(VOLCANO.x), Z(VOLCANO.z - 14)); ctx2d.lineTo(X(VOLCANO.x - 12), Z(VOLCANO.z + 10)); ctx2d.lineTo(X(VOLCANO.x + 12), Z(VOLCANO.z + 10)); ctx2d.closePath(); ctx2d.fill();
    // objective diamond
    if (objective) {
      ctx2d.fillStyle = "#ff2fb3";
      var ox2 = X(objective.x), oz2 = Z(objective.z), r = big ? 9 : 6;
      ctx2d.beginPath(); ctx2d.moveTo(ox2, oz2 - r); ctx2d.lineTo(ox2 + r, oz2); ctx2d.lineTo(ox2, oz2 + r); ctx2d.lineTo(ox2 - r, oz2); ctx2d.closePath(); ctx2d.fill();
      ctx2d.strokeStyle = "#ffffff"; ctx2d.lineWidth = 1.5; ctx2d.stroke();
    }
    // player arrow
    var px2 = X(px), pz2 = Z(pz);
    ctx2d.save(); ctx2d.translate(px2, pz2); ctx2d.rotate(Math.PI / 2 - heading);
    ctx2d.fillStyle = "#ffffff"; ctx2d.strokeStyle = "#222"; ctx2d.lineWidth = 1.5;
    ctx2d.beginPath(); ctx2d.moveTo(0, -8); ctx2d.lineTo(5.5, 6); ctx2d.lineTo(0, 3); ctx2d.lineTo(-5.5, 6); ctx2d.closePath(); ctx2d.fill(); ctx2d.stroke();
    ctx2d.restore();
    // north marker
    ctx2d.fillStyle = "#ffffff"; ctx2d.font = "bold " + (big ? 18 : 12) + "px Arial"; ctx2d.textAlign = "center";
    ctx2d.fillText("N", S - 14, 20);
    ctx2d.restore();
  }

  function build(sc) {
    scene = sc;
    buildSky(); buildGround(); buildVolcano(); buildBuildings(); buildProps(); buildGantries();
  }

  EB.world = {
    build: build, isOnRoad: isOnRoad, sidewalkPoint: sidewalkPoint, clampToSidewalk: clampToSidewalk,
    collideCircle: collideCircle, districtAt: districtAt, streetAt: streetAt, drawMinimap: drawMinimap,
    colliders: colliders, blocks: blocks, VOLCANO: VOLCANO, billboard: function () { return billboardMesh; },
    smokePuffs: smokePuffs, sailboats: sailboats, groundCanvas: function () { return groundCanvas; }
  };
})();
