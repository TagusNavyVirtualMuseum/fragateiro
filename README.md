# Fragateiro

Browser mini-games with the traditional sailing boats of the Tagus River: the **Falua**, the
**Muleta** of Seixal, the **Fragata** and the **Catraio**. A web successor to the Unity simulator described in
*A sailing simulator for the revival of the Tagus River nautical heritage* (Fazenda et al., 2025),
built to be easy to maintain and to grow into several small games.

- **Sailing the Tagus** (`games/sailing/`): free sailing with four boats on a map of the estuary (Lisbon,
  Almada, Seixal, Amora, Barreiro, Alhos Vedros, Moita, Montijo, Alcochete) with the real channel buoys. Switch boats at any
  time; the Muleta has two modes: *regular sailing* (main and front sails) and *lateral
  fishing* (all sails set, net out, drifting sideways). Sail onto land and you run aground.

## Run it

```bash
npm install
npm run dev        # open the URL it prints
npm test           # physics tests
npm run build      # static site in dist/
npm run polar      # print speed polars for every boat and mode (tuning aid)
```

Node 22 or newer.

### Controls

| | Keys | Touch / mouse |
|---|---|---|
| Rudder | A / D or ← / → | ◀ ▶ buttons |
| Sheets (all sails) | W / S or ↑ / ↓ | one slider per sail group |
| Change mode (Muleta) | M | mode buttons |
| Change boat | B | boat buttons |
| Show forces | F | checkbox |
| Camera view: behind, ahead, port, starboard, top, free | 1–6 (C = behind) | camera buttons |
| Camera distance and height | mouse wheel / pinch | sliders |
| Orbit freely | drag the view (switches to *free*) | |
| Move to a town (Lisboa, Almada, Seixal, Amora, Barreiro, Alhos Vedros, Moita, Montijo, Alcochete) | T (next town) | *Sail from* list, or click a town on the minimap |
| Pause / restart | P / R | |

## How it is organised

```
src/physics/    Sailing physics in plain TypeScript. No 3D, no browser: tested with Vitest.
  boats/        One file per boat: dimensions, sails, modes (all the numbers live here).
src/engine/     Babylon.js pieces shared by every game: scene, water, boat view, arrows…
src/ui/         HTML/CSS overlay (instruments, sliders).
src/world/      Game rules that need no 3D (land / water lookup).
src/assets/     Boat models (.glb) and the estuary map (map/).
games/<name>/   One folder per mini-game: an index.html and a main.ts.
tests/          Physics tests.
docs/           PHYSICS.md (the model and its equations), MODELS.md (3D model pipeline).
```

The physics never imports Babylon.js (a test enforces it), so it can be reused, tested and
explained on its own. See [docs/PHYSICS.md](docs/PHYSICS.md).

### Add a mini-game

1. Copy `games/sailing/` to `games/<new-game>/` and change `main.ts`.
2. Add the page to `build.rollupOptions.input` in `vite.config.ts`.
3. Link it from `index.html`.

### Add a boat

1. Convert the model: `scripts/convert-model.sh boat.fbx textures/ src/assets/models/boat.glb`
   (see [docs/MODELS.md](docs/MODELS.md)).
2. Describe it in `src/physics/boats/<boat>.ts` and add it to `BOATS` in `src/physics/index.ts`.
3. Map its sails and rudder to model nodes in `src/engine/boatVisuals.ts`.
4. Run `npm run polar` and adjust until the speeds look right; add it to the tests.

## The map

`src/assets/map/` holds a land/water mask of the estuary (10 m cells) plus town names and sea
marks, built from OpenStreetMap by `scripts/fetch-map.mjs`; the buoys are the same data that
OpenSeaMap shows. To change the area, edit `BBOX` in that script and run the **Update map
data** workflow (Actions tab); it downloads the data and commits the new files. Map data
© OpenStreetMap contributors, ODbL.

## Deploy

Every push to `main` runs the tests, builds, and publishes to GitHub Pages
(`.github/workflows/deploy.yml`). One-time setup: **Settings → Pages → Source: GitHub Actions**.
The site is static, so `dist/` can also be copied to any web server.

## Credits

Boat models and the original simulator: Tagus Navy Virtual Museum project
([SingraroTejo](https://github.com/TagusNavyVirtualMuseum/SingraroTejo),
[MiraroTejo](https://github.com/TagusNavyVirtualMuseum/MiraroTejo)), with the Portuguese Navy Museum.
Sail coefficient tables from V. Lytsus' Unity yacht simulator, via SingraroTejo.
Released under CC0 1.0 (see `LICENSE`).
