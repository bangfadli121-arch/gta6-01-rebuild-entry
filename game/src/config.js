// EMBER BAY — Heat Line: config.js
// One job: every shared constant, the city layout, the story data and the
// global game state. Every other module reads EB here, nothing else.
window.EB = window.EB || {};

EB.GAME_NAME = "EMBER BAY — Heat Line";
EB.SAVE_KEY = "emberbay-save-v1";
EB.CITY_SIZE = 520;          // ground plane is CITY_SIZE x CITY_SIZE metres
EB.ROAD_SPACING = 64;        // distance between road centrelines
EB.BLOCK = 44;               // building block size inside a road cell

// v9: COOLED palette to match the top entries — the sky is bluer and
// the hot magenta band is gone (warm peach haze at the horizon only),
// the lawn is a softer green, the bay is brighter turquoise. The hero
// car's orange stays the one hot accent in the frame.
// v10: FIVE KEY COLOURS, used consistently everywhere (Brisa Bay
// rule: teal / pink / cream-yellow / mint / sky blue) — buildings,
// traffic and props all draw from this one set, so the city reads
// pastel and coherent instead of a random rainbow.
EB.COLORS = {
  skyTop: 0x6fb0ec, skyMid: 0xf7b98e, skyBottom: 0xffab5e, fog: 0xffc49a,
  sun: 0xffd166, ground: 0x69b96a, road: 0x35383f, sidewalk: 0xe8dcc0,
  building: [0x2ec4b6, 0xffb3a7, 0xffe3a3, 0x7ed957, 0x7ec8e3],
  palm: 0x2fbf5a, trunk: 0x8a5a2a, water: 0x1fd4e0,
  minimapLand: 0xf2e3b8, minimapRoad: 0x1c2a4a, lampGlow: 0xffe9a8,
};

// Six districts, each with a centre, a colour for the minimap and a vibe.
EB.DISTRICTS = [
  { name: "Portside",     x: -160, z: -160, r: 105, color: "#29b6e8", blurb: "Docks, cranes and containers." },
  { name: "Old Market",   x: 0,    z: -160, r: 100, color: "#ffb347", blurb: "Tight streets, stalls, old brick." },
  { name: "Neon Row",     x: 160,  z: -160, r: 100, color: "#ff4ad9", blurb: "Signs, clubs and all-night neon." },
  { name: "Palm Heights", x: -160, z: 120,  r: 105, color: "#3ed95a", blurb: "Hills, villas and palm avenues." },
  { name: "Cinder Docks", x: 0,    z: 140,  r: 100, color: "#ff5a5a", blurb: "Warehouses — Rust Crew turf." },
  { name: "Sunset Beach", x: 170,  z: 140,  r: 105, color: "#ffd23e", blurb: "Sand, surf and the Ember Crown." },
];

// Respect ranks: name, respect needed to reach it, and the cash bonus.
EB.RANKS = [
  { name: "STREET RAT",  need: 0 },
  { name: "HUSTLER",     need: 150 },
  { name: "WHEELMAN",    need: 400 },
  { name: "ENFORCER",    need: 800 },
  { name: "KINGPIN",     need: 1400 },
  { name: "EMBER KING",  need: 2200 },
];

// The eight story missions. Positions are world coordinates; the mission
// module turns each entry into live objectives.
EB.MISSIONS = [
  { id: 1, name: "First Wheels", short: "Steal your first car",
    brief: "Mara: 'Kade, you walk in, you walk out a nobody. Take the blue coupe on Palm Ave.'",
    objective: "Get in the blue coupe (walk to it, press E)", reward: 200, respect: 120 },
  { id: 2, name: "Portside Pickup", short: "Pick up Mara at the docks",
    brief: "Mara is waiting by the containers in Portside. Go get her — and don't keep her waiting.",
    objective: "Drive to Mara at Portside", reward: 350, respect: 140 },
  { id: 3, name: "Neon Row Nights", short: "Win the street race",
    brief: "Dario: 'Four gates through Neon Row. Beat the Rust Crew's best driver. No brakes, no mercy.'",
    objective: "Race through all 4 checkpoints in order", reward: 600, respect: 200 },
  { id: 4, name: "Dockside Trouble", short: "Grab 3 crates, handle the Rust Crew",
    brief: "Three crates in Cinder Docks. The Rust Crew guards them. Take the crates — deal with the crew however you like.",
    objective: "Collect 3 crates in Cinder Docks", reward: 700, respect: 220 },
  { id: 5, name: "Getaway Driver", short: "Lose the heat for 60 seconds",
    brief: "The Bay PD is on you, 3 stars and climbing. Lose them. Sixty seconds clean and you're free.",
    objective: "Survive 60s with the police on your tail", reward: 800, respect: 250 },
  { id: 6, name: "Air One", short: "Escape the police helicopter",
    brief: "Air One is overhead with a spotlight. Reach the hideout in Palm Heights before they box you in.",
    objective: "Reach the Palm Heights hideout under the helicopter", reward: 900, respect: 280 },
  { id: 7, name: "Cinder Run", short: "Three drops across the bay",
    brief: "June: 'Three drops, three districts, one night. Portside, Neon Row, Old Market. Go.'",
    objective: "Make all 3 drops in order", reward: 1000, respect: 300 },
  { id: 8, name: "The Ember Crown", short: "Steal the Ember GT",
    brief: "The Ember GT sits in Cinder Docks, guarded and gold. Take it, and drive it to Sunset Beach. That's the crown, Kade.",
    objective: "Steal the Ember GT and drive it to Sunset Beach", reward: 2500, respect: 600 },
];

EB.WEAPONS = [
  { name: "FISTS", damage: 12, rate: 2.2, range: 3.2,  spread: 0,    auto: false, unlockRespect: 0 },
  { name: "P9 PISTOL", damage: 26, rate: 3.5, range: 55, spread: 0.012, auto: false, unlockRespect: 0 },
  { name: "SMG", damage: 14, rate: 9, range: 45, spread: 0.05, auto: true, unlockRespect: 0 },
  { name: "RIFLE", damage: 55, rate: 1.6, range: 90, spread: 0.004, auto: false, unlockRespect: 0 },
  // v10: the 1-7 weapon bar shows these LOCKED from the start — they
  // unlock at respect ranks, so the progression is visible before it
  // is played (Brisa Bay shows its locked slots from minute one).
  { name: "BAT", damage: 20, rate: 1.8, range: 3.5,  spread: 0,    auto: false, unlockRespect: 150 },
  { name: "SHOTGUN", damage: 40, rate: 1.2, range: 30, spread: 0.12, auto: false, unlockRespect: 400 },
  { name: "SNIPER", damage: 90, rate: 0.8, range: 120, spread: 0.001, auto: false, unlockRespect: 800 },
];

EB.RADIO_STATIONS = [
  { name: "OFF", tempo: 0, wave: "sine", bass: 0 },
  { name: "EMBER FM", tempo: 112, wave: "sawtooth", bass: 55 },
  { name: "NEON WAVE", tempo: 128, wave: "square", bass: 65 },
  { name: "CINDER TALK", tempo: 96, wave: "triangle", bass: 48 },
];

EB.PAINTS = ["Ember Orange", "Midnight Black", "Bay Blue", "Neon Pink", "Gold Rush", "Palm Green"];
EB.PAINT_HEX = [0xff6a1a, 0x14161c, 0x2a9df4, 0xff4ad9, 0xffd23e, 0x2fbf5a];

// Live state. Save/load (save.js) only persists the marked fields.
EB.state = {
  started: false, paused: false, muted: false,
  cash: 250, respect: 0, rankIndex: 0, health: 100,
  wanted: 0, wantedHeat: 0, // wantedHeat builds up, then becomes stars
  weapon: 0, radio: 0, paintIndex: 0,
  engineLevel: 1, armorLevel: 1,
  missionIndex: 0,            // 0-based into EB.MISSIONS
  missionDone: [false, false, false, false, false, false, false, false],
  storyComplete: false,
  inCar: false, carId: -1, autoDrive: false,
  speedMph: 0, onFoot: true,
  timePlayed: 0, kills: 0, carsStolen: 0,
  distanceDriven: 0, // v10: metres driven, shown on the pause map
  mapOpen: false, // v10: pause-map overlay open
  garageOpen: false, wheelOpen: false,
  playerX: 24, playerZ: 24, playerHeading: 0,
};

EB.util = {
  clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp: function (a, b, t) { return a + (b - a) * t; },
  rand: function (a, b) { return a + Math.random() * (b - a); },
  randInt: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  dist2: function (x1, z1, x2, z2) { var dx = x2 - x1, dz = z2 - z1; return Math.sqrt(dx * dx + dz * dz); },
  angleTo: function (x1, z1, x2, z2) { return Math.atan2(x2 - x1, z2 - z1); },
  angleLerp: function (a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  },
  fmtMoney: function (n) { return "$" + Math.round(n).toLocaleString("en-US"); },
  fmtTime: function (s) {
    var m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ":" + (ss < 10 ? "0" : "") + ss;
  },
  rankFor: function (respect) {
    var idx = 0;
    for (var i = 0; i < EB.RANKS.length; i++) if (respect >= EB.RANKS[i].need) idx = i;
    return idx;
  },
  districtAt: function (x, z) {
    var best = EB.DISTRICTS[0], bd = 1e9;
    for (var i = 0; i < EB.DISTRICTS.length; i++) {
      var d = EB.util.dist2(x, z, EB.DISTRICTS[i].x, EB.DISTRICTS[i].z);
      if (d < bd) { bd = d; best = EB.DISTRICTS[i]; }
    }
    return best;
  },
};

// Toast/centre message bus used by HUD and missions.
EB.say = function (text, ms) { if (EB.hud) EB.hud.toast(text, ms || 2600); };
EB.bigSay = function (text, ms) { if (EB.hud) EB.hud.center(text, ms || 2200); };
EB.addCash = function (n) { EB.state.cash += n; };
EB.addRespect = function (n) {
  EB.state.respect += n;
  var idx = EB.util.rankFor(EB.state.respect);
  if (idx > EB.state.rankIndex) {
    EB.state.rankIndex = idx;
    EB.bigSay("NEW RANK: " + EB.RANKS[idx].name, 3000);
    EB.say("Respect rank up: " + EB.RANKS[idx].name);
  }
};
EB.setWanted = function (stars) {
  EB.state.wanted = EB.util.clamp(Math.round(stars), 0, 5);
  if (EB.hud) EB.hud.refreshWanted();
};
