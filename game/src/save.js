// EMBER BAY — save: localStorage saves (P) + auto-save after missions.
(function () {
  var EB = window.EB || (window.EB = {});
  var KEY = EB.config.SAVE_KEY;

  function write(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        cash: s.cash, respect: s.respect, missionIndex: s.missionIndex,
        weapon: s.weapon, upgrades: s.upgrades, paint: s.paint,
        x: s.px, z: s.pz, heading: s.heading, inCar: s.inCar, hp: s.hp
      }));
      return true;
    } catch (e) { return false; }
  }
  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  EB.save = { write: write, read: read, clear: clear };
})();
