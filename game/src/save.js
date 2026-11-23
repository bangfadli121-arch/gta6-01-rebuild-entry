// save.js — localStorage save/load.
import { CFG } from "./config.js";

export function saveGame(state) {
  try {
    const data = { cash: state.cash, respect: state.respect, mission: state.mission, weaponIdx: state.weaponIdx, x: state.playerX, z: state.playerZ, at: Date.now() };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const d = JSON.parse(raw);
    // reject a corrupt/partial save instead of crashing on missing fields
    if (!d || typeof d.cash !== "number" || typeof d.mission !== "number" || typeof d.x !== "number" || typeof d.z !== "number") return null;
    return d;
  } catch { return null; }
}

export function hasSave() { return !!loadGame(); }
