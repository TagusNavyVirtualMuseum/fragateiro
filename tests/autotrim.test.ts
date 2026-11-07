import { describe, expect, it } from 'vitest';
import { BOATS, SailboatSim, SteadyWind, autoTrimSheets, deg2rad, polar, toKnots } from '../src/physics';

/** Speed on a fixed heading with the sheets trimmed automatically every step. */
function autoSpeed(boat: (typeof BOATS)[number], twaDeg: number, wind: number): number {
  const sim = new SailboatSim(boat, new SteadyWind(0, wind), { heading: deg2rad(-twaDeg) });
  sim.lockHeading = true;
  for (let t = 0; t < 200; t += 1 / 30) {
    sim.controls.sheets = { ...sim.controls.sheets, ...autoTrimSheets(boat, sim.controls.mode, sim.report.apparentWindAngleDeg || twaDeg) };
    sim.step(1 / 30);
  }
  return toKnots(sim.state.u);
}

describe('easy level: sails trim themselves', () => {
  for (const boat of BOATS) {
    it(`${boat.name} sails nearly as fast as with the best trim`, () => {
      const best = new Map(polar(boat, boat.modes[0].id, 6, [60, 90, 135]).map((p) => [p.twaDeg, p.surgeKn]));
      for (const twa of [60, 90, 135]) {
        expect(autoSpeed(boat, twa, 6)).toBeGreaterThan(0.85 * best.get(twa)!);
      }
    });
  }
});
