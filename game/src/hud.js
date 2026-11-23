// hud.js — HUD, mission card, weapon bar, toast, prompt, and a canvas
// minimap drawn as a real little city map (streets + blocks + water +
// beach + district colors + pink objective line + player arrow).
import { CFG } from "./config.js";

export class HUD {
  constructor(state) {
    this.state = state;
    this.mapCanvas = document.getElementById("minimap");
    this.mapCtx = this.mapCanvas.getContext("2d");
    this.bigCanvas = document.getElementById("bigmap");
    this.bigCtx = this.bigCanvas ? this.bigCanvas.getContext("2d") : null;
    this.lastObj = null;
    this.staticMap = null; // offscreen: streets + blocks + water + beach, drawn once
    this.staticBig = null;
  }

  // Pre-render the static city map once (streets, blocks, water, beach,
  // districts, volcano). Per-frame we only draw the player arrow +
  // objective line on top of it.
  buildStaticMap(size) {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    const W = size, H = size;
    const scale = W / 560;
    const px = (x) => W / 2 + x * scale;
    const py = (z) => H / 2 + z * scale;
    ctx.fillStyle = "#2fb5a8"; ctx.fillRect(px(CFG.seaX), 0, W - px(CFG.seaX), H);
    ctx.fillStyle = "#e8cf9a"; ctx.fillRect(px(CFG.beachX), 0, px(CFG.seaX) - px(CFG.beachX), H);
    // dark land base so the street grid pops (top 1-2 minimaps are dark
    // with bright streets, not a bright green mosaic)
    ctx.fillStyle = "#33523f"; ctx.fillRect(0, 0, px(CFG.beachX), H);
    for (const d of CFG.districts) {
      ctx.fillStyle = "#" + d.base.toString(16).padStart(6, "0");
      ctx.globalAlpha = 0.7;
      ctx.fillRect(px(d.cx - d.w / 2), py(d.cz - d.d / 2), d.w * scale, d.d * scale);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = "#d8d8c8"; ctx.lineWidth = Math.max(1.5, size / 90);
    for (let i = -5; i <= 5; i++) {
      const r = i * CFG.roadSpacing;
      ctx.beginPath(); ctx.moveTo(px(r), 0); ctx.lineTo(px(r), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, py(r)); ctx.lineTo(W, py(r)); ctx.stroke();
    }
    ctx.fillStyle = "#6b3a26";
    ctx.beginPath(); ctx.arc(px(CFG.volcano.x), py(CFG.volcano.z), Math.max(4, size / 22), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff5a1e";
    ctx.beginPath(); ctx.arc(px(CFG.volcano.x), py(CFG.volcano.z), Math.max(2, size / 45), 0, Math.PI * 2); ctx.fill();
    return c;
  }

  rankName() {
    let name = CFG.ranks[0].name;
    for (const r of CFG.ranks) if (this.state.respect >= r.at) name = r.name;
    return name;
  }

  districtName(x, z) {
    for (const d of CFG.districts) if (Math.abs(x - d.cx) < d.w / 2 && Math.abs(z - d.cz) < d.d / 2) return d.name;
    if (x > CFG.beachX) return "Sunset Beach";
    return "Ember Bay";
  }

  setText(id, txt) { const el = document.getElementById(id); if (el && el.textContent !== txt) el.textContent = txt; }
  show(id, on) { const el = document.getElementById(id); if (el) el.classList.toggle("hidden", !on); }

  update() {
    const s = this.state;
    this.setText("cash", "$" + s.cash);
    this.setText("rank", this.rankName());
    this.setText("loc", `${this.districtName(s.playerX, s.playerZ)} · ${s.streetName || "Coastal Rd"}`);
    this.setText("speed", Math.round(Math.abs(s.speed) * 2.2) + "");
    this.setText("hp-fill", "");
    const hp = document.getElementById("hp-fill");
    if (hp) hp.style.width = s.hp + "%";
    // stars
    const stars = document.getElementById("stars");
    if (stars) stars.textContent = "★".repeat(s.wanted) + "☆".repeat(5 - s.wanted);
    // weapon bar
    const bar = document.getElementById("weapons");
    if (bar) {
      bar.innerHTML = CFG.weapons.map((w, i) => {
        const locked = s.respect < w.lock;
        const cur = i === s.weaponIdx;
        return `<div class="wpn${cur ? " cur" : ""}${locked ? " locked" : ""}"><b>${w.key}</b><span>${w.name}</span>${locked ? "<i>LOCKED</i>" : ""}</div>`;
      }).join("");
    }
    // mission card
    const m = CFG.missions[Math.min(s.mission, 8) - 1];
    this.setText("job-num", `JOB ${Math.min(s.mission, 8)}/8`);
    this.setText("job-title", m.title);
    this.setText("job-obj", m.obj);
    this.setText("job-next", "NEXT — " + m.next);
    const segs = document.getElementById("job-segs");
    if (segs) segs.innerHTML = Array.from({ length: 4 }, (_, i) => `<span class="${i < (s.raceIdx || 0) ? "on" : ""}"></span>`).join("");
    this.setText("job-stage", s.mission === 3 ? `GATE ${s.raceIdx || 0}/4` : s.mission === 5 ? `ESCAPE ${Math.ceil(s.escapeLeft || 0)}s` : (s.mission === 4 || s.mission === 7) ? `CRATE ${s.cratesGot || 0}/3` : "");
    // toast
    if (s.toast) {
      this.setText("toast", s.toast);
      this.show("toast", true);
      s.toastTimer = (s.toastTimer || 0) + 1;
      if (s.toastTimer > 240) { s.toast = ""; s.toastTimer = 0; this.show("toast", false); }
    }
    this.drawMinimap();
  }

  // draw the minimap: static city map + live objective line + player arrow
  drawMinimap() {
    const s = this.state;
    const ctx = this.mapCtx;
    if (!ctx) return;
    if (!this.staticMap) this.staticMap = this.buildStaticMap(this.mapCanvas.width);
    const W = this.mapCanvas.width, H = this.mapCanvas.height;
    const scale = W / 560;
    const px = (x) => W / 2 + x * scale;
    const py = (z) => H / 2 + z * scale;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.staticMap, 0, 0);
    // objective: pink dashed line + diamond
    const o = this.state.objective;
    if (o) {
      ctx.strokeStyle = "#ff2ea6"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(px(s.playerX), py(s.playerZ)); ctx.lineTo(px(o.x), py(o.z)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ff2ea6";
      ctx.save(); ctx.translate(px(o.x), py(o.z)); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-4, -4, 8, 8); ctx.restore();
    }
    // player arrow (rotates with heading)
    ctx.save();
    ctx.translate(px(s.playerX), py(s.playerZ));
    ctx.rotate(s.heading || 0);
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#1c2733"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#1c2733"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center";
    ctx.fillText("N", W - 12, 14);
  }

  drawBigMap() {
    if (!this.bigCtx) return;
    if (!this.staticBig) this.staticBig = this.buildStaticMap(this.bigCanvas.width);
    const ctx = this.bigCtx;
    const W = this.bigCanvas.width, H = this.bigCanvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(this.staticBig, 0, 0);
    const scale = W / 560;
    const px = (x) => W / 2 + x * scale;
    const py = (z) => H / 2 + z * scale;
    const s = this.state;
    const o = s.objective;
    if (o) {
      ctx.strokeStyle = "#ff2ea6"; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(px(s.playerX), py(s.playerZ)); ctx.lineTo(px(o.x), py(o.z)); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ff2ea6";
      ctx.save(); ctx.translate(px(o.x), py(o.z)); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10); ctx.restore();
    }
    ctx.save();
    ctx.translate(px(s.playerX), py(s.playerZ));
    ctx.rotate(s.heading || 0);
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#1c2733"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#1c2733"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
    for (const d of CFG.districts) ctx.fillText(d.name, W / 2 + d.cx * scale, H / 2 + d.cz * scale);
    ctx.font = "bold 15px Arial"; ctx.fillText("EMBER BAY", W / 2, 22);
  }
}
