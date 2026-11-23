# EMBER BAY — Heat Line

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bangfadli121-arch/gta6-01-rebuild-entry/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bangfadli121-arch/gta6-01-rebuild-entry/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Three.js r160](https://img.shields.io/badge/Three.js-r160-black)

An original open-world crime game in the browser, built for the make.fun
[gta6-01 "Make GTA 6"](https://make.fun/bounty/gta6-01) bounty. Drive, steal, run, and rise through the
ranks of Ember Bay — a fictional volcanic island city caught in golden hour.

You are **Kade Venn**, fresh out of a bad deal in Portside. Your crew —
**Mara Solis**, **Dario Flint**, and **June Park** — pulls you back in for
one last run at the Ember Crown. Eight story missions take you from a
stolen first car to a helicopter chase and the heist of the Ember GT.

## Play it

Serve the `game/` folder with any static server and open `index.html`
in desktop Chrome — no build step, no network requests, everything is
local (Three.js r160 is vendored under `game/vendor/`).

```sh
npx serve game
# or: python3 -m http.server --directory game 8080
```

## Controls

| Key | Action |
| --- | --- |
| W A S D | Drive / walk (Shift to sprint on foot) |
| Mouse drag | Orbit the camera |
| E | Enter / exit a car (carjack a traffic car to raise wanted) |
| F | Carjack the nearest car |
| Space / Click | Shoot (on foot, or from the car window) |
| Q or 1–4 | Weapon wheel / pick Fists, P9, SMG, Rifle |
| R | Cycle radio station (3 synth stations, WebAudio) |
| G | Garage upgrades (engine, armor, paint) |
| P | Save game (auto-saves after every mission) |
| M | Mute |
| Esc | Pause |

## The city

Six districts, each with its own look: **Portside** (docks and cranes),
**Old Market** (tight streets and stalls), **Neon Row** (signs and
nightlife), **Palm Heights** (hills and villas), **Cinder Docks**
(warehouses and the Rust Crew), and **Sunset Beach** (the finale).

## Systems

- **8 story missions** — joyride, pickup, street race, dock crates,
  getaway, helicopter escape, three drops, and the Ember Crown finale.
- **Wanted 1–5** — police chase you, set **roadblocks at 3 stars**,
  and send the **Air One helicopter with a spotlight at 4 stars**.
- **Traffic and pedestrians** — 11 traffic cars and 16 pedestrians
  living their own routes; pedestrians scatter when shots are fired.
- **Combat** — four weapons on a wheel, gang shootouts, tracers and
  muzzle flash.
- **Respect ranks** — Street Rat, Hustler, Wheelman, Enforcer,
  Kingpin, Ember King. Missions and clean getaways raise it.
- **Garage** — spend cash on engine, armor, and paint for your ride.
- **Saves** — localStorage saves, Continue on the start screen,
  auto-save after each mission.
- **Radio** — three WebAudio synth stations: Ember FM, Neon Wave,
  and Cinder Talk.

## Tech

- Three.js r160 (vendored, `game/vendor/three.min.js`), plain
  JavaScript, no build step, no network.
- Source split by job: `config`, `audio`, `input`, `world`,
  `vehicles`, `people`, `missions`, `combat`, `save`, `hud`,
  `shots`, `main`.
- Screenshots in `screenshots/` are real renders of this code:
  cover (chase with police), drive, chase, and mission.

## License

MIT — see [LICENSE](LICENSE). All city, character, vehicle, story,
and music names are original.
