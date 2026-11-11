// Geometry for the boat workshop: 2-D helpers on the side view (x along the boat, y up) and
// simple meshes (sails with a belly, round spars, a lofted hull). Plain TypeScript.

export type P2 = [number, number];
export type P3 = [number, number, number];

export interface MeshData {
  positions: number[];
  indices: number[];
}

/** Signed area and centroid of a polygon. */
export function polygonAreaCentroid(poly: P2[]): { area: number; cx: number; cy: number } {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    const c = x0 * y1 - x1 * y0;
    a2 += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  if (Math.abs(a2) < 1e-12) {
    const n = poly.length || 1;
    return { area: 0, cx: poly.reduce((s, p) => s + p[0], 0) / n, cy: poly.reduce((s, p) => s + p[1], 0) / n };
  }
  return { area: Math.abs(a2) / 2, cx: cx / (3 * a2), cy: cy / (3 * a2) };
}

export function pointInPolygon(p: P2, poly: P2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distToSegment(p: P2, a: P2, b: P2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Inside the polygon, or within `margin` of its edges. */
export function nearPolygon(p: P2, poly: P2[], margin: number): boolean {
  if (pointInPolygon(p, poly)) return true;
  for (let i = 0; i < poly.length; i++) if (distToSegment(p, poly[i], poly[(i + 1) % poly.length]) < margin) return true;
  return false;
}

/**
 * A square sail's curve seen from the side: from the yard through the belly (its furthest
 * point) to the foot, as a smooth arc of `n` + 1 points (a parabola through the three).
 */
export function bellyCurve(top: P2, belly: P2, foot: P2, n = 16): P2[] {
  // Control point of the quadratic Bezier that passes through the belly half way.
  const c: P2 = [2 * belly[0] - (top[0] + foot[0]) / 2, 2 * belly[1] - (top[1] + foot[1]) / 2];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [u * u * top[0] + 2 * u * t * c[0] + t * t * foot[0], u * u * top[1] + 2 * u * t * c[1] + t * t * foot[1]] as P2;
  });
}

/** The part of a polygon below y = level (Sutherland–Hodgman against one line). */
export function clipBelow(poly: P2[], level: number): P2[] {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ina = a[1] <= level;
    const inb = b[1] <= level;
    if (ina) out.push(a);
    if (ina !== inb) {
      const t = (level - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), level]);
    }
  }
  return out;
}

/** x of the line through a and b at height y. */
export function xAt(a: P2, b: P2, y: number): number {
  return Math.abs(b[1] - a[1]) < 1e-9 ? a[0] : a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
}

/** Piecewise-linear function through points (sorted by x), held flat beyond the ends. */
export function interp(pts: P2[], x: number): number {
  const s = [...pts].sort((p, q) => p[0] - q[0]);
  if (!s.length) return 0;
  if (x <= s[0][0]) return s[0][1];
  for (let i = 1; i < s.length; i++) if (x <= s[i][0]) return s[i - 1][1] + ((s[i][1] - s[i - 1][1]) * (x - s[i - 1][0])) / (s[i][0] - s[i - 1][0] || 1);
  return s[s.length - 1][1];
}

/**
 * A sail between its corners (3 or 4, in 3-D), as a grid with a belly to one side: the
 * first edge (corner 0 to 1) is the luff or the head, the rest follow round the sail.
 */
export function sailMesh(corners: P3[], belly: number, side: P3 = [0, 0, 1], n = 12): MeshData {
  // A triangle is a quad with two corners at the same place.
  const [a, b, c, d] = corners.length === 3 ? [corners[0], corners[1], corners[2], corners[0]] : corners;
  const lerp = (p: P3, q: P3, t: number): P3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const positions: number[] = [];
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const u = i / n;
      const v = j / n;
      const top = lerp(a, b, u);
      const bottom = lerp(d, c, u);
      const p = lerp(top, bottom, v);
      const k = belly * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.1));
      positions.push(p[0] + side[0] * k, p[1] + side[1] * k, p[2] + side[2] * k);
    }
  }
  const indices: number[] = [];
  const at = (i: number, j: number) => i * (n + 1) + j;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      // One face; the material is two-sided (two faces sharing vertices would cancel the
      // normals and shade in blotches).
      indices.push(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1));
    }
  }
  return { positions, indices };
}

/** A round spar from a to b, radius r0 at a and r1 at b. */
export function sparMesh(a: P3, b: P3, r0: number, r1 = r0, sides = 10): MeshData {
  const d: P3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d) || 1;
  const w: P3 = [d[0] / len, d[1] / len, d[2] / len];
  // Two directions across the spar.
  const ref: P3 = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u: P3 = [w[1] * ref[2] - w[2] * ref[1], w[2] * ref[0] - w[0] * ref[2], w[0] * ref[1] - w[1] * ref[0]];
  const ul = Math.hypot(...u) || 1;
  u[0] /= ul;
  u[1] /= ul;
  u[2] /= ul;
  const v: P3 = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
  const positions: number[] = [];
  for (const [p, r] of [
    [a, r0],
    [b, r1],
  ] as [P3, number][]) {
    for (let k = 0; k < sides; k++) {
      const t = (2 * Math.PI * k) / sides;
      const c = Math.cos(t) * r;
      const s = Math.sin(t) * r;
      positions.push(p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s);
    }
  }
  positions.push(...a, ...b);
  const indices: number[] = [];
  const ca = 2 * sides;
  const cb = ca + 1;
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    indices.push(k, k1, sides + k, k1, sides + k1, sides + k);
    indices.push(ca, k1, k, cb, sides + k, sides + k1);
  }
  return { positions, indices };
}

export interface HullShape {
  /** Bow and stern, side view (x, y). */
  bow: P2;
  stern: P2;
  /** The top edge of the side (sheer), and the bottom (keel), as points along the boat. */
  sheer: P2[];
  keel: P2[];
  /** Half the beam. */
  halfBeam: number;
  /** A flat transom (wide) stern instead of a pointed one. */
  transom: boolean;
}

/**
 * A hull lofted from its side profile: at each station the section runs from the keel up to
 * the sheer, rounder low down, the width following a plan shape that is widest a little
 * forward of the middle. Returns the outer skin (both sides) and the paint band of each
 * triangle (0 bottom, 1 topsides, 2 sheer strake).
 */
export function hullMesh(h: HullShape, stations = 48, rows = 12): MeshData & { band: number[] } {
  const x0 = Math.min(h.bow[0], h.stern[0]);
  const x1 = Math.max(h.bow[0], h.stern[0]);
  const bowLow = h.bow[0] < h.stern[0];
  const positions: number[] = [];
  const indices: number[] = [];
  const band: number[] = [];
  const plan = (u: number) => {
    // u: 0 at the bow, 1 at the stern.
    const fwd = Math.pow(Math.sin(Math.PI * Math.min(1, u / 0.9) * 0.5), 0.7);
    const aft = h.transom ? 0.55 + 0.45 * Math.cos(Math.PI * Math.max(0, (u - 0.45) / 0.55) * 0.5) : Math.pow(Math.sin(Math.PI * Math.min(1, (1 - u) / 0.55) * 0.5), 0.75);
    return Math.max(0, Math.min(fwd, aft));
  };
  for (const side of [1, -1]) {
    const off = positions.length / 3;
    for (let i = 0; i <= stations; i++) {
      const x = x0 + ((x1 - x0) * i) / stations;
      const u = bowLow ? (x - x0) / (x1 - x0) : (x1 - x) / (x1 - x0);
      const top = interp(h.sheer, x);
      const bottom = Math.min(top, interp(h.keel, x));
      const w = h.halfBeam * plan(u);
      for (let j = 0; j <= rows; j++) {
        const t = j / rows;
        const y = bottom + (top - bottom) * t;
        const z = w * Math.pow(t, 0.45) * (1 - 0.05 * t);
        positions.push(x, y, side * z);
      }
    }
    for (let i = 0; i < stations; i++) {
      for (let j = 0; j < rows; j++) {
        const a = off + i * (rows + 1) + j;
        const b = a + rows + 1;
        const tri = side > 0 ? [a, b, a + 1, b, b + 1, a + 1] : [a, a + 1, b, b, a + 1, b + 1];
        indices.push(...tri);
        const bandId = j < rows * 0.35 ? 0 : j >= rows - 1 ? 2 : 1;
        band.push(bandId, bandId);
      }
    }
  }
  return { positions, indices, band };
}

/**
 * Where a hull floats: the bottom of the hull as a height map (cell × cell metres), then
 * the water level at which the displaced volume equals `volume` m³. Also the centre of the
 * displaced volume (x), the waterline length, the draft, and the underwater side area and
 * its centre (x).
 */
export function floatHull(
  triangles: Iterable<[P3, P3, P3]>,
  volume: number,
  cell = 0.1,
): { level: number; cx: number; waterlineLength: number; draft: number; lateralArea: number; lateralCx: number; halfBeamAtWater: number } {
  const bottom = new Map<string, number>();
  const key = (i: number, k: number) => `${i},${k}`;
  for (const [a, b, c] of triangles) {
    // Sample each triangle at its corners and centre (dense enough for photo-made meshes).
    const m: P3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    for (const p of [a, b, c, m]) {
      const k = key(Math.floor(p[0] / cell), Math.floor(p[2] / cell));
      const v = bottom.get(k);
      if (v === undefined || p[1] < v) bottom.set(k, p[1]);
    }
  }
  const cells = [...bottom.entries()].map(([k, y]) => {
    const [i, j] = k.split(',').map(Number);
    return { x: (i + 0.5) * cell, z: (j + 0.5) * cell, y };
  });
  const vol = (h: number) => cells.reduce((s, c) => s + (h > c.y ? (h - c.y) * cell * cell : 0), 0);
  let lo = Math.min(...cells.map((c) => c.y));
  let hi = Math.max(...cells.map((c) => c.y)) + 5;
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (vol(mid) < volume) lo = mid;
    else hi = mid;
  }
  const level = lo;
  let v = 0;
  let mx = 0;
  let xmin = Infinity;
  let xmax = -Infinity;
  let draft = 0;
  let hb = 0;
  const depthAtX = new Map<number, number>();
  for (const c of cells) {
    if (level <= c.y) continue;
    const d = level - c.y;
    v += d;
    mx += d * c.x;
    xmin = Math.min(xmin, c.x - cell / 2);
    xmax = Math.max(xmax, c.x + cell / 2);
    draft = Math.max(draft, d);
    hb = Math.max(hb, Math.abs(c.z) + cell / 2);
    const i = Math.round(c.x / cell);
    depthAtX.set(i, Math.max(depthAtX.get(i) ?? 0, d));
  }
  let la = 0;
  let lm = 0;
  for (const [i, d] of depthAtX) {
    la += d * cell;
    lm += d * cell * i * cell;
  }
  return { level, cx: v ? mx / v : 0, waterlineLength: Math.max(0, xmax - xmin), draft, lateralArea: la, lateralCx: la ? lm / la : 0, halfBeamAtWater: hb };
}
