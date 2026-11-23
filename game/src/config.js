// EMBER BAY — Heat Line. Round 5, written from zero.
// Shared constants: palette, city layout, districts, missions, weapons.
export const PALETTE = {
  teal: 0x2ec4b6, pink: 0xffb3a7, cream: 0xffe3a3, mint: 0x7ed957, sky: 0x7ec8e3,
  sunsetTop: 0x2e5aa8, sunsetMid: 0xff7e3d, sunsetLow: 0xffb347,
  asphalt: 0x2b2f36, sidewalk: 0xcfc8bd, sand: 0xe8cf9e, sea: 0x2fa8a0,
  grass: 0x7ec850, volcano: 0x4a2c22, lava: 0xff5a1e,
};
// City: streets on a 40 m pitch, blocks between them (block interior ~23 m,
// 4 sub-plots of ~10 m each — big enough for readable HD buildings).
export const GRID = { pitch: 40, half: 200, streets: [] };
for (let v = -180; v <= 180; v += 40) GRID.streets.push(v);

export const DISTRICTS = [
  { name: "Portside",      x0: -200, x1: -100, z0: -200, z1: 200,  tint: 0x8fb8d8, sign: "PORTSIDE MARKET" },
  { name: "Old Market",    x0: -100, x1: -20,  z0: -200, z1: -20,  tint: 0xe8b45a, sign: "MARKET HALL" },
  { name: "Neon Row",      x0: -100, x1: 100,  z0: -20,  z1: 100,  tint: 0xff7ad9, sign: "NEON ROW" },
  { name: "Palm Heights",  x0: -100, x1: 100,  z0: 100,  z1: 200,  tint: 0x7ed957, sign: "PALM COURT" },
  { name: "Cinder Docks",  x0: -200, x1: -100, z0: -200, z1: 200,  tint: 0x9a8a7a, sign: "CINDER DOCKS" },
  { name: "Sunset Beach",  x0: 100,  x1: 200,  z0: -200, z1: 200,  tint: 0xffd9a0, sign: "SUNSET MOTEL" },
];
export function districtAt(x, z) {
  if (x > 100) return DISTRICTS[5];
  if (x < -100) return DISTRICTS[0];
  if (z > 100) return DISTRICTS[3];
  if (z < -20) return DISTRICTS[1];
  return DISTRICTS[2];
}

export const SIGNS = ["EMBER INN", "SOLIS PIER", "NEON ROW", "HEAT LINE", "PORTSIDE MARKET",
  "CINDER DOCKS", "PALM COURT", "BAY VIEW", "SUNSET MOTEL", "MARKET HALL", "EMBER BAY", "EAT LINE"];

export const MISSIONS = [
  { id: 1, title: "First Wheels",      obj: "Get in the Skyline and drive to the marker",  next: "Portside Pickup: Meet Mara at the docks" },
  { id: 2, title: "Portside Pickup",   obj: "Drive to Mara at Portside",                   next: "Neon Row Nights: Win the street race" },
  { id: 3, title: "Neon Row Nights",   obj: "Race through all 4 checkpoints in order",     next: "Dockside Trouble: Grab 3 crates, handle the Rust Crew" },
  { id: 4, title: "Dockside Trouble",  obj: "Collect 3 crates in Cinder Docks",            next: "Getaway Driver: Lose the heat for 60 seconds" },
  { id: 5, title: "Getaway Driver",    obj: "Stay free — 60s left • Wanted 4★",            next: "Air One: Escape the police helicopter" },
  { id: 6, title: "Air One",           obj: "Escape the police helicopter",                next: "Cinder Run: Three drops across town" },
  { id: 7, title: "Cinder Run",        obj: "Make 3 drops across the city",                next: "The Ember Crown: Steal the Ember GT" },
  { id: 8, title: "The Ember Crown",   obj: "Steal the Ember GT and bring it home",        next: "Ember King — the city is yours" },
];

export const WEAPONS = [
  { key: "1", name: "FISTS",   lock: 0 },
  { key: "2", name: "P9 PISTOL", lock: 0 },
  { key: "3", name: "SMG",     lock: 0 },
  { key: "4", name: "RIFLE",   lock: 0 },
  { key: "5", name: "BAT",     lock: 150 },
  { key: "6", name: "SHOTGUN", lock: 400 },
  { key: "7", name: "SNIPER",  lock: 800 },
];
export const RANKS = [
  [0, "STREET RAT"], [150, "HUSTLER"], [400, "WHEELMAN"], [800, "HEAT MAKER"], [1500, "EMBER KING"],
];
export function rankFor(respect) {
  let r = RANKS[0][1];
  for (const [need, name] of RANKS) if (respect >= need) r = name;
  return r;
}

export const STATIONS = [
  { name: "EMBER FM",   desc: "synthwave", bpm: 112, root: 55 },
  { name: "HEAT 98",    desc: "island groove", bpm: 92, root: 49 },
  { name: "BAY TALK",   desc: "night talk", bpm: 70, root: 65 },
];

// Sidewalk clamp: pedestrians must stay on sidewalk strips beside roads.
// A point is on-road if it is within halfRoad of a street centerline on either axis.
export const ROAD_HALF = 5.2;   // asphalt half-width
export const WALK_HALF = 8.4;   // sidewalk outer edge
export function onRoad(x, z) {
  const near = v => GRID.streets.some(s => Math.abs(v - s) < ROAD_HALF);
  return near(x) || near(z);
}
export function clampToSidewalk(p) {
  // Push a point off the asphalt onto the nearest sidewalk band.
  const snap = v => {
    let best = v, bd = 1e9;
    for (const s of GRID.streets) {
      const d = v - s;
      if (Math.abs(d) < ROAD_HALF) {
        const c = s + Math.sign(d || 1) * (ROAD_HALF + 1.2);
        if (Math.abs(c - v) < bd) { bd = Math.abs(c - v); best = c; }
      }
    }
    return best;
  };
  p.x = snap(p.x); p.z = snap(p.z);
  // Never use the outer sidewalk of the edge road (x > 205 is beach).
  if (p.x > 200) p.x = 200 - (WALK_HALF - ROAD_HALF);
  if (p.x < -200) p.x = -200 + (WALK_HALF - ROAD_HALF);
  if (p.z > 200) p.z = 200 - (WALK_HALF - ROAD_HALF);
  if (p.z < -200) p.z = -200 + (WALK_HALF - ROAD_HALF);
  return p;
}
export function nearestRoadPoint(x, z) {
  // Snap a world point onto the nearest street centerline.
  const ns = v => { let b = GRID.streets[0], bd = 1e9; for (const s of GRID.streets) { const d = Math.abs(v - s); if (d < bd) { bd = d; b = s; } } return b; };
  const dx = Math.abs(x - ns(x)), dz = Math.abs(z - ns(z));
  if (dx < dz) return { x: ns(x), z };
  return { x, z: ns(z) };
}
