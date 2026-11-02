# 3D models

The boats come from the MiraroTejo project (the lighter versions made for the virtual museum):

| Boat | Source | Web file | Size |
|---|---|---|---|
| Falua | `MiraroTejo/Assets/Embarcações/Falua/falua.fbx` (7.5 MB + textures) | `src/assets/models/falua.glb` | 6.9 MB |
| Muleta | `MiraroTejo/Assets/Embarcações/Muleta/Muleta.fbx` (2.8 MB + textures) | `src/assets/models/muleta.glb` | 2.7 MB |

The SingraroTejo versions (184 MB and 290 MB) are too heavy for the web.

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
- `hiddenNodes`: parts never shown (the Muleta's fishing-sail halyards and sheets, which are
  fixed in the model and would hang in the air once the sails turn);
- `singleSidedSails`: the Falua's sails are single planes and are drawn from both sides. The
  Muleta's sails already have two faces; drawing both sides again makes them flicker.

To find node names and positions, print the bounding box of every node, for example with a
small `@gltf-transform/core` script, or open the `.glb` in https://gltf.report or the
Babylon.js sandbox.

### Falua (model frame, metres)

| Part | Nodes | Pivot x |
|---|---|---|
| Fore sail | `Vela Frente`, yard `Mastro03`, `Cordas_Mastro01` | mast `Mastro01` axis |
| Main sail | `Vela Principal`, yard `Mastro04`, `Cordas_Mastro02` | mast `Mastro02` axis |
| Rudder | `Leme01–03` | 4.05 |

### Muleta (model frame, metres)

| Part | Nodes | Mode |
|---|---|---|
| Main sail | `Vela_principal` + yards | both |
| Front sail | `Vela_frente2` | both |
| Front fishing sails | `vela_avançada`, `vela_frente1`, `vela_frente_cima`, `mini-vela_rede-frente2(.001)` | fishing |
| Rear fishing sails | `vela_tras1`, `vela_tras2` | fishing |
| Rudder | `direcao`, `direcao.001` | both |
| Net booms | `Mastro_rede_frente`, `mastro_rede_tras` | always shown |

Sails that are not set in the current mode are hidden.
