// Speed polars: how fast a boat goes at each true wind angle, with the best sheet setting.
// Used by the tests and by `npm run polar` to tune the boat definitions.

import { SailboatSim, groupsInMode } from './simulator';
import type { BoatSpec } from './types';
import { SteadyWind, deg2rad, toKnots } from './wind';

export interface SteadyResult {
  /** Forward speed, knots. */
  surgeKn: number;
  /** Sideways speed (+ = to starboard), knots. */
  swayKn: number;
  heelDeg: number;
}

/**
 * Sail on a fixed heading until the speed settles.
 * Wind comes from the north; twaDeg > 0 puts the wind on the starboard side.
 */
export function steadyState(
  spec: BoatSpec,
  mode: string,
  twaDeg: number,
  windSpeed: number,
  sheet: number | Record<string, number>,
  seconds = 200,
): SteadyResult {
  const sim = new SailboatSim(spec, new SteadyWind(0, windSpeed), { heading: deg2rad(-twaDeg) });
  sim.lockHeading = true;
  sim.controls.mode = mode;
  for (const g of groupsInMode(spec, mode)) sim.controls.sheets[g] = typeof sheet === 'number' ? sheet : (sheet[g] ?? 0.5);
  sim.stepFixed(seconds, 1 / 30);
  const s = sim.state;
  return { surgeKn: toKnots(s.u), swayKn: toKnots(s.v), heelDeg: (s.heel * 180) / Math.PI };
}

export interface PolarPoint extends SteadyResult {
  twaDeg: number;
  bestSheet: number;
}

/** Best forward speed at each angle, trying sheet settings from hauled-in to eased. */
export function polar(spec: BoatSpec, mode: string, windSpeed: number, angles: number[], sheetSteps = 10): PolarPoint[] {
  return angles.map((twaDeg) => {
    let best: PolarPoint = { twaDeg, bestSheet: 0, surgeKn: -Infinity, swayKn: 0, heelDeg: 0 };
    for (let i = 0; i <= sheetSteps; i++) {
      const sheet = i / sheetSteps;
      const r = steadyState(spec, mode, twaDeg, windSpeed, sheet);
      if (r.surgeKn > best.surgeKn) best = { twaDeg, bestSheet: sheet, ...r };
    }
    return best;
  });
}
