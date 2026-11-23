// Ember Bay — the HUD: money, rank, health, weapon slots, wanted
// stars, mission panel, radio, speed and the round minimap.
(function () {
  var EB = window.EB || (window.EB = {});
  var els = {};
  var lastDraw = 0;

  function el(id) { return document.getElementById(id); }

  EB.hud = {
    build: function () {
      els.money = el('hud-money'); els.rank = el('hud-rank');
      els.respect = el('hud-respect'); els.hp = el('hud-hp');
      els.hpBar = el('hud-hpbar'); els.stars = el('hud-stars');
      els.mission = el('hud-mission'); els.objective = el('hud-objective');
      els.weapons = el('hud-weapons'); els.speed = el('hud-speed');
      els.radio = el('hud-radio'); els.message = el('hud-message');
      els.map = el('hud-minimap'); els.crosshair = el('hud-crosshair');
      var ctx = els.map ? els.map.getContext('2d') : null;
      this.mapCtx = ctx;
      this.buildWeaponSlots();
    },

    buildWeaponSlots: function () {
      if (!els.weapons) return;
      els.weapons.innerHTML = '';
      for (var i = 0; i < EB.CONFIG.weapons.length; i++) {
        var d = document.createElement('div');
        d.className = 'wslot'; d.id = 'wslot-' + i;
        d.innerHTML = '<b>' + (i + 1) + '</b><span>' + EB.CONFIG.weapons[i].name + '</span>';
        els.weapons.appendChild(d);
      }
    },

    update: function () {
      var s = EB.state;
      if (els.money) els.money.textContent = '$' + s.money.toLocaleString('en-US');
      if (els.rank) els.rank.textContent = EB.rankName();
      if (els.respect) els.respect.textContent = 'RESPECT ' + s.respect;
      if (els.hp) els.hp.textContent = 'HP ' + Math.max(0, Math.round(s.hp));
      if (els.hpBar) els.hpBar.style.width = Math.max(0, s.hp) + '%';
      if (els.stars) {
        var stars = '';
        for (var i = 0; i < 5; i++) stars += i < s.wanted ? '\u2605' : '\u2606';
        els.stars.textContent = stars;
        els.stars.className = s.wanted > 0 ? 'wanted-hot' : '';
      }
      var m = EB.missions ? EB.missions.current() : null;
      if (els.mission) els.mission.textContent = m ? ('MISSION ' + m.id + '/8 — ' + m.name) : 'FREE ROAM';
      if (els.objective) els.objective.textContent = s.objective || '';
      if (els.speed) els.speed.textContent = s.inCar ? Math.round(s.speedMph) + ' mph' : 'ON FOOT';
      if (els.radio) els.radio.textContent = s.radioOn ? EB.CONFIG.radio[s.radioIndex].name : 'RADIO OFF';
      if (els.crosshair) els.crosshair.style.display = s.inCar ? 'none' : 'block';
      if (els.message) {
        els.message.textContent = s.message || '';
        els.message.style.opacity = (s.time - (s.messageAt || 0) < 5) ? '1' : '0';
      }
      for (var i = 0; i < EB.CONFIG.weapons.length; i++) {
        var slot = document.getElementById('wslot-' + i);
        if (slot) slot.classList.toggle('active', i === s.weaponIndex);
      }
    },

    drawMinimap: function () {
      var ctx = this.mapCtx;
      if (!ctx || EB.state.time - lastDraw < 0.12) return;
      lastDraw = EB.state.time;
      var S = 180, R = S / 2;
      ctx.clearRect(0, 0, S, S);
      ctx.save();
      ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, S, S);
      // sea + beach (south = bottom)
      ctx.fillStyle = '#1b8a8a'; ctx.fillRect(0, S - 26, S, 26);
      ctx.fillStyle = '#e8c98a'; ctx.fillRect(0, S - 34, S, 8);
      // volcano (north = top)
      ctx.fillStyle = '#3a3444'; ctx.beginPath(); ctx.arc(R, 4, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff5a00'; ctx.beginPath(); ctx.arc(R, 4, 4, 0, Math.PI * 2); ctx.fill();
      // city blocks
      var blocks = EB.world.blocks || [];
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        var mx = ((b.x + 150) / 300) * S, mz = ((b.z + 160) / 300) * S;
        ctx.fillStyle = b.color || '#888';
        ctx.fillRect(mx - 2.5, mz - 2.5, 5, 5);
      }
      // mission marker
      var t = EB.missions ? EB.missions.stepTarget() : null;
      if (t) {
        var tx = ((t.x + 150) / 300) * S, tz = ((t.z + 160) / 300) * S;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(tx, tz - 7); ctx.lineTo(tx + 6, tz); ctx.lineTo(tx, tz + 7); ctx.lineTo(tx - 6, tz); ctx.closePath(); ctx.fill();
      }
      // police dots
      ctx.fillStyle = '#4da6ff';
      for (var j = 0; j < EB.vehicles.police.length; j++) {
        var p = EB.vehicles.police[j];
        ctx.fillRect(((p.x + 150) / 300) * S - 2, ((p.z + 160) / 300) * S - 2, 4, 4);
      }
      // player arrow
      var px = ((EB.playerPos.x + 150) / 300) * S, pz = ((EB.playerPos.z + 160) / 300) * S;
      ctx.save();
      ctx.translate(px, pz); ctx.rotate(EB.playerPos.heading || 0);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(R, R, R - 2, 0, Math.PI * 2); ctx.stroke();
    }
  };
})();
