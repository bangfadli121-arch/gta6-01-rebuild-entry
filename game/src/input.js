// Ember Bay — keyboard and mouse input.
(function () {
  var EB = window.EB || (window.EB = {});
  var keys = {};
  var pressed = {};
  var mouseDX = 0, mouseDY = 0;
  var mouseDown = false;

  function codeOf(e) { return e.code || e.key; }

  window.addEventListener('keydown', function (e) {
    var c = codeOf(e);
    if (!keys[c]) pressed[c] = true;
    keys[c] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(c) >= 0) e.preventDefault();
  });
  window.addEventListener('keyup', function (e) { keys[codeOf(e)] = false; });
  window.addEventListener('blur', function () { keys = {}; });
  document.addEventListener('mousemove', function (e) { mouseDX += e.movementX || 0; mouseDY += e.movementY || 0; });
  document.addEventListener('mousedown', function (e) { if (e.button === 0) mouseDown = true; });
  document.addEventListener('mouseup', function (e) { if (e.button === 0) mouseDown = false; });

  EB.input = {
    keys: keys,
    pressed: pressed,
    wasPressed: function (c) {
      if (pressed[c]) { pressed[c] = false; return true; }
      return false;
    },
    consumeMouse: function () { var d = { x: mouseDX, y: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    isMouseDown: function () { return mouseDown; },
    clearPressed: function () { pressed = {}; EB.input.pressed = pressed; },
    axis: function () {
      var f = 0, s = 0;
      if (keys.KeyW || keys.ArrowUp) f += 1;
      if (keys.KeyS || keys.ArrowDown) f -= 1;
      if (keys.KeyA || keys.ArrowLeft) s -= 1;
      if (keys.KeyD || keys.ArrowRight) s += 1;
      return { forward: f, steer: s, brake: !!keys.Space };
    }
  };
})();
