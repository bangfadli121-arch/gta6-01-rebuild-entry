// EMBER BAY — Heat Line. Round 6 rebuild from zero.
// Config: city layout, districts, palette, missions, tuning.
export const CFG = {
  title: "EMBER BAY — Heat Line",
  version: "6.0.0",
  // World extents (metres). City grid is centred on origin.
  cityHalf: 210,          // roads span -210..210
  roadSpacing: 42,        // grid pitch
  roadWidth: 12,
  sidewalk: 4,
  beachX: 210,            // sand starts here
  sandEnd: 292,           // sea starts here
  seaX: 292,
  worldHalf: 420,
  volcano: { x: -150, z: -175, r: 68, h: 82 },
  // Golden-hour palette (5-key pastel)
  palette: {
    teal: 0x2ec4b6, pink: 0xffb3a7, cream: 0xffe3a3, mint: 0x7ed957, sky: 0x7ec8e3,
    // bright blue zenith (was dark purple 0x2f6fb4 — the cover sky read
    // bruised, not golden-hour blue); grass deepened to match
    skyTop: 0x5fa8e6, skyMid: 0xff9a4d, skyLow: 0xff7a2e,
    sea: 0x2fb5a8, sand: 0xe8cf9a, grass: 0x5ca844, asphalt: 0x2e2e33, sidewalk: 0xc9b896,
  },
  districts: [
    { name: "Portside",      cx: -150, cz: 130,  w: 150, d: 130, base: 0x7fb3d5, accent: 0x2e6f9e, roofs: [0xb8442c, 0x3f6d8e] },
    { name: "Old Market",    cx: -40,  cz: 120,  w: 170, d: 140, base: 0xe8b04b, accent: 0xa3541f, roofs: [0x8e3b2f, 0xc98a2e] },
    { name: "Neon Row",      cx: 90,   cz: 110,  w: 170, d: 140, base: 0xff7fa8, accent: 0x7a2ea6, roofs: [0x2ea6a0, 0xd94f7e] },
    { name: "Palm Heights",  cx: 130,  cz: -30,  w: 150, d: 130, base: 0x9ed6a0, accent: 0x3f8e5f, roofs: [0x2f6f4f, 0x7fb3d5] },
    { name: "Cinder Docks",  cx: -110, cz: -90,  w: 170, d: 150, base: 0xc96a4a, accent: 0x5f3a2e, roofs: [0x4a4a52, 0x8e3b2f] },
    { name: "Sunset Beach",  cx: 60,   cz: -150, w: 190, d: 120, base: 0xffc46b, accent: 0x2fb5a8, roofs: [0x2fb5a8, 0xff9a4d] },
  ],
  signs: ["EMBER INN", "SOLIS PIER", "NEON ROW", "HEAT LINE", "PORTSIDE MARKET", "CINDER DOCKS", "PALM COURT", "BAY VIEW", "SUNSET MOTEL", "MARKET HALL"],
  missions: [
    { id: 1, title: "First Wheels",     obj: "Get in the Skyline",                      next: "Portside Pickup: Drive to Mara at Portside" },
    { id: 2, title: "Portside Pickup",  obj: "Drive to Mara at Portside",              next: "Neon Row Nights: Win the street race" },
    { id: 3, title: "Neon Row Nights",  obj: "Race through all 4 checkpoints in order", next: "Dockside Trouble: Grab 3 crates, handle the Rust Crew" },
    { id: 4, title: "Dockside Trouble", obj: "Collect 3 crates in Cinder Docks",        next: "Getaway Driver: Lose the heat for 60 seconds" },
    { id: 5, title: "Getaway Driver",   obj: "Stay free — 60s left • Wanted 4★",       next: "Air One: Escape the police helicopter" },
    { id: 6, title: "Air One",          obj: "Escape the police helicopter",            next: "Cinder Run: Make the drops" },
    { id: 7, title: "Cinder Run",       obj: "Make 3 drops across Cinder Docks",        next: "The Ember Crown: Steal the Ember GT" },
    { id: 8, title: "The Ember Crown",  obj: "Steal the Ember GT and bring it home",   next: "Ember King — the island is yours" },
  ],
  weapons: [
    { key: 1, name: "FISTS",   lock: 0 },
    { key: 2, name: "P9 PISTOL", lock: 0 },
    { key: 3, name: "SMG",     lock: 0 },
    { key: 4, name: "RIFLE",   lock: 0 },
    { key: 5, name: "BAT",     lock: 150 },
    { key: 6, name: "SHOTGUN", lock: 400 },
    { key: 7, name: "SNIPER",  lock: 800 },
  ],
  ranks: [
    { at: 0,   name: "STREET RAT" },
    { at: 150, name: "RUNNER" },
    { at: 400, name: "HUSTLER" },
    { at: 800, name: "KINGPIN" },
    { at: 1400, name: "EMBER KING" },
  ],
  trafficCount: 36, // was 22 — the streets read empty in the drive frame
  pedCount: 90,      // was 60 — more walkers on the sidewalks
  patrolCount: 2,    // police cruisers always on the beat, even at wanted 0
  saveKey: "emberbay-save-v6",
};
