# Physics study of the boat models

How the five boat models behave in a set of fixed situations, to check the physics and find
what feels wrong in the game. Run it again after any change to the physics or the boats:

```bash
npm run study                 # wind 12 kn (the game's default)
npm run study -- --wind 8     # another wind speed, knots
```

`scripts/physics-study.ts` writes the full time series (one row per boat, case and second:
speed, heel, apparent wind, every force, sail angles, angle of attack, which sails flap) to
`data/*.csv`, and summary tables to [results.md](results.md). This page is the reading of
those results (12 kn of wind, November 2026).

## Set-up

- Every run starts **from rest** and lasts **60 s**. The heading is **held fixed** (the boat
  cannot turn), the rudder is centred and the sheets do not move.
- Balanced sails, as in the game's medium level. Wind 12 kn (6.2 m/s), steady.
- Boat frame: *surge* = forward speed, *sway* = sideways speed (+ = to starboard).
- Five studies:
  1. **Facing north, wind from N, E, S and W**, sheets half out.
  2. **Sheets hauled in** (0), wind from north, headings 000, 045, 090 and 180.
  3. **No sails set** (bare poles; "sails closed"), same headings.
  4. **Sheets half out** (0.5), same headings.
  5. **Sheets fully out** (1), same headings (added to complete the picture).
- With the wind from north, heading 000 is head to wind, 045 close-hauled, 090 a beam reach
  and 180 dead downwind. The Muleta is run in both modes; "bare poles" has no net.

## Speeds after 60 s (surge / sway, knots)

| Boat | | 000 head to wind | 045 close-hauled | 090 beam reach | 180 downwind |
|---|---|---|---|---|---|
| Falua | sheets in | −0.5 / 0 | **−0.4 / +1.3** | 3.9 / 0.3 | 3.7 / 0 |
| | sheets middle | −0.5 / 0 | −0.4 / 0.4 | **5.5** / 0.1 | 4.7 / 0 |
| | sheets out | −0.5 / 0 | −0.4 / 0.2 | 1.7 / 0.1 | **5.1** / 0 |
| | bare poles | −0.3 / 0 | −0.2 / 0.2 | 0 / 0.3 | 1.0 / 0 |
| Muleta (regular) | sheets in | −0.6 / 0 | **−0.6 / +1.3** | 4.0 / 0.3 | 3.8 / 0 |
| | sheets middle | −0.6 / 0 | −0.6 / 0.4 | **5.3** / 0.2 | 4.6 / 0 |
| | sheets out | −0.6 / 0 | −0.5 / 0.2 | 1.7 / 0.1 | **5.0** / 0 |
| Muleta (fishing) | sheets in | −0.3 / 0 | −0.1 / 1.1 | 0.3 / **1.1** | 0.7 / −0.2 |
| | sheets middle | −0.3 / 0 | −0.1 / 0.5 | 0.8 / 0.9 | 1.0 / −0.2 |
| | sheets out | −0.3 / 0 | −0.2 / 0.2 | 0.8 / 0.3 | 1.3 / −0.1 |
| Fragata | sheets in | −0.5 / 0 | **−0.4 / +1.4** | 4.0 / 0.3 | 3.7 / −0.1 |
| | sheets middle | −0.5 / 0 | −0.4 / 0.5 | **5.9** / 0.2 | 4.9 / 0 |
| | sheets out | −0.5 / 0 | −0.4 / 0.2 | 1.7 / 0.1 | **5.4** / 0 |
| Catraio | sheets in | −0.6 / 0 | **−0.5 / +1.0** | 3.7 / 0.2 | 3.7 / 0 |
| | sheets middle | −0.6 / 0 | −0.5 / 0.2 | **5.0** / 0.1 | 4.3 / 0 |
| | sheets out | −0.6 / 0 | −0.5 / 0.1 | 1.7 / 0.1 | **4.7** / 0 |
| Canoa | sheets in | −0.6 / 0 | **−0.7 / +1.2** | 3.9 / 0.3 | 3.7 / 0 |
| | sheets middle | −0.6 / 0 | −0.6 / 0.2 | **5.1** / 0.1 | 4.4 / 0 |
| | sheets out | −0.6 / 0 | −0.6 / 0.1 | 1.7 / 0.1 | **4.8** / 0 |

Bare poles for all boats: 0.3–0.4 kn backwards head to wind, 0.3–0.4 kn sideways on the
beam, 1.0–1.6 kn downwind.

## Findings

### What works

- **Symmetry.** Wind from the east and from the west give the same speeds, with heel and
  side forces of opposite sign (study 1). Port and starboard tacks behave alike.
- **Sail trim follows sailing theory.** On a beam reach half-out sheets are fastest (5–5.9 kn);
  hauled in the sails are over-trimmed (3.7–4 kn, more heel); fully out they flap (1.7 kn).
  Downwind, fully out is fastest (4.7–5.4 kn). Head to wind every sail flaps whatever the sheet.
- **Weight is felt.** Ten seconds after starting on a beam reach (sheets middle): Canoa 3.9 kn,
  Muleta 3.6, Catraio 3.4, Falua 2.7, Fragata 2.4. The 30 t Fragata takes the longest to get
  going but ends fastest (5.9 kn, longest waterline).
- **Forces balance.** At 60 s the sails' side force is matched by the hull and rudder (for
  example the Fragata on a beam reach: sails 5,135 N sideways, hull 5,536 N back), and the
  forward drive by resistance (2,967 N against 2,581 N, still accelerating slightly).
- **Head to wind** every boat drifts backwards at 0.3–0.6 kn and stays there: the sternway
  damping added after play-testing holds it to a creep.
- **Heel** stays at 3–6° on a beam reach; the narrow Canoa heels most (7.5°, 10.9° with the
  sheets hauled in), as intended.

### Problem 1: close-hauled from a standstill, boats slide sideways instead of moving off

At 045 with the sheets hauled in, every boat ends up going **slightly backwards while sliding
sideways at 1.0–1.4 kn**. A separate check at the best close-hauled sheet (0.1), for 200 s:

| Boat | From rest: forward / sideways after 200 s | Already at 5 kn: after 200 s |
|---|---|---|
| Falua | 2.7 / 0.4 kn (gets going after ~2 minutes) | 2.8 / 0.3 kn |
| Muleta | **0.5 / 1.4 kn (stuck)** | 2.8 / 0.4 kn |
| Fragata | **0.4 / 1.4 kn (stuck)** | 2.8 / 0.4 kn |
| Catraio | **0.7 / 1.0 kn (stuck)** | 2.4 / 0.3 kn |
| Canoa | 2.8 / 0.3 kn | 2.8 / 0.3 kn |

So close-hauled has **two steady states**: a boat already moving keeps 2.4–2.9 kn, but a boat
that starts (or slows down) close to the wind gets stuck sliding sideways. This is the most
likely cause of the trouble after a tack: a boat that comes out of the tack slowly, still
pointing high, slides sideways instead of picking up speed until the player bears away.

Why: with no forward speed, the water reaches the keel from the side, far beyond its stall
angle (25°), so the hull grips like a flat plate. It lets the boat slide, and that sideways
motion swings the apparent wind so the sails stay stalled. Real boats do slip at low speed,
but not this much, and they gather way within seconds.

Possible fixes (not made yet):
- keep more lateral grip at large leeway angles (a gentler stall in the hull curve), and/or
  more cross-flow drag, so the sideways slip at low speed stays small;
- in the game, ease the sheets automatically for a few seconds after a tack (easy level
  already trims for the best drive and is not affected);
- teach it: "bear away to build speed, then come up" is the real technique.

### Problem 2: the Muleta in fishing mode drifts forward as much as sideways

On the beam with the sheets half out it moves 0.8 kn forward and 0.9 kn sideways, which wastes
half the net's sweep. With the sheets **hauled in** it drifts almost purely sideways (1.1 kn,
0.3 kn forward): the best way to fish. Either say so in the fishing instructions or trim the
fishing mode so the forward drive is smaller.

### Smaller notes

- **Lateen tacks are identical.** On the real Falua and Canoa the lateen sail sets differently
  on each tack (on one tack the yard presses against the mast); the model treats both tacks
  the same.
- **Bare poles downwind** reach 1.0–1.6 kn: plausible for hull and rigging windage alone.
- The Muleta's fishing mode carries 8 sails, but head to wind it backs only 0.3 kn (less than
  the other boats) because the net's drag holds it.

## Changes made for this study

- `ForceReport` now includes the **windage** force (air drag on hull and rigging), so it can
  be logged.
- New script `scripts/physics-study.ts` and `npm run study`.
