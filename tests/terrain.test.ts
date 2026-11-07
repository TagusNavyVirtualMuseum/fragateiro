import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/world/terrain';

describe('terrain heights', () => {
  // 3 x 2 cells of 10 m, values in decimetres above -100 m.
  const meta = { cellSize: 10, width: 3, height: 2, scale: 0.1, offset: -100 };
  const dm = (m: number) => (m + 100) * 10;
  const t = new Terrain(meta, { x: 0, y: 20 }, Uint16Array.from([dm(0), dm(10), dm(20), dm(0), dm(10), dm(20)]));

  it('reads the height at a cell centre', () => {
    expect(t.heightAt(5, 15)).toBeCloseTo(0);
    expect(t.heightAt(15, 15)).toBeCloseTo(10);
  });

  it('interpolates between cell centres', () => {
    expect(t.heightAt(10, 15)).toBeCloseTo(5);
    expect(t.heightAt(20, 5)).toBeCloseTo(15);
  });

  it('decodes an RGBA image (value = R * 256 + G)', () => {
    const v = dm(42);
    const rgba = new Uint8Array(6 * 4);
    for (let i = 0; i < 6; i++) [rgba[i * 4], rgba[i * 4 + 1]] = [v >> 8, v & 255];
    expect(Terrain.fromRGBA(meta, { x: 0, y: 20 }, rgba).heightAt(12, 8)).toBeCloseTo(42);
  });
});
