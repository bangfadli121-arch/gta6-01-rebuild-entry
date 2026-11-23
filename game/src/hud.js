// EMBER BAY — Heat Line: hud.js
// One job: everything on screen that is not the 3D world — wanted stars,
// cash and respect, health, speed, the mission objective, the circular
// minimap, radio readout, toasts, the weapon wheel and the garage panel.
EB.hud = (function () {
  var el = {};
  var toastTimer = null, centerTimer = null;

  function $(id) { return document.getElementById(id); }

  function starRow() {
    var s = "";
    for (var i = 0; i < 5; i++) {
      s += i < EB.state.wanted
        ? '<span class="star">&#9733;</span>'
        : '<span class="star star-off">&#9733;</span>';
    }
    return s;
  }

  function drawMinimap() {
    var c = el.minimap;
    if (!c) return;
    var g = c.getContext("2d");
    var W = c.width, H = c.height, cx = W / 2, cy = H / 2;
    var scale = W / 560; // whole city fits the circle
    g.clearRect(0, 0, W, H);
    // Land base: bright warm sand/tan, like Brisa Bay's round minimap
    // (v9: brighter than before, so the blocks pop against it).
    g.fillStyle = "#f2e3b8";
    g.beginPath(); g.arc(cx, cy, W / 2 - 2, 0, Math.PI * 2); g.fill();
    // Turquoise bay on the east edge + a white wave edge where it
    // meets the sand (Brisa Bay: turquoise sea, white wave line).
    g.fillStyle = "#1fd4e0";
    g.fillRect(cx + 190 * scale, 0, W, H);
    g.strokeStyle = "#ffffff"; g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx + 190 * scale, 0); g.lineTo(cx + 190 * scale, H); g.stroke();
    // v11: district wash is a faint tint ONLY (was a stroked square
    // per district — that stroked grid is what made the minimap read
    // as an empty chessboard). No outlines: the city reads through
    // its buildings and roads, not through district boxes.
    EB.DISTRICTS.forEach(function (d) {
      var s = d.r * 1.35 * scale;
      g.fillStyle = d.color + "2e";
      g.fillRect(cx + d.x * scale - s / 2, cy + d.z * scale - s / 2, s, s);
    });
    // Roads: THICK dark-navy grid lines (Brisa Bay) with a white
    // hairline core, so the grid pops on the tan land (v9: thicker).
    g.strokeStyle = "#1c2a4a"; g.lineWidth = 5;
    for (var i = -3; i <= 3; i++) {
      var p = cx + i * EB.ROAD_SPACING * scale;
      g.beginPath(); g.moveTo(p, 8); g.lineTo(p, H - 8); g.stroke();
      g.beginPath(); g.moveTo(8, p); g.lineTo(W - 8, p); g.stroke();
    }
    g.strokeStyle = "rgba(255,255,255,0.7)"; g.lineWidth = 1;
    for (var j = -3; j <= 3; j++) {
      var q = cx + j * EB.ROAD_SPACING * scale;
      g.beginPath(); g.moveTo(q, 8); g.lineTo(q, H - 8); g.stroke();
      g.beginPath(); g.moveTo(8, q); g.lineTo(W - 8, q); g.stroke();
    }
    // v11: buildings as a FILLED pastel mosaic — every block a solid
    // coloured tile from the city's 5 key colours, so the minimap
    // reads as a dense built-up city instead of empty tan squares.
    // (The old near-white tiles on tan land all blurred into one
    // pale chessboard.)
    var MM_BLOCKS = ["#ffe3a3", "#ffb3a7", "#7ec8e3", "#7ed957", "#2ec4b6"];
    EB.world.blocks().forEach(function (b, bi) {
      g.fillStyle = MM_BLOCKS[(Math.abs(Math.round(b.x) + Math.round(b.z)) + bi) % MM_BLOCKS.length];
      g.fillRect(cx + (b.x - b.w / 2) * scale, cy + (b.z - b.d / 2) * scale,
        Math.max(2.5, b.w * scale), Math.max(2.5, b.d * scale));
    });
    var pp = EB.game.playerPos();
    function dot(x, z, color, r) {
      g.fillStyle = color;
      g.beginPath(); g.arc(cx + x * scale, cy + z * scale, r, 0, Math.PI * 2); g.fill();
    }
    // Traffic (white), police (red), mission target (big pink diamond).
    EB.vehicles.cars().forEach(function (car) {
      if (car === EB.vehicles.playerCar()) return;
      dot(car.x, car.z, car.isPolice ? "#ff2a2a" : "rgba(255,255,255,0.95)", car.isPolice ? 5 : 3);
    });
    var t = EB.missions.target();
    if (t) {
      // v10: the OBJECTIVE LINE — a dashed pink line from the player
      // to the mission target, so the next objective is unmissable on
      // the minimap (Brisa Bay's pink objective line).
      var pp2 = EB.game.playerPos();
      g.save();
      g.setLineDash([7, 5]);
      g.strokeStyle = "#ff4ad9"; g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx + pp2.x * scale, cy + pp2.z * scale);
      g.lineTo(cx + t.x * scale, cy + t.z * scale);
      g.stroke();
      g.restore();
      g.fillStyle = "#ff4ad9";
      g.strokeStyle = "#ffffff"; g.lineWidth = 2;
      var tx = cx + t.x * scale, ty = cy + t.z * scale;
      g.beginPath();
      g.moveTo(tx, ty - 10); g.lineTo(tx + 9, ty); g.lineTo(tx, ty + 10); g.lineTo(tx - 9, ty);
      g.closePath(); g.fill(); g.stroke();
    }
    // Player arrow, rotated to heading, white with a teal/orange ring
    // (Brisa Bay: the arrow wears a two-tone ring).
    var h = EB.game.playerHeading();
    g.save();
    g.translate(cx + pp.x * scale, cy + pp.z * scale);
    g.strokeStyle = "#2ec4b6"; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "#ff7a1a"; g.lineWidth = 1.5;
    g.beginPath(); g.arc(0, 0, 13.5, 0, Math.PI * 2); g.stroke();
    g.rotate(Math.PI - h);
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#1c2a4a"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 4); g.lineTo(-7, 7);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
    // v10: the compass N RIDES the ring — it rotates with the camera
    // yaw, so north is always where the camera is facing (the angle
    // math: N sits at -camYaw around the ring; verified against the
    // chase camera's behind-angle).
    var behind = (EB.game.cameraYaw ? EB.game.cameraYaw() : 0);
    var na = -behind, nR = W / 2 - 14;
    var nx = cx + Math.sin(na) * nR, ny = cy - Math.cos(na) * nR;
    g.fillStyle = "#ff4ad9";
    g.beginPath(); g.arc(nx, ny, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#ffffff";
    g.font = "bold 10px Trebuchet MS"; g.textAlign = "center";
    g.fillText("N", nx, ny + 3.5);
  }

  // v10: nearest street name for the location label ("Neon Row ·
  // Coastal Rd") — vertical and horizontal roads each have a name.
  var V_ROADS = ["Harbor Rd", "Portside Ave", "Old Market St", "Central Ave", "Neon Blvd", "Palm Heights Rd", "Coastal Rd"];
  var H_ROADS = ["Northgate Rd", "Portside Rd", "Market St", "Palm Ave", "Cinder Rd", "Beach Rd", "Sunset Blvd"];
  function roadNameAt(x, z) {
    var bestV = 0, bdV = 1e9, bestH = 0, bdH = 1e9;
    for (var i = -3; i <= 3; i++) {
      var c = i * EB.ROAD_SPACING;
      var dv = Math.abs(x - c), dh = Math.abs(z - c);
      if (dv < bdV) { bdV = dv; bestV = i + 3; }
      if (dh < bdH) { bdH = dh; bestH = i + 3; }
    }
    return bdV <= bdH ? V_ROADS[bestV] : H_ROADS[bestH];
  }

  // v10: the 1-7 WEAPON BAR (Brisa Bay shows its slots from minute
  // one) — FISTS/P9/SMG/RIFLE available, BAT/SHOTGUN/SNIPER LOCKED
  // until their respect rank. Built once, classes refreshed per frame.
  var weaponSlots = [];
  function buildWeaponBar() {
    if (!el["weapon-bar"] || weaponSlots.length) return;
    for (var i = 0; i < EB.WEAPONS.length; i++) {
      (function (idx) {
        var d = document.createElement("div");
        d.className = "wslot";
        d.innerHTML = "<b>" + (idx + 1) + "</b><span>" + EB.WEAPONS[idx].name + "</span><em>LOCKED</em>";
        d.addEventListener("click", function () { EB.combat.selectWeapon(idx); });
        el["weapon-bar"].appendChild(d);
        weaponSlots.push(d);
      })(i);
    }
  }
  function weaponUnlocked(i) {
    return EB.state.respect >= (EB.WEAPONS[i].unlockRespect || 0);
  }
  function refreshWeaponBar() {
    for (var i = 0; i < weaponSlots.length; i++) {
      var locked = !weaponUnlocked(i);
      weaponSlots[i].classList.toggle("locked", locked);
      weaponSlots[i].classList.toggle("active", EB.state.weapon === i);
    }
  }

  // v10: the PAUSE MAP — a city-map overlay with districts, the
  // player, the mission target, a legend and progression stats.
  function drawMap() {
    var c = el["map-canvas"];
    if (!c) return;
    var g = c.getContext("2d");
    var W = c.width, H = c.height, cx = W / 2, cy = H / 2;
    var scale = W / 560;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#f2e3b8";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#1fd4e0";
    g.fillRect(cx + 190 * scale, 0, W, H);
    g.strokeStyle = "#ffffff"; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx + 190 * scale, 0); g.lineTo(cx + 190 * scale, H); g.stroke();
    EB.DISTRICTS.forEach(function (d) {
      var s = d.r * 1.35 * scale;
      g.fillStyle = d.color + "2e";
      g.fillRect(cx + d.x * scale - s / 2, cy + d.z * scale - s / 2, s, s);
      g.fillStyle = "#1c2a4a";
      g.font = "900 15px Trebuchet MS"; g.textAlign = "center";
      g.fillText(d.name.toUpperCase(), cx + d.x * scale, cy + d.z * scale - 4);
      g.font = "11px Trebuchet MS";
      g.fillText(d.blurb, cx + d.x * scale, cy + d.z * scale + 12);
    });
    // v11: the pause map shows the same filled building mosaic as
    // the minimap — a dense city, not an empty grid.
    var MM2 = ["#ffe3a3", "#ffb3a7", "#7ec8e3", "#7ed957", "#2ec4b6"];
    EB.world.blocks().forEach(function (b, bi) {
      g.fillStyle = MM2[(Math.abs(Math.round(b.x) + Math.round(b.z)) + bi) % MM2.length];
      g.fillRect(cx + (b.x - b.w / 2) * scale, cy + (b.z - b.d / 2) * scale,
        Math.max(2, b.w * scale), Math.max(2, b.d * scale));
    });
    g.strokeStyle = "#1c2a4a"; g.lineWidth = 4;
    for (var i = -3; i <= 3; i++) {
      var p = cx + i * EB.ROAD_SPACING * scale;
      g.beginPath(); g.moveTo(p, 0); g.lineTo(p, H); g.stroke();
      g.beginPath(); g.moveTo(0, p); g.lineTo(W, p); g.stroke();
    }
    var t = EB.missions.target();
    if (t) {
      g.fillStyle = "#ff4ad9";
      g.strokeStyle = "#ffffff"; g.lineWidth = 2;
      var tx = cx + t.x * scale, ty = cy + t.z * scale;
      g.beginPath();
      g.moveTo(tx, ty - 11); g.lineTo(tx + 10, ty); g.lineTo(tx, ty + 11); g.lineTo(tx - 10, ty);
      g.closePath(); g.fill(); g.stroke();
    }
    var pp = EB.game.playerPos();
    g.save();
    g.translate(cx + pp.x * scale, cy + pp.z * scale);
    g.fillStyle = "#ffffff";
    g.strokeStyle = "#1c2a4a"; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = "#2ec4b6";
    g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
    g.restore();
    // Stats line.
    var done = 0;
    EB.state.missionDone.forEach(function (d) { if (d) done++; });
    var km = (EB.state.distanceDriven || 0) / 1000;
    if (el["map-stats"]) {
      el["map-stats"].textContent =
        "MISSIONS " + done + "/8   •   CARS STOLEN " + EB.state.carsStolen +
        "   •   DRIVEN " + km.toFixed(1) + " km   •   KILLS " + EB.state.kills +
        "   •   CASH " + EB.util.fmtMoney(EB.state.cash) +
        "   •   TIME " + EB.util.fmtTime(EB.state.timePlayed);
    }
  }

  return {
    init: function () {
      ["hud", "wanted", "cash", "rank", "respect-fill", "health-fill", "weapon-slot",
       "speed", "objective-title", "objective-text", "objective-progress",
       "objective-progress-fill", "objective-progress-label",
       "objective-job", "objective-stages", "objective-next",
       "weapon-bar", "location-label", "fps-pill", "carjack-prompt",
       "map-screen", "map-canvas", "map-stats",
       "minimap", "radio-name", "toast",
       "center-msg", "hint", "wheel", "garage", "start-screen", "pause-screen",
       "btn-start", "btn-continue", "eng-lv", "arm-lv", "eng-cost", "arm-cost",
       "paint-name", "garage-cash", "buy-engine", "buy-armor", "buy-paint"].forEach(function (id) { el[id] = $(id); });
      buildWeaponBar();
      el["buy-engine"].onclick = function () { EB.game.buyUpgrade("engine"); };
      el["buy-armor"].onclick = function () { EB.game.buyUpgrade("armor"); };
      el["buy-paint"].onclick = function () { EB.game.buyUpgrade("paint"); };
      el["btn-start"].onclick = function () { EB.game.startNew(); };
      el["btn-continue"].onclick = function () { EB.game.startContinue(); };
      document.querySelectorAll("#wheel .wheel-row").forEach(function (row) {
        row.addEventListener("click", function () {
          EB.combat.selectWeapon(parseInt(row.getAttribute("data-weapon"), 10));
          EB.hud.toggleWheel(true);
        });
      });
      this.refreshWanted();
      this.refreshWeapon();
      this.refreshRadio();
      if (EB.save.hasSave()) el["btn-continue"].classList.remove("hidden");
    },
    el: function (id) { return el[id]; },
    showHud: function (show) { el.hud.classList.toggle("hidden", !show); },
    showStart: function (show) { el["start-screen"].classList.toggle("hidden", !show); },
    showPause: function (show) { el["pause-screen"].classList.toggle("hidden", !show); },
    refreshWanted: function () { if (el.wanted) el.wanted.innerHTML = starRow(); },
    refreshWeapon: function () {
      if (el["weapon-slot"]) el["weapon-slot"].textContent = EB.WEAPONS[EB.state.weapon].name;
      document.querySelectorAll("#wheel .wheel-row").forEach(function (row) {
        row.classList.toggle("active", parseInt(row.getAttribute("data-weapon"), 10) === EB.state.weapon);
      });
      refreshWeaponBar();
    },
    refreshRadio: function () {
      if (el["radio-name"]) el["radio-name"].textContent = EB.RADIO_STATIONS[EB.state.radio].name;
    },
    setObjective: function (title, text) {
      if (el["objective-title"]) el["objective-title"].textContent = title.toUpperCase();
      if (el["objective-text"]) el["objective-text"].textContent = text;
      // v10: the mission card is ALWAYS visible, Brisa-Bay style — a
      // JOB x/8 pill + the title + one-line objective + a NEXT line
      // narrating the job after this one.
      if (el["objective-job"]) {
        var i = EB.state.missionIndex;
        el["objective-job"].textContent = EB.state.storyComplete
          ? "STORY COMPLETE"
          : "JOB " + (i + 1) + "/8";
      }
      if (el["objective-next"]) {
        var i2 = EB.state.missionIndex;
        el["objective-next"].textContent = EB.state.storyComplete
          ? "Free roam — Ember Bay is yours."
          : (i2 + 1 < EB.MISSIONS.length
            ? "NEXT — " + EB.MISSIONS[i2 + 1].name + ": " + EB.MISSIONS[i2 + 1].short
            : "NEXT — The Ember Crown: steal the Ember GT");
      }
    },
    showMap: function (show) {
      if (el["map-screen"]) el["map-screen"].classList.toggle("hidden", !show);
      if (show) drawMap();
    },
    toast: function (text, ms) {
      if (!el.toast) return;
      el.toast.textContent = text;
      el.toast.classList.add("show");
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.toast.classList.remove("show"); }, ms || 2600);
    },
    center: function (text, ms) {
      if (!el["center-msg"]) return;
      el["center-msg"].textContent = text;
      el["center-msg"].classList.add("show");
      if (centerTimer) clearTimeout(centerTimer);
      centerTimer = setTimeout(function () { el["center-msg"].classList.remove("show"); }, ms || 2200);
    },
    toggleWheel: function (forceClose) {
      EB.state.wheelOpen = forceClose ? false : !EB.state.wheelOpen;
      el.wheel.classList.toggle("hidden", !EB.state.wheelOpen);
      if (EB.state.wheelOpen) this.refreshWeapon();
    },
    toggleGarage: function (forceClose) {
      EB.state.garageOpen = forceClose ? false : !EB.state.garageOpen;
      el.garage.classList.toggle("hidden", !EB.state.garageOpen);
      if (EB.state.garageOpen) this.refreshGarage();
    },
    refreshGarage: function () {
      el["eng-lv"].textContent = EB.state.engineLevel;
      el["arm-lv"].textContent = EB.state.armorLevel;
      el["eng-cost"].textContent = EB.util.fmtMoney(800 * EB.state.engineLevel);
      el["arm-cost"].textContent = EB.util.fmtMoney(600 * EB.state.armorLevel);
      el["paint-name"].textContent = EB.PAINTS[EB.state.paintIndex];
      el["garage-cash"].textContent = EB.util.fmtMoney(EB.state.cash);
    },
    update: function (dt) {
      if (!EB.state.started) return;
      el.cash.textContent = EB.util.fmtMoney(EB.state.cash);
      el.rank.textContent = EB.RANKS[EB.state.rankIndex].name;
      var cur = EB.RANKS[EB.state.rankIndex];
      var next = EB.RANKS[Math.min(EB.state.rankIndex + 1, EB.RANKS.length - 1)];
      var span = Math.max(1, next.need - cur.need);
      var frac = EB.state.rankIndex >= EB.RANKS.length - 1 ? 1
        : EB.util.clamp((EB.state.respect - cur.need) / span, 0, 1);
      el["respect-fill"].style.width = Math.round(frac * 100) + "%";
      el["health-fill"].style.width = EB.util.clamp(EB.state.health, 0, 100) + "%";
      el.speed.textContent = Math.round(EB.state.speedMph);
      // v10: FPS pill — smoothed, so the player sees the game is
      // running smoothly (Brisa Bay's "Running at 60 fps" pill).
      if (el["fps-pill"] && dt > 0) {
        this._fps = this._fps ? this._fps * 0.95 + (1 / dt) * 0.05 : 1 / dt;
        el["fps-pill"].textContent = "Running at " + Math.round(this._fps) + " fps";
      }
      // v10: location label under the health bar — district + street.
      if (el["location-label"]) {
        var pp = EB.game.playerPos();
        var dist = EB.util.districtAt(pp.x, pp.z);
        el["location-label"].textContent = dist.name + " · " + roadNameAt(pp.x, pp.z);
      }
      // v10: carjack prompt — a clear E/F prompt whenever a stealable
      // car is in range on foot (the key you see is the key that works).
      if (el["carjack-prompt"]) {
        var showPrompt = false, promptText = "";
        if (!EB.state.inCar && !EB.state.paused && !EB.state.garageOpen && !EB.state.wheelOpen && !EB.state.mapOpen) {
          var p2 = EB.game.playerPos();
          var near = EB.vehicles.nearestCar(p2.x, p2.z, 8.5);
          if (near) {
            showPrompt = true;
            promptText = near.isTraffic ? "E — GET IN   •   F — CARJACK" : "E — GET IN";
          }
        }
        el["carjack-prompt"].classList.toggle("hidden", !showPrompt);
        if (showPrompt) el["carjack-prompt"].textContent = promptText;
      }
      refreshWeaponBar();
      if (EB.state.mapOpen) drawMap();
      // v9: mission stage progress bar — shown when the active mission
      // has stages (gates, crates, drops, escape timer), hidden otherwise.
      var prog = EB.missions && EB.missions.progress ? EB.missions.progress() : null;
      if (prog && el["objective-progress"]) {
        el["objective-progress"].classList.remove("hidden");
        el["objective-progress-fill"].style.width =
          Math.round(EB.util.clamp(prog.done / Math.max(1, prog.total), 0, 1) * 100) + "%";
        el["objective-progress-label"].textContent = prog.label;
      } else if (el["objective-progress"]) {
        el["objective-progress"].classList.add("hidden");
      }
      // v10: segmented stage blocks (one per stage, filled as done) —
      // the same progress as the bar, readable at a glance.
      if (el["objective-stages"]) {
        var key = prog ? prog.done + "/" + prog.total : "";
        if (this._stageKey !== key) {
          this._stageKey = key;
          var html = "";
          if (prog) {
            for (var s = 0; s < prog.total; s++) {
              html += '<span class="seg' + (s < prog.done ? " done" : "") + '"></span>';
            }
          }
          el["objective-stages"].innerHTML = html;
        }
      }
      drawMinimap();
    },
  };
})();
