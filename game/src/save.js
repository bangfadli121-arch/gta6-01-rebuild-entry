// Ember Bay — save and load through localStorage.
(function () {
  var EB = window.EB || (window.EB = {});
  var KEY = 'ember-bay-save-v1';

  EB.save = {
    write: function () {
      try {
        var s = EB.state;
        localStorage.setItem(KEY, JSON.stringify({
          money: s.money, respect: s.respect, hp: s.hp,
          missionIndex: s.missionIndex, missionDone: s.missionDone,
          weaponIndex: s.weaponIndex, ammo: s.ammo,
          upgrades: s.upgrades, kills: s.kills, carsStolen: s.carsStolen
        }));
        return true;
      } catch (e) { return false; }
    },
    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) { return null; }
    },
    apply: function (data) {
      if (!data) return false;
      var s = EB.state;
      if (typeof data.money === 'number') s.money = data.money;
      if (typeof data.respect === 'number') s.respect = data.respect;
      if (typeof data.hp === 'number') s.hp = data.hp;
      if (typeof data.missionIndex === 'number') s.missionIndex = data.missionIndex;
      if (Array.isArray(data.missionDone)) s.missionDone = data.missionDone;
      if (typeof data.weaponIndex === 'number') s.weaponIndex = data.weaponIndex;
      if (Array.isArray(data.ammo)) s.ammo = data.ammo;
      if (data.upgrades) s.upgrades = data.upgrades;
      if (typeof data.kills === 'number') s.kills = data.kills;
      if (typeof data.carsStolen === 'number') s.carsStolen = data.carsStolen;
      return true;
    },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} }
  };
})();
