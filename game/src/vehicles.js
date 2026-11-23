// EMBER BAY — Heat Line: vehicles.js
// One job: cars. Builds them from boxes, drives the player's car with
// arcade physics, runs 11 traffic cars on road loops, and runs the police:
// chase cars, roadblocks at 3+ stars and the Air One helicopter at 4+.
EB.vehicles = (function () {
  var cars = [];        // every car in the world
  var playerCar = null; // the car the player drives (or null)
  var heli = null;      // {group, rotor, light, target}
  var roadblockCars = [];
  var nextId = 1;
  var TRAFFIC_COUNT = 22; // v11: denser streets (was 14) — fadli: kota harus padet

  // v10: PASTEL traffic palette (Brisa Bay: pastel pink/mint/sky/cream
  // + teal/coral/yellow/white/lavender) — one of 5 key colours everywhere.
  var CAR_COLORS = [0xffb3a7, 0x7ed957, 0x7ec8e3, 0xffe3a3, 0x2ec4b6, 0xff8a7a, 0xffffff, 0xd9b8ff, 0xffd23e];
  var TAXI_YELLOW = 0xffd23e;

  // Shared soft radial textures, built once: a WHITE radial (light glows
  // and headlight beam pools, tinted per use) and a BLACK radial (the
  // soft blob shadow both top entries use to ground their cars).
  var glowTex = null, blobTex = null;
  function radialTexture(white) {
    var c = document.createElement("canvas"); c.width = 64; c.height = 64;
    var g = c.getContext("2d");
    var grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    if (white) {
      grad.addColorStop(0, "rgba(255,255,255,1)");
      grad.addColorStop(0.4, "rgba(255,255,255,0.45)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      grad.addColorStop(0, "rgba(0,0,0,0.5)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
    }
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }
  function glowTexture() { if (!glowTex) glowTex = radialTexture(true); return glowTex; }
  function blobTexture() { if (!blobTex) blobTex = radialTexture(false); return blobTex; }
  function glowSprite(color, scale) {
    var m = new THREE.SpriteMaterial({ map: glowTexture(), color: color, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
    var s = new THREE.Sprite(m);
    s.scale.set(scale, scale, 1);
    return s;
  }

  // Sharp canvas text for vehicle liveries (POLICE doors, AIR ONE heli).
  function textTexture(text, fg) {
    var c = document.createElement("canvas"); c.width = 512; c.height = 128;
    var g = c.getContext("2d");
    g.fillStyle = fg; g.font = "900 84px 'Arial Black', 'Trebuchet MS', sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(text, 256, 68);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function makeCarMesh(colorHex, kind, opts) {
    opts = opts || {};
    var g = new THREE.Group();
    // GLOSSY paint: Phong with a strong specular highlight. Fadli's
    // order is "lebih mengkilap lebih menyala" — deliberately glossier
    // than the flat-matte cars of the top 1-2 entries (their paint is
    // matte, no specular at all; the gloss is OUR step past them).
    // v10 SKYLINE HERO (fadli: "kyk skyline warna biru putih punya
    // fast furious"): metallic blue paint + white stripes + four ROUND
    // taillights + a big GT wing. The look is GT-R-inspired (blue
    // body, white stripes, round lamps, big wing); no trademarked
    // lettering anywhere on the car.
    var paint = kind === "skyline"
      ? new THREE.MeshPhongMaterial({ color: 0x1e56d8, shininess: 140, specular: 0xffffff })
      : new THREE.MeshPhongMaterial({ color: colorHex, shininess: 110, specular: 0xeeeeee });
    var paintDark = kind === "skyline"
      ? new THREE.MeshPhongMaterial({ color: 0x143a8a, shininess: 120, specular: 0xdddddd })
      : new THREE.MeshPhongMaterial({ color: new THREE.Color(colorHex).multiplyScalar(0.72), shininess: 90, specular: 0xcccccc });
    // v6 SCULPTED BODY: the car is an EXTRUDED side silhouette, not a
    // box — a curved hood, a flowing roofline and a kicked-up tail,
    // with a bevel that rounds every edge. Fadli's order is "mobil
    // nggak kotak-kotak": this is the shape that reads as a real car
    // from every angle. The top entries' cars are flat matte boxes;
    // ours are sculpted and glossy on purpose.
    function extrudeProfile(points, depth, bevel, mat) {
      var s = new THREE.Shape();
      s.moveTo(points[0][0], points[0][1]);
      for (var i = 1; i < points.length; i++) {
        var p = points[i];
        if (p[2] === "q") s.quadraticCurveTo(p[3], p[4], p[0], p[1]);
        else s.lineTo(p[0], p[1]);
      }
      s.closePath();
      var geo = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: true,
        bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 3, steps: 1 });
      geo.translate(0, 0, -depth / 2);
      geo.rotateY(-Math.PI / 2); // shape X (length) -> +Z (car forward)
      var m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      return m;
    }
    // v7: the tail is a ROUNDED curve, not a flat vertical wall — the
    // rear bulges out at mid-height and sweeps up to the deck, so the
    // hero coupe reads sculpted from behind, not boxy.
    // v11: LOW + WIDE GT stance — a sloped hood, a raked windshield,
    // a CURVED roof and a sloped deck/tail. The old profile's flat
    // roof + vertical tail read as a rectangular block from behind;
    // this one reads as a car from every angle. Fadli: "kenapa kotak
    // banget" — no 90-degree edge is left on the body.
    var bodyPts = [
      [2.28, 0.28],
      [2.34, 0.52, "q", 2.34, 0.34],
      [1.35, 0.74, "q", 2.05, 0.66],
      [0.80, 0.80],
      [-0.10, 1.06, "q", 0.45, 1.02],
      [-0.55, 1.08, "q", -0.35, 1.10],
      [-1.20, 0.86, "q", -0.95, 1.02],
      [-1.95, 0.70, "q", -1.65, 0.76],
      [-2.22, 0.55, "q", -2.20, 0.62],
      [-2.22, 0.28],
    ];
    var bodyW = kind === "skyline" ? 2.04 : 1.94;
    var body = extrudeProfile(bodyPts, bodyW, 0.10, paint);
    g.add(body);
    // Lower valance in the darker paint shade.
    var valance = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 4.1), paintDark);
    valance.position.set(0, 0.32, 0); g.add(valance);
    // Rounded rear bumper cap (v7): a horizontal cylinder across the
    // tail so the back reads curved from every angle, not a flat wall.
    var rearBumper = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 1.9, 12), paintDark);
    rearBumper.rotation.z = Math.PI / 2;
    rearBumper.position.set(0, 0.38, -2.14); g.add(rearBumper);
    // v11: FLARED FENDERS — flattened spheres bulging out over each
    // wheel as shoulder muscle, plus a bigger half-torus arch ring
    // hugging each wheel top, so the flanks read sculpted, not flat.
    [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]].forEach(function (p) {
      var fender = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), paint);
      fender.scale.set(0.28, 0.42, 0.95);
      fender.position.set(p[0], 0.72, p[1]);
      g.add(fender);
      var arch = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.12, 8, 14, Math.PI), paint);
      arch.rotation.y = Math.PI / 2;
      arch.position.set(p[0], 0.42, p[1]);
      g.add(arch);
    });
    // Glasshouse: a second, narrower extrude — curved windshield and
    // rear glass flowing into a panoramic roof, dark reflective glass.
    var glass = new THREE.MeshPhongMaterial({ color: 0x0a1a2e, shininess: 200, specular: 0x99ccff });
    // v11: RAKED glasshouse — a low sloped windshield and rear glass
    // flowing into the roof, never vertical. The old cabin was a tall
    // near-vertical box; that was half of the "kotak" read.
    var glassPts = [
      [0.82, 0.80],
      [-0.02, 1.16, "q", 0.42, 1.12],
      [-0.52, 1.14, "q", -0.32, 1.17],
      [-1.10, 0.84, "q", -0.88, 1.08],
      [-1.10, 0.80],
    ];
    var cabin = extrudeProfile(glassPts, 1.46, 0.05, glass);
    g.add(cabin);
    // v11: CURVED roof — a flattened dome shell over the glasshouse,
    // not a flat box panel. The roofline now arcs from the windshield
    // to the rear glass, so the car reads round from above and behind.
    var roofPanel = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), paint);
    roofPanel.scale.set(0.95, 0.34, 1.15);
    roofPanel.position.set(0, 1.02, -0.30); g.add(roofPanel);
    // Gloss stripe: a bright specular band down the hood and roof — the
    // showroom shine that reads even in a flat-lit headless render.
    // v7: wider + brighter, and a rear-deck shine so the tail reads
    // glossy from behind too (the cover camera looks at the rear).
    // v11: shine follows the NEW sloped surfaces — hood shine rides
    // the sloped hood, deck shine rides the sloped deck. The old
    // roof shine floated over a flat panel that no longer exists
    // (the roof is a dome now, glossy paint does the work).
    var shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.42 });
    var hoodShine = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.1), shineMat);
    hoodShine.rotation.x = -Math.PI / 2 + 0.10; hoodShine.position.set(-0.25, 0.80, 1.55); g.add(hoodShine);
    var deckShine = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.9), shineMat);
    deckShine.rotation.x = -Math.PI / 2 + 0.15; deckShine.position.set(0, 0.78, -1.85); g.add(deckShine);
    // Front bumper + side skirts + mirrors — the details that stop a car
    // reading as one plain box.
    // v11: ROUNDED front bumper — a horizontal cylinder, not a box;
    // side skirts + mirrors riding the raked glasshouse's front corner.
    var bumper = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.94, 12), paintDark);
    bumper.rotation.z = Math.PI / 2;
    bumper.position.set(0, 0.34, 2.30); g.add(bumper);
    [-0.95, 0.95].forEach(function (sx) {
      var skirt = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.22, 3.2), paintDark);
      skirt.position.set(sx, 0.3, 0); g.add(skirt);
      var mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.3), paint);
      mirror.position.set(sx * 1.06, 0.95, 0.6); g.add(mirror);
    });
    // Headlights + taillights, LIT: bright cores + additive glow sprites.
    // Skyline: ROUND headlights + FOUR ROUND taillights (the GT-R
    // signature), chrome-ringed; other cars keep the box lamps + bar.
    // v11: lamps ride the NEW sloped nose/tail — the round Skyline
    // taillights tilt back ~25 deg to sit flush on the sloped tail
    // instead of floating off a vertical wall.
    var hlCore = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
    var tlCore = new THREE.MeshBasicMaterial({ color: 0xff3030 });
    if (kind === "skyline") {
      [-0.7, 0.7].forEach(function (hx) {
        var lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 16), hlCore);
        lamp.rotation.x = Math.PI / 2; lamp.position.set(hx, 0.58, 2.36); g.add(lamp);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 16),
          new THREE.MeshPhongMaterial({ color: 0xd8dee6, shininess: 140, specular: 0xffffff }));
        ring.position.set(hx, 0.58, 2.38); g.add(ring);
      });
    } else {
      [[-0.7, 2.36, hlCore], [0.7, 2.36, hlCore]].forEach(function (p) {
        var s = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.18, 0.08), p[2]);
        s.position.set(p[0], 0.58, p[1]); g.add(s);
      });
    }
    if (kind === "skyline") {
      [-0.85, -0.45, 0.45, 0.85].forEach(function (tx) {
        var lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16), tlCore);
        lamp.rotation.x = Math.PI / 2 - 0.45; lamp.position.set(tx, 0.56, -2.16); g.add(lamp);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16),
          new THREE.MeshPhongMaterial({ color: 0xd8dee6, shininess: 140, specular: 0xffffff }));
        ring.rotation.x = -0.45;
        ring.position.set(tx, 0.56, -2.18); g.add(ring);
        var gl = glowSprite(0xff2a2a, 0.8); gl.position.set(tx, 0.56, -2.28); g.add(gl);
      });
    } else {
      // v7: full-width taillight bar + two lamp clusters with chrome
      // surrounds — the rear reads as designed lighting, not two red dots.
      var tlBar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.15, 0.06),
        new THREE.MeshBasicMaterial({ color: 0xcc1414 }));
      tlBar.position.set(0, 0.60, -2.16); g.add(tlBar);
      [-0.68, 0.68].forEach(function (tx) {
        var surround = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.06),
          new THREE.MeshPhongMaterial({ color: 0xd8dee6, shininess: 140, specular: 0xffffff }));
        surround.position.set(tx, 0.58, -2.16); g.add(surround);
        var lamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), tlCore);
        lamp.position.set(tx, 0.58, -2.18); g.add(lamp);
      });
    }
    var gl1 = glowSprite(0xfff2b0, 1.1); gl1.position.set(-0.7, 0.58, 2.48); g.add(gl1);
    var gl2 = glowSprite(0xfff2b0, 1.1); gl2.position.set(0.7, 0.58, 2.48); g.add(gl2);
    var gl3 = glowSprite(0xff2a2a, 1.1); gl3.position.set(-0.68, 0.58, -2.28); g.add(gl3);
    var gl4 = glowSprite(0xff2a2a, 1.1); gl4.position.set(0.68, 0.58, -2.28); g.add(gl4);
    var gl5 = glowSprite(0xff2a2a, 1.3); gl5.position.set(0, 0.60, -2.28); g.add(gl5);
    // Headlight beam pool on the asphalt ahead — every car drives with
    // its lights on at golden hour, so the road glows in front of it.
    var pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.5),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffe9a8, transparent: true,
        opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, 0.07, 5.2); g.add(pool);
    // Soft blob shadow under the car, like both top entries.
    var blob = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 5.2),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; blob.position.y = 0.06; g.add(blob);
    var barL = null, barR = null;
    if (kind === "police") {
      // Light bar, split red/blue and BLINKING (see updatePolice) — the
      // top entries' bars are flat blocks that never flash; ours flash.
      var barMatL = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true });
      var barMatR = new THREE.MeshBasicMaterial({ color: 0x2040ff, transparent: true });
      barL = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.4), barMatL);
      barL.position.set(-0.32, 1.30, -0.25); g.add(barL);
      barR = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.4), barMatR);
      barR.position.set(0.32, 1.30, -0.25); g.add(barR);
      var bg1 = glowSprite(0xff2020, 0.9); bg1.position.set(-0.32, 1.30, -0.25); g.add(bg1);
      var bg2 = glowSprite(0x2040ff, 0.9); bg2.position.set(0.32, 1.30, -0.25); g.add(bg2);
      var badge = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.2, 1.1),
        new THREE.MeshBasicMaterial({ color: 0x1c3a6e }));
      badge.position.set(0, 0.72, 0.4); g.add(badge);
      // v7: readable POLICE livery — black door panels with white
      // POLICE lettering on both doors, over the navy band. The top
      // entries' police cars carry no readable text at all.
      var polTex = textTexture("POLICE", "#ffffff");
      [-1, 1].forEach(function (sx) {
        var panel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 1.9),
          new THREE.MeshBasicMaterial({ color: 0x101418 }));
        panel.position.set(sx * 1.0, 0.72, 0.1); g.add(panel);
        var door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4),
          new THREE.MeshBasicMaterial({ map: polTex, transparent: true, depthWrite: false }));
        door.position.set(sx * 1.04, 0.72, 0.1);
        door.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(door);
      });
    }
    if (kind === "taxi") {
      var sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
        new THREE.MeshBasicMaterial({ color: TAXI_YELLOW }));
      sign.position.set(0, 1.30, -0.25); g.add(sign);
    }
    if (opts.sporty) {
      // Hero cars (first coupe, Ember GT): spoiler + white racing stripe.
      // v7: bigger blade, raised, with end plates and a third brake
      // light — the spoiler reads from the rear, not just the side.
      // v10 Skyline: a WIDER GT wing on taller supports + TWIN white
      // stripes (hood/roof/deck) + a white side skirt accent.
      // v11: wing rides the LOWER deck — supports grow from the
      // sloped deck (y 0.70), not from the old tall roofline.
      var wingW = kind === "skyline" ? 2.2 : 2.05;
      var wingY = kind === "skyline" ? 1.14 : 1.10;
      var spoiler = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.09, 0.6), paintDark);
      spoiler.position.set(0, wingY, -2.15); g.add(spoiler);
      [-0.7, 0.7].forEach(function (sx) {
        var sup = new THREE.Mesh(new THREE.BoxGeometry(0.1, kind === "skyline" ? 0.46 : 0.40, 0.1), paintDark);
        sup.position.set(sx, kind === "skyline" ? 0.93 : 0.90, -2.15); g.add(sup);
      });
      [-1.0, 1.0].forEach(function (sx) {
        var plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, kind === "skyline" ? 0.34 : 0.28, 0.55), paintDark);
        plate.position.set(sx * (kind === "skyline" ? 1.07 : 1.0), wingY, -2.15); g.add(plate);
      });
      var brake3 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.05),
        new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      brake3.position.set(0, wingY + 0.02, -2.47); g.add(brake3);
      var bg3 = glowSprite(0xff2a2a, 0.9); bg3.position.set(0, wingY + 0.02, -2.56); g.add(bg3);
      var stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });
      if (kind === "skyline") {
        // v11: twin white racing stripes on the SLOPED hood and deck
        // (the roof is a dome now — stripes ride the flat slopes).
        [-0.28, 0.28].forEach(function (sx) {
          var sHood = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 1.0), stripeMat);
          sHood.rotation.x = -Math.PI / 2 + 0.10; sHood.position.set(sx, 0.79, 1.7); g.add(sHood);
          var sDeck = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.9), stripeMat);
          sDeck.rotation.x = -Math.PI / 2 + 0.15; sDeck.position.set(sx, 0.77, -1.85); g.add(sDeck);
        });
        // White side skirt accent on both flanks.
        [-0.98, 0.98].forEach(function (sx) {
          var side = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 3.0), stripeMat);
          side.position.set(sx, 0.42, 0); g.add(side);
        });
      } else {
        var sHood = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.0), stripeMat);
        sHood.rotation.x = -Math.PI / 2 + 0.10; sHood.position.set(0, 0.79, 1.7); g.add(sHood);
      }
    }
    var wheels = [];
    // v11: BIGGER wheels on a WIDER track (GT stance) — r 0.40 at
    // x ±1.0, tucked under the flared fenders.
    [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]].forEach(function (p) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.28, 12),
        new THREE.MeshLambertMaterial({ color: 0x0c0d10 }));
      w.rotation.z = Math.PI / 2; w.position.set(p[0], 0.40, p[1]); g.add(w); wheels.push(w);
      // Light-grey hubcap disc on the outer face — real wheels, not
      // black cylinders (the top entries' wheels are plain black).
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 10),
        new THREE.MeshPhongMaterial({ color: 0xd8dee6, shininess: 120, specular: 0xffffff }));
      hub.rotation.z = Math.PI / 2; hub.position.set(p[0], 0.40, p[1]); g.add(hub);
      // Chrome rim ring on the outer face — an alloy wheel, not a disc.
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 6, 14),
        new THREE.MeshPhongMaterial({ color: 0xf2f5f8, shininess: 160, specular: 0xffffff }));
      rim.rotation.y = Math.PI / 2;
      rim.position.set(p[0] + Math.sign(p[0]) * 0.17, 0.40, p[1]); g.add(rim);
    });
    return { group: g, wheels: wheels, barL: barL, barR: barR };
  }

  function makeCar(opts) {
    var built = makeCarMesh(opts.color, opts.kind || "civilian", { sporty: !!opts.sporty });
    var car = {
      id: nextId++, kind: opts.kind || "civilian",
      group: built.group, wheels: built.wheels,
      barL: built.barL, barR: built.barR,
      x: opts.x || 0, z: opts.z || 0, heading: opts.heading || 0,
      speed: 0, maxSpeed: opts.maxSpeed || 26, accel: opts.accel || 14,
      color: opts.color, isPlayer: !!opts.isPlayer, isPolice: opts.kind === "police",
      isTraffic: opts.kind === "traffic" || opts.kind === "taxi",
      route: opts.route || null, routeIdx: 0, stuck: 0,
      hp: 100, sirenPhase: Math.random() * 6,
    };
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    EB.world.scene().add(car.group);
    cars.push(car);
    return car;
  }

  // A rectangular loop around one city block, for traffic.
  function blockLoop(cx, cz) {
    var r = 32;
    return [
      { x: cx - r, z: cz - r }, { x: cx + r, z: cz - r },
      { x: cx + r, z: cz + r }, { x: cx - r, z: cz + r },
    ];
  }

  function spawnTraffic() {
    for (var i = 0; i < TRAFFIC_COUNT; i++) {
      var p = EB.world.roadPoint();
      var loop = blockLoop(
        EB.util.clamp(Math.round(p.x / EB.ROAD_SPACING) * EB.ROAD_SPACING, -192, 192),
        EB.util.clamp(Math.round(p.z / EB.ROAD_SPACING) * EB.ROAD_SPACING, -192, 192));
      var kind = i === 3 ? "taxi" : "traffic";
      var car = makeCar({
        kind: kind, x: p.x, z: p.z,
        color: kind === "taxi" ? TAXI_YELLOW : EB.util.pick(CAR_COLORS),
        maxSpeed: EB.util.rand(9, 13), route: loop,
      });
      car.routeIdx = EB.util.randInt(0, 3);
      car.speed = car.maxSpeed * 0.7;
    }
  }

  // v7 AIR ONE: a detailed, ALIVE helicopter — spinning main rotor
  // with a motion-blur disc, a spinning tail rotor, landing skids,
  // side windows, a red cheatline, AIR ONE side lettering, and a
  // searchlight whose beam reaches the ground with a light pool. The
  // old heli was a plain box + one rotor bar: a still silhouette.
  function makeHelicopter() {
    var g = new THREE.Group();
    var heliDark = new THREE.MeshLambertMaterial({ color: 0x1c2a4a });
    var body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 6), heliDark);
    body.castShadow = true; g.add(body);
    // Red cheatline band around the body.
    var cheat = new THREE.Mesh(new THREE.BoxGeometry(3.26, 0.3, 6.02),
      new THREE.MeshLambertMaterial({ color: 0xd94a2a }));
    cheat.position.set(0, -0.35, 0); g.add(cheat);
    // Side windows (dark reflective glass) on the front cabin.
    [-1, 1].forEach(function (sx) {
      var win = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 1.6),
        new THREE.MeshPhongMaterial({ color: 0x0a1a2e, shininess: 200, specular: 0x99ccff }));
      win.position.set(sx * 1.62, 0.3, 1.4); g.add(win);
    });
    // AIR ONE lettering on both flanks.
    var airTex = textTexture("AIR ONE", "#ffffff");
    [-1, 1].forEach(function (sx) {
      var t = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5),
        new THREE.MeshBasicMaterial({ map: airTex, transparent: true, depthWrite: false }));
      t.position.set(sx * 1.65, 0.35, -1.2);
      t.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(t);
    });
    var glass = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x9ad9ff }));
    glass.position.set(0, 0.2, 2.2); g.add(glass);
    var tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 5), heliDark);
    tail.position.set(0, 0.4, -5); g.add(tail);
    // Tail fin + spinning tail rotor at the tail tip.
    var fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.6, 1.0), heliDark);
    fin.position.set(0, 1.2, -7.2); g.add(fin);
    var tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.0, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x22252a }));
    tailRotor.position.set(0.42, 0.8, -7.3); g.add(tailRotor);
    // Landing skids: two rails + four struts.
    [-0.9, 0.9].forEach(function (sx) {
      var skid = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x22252a }));
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, -1.05, 0.3); g.add(skid);
      [-1.4, 1.4].forEach(function (sz) {
        var strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.08),
          new THREE.MeshLambertMaterial({ color: 0x22252a }));
        strut.position.set(sx, -0.82, sz); g.add(strut);
      });
    });
    var rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.8),
      new THREE.MeshLambertMaterial({ color: 0x22252a }));
    rotor.position.y = 1.1; g.add(rotor);
    // Motion-blur disc under the rotor — the blades read as spinning,
    // not as one frozen bar.
    var blur = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xcfd8e0, transparent: true, opacity: 0.16,
        side: THREE.DoubleSide, depthWrite: false }));
    blur.rotation.x = -Math.PI / 2;
    rotor.add(blur);
    var spot = new THREE.SpotLight(0xfff2b0, 900, 120, 0.32, 0.5, 1.2);
    spot.position.set(0, -0.5, 0);
    var spotTarget = new THREE.Object3D();
    g.add(spotTarget); spot.target = spotTarget;
    g.add(spot);
    var beam = new THREE.Mesh(new THREE.ConeGeometry(4.5, 42, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false }));
    // Cone apex at the heli, wide base at the ground — a real
    // searchlight beam (v7 fix: the old rotation.x = PI flipped it
    // into a funnel, wide at the heli and pinched at the ground).
    beam.position.y = -21; g.add(beam);
    g.position.set(0, 42, 0);
    EB.world.scene().add(g);
    // Searchlight pool on the ground under the heli — the beam lands
    // somewhere visible instead of fading into the dark.
    var pool = new THREE.Mesh(new THREE.CircleGeometry(7, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.2,
        blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.08, 0);
    pool.visible = false;
    EB.world.scene().add(pool);
    heli = { group: g, rotor: rotor, tailRotor: tailRotor, light: spot, beam: beam,
      pool: pool, active: false, angle: 0 };
    return heli;
  }

  function spawnPoliceChaser() {
    var p = EB.game.playerPos();
    var a = Math.random() * Math.PI * 2;
    var car = makeCar({
      kind: "police", x: p.x + Math.cos(a) * 55, z: p.z + Math.sin(a) * 55,
      color: 0xf2f2f2, maxSpeed: 30, accel: 18,
    });
    return car;
  }

  function setRoadblock(on) {
    if (on && roadblockCars.length === 0) {
      var p = EB.game.playerPos();
      var h = EB.game.playerHeading();
      var fx = Math.sin(h), fz = Math.cos(h);
      for (var i = -1; i <= 1; i++) {
        var bx = p.x + fx * 42 - fz * i * 5;
        var bz = p.z + fz * 42 + fx * i * 5;
        var car = makeCar({ kind: "police", x: bx, z: bz, heading: h + Math.PI / 2, color: 0xf2f2f2, maxSpeed: 0 });
        roadblockCars.push(car);
      }
      EB.say("ROADBLOCK AHEAD — Bay PD has the street cut off");
    } else if (!on && roadblockCars.length > 0) {
      roadblockCars.forEach(function (c) {
        EB.world.scene().remove(c.group);
        var idx = cars.indexOf(c); if (idx >= 0) cars.splice(idx, 1);
      });
      roadblockCars = [];
    }
  }

  function steerToward(car, tx, tz, dt, speed) {
    var want = EB.util.angleTo(car.x, car.z, tx, tz);
    car.heading = EB.util.angleLerp(car.heading, want, EB.util.clamp(2.2 * dt, 0, 1));
    car.x += Math.sin(car.heading) * speed * dt;
    car.z += Math.cos(car.heading) * speed * dt;
  }

  function updateTraffic(car, dt) {
    if (!car.route) return;
    var wp = car.route[car.routeIdx];
    var d = EB.util.dist2(car.x, car.z, wp.x, wp.z);
    if (d < 4) { car.routeIdx = (car.routeIdx + 1) % car.route.length; return; }
    // Slow down for a car right ahead.
    var slow = false;
    for (var i = 0; i < cars.length; i++) {
      var o = cars[i];
      if (o === car) continue;
      var dd = EB.util.dist2(car.x, car.z, o.x, o.z);
      if (dd < 7) { slow = true; break; }
    }
    var target = slow ? car.maxSpeed * 0.25 : car.maxSpeed;
    car.speed = EB.util.lerp(car.speed, target, EB.util.clamp(2 * dt, 0, 1));
    steerToward(car, wp.x, wp.z, dt, car.speed);
    var pos = EB.world.collide(car.x, car.z, 1.6);
    car.x = pos.x; car.z = pos.z;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    car.wheels.forEach(function (w) { w.rotation.x += car.speed * dt * 1.4; });
  }

  function updatePolice(car, dt) {
    var p = EB.game.playerPos();
    var d = EB.util.dist2(car.x, car.z, p.x, p.z);
    var target = EB.state.wanted > 0 ? 31 : 12;
    car.speed = EB.util.lerp(car.speed, target, EB.util.clamp(1.6 * dt, 0, 1));
    if (EB.state.wanted > 0) steerToward(car, p.x, p.z, dt, car.speed);
    else { // patrol: slow cruise along the road
      var wp = { x: car.x + Math.sin(car.heading) * 20, z: car.z + Math.cos(car.heading) * 20 };
      steerToward(car, wp.x, wp.z, dt, car.speed);
    }
    var pos = EB.world.collide(car.x, car.z, 1.6);
    car.x = pos.x; car.z = pos.z;
    car.group.position.set(car.x, 0, car.z);
    car.group.rotation.y = car.heading;
    car.wheels.forEach(function (w) { w.rotation.x += car.speed * dt * 1.4; });
    // Ram the player: close + fast = damage + shake.
    if (EB.state.wanted > 0 && d < 3.4 && car.speed > 8) {
      EB.game.damagePlayer(6 * dt * 10, "police");
      car.speed *= 0.4;
      EB.audio.crash();
    }
    // Siren light blink: red and blue alternate — the top entries'
    // light bars are flat blocks that never flash.
    car.sirenPhase += dt * 9;
    if (car.barL && car.barR) {
      var on = Math.sin(car.sirenPhase) > 0;
      car.barL.material.opacity = on ? 1 : 0.2;
      car.barR.material.opacity = on ? 0.2 : 1;
    }
  }

  function updateHeli(dt) {
    if (!heli) return;
    var want = EB.state.wanted >= 4 && EB.state.started && !EB.state.paused;
    if (want && !heli.active) {
      heli.active = true;
      EB.say("AIR ONE is overhead — the spotlight is on you");
    }
    if (!want && heli.active) heli.active = false;
    heli.group.visible = heli.active;
    if (heli.pool) heli.pool.visible = heli.active;
    if (!heli.active) return;
    // v7: staged chase shots fly the heli LOW (20 m, 33 m out) so it
    // reads inside the chase-camera frame — at the normal 42 m orbit
    // it sits above the top edge and is never seen. Normal play never
    // sets EB.state.heliShot, so live Air One is untouched.
    var shot = !!EB.state.heliShot;
    var orbitH = shot ? 20 : 42;
    var orbitR = shot ? 33 : 26;
    heli.angle += dt * (shot ? 0.15 : 0.35);
    var p = EB.game.playerPos();
    heli.group.position.set(
      p.x + Math.cos(heli.angle) * orbitR,
      orbitH + Math.sin(heli.angle * 0.7) * 3,
      p.z + Math.sin(heli.angle) * orbitR);
    heli.group.lookAt(p.x, 38, p.z);
    heli.rotor.rotation.y += dt * 28;
    if (heli.tailRotor) heli.tailRotor.rotation.x += dt * 34;
    // Spotlight target + beam length follow the heli's real height,
    // so the beam lands on the player instead of overshooting.
    var hy = heli.group.position.y;
    heli.light.target.position.set(p.x - heli.group.position.x, -hy, p.z - heli.group.position.z);
    heli.light.target.updateMatrixWorld();
    heli.beam.scale.y = hy / 42;
    heli.beam.position.y = -hy / 2;
    // v7b: in staged shots the beam + pool run brighter — at the live
    // 0.08 opacity the searchlight was invisible in the chase still.
    heli.beam.material.opacity = shot
      ? 0.20 + 0.06 * Math.sin(performance.now() / 300)
      : 0.08 + 0.04 * Math.sin(performance.now() / 300);
    if (heli.pool) {
      heli.pool.position.set(p.x, 0.08, p.z);
      heli.pool.material.opacity = shot
        ? 0.30 + 0.06 * Math.sin(performance.now() / 300)
        : 0.16 + 0.05 * Math.sin(performance.now() / 300);
    }
  }

  return {
    init: function () {
      spawnTraffic();
      makeHelicopter();
      // v10: the player's first car is the BLUE-WHITE SKYLINE — a
      // metallic-blue GT-R-inspired coupe with white twin stripes, four
      // round taillights and a big GT wing (fadli: "kyk skyline warna
      // biru putih punya fast furious"). The glossy hero of the cover.
      var first = makeCar({
        kind: "skyline", x: 30, z: 8, heading: 0.4, sporty: true,
        color: 0x1e56d8, maxSpeed: 34, accel: 17, isPlayer: false,
      });
      first.isFirstCar = true;
      this.firstCar = first;
      // v10: one PARKED car right by the spawn (24,24) on the z=0 road,
      // so a new player always has a car to enter within a few steps.
      var parked = makeCar({
        kind: "civilian", x: 24, z: 3, heading: Math.PI / 2, sporty: false,
        color: 0xffffff, maxSpeed: 0, accel: 0, isPlayer: false,
      });
      this.parkedNearSpawn = parked;
      // A gold Ember GT parked in Cinder Docks for the finale.
      var gt = makeCar({
        kind: "civilian", x: 12, z: 150, heading: -0.5, sporty: true,
        color: 0xffd23e, maxSpeed: 40, accel: 20, isPlayer: false,
      });
      gt.isEmberGT = true;
      this.emberGT = gt;
    },
    cars: function () { return cars; },
    playerCar: function () { return playerCar; },
    setPlayerCar: function (car) { playerCar = car; },
    heli: function () { return heli; },
    makeCar: makeCar,
    nearestCar: function (x, z, maxD) {
      var best = null, bd = maxD || 8;
      for (var i = 0; i < cars.length; i++) {
        var c = cars[i];
        if (c.isPolice && c.speed > 1) continue;
        // v10 carjack usability: a car barrelling past at speed is not
        // a fair steal target — only slow or stopped cars can be
        // entered, so the prompt never lies about a car you can't catch.
        if (Math.abs(c.speed) > 12) continue;
        var d = EB.util.dist2(x, z, c.x, c.z);
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },
    // Arcade driving for the player's car. Returns speed in mph.
    drivePlayer: function (dt) {
      if (!playerCar) return 0;
      var axes = EB.input.moveAxes();
      if (EB.state.autoDrive) axes = { x: 0, y: 1 }; // staged shots drive themselves
      var engineBoost = 1 + (EB.state.engineLevel - 1) * 0.18;
      var maxSpd = playerCar.maxSpeed * engineBoost;
      if (axes.y > 0) playerCar.speed += playerCar.accel * engineBoost * dt;
      else if (axes.y < 0) playerCar.speed -= playerCar.accel * 1.4 * dt;
      else playerCar.speed -= Math.sign(playerCar.speed) * 9 * dt;
      if (EB.input.down("Space")) playerCar.speed -= Math.sign(playerCar.speed) * 26 * dt;
      playerCar.speed = EB.util.clamp(playerCar.speed, -10, maxSpd);
      if (Math.abs(playerCar.speed) < 0.2 && axes.y === 0) playerCar.speed = 0;
      var steer = axes.x * EB.util.clamp(Math.abs(playerCar.speed) / 10, 0, 1);
      playerCar.heading += steer * 1.9 * dt * (playerCar.speed >= 0 ? 1 : -1);
      playerCar.x += Math.sin(playerCar.heading) * playerCar.speed * dt;
      playerCar.z += Math.cos(playerCar.heading) * playerCar.speed * dt;
      var pos = EB.world.collide(playerCar.x, playerCar.z, 1.7);
      if (pos.x !== playerCar.x || pos.z !== playerCar.z) {
        if (Math.abs(playerCar.speed) > 14) EB.audio.crash();
        playerCar.speed *= 0.55;
      }
      playerCar.x = pos.x; playerCar.z = pos.z;
      playerCar.group.position.set(playerCar.x, 0, playerCar.z);
      playerCar.group.rotation.y = playerCar.heading;
      // Body roll + wheel spin for feel.
      playerCar.group.rotation.z = -steer * 0.05 * EB.util.clamp(Math.abs(playerCar.speed) / 20, 0, 1);
      playerCar.wheels.forEach(function (w) { w.rotation.x += playerCar.speed * dt * 1.4; });
      // v10: distance driven (metres) for the pause-map stats.
      EB.state.distanceDriven = (EB.state.distanceDriven || 0) + Math.abs(playerCar.speed) * dt;
      EB.audio.engine(true, Math.abs(playerCar.speed) / maxSpd);
      return Math.abs(playerCar.speed) * 2.4; // mph-ish
    },
    update: function (dt) {
      for (var i = 0; i < cars.length; i++) {
        var c = cars[i];
        if (c === playerCar) continue;
        if (c.isTraffic) updateTraffic(c, dt);
        else if (c.isPolice && c.maxSpeed > 0) updatePolice(c, dt);
        else if (c.isPolice) { c.group.position.set(c.x, 0, c.z); c.group.rotation.y = c.heading; }
      }
      // Police pressure scales with wanted stars.
      var want = EB.state.wanted;
      var chasers = 0;
      for (var j = 0; j < cars.length; j++) if (cars[j].isPolice && cars[j].maxSpeed > 0) chasers++;
      var need = want === 0 ? 1 : want === 1 ? 1 : want === 2 ? 2 : want === 3 ? 3 : 4;
      if (chasers < need && EB.state.started) spawnPoliceChaser();
      if (chasers > need) {
        for (var k = cars.length - 1; k >= 0; k--) {
          if (chasers <= need) break;
          var pc = cars[k];
          if (pc.isPolice && pc.maxSpeed > 0 && pc !== playerCar) {
            EB.world.scene().remove(pc.group); cars.splice(k, 1); chasers--;
          }
        }
      }
      setRoadblock(want >= 3 && EB.state.started);
      EB.audio.siren(want > 0 && EB.state.started);
      updateHeli(dt);
    },
  };
})();
