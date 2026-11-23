// EMBER BAY — Heat Line: input.js
// One job: keyboard and mouse state, with edge-triggered "pressed" keys
// the game loop consumes once per frame.
EB.input = (function () {
  var keys = {};       // code -> held
  var pressed = {};    // code -> pressed since last frame (edge)
  var mouseDX = 0, mouseDY = 0, dragging = false, lastX = 0, lastY = 0;
  var mouseDown = false, mouseClicked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].indexOf(e.code) >= 0) {
      e.preventDefault();
    }
    EB.audio.unlock();
  }
  function onKeyUp(e) { keys[e.code] = false; }

  function onMouseDown(e) {
    mouseDown = true; mouseClicked = true; dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    EB.audio.unlock();
  }
  function onMouseMove(e) {
    if (!dragging) return;
    mouseDX += e.clientX - lastX; mouseDY += e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
  }
  function onMouseUp() { mouseDown = false; dragging = false; }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", function () { keys = {}; dragging = false; });

  return {
    down: function (code) { return !!keys[code]; },
    // True once, the frame the key went down. Consumed on read.
    pressed: function (code) {
      var p = !!pressed[code];
      if (p) pressed[code] = false;
      return p;
    },
    anyPressed: function (codes) {
      for (var i = 0; i < codes.length; i++) if (this.pressed(codes[i])) return codes[i];
      return null;
    },
    // WASD + arrows as a -1..1 pair, camera-relative handled by caller.
    moveAxes: function () {
      var x = 0, y = 0;
      if (keys["KeyA"] || keys["ArrowLeft"]) x -= 1;
      if (keys["KeyD"] || keys["ArrowRight"]) x += 1;
      if (keys["KeyW"] || keys["ArrowUp"]) y += 1;
      if (keys["KeyS"] || keys["ArrowDown"]) y -= 1;
      return { x: x, y: y };
    },
    mouseDelta: function () {
      var d = { x: mouseDX, y: mouseDY };
      mouseDX = 0; mouseDY = 0;
      return d;
    },
    clicked: function () {
      var c = mouseClicked; mouseClicked = false; return c;
    },
    isMouseDown: function () { return mouseDown; },
    endFrame: function () { pressed = {}; },
  };
})();
