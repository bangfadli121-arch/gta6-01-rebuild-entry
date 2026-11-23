// EMBER BAY — config: palette, city layout, missions, weapons, ranks.
// All original. No Rockstar names, no real-world city.
(function () {
  var EB = window.EB || (window.EB = {});

  var PALETTE = {
    teal: 0x2ec4b6, pink: 0xffb3a7, cream: 0xffe3a3, mint: 0x7ed957, sky: 0x7ec8e3,
    sun: 0xffb347, sunset: 0xff7a3c, dusk: 0x3b2a6e, night: 0x1a0f2e,
    asphalt: 0x2b2b33, sidewalk: 0xcfc8bd, grass: 0x69b34c, sand: 0xf2d8a0,
    sea: 0x2fb3a3, seaDeep: 0x1d8a9e
  };

  // City grid: roads every 40 m, road half-width 5, sidewalk 3.
  var GRID = { spacing: 40, min: -200, max: 200, roadHalf: 5, walkHalf: 8 };

  var DISTRICTS = [
    { name: "Portside", x0: -220, z0: -220, x1: -40, z1: -80, color: "#7ec8e3" },
    { name: "Old Market", x0: -220, z0: -80, x1: -40, z1: 80, color: "#ffe3a3" },
    { name: "Neon Row", x0: -40, z0: -120, x1: 80, z1: 80, color: "#ffb3a7" },
    { name: "Palm Heights", x0: 80, z0: -220, x1: 210, z1: -40, color: "#7ed957" },
    { name: "Cinder Docks", x0: -220, z0: 80, x1: 40, z1: 220, color: "#ff9a6e" },
    { name: "Sunset Beach", x0: 40, z0: 40, x1: 220, z1: 220, color: "#ffd75e" }
  ];

  var STREET_NAMES = ["Coastal Rd", "Cinder Rd", "Neon Ave", "Palm Blvd", "Portside Way", "Ember St", "Market Ln", "Sunset Dr", "Dockside Rd", "Heat Line"];

  var RANKS = [
    { name: "STREET RAT", at: 0 }, { name: "HUSTLER", at: 100 }, { name: "WHEELMAN", at: 250 },
    { name: "ENFORCER", at: 450 }, { name: "KINGPIN", at: 700 }, { name: "EMBER KING", at: 950 }
  ];

  var WEAPONS = [
    { name: "FISTS", short: "FISTS", dmg: 12, rate: 3.2, range: 3, unlock: 0, desc: "Bare knuckles. Quiet, personal." },
    { name: "P9 PISTOL", short: "P9 PISTOL", dmg: 22, rate: 2.6, range: 42, unlock: 0, desc: "Mara's old service piece." },
    { name: "SMG", short: "SMG", dmg: 13, rate: 9, range: 36, unlock: 0, desc: "Spray and pray, Neon Row style." },
    { name: "RIFLE", short: "RIFLE", dmg: 42, rate: 1.8, range: 70, unlock: 0, desc: "Long reach for long streets." },
    { name: "BAT", short: "BAT", dmg: 26, rate: 2.2, range: 3.5, unlock: 150, desc: "A souvenir from the docks." },
    { name: "SHOTGUN", short: "SHOTGUN", dmg: 60, rate: 1.1, range: 20, unlock: 400, desc: "Clears a doorway in one word." },
    { name: "SNIPER", short: "SNIPER", dmg: 95, rate: 0.8, range: 120, unlock: 800, desc: "One shot from the Palm Heights." }
  ];

  var MISSIONS = [
    { title: "FIRST WHEELS", objective: "Get in the white car", progress: "", type: "enterCar", target: { x: 24, z: 168 }, cash: 200, respect: 25 },
    { title: "PORTSIDE PICKUP", objective: "Drive to Mara at Portside", progress: "", type: "reach", target: { x: -168, z: -168 }, cash: 250, respect: 40 },
    { title: "NEON ROW NIGHTS", objective: "Race through all 4 checkpoints in order", progress: "GATE 0/4", type: "race", targets: [{ x: 0, z: -60 }, { x: 40, z: 20 }, { x: 0, z: 60 }, { x: 60, z: 0 }], cash: 400, respect: 60 },
    { title: "DOCKSIDE TROUBLE", objective: "Collect 3 crates in Cinder Docks", progress: "CRATE 0/3", type: "crates", targets: [{ x: -140, z: 154 }, { x: -116, z: 180 }, { x: -180, z: 166 }], cash: 350, respect: 60 },
    { title: "GETAWAY DRIVER", objective: "Stay free — 60s left • Wanted 4★", progress: "ESCAPE 60s", type: "escape", seconds: 60, wanted: 4, cash: 500, respect: 80 },
    { title: "AIR ONE", objective: "Escape the police helicopter", progress: "HELI 45s", type: "heli", seconds: 45, wanted: 4, cash: 550, respect: 90 },
    { title: "CINDER RUN", objective: "Make 3 drops across the city", progress: "DROP 0/3", type: "drops", targets: [{ x: 140, z: -120 }, { x: -160, z: 40 }, { x: 100, z: 160 }], cash: 450, respect: 70 },
    { title: "THE EMBER CROWN", objective: "Steal the Ember GT", progress: "", type: "stealGT", target: { x: 168, z: 150 }, cash: 1200, respect: 200 }
  ];

  var NEXT_TEXT = [
    "Portside Pickup: Drive to Mara at Portside",
    "Neon Row Nights: Win the street race",
    "Dockside Trouble: Grab 3 crates, handle the Rust Crew",
    "Getaway Driver: Lose the heat for 60 seconds",
    "Air One: Escape the police helicopter",
    "Cinder Run: Make 3 drops across the city",
    "The Ember Crown: Steal the Ember GT",
    "Story complete — Ember Bay is yours, King"
  ];

  var GARAGE = [
    { id: "engine", name: "ENGINE", cost: [300, 700, 1500], desc: "Top speed +12% a level" },
    { id: "armor", name: "ARMOR", cost: [250, 600, 1200], desc: "Damage taken -20% a level" },
    { id: "paint", name: "PAINT", cost: [150, 400, 900], desc: "Fresh coat — respect +15 a level" }
  ];

  var PAINTS = [0x1e56d8, 0xd81e2c, 0x18b58a, 0xf2a516, 0x8a2be2, 0xe8e8e8];

  var SIGNS = ["EMBER INN", "SOLIS PIER", "NEON ROW", "HEAT LINE", "PORTSIDE MARKET", "CINDER DOCKS", "PALM COURT", "BAY VIEW", "SUNSET MOTEL", "MARKET HALL", "EMBER BAY", "EAT LINE"];

  var BUILDING_COLORS = [0xffe3a3, 0xffb3a7, 0x7ec8e3, 0x7ed957, 0xf2a516, 0xe8909a, 0x9ad1e0, 0xd8c98a, 0xf5f0dc, 0x8fd0a8];
  var GLASS_COLORS = [0x2aa882, 0x5fd4a8, 0x3fae8c];

  EB.config = {
    PALETTE: PALETTE, GRID: GRID, DISTRICTS: DISTRICTS, STREET_NAMES: STREET_NAMES,
    RANKS: RANKS, WEAPONS: WEAPONS, MISSIONS: MISSIONS, NEXT_TEXT: NEXT_TEXT,
    GARAGE: GARAGE, PAINTS: PAINTS, SIGNS: SIGNS, BUILDING_COLORS: BUILDING_COLORS,
    GLASS_COLORS: GLASS_COLORS,
    START_CASH: 250, TRAFFIC_COUNT: 22, PED_COUNT: 60, SAVE_KEY: "emberbay-save-v1"
  };
  EB.SAVE_KEY = "emberbay-save-v1";
})();
