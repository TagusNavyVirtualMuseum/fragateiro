// Land / water lookup for a map built by scripts/fetch-map.mjs.
// Plain TypeScript (no browser), so the game rules can be tested.

export interface MapMeta {
  cellSize: number;
  width: number;
  height: number;
  /** World position (metres east, north of the origin) of the mask's north-west corner. */
  northWest: { x: number; y: number };
  origin: { lat: number; lon: number };
  places: { name: string; kind: string; x: number; y: number }[];
}

export class LandMask {
  /**
   * @param water one byte per cell, row 0 = north edge; 255 = water, 0 = land
   *              (values in between along the shore, from the smoothing)
   */
  constructor(
    readonly meta: MapMeta,
    readonly water: Uint8Array,
  ) {
    if (water.length !== meta.width * meta.height) throw new Error('mask size does not match the map metadata');
  }

  /** Width and height of the map in metres. */
  get sizeMetres(): { width: number; height: number } {
    return { width: this.meta.width * this.meta.cellSize, height: this.meta.height * this.meta.cellSize };
  }

  /** Centre of the map, world metres. */
  get centre(): { x: number; y: number } {
    const s = this.sizeMetres;
    return { x: this.meta.northWest.x + s.width / 2, y: this.meta.northWest.y - s.height / 2 };
  }

  /** 0 (land) .. 1 (water), smoothly interpolated. Outside the map counts as water. */
  wetness(x: number, y: number): number {
    const m = this.meta;
    const fx = (x - m.northWest.x) / m.cellSize - 0.5;
    const fy = (m.northWest.y - y) / m.cellSize - 0.5;
    if (fx < 0 || fy < 0 || fx >= m.width - 1 || fy >= m.height - 1) return 1;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const i = y0 * m.width + x0;
    const w = this.water;
    const top = w[i] + (w[i + 1] - w[i]) * tx;
    const bottom = w[i + m.width] + (w[i + m.width + 1] - w[i + m.width]) * tx;
    return (top + (bottom - top) * ty) / 255;
  }

  isWater(x: number, y: number): boolean {
    return this.wetness(x, y) >= 0.5;
  }

  /** Nearest water point to (x, y), searching outwards in rings of one cell. */
  nearestWater(x: number, y: number, maxMetres = 3000): { x: number; y: number } {
    if (this.isWater(x, y)) return { x, y };
    const step = this.meta.cellSize;
    for (let r = step; r <= maxMetres; r += step) {
      const n = Math.max(8, Math.ceil((2 * Math.PI * r) / step));
      for (let k = 0; k < n; k++) {
        const a = (2 * Math.PI * k) / n;
        const px = x + r * Math.cos(a);
        const py = y + r * Math.sin(a);
        if (this.isWater(px, py)) return { x: px, y: py };
      }
    }
    return { x, y };
  }
}

/**
 * Is the hull clear of land? Checks the bow, the stern and the middle.
 * heading in radians (compass), length in metres.
 */
export function hullAfloat(mask: LandMask, x: number, y: number, heading: number, length: number): boolean {
  const h = length * 0.45;
  const dx = Math.sin(heading) * h;
  const dy = Math.cos(heading) * h;
  return mask.isWater(x, y) && mask.isWater(x + dx, y + dy) && mask.isWater(x - dx, y - dy);
}
