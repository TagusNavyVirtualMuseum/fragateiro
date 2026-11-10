import { describe, expect, it } from 'vitest';
import { DIVE_TIME, STRIKE_DISTANCE, SURFACE_TIME, WhaleHunt, isAstern } from '../src/world/whaling';
import { LandMask } from '../src/world/landMask';

function openWater(): LandMask {
  const n = 600;
  const water = new Uint8Array(n * n).fill(255);
  const mask = new LandMask({ width: n, height: n, cellSize: 20, northWest: { x: -6000, y: 6000 }, origin: { lat: 0, lon: 0 }, places: [] } as never, water);
  mask.markReachableFrom(0, 0);
  return mask;
}
const seeded = (seed = 1) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
};

describe('whaling', () => {
  it('a whale heading north has its blind sector to the south', () => {
    const w = { x: 0, y: 0, heading: 0, phase: 'surface' as const, since: 0, frightened: false };
    expect(isAstern(w, 0, -50)).toBe(true);
    expect(isAstern(w, 30, -50)).toBe(true);
    expect(isAstern(w, 50, 0)).toBe(false);
    expect(isAstern(w, 0, 50)).toBe(false);
  });

  it('is struck when reached from astern while at the surface', () => {
    const h = new WhaleHunt(openWater(), { x: 0, y: 0 }, 0, seeded(2));
    const w = h.whale;
    const behind = { x: w.x - Math.sin(w.heading) * (STRIKE_DISTANCE - 5), y: w.y - Math.cos(w.heading) * (STRIKE_DISTANCE - 5) };
    expect(h.update(behind, 1, 0.1)).toBe('struck');
    expect(h.struck).toBe(true);
  });

  it('takes fright and sounds when approached from ahead', () => {
    const h = new WhaleHunt(openWater(), { x: 0, y: 0 }, 0, seeded(3));
    const w = h.whale;
    const ahead = { x: w.x + Math.sin(w.heading) * 60, y: w.y + Math.cos(w.heading) * 60 };
    expect(h.update(ahead, 1, 0.1)).toBe('fright');
    expect(h.visible).toBe(true); // the tail goes up first
    for (let t = 1; t < 10; t += 0.5) h.update({ x: 99999, y: 99999 }, t, 0.5);
    expect(h.visible).toBe(false);
    expect(h.frights).toBe(1);
  });

  it('breathes, dives and comes up again further on', () => {
    const h = new WhaleHunt(openWater(), { x: 0, y: 0 }, 0, seeded(4));
    const far = { x: 99999, y: 99999 };
    const p0 = { x: h.whale.x, y: h.whale.y };
    let t = 0;
    for (; t < SURFACE_TIME + 10; t += 0.5) h.update(far, t, 0.5);
    expect(h.whale.phase).toBe('dive');
    for (; t < SURFACE_TIME + 10 + DIVE_TIME + 5; t += 0.5) h.update(far, t, 0.5);
    expect(h.whale.phase).toBe('surface');
    expect(Math.hypot(h.whale.x - p0.x, h.whale.y - p0.y)).toBeGreaterThan(150);
  });
});
