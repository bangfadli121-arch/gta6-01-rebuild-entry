// input.js — keyboard state + edge-triggered key taps.
export class Input {
  constructor() {
    this.keys = {};
    this.pressed = {};
    this.onKey = null;
    window.addEventListener("keydown", (e) => {
      if (!this.keys[e.code]) this.pressed[e.code] = true;
      this.keys[e.code] = true;
      // onKey fires on the initial press only — holding a key must not spam
      // the handler with auto-repeat keydown events
      if (!e.repeat && this.onKey) this.onKey(e.code);
      if (["ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
    });
    window.addEventListener("keyup", (e) => { this.keys[e.code] = false; });
    window.addEventListener("blur", () => { this.keys = {}; });
  }
  down(code) { return !!this.keys[code]; }
  tap(code) { const v = !!this.pressed[code]; this.pressed[code] = false; return v; }
  endFrame() { this.pressed = {}; }
}
