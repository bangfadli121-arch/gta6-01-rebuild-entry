// EMBER BAY — hud: every DOM panel (cash, rank, HP, stars, weapon bar,
// mission card, minimap, speed, prompts) plus the overlays: start screen,
// pause map, weapon wheel, garage, busted, toast.
(function () {
  var EB = window.EB || (window.EB = {});
  var C = EB.config;
  var el = {};
  var lastWeapon = -1, lastRespect = -1, lastWanted = -1, lastMission = -1, lastSeg = "";
  var fpsAcc = 0, fpsN = 0, fpsShown = 60, fpsTimer = 0;
  var toastTimer = null;

  function $(id) { return document.getElementById(id); }

  function rankFor(respect) {
    var r = C.RANKS[0];
    for (var i = 0; i < C.RANKS.length; i++) if (respect >= C.RANKS[i].at) r = C.RANKS[i];
    var next = null;
    for (var j = 0; j < C.RANKS.length; j++) if (C.RANKS[j].at > respect) { next = C.RANKS[j]; break; }
    var frac = next ? (respect - r.at) / (next.at - r.at) : 1;
    return { name: r.name, frac: Math.max(0, Math.min(1, frac)) };
  }

  function buildWeaponBar() {
    var bar = $("weapon-bar");
    bar.innerHTML = "";
    C.WEAPONS.forEach(function (w, i) {
      var d = document.createElement("div");
      d.className = "wslot"; d.id = "wslot-" + i;
      d.innerHTML = '<span class="num">' + (i + 1) + '</span><div class="nm">' + w.short + '</div>' + (w.unlock > 0 ? '<div class="lk">LOCKED</div>' : "");
      bar.appendChild(d);
    });
  }

  function buildWheel() {
    var w = $("wheel");
    w.innerHTML = "";
    C.WEAPONS.forEach(function (wp, i) {
      var d = document.createElement("div");
      d.className = "wheel-card"; d.id = "wheel-" + i;
      d.innerHTML = '<div class="num">' + (i + 1) + '</div><div class="nm">' + wp.name + '</div><div class="ds">' + wp.desc + (wp.unlock > 0 ? "<br>Unlocks at respect " + wp.unlock : "") + "</div>";
      w.appendChild(d);
    });
  }

  function buildGarage() {
    var rows = $("garage-rows");
    rows.innerHTML = "";
    C.GARAGE.forEach(function (g) {
      var row = document.createElement("div");
      row.className = "g-row";
      row.innerHTML = '<div class="g-name">' + g.name + '</div><div class="g-pips" id="pips-' + g.id + '">' +
        '<div class="pip"></div><div class="pip"></div><div class="pip"></div></div>' +
        '<button class="g-btn" id="buy-' + g.id + '">BUY</button>';
      rows.appendChild(row);
      $("buy-" + g.id).addEventListener("click", function () { EB.game.buyUpgrade(g.id); });
    });
  }

  function refreshGarage() {
    var s = EB.state;
    C.GARAGE.forEach(function (g) {
      var lvl = s.upgrades[g.id] || 0;
      var pips = document.querySelectorAll("#pips-" + g.id + " .pip");
      pips.forEach(function (p, i) { p.classList.toggle("on", i < lvl); });
      var btn = $("buy-" + g.id);
      if (lvl >= 3) { btn.textContent = "MAX"; btn.disabled = true; }
      else { btn.textContent = "BUY $" + g.cost[lvl]; btn.disabled = s.cash < g.cost[lvl]; }
    });
    $("garage-cash").textContent = "Cash: $" + s.cash;
  }

  function refreshWheel() {
    var s = EB.state;
    C.WEAPONS.forEach(function (w, i) {
      var card = $("wheel-" + i);
      card.classList.toggle("active", s.weapon === i);
      card.classList.toggle("locked", s.respect < w.unlock);
    });
  }

  function refreshWeaponBar() {
    var s = EB.state;
    C.WEAPONS.forEach(function (w, i) {
      var slot = $("wslot-" + i);
      if (!slot) return;
      slot.classList.toggle("active", s.weapon === i);
      var locked = s.respect < w.unlock;
      slot.classList.toggle("locked", locked);
      var lk = slot.querySelector(".lk");
      if (lk) lk.textContent = locked ? "LOCKED" : "R" + w.unlock;
    });
  }

  function refreshStars() {
    var w = EB.combat.wanted();
    var html = "";
    for (var i = 0; i < 5; i++) html += '<span class="' + (i < w ? "lit" : "dim") + '">★</span>';
    $("stars").innerHTML = html;
  }

  function updateMissionCard() {
    var s = EB.state;
    var m = EB.missions;
    var d = m.def();
    var idx = m.storyDone() ? 8 : m.index() + 1;
    $("job-label").textContent = "JOB " + Math.min(idx, 8) + "/8";
    $("mission-title").textContent = m.storyDone() ? "EMBER KING" : d.title;
    $("mission-objective").textContent = m.storyDone() ? "Story complete — Ember Bay is yours." : d.objective;
    var p = m.progress();
    var segKey = p.segments + ":" + p.done;
    if (segKey !== lastSeg) {
      lastSeg = segKey;
      var segs = $("mission-segments");
      segs.innerHTML = "";
      for (var i = 0; i < p.segments; i++) {
        var sg = document.createElement("div");
        sg.className = "seg" + (i < p.done ? " done" : "");
        segs.appendChild(sg);
      }
    }
    $("mission-fill").style.width = Math.round(p.bar * 100) + "%";
    $("mission-progress-label").textContent = p.label;
    $("mission-next").textContent = m.storyDone() ? "" : ("NEXT — " + C.NEXT_TEXT[Math.min(m.index(), 7)]);
  }

  function showToast(text) {
    var t = $("toast");
    t.textContent = text;
    t.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.add("hidden"); }, 2600);
  }

  function update(dt) {
    var s = EB.state;
    if (!s) return;
    // fps
    fpsAcc += dt; fpsN++;
    fpsTimer += dt;
    if (fpsTimer > 0.5) {
      fpsShown = Math.round(fpsN / Math.max(fpsAcc, 0.001));
      fpsAcc = 0; fpsN = 0; fpsTimer = 0;
      $("fps-pill").textContent = "Running at " + fpsShown + " fps";
    }
    $("cash").textContent = "$" + s.cash;
    var r = rankFor(s.respect);
    $("rank-name").textContent = r.name;
    $("rank-fill").style.width = Math.round(r.frac * 100) + "%";
    $("hp-fill").style.width = Math.max(0, s.hp) + "%";
    $("weapon-name").textContent = C.WEAPONS[s.weapon].name;
    var pp = EB.game.playerPos();
    $("location").textContent = EB.world.districtAt(pp.x, pp.z) + " · " + EB.world.streetAt(pp.x, pp.z);
    $("speed").innerHTML = Math.round(EB.game.speedMph()) + " <small>mph</small>";
    $("radio-name").textContent = s.radioLabel + " [R]";
    if (s.weapon !== lastWeapon || s.respect !== lastRespect) { refreshWeaponBar(); lastWeapon = s.weapon; lastRespect = s.respect; }
    var w = EB.combat.wanted();
    if (w !== lastWanted) { refreshStars(); lastWanted = w; }
    if (EB.missions.index() !== lastMission || s.missionDirty) { updateMissionCard(); lastMission = EB.missions.index(); s.missionDirty = false; }
    else updateMissionCard();
    // carjack prompt
    var pr = $("carjack-prompt");
    if (s.nearCar && !s.inCar && s.started) { pr.classList.remove("hidden"); pr.textContent = s.nearCarKind === "gt" ? "E — STEAL THE EMBER GT" : "E — GET IN"; }
    else pr.classList.add("hidden");
    // minimap
    var mm = $("minimap").getContext("2d");
    var tgt = EB.missions.currentTarget();
    EB.world.drawMinimap(mm, 170, pp.x, pp.z, pp.heading, tgt, false);
    if (s.mapOpen) {
      var bm = $("bigmap").getContext("2d");
      EB.world.drawMinimap(bm, 640, pp.x, pp.z, pp.heading, tgt, true);
      var ms = EB.missions;
      $("map-stats").innerHTML = "<b>" + r.name + "</b> · $" + s.cash + " · Respect " + s.respect +
        " · Wanted " + "★".repeat(w) + "☆".repeat(5 - w) +
        "<br>Job " + (ms.storyDone() ? "8" : ms.index() + 1) + "/8 — " + (ms.storyDone() ? "EMBER KING" : ms.def().title) +
        "<br>Garage: Engine " + (s.upgrades.engine || 0) + " · Armor " + (s.upgrades.armor || 0) + " · Paint " + (s.upgrades.paint || 0);
    }
  }

  function build() {
    el = {};
    buildWeaponBar(); buildWheel(); buildGarage();
    refreshStars();
    $("btn-start").addEventListener("click", function () { EB.game.startGame(false); });
    $("btn-continue").addEventListener("click", function () { EB.game.startGame(true); });
  }

  EB.hud = {
    build: build, update: update, showToast: showToast, refreshGarage: refreshGarage, refreshWheel: refreshWheel,
    refreshWeaponBar: refreshWeaponBar,
    showBusted: function (v) { $("busted").classList.toggle("hidden", !v); },
    setMapOpen: function (v) { $("map-overlay").classList.toggle("hidden", !v); },
    setWheelOpen: function (v) { $("wheel-overlay").classList.toggle("hidden", !v); },
    setGarageOpen: function (v) { $("garage-overlay").classList.toggle("hidden", !v); if (v) refreshGarage(); },
    setStartVisible: function (v) { $("start-screen").classList.toggle("hidden", !v); },
    setContinueVisible: function (v, label) { $("btn-continue").classList.toggle("hidden", !v); if (label) $("continue-label").textContent = label; }
  };
})();
