# Sailing physics

The model lives in `src/physics/` and follows the paper (section 3.2), simplified so it is
small, stable and easy to explain. It is a **planar** model: the boat moves on a flat sea,
with three degrees of freedom (surge, sway, yaw), plus a one-degree heel model. Waves are
only drawn; they do not push the boat.

## Frames and units

SI units. Boat frame: **x forward, y starboard**, yaw rate *r* positive when turning to
starboard (the standard ship-manoeuvring convention). World frame: x east, y north, heading
measured clockwise from north.

## One force model for everything: the foil

Sails, the keel and the rudder are all *foils*. A foil with chord direction **c** (leading
edge to trailing edge) in a flow of velocity **V** has an angle of attack α between **c**
and **V**, and produces

```
F = ½ ρ |V|² A (C_L(α) n + C_D(α) V̂)
```

where V̂ is the flow direction and **n** is perpendicular to it, on the side opposite to where
the foil turns the flow (`src/physics/foil.ts`).

- **Sails:** ρ = 1.204 kg/m³. C_L and C_D come from the original simulator's tables (one value
  per degree), with the drag scaled to 60 % at small angles of attack, rising back to the full
  table value at 90° (`SAIL_DRAG_SCALE`). The yacht tables give a best lift/drag of only about
  1.5, where cloth sails reach 3–5; with it, close-hauled sails pushed about seven times more
  sideways than forward, and a slow boat could not gather way (see
  [physics-study](physics-study/README.md)). Now the best lift/drag is about 2.5. The flow is
  the **apparent wind** at the sail's centre of effort: true wind minus the boat's velocity
  (including the rotation).
- **Keel and hull:** the underwater side area is cut into 6 strips over the middle part of the
  hull (`lateralSpan`, half the waterline length by default), each a low-aspect-ratio wing (linear lift up to stall, then flat-plate behaviour, plus cross-flow
  drag). Strips at different positions see different flows when the boat turns, which gives
  yaw damping for free, and a hull pushed sideways (the Muleta fishing) meets strong drag.
- **Rudder:** one foil at the stern, turned by the helm.

## Sails and sheets

A sail on its own streams downwind like a flag. The **sheet** only limits how far the boom
can swing out (`minAngle` with the sheet hauled in, `maxAngle` fully eased). Traditional
rigs (lateen yards, sprits, gaffs) cannot be hauled as flat as a yacht's boom, so `minAngle`
is 20° for every working sail (the Muleta's small fishing sails on the net booms keep 4°).
This also sets the no-go zone. So:

- if the wind would push the boom further than the sheet allows, the sail is pinned at the
  limit and fills (α > 0: lift and drag);
- otherwise it streams with α ≈ 0 and **flaps** (no drive).

A flapping sail gets about a fifth of the table's drag (rising back to the table value at
10° angle of attack), so a boat keeps its way and can tack. This one rule produces the
behaviours from the paper: no progress head to wind (sails flap),
a no-go zone of about ±36°, sails hauled in when close-hauled, half-way on a beam reach and
fully out when running, and gybes when the wind crosses the stern. The sail angle follows its
target with a 0.35 s lag so manoeuvres look natural.

## Resistance

- Skin friction and wave making, along the boat: `R = ½ ρ S (C_f + C_w(Fn)) u|u|`, with the
  wetted surface `S = 2.6 √(∇ L)` (from the original code) and `C_w` growing as `(Fn/0.4)⁴`,
  so speed levels off near hull speed.
- Windage: air drag on hull, masts and rigging (`windageArea`), which hurts upwind sailing.
- Going backwards, the hull is blunt (the flow separates at the stern, rudder and keel):
  extra drag with Cd 1.2 on 60 % of beam × draft, plus a linear term (mass / 15 s) at a
  crawl, so a boat stopped head to wind only creeps backwards instead of sailing backwards.
- The windage acts a quarter of the waterline ahead of the centre (masts, high bow and
  rigging), so a boat with flapping sails falls off the wind until they fill again. With
  balanced sails the extra yaw damping fades out below 1 m/s for the same reason.

## Equations of motion

With added masses (1.05 m in surge, 3 m in sway, 1.3 × the yaw inertia). Sideways, a hull
drags a lot of water with it (strip theory gives about π/2 ρ T² L, one to three times the
boat's mass for these hulls), so a sideways slide builds up slowly:

```
m_u (du/dt − v r) = X
m_v (dv/dt + u r) = Y
I_z dr/dt         = N
I_x d²φ/dt² = M_heel − m g GM sin φ − c dφ/dt
```

X, Y, N are the sums of all forces and moments above. The heeling moment is the sails' side
force times their height; heel reduces the sail force by cos φ. Integration is semi-implicit
Euler at 120 Hz.

## Muleta fishing

In *lateral fishing* mode every sail is set and the net is dragged from the bow and stern
boom tips (quadratic drag at each tip). With the boat beam-on to the wind and the sheets
hauled in, the sails mostly push sideways, so the boat drifts slowly to leeward (about 1 kn in
6 m/s of wind). Front and rear sails act at the two ends of the boat: trimming one against the
other turns it, which is how the fishermen kept it square to the wind. The rudder does little
at that speed.

## Tuning

Mass, stability and resistance values are estimates. `npm run polar [wind m/s]` prints the
best speed at each wind angle for every boat and mode. At 6 m/s (the paper's test wind) the
current values give, for the Falua: nothing below about 35°, 2.7 kn at 40°, 3.6 kn at 45°,
5.7 kn on a beam reach and 5 kn running. The Muleta: 3.5 kn at 45°, 5.5 kn on a beam reach;
the Fragata: 3.6 kn at 45°, 6.3 kn on a beam reach; the Catraio: 3.2 kn at 45°, 5.1 kn on a
beam reach; the Canoa (52 m² lateen and a 10 m² mizzen on a narrow 5 t hull): 3.6 kn at 45°, 5.3 kn on a beam
reach, heeling up to about 10°. Close-hauled the best setting is sheets fully in.
The masses (Falua 15 t, Muleta 7 t, Fragata 30 t part-loaded, Catraio 5 t, Canoa 5 t) are estimates; they are what makes each boat feel different
(how it carries its way through a tack and how quickly it picks up speed). Heel stays under about 5° (the Canoa about 10°) and leeway around 0.1–0.2 kn in this wind
(stability and hull grip were doubled after play-testing). `npm run study` runs a set of fixed
situations and logs every force; see [physics-study](physics-study/README.md).

The game runs the simulation 3× faster than real time by default (setting: 1×, 2×, 3×, 5×,
10×), so the speeds shown stay realistic while trips take less time. The default wind is
12 kn.

## Levels

The game's levels change only the help, never the boats:

- **Easy:** every step, each sail's sheet is set to the value that gives the most forward
  drive for the wind it feels (`SailboatSim.bestSheets()`, a search over the sail's own lift
  and drag curves; tested to match the best sheet setting within 5 %), and the track leaves
  out the sideways slip (`noDrift`: the hull still works as usual, so speeds are unchanged).
  Balanced sails.
- **Medium:** the player trims; balanced sails.
- **Hard:** not balanced, so none of the low-speed steering help below. The Catraio and Canoa
  only get through the wind if the sheets are eased while turning, as on the real boats.

## Balanced sails

Real boats are rarely balanced: the sails push at their centres of effort, which are not over
the hull's centre of lateral resistance, so a boat wants to turn into or away from the wind,
and the sideways drift also pushes on the rudder. With *Balanced sails* (on by default in
the game) the sail forces act at the centre of lateral resistance and the rudder ignores the
drift, so with the rudder centred the boat holds its course. To keep it easy at low speed
(just after a tack), the rudder also steers as if the boat moved at least 1.5 m/s, never
reverses when the boat drifts backwards, and a centred rudder stops a leftover turn within a
few seconds. Speeds and heel are unchanged. These are more realistic than the Unity version (which
had copied yacht parameters), but should be checked with people who sail these boats. The
tests in `tests/physics.test.ts` check behaviour (no-go zone, sheet settings, steering,
heel, fishing drift), not exact numbers, so tuning does not break them.
