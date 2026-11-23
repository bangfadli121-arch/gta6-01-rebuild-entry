// EMBER BAY — Heat Line: world.js (v4 visual rebuild, from scratch)
// One job: build the island city — sky, golden-hour light, ground, roads,
// detailed buildings, palms, lamps, water and district signs — and answer
// collision and district questions for the rest of the game.
//
// v4 design (total visual overhaul): the city is laid out on a proper
// block grid — buildings fill the blocks between roads, never the roads
// themselves — with crisp window grids, shopfront ground floors, balconies,
// varied roofs (pyramid / parapet / tower), and a harmonious saturated
// palette. No giant plain colour blocks at building bases. The east edge
// is a turquoise bay with a sandy beach; a smoking volcano stands on the
// north-west horizon; the big neon gantry over the coastal road is the
// poster's focal point.
EB.world = (function () {
  var scene = null, camera = null, renderer = null;
  var colliders = [];   // {x, z, r} circles the player/cars cannot pass
  var blocks = [];      // {x, z, w, d} building footprints (minimap)
  var signs = [];
  var clock = null;

  function canvasTexture(w, h, draw) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  // v9: MOTTLED asphalt the way BOTH top entries texture their roads —
  // LARGE soft square patches (~3 m) in barely-different warm greys,
  // never a tight high-contrast checkerboard. The old 4x4 grid of
  // 1.5 m squares read as floor tiles; 2x2 patches + speckle read as
  // worn asphalt.
  var asphaltCanvas = null;
  function asphaltTex(orient) {
    if (!asphaltCanvas) {
      asphaltCanvas = document.createElement("canvas");
      asphaltCanvas.width = 256; asphaltCanvas.height = 256;
      var g = asphaltCanvas.getContext("2d");
      g.fillStyle = "#34383f"; g.fillRect(0, 0, 256, 256);
      var shades = ["#33373e", "#383c43", "#31353b", "#3a3d44", "#363a40", "#383b41"];
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
        g.fillStyle = shades[Math.floor(Math.random() * shades.length)];
        g.fillRect(i * 128, j * 128, 128, 128);
      }
      // Speckle + a few faint darker repairs break the square edges.
      g.fillStyle = "rgba(255,255,255,0.04)";
      for (var k = 0; k < 220; k++) g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      g.fillStyle = "rgba(0,0,0,0.08)";
      for (var r = 0; r < 8; r++) g.fillRect(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 22, 6 + Math.random() * 12);
    }
    var tex = new THREE.CanvasTexture(asphaltCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    if (orient === "v") tex.repeat.set(1.7, 87); else tex.repeat.set(87, 1.7);
    return tex;
  }

  // Tiled sidewalks (Karimbu: pale tiles with a darker grid). v9:
  // BIG 2 m tiles with a bold dark grout, so the grid reads at a
  // glance instead of dissolving into noise.
  var sidewalkCanvas = null;
  function sidewalkTex(orient) {
    if (!sidewalkCanvas) {
      sidewalkCanvas = document.createElement("canvas");
      sidewalkCanvas.width = 128; sidewalkCanvas.height = 128;
      var g = sidewalkCanvas.getContext("2d");
      g.fillStyle = "#e8dcc0"; g.fillRect(0, 0, 128, 128);
      g.strokeStyle = "#b3a075"; g.lineWidth = 3;
      for (var p = 0; p <= 128; p += 64) {
        g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 128); g.stroke();
        g.beginPath(); g.moveTo(0, p); g.lineTo(128, p); g.stroke();
      }
      g.fillStyle = "rgba(0,0,0,0.05)";
      for (var k = 0; k < 60; k++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    var tex = new THREE.CanvasTexture(sidewalkCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    if (orient === "v") tex.repeat.set(1, 130); else tex.repeat.set(130, 1);
    return tex;
  }

  // Dashed white lane line as a texture (one long plane per road, not
  // hundreds of little dash meshes).
  var dashCanvas = null;
  function dashTex(orient) {
    if (!dashCanvas) {
      dashCanvas = document.createElement("canvas");
      dashCanvas.width = 64; dashCanvas.height = 64;
      var g = dashCanvas.getContext("2d");
      g.clearRect(0, 0, 64, 64);
      g.fillStyle = "#ffffff";
      g.fillRect(8, 6, 48, 28);
    }
    var tex = new THREE.CanvasTexture(dashCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if (orient === "v") tex.repeat.set(1, 40); else tex.repeat.set(40, 1);
    return tex;
  }

  // Mission-critical spots a building must never cover: the first car,
  // the Ember GT, crates, guards, race gates, drops and the hideout.
  // (radius, metres — the building is skipped when its footprint would
  // come within this + its own collider of the point.)
  // v5: the PLAYER SPAWN (24,24) is in here too — a building could
  // spawn right north of it and wall the player off from the first
  // car at (30,8); together with that point's r=14 the whole walk
  // from spawn to first car is now guaranteed clear.
  var EXCLUDE = [
    { x: 24, z: 24, r: 14 },
    { x: 30, z: 8, r: 14 }, { x: 12, z: 150, r: 14 },
    { x: 20, z: 160, r: 14 }, { x: 30, z: 150, r: 14 },
    { x: -30, z: 150, r: 14 }, { x: -10, z: 140, r: 14 },
    { x: -20, z: 130, r: 14 }, { x: -40, z: 170, r: 14 },
    { x: 160, z: -160, r: 14 }, { x: -185, z: -175, r: 12 },
    { x: 150, z: -190, r: 10 }, { x: 190, z: -130, r: 10 },
    { x: 130, z: -100, r: 10 }, { x: 185, z: -185, r: 10 },
    { x: -160, z: 120, r: 12 }, { x: 0, z: -185, r: 10 },
    { x: 200, z: 140, r: 12 },
    // v11: the two neon gantries are the poster's focal point — no
    // building may stand in the sightline in front of them (the dense
    // 2x2 blocks put a Sunset Beach tower in front of the EMBER BAY
    // panel and the cover read "BER BAY").
    { x: 192, z: 48, r: 16 }, { x: 192, z: -64, r: 16 },
  ];
  function excluded(x, z, w, d) {
    var need = Math.max(w, d) * 0.62 + 2;
    for (var i = 0; i < EXCLUDE.length; i++) {
      var e = EXCLUDE[i];
      if (EB.util.dist2(x, z, e.x, e.z) < e.r + need) return true;
    }
    return false;
  }

  // Building facade: neat window grid with white frames, warm lit glass,
  // thin floor bands, a cornice at the top and a shopfront ground floor —
  // big glass panes, a door and a THIN awning strip in the accent colour.
  // No giant plain band at the base: that is what read as cheap in v3.
  var facadeCache = {};
  function facadeTexture(baseHex, accentHex, floors, style) {
    var key = baseHex + "|" + accentHex + "|" + floors + "|" + style;
    if (facadeCache[key]) return facadeCache[key];
    var tex = canvasTexture(256, 512, function (g, w, h) {
      g.fillStyle = baseHex; g.fillRect(0, 0, w, h);
      // Sunlit top, shaded sides — the wall has depth, not one flat tone.
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(255,255,255,0.20)");
      grad.addColorStop(0.25, "rgba(255,255,255,0.04)");
      grad.addColorStop(1, "rgba(0,0,0,0.14)");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      g.fillStyle = "rgba(0,0,0,0.10)";
      g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
      var groundH = 64;
      var winTop = 14, winBot = h - groundH - 8;
      var rows = Math.max(2, floors), cols = 4;
      var cellH = (winBot - winTop) / rows, cellW = w / cols;
      for (var row = 0; row < rows; row++) {
        var y = winTop + row * cellH;
        // Thin floor band.
        g.fillStyle = "rgba(0,0,0,0.12)";
        g.fillRect(0, y + cellH - 3, w, 3);
        for (var col = 0; col < cols; col++) {
          var x = col * cellW;
          // v11: ONE neat grid — every window the same size, aligned
          // in rows and columns (Karimbu's readable facades). The old
          // alternating sizes read as random, not designed.
          var ww = cellW * 0.56, wh = cellH * 0.60;
          var wx = x + (cellW - ww) / 2, wy = y + (cellH - wh) / 2;
          var lit = Math.random() < 0.55;
          var glassCol = lit ? "#ffd678" : (style === "brick" ? "#2a1e22" : "#16283f");
          // White frame, then glass.
          g.fillStyle = "rgba(255,255,255,0.92)";
          g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
          g.fillStyle = glassCol;
          g.fillRect(wx, wy, ww, wh);
          g.fillStyle = lit ? "rgba(255,255,255,0.55)" : "rgba(140,190,255,0.35)";
          g.fillRect(wx, wy, ww, wh * 0.3);
          // Mullion cross so each window reads as two panes.
          g.fillStyle = "rgba(255,255,255,0.85)";
          g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        }
      }
      // Cornice at the very top.
      g.fillStyle = "#fff3d6"; g.fillRect(0, 0, w, 8);
      g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0, 8, w, 3);
      // v7: a mid-height string course, so a tall wall reads in two
      // storeys instead of one sheer drop of windows.
      g.fillStyle = "#fff3d6"; g.fillRect(0, h * 0.5 - 3, w, 6);
      g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0, h * 0.5 + 3, w, 3);
      // Ground floor shopfront: big glass panes + door + thin awning.
      var gy = h - groundH;
      g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(0, gy - 4, w, 4);
      g.fillStyle = "#20242e"; g.fillRect(8, gy + 8, w - 16, groundH - 18);
      g.fillStyle = "#3d5a78"; g.fillRect(10, gy + 10, w - 20, groundH - 22);
      g.fillStyle = "rgba(255,214,120,0.5)";
      g.fillRect(14, gy + 14, (w - 28) * 0.4, groundH - 30);
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.fillRect(10, gy + 10, w - 20, 8);
      // Door, centred.
      g.fillStyle = "#1c1410"; g.fillRect(w / 2 - 14, gy + 16, 28, groundH - 16);
      g.fillStyle = "#ffd678"; g.fillRect(w / 2 - 11, gy + 19, 22, groundH - 22);
      // v9: STRIPED awning (top-entry style) — alternating accent and
      // cream vertical stripes, scalloped edge, so the shopfront reads
      // colourful at a glance instead of one flat colour band.
      for (var s = 0; s < 8; s++) {
        g.fillStyle = s % 2 ? "#fff3d6" : accentHex;
        g.fillRect(s * 32, gy, 32, 12);
        g.beginPath();
        g.arc(16 + s * 32, gy + 12, 8, 0, Math.PI);
        g.fill();
      }
      g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(0, gy, w, 3);
      // v7: shadow line under the awning — a second layer, so the
      // awning reads as a real canopy with depth, not a flat stripe.
      g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(0, gy + 14, w, 4);
      // Soft shadow at the base where the wall meets the street — the
      // wall grounds itself instead of floating on one flat tone.
      g.fillStyle = "rgba(0,0,0,0.22)"; g.fillRect(0, h - 10, w, 10);
    });
    facadeCache[key] = tex;
    return tex;
  }

  // Glass tower skin: MINT glass (v11 — Karimbu's mint towers, not
  // dark green), white horizontal bands, vertical mullions and a
  // sky-reflection gradient — never a flat slab.
  var glassCache = {};
  function glassTexture() {
    if (glassCache.t) return glassCache.t;
    var tex = canvasTexture(256, 512, function (g, w, h) {
      var grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "#a8e8c8");
      grad.addColorStop(0.5, "#5fd4a8");
      grad.addColorStop(1, "#2aa882");
      g.fillStyle = grad; g.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 42) {
        g.fillStyle = "rgba(255,255,255,0.85)";
        g.fillRect(0, y, w, 5);
        g.fillStyle = "rgba(10,30,55,0.55)";
        g.fillRect(0, y + 5, w, 26);
      }
      g.fillStyle = "rgba(255,255,255,0.35)";
      for (var x = 0; x < w; x += 32) g.fillRect(x, 0, 3, h);
      g.fillStyle = "rgba(255,255,255,0.5)";
      g.fillRect(0, 0, w, 10);
      // v7: bright vertical reflection strips + a few warm lit windows,
      // so the glass reads alive from every angle instead of flat dark.
      g.fillStyle = "rgba(255,255,255,0.55)";
      [48, 150].forEach(function (rx) { g.fillRect(rx, 0, 18, h); });
      g.fillStyle = "rgba(190,230,255,0.35)";
      [96, 208].forEach(function (rx2) { g.fillRect(rx2, 0, 10, h); });
      for (var ly = 0; ly < 5; ly++) {
        g.fillStyle = "rgba(255,214,120,0.9)";
        g.fillRect(24 + ly * 48, 60 + ly * 88, 16, 20);
      }
    });
    glassCache.t = tex;
    return tex;
  }

  // v11: striped awning texture for the 3D shopfront canopy —
  // alternating accent and cream vertical stripes (Karimbu's colourful
  // striped canopies), cached per accent colour.
  var awningCache = {};
  function stripedAwningTexture(accentHex) {
    if (awningCache[accentHex]) return awningCache[accentHex];
    var tex = canvasTexture(256, 64, function (g, w, h) {
      for (var s = 0; s < 8; s++) {
        g.fillStyle = s % 2 ? "#fff3d6" : accentHex;
        g.fillRect(s * 32, 0, 32, h);
      }
      g.fillStyle = "rgba(255,255,255,0.25)";
      g.fillRect(0, 0, w, 6);
    });
    awningCache[accentHex] = tex;
    return tex;
  }

  // District sign. Two planes back to back, each facing outward with the
  // same readable texture — a single plane reads mirrored from behind.
  function makeDistrictSign(name, sub, x, z, rotY) {
    var tex = canvasTexture(512, 192, function (g, w, h) {
      g.fillStyle = "#241040"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#ff4ad9"; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = "#ffd23e"; g.font = "900 64px Trebuchet MS, sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(name.toUpperCase(), w / 2, h / 2 - 22);
      g.fillStyle = "#7df9ff"; g.font = "28px Trebuchet MS, sans-serif";
      g.fillText(sub, w / 2, h / 2 + 52);
    });
    var group = new THREE.Group();
    var mat = new THREE.MeshBasicMaterial({ map: tex });
    var geo = new THREE.PlaneGeometry(16, 6);
    var front = new THREE.Mesh(geo, mat);
    front.position.z = 0.08;
    var back = new THREE.Mesh(geo, mat);
    back.position.z = -0.08; back.rotation.y = Math.PI;
    var post = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 7, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
    post.position.y = -5.5;
    var post2 = post.clone(); post2.position.x = 7;
    var post3 = post.clone(); post3.position.x = -7;
    group.add(front); group.add(back); group.add(post); group.add(post2); group.add(post3);
    group.position.set(x, 7.5, z);
    group.rotation.y = rotY;
    scene.add(group);
    signs.push(group);
    return group;
  }

  // Big neon sign, SHARP: a 2048x640 canvas, heavy font, the glow drawn
  // as a thin tube around the letters (not a fat blur), and — the v3 fix —
  // an opaque backing panel BETWEEN the two readable planes, so the far
  // plane can never ghost through the near one.
  function makeNeonSign(line1, line2, x, y, z, rotY, w, h, glow) {
    var tex = canvasTexture(2048, 640, function (g, cw, ch) {
      g.clearRect(0, 0, cw, ch);
      // Dark panel so the letters pop against any sky.
      g.fillStyle = "#160a2e"; g.fillRect(0, 0, cw, ch);
      g.strokeStyle = glow; g.lineWidth = 12;
      g.shadowColor = glow; g.shadowBlur = 22;
      g.strokeRect(22, 22, cw - 44, ch - 44);
      g.shadowBlur = 0;
      g.textAlign = "center"; g.textBaseline = "middle";
      var y1 = line2 ? ch / 2 - 78 : ch / 2;
      // Neon tube: coloured stroke, then a bright white core.
      g.font = "900 300px 'Arial Black', 'Trebuchet MS', sans-serif";
      g.lineWidth = 10; g.strokeStyle = glow;
      g.shadowColor = glow; g.shadowBlur = 34;
      g.strokeText(line1, cw / 2, y1);
      g.shadowBlur = 0;
      g.fillStyle = "#ffffff";
      g.fillText(line1, cw / 2, y1);
      if (line2) {
        g.font = "900 104px 'Arial Black', 'Trebuchet MS', sans-serif";
        g.lineWidth = 6; g.strokeStyle = "#ffd23e";
        g.shadowColor = "#ffd23e"; g.shadowBlur = 22;
        g.strokeText(line2, cw / 2, ch / 2 + 178);
        g.shadowBlur = 0;
        g.fillStyle = "#ffe9a8";
        g.fillText(line2, cw / 2, ch / 2 + 178);
      }
    });
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    var group = new THREE.Group();
    // Opaque panel in the MIDDLE: each side sees one plane + the panel.
    var panel = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: 0x160a2e }));
    group.add(panel);
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.FrontSide });
    var geo = new THREE.PlaneGeometry(w, h);
    var front = new THREE.Mesh(geo, mat);
    front.position.z = 0.12;
    var back = new THREE.Mesh(geo, mat);
    back.position.z = -0.12; back.rotation.y = Math.PI;
    group.add(front); group.add(back);
    // Gantry: a beam across the top of the sign, posts down to the
    // ground at the beam's ends (x = centre +/- 14) — buildings stay
    // >= 11 m from a road centreline, so the posts can never land
    // inside one.
    var beam = new THREE.Mesh(new THREE.BoxGeometry(w + 4, 1.2, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
    beam.position.set(0, h / 2 + 0.6, 0);
    group.add(beam);
    // v9: the gantry is a complete billboard frame, not two thin bars —
    // thick posts with neon edge trim + a bottom crossbeam, so the
    // chase shot reads structure instead of stray black lines. The
    // posts stand WIDE (±14 m, at the beam's ends over the sidewalks)
    // and BEHIND the sign plane (z = -2): from the oblique aerial
    // cover any post in the sign's own plane falls across its letters
    // (first ±6 m blacked out "BE", then ±14 m crossed the right
    // third) — recessed posts read as the frame behind the board.
    var postH = y + h / 2 + 0.6;
    var postGeo = new THREE.BoxGeometry(1.8, postH, 1.8);
    var postMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
    var postCY = (h / 2 + 0.6 - y) / 2;
    var p1 = new THREE.Mesh(postGeo, postMat);
    p1.position.set(-14, postCY, -2);
    var p2 = new THREE.Mesh(postGeo, postMat);
    p2.position.set(14, postCY, -2);
    group.add(p1); group.add(p2);
    [-14, 14].forEach(function (px) {
      var trim = new THREE.Mesh(new THREE.BoxGeometry(0.3, postH, 0.12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(glow) }));
      trim.position.set(px, postCY, -1.04);
      group.add(trim);
    });
    var bottomBeam = new THREE.Mesh(new THREE.BoxGeometry(w + 4, 1.0, 1.0),
      new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
    bottomBeam.position.set(0, -h / 2 - 0.5, 0);
    group.add(bottomBeam);
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    scene.add(group);
    signs.push(group);
    return group;
  }

  var ROOF_COLORS = [0xd94a2a, 0x2ec4b6, 0xffe3a3, 0x4a6a8a, 0xff6b9d, 0x8a5a2a];
  var ACCENTS = ["#ff4ad9", "#ffd23e", "#2ec4b6", "#ff6b3d", "#7ed957", "#ff8a7a"];

  // v6: buildings are NOT all boxes any more. `form` picks the massing:
  // "slab" (plain box, parapet roof), "setback" (three stacked tiers
  // narrowing as they rise), "rounded" (corner cylinders soften every
  // 90-degree edge), "curved" (a half-cylinder glass bay on the front
  // face), "dome" (hemisphere roof), "gable" (triangular prism roof),
  // "tower" (glass tower). `far` = a distant skyline tower: no
  // collider/minimap block, and fog:false materials so it reads
  // through the haze. Fadli: "kotanya juga nggak boleh kotak-kotak".
  function addBuilding(x, z, w, d, h, colorHex, style, form, far) {
    form = form || "slab";
    var floors = EB.util.clamp(Math.round(h / 6), 2, 8);
    var accent = EB.util.pick(ACCENTS);
    var isGlass = style === "tower";
    function lam(colorHex) {
      var m = new THREE.MeshLambertMaterial({ color: colorHex });
      if (far) m.fog = false;
      return m;
    }
    function bas(colorHex) {
      var m = new THREE.MeshBasicMaterial({ color: colorHex });
      if (far) m.fog = false;
      return m;
    }
    function facadeMat(floorsN) {
      var m = isGlass
        ? new THREE.MeshLambertMaterial({ map: glassTexture() })
        : new THREE.MeshLambertMaterial({ map: facadeTexture(colorHex, accent, floorsN, style) });
      if (far) m.fog = false;
      return m;
    }
    function boxAt(bw, bd, bh, by, mat) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mat);
      b.position.set(x, by, z);
      b.castShadow = true; b.receiveShadow = true;
      scene.add(b);
      return b;
    }
    var mesh = null;
    if (form === "setback") {
      // Three stacked tiers, narrowing as they rise — a stepped
      // skyline instead of one sheer slab.
      var h1 = h * 0.55, h2 = h * 0.30, h3 = h * 0.15;
      boxAt(w, d, h1, h1 / 2, facadeMat(Math.max(2, Math.round(h1 / 6))));
      boxAt(w * 0.84, d * 0.84, 0.5, h1 + 0.25, lam(0xfff3d6));
      boxAt(w * 0.78, d * 0.78, h2, h1 + h2 / 2, facadeMat(Math.max(2, Math.round(h2 / 6))));
      boxAt(w * 0.60, d * 0.60, 0.5, h1 + h2 + 0.25, lam(0xfff3d6));
      mesh = boxAt(w * 0.55, d * 0.55, h3, h1 + h2 + h3 / 2, facadeMat(Math.max(2, Math.round(h3 / 6))));
      var corniceS = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.55 + 0.7, 0.5, d * 0.55 + 0.7), lam(0xfff3d6));
      corniceS.position.set(x, h + 0.25, z);
      scene.add(corniceS);
    } else {
      mesh = boxAt(w, d, h, h / 2, facadeMat(floors));
      // Cornice slab crowning the wall.
      var cornice = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.7, 0.5, d + 0.7), lam(0xfff3d6));
      cornice.position.set(x, h + 0.25, z);
      scene.add(cornice);
      if (form === "rounded") {
        // Rounded corners: vertical cylinders at the four corners
        // soften every 90-degree edge of the box.
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (s) {
          var col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, h, 10), lam(colorHex));
          col.position.set(x + s[0] * (w / 2 - 0.2), h / 2, z + s[1] * (d / 2 - 0.2));
          scene.add(col);
        });
      } else if (form === "curved") {
        // Curved glass bay on the front face: a half-cylinder of blue
        // glass bulging out of the flat wall.
        var bay = new THREE.Mesh(
          new THREE.CylinderGeometry(w * 0.3, w * 0.3, h * 0.85, 16, 1, false, -Math.PI / 2, Math.PI),
          new THREE.MeshLambertMaterial({ map: glassTexture() }));
        if (far) bay.material.fog = false;
        bay.position.set(x, h * 0.425 + 1, z + d / 2 - 0.1);
        scene.add(bay);
      }
    }
    if (style === "villa") {
      // Pyramid roof — a proper pitched roof, terracotta or teal.
      var roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.72, 4 + Math.random() * 2, 4),
        lam(EB.util.pick([0xd94a2a, 0x2ec4b6, 0x4a6a8a])));
      roof.position.set(x, h + 0.5 + 2, z);
      roof.rotation.y = Math.PI / 4;
      scene.add(roof);
    } else if (form === "dome") {
      // Hemisphere dome roof + a gold finial on top.
      var dome = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(w, d) * 0.52, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        lam(EB.util.pick([0x2ec4b6, 0xd97a4a, 0x4a6a8a])));
      dome.position.set(x, h + 0.5, z);
      scene.add(dome);
      var fin = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), bas(0xffd23e));
      fin.position.set(x, h + 0.5 + Math.max(w, d) * 0.52, z);
      scene.add(fin);
    } else if (form === "gable") {
      // Triangular prism roof (extruded triangle) — a pitched gable.
      var tri = new THREE.Shape();
      tri.moveTo(-w / 2 - 0.4, 0); tri.lineTo(w / 2 + 0.4, 0);
      tri.lineTo(0, 3.5 + Math.random() * 1.5); tri.closePath();
      var gGeo = new THREE.ExtrudeGeometry(tri, { depth: d + 0.4, bevelEnabled: false });
      gGeo.translate(0, 0, -(d + 0.4) / 2);
      var gable = new THREE.Mesh(gGeo,
        lam(EB.util.pick([0xd94a2a, 0x2ec4b6, 0x4a6a8a, 0x8a5a2a])));
      gable.position.set(x, h + 0.5, z);
      scene.add(gable);
    } else if (style === "tower") {
      // Rooftop plant box + red beacon on the tallest towers.
      var plant = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.4, 3, d * 0.4),
        lam(0x3a3f47));
      plant.position.set(x, h + 2, z);
      scene.add(plant);
      if (h > 34) {
        var beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.8, 8, 8),
          bas(0xff4040));
        beacon.position.set(x, h + 4, z);
        scene.add(beacon);
      }
      // Vertical neon strip on the corner.
      var strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, h * 0.7, 0.7),
        bas(Math.random() < 0.5 ? 0xff4ad9 : 0xffd23e));
      strip.position.set(x + w / 2 + 0.2, h * 0.45, z + d / 2 + 0.2);
      scene.add(strip);
      // v7: a second strip on the opposite corner + a bright crown band
      // at the top, so the tower glows from every side, not one corner.
      var strip2 = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, h * 0.55, 0.7),
        bas(Math.random() < 0.5 ? 0x7df9ff : 0xffd23e));
      strip2.position.set(x - w / 2 - 0.2, h * 0.4, z - d / 2 - 0.2);
      scene.add(strip2);
      var crown = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.4, 1.2, d + 0.4),
        bas(0xbfe9ff));
      crown.position.set(x, h + 0.6, z);
      scene.add(crown);
    } else if (form === "setback") {
      // Rooftop box on the top tier.
      var rbox = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.3, 1.8, d * 0.3), lam(0x6a6f78));
      rbox.position.set(x + w * 0.12, h + 1.4, z - d * 0.08);
      scene.add(rbox);
    } else {
      // Flat roof: parapet rim + a rooftop box (AC / stair bulkhead).
      var rimMat = lam(EB.util.pick(ROOF_COLORS));
      var rimT = 0.5, rimH = 0.9;
      [[0, d / 2, w + 0.6, rimT], [0, -d / 2, w + 0.6, rimT],
       [w / 2, 0, rimT, d + 0.6], [-w / 2, 0, rimT, d + 0.6]].forEach(function (r) {
        var rim = new THREE.Mesh(new THREE.BoxGeometry(r[2], rimH, r[3]), rimMat);
        rim.position.set(x + r[0], h + 0.5 + rimH / 2, z + r[1]);
        scene.add(rim);
      });
      if (Math.random() < 0.6) {
        var box = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.3, 1.6, d * 0.3),
          lam(0x6a6f78));
        box.position.set(x + w * 0.2, h + 1.3, z - d * 0.15);
        scene.add(box);
      }
    }
    // v7: protruding shopfront frame — a real 3D lip around the ground
    // floor, so the wall has depth from the street, not just texture.
    if (!far && form !== "tower" && form !== "curved") {
      var sframe = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 2.2, 0.35),
        lam(0xfff3d6));
      sframe.position.set(x, 1.1, z + d / 2 + 0.12);
      scene.add(sframe);
      var sglass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 1.7, 0.1),
        new THREE.MeshLambertMaterial({ color: 0x2a4a66 }));
      sglass.position.set(x, 1.1, z + d / 2 + 0.32);
      scene.add(sglass);
    }
    // Balconies: a slab + railing on one or two floors, facing the street.
    if (!far && w >= 12 && form !== "setback" && form !== "tower" && Math.random() < 0.7) {
      var nBal = EB.util.randInt(1, 2);
      for (var b = 0; b < nBal; b++) {
        var fy = 6 + b * 7 + EB.util.rand(0, 3);
        if (fy > h - 4) continue;
        var side = Math.random() < 0.5 ? 1 : -1;
        var slab = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.5, 0.3, 1.5),
          new THREE.MeshLambertMaterial({ color: 0xe8dcc0 }));
        slab.position.set(x, fy, z + side * (d / 2 + 0.75));
        scene.add(slab);
        var rail = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.5, 0.9, 0.12),
          new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
        rail.position.set(x, fy + 0.6, z + side * (d / 2 + 1.45));
        scene.add(rail);
      }
    }
    // Glowing sign band on the front face — the city lights up at
    // sunset (v6 "kota menyala"). Setback tiers wear it on tier 1;
    // the curved bay already glows, towers have their own strip.
    if (!far && form !== "tower" && form !== "curved" && Math.random() < 0.4) {
      var bandY = form === "setback" ? h * 0.35 : h * 0.72;
      var band = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.66, 0.9),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(accent) }));
      band.position.set(x, bandY, z + d / 2 + 0.08);
      scene.add(band);
    }
    // v11: BIG FLAT name board on the front face (Karimbu's "TOMO'S
    // LOFT" — one readable landmark per street). Flat cream board,
    // bold dark letters, hung high on the wall. Only on flat-roof
    // mid-rise wide enough to carry it, never on towers or the bay.
    if (!far && form !== "tower" && form !== "curved" && w >= 14 && Math.random() < 0.30) {
      var bname = EB.util.pick(["EMBER INN", "SOLIS PIER", "NEON ROW", "HEAT LINE",
        "PORTSIDE MARKET", "CINDER DOCKS", "PALM COURT", "BAY VIEW", "SUNSET MOTEL", "MARKET HALL"]);
      var bsub = EB.util.pick(["ROOMS • POOL • BAR", "FISH • FUEL • FERRIES", "OPEN ALL NIGHT",
        "SHOPS • EATS • STALLS", "DANCE • DRINKS • NEON", "ROOMS • SEA VIEW"]);
      makeBuildingBoard(bname, bsub, x, h * 0.62, z + d / 2 + 0.15, 0);
    }
    // v11: 3D STRIPED awning over the shopfront (Karimbu's colourful
    // striped canopies) — a sloped striped plane with real depth, not
    // just texture on the wall.
    if (!far && form !== "tower" && form !== "curved" && Math.random() < 0.55) {
      var awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.12, 1.6),
        new THREE.MeshLambertMaterial({ map: stripedAwningTexture(accent) }));
      awn.position.set(x, 2.9, z + d / 2 + 0.7);
      awn.rotation.x = 0.35;
      scene.add(awn);
    }
    var colR = form === "curved" ? Math.max(w, d + w * 0.3) * 0.62 : Math.max(w, d) * 0.62;
    if (!far) {
      colliders.push({ x: x, z: z, r: colR });
      blocks.push({ x: x, z: z, w: w, d: d, h: h });
    }
    return mesh;
  }

  // v6 REAL PALM (top 1-2 style): a SEGMENTED trunk — five stacked
  // tapering cylinders in alternating browns, gently curving — crowned
  // by TWO LAYERS of pointed fronds (outer ring drooping wide, inner
  // ring standing up, lighter green) plus a coconut cluster. Never a
  // single green triangle on a stick again.
  function addPalm(x, z) {
    var g = new THREE.Group();
    var trunkBrowns = [0x8a5a2a, 0x7a4a22, 0x96683a, 0x7a4a22, 0x8a5a2a];
    var lean = 0;
    for (var s = 0; s < 5; s++) {
      var seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42 - s * 0.035, 0.46 - s * 0.035, 1.5, 7),
        new THREE.MeshLambertMaterial({ color: trunkBrowns[s] }));
      lean += 0.03;
      seg.position.set(lean * s * 0.5, 0.75 + s * 1.45, 0);
      seg.rotation.z = -lean * 0.35;
      g.add(seg);
    }
    var crownX = lean * 4 * 0.5, crownY = 7.3;
    // Outer fronds: long flat blades drooping outwards.
    for (var i = 0; i < 7; i++) {
      var a = (i / 7) * Math.PI * 2;
      var leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.72, 4.8, 4),
        new THREE.MeshLambertMaterial({ color: EB.COLORS.palm }));
      leaf.scale.set(1, 1, 0.28);
      leaf.position.set(crownX + Math.cos(a) * 1.9, crownY - 0.4, Math.sin(a) * 1.9);
      leaf.rotation.z = Math.cos(a) * 1.25; leaf.rotation.x = -Math.sin(a) * 1.25;
      g.add(leaf);
    }
    // Inner fronds: shorter, more upright, lighter green.
    for (var j = 0; j < 5; j++) {
      var a2 = (j / 5) * Math.PI * 2 + 0.5;
      var leaf2 = new THREE.Mesh(
        new THREE.ConeGeometry(0.62, 3.6, 4),
        new THREE.MeshLambertMaterial({ color: 0x4ad97a }));
      leaf2.scale.set(1, 1, 0.30);
      leaf2.position.set(crownX + Math.cos(a2) * 0.9, crownY + 0.7, Math.sin(a2) * 0.9);
      leaf2.rotation.z = Math.cos(a2) * 0.7; leaf2.rotation.x = -Math.sin(a2) * 0.7;
      g.add(leaf2);
    }
    // Coconut cluster under the crown.
    for (var k = 0; k < 3; k++) {
      var nut = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshLambertMaterial({ color: 0x6a4a22 }));
      nut.position.set(crownX + (k - 1) * 0.35, crownY - 0.7, (k % 2 ? 0.3 : -0.3));
      g.add(nut);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }

  function addLamp(x, z) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 6, 6),
      new THREE.MeshLambertMaterial({ color: 0x22252a }));
    pole.position.y = 3; g.add(pole);
    // Horizontal arm reaching over the road (Brisa Bay style) + a warm
    // glowing bulb and a soft light pool on the ground below it.
    var arm = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x22252a }));
    arm.position.set(1.0, 5.9, 0); g.add(arm);
    var bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    bulb.position.set(2.0, 5.8, 0); g.add(bulb);
    var pool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 20),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.13, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(2.0, 0.05, 0); g.add(pool);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  // v9 street furniture (top-entry props): a wooden bench + a bin,
  // sitting on the sidewalk facing the road.
  function addBench(x, z, rotY) {
    var g = new THREE.Group();
    var seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x8a5a2a }));
    seat.position.y = 0.55; g.add(seat);
    var back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x8a5a2a }));
    back.position.set(0, 1.0, -0.32); g.add(back);
    [[-1.0, -0.25], [1.0, -0.25], [-1.0, 0.25], [1.0, 0.25]].forEach(function (lp) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.12),
        new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
      leg.position.set(lp[0], 0.28, lp[1]); g.add(leg);
    });
    g.position.set(x, 0, z); g.rotation.y = rotY || 0;
    scene.add(g);
  }
  function addBin(x, z) {
    var bin = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 10),
      new THREE.MeshLambertMaterial({ color: 0x2a6a4a }));
    bin.position.set(x, 0.45, z);
    scene.add(bin);
  }

  // v9: BIG FLAT building name board (top-entry style — "TOMO'S LOFT"
  // reads from across the street). Cream board, bold dark letters,
  // hung on a building face so the aerial cover gets a readable
  // landmark in the midground.
  function makeBuildingBoard(text, sub, x, y, z, rotY) {
    var tex = canvasTexture(1024, 384, function (g, w, h) {
      g.fillStyle = "#fff3d6"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#2a6ad9"; g.lineWidth = 10; g.strokeRect(10, 10, w - 20, h - 20);
      g.fillStyle = "#1c2a4a"; g.font = "900 150px 'Arial Black', 'Trebuchet MS', sans-serif";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText(text, w / 2, h / 2 - 30);
      g.fillStyle = "#d94a2a"; g.font = "900 56px 'Trebuchet MS', sans-serif";
      g.fillText(sub, w / 2, h / 2 + 110);
    });
    var board = new THREE.Mesh(new THREE.PlaneGeometry(14, 5.25),
      new THREE.MeshBasicMaterial({ map: tex }));
    board.position.set(x, y, z);
    board.rotation.y = rotY;
    scene.add(board);
    return board;
  }

  function addTrafficLight(x, z) {
    var g = new THREE.Group();
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x1c1e22 }));
    pole.position.y = 3.5; g.add(pole);
    var arm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.14, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x1c1e22 }));
    arm.position.set(1.6, 6.8, 0); g.add(arm);
    var head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x1c1e22 }));
    head.position.set(3.2, 6.0, 0); g.add(head);
    var red = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12),
      new THREE.MeshBasicMaterial({ color: 0x881111 }));
    red.position.set(3.2, 6.5, 0.36); g.add(red);
    var green = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12),
      new THREE.MeshBasicMaterial({ color: 0x2aff66 }));
    green.position.set(3.2, 5.5, 0.36); g.add(green);
    g.position.set(x + 6, 0, z + 6);
    scene.add(g);
  }

  function buildRoads() {
    // v9: mottled asphalt (top 1-2 texture) with NO wet sheen, tiled
    // sidewalks with bold grout, pale-yellow curbs, white edge lines
    // and white dashed lane lines. The double yellow centre lines are
    // GONE — both top entries mark their roads in white only.
    var roadMatV = new THREE.MeshPhongMaterial({ map: asphaltTex("v"), shininess: 8, specular: 0x11151a });
    var roadMatH = new THREE.MeshPhongMaterial({ map: asphaltTex("h"), shininess: 8, specular: 0x11151a });
    var walkMatV = new THREE.MeshLambertMaterial({ map: sidewalkTex("v") });
    var walkMatH = new THREE.MeshLambertMaterial({ map: sidewalkTex("h") });
    var edgeMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
    var curbMat = new THREE.MeshLambertMaterial({ color: 0xe8d9a0 });
    var laneMatV = new THREE.MeshBasicMaterial({ map: dashTex("v"), transparent: true });
    var laneMatH = new THREE.MeshBasicMaterial({ map: dashTex("h"), transparent: true });
    var crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var S = EB.CITY_SIZE / 2;
    for (var i = -3; i <= 3; i++) {
      var c = i * EB.ROAD_SPACING;
      // Tiled sidewalks flanking each road.
      [[-7.5], [7.5]].forEach(function (off) {
        var wv = new THREE.Mesh(new THREE.PlaneGeometry(4, EB.CITY_SIZE), walkMatV);
        wv.rotation.x = -Math.PI / 2; wv.position.set(c + off[0], 0.015, 0); scene.add(wv);
        var wh = new THREE.Mesh(new THREE.PlaneGeometry(EB.CITY_SIZE, 4), walkMatH);
        wh.rotation.x = -Math.PI / 2; wh.position.set(0, 0.015, c + off[0]); scene.add(wh);
      });
      // Pale-yellow curbs where the sidewalk meets the road.
      [-5.3, 5.3].forEach(function (e) {
        var cv = new THREE.Mesh(new THREE.PlaneGeometry(0.5, EB.CITY_SIZE), curbMat);
        cv.rotation.x = -Math.PI / 2; cv.position.set(c + e, 0.03, 0); scene.add(cv);
        var ch = new THREE.Mesh(new THREE.PlaneGeometry(EB.CITY_SIZE, 0.5), curbMat);
        ch.rotation.x = -Math.PI / 2; ch.position.set(0, 0.03, c + e); scene.add(ch);
      });
      // Dark mottled asphalt, no sheen.
      var roadV = new THREE.Mesh(new THREE.PlaneGeometry(10, EB.CITY_SIZE), roadMatV);
      roadV.rotation.x = -Math.PI / 2; roadV.position.set(c, 0.02, 0); scene.add(roadV);
      var roadH = new THREE.Mesh(new THREE.PlaneGeometry(EB.CITY_SIZE, 10), roadMatH);
      roadH.rotation.x = -Math.PI / 2; roadH.position.set(0, 0.02, c); scene.add(roadH);
      // White edge lines only (no double yellow any more).
      [-4.6, 4.6].forEach(function (e) {
        var ev = new THREE.Mesh(new THREE.PlaneGeometry(0.28, EB.CITY_SIZE), edgeMat);
        ev.rotation.x = -Math.PI / 2; ev.position.set(c + e, 0.04, 0); scene.add(ev);
        var eh = new THREE.Mesh(new THREE.PlaneGeometry(EB.CITY_SIZE, 0.28), edgeMat);
        eh.rotation.x = -Math.PI / 2; eh.position.set(0, 0.04, c + e); scene.add(eh);
      });
      // White dashed lane lines between centre and edge (one long
      // textured plane per road, not hundreds of dash meshes).
      [-2.4, 2.4].forEach(function (o) {
        var lv = new THREE.Mesh(new THREE.PlaneGeometry(0.3, EB.CITY_SIZE), laneMatV);
        lv.rotation.x = -Math.PI / 2; lv.position.set(c + o, 0.045, 0); scene.add(lv);
        var lh = new THREE.Mesh(new THREE.PlaneGeometry(EB.CITY_SIZE, 0.3), laneMatH);
        lh.rotation.x = -Math.PI / 2; lh.position.set(0, 0.045, c + o); scene.add(lh);
      });
      // Crosswalks at every junction on this road. v5: stripes are
      // narrower (0.6 m) so they never read as giant white bars in the
      // foreground of a low chase camera.
      for (var j = -3; j <= 3; j++) {
        var jc = j * EB.ROAD_SPACING;
        for (var s = -3; s <= 3; s++) {
          var stripeV = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 7), crossMat);
          stripeV.rotation.x = -Math.PI / 2;
          stripeV.position.set(c + s * 1.3, 0.05, jc + 7);
          scene.add(stripeV);
          var stripeH = new THREE.Mesh(new THREE.PlaneGeometry(7, 0.6), crossMat);
          stripeH.rotation.x = -Math.PI / 2;
          stripeH.position.set(jc + 7, 0.05, c + s * 1.3);
          scene.add(stripeH);
        }
      }
    }
  }

  function buildCity() {
    // v11: DENSE blocks (fadli: "kota harus padet") — every block is a
    // 2x2 grid of sub-plots, each plot holding one building, so the
    // city reads full from the aerial cover instead of big green lawns
    // between scattered buildings. Plots are 26 m apart, buildings
    // 12-17 m wide: neighbours never overlap, roads stay clear.
    // v11: FLAT ROOFS like Karimbu — dome/gable survive on at most 2
    // accent buildings in Palm Heights; everything else is slab /
    // setback / rounded / curved (all flat-roofed forms).
    var accentRoofs = 0;
    var centers = [-160, -96, -32, 32, 96, 160];
    for (var ix = 0; ix < centers.length; ix++) {
      for (var iz = 0; iz < centers.length; iz++) {
        var cx = centers[ix], cz = centers[iz];
        if (cx === 0 && cz === 0) continue; // central plaza stays open
        var district = EB.util.districtAt(cx, cz);
        var plots = [[-13, -13], [13, -13], [-13, 13], [13, 13]];
        for (var b = 0; b < plots.length; b++) {
          if (Math.random() < 0.15) continue; // a few plots stay open (plaza/garden)
          var bx = cx + plots[b][0] + EB.util.rand(-3, 3), bz = cz + plots[b][1] + EB.util.rand(-3, 3);
          var w = EB.util.rand(12, 17), d = EB.util.rand(12, 17);
          if (excluded(bx, bz, w, d)) continue;
          var h, style, form;
          if (district.name === "Neon Row") {
            h = EB.util.rand(24, 52);
            // v11: FEWER mint glass towers (was 15%) — Karimbu is
            // mostly pastel mid-rise, towers are the exception.
            style = Math.random() < 0.10 ? "tower" : "flat";
            form = style === "tower" ? "tower" : EB.util.pick(["setback", "curved", "rounded", "slab"]);
          } else if (district.name === "Palm Heights") {
            h = EB.util.rand(8, 18);
            if (accentRoofs < 2 && Math.random() < 0.4) {
              style = "villa"; form = Math.random() < 0.5 ? "dome" : "gable"; accentRoofs++;
            } else { style = "flat"; form = EB.util.pick(["slab", "setback", "rounded"]); }
          } else if (district.name === "Portside" || district.name === "Cinder Docks") {
            h = EB.util.rand(10, 20); style = Math.random() < 0.5 ? "warehouse" : "flat";
            form = EB.util.pick(["slab", "slab", "setback"]);
          } else if (district.name === "Sunset Beach") {
            h = EB.util.rand(20, 40);
            // v11: fewer glass towers here too (was 20%).
            style = Math.random() < 0.12 ? "tower" : "flat";
            form = style === "tower" ? "tower" : EB.util.pick(["curved", "setback", "rounded", "slab"]);
          } else if (district.name === "Old Market") {
            h = EB.util.rand(12, 26);
            style = Math.random() < 0.45 ? "arch" : "brick";
            form = EB.util.pick(["slab", "rounded", "setback"]);
          } else {
            h = EB.util.rand(14, 38); style = "flat";
            form = EB.util.pick(["slab", "setback", "rounded", "curved"]);
          }
          var col = "#" + EB.util.pick(EB.COLORS.building).toString(16).padStart(6, "0");
          addBuilding(bx, bz, w, d, h, col, style, form);
        }
        // Palms and lamps around the block.
        if (Math.random() < 0.55) addPalm(cx + 24, cz + 24);
        if (Math.random() < 0.55) addPalm(cx - 24, cz - 24);
        addLamp(cx + 8, cz + 8); addLamp(cx - 8, cz - 8);
      }
    }
    // Central plaza: cream fountain ring + turquoise water + palms.
    var plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(14, 16, 1.2, 24),
      new THREE.MeshLambertMaterial({ color: 0xffe3a3 }));
    plaza.position.set(0, 0.6, 0); scene.add(plaza);
    var fountain = new THREE.Mesh(
      new THREE.CylinderGeometry(9, 9, 0.6, 24),
      new THREE.MeshLambertMaterial({ color: 0x14c8d8 }));
    fountain.position.set(0, 1.4, 0); scene.add(fountain);
    for (var p = 0; p < 8; p++) {
      var a = (p / 8) * Math.PI * 2;
      addPalm(Math.cos(a) * 22, Math.sin(a) * 22);
    }
    // Karimbu's sunbeam device: big translucent yellow planes + soft
    // oval light pools on the ground, so the light feels volumetric.
    [[-40, -40, 0.4], [60, 80, -0.5]].forEach(function (b) {
      var shaft = new THREE.Mesh(new THREE.PlaneGeometry(10, 26),
        new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
      shaft.position.set(b[0], 13, b[1]); shaft.rotation.y = b[2]; scene.add(shaft);
      var pool = new THREE.Mesh(new THREE.CircleGeometry(9, 24),
        new THREE.MeshBasicMaterial({ color: 0xffd76a, transparent: true, opacity: 0.13, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.scale.set(1.4, 1, 1);
      pool.position.set(b[0] + 6, 0.06, b[1] + 4); scene.add(pool);
    });
    // Traffic lights at the four main junctions (Brisa Bay prop).
    [[-64, -64], [64, -64], [-64, 64], [64, 64]].forEach(function (pp) {
      addTrafficLight(pp[0], pp[1]);
    });
    // v10: a second readable landmark — SOLIS PIER over the Portside
    // docks, facing east toward the city, so the harbour side of the
    // map has a sign you can read from the road.
    (function () {
      makeBuildingBoard("SOLIS PIER", "FISH • FUEL • FERRIES", -208, 8, -150, Math.PI / 2);
      var sp1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
      sp1.position.set(-208, 3, -156.5); scene.add(sp1);
      var sp2 = sp1.clone(); sp2.position.set(-208, 3, -143.5); scene.add(sp2);
    })();
    // v9: the EMBER INN board — a standalone beachfront billboard on
    // the boardwalk, facing south-east toward the aerial cover camera,
    // so the cover always gets a readable landmark in the midground.
    // (The first version hung it on the nearest low building, but the
    // buildings are placed randomly per load, so the board kept
    // landing on a hidden face.)
    (function () {
      makeBuildingBoard("EMBER INN", "ROOMS • POOL • BAR", 208, 7, 90, Math.PI / 4);
      var bp1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x2a2d33 }));
      bp1.position.set(203.4, 2.5, 94.6); scene.add(bp1);
      var bp2 = bp1.clone(); bp2.position.set(212.6, 2.5, 85.4); scene.add(bp2);
    })();
    // v9: benches + bins along both sidewalks of the coastal road and
    // the z=64 road, so the streets read furnished, not bare.
    [-160, -96, -32, 32, 96, 160, 200].forEach(function (pz) {
      addBench(184.5, pz, Math.PI / 2); addBin(184.5, pz + 3.5);
      addBench(199.5, pz, -Math.PI / 2); addBin(199.5, pz - 3.5);
    });
    [-96, -32, 32, 96].forEach(function (px) {
      addBench(px, 71.5, Math.PI); addBin(px + 3.5, 71.5);
      addBench(px, 56.5, 0); addBin(px - 3.5, 56.5);
    });
    // v11: the same furniture along the z=-64 and z=128 roads, so
    // every street reads furnished, not just the two show roads.
    [-96, -32, 32, 96].forEach(function (px) {
      addBench(px, -71.5, Math.PI); addBin(px + 3.5, -71.5);
      addBench(px, -56.5, 0); addBin(px - 3.5, -56.5);
      addBench(px, 135.5, Math.PI); addBin(px + 3.5, 135.5);
      addBench(px, 120.5, 0); addBin(px - 3.5, 120.5);
    });
    // v11: a second container stack in Cinder Docks — more harbour
    // clutter on the Rust Crew side of the map.
    for (var c3 = 0; c3 < 6; c3++) {
      var cont2 = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 3),
        new THREE.MeshLambertMaterial({ color: EB.util.pick([0x2a6ad9, 0xd94a4a, 0x4ad97a, 0xd9a44a]) }));
      cont2.position.set(-150 + (c3 % 3) * 12, 1.5, 175 + Math.floor(c3 / 3) * 8);
      cont2.rotation.y = -0.2;
      scene.add(cont2);
    }
    // v9: one more umbrella cluster on the boardwalk's south end, so
    // the aerial cover's beach foreground is busy, not bare sand.
    var umbCols = [0xff4ad9, 0xffd23e, 0x2ec4b6, 0xff6b3d];
    for (var ub = 0; ub < 4; ub++) {
      var umb2 = new THREE.Group();
      var pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff }));
      pole2.position.y = 1.75; umb2.add(pole2);
      var top2 = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.5, 8),
        new THREE.MeshLambertMaterial({ color: umbCols[(ub + 1) % 4] }));
      top2.position.y = 3.9; umb2.add(top2);
      umb2.position.set(212 + (ub % 2) * 8, 0, 176 + ub * 12);
      scene.add(umb2);
    }
    // Portside cranes + containers — bright harbour red-orange.
    for (var k = 0; k < 3; k++) {
      var crane = new THREE.Group();
      var leg = new THREE.Mesh(new THREE.BoxGeometry(3, 26, 3),
        new THREE.MeshLambertMaterial({ color: 0xff5a2a }));
      leg.position.y = 13; crane.add(leg);
      var arm = new THREE.Mesh(new THREE.BoxGeometry(26, 2, 2),
        new THREE.MeshLambertMaterial({ color: 0xff5a2a }));
      arm.position.set(8, 25, 0); crane.add(arm);
      crane.position.set(-210 + k * 32, 0, -210);
      scene.add(crane);
    }
    for (var c2 = 0; c2 < 14; c2++) {
      var cont = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 3),
        new THREE.MeshLambertMaterial({ color: EB.util.pick([0x2a6ad9, 0xd94a4a, 0x4ad97a, 0xd9a44a]) }));
      cont.position.set(-215 + (c2 % 7) * 12, 1.5, -180 + Math.floor(c2 / 7) * 8);
      cont.rotation.y = 0.15;
      scene.add(cont);
    }
    // Beach + turquoise water on the east edge, with umbrellas, boats
    // and a palm line so the coast reads like a holiday poster. The
    // sand is a BUSY beach, never an empty half-screen: boardwalk,
    // umbrellas, towels, a lifeguard tower and a volleyball net fill it.
    // Sand starts at the east sidewalk's outer edge (x=201), NOT at
    // x=190: the old 70-wide plane centred at 225 buried the coastal
    // road's whole east half (x 190-197) under sand, so the road read
    // pale tan on one side. Boardwalk (201.5-210.5) covers the seam.
    var sand = new THREE.Mesh(new THREE.PlaneGeometry(59, EB.CITY_SIZE),
      new THREE.MeshLambertMaterial({ color: 0xffe6a8 }));
    sand.rotation.x = -Math.PI / 2; sand.position.set(230.5, 0.03, 0); scene.add(sand);
    var water = new THREE.Mesh(new THREE.PlaneGeometry(120, EB.CITY_SIZE),
      new THREE.MeshLambertMaterial({ color: EB.COLORS.water }));
    water.rotation.x = -Math.PI / 2; water.position.set(320, -0.4, 0); scene.add(water);
    // Wooden boardwalk along the sand's edge, so the beach starts with
    // a promenade instead of void.
    var boardTex = (function () {
      var c = document.createElement("canvas"); c.width = 64; c.height = 64;
      var g2 = c.getContext("2d");
      g2.fillStyle = "#c9a06a"; g2.fillRect(0, 0, 64, 64);
      g2.strokeStyle = "#8a6a3a"; g2.lineWidth = 2;
      for (var bl = 0; bl <= 64; bl += 16) {
        g2.beginPath(); g2.moveTo(0, bl); g2.lineTo(64, bl); g2.stroke();
      }
      var bt = new THREE.CanvasTexture(c);
      bt.wrapS = bt.wrapT = THREE.RepeatWrapping;
      bt.repeat.set(1, 90);
      bt.colorSpace = THREE.SRGBColorSpace;
      return bt;
    })();
    var boardwalk = new THREE.Mesh(new THREE.PlaneGeometry(9, EB.CITY_SIZE),
      new THREE.MeshLambertMaterial({ map: boardTex }));
    boardwalk.rotation.x = -Math.PI / 2; boardwalk.position.set(206, 0.04, 0); scene.add(boardwalk);
    var umbrellaColors = [0xff4ad9, 0xffd23e, 0x2ec4b6, 0xff6b3d];
    // v5: bigger (3.2 m) and denser (26 over 400 m) so the beach reads
    // busy from the cover camera instead of empty sand.
    for (var u = 0; u < 26; u++) {
      var umb = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.5, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff }));
      pole.position.y = 1.75; umb.add(pole);
      var top = new THREE.Mesh(new THREE.ConeGeometry(3.2, 1.5, 8),
        new THREE.MeshLambertMaterial({ color: umbrellaColors[u % 4] }));
      top.position.y = 3.9; umb.add(top);
      umb.position.set(214 + (u % 3) * 9, 0, -200 + u * 16);
      scene.add(umb);
    }
    // Beach cabanas: striped-roof huts in a row along the sand.
    for (var cb = 0; cb < 5; cb++) {
      var cabana = new THREE.Group();
      var cbase = new THREE.Mesh(new THREE.BoxGeometry(4, 2.4, 3.2),
        new THREE.MeshLambertMaterial({ color: 0xffffff }));
      cbase.position.y = 1.2; cabana.add(cbase);
      var croof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4),
        new THREE.MeshLambertMaterial({ color: umbrellaColors[cb % 4] }));
      croof.position.y = 3.2; croof.rotation.y = Math.PI / 4; cabana.add(croof);
      cabana.position.set(236, 0, -160 + cb * 80);
      scene.add(cabana);
    }
    // Beach towels: bright rectangles on the sand between umbrellas.
    for (var tw = 0; tw < 10; tw++) {
      var towel = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6),
        new THREE.MeshLambertMaterial({ color: umbrellaColors[tw % 4] }));
      towel.rotation.x = -Math.PI / 2; towel.rotation.z = (Math.random() - 0.5) * 0.8;
      towel.position.set(222 + (tw % 2) * 8, 0.05, -180 + tw * 38);
      scene.add(towel);
    }
    // Lifeguard tower: legs + white cabin + red roof.
    var lg = new THREE.Group();
    [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].forEach(function (lp) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4, 0.25),
        new THREE.MeshLambertMaterial({ color: 0xffffff }));
      leg.position.set(lp[0], 2, lp[1]); lg.add(leg);
    });
    var cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cab.position.y = 5; lg.add(cab);
    var lgRoof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.2, 4),
      new THREE.MeshLambertMaterial({ color: 0xd94a2a }));
    lgRoof.position.y = 6.7; lgRoof.rotation.y = Math.PI / 4; lg.add(lgRoof);
    lg.position.set(218, 0, 40);
    scene.add(lg);
    // Second lifeguard tower further north, so the beach reads staffed
    // along its whole length.
    var lg2 = lg.clone();
    lg2.position.set(218, 0, -120);
    scene.add(lg2);
    // Volleyball net on the sand.
    var vn = new THREE.Group();
    [-2.5, 2.5].forEach(function (vx) {
      var vp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6),
        new THREE.MeshLambertMaterial({ color: 0xffffff }));
      vp.position.set(vx, 1.3, 0); vn.add(vp);
    });
    var net = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    net.position.y = 2.0; vn.add(net);
    vn.position.set(220, 0, -60);
    scene.add(vn);
    for (var b = 0; b < 4; b++) {
      var boat = new THREE.Group();
      var hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.4, 10),
        new THREE.MeshLambertMaterial({ color: 0xffffff }));
      hull.position.y = 0.4; boat.add(hull);
      var sail = new THREE.Mesh(new THREE.ConeGeometry(1.6, 6, 4),
        new THREE.MeshLambertMaterial({ color: umbrellaColors[b % 4] }));
      sail.position.y = 4; boat.add(sail);
      boat.position.set(295 + (b % 2) * 22, 0, -150 + b * 95);
      boat.rotation.y = 0.4;
      scene.add(boat);
    }
    for (var bp = -200; bp <= 200; bp += 40) {
      if (bp >= 120 && bp <= 200) continue; // keep the cover corridor clear
      addPalm(222, bp);
    }
    // Second beach palm row, interleaved with the first.
    for (var bp2 = -180; bp2 <= 180; bp2 += 36) {
      if (bp2 >= 120 && bp2 <= 200) continue;
      addPalm(218, bp2);
    }
    // Palm avenue down the WEST side of the coastal road, framing it.
    [-184, -120, -56, 8, 72, 136].forEach(function (pz) { addPalm(182, pz); });
    // THE EMBER VOLCANO: a real smoking mountain, not a black pyramid —
    // a wide rocky cone with a mottled lava-rock texture (orange flows
    // baked into the rock), a bright crater with a lava disc, a tall
    // smoke column, and green foothill cones grounding its base. Moved
    // WEST of the coastal road so the HEAT LINE gantry can never hide
    // its crater from the cover camera.
    var volcano = new THREE.Group();
    var rockTex = (function () {
      var c = document.createElement("canvas"); c.width = 256; c.height = 256;
      var g2 = c.getContext("2d");
      g2.fillStyle = "#5a2418"; g2.fillRect(0, 0, 256, 256);
      var shades = ["#6e3220", "#4a1e12", "#7a3a22", "#3d1a10", "#8a4a2a"];
      for (var ri = 0; ri < 220; ri++) {
        g2.fillStyle = shades[Math.floor(Math.random() * shades.length)];
        g2.globalAlpha = 0.5;
        g2.fillRect(Math.random() * 256, Math.random() * 256,
          8 + Math.random() * 26, 6 + Math.random() * 18);
      }
      // Lava flows baked into the rock: orange streaks running down
      // from the crater, with a bright core line each. Wide and bright
      // on purpose — at 300+ m a thin streak is invisible.
      for (var lf = 0; lf < 4; lf++) {
        var lx = 20 + lf * 58 + Math.random() * 12;
        g2.globalAlpha = 0.95;
        g2.fillStyle = "#ff5a1a";
        g2.fillRect(lx, 0, 18, 200);
        g2.globalAlpha = 1;
        g2.fillStyle = "#ffb52e";
        g2.fillRect(lx + 6, 0, 6, 200);
      }
      g2.globalAlpha = 1;
      var rt = new THREE.CanvasTexture(c);
      rt.colorSpace = THREE.SRGBColorSpace;
      return rt;
    })();
    var cone = new THREE.Mesh(new THREE.ConeGeometry(150, 180, 24),
      new THREE.MeshLambertMaterial({ map: rockTex, fog: false }));
    cone.position.y = 90; volcano.add(cone);
    var crater = new THREE.Mesh(new THREE.CylinderGeometry(46, 54, 18, 16),
      new THREE.MeshBasicMaterial({ color: 0xff7a1a, fog: false }));
    crater.position.y = 171; volcano.add(crater);
    var lavaDisc = new THREE.Mesh(new THREE.CircleGeometry(42, 24),
      new THREE.MeshBasicMaterial({ color: 0xffb52e, fog: false }));
    lavaDisc.rotation.x = -Math.PI / 2; lavaDisc.position.y = 181; volcano.add(lavaDisc);
    var smokeCols = [0xffffff, 0xffe8d8, 0xffd9c2, 0xcccccc];
    for (var sm = 0; sm < 8; sm++) {
      var puff = new THREE.Mesh(new THREE.SphereGeometry(26 + sm * 4, 10, 10),
        new THREE.MeshBasicMaterial({ color: smokeCols[sm % 4], transparent: true, opacity: 0.8, fog: false }));
      // v9: smoke column sits on the lower crater (y 171..241) so the
      // crater + smoke fit inside the aerial cover frame — the old
      // 230 m cone's peak was cropped out of the top of the shot.
      puff.position.set((sm - 3.5) * 16, 171 + sm * 10, (sm % 2 ? 14 : -14));
      volcano.add(puff);
    }
    // v9: cone LOWERED to 180 m (was 230) — the aerial cover looks
    // down at ~-17 deg, so the old peak + smoke column were cropped
    // out of the top of the frame. At 180 m the crater, lava and
    // smoke all read inside the shot, and the chase camera still sees
    // the whole mountain.
    volcano.position.set(70, 0, -360);
    scene.add(volcano);
    // Smooth green foothill cones around the volcano's base (Brisa Bay's
    // low-poly hills), so the mountain sits in the land, not on void.
    [[-160, -370], [160, -380], [40, -540]].forEach(function (fp) {
      var hill = new THREE.Mesh(new THREE.ConeGeometry(52, 36, 12),
        new THREE.MeshLambertMaterial({ color: 0x2fbf5a, fog: false }));
      hill.position.set(fp[0], 18, fp[1]);
      scene.add(hill);
    });
    // Low golden sun in the north-west sky + bright clouds across it,
    // so the cover frame (looking north) gets sun, sky and clouds.
    var sunDisc = new THREE.Mesh(new THREE.CircleGeometry(60, 32),
      new THREE.MeshBasicMaterial({ color: 0xffb52e, fog: false }));
    sunDisc.position.set(-120, 170, -520);
    sunDisc.lookAt(0, 40, 0);
    scene.add(sunDisc);
    var sunHalo = new THREE.Mesh(new THREE.CircleGeometry(82, 32),
      new THREE.MeshBasicMaterial({ color: 0xff9a5c, transparent: true, opacity: 0.45, fog: false }));
    sunHalo.position.set(-122, 170, -520);
    sunHalo.lookAt(0, 40, 0);
    scene.add(sunHalo);
    for (var cl = 0; cl < 8; cl++) {
      var cloud = new THREE.Mesh(new THREE.SphereGeometry(16, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, fog: false }));
      cloud.scale.set(2.6, 0.7, 1.4);
      cloud.position.set(-380 + cl * 100, 160 + (cl % 3) * 22, -360 - (cl % 4) * 40);
      scene.add(cloud);
    }
    // Neon gantries over the coastal road (x=192), the cover's focal
    // point — "EMBER BAY" hangs right above the road the cover drives,
    // "HEAT LINE" one block further north for depth. v7: the EMBER BAY
    // gantry sits at y=32 (was 34) so the volcano crater clears the
    // panel top in the cover frame.
    makeNeonSign("EMBER BAY", "NEON ROW • OPEN ALL NIGHT", 192, 32, 48, 0, 52, 16, "#ff4ad9");
    makeNeonSign("HEAT LINE", "EMBER BAY", 192, 24, -64, 0, 34, 11, "#ffd23e");
    // District signs at the main junctions.
    makeDistrictSign("Portside", "docks & cranes", -128, -128, Math.PI / 4);
    makeDistrictSign("Old Market", "stalls & brick", 0, -128, 0);
    makeDistrictSign("Neon Row", "signs & nightlife", 192, -128, -Math.PI / 4);
    makeDistrictSign("Palm Heights", "hills & villas", -128, 96, Math.PI / 4);
    makeDistrictSign("Cinder Docks", "Rust Crew turf", 0, 96, 0);
    makeDistrictSign("Sunset Beach", "sand & surf", 128, 128, -Math.PI / 4);
    // v6 DISTANT SKYLINE: a ring of varied towers beyond the playable
    // city (north + west + south), so the horizon reads as an organic
    // city, not void. Far towers: no colliders, fog:false materials.
    // The far ground sits at y=-0.5, BELOW the bay water (-0.4), so
    // the sea stays visible.
    var farGround = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600),
      new THREE.MeshLambertMaterial({ color: 0x2e6b4a }));
    farGround.rotation.x = -Math.PI / 2; farGround.position.y = -0.5;
    scene.add(farGround);
    var skyForms = ["slab", "setback", "rounded", "curved"]; // v11: flat roofs out here too
    var skySpots = [];
    for (var sx = -240; sx <= 240; sx += 60) skySpots.push([sx + EB.util.rand(-12, 12), -330 + EB.util.rand(-20, 20)]);
    for (var sz = -160; sz <= 160; sz += 80) skySpots.push([-330 + EB.util.rand(-20, 20), sz]);
    for (var sx2 = -180; sx2 <= 180; sx2 += 90) skySpots.push([sx2 + EB.util.rand(-12, 12), 330 + EB.util.rand(-15, 15)]);
    skySpots.forEach(function (sp) {
      var sw = EB.util.rand(18, 30), sd = EB.util.rand(18, 30);
      var sh = EB.util.rand(45, 95);
      var scol = EB.util.pick(EB.COLORS.building);
      var scolHex = "#" + Math.floor(scol * 0.72).toString(16).padStart(6, "0");
      addBuilding(sp[0], sp[1], sw, sd, sh, scolHex,
        Math.random() < 0.15 ? "tower" : "flat", EB.util.pick(skyForms), true);
    });
  }

  return {
    init: function (canvas) {
      scene = new THREE.Scene();
      scene.fog = new THREE.Fog(EB.COLORS.fog, 120, 700);
      camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 1200);
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // ?lowfx=1: performance mode for weak machines (no shadows, 1x pixels).
      if (new URLSearchParams(window.location.search).get("lowfx") === "1") {
        renderer.shadowMap.enabled = false;
        renderer.setPixelRatio(1);
      }
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.5;

      // Golden-hour sky: three-stop gradient dome (blue -> pink -> orange).
      var skyGeo = new THREE.SphereGeometry(900, 24, 16);
      var skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          top: { value: new THREE.Color(EB.COLORS.skyTop) },
          mid: { value: new THREE.Color(EB.COLORS.skyMid) },
          bottom: { value: new THREE.Color(EB.COLORS.skyBottom) },
        },
        vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
        fragmentShader: "varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; void main(){ float h = normalize(vP).y; vec3 c = h < 0.08 ? mix(bottom, mid, h / 0.08) : h < 0.34 ? mix(mid, top, (h - 0.08) / 0.26) : top; gl_FragColor = vec4(c, 1.0); }",
      });
      scene.add(new THREE.Mesh(skyGeo, skyMat));

      var hemi = new THREE.HemisphereLight(0xffe0b0, 0x8a6a5a, 1.35);
      scene.add(hemi);
      // Low sun from the north-west, matching the sun disc in the sky.
      var sun = new THREE.DirectionalLight(EB.COLORS.sun, 3.0);
      sun.position.set(-220, 80, -160);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
      sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
      sun.shadow.camera.far = 700;
      scene.add(sun);
      this.sun = sun;

      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(EB.CITY_SIZE, EB.CITY_SIZE),
        new THREE.MeshLambertMaterial({ color: EB.COLORS.ground }));
      ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
      scene.add(ground);

      buildRoads();
      buildCity();
      clock = new THREE.Clock();

      window.addEventListener("resize", function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      });
    },
    scene: function () { return scene; },
    camera: function () { return camera; },
    renderer: function () { return renderer; },
    blocks: function () { return blocks; },
    // Circle vs building colliders. Returns the pushed-out position.
    collide: function (x, z, r) {
      var S = EB.CITY_SIZE / 2 - 6;
      x = EB.util.clamp(x, -S, S); z = EB.util.clamp(z, -S, S);
      for (var i = 0; i < colliders.length; i++) {
        var c = colliders[i];
        var dx = x - c.x, dz = z - c.z;
        var d = Math.sqrt(dx * dx + dz * dz);
        var min = c.r + r;
        if (d < min && d > 0.001) {
          x = c.x + (dx / d) * min; z = c.z + (dz / d) * min;
        }
      }
      return { x: x, z: z };
    },
    isOnRoad: function (x, z) {
      for (var i = -3; i <= 3; i++) {
        var c = i * EB.ROAD_SPACING;
        if (Math.abs(x - c) < 7 || Math.abs(z - c) < 7) return true;
      }
      return false;
    },
    // v8: pedestrians NEVER stand on asphalt. A sidewalk point sits on
    // the tiled sidewalk flanking a road (7.5 m off the centreline,
    // inside the 5.5..9.5 m sidewalk band) and at least 14 m from any
    // cross road, so it never lands on a junction's asphalt either.
    sidewalkPoint: function () {
      var c = EB.util.randInt(-3, 3) * EB.ROAD_SPACING;
      var side = Math.random() < 0.5 ? -7.5 : 7.5;
      var t = EB.util.pick([-160, -96, -32, 32, 96, 160]) + EB.util.rand(-18, 18);
      return Math.random() < 0.5 ? { x: c + side, z: t } : { x: t, z: c + side };
    },
    // Push any point off the asphalt onto the nearest sidewalk: if it
    // is within 6.5 m of a road centreline (asphalt is 5 m half-wide,
    // edge lines at 4.6 m), move it to 7.5 m off that centreline — the
    // middle of the sidewalk band. Points already on a sidewalk, verge
    // or lawn are left alone. Each axis is handled independently, so a
    // junction point is pushed to the corner sidewalk.
    clampToSidewalk: function (x, z) {
      for (var i = -3; i <= 3; i++) {
        var c = i * EB.ROAD_SPACING;
        // v10: trigger at 7.2 (was 6.5) — peds drifting toward the
        // road used to sit in the 6.5-7.0 m band, which isOnRoad(< 7)
        // counts as asphalt even though the sidewalk band is 5.5-9.5 m.
        // Now they snap back to 7.5 m before ever reading as on-road.
        if (Math.abs(x - c) < 7.2) x = c + (x - c >= 0 ? 7.5 : -7.5);
        if (Math.abs(z - c) < 7.2) z = c + (z - c >= 0 ? 7.5 : -7.5);
      }
      return { x: x, z: z };
    },
    // A point on a road, for spawning cars and peds.
    roadPoint: function () {
      var i = EB.util.randInt(-3, 3) * EB.ROAD_SPACING;
      var t = EB.util.rand(-220, 220);
      return Math.random() < 0.5 ? { x: i, z: t } : { x: t, z: i };
    },
  };
})();
