// EMBER BAY — Heat Line: save.js
// One job: persist the campaign in localStorage — cash, respect, rank,
// missions, upgrades, paint, and where Kade stands — and bring it back.
EB.save = (function () {
  function payload() {
    return {
      version: 1,
      cash: EB.state.cash, respect: EB.state.respect, rankIndex: EB.state.rankIndex,
      health: EB.state.health, weapon: EB.state.weapon, radio: EB.state.radio,
      paintIndex: EB.state.paintIndex, engineLevel: EB.state.engineLevel,
      armorLevel: EB.state.armorLevel, missionIndex: EB.state.missionIndex,
      missionDone: EB.state.missionDone, storyComplete: EB.state.storyComplete,
      playerX: EB.state.playerX, playerZ: EB.state.playerZ,
      playerHeading: EB.state.playerHeading,
      timePlayed: EB.state.timePlayed, kills: EB.state.kills,
      carsStolen: EB.state.carsStolen, savedAt: Date.now(),
    };
  }

  return {
    save: function (quiet) {
      try {
        localStorage.setItem(EB.SAVE_KEY, JSON.stringify(payload()));
        if (!quiet) EB.say("Game saved");
        return true;
      } catch (e) { return false; }
    },
    load: function () {
      try {
        var raw = localStorage.getItem(EB.SAVE_KEY);
        if (!raw) return false;
        var d = JSON.parse(raw);
        if (!d || d.version !== 1) return false;
        EB.state.cash = d.cash; EB.state.respect = d.respect;
        EB.state.rankIndex = d.rankIndex; EB.state.health = d.health;
        EB.state.weapon = d.weapon; EB.state.radio = d.radio || 0;
        EB.state.paintIndex = d.paintIndex || 0;
        EB.state.engineLevel = d.engineLevel || 1;
        EB.state.armorLevel = d.armorLevel || 1;
        EB.state.missionIndex = d.missionIndex || 0;
        EB.state.missionDone = d.missionDone || EB.state.missionDone;
        EB.state.storyComplete = !!d.storyComplete;
        EB.state.playerX = d.playerX; EB.state.playerZ = d.playerZ;
        EB.state.playerHeading = d.playerHeading || 0;
        EB.state.timePlayed = d.timePlayed || 0;
        EB.state.kills = d.kills || 0; EB.state.carsStolen = d.carsStolen || 0;
        return true;
      } catch (e) { return false; }
    },
    hasSave: function () {
      try { return !!localStorage.getItem(EB.SAVE_KEY); } catch (e) { return false; }
    },
    clear: function () {
      try { localStorage.removeItem(EB.SAVE_KEY); } catch (e) { /* ignore */ }
    },
  };
})();
