# 3D models

The boats come from the MiraroTejo project (the lighter versions made for the virtual museum):

| Boat | Source | Web file | Size |
|---|---|---|---|
| Falua | `MiraroTejo/Assets/Embarcações/Falua/falua.fbx` (7.5 MB + textures) | `src/assets/models/falua.glb` | 2.8 MB (slimmed) |
| Muleta | `MiraroTejo/Assets/Embarcações/Muleta/Muleta.fbx` (2.8 MB + textures) | `src/assets/models/muleta.glb` | 2.7 MB |
| Fragata | `MiraroTejo/Assets/Embarcações/Fragata/Fragata.fbx` (4.7 MB + textures) | `src/assets/models/fragata.glb` | 3.8 MB |
| Catraio | `MiraroTejo/Assets/Embarcações/Catraio/catraio.fbx` (55 MB, textures inside) | `src/assets/models/catraio.glb` | 3.2 MB |
| Canoa | generated: `scripts/boats/canoa.mjs` (from a photo, 8.8 m × 2.2 m, 5 t) | `src/assets/models/canoa.glb` | 0.5 MB |

The SingraroTejo versions (184 MB and 290 MB) are too heavy for the web.

### Merged parts

Some models have parts that must move modelled as one mesh: the Fragata's mast, topmast,
gaff and fittings are one mesh (`Circle.001`), and its rudder and tiller are inside the hull
(`Corpo`); the Catraio's masts, sprits and bowsprit are one mesh (`Mastro`). After
converting, split them into connected pieces and use the pieces' names in `boatVisuals.ts`:

```bash
node scripts/split-mesh.mjs fragata.glb fragata-split.glb Circle.001 Corpo
npx @gltf-transform/cli@4.5.1 prune fragata-split.glb src/assets/models/fragata.glb
node scripts/split-mesh.mjs catraio.glb catraio-split.glb Mastro
npx @gltf-transform/cli@4.5.1 prune catraio-split.glb src/assets/models/catraio.glb
```

The Fragata's bow points to +x (`bowPositiveX: true` in `boatVisuals.ts`).

## Slimming a model

```bash
npm install --no-save @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0
node scripts/slim-model.mjs big.glb src/assets/models/boat.glb 0.01
```

Or, without installing anything: run the **Slim a model** workflow (Actions tab) with the
model's path and unit; it slims the file in the repository and commits it.

Small fittings (hooks, rings, blocks, the anchor) often have thousands of triangles each.
The script simplifies parts under 0.8 m to a few hundred triangles, and parts with more than
800 triangles per metre of their size (a row of rings along a yard can be one mesh) as far as
a 3 mm change in shape allows, so thin ropes keep their shape. Node names do not change. The
Falua went from 7 MB and 179k triangles to 2.8 MB and 61k with no visible difference at
sailing distance. The last argument is the model's `unit` from `boatVisuals.ts`.

The game loads only the first boat at start; the others download the first time they are
picked (the button pulses meanwhile), so more boats do not slow the start.

## Light versions (other boats on the river)

```bash
npm install --no-save @gltf-transform/functions@4.5.1 meshoptimizer@1.3.0 sharp@0.34.4
npx tsx --import ./scripts/url-stub.mjs scripts/lite-models.ts [boat ...]
```

The boats sailing around the player use light copies in `src/assets/models/lite/`. The script
reads `boatVisuals.ts`, keeps the parts that move (sails, yards, rudder) as separate named
nodes, drops fittings under 0.5 m and hidden parts, merges everything else into one mesh per
material with its textures replaced by their average colour, and simplifies hard. Each boat
ends up with 6-8k triangles (the Fragata 26k) and 140-480 KB; all four together are about
1 MB, loaded in the background after the game starts. Run it again after changing a model or
its wiring. (`scripts/url-stub.mjs` lets Node import `boatVisuals.ts`, whose `?url` imports
only work in Vite.)

## Generating a model from numbers

For a boat with photos or plans but no 3D model:

```bash
node scripts/generate-boat.mjs scripts/boats/canoa.mjs src/assets/models/canoa.glb
```

The parameter file gives, in metres (s aft of the bow, y above the waterline, z to port):
length, beam and weight; the sheer line (height amidships, rise at bow and stern); how far
the stem curves into the keel; where the hull is widest and how round its sections are;
masts (position, height, rake); each sail's four corners; fixed spars (bowsprit, bumkin);
and the rudder outline and tiller. The hull is painted in bands (bottom, topsides, a stripe,
the sheer strake) with flat colours, so the files are small.

The script searches for the hull depth at which the boat displaces its weight, writes the
`.glb` in metres (`unit: 1`, `waterline: 0` in `boatVisuals.ts`) with named nodes (`Casco`,
`Vela`, `Verga`, `Leme`, `Cana`, ...), and prints what the physics needs: waterline length,
draft, centre of buoyancy (`cgX`), lateral area and centre, rudder area, and each sail's
area, pivot and centre of effort.

## Converting

```bash
sudo apt install assimp-utils
pip install pillow
scripts/convert-model.sh path/to/boat.fbx path/to/textures/ src/assets/models/boat.glb
```

The script converts FBX to glTF (assimp), re-links the textures by file name, then with
`gltf-transform` removes duplicates, shrinks textures to 512 px WebP and quantizes the
geometry. It never merges meshes: the game needs the sails and the rudder as separate,
named nodes. (The Muleta in the repo was made with 1024 px textures.)

## Wiring a model to the physics

`src/engine/boatVisuals.ts` lists, for each boat:

- `unit`, `scale`, `cgX`, `waterline`: how to place the model (units are metres in the model
  frame: bow towards −x, y up);
- for each physics sail, the model nodes that turn with it (sail, yard, ropes) and the pivot.
  The masts of both boats are raked, so main sails turn about the mast's own axis
  (`axis: { base, top }`, measured on the mast mesh), pivoting at the masthead; otherwise
  the yard would swing away from the mast;
- the rudder nodes and pivot;
- `hullNodes`: the hull's outer planking. When the model loads, the game measures where it
  crosses the waterline (24 slices along the hull) and draws no water inside that shape, so
  open holds stay dry whatever the waves do;
- `horse` and `sheets` (optional): a metal arch across the stern above the tiller, and the
  sheets drawn as ropes (thin textured tubes that sag a little, rebuilt every frame) from
  each sail's clew, to a block that slides on the arch (mainsheet)
  to one fitting, or to fittings on each side (jib sheets, taut to leeward and slack to
  windward). All four boats have them; the Catraio's fixed copies of these ropes (pieces of
  its rope mesh `Cordas`, split with `scripts/split-mesh.mjs`) are hidden;
- `hiddenNodes`: parts never shown (the Muleta's fishing-sail halyards and sheets, which are
  fixed in the model and would hang in the air once the sails turn);
- sails modelled as a single plane (the Falua's) are drawn from both sides; sails that already
  have both faces (the other boats) are not, or the faces would fight and flicker. The game
  decides this from each sail's normals when it loads the model.

To find node names and positions, print the bounding box of every node, for example with a
small `@gltf-transform/core` script, or open the `.glb` in https://gltf.report or the
Babylon.js sandbox.

### Falua (model frame, metres)

| Part | Nodes | Pivot x |
|---|---|---|
| Fore sail | `Vela Frente`, yard `Mastro03`, `Cordas_Mastro01` | mast `Mastro01` axis |
| Main sail | `Vela Principal`, yard `Mastro04`, `Cordas_Mastro02` | mast `Mastro02` axis |
| Rudder (blade and tiller) | `Leme01–03` | axis of the raked pin `Pin` |
| Hidden | `Roldana02`, `Roldana02.001` (halyard blocks) | |

### Muleta (model frame, metres)

| Part | Nodes | Mode |
|---|---|---|
| Main sail | `Vela_principal` + yards | both |
| Front sail | `Vela_frente2` | both |
| Front fishing sails | `vela_avançada`, `vela_frente1`, `vela_frente_cima`, `mini-vela_rede-frente2(.001)` | fishing |
| Rear fishing sails | `vela_tras1`, `vela_tras2` | fishing |
| Rudder and its yoke | `direcao`, `direcao.001`, `Guia`, `roldana_direcao1` (axis through gudgeons `suporte_quilha_1/2`) | both |
| Net booms | `Mastro_rede_frente`, `mastro_rede_tras` | always shown |

Sails that are not set in the current mode are hidden.

### Fragata

| Part | Nodes | Turns about |
|---|---|---|
| Jib | `Vela Frontal.001` | its stay (tack to head) |
| Mainsail and gaff | `vela_Trazeira.001`, `Circle.001_part69` | the mast `Circle.001_part52` |
| Rudder and tiller | `Corpo_part9`, `Corpo_part23` | the rudder's hinge line |

### Catraio

| Part | Nodes | Turns about |
|---|---|---|
| Jib | `Vela.001` | its stay (bowsprit end to mast) |
| Spritsail, sprit, lacing | `Vela`, `Mastro_part4`, `CordasMastro.013–030` | the main mast `Mastro_part1` |
| Mizzen, its sprit, lacing | `Vela.002`, `Mastro_part3`, `CordasMastro.031–050` | the mizzen mast `Mastro_part2` |
| Rudder and tiller | `Leme01`, `Leme01.001`, `Leme02`, `Leme02.001` | the pin `Pin` |
