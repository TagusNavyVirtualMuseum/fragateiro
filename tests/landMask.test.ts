import { describe, expect, it } from 'vitest';
import { LandMask, hullAfloat, type MapMeta } from '../src/world/landMask';

// A 10 x 10 cell map (100 m cells): land in the eastern half (x >= 5).
function makeMask(): LandMask {
  const meta: MapMeta = { cellSize: 100, width: 10, height: 10, northWest: { x: -500, y: 500 }, origin: { lat: 0, lon: 0 }, places: [] };
  const water = new Uint8Array(100);
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) water[r * 10 + c] = c < 5 ? 255 : 0;
  return new LandMask(meta, water);
}

describe('LandMask', () => {
  const mask = makeMask();

  it('tells land from water', () => {
    expect(mask.isWater(-300, 0)).toBe(true);
    expect(mask.isWater(300, 0)).toBe(false);
  });

  it('counts the area outside the map as water', () => {
    expect(mask.isWater(5000, 0)).toBe(true);
  });

  it('is smooth across the shore', () => {
    // The shore is the boundary between cell 4 (water) and cell 5 (land), at x = 0.
    expect(mask.wetness(-60, 0)).toBe(1);
    expect(mask.wetness(0, 0)).toBeCloseTo(0.5, 5);
    expect(mask.wetness(60, 0)).toBe(0);
  });

  it('finds the nearest water', () => {
    const p = mask.nearestWater(150, 0); // shore 150 m west, map edge 300 m east
    expect(mask.isWater(p.x, p.y)).toBe(true);
    expect(p.x).toBeLessThan(0);
  });

  it('a boat is aground when its bow touches land', () => {
    // Heading east (90°), 40 m long, centre 10 m from the shore: the bow (18 m ahead) is on land.
    expect(hullAfloat(mask, -10, 0, Math.PI / 2, 40)).toBe(false);
    expect(hullAfloat(mask, -100, 0, Math.PI / 2, 40)).toBe(true);
  });

  it('rejects a mask of the wrong size', () => {
    expect(() => new LandMask({ ...mask.meta, width: 3 }, new Uint8Array(100))).toThrow();
  });
});

describe('destinations', () => {
  // 20 x 20 cells of 50 m: an open "estuary" in the west half, land in the east half with
  // a closed pond that must never be chosen.
  function estuary(): LandMask {
    const meta: MapMeta = {
      cellSize: 50, width: 20, height: 20, northWest: { x: 0, y: 1000 }, origin: { lat: 0, lon: 0 },
      places: [{ name: 'Town', kind: 'town', x: 760, y: 500 }],
    };
    const water = new Uint8Array(400);
    for (let r = 0; r < 20; r++) for (let c = 0; c < 20; c++) {
      const pond = r >= 9 && r <= 11 && c >= 14 && c <= 16;
      water[r * 20 + c] = c < 10 || pond ? 255 : 0;
    }
    return new LandMask(meta, water);
  }

  it('moors in the open water, not in the pond next to the town, facing open water', async () => {
    const { findDestinations } = await import('../src/world/destinations');
    const mask = estuary();
    mask.markReachableFrom(100, 500);
    const [d] = findDestinations(mask, 14, ['Town']);
    expect(d.name).toBe('Town');
    expect(d.x).toBeLessThan(500); // west of the shore at x = 500, not in the pond (x 700..850)
    expect(mask.isReachable(d.x, d.y)).toBe(true);
    expect(Math.sin(d.heading)).toBeLessThan(0); // bow pointing west, to open water
  });
});
