# Physics study of the boat models

How the five boat models behave in a set of fixed situations: a check of the physics, and
the record of the changes made after the first run of this study. Run it again after any
change to the physics or the boats:

```bash
npm run study                 # wind 12 kn (the game's default)
npm run study -- --wind 8     # another wind speed, knots
```

`scripts/physics-study.ts` writes the full time series (one row per boat, case and second:
speed, heel, apparent wind, every force, sail angles, angle of attack, which sails flap) to
`data/*.csv`, and summary tables to [results.md](results.md). This page explains the model,
the tests and the results.

## 1. The physics in brief

The model (`src/physics/`, plain TypeScript, no 3D) is a **planar** model: the boat moves on a
flat sea with three degrees of freedom (surge = forward, sway = sideways, yaw = turning) plus
a one-degree heel model. Waves are only drawn. Integration: semi-implicit Euler at 120 Hz.
Full equations in [PHYSICS.md](../PHYSICS.md).

**One force model for everything: the foil.** Sails, keel and rudder are wings. A wing in a
flow of speed V at angle of attack α gives

    F = ½ ρ V² A (C_L(α) · n + C_D(α) · v̂)

lift perpendicular to the flow, drag along it.

| Part | Flow it sees | Coefficients |
|---|---|---|
| **Sails** | the apparent wind at the sail's centre of effort (true wind minus the boat's motion, including its turning), ρ = 1.204 kg/m³ | tables from the original simulator (one value per degree); drag scaled to 60 % at small angles, back to 100 % at 90°; flapping sails get a fifth of the drag |
| **Hull and keel** | the water, in 6 strips along the middle half of the hull (each strip sees a different flow when the boat turns, which damps the turning) | linear lift up to the stall angle (25°), then flat-plate behaviour, plus cross-flow drag 1.1 · sin²α |
| **Rudder** | the water at the stern | as the hull, turned by the helm |

**Sheets.** A sail on its own streams downwind like a flag. The sheet only limits how far
the boom can swing out: 20° from the centreline hauled in, 70–80° fully eased (the Muleta's
small fishing sails on the net booms can be hauled to 4°). If the wind would push the boom
past the sheet's limit, the sail is pinned there and fills; otherwise it streams and flaps.

**Other forces.**
- Resistance along the hull: skin friction and wave making, `½ ρ S (C_f + C_w(Fn)) u|u|`,
  with wave drag growing as (Froude number / 0.4)⁴, so speed levels off near hull speed.
- Going backwards: bluff-body drag (Cd 1.2 on 60 % of beam × draft) plus a linear term
  at a crawl, so a stalled boat creeps back.
- Windage: air drag on hull, masts and rigging (`windageArea`), acting a quarter of the
  waterline ahead of the centre, so a boat with flapping sails falls off the wind.
- The Muleta's net: quadratic drag at the two boom tips.

**Inertia.** Mass plus the water the hull carries along: 1.05 × mass forward, **3 × mass
sideways**, 1.3 × the yaw inertia. Heel: a spring (metacentric height) with damping.

**Help in the game.** Balanced sails (easy and medium levels): the sails push at the centre of
lateral resistance so they do not turn the boat, the rudder steers as if the boat moved at
least 1.5 m/s, and a centred rudder damps a leftover turn. Easy also trims the sheets for the
best drive and leaves the sideways slip out of the track.

## 2. The tests

- Every run starts **from rest** and lasts **60 s**. The heading is **held fixed** (the boat
  cannot turn), the rudder is centred and the sheets do not move.
- Balanced sails, as in the medium level. Wind 12 kn (6.2 m/s), steady.
- Five studies:
  1. **Facing north, wind from N, E, S and W**, sheets half out.
  2. **Sheets hauled in** (0), wind from north, headings 000, 045, 090 and 180.
  3. **No sails set** (bare poles; "sails closed"), same headings.
  4. **Sheets half out** (0.5), same headings.
  5. **Sheets fully out** (1), same headings.
- With the wind from north, heading 000 is head to wind, 045 close-hauled, 090 a beam reach
  and 180 dead downwind. The Muleta is run in both modes; "bare poles" has no net.

## 3. What the first run found, and what changed

The first run (before the changes) showed one real problem: **close to the wind, a slow boat
slid sideways instead of gathering way.** At 045 with the sheets in, every boat ended up going
slightly backwards while sliding sideways at 1.0–1.4 kn, against 0.3–0.6 kn backwards head to
wind. The Muleta, Fragata and Catraio stayed stuck even after 200 s. This is what went wrong
after a tack: a boat coming out of it slowly, still pointing high, slid sideways and reached
that slide within seconds.

The forces explained it. With the sheets in, the boom sat at 6° while the apparent wind came
from 42°: the sail met the wind at 36°, stalled, and pushed only sideways and slightly
backwards (Falua: 2,850 N sideways, −189 N forward, every second of the minute). Even at the
best boom angle the sail tables gave a forward push one-seventh of the sideways push, because
their drag is high (best lift/drag 1.5; real cloth sails 3–5). And sideways the boat had little
inertia (0.6 × its mass of carried water; strip theory says 1–3 ×).

Candidate fixes, tested on the close-hauled start (sheets in, after 60 s):

| Change | Result | Side effect |
|---|---|---|
| Before | 0.4 kn backwards, 1.3 kn sideways | – |
| More hull sideways resistance (cross-flow 2.2) | still stuck | close-hauled speed 2.7 → 0.1 kn |
| More hull resistance only at steep slides | still stuck | close-hauled speed collapses too |
| More sideways inertia (3 × mass) | still stuck; the slide builds twice as slowly | none |
| Sail drag 60 % at small angles | 4 kn forward, 0.3 kn sideways | boats point to 30° |
| **Sail drag 60 % + sideways inertia 3 × mass + sails no closer than 20°** | **3.3–3.6 kn forward, 0.1–0.2 kn sideways** | no-go zone about ±36°; faster upwind |

More hull resistance makes things worse: the slide is not what holds the boat back. Sliding
swings the apparent wind forward, which helps the sail a little; stopping it leaves the sail
more stalled. The trap was in the sails. The last line was adopted.

## 4. Results now (12 kn, after 60 s from rest)

Surge / sway in knots:

| Boat | Sheets | 000 head to wind | 045 close-hauled | 090 beam reach | 180 downwind |
|---|---|---|---|---|---|
| Falua | in | −0.4 / 0 | **3.5 / 0.2** | 5.2 / 0.2 | 3.7 / −0.1 |
| | middle | −0.4 / 0 | −0.4 / 0.1 | **5.4** / 0.1 | 4.8 / 0 |
| | out | −0.4 / 0 | −0.4 / 0.1 | 1.7 / 0.1 | **5.1** / 0 |
| | bare poles | −0.3 / 0 | −0.3 / 0.1 | 0 / 0.3 | 1.0 / 0 |
| Muleta (regular) | in | −0.5 / 0 | **3.5 / 0.2** | 5.0 / 0.2 | 3.8 / −0.1 |
| | middle | −0.5 / 0 | −0.5 / 0.1 | **5.2** / 0.1 | 4.7 / 0 |
| | out | −0.5 / 0 | −0.5 / 0.1 | 1.7 / 0.1 | **5.0** / 0 |
| Muleta (fishing) | in | −0.3 / 0 | 0.2 / 1.0 | 0.5 / **1.0** | 0.7 / −0.3 |
| | middle | −0.3 / 0 | −0.1 / 0.4 | 1.1 / 0.5 | 1.0 / −0.2 |
| | out | −0.3 / 0 | −0.3 / 0.1 | 0.8 / 0.2 | 1.3 / −0.1 |
| Fragata | in | −0.4 / 0 | **3.4 / 0.2** | 5.6 / 0.2 | 3.7 / −0.1 |
| | middle | −0.4 / 0 | −0.4 / 0.1 | **5.7** / 0.1 | 5.1 / 0 |
| | out | −0.4 / 0 | −0.4 / 0.1 | 1.7 / 0.1 | **5.4** / 0 |
| Catraio | in | −0.5 / 0 | **3.3 / 0.1** | 4.6 / 0.1 | 3.6 / 0 |
| | middle | −0.5 / 0 | −0.4 / 0.1 | **4.9** / 0.1 | 4.5 / 0 |
| | out | −0.5 / 0 | −0.4 / 0.1 | 1.7 / 0 | **4.7** / 0 |
| Canoa | in | −0.5 / 0 | **3.6 / 0.2** | 4.8 / 0.2 | 3.7 / −0.1 |
| | middle | −0.5 / 0 | −0.5 / 0.1 | **5.0** / 0.1 | 4.5 / 0 |
| | out | −0.5 / 0 | −0.5 / 0.1 | 1.8 / 0.1 | **4.8** / 0 |

Before the changes, 045 with the sheets in gave −0.4 to −0.7 kn forward and 1.0–1.4 kn
sideways for every boat.

**Close-hauled from rest, sheets in** (forward / sideways, knots):

| Boat | 5 s | 10 s | 20 s | 60 s |
|---|---|---|---|---|
| Falua | 0.5 / 0.5 | 0.9 / 0.8 | 2.2 / 0.4 | 3.5 / 0.2 |
| Muleta | 0.6 / 0.7 | 1.2 / 0.9 | 2.7 / 0.3 | 3.5 / 0.2 |
| Fragata | 0.4 / 0.5 | 0.8 / 0.8 | 1.6 / 0.8 | 3.4 / 0.2 |
| Catraio | 0.5 / 0.6 | 1.3 / 0.6 | 2.5 / 0.2 | 3.3 / 0.1 |
| Canoa | 0.7 / 0.7 | 1.8 / 0.5 | 3.0 / 0.2 | 3.6 / 0.2 |

The boat first slips a little (up to 0.5–0.9 kn) while it gathers way, then the keel takes
hold and the slip falls to 0.1–0.2 kn: what a real boat does. The heavy Fragata is the slowest
to get going, the light Canoa the quickest.

**A tack, played like a player** (close-hauled at 50°, full rudder until 45° past the wind,
then let go; sheets left fully in; balanced sails; wind 6 m/s):

| Boat | Speed before | Lowest speed | Going backwards | Largest slide | Back to 75 % speed |
|---|---|---|---|---|---|
| Falua | 4.2 kn | 1.3 kn | never | 0.3 kn | 13 s |
| Muleta | 4.1 kn | 1.4 kn | never | 0.3 kn | 9 s |
| Fragata | 4.4 kn | 1.1 kn | never | 0.4 kn | 19 s |
| Catraio | 3.8 kn | 1.1 kn | never | 0.3 kn | 9 s |
| Canoa | 4.1 kn | 1.8 kn | never | 0.3 kn | 5 s |

With the sheets left half out close to the wind the sails flap before and after the tack (the
game warns "haul in the sheets"); the boat then drifts back for 13–56 s until it is trimmed.

### What else the results show

- **Symmetry.** Wind from the east and from the west give the same speeds (5.4 kn for the
  Falua) with heel and side forces of opposite sign.
- **Sheet trim follows sailing theory.** Close-hauled: fully in is best (half out flaps).
  Beam reach: half out is best (4.9–5.7 kn), fully in is close (4.6–5.6 kn), fully out flaps
  (1.7 kn). Downwind: fully out is best (4.7–5.4 kn).
- **Weight is felt.** Ten seconds after starting on a beam reach (sheets middle): Canoa 4.1 kn,
  Muleta 3.8, Catraio 3.6, Falua 2.8, Fragata 2.5.
- **Head to wind** every boat drifts back at 0.3–0.5 kn, a little less than before.
- **Heel** on a beam reach: 1.7–2.5° with the sheets half out, 3.4–4.8° hauled in; the Canoa
  4.5° and 8.4°.
- **Speed polars** (6 m/s, best sheet): no progress below about 35°; at 45° 3.2–3.6 kn (was
  2.3–2.7), beam reach 5.1–6.3 kn (was 4.9–6), downwind unchanged.

### Still to look at

- **The Muleta in fishing mode** drifts best with the sheets **hauled in** (1.0 kn sideways,
  0.5 kn forward on the beam). With the sheets half out it now moves forward more than
  sideways (1.1 / 0.5 kn), which wastes the net. The game starts fishing with the sheets in;
  the fishing instructions should say to keep them in.
- **The no-go zone** is now about ±36°, a little closer than the ±45° in the paper. Raising
  the 20° limit to 22° gives about ±38°; check against how the real boats point.
- **Lateen tacks are identical.** On the real Falua and Canoa the lateen sail sets differently
  on each tack (on one tack the yard presses against the mast); the model treats both alike.

## 5. Changes made

- `src/physics/foil.ts`: sail drag scaled to 60 % at small angles (`SAIL_DRAG_SCALE`).
- `src/physics/simulator.ts`: sideways mass 3 × the boat's mass (`SWAY_MASS`, was 1.6).
- `src/physics/boats/*.ts`: `minAngle` 20° for every working sail (was 4–8°).
- `ForceReport` includes the windage force; `scripts/physics-study.ts` and `npm run study`.
- `docs/PHYSICS.md` updated with the model and the new speed figures.
