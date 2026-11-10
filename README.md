# Fragateiro

Browser mini-games with the traditional sailing boats of the Tagus River: the **Falua**, the
**Muleta** of Seixal, the **Fragata**, the **Catraio** and the **Canoa**, and a visitor from France, the **pinasse à voile** of Arcachon. A web successor to the Unity simulator described in
*A sailing simulator for the revival of the Tagus River nautical heritage* (Fazenda et al., 2025),
built to be easy to maintain and to grow into several small games.

- **Sailing the Tagus** (`games/sailing/`): free sailing with five boats on a map of the lower Tagus,
  from Vila Franca de Xira down the estuary and out along the coast to Cascais and round Cabo
  Espichel to Sesimbra and Setúbal, with the real channel buoys and landmarks: the 25 de Abril
  and Vasco da Gama bridges, the Vila Franca bridge, Torre de Belém, the Padrão dos
  Descobrimentos, Cristo Rei, the Torre Vasco da Gama, the Castelo de São Jorge and the
  lighthouses of Cabo Espichel, Bugio, Santa Marta, Gibalta and Alfeite. Buoys are IALA pillar
  buoys (red can / green cone topmarks; yellow X for the regatta marks). Switch boats at any
  time; the Muleta has two modes: *regular sailing* (main and front sails) and *lateral
  fishing* (all sails set, net out, drifting sideways). Sail onto land and you run aground.
  An afternoon sky with clouds drifting downwind, gulls circling over the river, real land
  heights, and other traditional boats sailing around you (each with its own physics and a
  simple helmsman that tacks upwind and keeps off the shore). Now and then (about one sighting
  every five minutes, some twenty seconds long) a pod of dolphins surfaces near the boat
  anywhere from the sea up to Lisbon, or orcas out on the open Atlantic (src/engine/wildlife.ts).

### Missions and levels

The game opens on a two-step menu (the **Missions** button brings it back): first what to
do, then where and with which boat.

- **Regatta:** a course in front of Lisbon (3 buoys), in Cascais bay or off Oeiras (2 buoys),
  with any boat. The buoys are laid to the wind in open water (first buoy upwind); round them
  in order (within 45 m), then back to the line.
- **Transport:** Lisbon–Almada, Moita–Lisbon, Sarilhos–Barreiro, Vila Franca–Lisbon, with any
  boat (the menu suggests the one that traditionally sailed the route). Ends within 150 m of
  the port. Also two short races (Moita to Gaio-Rosário; Sarilhos Pequenos to a buoy 2 km
  north) and the **busy crossing** Almada–Lisbon: a crowd of a dozen more boats about, strong
  gusts and the wind swinging up to 35°; each collision costs 15 s.
- **Clean-up** (every area): 12 pieces of rubbish (bottles, bags, crates, barrels, lost nets)
  float off a port; sail over each one (within 14 m) to pick it up. They show on the chart
  as orange dots; on easy and medium the orange post marks the nearest until it is in sight.
- **Supply run:** a Muleta lies at anchor 2 km south of the Bugio. Sail out from Trafaria,
  come alongside slowly (under 1.5 kn, within 35 m) and stay 25 s while the goods go across
  and the fish come back, then sail home. Rules in `src/world/challenges.ts` (tested).
- **Whaling** (Azores, from any of its ports): the lookout has seen a sperm whale's blow. Sail
  out and come up on it from astern, where it cannot see you, while it is at the surface (within
  22 m). Seen from ahead or the side within 140 m it lifts its tail and sounds, coming up further
  away. It breathes for about two minutes, then dives for two or three. Rules in
  `src/world/whaling.ts` (tested).
- Collisions with the other boats push both apart and slow them, in any mission.
- **Fishing** (Muleta): off Seixal, at the river mouth or in Cascais bay. Shoals show as dark
  patches of bubbling water with fish jumping and gulls circling over them. Sail to windward
  of one, switch to lateral fishing (M) and drift sideways over it: the net on the windward
  side catches fish in proportion to the water it sweeps through the shoal, and much less if
  the boat moves forward. Bring home 150 kg. From afar, look for the flock of gulls (and, on
  easy and medium, the orange post over the nearest shoal); close up, the pale foaming patch
  with splashes. On the minimap shoals are blue-green discs. Rules in `src/world/fishing.ts`.
- **Free sailing:** any boat, from any port, no clock.

Times use the game clock; best times are kept in the browser per mission, boat and level.

- **Easy:** the crew trims each sail for the best drive (no sheet controls), and the boat goes
  where it points (no drift).
- **Medium:** you trim the sheets; balanced sails.
- **Hard:** you trim the sheets; sails not balanced (they turn the boat), and none of the
  low-speed steering help through a tack: ease the sheets while turning through the wind.

Missions are defined in `src/world/missions.ts`; the trimming in `src/physics/autotrim.ts`.

### Museum and home editions

One game with two settings, chosen with `?edition=museum` or `?edition=home` (remembered; home
by default), in `src/world/edition.ts`. The museum edition is for a visit of a few minutes:
regatta legs of 350 m instead of 600 m, 6 pieces of rubbish within 800 m instead of 12 within
1.6 km, supply runs starting 900 m from the boat at anchor with a 12 s transfer instead of 25 s,
only transport routes under 4 km, and the clock at ×5 instead of ×3. Museum best times are kept
apart. The map stays at real scale: halving it would make the boats twice too big for the
rivers (narrow channels such as Pasaia's would become unsailable) and the hills and landmarks
look wrong, so the challenges are shortened instead.

### Languages

The site and the game are in Portuguese, French and English. The switch is at the top of the
landing page and in the game's settings; the choice is remembered. `?lang=pt|fr|en` in the URL
forces one. Texts live in `src/i18n/{pt,fr,en}.ts` (a test checks that all three have the same
keys); use `t('key')` in code and `data-i18n="key"` in HTML.

## Run it

```bash
npm install
npm run dev        # open the URL it prints
npm test           # physics tests
npm run build      # static site in dist/
npm run polar      # print speed polars for every boat and mode (tuning aid)
npm run study      # physics study: fixed situations, forces logged (docs/physics-study/)
```

Node 22 or newer.

### Controls

| | Keys | Touch / mouse |
|---|---|---|
| Rudder | A / D or ← / → | ◀ ▶ buttons, or drag one finger left/right on the view |
| Sheets (all sails) | W / S or ↑ / ↓ | one slider per sail group, or drag one finger up (in) / down (out) |
| Change mode (Muleta) | M | mode buttons |
| Change boat (free sailing) | B | boat buttons |
| Show forces | F | checkbox |
| Camera view: behind, ahead, port, starboard, top, free | 1–6 (C = behind) | camera buttons |
| Camera distance and height | mouse wheel | sliders, or pinch with two fingers |
| Orbit freely | drag the view with the mouse (switches to *free*) | |
| Move to a place, in free sailing (21 ports, from Cascais, Sesimbra and Setúbal to Vila Franca de Xira, including the Alfeite naval base) | T (next place) | click it on the minimap |
| Minimap: 15 km around the boat, or the whole map | | button under the minimap |
| Destination: distance, bearing and time | | *Sail to* list |
| Game speed (1×, 2×, 3× default, 5×, 10×; speeds shown stay real, "time ×3" under the speed) | | setting |
| Show the wind (streaks over the water) | | wind settings |
| Sound of wind, water and flapping sails (synthesised, starts on the first click or key) | N | checkbox |
| Other boats on the river (shown as dots on the minimap) | | checkbox |
| Pause / restart (a mission starts again) | P / R | |
| Missions and level | | *Missions* button |

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

## The maps

There are six sailing areas, each its own map, chosen in the mission menu (or with
`?area=tejo|arcachon|aveiro|azores|madeira`; the choice is remembered; the Pasaia map is hidden from the menu for now but opens with `?area=pasaia`): the **lower Tagus** from Vila
Franca de Xira to Cascais and Cabo Espichel, the **Bassin d'Arcachon** (home of the pinasse,
with the Cap Ferret lighthouse, the Thiers and Eyrac piers and the huts on stilts), the **Ria
de Aveiro**, the central **Azores** (Horta, Madalena, São Roque do Pico, Velas), the east of
**Madeira** (Santa Cruz, Machico, Porto da Cruz, Ponta de São Lourenço), and the Basque coast
at **Pasaia** (Pasajes), from San Sebastián to Saint-Jean-de-Luz. Each has its ports, regattas and transport routes (`src/world/area.ts`,
`src/world/missions.ts`); the Tagus also has its landmarks, the Muleta's fishing grounds, and
dolphins and orcas.

`src/assets/map/` holds, for each area, a land/water mask (20 m cells) plus town names and sea
marks, built from OpenStreetMap by `scripts/fetch-map.mjs`; the buoys are the same data that
OpenSeaMap shows. Land heights (40 m grid, `<area>-height.png`) come from the Copernicus
GLO-30 elevation model via `scripts/fetch-heights.mjs`: the hills of Lisbon and the Almada
plateau rise behind the shore, and the camera stays above the ground. The land is drawn in
4 km tiles, detailed only near the camera. The Tagus bridges follow their OpenStreetMap deck
lines (`bridges` in `tagus.json`); all landmarks are built from simple shapes in
`src/engine/landmarks.ts`. The areas' bounds are in `scripts/map-areas.mjs`; to add or change
one, edit it and run the **Update map data** workflow (Actions tab) with the area's id, or
locally:

```bash
node scripts/fetch-map.mjs --area arcachon
npm install --no-save geotiff@3.0.5 && node scripts/fetch-heights.mjs --area arcachon
```

(Behind a proxy, set `NODE_USE_ENV_PROXY=1`.) Then add the area to `src/world/area.ts`,
`src/engine/mapView.ts` and its missions. Map data © OpenStreetMap contributors, ODbL.
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
