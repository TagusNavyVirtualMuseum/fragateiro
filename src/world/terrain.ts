// Land heights for a map built by scripts/fetch-map.mjs and scripts/fetch-heights.mjs.
// Plain TypeScript (no browser), so it can be tested.

export interface HeightsMeta {
  cellSize: number;
  width: number;
  height: number;
  /** height = value * scale + offset, in metres. */
  scale: number;
  offset: number;
}

export class Terrain {
  /**
   * @param northWest world position of the grid's north-west corner (the same corner as the
   *                  land mask), m east and north of the origin
   * @param values one value per cell, row 0 = north edge
   */
  constructor(
    readonly meta: HeightsMeta,
    readonly northWest: { x: number; y: number },
    readonly values: Uint16Array,
  ) {
    if (values.length !== meta.width * meta.height) throw new Error('height grid size does not match its metadata');
  }

  /** Decode an RGB(A) image: value = R * 256 + G. */
  static fromRGBA(meta: HeightsMeta, northWest: { x: number; y: number }, rgba: Uint8ClampedArray | Uint8Array, channels = 4): Terrain {
    const values = new Uint16Array(meta.width * meta.height);
    for (let i = 0; i < values.length; i++) values[i] = rgba[i * channels] * 256 + rgba[i * channels + 1];
    return new Terrain(meta, northWest, values);
  }

  /** Ground height at (x east, y north), metres; bilinear between cell centres. */
  heightAt(x: number, y: number): number {
    const m = this.meta;
    const fx = (x - this.northWest.x) / m.cellSize - 0.5;
    const fy = (this.northWest.y - y) / m.cellSize - 0.5;
    const x0 = Math.max(0, Math.min(m.width - 2, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(m.height - 2, Math.floor(fy)));
    const ax = Math.min(1, Math.max(0, fx - x0));
    const ay = Math.min(1, Math.max(0, fy - y0));
    const v = (c: number, r: number) => this.values[r * m.width + c] * m.scale + m.offset;
    const top = v(x0, y0) * (1 - ax) + v(x0 + 1, y0) * ax;
    const bottom = v(x0, y0 + 1) * (1 - ax) + v(x0 + 1, y0 + 1) * ax;
    return top * (1 - ay) + bottom * ay;
  }
}
