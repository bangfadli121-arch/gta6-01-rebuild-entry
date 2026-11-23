// EMBER BAY HUD + maps — round 5, written from zero.
// Minimap is a readable little city map (streets + blocks + water + objective
// line), NOT a mosaic of squares — like the top entries. Pause map is the full
// island with district labels.
import { GRID, WEAPONS, RANKS, rankFor, districtAt } from "./config.js";

const MAP_HALF = 230; // world extent drawn on the map
function toMap(x, z, size) {
  const s = size / (MAP_HALF * 2);
  return [(x + MAP_HALF) * s, (z + MAP_HALF) * s];
}
function drawBaseMap(ctx, size, labels) {
  ctx.clearRect(0, 0, size, size);
  // land
  ctx.fillStyle = "#e8e2d2"; ctx.fillRect(0, 0, size, size);
  // sea (east) + beach strip
  const [bx] = toMap(200, 0, size);
  ctx.fillStyle = "#2fa8a0"; ctx.fillRect(bx, 0, size - bx, size);
  ctx.fillStyle = "#e8cf9e"; ctx.fillRect(bx - 3, 0, 5, size);
  // blocks
  ctx.fillStyle = "#c9c2ae";
  for (let i = 0; i < GRID.streets.length - 1; i++) {
    for (let j = 0; j < GRID.streets.length - 1; j++) {
      const [x0, z0] = toMap(GRID.streets[i] + 9, GRID.streets[j] + 9, size);
      const [x1, z1] = toMap(GRID.streets[i + 1] - 9, GRID.streets[j + 1] - 9, size);
      ctx.fillRect(x0, z0, x1 - x0, z1 - z0);
    }
  }
  // streets
  ctx.strokeStyle = "#3a3f47"; ctx.lineWidth = Math.max(1, size / 160);
  for (const s of GRID.streets) {
    const [x] = toMap(s, 0, size); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    const [, z] = toMap(0, s, size); ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(size, z); ctx.stroke();
  }
  // volcano
  const [vx, vz] = toMap(-300, -300, size);
  ctx.fillStyle = "#4a2c22";
  ctx.beginPath(); ctx.moveTo(vx - 9, vz + 7); ctx.lineTo(vx, vz - 9); ctx.lineTo(vx + 9, vz + 7); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ff5a1e";
  ctx.beginPath(); ctx.moveTo(vx - 3, vz - 3); ctx.lineTo(vx, vz - 9); ctx.lineTo(vx + 3, vz - 3); ctx.closePath(); ctx.fill();
  if (labels) {
    ctx.fillStyle = "#2c2c34"; ctx.font = `bold ${Math.max(9, size / 22)}px Arial`;
    ctx.textAlign = "center";
    const spots = [[-150, 0, "PORTSIDE"], [-60, -110, "OLD MARKET"], [0, 40, "NEON ROW"],
      [0, 150, "PALM HEIGHTS"], [-150, 150, "CINDER DOCKS"], [150, 0, "SUNSET BEACH"]];
    for (const [x, z, name] of spots) {
      const [mx, mz] = toMap(x, z, size);
      ctx.fillText(name, mx, mz);
    }
  }
}

export function makeHud() {
  const $ = id => document.getElementById(id);
  const mini = $("minimap"); const mctx = mini.getContext("2d");
  const big = $("pausemap"); const bctx = big ? big.getContext("2d") : null;
  let fps = 0, fpsCount = 0, fpsT0 = performance.now();
  return {
    update(dt, state, missionInfo, target, playerHeading) {
      fpsCount++;
      const now = performance.now();
      if (now - fpsT0 >= 500) { fps = Math.round(fpsCount * 1000 / (now - fpsT0)); fpsCount = 0; fpsT0 = now; }
      $("cash").textContent = "$" + state.cash.toLocaleString("en-US");
      $("rank").textContent = rankFor(state.respect);
      $("hpbar").style.width = Math.max(0, state.hp) + "%";
      $("weapon").textContent = WEAPONS[state.weapon - 1].name;
      $("stars").textContent = "★".repeat(state.wanted) + "☆".repeat(5 - state.wanted);
      $("loc").textContent = `${districtAt(state.playerX, state.playerZ).name} · ${state.streetName || "Coastal Rd"}`;
      $("radio").textContent = (state.radioOn ? state.stationName : "RADIO OFF") + " [R]";
      $("speed").textContent = Math.round(Math.abs(state.speed) * 2.4);
      // weapon bar
      document.querySelectorAll("#weapons .wslot").forEach((el, i) => {
        const w = WEAPONS[i];
        el.classList.toggle("active", i === state.weapon - 1);
        el.querySelector(".wlock").textContent = state.respect >= w.lock ? w.name : w.name + " LOCKED";
      });
      // mission card
      $("job").textContent = `JOB ${state.mission}/8`;
      $("mtitle").textContent = missionInfo.title;
      $("mobj").textContent = missionInfo.obj;
      $("mstage").textContent = missionInfo.stage;
      $("mnext").textContent = "NEXT — " + missionInfo.next;
      // minimap: street map + player arrow + objective line
      const size = mini.width;
      drawBaseMap(mctx, size, false);
      if (target) {
        const [tx, tz] = toMap(target.x, target.z, size);
        const [px, pz] = toMap(state.playerX, state.playerZ, size);
        mctx.strokeStyle = "#ff2e88"; mctx.lineWidth = 2; mctx.setLineDash([5, 4]);
        mctx.beginPath(); mctx.moveTo(px, pz); mctx.lineTo(tx, tz); mctx.stroke();
        mctx.setLineDash([]);
        mctx.fillStyle = "#ff2e88";
        mctx.beginPath(); mctx.moveTo(tx, tz - 6); mctx.lineTo(tx + 5, tz); mctx.lineTo(tx, tz + 6); mctx.lineTo(tx - 5, tz); mctx.closePath(); mctx.fill();
      }
      const [px, pz] = toMap(state.playerX, state.playerZ, size);
      mctx.save(); mctx.translate(px, pz); mctx.rotate(Math.atan2(Math.sin(playerHeading), Math.cos(playerHeading)) * 0 + playerHeading);
      mctx.fillStyle = "#ffffff"; mctx.strokeStyle = "#1c1c28"; mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 6); mctx.lineTo(0, 3); mctx.lineTo(-5, 6); mctx.closePath(); mctx.fill(); mctx.stroke();
      mctx.restore();
      // compass
      $("compass").textContent = "N";
      // pause map (full island, labels)
      if (bctx && !$("pause").classList.contains("hidden")) {
        drawBaseMap(bctx, big.width, true);
        const [ppx, ppz] = toMap(state.playerX, state.playerZ, big.width);
        bctx.fillStyle = "#ff2e88";
        bctx.beginPath(); bctx.arc(ppx, ppz, 7, 0, 7); bctx.fill();
        bctx.strokeStyle = "#fff"; bctx.lineWidth = 2; bctx.beginPath(); bctx.arc(ppx, ppz, 7, 0, 7); bctx.stroke();
      }
    },
    toast(msg) {
      const el = $("toast"); el.textContent = msg; el.classList.remove("hidden");
      clearTimeout(el._t); el._t = setTimeout(() => el.classList.add("hidden"), 2600);
    },
  };
}
