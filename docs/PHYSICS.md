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
  per degree). The flow is the **apparent wind** at the sail's centre of effort: true wind
  minus the boat's velocity (including the rotation).
- **Keel and hull:** the underwater side area is cut into 6 strips along the hull, each a
  low-aspect-ratio wing (linear lift up to stall, then flat-plate behaviour, plus cross-flow
  drag). Strips at different positions see different flows when the boat turns, which gives
  yaw damping for free, and a hull pushed sideways (the Muleta fishing) meets strong drag.
- **Rudder:** one foil at the stern, turned by the helm.

## Sails and sheets

A sail on its own streams downwind like a flag. The **sheet** only limits how far the boom
can swing out (`minAngle` with the sheet hauled in, `maxAngle` fully eased). So:

- if the wind would push the boom further than the sheet allows, the sail is pinned at the
  limit and fills (α > 0: lift and drag);
- otherwise it streams with α ≈ 0 and **flaps** (no drive).

This one rule produces the behaviours from the paper: no progress head to wind (sails flap),
a no-go zone of about ±45°, sails centred when close-hauled, half-way on a beam reach and
fully out when running, and gybes when the wind crosses the stern. The sail angle follows its
target with a 0.35 s lag so manoeuvres look natural.

## Resistance

- Skin friction and wave making, along the boat: `R = ½ ρ S (C_f + C_w(Fn)) u|u|`, with the
  wetted surface `S = 2.6 √(∇ L)` (from the original code) and `C_w` growing as `(Fn/0.4)⁴`,
  so speed levels off near hull speed.
- Windage: air drag on hull, masts and rigging (`windageArea`), which hurts upwind sailing.

## Equations of motion

With added masses (1.05 m in surge, 1.6 m in sway, 1.3 × the yaw inertia):

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
current values give, for the Falua: nothing below about 42°, 2.4 kn at 45°, 5.4 kn on a beam
reach and 5 kn running. These are more realistic than the Unity version (which
had copied yacht parameters), but should be checked with people who sail these boats. The
tests in `tests/physics.test.ts` check behaviour (no-go zone, sheet settings, steering,
heel, fishing drift), not exact numbers, so tuning does not break them.
