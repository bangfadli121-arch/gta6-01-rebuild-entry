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

  // Pre-render the static city map once (streets, blocks, water, beach).
  // Top 1-2 style: NEAR-BLACK land, dark sea + dark sand, BRIGHT street
  // lines, white player arrow, colored icons. NO pastel district blocks —
  // those made the old map a colorful mosaic with a grid (fadli: "map nya
  // bisa ga di gnti kyk top 1-2").
  buildStaticMap(size) {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    const W = size, H = size;
    const scale = W / 560;
    const px = (x) => W / 2 + x * scale;
    const py = (z) => H / 2 + z * scale;
    // near-black land base
    ctx.fillStyle = "#10151a"; ctx.fillRect(0, 0, W, H);
    // dark sea + dark sand on the east edge (kept dark so streets pop)
    ctx.fillStyle = "#0d3f45"; ctx.fillRect(px(CFG.seaX), 0, W - px(CFG.seaX), H);
    ctx.fillStyle = "#54452a"; ctx.fillRect(px(CFG.beachX), 0, px(CFG.seaX) - px(CFG.beachX), H);
    // bright street grid — clipped to the land (roads do not run into the sea)
    ctx.strokeStyle = "#e8e8d8"; ctx.lineWidth = Math.max(2.5, size / 55);
    ctx.lineCap = "round";
    for (let i = -5; i <= 5; i++) {
      const r = i * CFG.roadSpacing;
      if (r < CFG.beachX) { ctx.beginPath(); ctx.moveTo(px(r), 0); ctx.lineTo(px(r), H); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, py(r)); ctx.lineTo(px(CFG.beachX), py(r)); ctx.stroke();
    }
    // coastal road (the main drag) in gold so it reads as the spine
    ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = Math.max(2, size / 70);
    ctx.beginPath(); ctx.moveTo(px(168), 0); ctx.lineTo(px(168), H); ctx.stroke();
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
    // race checkpoints (mission 3): yellow diamonds, the NEXT one bigger
    const gates = this.state.raceGates;
    if (gates && gates.length && s.mission === 3) {
      gates.forEach((g, i) => {
        const next = i === (s.raceIdx || 0);
        ctx.fillStyle = next ? "#ffd76a" : "#2ec4b6";
        const sz = next ? 5 : 3.5;
        ctx.save(); ctx.translate(px(g.x), py(g.z)); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-sz, -sz, sz * 2, sz * 2); ctx.restore();
      });
    }
    // police: blue dots with a white ring (patrol + chase cars)
    for (const p of (s.policePos || [])) {
      ctx.fillStyle = "#2050ff"; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px(p.x), py(p.z), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // helicopter: white dot with a dark ring
    if (s.heliPos) {
      ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#1c2733"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px(s.heliPos.x), py(s.heliPos.z), 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // player arrow (rotates with heading)
    ctx.save();
    ctx.translate(px(s.playerX), py(s.playerZ));
    ctx.rotate(s.heading || 0);
    ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#1c2733"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6, 7); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
    // compass N: dark badge with gold ring + white letter, INSIDE the
    // round clip (the old text sat at the corner and was clipped away)
    ctx.fillStyle = "#10151a"; ctx.strokeStyle = "#ffd76a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(W - 32, 32, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("N", W - 32, 32.5);
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
    // district names + title in LIGHT text (the map is dark now — the old
    // dark text was invisible on it)
    ctx.fillStyle = "#e8e8d8"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center";
    for (const d of CFG.districts) ctx.fillText(d.name, W / 2 + d.cx * scale, H / 2 + d.cz * scale);
    ctx.font = "bold 15px Arial"; ctx.fillText("EMBER BAY", W / 2, 22);
  }
}
