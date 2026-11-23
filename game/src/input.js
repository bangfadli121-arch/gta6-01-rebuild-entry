// EMBER BAY input — round 5, written from zero.
export function makeInput() {
  const keys = {};
  const pressed = new Set();
  window.addEventListener("keydown", e => {
    if (!keys[e.code]) pressed.add(e.code);
    keys[e.code] = true;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", e => { keys[e.code] = false; });
  return {
    get forward() { return keys.KeyW || keys.ArrowUp; },
    get back() { return keys.KeyS || keys.ArrowDown; },
    get left() { return keys.KeyA || keys.ArrowLeft; },
    get right() { return keys.KeyD || keys.ArrowRight; },
    get run() { return keys.ShiftLeft || keys.ShiftRight; },
    wasPressed(code) { const hit = pressed.has(code); if (hit) pressed.delete(code); return hit; },
    clearPressed() { pressed.clear(); },
  };
}
