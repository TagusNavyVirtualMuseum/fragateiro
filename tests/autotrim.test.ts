import { describe, expect, it } from 'vitest';
import { BOATS, SailboatSim, SteadyWind, deg2rad, polar, toKnots } from '../src/physics';

/** Speed on a fixed heading with the easy-level trim applied every step. */
function easySpeed(boat: (typeof BOATS)[number], twaDeg: number, wind: number): { u: number; drift: number } {
  const sim = new SailboatSim(boat, new SteadyWind(0, wind), { heading: deg2rad(-twaDeg) });
  sim.lockHeading = true;
  sim.controls.noDrift = true;
  for (let t = 0; t < 200; t += 1 / 30) {
    Object.assign(sim.controls.sheets, sim.bestSheets());
    sim.step(1 / 30);
  }
  // Wind from the north, heading -twa: the track must stay on the heading.
  const track = Math.atan2(sim.state.x, sim.state.y);
  return { u: toKnots(sim.state.u), drift: Math.abs(Math.atan2(Math.sin(track - sim.state.heading), Math.cos(track - sim.state.heading))) };
}

describe('easy level', () => {
  for (const boat of BOATS) {
    it(`${boat.name}: the crew's trim is as good as the best sheet setting, and there is no drift`, () => {
      const angles = [50, 60, 90, 135, 170];
      const best = new Map(polar(boat, boat.modes[0].id, 6, angles, 20).map((p) => [p.twaDeg, p.surgeKn]));
      for (const twa of angles) {
        const r = easySpeed(boat, twa, 6);
        expect(r.u).toBeGreaterThan(0.95 * best.get(twa)!);
        expect(r.drift).toBeLessThan(1e-6);
      }
    });
  }
});
