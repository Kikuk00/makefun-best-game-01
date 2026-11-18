# Emberkeep — Lantern of the Last Grove

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/c/best-game-01)
[![rank](https://make.fun/badge/best-game-01/Kikuk00/makefun-best-game-01/rank.svg)](https://make.fun/c/best-game-01)
[![reward](https://make.fun/badge/best-game-01/Kikuk00/makefun-best-game-01/reward.svg)](https://make.fun/c/best-game-01)

An entry for [make.fun's "Make the best game" bounty](https://make.fun/c/best-game-01).
Bounty page: https://make.fun/bounty/best-game-01

**Emberkeep** is a complete, original top-down arena game that plays offline in a
desktop browser from static files — no build step, no network requests, no
libraries. You are the moth-keeper of the last grove's Heart Lantern. Shadow
creatures crawl from the dark to snuff it out. Fly, aim, shoot, dash, and
survive all 10 waves — then defeat the Nightmaw.

## How to play

- **WASD / arrow keys** — fly
- **Mouse** — aim, **click / Space** — shoot light bolts (or hold **J**)
- **Shift / K** — dash (brief invulnerability)
- **E** — Radiance Nova when the meter is full (collect embers to charge it)
- **P / Esc** — pause, **M** — mute

Between waves you draft one of three blessings: brighter bolts, faster fire,
twin light, piercing rays, swifter wings, a sturdier lantern, and more. New in
round 2: **Lantern Thorns** (the lantern zaps the nearest foe) and **Radiance
Surge** (a stronger Nova that charges faster). The grove itself is alive now —
charging wisps, splitters that burst into two motes, gold-ringed elite foes
from wave 6, and a Nightmaw that enrages at half health. Kills
build a combo multiplier; embers are worth score and charge your Nova. The
lantern and the keeper each have their own health — lose either and the light
fades. Your best score is kept in the browser.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. `main.ts` (Node 22,
standard library only) hands the game in: it copies `game/` and `screenshots/`
to the output directory and writes `dossier.json`.

## Layout

- `game/` — the playable game (`index.html` + ES modules under `src/`)
  - `src/config.js` — tuning numbers and palette
  - `src/random.js` — seeded RNG
  - `src/audio.js` — synthesised WebAudio sound, no audio files
  - `src/input.js` — keyboard and mouse
  - `src/upgrades.js` — the between-wave blessing draft
  - `src/world.js` — rules and state: keeper, lantern, foes, waves, combos
  - `src/render.js` — all drawing: grove, creatures, HUD and screens
  - `src/shots.js` — deterministic screenshot scenes (`?shot=start|play|upgrade|victory`)
  - `src/main.js` — boot and the fixed-step loop
- `screenshots/` — real renders of the game's own code
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `main.ts` — the entrypoint that builds the submission output

## License

MIT — see [LICENSE](LICENSE).
