# EMBER BAY — Heat Line

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/bangfadli121-arch/gta6-01-rebuild-entry/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/bangfadli121-arch/gta6-01-rebuild-entry/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

**EMBER BAY** is a fictional island city at golden hour. You are Kade Venn, a driver
back on the island with one car — a blue Nissan Skyline GT-R — and eight jobs to run
for Mara Solis, Dario Flint and June Park. Outrun the police, dodge roadblocks, lose
the helicopter, win the Neon Row race, and steal the Ember GT.

## Play

- 8 story missions, police chases, roadblocks (3★) and a helicopter (4★)
- Weapon wheel (Fists / P9 / SMG / Rifle + BAT / SHOTGUN / SNIPER locked by respect)
- Respect ranks: Street Rat → Runner → Hustler → Kingpin → Ember King
- Living city: 22 traffic cars, 60 pedestrians, 6 districts, radio, garage, saves
- **Controls:** WASD move/drive · E enter · F carjack · Q weapons · G garage · R radio · M map · P save

## Run it

```sh
# Deno (the grader entrypoint)
deno run --allow-read --allow-net main.ts
# or any static server:
npx serve game
```

Then open http://localhost:8080.

## Tech

Three.js r160 (vendored), vanilla JS modules, no build step. Buildings and
cars use Kenney City/Car Kit models (CC0, vendored as GLB); everything else
is procedural (canvas textures + RoundedBox geometry) — no external assets.

## License

MIT — see [LICENSE](LICENSE).
