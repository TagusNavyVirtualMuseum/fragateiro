// One force model for every "wing" on the boat: sails in the air, keel strips and
// the rudder in the water. A foil has a chord direction (leading edge -> trailing edge)
// and sees a flow; it produces lift (perpendicular to the flow) and drag (along it).
//
//   F = 1/2 * rho * |V|^2 * A * (CL * n + CD * v̂)
//
// All vectors are 2D, in whatever frame the caller uses (we use the boat frame:
// x = forward, y = starboard).

import { SAIL_DRAG, SAIL_LIFT } from './sailTables';

export interface Coefficients {
  cl: number;
  cd: number;
}

export type CoefficientCurve = (alphaDeg: number) => Coefficients;

export interface FoilForce {
  fx: number;
  fy: number;
  /** Angle of attack in degrees, 0..180. */
  alphaDeg: number;
  lift: number;
  drag: number;
}

const ZERO: FoilForce = { fx: 0, fy: 0, alphaDeg: 0, lift: 0, drag: 0 };

/**
 * @param cx,cy  unit chord vector, from leading edge to trailing edge
 * @param vx,vy  velocity of the fluid relative to the foil (m/s)
 */
export function foilForce(
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  area: number,
  rho: number,
  curve: CoefficientCurve,
): FoilForce {
  const speed = Math.hypot(vx, vy);
  if (speed < 1e-6 || area <= 0) return ZERO;
  const ux = vx / speed;
  const uy = vy / speed;
  const cosA = Math.max(-1, Math.min(1, cx * ux + cy * uy));
  const alphaDeg = (Math.acos(cosA) * 180) / Math.PI;
  const { cl, cd } = curve(alphaDeg);

  // The foil turns the flow towards its chord, so the reaction (lift) points the other way:
  // n = -(c - (c·v̂) v̂), normalised.
  let nx = -(cx - cosA * ux);
  let ny = -(cy - cosA * uy);
  const nl = Math.hypot(nx, ny);
  if (nl > 1e-9) {
    nx /= nl;
    ny /= nl;
  } else {
    nx = 0;
    ny = 0;
  }

  const q = 0.5 * rho * speed * speed * area;
  const lift = q * cl;
  const drag = q * cd;
  return {
    fx: lift * nx + drag * ux,
    fy: lift * ny + drag * uy,
    alphaDeg,
    lift,
    drag,
  };
}

function interpolate(table: readonly number[], deg: number): number {
  const d = Math.max(0, Math.min(table.length - 1, deg));
  const i = Math.floor(d);
  const t = d - i;
  const a = table[i];
  const b = table[Math.min(i + 1, table.length - 1)];
  return a + (b - a) * t;
}

/**
 * Soft cambered sail, from the original simulator's tables. A flapping sail (angle of
 * attack below ~10°) gets less drag than the table gives (a fifth at 0°, like a flag), so a
 * boat keeps its way through a tack and does not sail backwards in irons.
 */
export function sailCurve(efficiency = 1): CoefficientCurve {
  return (alphaDeg) => {
    const luffing = Math.min(1, alphaDeg / 10);
    return {
      cl: interpolate(SAIL_LIFT, alphaDeg) * efficiency,
      cd: interpolate(SAIL_DRAG, alphaDeg) * (0.2 + 0.8 * luffing),
    };
  };
}

/**
 * Symmetric underwater foil (keel strip or rudder).
 * Lift grows linearly up to the stall angle, then fades to flat-plate behaviour.
 * Drag includes cross-flow drag, so a hull pushed sideways is strongly resisted.
 */
export function hydrofoilCurve(slopePerRad: number, stallDeg: number, cd0 = 0.01): CoefficientCurve {
  const deg = Math.PI / 180;
  const flatPlateCl = (a: number) => 1.1 * Math.sin(a * deg) * Math.cos(a * deg);
  const clStall = slopePerRad * stallDeg * deg;
  const one = (a: number): Coefficients => {
    let cl: number;
    if (a <= stallDeg) {
      cl = slopePerRad * a * deg;
    } else {
      const blend = Math.exp(-(a - stallDeg) / 10);
      cl = flatPlateCl(a) + (clStall - flatPlateCl(stallDeg)) * blend;
    }
    const s = Math.sin(a * deg);
    return { cl, cd: cd0 + 1.1 * s * s };
  };
  // Flow arriving from the trailing edge (boat moving backwards): mirror the curve.
  return (alphaDeg) => {
    if (alphaDeg <= 90) return one(alphaDeg);
    const c = one(180 - alphaDeg);
    return { cl: -c.cl, cd: c.cd };
  };
}
