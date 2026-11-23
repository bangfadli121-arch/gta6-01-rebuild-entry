// Ember Bay — the island itself: city blocks, beach, sea, volcano, sky,
// billboards and props. All geometry is built from boxes, cones and
// cylinders with canvas textures; nothing is loaded from outside.
(function () {
  var EB = window.EB || (window.EB = {});

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeFacadeTexture(base, litRatio, rnd) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (var y = 0; y < 256; y += 16) g.fillRect(0, y, 128, 2);
    for (var r = 0; r < 12; r++) {
      for (var col = 0; col < 6; col++) {
        var lit = rnd() < litRatio;
        g.fillStyle = lit ? '#ffd76a' : 'rgba(20,26,40,0.85)';
        g.fillRect(8 + col * 20, 10 + r * 20, 12, 14);
      }
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 3);
    return tex;
  }

  function makeSignTexture(lines, bg, fg, accent) {
    var c = document.createElement('canvas'); c.width = 512; c.height = 256;
    var g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = accent || '#ff2e88'; g.lineWidth = 10;
    g.strokeRect(8, 8, 496, 240);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (lines.length === 1) {
      g.font = 'bold 64px Arial'; g.fillText(lines[0], 256, 128);
    } else if (lines.length === 2) {
      g.font = 'bold 72px Arial'; g.fillText(lines[0], 256, 92);
      g.font = 'bold 44px Arial'; g.fillText(lines[1], 256, 178);
    } else {
      g.font = 'bold 56px Arial'; g.fillText(lines[0], 256, 66);
      g.font = 'bold 40px Arial'; g.fillText(lines[1], 256, 138);
      g.font = 'bold 34px Arial'; g.fillText(lines[2], 256, 198);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  EB.world = {
    blocks: [],       // {x,z,w,d,color} footprints for the minimap
    boats: [], smoke: [], clouds: [], beacon: null, beaconLight: null,
    sea: null, palms: [],

    build: function (scene) {
      var rnd = mulberry32(20261123);
      var C = EB.CONFIG;
      this.scene = scene;

      // --- ground, streets, beach, sea -------------------------------------
      var ground = new THREE.Mesh(
        new THREE.PlaneGeometry(700, 700),
        new THREE.MeshLambertMaterial({ color: 0x3d7a4a }));
      ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, -20);
      scene.add(ground);

      var cityBase = new THREE.Mesh(
        new THREE.PlaneGeometry(300, 250),
        new THREE.MeshLambertMaterial({ color: 0x2b2b33 }));
      cityBase.rotation.x = -Math.PI / 2; cityBase.position.set(0, 0, -28);
      scene.add(cityBase);

      var sand = new THREE.Mesh(
        new THREE.PlaneGeometry(340, 16),
        new THREE.MeshLambertMaterial({ color: 0xe8c98a }));
      sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.02, 103);
      scene.add(sand);

      this.sea = new THREE.Mesh(
        new THREE.PlaneGeometry(700, 260),
        new THREE.MeshPhongMaterial({ color: 0x1b8a8a, shininess: 120, specular: 0x99ddff }));
      this.sea.rotation.x = -Math.PI / 2; this.sea.position.set(0, 0.05, 240);
      scene.add(this.sea);

      // foam strips along the shoreline
      for (var f = 0; f < 3; f++) {
        var foam = new THREE.Mesh(
          new THREE.PlaneGeometry(340, 2.2),
          new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 - f * 0.15 }));
        foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.08 + f * 0.02, 111 + f * 3);
        scene.add(foam);
      }

      // street markings: lighter centre lines on the grid streets
      var lineMat = new THREE.MeshBasicMaterial({ color: 0xd8c86a });
      for (var sx = -140; sx <= 140; sx += C.streetGap) {
        var vline = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 240), lineMat);
        vline.rotation.x = -Math.PI / 2; vline.position.set(sx, 0.06, -28);
        scene.add(vline);
      }
      for (var sz = -140; sz <= 84; sz += C.streetGap) {
        var hline = new THREE.Mesh(new THREE.PlaneGeometry(300, 0.7), lineMat);
        hline.rotation.x = -Math.PI / 2; hline.position.set(0, 0.06, sz);
        scene.add(hline);
      }

      // --- buildings: dense, colourful, varied heights ----------------------
      var facadeTex = [];
      var hexes = ['#2fae6e', '#ff5f8f', '#ff8c42', '#3fa7d6', '#f2e3c6', '#12b5a5', '#ffd23f', '#9b5de5'];
      for (var p = 0; p < hexes.length; p++) facadeTex.push(makeFacadeTexture(hexes[p], 0.42, rnd));
      var boxGeo = new THREE.BoxGeometry(1, 1, 1);
      var roofGeo = new THREE.BoxGeometry(1, 0.6, 1);
      var count = 0;
      for (var bx = -140; bx < 140; bx += C.streetGap) {
        for (var bz = -140; bz < 84; bz += C.streetGap) {
          if (rnd() < 0.12) continue; // a few empty lots / plazas
          var lots = 1 + Math.floor(rnd() * 3);
          for (var l = 0; l < lots; l++) {
            var w = 8 + rnd() * 6, d = 8 + rnd() * 6;
            var h = 8 + Math.pow(rnd(), 1.6) * 38;
            // keep the footprint inside the block so streets stay clear
            var cx = bx + 5 + w / 2 + rnd() * (18 - w);
            var cz = bz + 5 + d / 2 + rnd() * (18 - d);
            var pi = Math.floor(rnd() * facadeTex.length);
            var mat = new THREE.MeshLambertMaterial({
              map: facadeTex[pi],
              emissive: 0x664422, emissiveMap: facadeTex[pi], emissiveIntensity: 0.55
            });
            var b = new THREE.Mesh(boxGeo, mat);
            b.scale.set(w, h, d); b.position.set(cx, h / 2, cz);
            scene.add(b);
            var roof = new THREE.Mesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0x222226 }));
            roof.scale.set(w + 0.4, 1, d + 0.4); roof.position.set(cx, h + 0.3, cz);
            scene.add(roof);
            // rooftop neon edge on some towers
            if (rnd() < 0.35) {
              var neon = new THREE.Mesh(
                new THREE.BoxGeometry(w + 0.6, 0.35, d + 0.6),
                new THREE.MeshBasicMaterial({ color: C.palette[Math.floor(rnd() * C.palette.length)] }));
              neon.position.set(cx, h + 0.8, cz); scene.add(neon);
            }
            this.blocks.push({ x: cx, z: cz, w: w, d: d, color: hexes[pi] });
            count++;
          }
        }
      }
      this.buildingCount = count;

      // --- beach props: palms and umbrellas ---------------------------------
      var trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
      var trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b42 });
      var frondGeo = new THREE.ConeGeometry(2.6, 3.4, 5);
      var frondMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
      for (var px = -150; px <= 150; px += 12) {
        if (rnd() < 0.25) continue;
        var trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(px + rnd() * 4, 3.5, 98 + rnd() * 8);
        trunk.rotation.z = (rnd() - 0.5) * 0.25; scene.add(trunk);
        var frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(trunk.position.x, 7.6, trunk.position.z); scene.add(frond);
        this.palms.push(trunk);
      }
      var umbColors = [0xff5f8f, 0xffd23f, 0x3fa7d6, 0xff8c42, 0x9b5de5, 0x12b5a5];
      var poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 5);
      var poleMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
      var umbGeo = new THREE.ConeGeometry(2.4, 1.1, 8);
      for (var ux = -140; ux <= 140; ux += 16) {
        var pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(ux, 1.3, 100 + rnd() * 6); scene.add(pole);
        var umb = new THREE.Mesh(umbGeo, new THREE.MeshLambertMaterial({ color: umbColors[Math.floor(rnd() * umbColors.length)] }));
        umb.position.set(ux, 2.9, 100 + (ux % 3)); scene.add(umb);
      }

      // --- sailboats ---------------------------------------------------------
      var sailGeo = new THREE.BufferGeometry();
      sailGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 7, 0, 2.6, 0, 0], 3));
      sailGeo.computeVertexNormals();
      var hullGeo = new THREE.BoxGeometry(2.2, 1, 6);
      var mastGeo = new THREE.CylinderGeometry(0.09, 0.09, 8, 5);
      var boatSpots = [[-45, 114], [5, 117], [55, 119]];
      for (var bi = 0; bi < boatSpots.length; bi++) {
        var boat = new THREE.Group();
        var hull = new THREE.Mesh(hullGeo, new THREE.MeshLambertMaterial({ color: bi === 1 ? 0xff5f8f : 0xf2e3c6 }));
        hull.position.y = 0.5; boat.add(hull);
        var mast = new THREE.Mesh(mastGeo, new THREE.MeshLambertMaterial({ color: 0x5a4632 }));
        mast.position.y = 4.5; boat.add(mast);
        var sail = new THREE.Mesh(sailGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
        sail.position.y = 1; boat.add(sail);
        boat.position.set(boatSpots[bi][0], 0.1, boatSpots[bi][1]);
        boat.rotation.y = rnd() * 0.6 - 0.3;
        scene.add(boat); this.boats.push(boat);
      }

      // --- volcano with lava and smoke ---------------------------------------
      var volc = new THREE.Mesh(
        new THREE.ConeGeometry(C.volcano.radius, C.volcano.height, 24),
        new THREE.MeshLambertMaterial({ color: 0x2e2a33 }));
      volc.position.set(C.volcano.x, C.volcano.height / 2 - 2, C.volcano.z);
      scene.add(volc);
      var crater = new THREE.Mesh(
        new THREE.ConeGeometry(16, 10, 16),
        new THREE.MeshBasicMaterial({ color: 0xff5a00 }));
      crater.position.set(C.volcano.x, C.volcano.height - 4, C.volcano.z);
      scene.add(crater);
      var lavaMat = new THREE.MeshBasicMaterial({ color: 0xff7b00 });
      for (var li = 0; li < 4; li++) {
        var flow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 26, 0.6), lavaMat);
        var ang = li * 1.7 + 0.4;
        flow.position.set(C.volcano.x + Math.sin(ang) * 34, 52, C.volcano.z + Math.cos(ang) * 34);
        flow.rotation.z = Math.sin(ang) * 0.55; flow.rotation.x = -Math.cos(ang) * 0.55;
        scene.add(flow);
      }
      var smokeMat = new THREE.MeshLambertMaterial({ color: 0x555560, transparent: true, opacity: 0.75 });
      for (var si = 0; si < 7; si++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(6 + rnd() * 5, 8, 6), smokeMat);
        puff.position.set(C.volcano.x + (rnd() - 0.5) * 12, C.volcano.height + si * 7, C.volcano.z + (rnd() - 0.5) * 12);
        scene.add(puff); this.smoke.push(puff);
      }
    }
  };
})();

// Ember Bay — sky, billboards and the mission beacon (same module, part 2).
(function () {
  var EB = window.EB || (window.EB = {});

  function signTexture(lines, bg, fg, accent, w, h) {
    var c = document.createElement('canvas'); c.width = w || 512; c.height = h || 256;
    var g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = accent || '#ff2e88'; g.lineWidth = 8;
    g.strokeRect(6, 6, c.width - 12, c.height - 12);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (lines.length === 1) { g.font = 'bold 72px Arial'; g.fillText(lines[0], c.width / 2, c.height / 2); }
    else if (lines.length === 2) {
      g.font = 'bold 66px Arial'; g.fillText(lines[0], c.width / 2, c.height * 0.36);
      g.font = 'bold 44px Arial'; g.fillText(lines[1], c.width / 2, c.height * 0.68);
    } else {
      g.font = 'bold 58px Arial'; g.fillText(lines[0], c.width / 2, c.height * 0.26);
      g.font = 'bold 40px Arial'; g.fillText(lines[1], c.width / 2, c.height * 0.55);
      g.font = 'bold 36px Arial'; g.fillText(lines[2], c.width / 2, c.height * 0.82);
    }
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  EB.world.buildSky = function (scene) {
    // gradient dome: orange sunset low, blue high
    var c = document.createElement('canvas'); c.width = 4; c.height = 256;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#2b4a8f'); grad.addColorStop(0.45, '#7a6bb0');
    grad.addColorStop(0.72, '#ff8c42'); grad.addColorStop(1, '#ffb347');
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
    var tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    var dome = new THREE.Mesh(
      new THREE.SphereGeometry(620, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
    dome.position.set(0, 0, -20); scene.add(dome);

    // low sun disc in the west
    var sun = new THREE.Mesh(
      new THREE.CircleGeometry(26, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, fog: false }));
    sun.position.set(-330, 78, 60); sun.lookAt(0, 20, -20); scene.add(sun);
    var glow = new THREE.Mesh(
      new THREE.CircleGeometry(44, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8c42, transparent: true, opacity: 0.35, fog: false }));
    glow.position.set(-332, 78, 62); glow.lookAt(0, 20, -20); scene.add(glow);

    // drifting clouds
    var cloudMat = new THREE.MeshLambertMaterial({ color: 0xffe8d6, transparent: true, opacity: 0.9 });
    for (var i = 0; i < 10; i++) {
      var cl = new THREE.Group();
      for (var j = 0; j < 3; j++) {
        var puff = new THREE.Mesh(new THREE.SphereGeometry(9 + Math.random() * 7, 8, 6), cloudMat);
        puff.position.set(j * 10 - 10, Math.random() * 3, Math.random() * 4);
        puff.scale.y = 0.45; cl.add(puff);
      }
      cl.position.set(-280 + i * 62, 95 + Math.random() * 45, -160 + Math.random() * 220);
      scene.add(cl); EB.world.clouds.push(cl);
    }

    // lights: warm low sun + cool sky fill
    var sunLight = new THREE.DirectionalLight(0xffb347, 1.05);
    sunLight.position.set(-260, 90, 120); scene.add(sunLight);
    scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x5a4a3a, 0.75));
    scene.fog = new THREE.Fog(0xe08a4e, 260, 620);
  };

  EB.world.addBillboards = function (scene) {
    // the big one, facing the sea/camera on the coastal road
    var big = new THREE.Mesh(
      new THREE.PlaneGeometry(46, 16),
      new THREE.MeshBasicMaterial({ map: signTexture(['EMBER BAY', 'NEON ROW \u2022 OPEN ALL NIGHT'], '#12081f', '#ffd23f', '#ff2e88', 1024, 384) }));
    big.position.set(-34, 14, 92); big.rotation.y = 0; scene.add(big);
    var legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    [-52, -16].forEach(function (x) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 1.4), legMat);
      leg.position.set(x, 4, 92); scene.add(leg);
    });
    // shop signs along Neon Row, facing south toward the beach
    var signs = [
      { t: ['HOTEL'], x: -78, bg: '#0a2a4a', fg: '#7fe7ff', ac: '#7fe7ff' },
      { t: ['DANCE'], x: -58, bg: '#2a0a2a', fg: '#ff5fd0', ac: '#ff5fd0' },
      { t: ['CASINO'], x: 30, bg: '#1a0a3a', fg: '#ffd23f', ac: '#ffd23f' },
      { t: ['TACO 24H'], x: 58, bg: '#3a1a00', fg: '#ffb347', ac: '#ff5f8f' }
    ];
    signs.forEach(function (s) {
      var p = new THREE.Mesh(
        new THREE.PlaneGeometry(15, 6),
        new THREE.MeshBasicMaterial({ map: signTexture(s.t, s.bg, s.fg, s.ac) }));
      p.position.set(s.x, 9, 86.5); scene.add(p);
    });
    // garage + safehouse markers (small signs, no text texture needed)
    var garage = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 4),
      new THREE.MeshBasicMaterial({ map: signTexture(['GARAGE'], '#0a3a1a', '#7dff9a', '#7dff9a', 512, 192) }));
    garage.position.set(64, 7, 86.5); scene.add(garage);
  };

  EB.world.placeMarker = function (scene, x, z) {
    if (!this.beacon) {
      var grp = new THREE.Group();
      var cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(3, 3, 30, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
      cyl.position.y = 15; grp.add(cyl);
      var cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 4, 4),
        new THREE.MeshBasicMaterial({ color: 0xffd23f }));
      cone.position.y = 32; cone.rotation.y = Math.PI / 4; grp.add(cone);
      this.beacon = grp; scene.add(grp);
    }
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  };

  EB.world.hideMarker = function () { if (this.beacon) this.beacon.visible = false; };

  EB.world.update = function (dt, t) {
    var i;
    for (i = 0; i < this.boats.length; i++) {
      this.boats[i].position.y = 0.1 + Math.sin(t * 0.7 + i * 2) * 0.35;
      this.boats[i].rotation.z = Math.sin(t * 0.5 + i) * 0.04;
    }
    for (i = 0; i < this.smoke.length; i++) {
      var p = this.smoke[i];
      p.position.y += dt * 2.2; p.position.x += dt * 1.1;
      if (p.position.y > 165) p.position.y = 96;
    }
    for (i = 0; i < this.clouds.length; i++) {
      this.clouds[i].position.x += dt * 1.4;
      if (this.clouds[i].position.x > 320) this.clouds[i].position.x = -320;
    }
    if (this.beacon && this.beacon.visible) {
      this.beacon.rotation.y += dt * 1.5;
      this.beacon.position.y = Math.sin(t * 2) * 0.4;
    }
    if (this.sea) this.sea.position.y = 0.05 + Math.sin(t * 0.8) * 0.12;
  };
})();
