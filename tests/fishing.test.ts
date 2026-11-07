import { describe, expect, it } from 'vitest';
import { MULETA, SailboatSim, SteadyWind, deg2rad } from '../src/physics';
import { FishingGround, catchFish, type Shoal } from '../src/world/fishing';
import { LandMask, type MapMeta } from '../src/world/landMask';

const shoal = (): Shoal => ({ x: 0, y: 0, radius: 30, kg: 100, vx: 0, vy: 0 });

describe('fishing', () => {
  it('catches fish when the net is dragged sideways through a shoal', () => {
    const s = [shoal()];
    // A 20 m net across the shoal, moving sideways at 0.5 m/s for 60 s.
    const got = catchFish(s, { a: { x: -10, y: 0 }, b: { x: 10, y: 0 }, sway: 0.5, surge: 0 }, 60);
    expect(got).toBeGreaterThan(10);
    expect(s[0].kg).toBeCloseTo(100 - got);
  });

  it('catches little when sailing forward, and nothing when stopped or away from the shoal', () => {
    const net = { a: { x: -10, y: 0 }, b: { x: 10, y: 0 } };
    const sideways = catchFish([shoal()], { ...net, sway: 0.5, surge: 0 }, 60);
    expect(catchFish([shoal()], { ...net, sway: 0.5, surge: 3 }, 60)).toBeLessThan(sideways * 0.2);
    expect(catchFish([shoal()], { ...net, sway: 0.05, surge: 0 }, 60)).toBe(0);
    expect(catchFish([shoal()], { a: { x: -10, y: 100 }, b: { x: 10, y: 100 }, sway: 0.5, surge: 0 }, 60)).toBe(0);
  });

  it('a Muleta fishing beam-on drifts fast enough for the net to work', () => {
    const sim = new SailboatSim(MULETA, new SteadyWind(0, 6), { heading: deg2rad(90) });
    sim.controls.mode = 'fishing';
    for (const g of ['main', 'front', 'rear']) sim.controls.sheets[g] = 0.1;
    for (let t = 0; t < 120; t += 1 / 30) sim.step(1 / 30);
    expect(Math.abs(sim.state.v)).toBeGreaterThan(0.3);
  });

  it('keeps shoals in open water and replaces fished-out ones', () => {
    const meta: MapMeta = { cellSize: 100, width: 100, height: 100, northWest: { x: -5000, y: 5000 }, origin: { lat: 0, lon: 0 }, places: [] };
    const mask = new LandMask(meta, new Uint8Array(100 * 100).fill(255));
    const ground = new FishingGround(mask, { x: 0, y: 0 }, 4);
    expect(ground.shoals).toHaveLength(4);
    ground.shoals[0].kg = 0;
    ground.update(null, 1);
    expect(ground.shoals[0].kg).toBeGreaterThan(5);
  });
});
