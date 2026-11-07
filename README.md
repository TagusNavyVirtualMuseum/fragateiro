# Fragateiro

Browser mini-games with the traditional sailing boats of the Tagus River: the **Falua**, the
**Muleta** of Seixal, the **Fragata**, the **Catraio** and the **Canoa**. A web successor to the Unity simulator described in
*A sailing simulator for the revival of the Tagus River nautical heritage* (Fazenda et al., 2025),
built to be easy to maintain and to grow into several small games.

- **Sailing the Tagus** (`games/sailing/`): free sailing with five boats on a map of the lower Tagus,
  from Vila Franca de Xira down the estuary and out along the coast to Cascais and round Cabo
  Espichel to Sesimbra and Setúbal, with the real channel buoys and landmarks: the 25 de Abril
  and Vasco da Gama bridges, Torre de Belém, the Padrão dos Descobrimentos, the Castelo de São
  Jorge and the lighthouses of Cabo Espichel, Bugio and Santa Marta. Switch boats at any
  time; the Muleta has two modes: *regular sailing* (main and front sails) and *lateral
  fishing* (all sails set, net out, drifting sideways). Sail onto land and you run aground.
  An afternoon sky with clouds drifting downwind, gulls circling over the river, real land
  heights, and other traditional boats sailing around you (each with its own physics and a
  simple helmsman that tacks upwind and keeps off the shore).

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
| Rudder | A / D or ← / → | ◀ ▶ buttons, or drag one finger left/right on the view |
| Sheets (all sails) | W / S or ↑ / ↓ | one slider per sail group, or drag one finger up (in) / down (out) |
| Change mode (Muleta) | M | mode buttons |
| Change boat | B | boat buttons |
| Show forces | F | checkbox |
| Camera view: behind, ahead, port, starboard, top, free | 1–6 (C = behind) | camera buttons |
| Camera distance and height | mouse wheel | sliders, or pinch with two fingers |
| Orbit freely | drag the view with the mouse (switches to *free*) | |
| Move to a place (20 ports, from Cascais, Sesimbra and Setúbal to Vila Franca de Xira) | T (next place) | *Sail from* list, or click it on the minimap |
| Minimap: 15 km around the boat, or the whole map | | button under the minimap |
| Destination: distance, bearing and time | | *Sail to* list |
| Game speed (1×, 2×, 3× default, 5×, 10×; speeds shown stay real, "time ×3" under the speed) | | setting |
| Show the wind (streaks over the water), balanced sails (on by default: the sails do not turn the boat) | | wind settings |
| Sound of wind, water and flapping sails (synthesised, starts on the first click or key) | N | checkbox |
| Other boats on the river (shown as dots on the minimap) | | checkbox |
| Pause / restart | P / R | |

## How it is organised

```
src/physics/    Sailing physics in plain TypeScript. No 3D, no browser: tested with Vitest.
  boats/        One file per boat: dimensions, sails, modes (all the numbers live here).
src/engine/     Babylon.js pieces shared by every game: scene, water, boat view, arrows…
src/ui/         HTML/CSS overlay (instruments, sliders).
src/world/      Game rules that need no 3D (land / water, heights, the other boats' helmsman).
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

No 3D model? `scripts/generate-boat.mjs` builds one from numbers: length, beam, weight,
sheer line, stem, masts, sail corners and rudder, read from a side photo or plan (see
`scripts/boats/canoa.mjs`). It finds the depth at which the hull floats at its weight and
prints the areas and centres the physics needs. Then continue from step 2.

1. Convert the model: `scripts/convert-model.sh boat.fbx textures/ src/assets/models/boat.glb`
   (see [docs/MODELS.md](docs/MODELS.md)); if it is heavy, slim it with `scripts/slim-model.mjs`.
   Boats download only when picked, so each new boat adds nothing to the start-up time.
2. Describe it in `src/physics/boats/<boat>.ts` and add it to `BOATS` in `src/physics/index.ts`
   (or to `BOATS_IN_DEVELOPMENT` to keep it out of the games while it is being worked on).
3. Map its sails and rudder to model nodes in `src/engine/boatVisuals.ts`, then make its light
   version for the other boats on the river (`scripts/lite-models.ts`, see docs/MODELS.md).
4. Run `npm run polar` and adjust until the speeds look right; add it to the tests.

## The map

`src/assets/map/` holds a land/water mask of the lower Tagus and the coast (20 m cells) plus town names and sea
marks, built from OpenStreetMap by `scripts/fetch-map.mjs`; the buoys are the same data that
OpenSeaMap shows. Land heights (40 m grid, `tagus-height.png`) come from the Copernicus
GLO-30 elevation model via `scripts/fetch-heights.mjs`: the hills of Lisbon and the Almada
plateau rise behind the shore, and the camera stays above the ground. The land is drawn in
4 km tiles, detailed only near the camera. The bridges follow their OpenStreetMap deck lines
(`bridges` in `tagus.json`); all landmarks are built from simple shapes in
`src/engine/landmarks.ts`. To change the area,
edit `BBOX` in `fetch-map.mjs` and run the **Update map data** workflow (Actions tab); it
downloads both and commits the new files. Map data © OpenStreetMap contributors, ODbL.
Heights: Copernicus GLO-30 DEM, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH
2014-2018, provided under COPERNICUS by the European Union and ESA.

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
