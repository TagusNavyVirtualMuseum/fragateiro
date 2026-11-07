import { describe, expect, it } from 'vitest';
import { CATRAIO, FALUA, SailboatSim, SteadyWind } from '../src/physics';
import { pickWaypoint, steer, type Pilot } from '../src/world/autopilot';
import { LandMask, type MapMeta } from '../src/world/landMask';

// 40 x 40 km of open water, with land east of x = 15 km.
function openWater(): LandMask {
  const meta: MapMeta = { cellSize: 1000, width: 40, height: 40, northWest: { x: -20000, y: 20000 }, origin: { lat: 0, lon: 0 }, places: [] };
  const water = new Uint8Array(40 * 40);
  for (let r = 0; r < 40; r++) for (let c = 0; c < 40; c++) water[r * 40 + c] = c < 35 ? 255 : 0;
  return new LandMask(meta, water);
}

/** Sail with the autopilot for `seconds` of game time. */
function sail(sim: SailboatSim, pilot: Pilot, mask: LandMask, windFrom: number, seconds: number): void {
  let rand = 0.3;
  const next = () => (rand = (rand * 9301 + 49297) % 233280 / 233280);
  for (let t = 0; t < seconds; t += 0.1) {
    sim.controls.balanced = true;
    steer(sim, pilot, windFrom, mask, next);
    sim.step(0.1);
  }
}

describe('autopilot', () => {
  const mask = openWater();
  const wind = new SteadyWind(0, 6); // from the north

  it('sails across the wind to a waypoint', () => {
    const sim = new SailboatSim(CATRAIO, wind, { heading: Math.PI / 2 - 0.3, u: 1 });
    const pilot: Pilot = { wx: 5000, wy: 0, tack: 1, nextTack: 0, lastTack: 0 };
    sail(sim, pilot, mask, 0, 300);
    expect(sim.state.x).toBeGreaterThan(400);
    expect(Math.abs(sim.state.y)).toBeLessThan(300);
  });

  it('beats upwind by tacking', () => {
    const sim = new SailboatSim(FALUA, wind, { heading: 1, u: 1.5 });
    const pilot: Pilot = { wx: 0, wy: 8000, tack: 1, nextTack: 120, lastTack: 0 };
    let sides = new Set<number>();
    for (let i = 0; i < 6; i++) {
      sail(sim, pilot, mask, 0, 100);
      sides.add(pilot.tack);
    }
    expect(sim.state.y).toBeGreaterThan(300); // made ground to windward
    expect(sides.size).toBe(2); // on both tacks
  });

  it('picks waypoints in open water', () => {
    for (let i = 0; i < 20; i++) {
      const w = pickWaypoint(mask, 10000, 0);
      expect(w).not.toBeNull();
      expect(mask.isWater(w!.x, w!.y)).toBe(true);
    }
  });
});
