// EMBER BAY — input: keyboard + mouse drag state, edge-triggered presses.
(function () {
  var EB = window.EB || (window.EB = {});
  var keys = {}, pressed = {};
  var drag = { active: false, dx: 0, dy: 0, lastX: 0, lastY: 0 };
  var mouse = { down: false, x: 0, y: 0, clicked: false };

  window.addEventListener("keydown", function (e) {
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) >= 0) e.preventDefault();
  });
  window.addEventListener("keyup", function (e) { keys[e.code] = false; });
  window.addEventListener("blur", function () { keys = {}; drag.active = false; });

  var canvas = null;
  function bind(el) {
    canvas = el;
    el.addEventListener("mousedown", function (e) { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; drag.active = true; drag.lastX = e.clientX; drag.lastY = e.clientY; drag.dx = 0; drag.dy = 0; });
    window.addEventListener("mouseup", function (e) { if (mouse.down) mouse.clicked = true; mouse.down = false; drag.active = false; });
    window.addEventListener("mousemove", function (e) {
      if (drag.active) { drag.dx += e.clientX - drag.lastX; drag.dy += e.clientY - drag.lastY; drag.lastX = e.clientX; drag.lastY = e.clientY; }
    });
  }

  function down(code) { return !!keys[code]; }
  function wasPressed(code) { return !!pressed[code]; }
  function endFrame() { pressed = {}; drag.dx = 0; drag.dy = 0; mouse.clicked = false; }

  EB.input = { bind: bind, down: down, wasPressed: wasPressed, endFrame: endFrame, drag: drag, mouse: mouse,
    axis: function () { return (down("KeyD") || down("ArrowRight") ? 1 : 0) - (down("KeyA") || down("ArrowLeft") ? 1 : 0); },
    throttle: function () { return (down("KeyW") || down("ArrowUp") ? 1 : 0) - (down("KeyS") || down("ArrowDown") ? 1 : 0); } };
})();
