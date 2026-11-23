// EMBER BAY saves — round 5, written from zero.
const KEY = "emberbay-save-v5";
export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash, respect: state.respect, mission: state.mission,
      x: state.playerX, z: state.playerZ, hp: state.hp, ts: Date.now(),
    }));
    return true;
  } catch { return false; }
}
export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function hasSave() { return !!loadGame(); }
