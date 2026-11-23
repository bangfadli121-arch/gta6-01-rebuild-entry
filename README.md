# EMBER BAY — Open-World Crime

[![make.fun — gta6-01](https://img.shields.io/badge/make.fun-gta6--01-orange)](https://make.fun/bounty/gta6-01)
[![make.fun — leaderboard live](https://img.shields.io/badge/leaderboard-live-brightgreen)](https://make.fun/bounty/gta6-01)
[![make.fun — prize $1,666](https://img.shields.io/badge/prize-%241%2C666-gold)](https://make.fun/bounty/gta6-01)

**Competition:** [Make GTA 6 — gta6-01 on make.fun](https://make.fun/bounty/gta6-01)

A complete open-world crime game in the browser, built with Three.js.
Drive a sun-soaked island city at golden hour, run 8 story missions,
outrun the police, jack cars, upgrade your ride at the garage, and take
the crown from the Ember King.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests at runtime: every file the game loads
lives under `game/`, including the vendored Three.js r128.

## Controls

- **WASD** drive / walk, **Mouse** aim, **Click** shoot
- **E** enter / exit car, **F** jack a car, **Space** brake
- **1–7** weapons, **R** radio, **V** radio off, **G** garage, **M** mission, **P** pause

## What's inside

- A dense, colourful city: hundreds of buildings with lit windows, Neon
  Row billboards, a sandy beach with palms and umbrellas, sailboats on
  a teal sea, and a smoking volcano with glowing lava.
- 8 story missions: street racing, deliveries, getaways, a harbor heist,
  roadblock runs, a timed volcano climb and a final showdown.
- Wanted stars, police dispatch with roadblocks and a helicopter,
  weapon wheel (slots 1–7), respect ranks from STREET RAT to EMBER KING.
- Living traffic and pedestrians, carjacking, garage upgrades
  (engine / armor / nitro), 4 synthesized radio stations including
  EMBER FM 88.1, and localStorage saves.
- Full HUD: cash, rank, health, weapon slots, wanted stars, mission
  panel and a round minimap of the city.

## Screenshots

`1-cover.jpg` is the cover: an aerial three-quarter view from above the
beach — sea and sailboats in front, the hero car on the coastal road,
the dense city, and the volcano behind it. The other shots show driving,
a police chase and a mission in progress.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and
writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).
