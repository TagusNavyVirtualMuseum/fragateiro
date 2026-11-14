import { describe, expect, it } from 'vitest';
import { ALONGSIDE_SPEED, PICK_RADIUS, SupplyRun, TRANSFER_TIME, TrashField, touching } from '../src/world/challenges';
import { LandMask } from '../src/world/landMask';

/** Open water 4 km square, centred on the origin. */
function openWater(): LandMask {
  const n = 200;
  const water = new Uint8Array(n * n).fill(255);
  const mask = new LandMask({ width: n, height: n, cellSize: 20, northWest: { x: -2000, y: 2000 }, origin: { lat: 0, lon: 0 }, places: [] } as never, water);
  mask.markReachableFrom(0, 0);
  return mask;
}

/** A repeatable random sequence. */
function seeded(seed = 1): () => number {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe('clean-up', () => {
  it('scatters the pieces apart, in water, away from the start', () => {
    const f = new TrashField(openWater(), { x: 0, y: 0 }, 12, seeded(3));
    expect(f.items.length).toBe(12);
    for (const a of f.items) {
      expect(Math.hypot(a.x, a.y)).toBeGreaterThan(180);
      for (const b of f.items) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(140);
    }
  });

  it('picks up a piece the boat passes over, once', () => {
    const f = new TrashField(openWater(), { x: 0, y: 0 }, 5, seeded(5));
    const p = f.items[0];
    expect(f.update(p.x + PICK_RADIUS * 2, p.y, 1)).toEqual([]);
    expect(f.update(p.x + PICK_RADIUS / 2, p.y, 2)).toEqual([p]);
    expect(f.update(p.x, p.y, 3)).toEqual([]);
    expect(f.left).toBe(4);
    expect(f.nearest(p.x, p.y)).not.toBe(p);
  });
});

describe('supply run', () => {
  it('needs a slow, long enough stay alongside, then the trip home', () => {
    const r = new SupplyRun({ x: 1000, y: 0 }, { x: 0, y: 0 }, 150);
    // Rushing past does not count.
    r.update(1000, 10, ALONGSIDE_SPEED * 3, 5);
    expect(r.phase).toBe('out');
    // Alongside and slow: the transfer runs...
    r.update(1000, 10, 0.3, TRANSFER_TIME / 2);
    expect(r.phase).toBe('alongside');
    // ...pauses when the boat drifts off...
    r.update(1100, 10, 0.3, 5);
    expect(r.phase).toBe('out');
    // ...and goes on where it stopped.
    r.update(1000, 10, 0.3, TRANSFER_TIME / 2);
    expect(r.phase).toBe('home');
    expect(r.goal).toEqual({ x: 0, y: 0 });
    expect(r.update(500, 0, 3, 1)).toBe(false);
    expect(r.update(100, 0, 3, 1)).toBe(true);
  });
});

describe('collisions', () => {
  it('two hulls side by side touch; a boat length apart they do not', () => {
    expect(touching({ x: 0, y: 0, length: 10 }, { x: 4, y: 0, length: 10 })).toBe(true);
    expect(touching({ x: 0, y: 0, length: 10 }, { x: 10, y: 0, length: 10 })).toBe(false);
  });
});

describe('editions', () => {
  it('the museum edition is shorter in every challenge', async () => {
    const { EDITIONS } = await import('../src/world/edition');
    const m = EDITIONS.museum;
    const h = EDITIONS.home;
    expect(m.regattaLength).toBeLessThan(h.regattaLength);
    expect(m.trashCount).toBeLessThan(h.trashCount);
    expect(m.trashRadius).toBeLessThan(h.trashRadius);
    expect(m.transferTime).toBeLessThan(h.transferTime);
    expect(m.maxRoute).toBeLessThan(h.maxRoute);
    expect(m.timeScale).toBe(3); // the mini-games start at ×3, like the home edition
  });

  it('a supply run takes the transfer time it is given', () => {
    const r = new SupplyRun({ x: 0, y: 0 }, { x: 1000, y: 0 }, 150, 10);
    r.update(5, 0, 0.2, 9);
    expect(r.phase).toBe('alongside');
    r.update(5, 0, 0.2, 1.5);
    expect(r.phase).toBe('home');
  });
});
