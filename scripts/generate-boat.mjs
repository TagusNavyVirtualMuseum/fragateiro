// Builds a boat's 3D model (.glb) from a few numbers: length, beam, weight, the sheer line,
// the stem, masts, sail corners, rudder. For boats we have pictures and plans of but no model.
//
//   node scripts/generate-boat.mjs scripts/boats/canoa.mjs src/assets/models/canoa.glb
//
// The hull's depth is found so that it floats at the given weight. The script also prints
// the numbers the physics needs (areas, centres, pivots), to copy into src/physics/boats/.
//
// Coordinates in the parameter file: s = metres aft of the bow (at the sheer), y = metres
// above the waterline, z = metres to port. The model frame matches the other boats: x
// along the hull with the bow towards -x (x = s - length/2), y up, z across (port +z).

import { Document, NodeIO } from '@gltf-transform/core';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [, , paramFile, outFile] = process.argv;
if (!paramFile || !outFile) {
  console.error('usage: node scripts/generate-boat.mjs <params.mjs> <out.glb>');
  process.exit(1);
}
const P = (await import(pathToFileURL(path.resolve(paramFile)).href)).default;
const L = P.length;
const B = P.beam;
const H = P.hull;

// ---------- Hull shape ----------

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

/** Height of the sheer (top of the hull side) at s. */
function sheer(s) {
  const u = s / L;
  const { mid, lowAt, bowRise, sternRise } = H.sheer;
  const fwd = Math.max(0, (lowAt - u) / lowAt);
  const aft = Math.max(0, (u - lowAt) / (1 - lowAt));
  return mid + bowRise * fwd * fwd + sternRise * aft * aft;
}

/** Depth of the hull bottom below the waterline at s (before the stem curves up). */
let depth = 0.6;
function keelY(s) {
  const reach = H.stemReach;
  const d = depth * (1 + (H.drag ?? 0) * clamp((s - reach) / (L - reach), 0, 1));
  if (s >= reach) return -d;
  // The stem: from the sheer at the bow it curves down and aft into the keel.
  const u = s / reach;
  const top = sheer(0);
  return top - (top + d) * (1 - (1 - u) * (1 - u));
}

/** Half-breadth at the widest point of the section at s. */
function halfBeam(s) {
  const u = clamp(s / L, 0, 1);
  const k = Math.log(0.5) / Math.log(H.maxBeamAt);
  return (B / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, k)), H.planFullness ?? 0.5);
}

/** Half-breadth at height y in the section at s. */
function halfWidth(s, y) {
  const k = keelY(s);
  const T = sheer(s);
  if (T - k < 1e-6) return 0;
  const h = clamp((y - k) / (T - k), 0, 1);
  const u = clamp(s / L, 0, 1);
  // Round bilge amidships, finer (more V-shaped) towards the ends.
  const p = lerp(1, H.bilge, Math.sin(Math.PI * u));
  const hb = H.widestAt ?? 0.8;
  const g = h <= hb ? Math.pow(Math.sin((Math.PI / 2) * (h / hb)), p) : 1 - (H.tumblehome ?? 0) * ((h - hb) / (1 - hb));
  return halfBeam(s) * g;
}

/** Underwater volume and its centre (s). */
function buoyancy() {
  const n = 240;
  let vol = 0;
  let mom = 0;
  for (let i = 0; i < n; i++) {
    const s = ((i + 0.5) / n) * L;
    const k = keelY(s);
    const top = Math.min(0, sheer(s));
    if (top <= k) continue;
    let area = 0;
    const m = 40;
    for (let j = 0; j < m; j++) area += 2 * halfWidth(s, k + ((j + 0.5) / m) * (top - k)) * ((top - k) / m);
    vol += area * (L / n);
    mom += area * (L / n) * s;
  }
  return { vol, cb: mom / Math.max(vol, 1e-9) };
}

// Find the depth that floats the boat at its weight.
{
  const target = P.mass / 1025;
  let lo = 0.1;
  let hi = 3;
  for (let i = 0; i < 50; i++) {
    depth = (lo + hi) / 2;
    if (buoyancy().vol > target) hi = depth;
    else lo = depth;
  }
}
const { vol, cb } = buoyancy();

// ---------- Mesh helpers ----------

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene(P.name);
const materials = new Map();

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function material(name, hex, opts = {}) {
  const key = name;
  if (materials.has(key)) return materials.get(key);
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255));
  const m = doc
    .createMaterial(name)
    .setBaseColorFactor([...rgb, 1])
    .setMetallicFactor(0)
    .setRoughnessFactor(opts.roughness ?? 0.85)
    .setDoubleSided(!!opts.doubleSided);
  materials.set(key, m);
  return m;
}

const X = (s) => s - L / 2; // s (aft of bow) -> model x

/** A mesh from positions and triangles (smooth normals). parts: [{ material, indices }]. */
function addMesh(name, positions, parts, normals) {
  const pos = new Float32Array(positions.flat());
  const nrm = normals ? new Float32Array(normals.flat()) : smoothNormals(pos, parts.flatMap((p) => p.indices));
  const posAcc = doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buffer);
  const nrmAcc = doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer);
  const mesh = doc.createMesh(name);
  for (const part of parts) {
    if (!part.indices.length) continue;
    const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(part.indices)).setBuffer(buffer);
    mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', posAcc).setAttribute('NORMAL', nrmAcc).setIndices(idx).setMaterial(part.material));
  }
  scene.addChild(doc.createNode(name).setMesh(mesh));
}

function smoothNormals(pos, idx) {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      n[i] += nx;
      n[i + 1] += ny;
      n[i + 2] += nz;
    }
  }
  for (let i = 0; i < n.length; i += 3) {
    const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
    n[i] /= l;
    n[i + 1] /= l;
    n[i + 2] /= l;
  }
  return n;
}

/** Flat-shaded mesh from a list of triangles [[p, q, r], ...] (counter-clockwise = outside). */
function addFlat(name, tris, mat) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (const [a, b, c] of tris) {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const l = Math.hypot(...nn) || 1;
    nn = nn.map((x) => x / l);
    for (const p of [a, b, c]) {
      indices.push(positions.length);
      positions.push(p);
      normals.push(nn);
    }
  }
  addMesh(name, positions, [{ material: mat, indices }], normals);
}

/** Grid of points rows[i][j] -> triangles; flip reverses the facing. */
function gridIndices(ni, nj, offset, flip, partOf) {
  const parts = new Map();
  for (let i = 0; i < ni - 1; i++)
    for (let j = 0; j < nj - 1; j++) {
      const a = offset + i * nj + j, b = offset + (i + 1) * nj + j, c = offset + i * nj + j + 1, d = offset + (i + 1) * nj + j + 1;
      const tri = flip ? [a, c, b, b, c, d] : [a, b, c, b, d, c];
      const key = partOf ? partOf(j) : 0;
      if (!parts.has(key)) parts.set(key, []);
      parts.get(key).push(...tri);
    }
  return parts;
}

/** A tube along a path of points with radius r(t), t = 0..1. */
function tube(name, pts, r, mat, sides = 10) {
  const positions = [];
  const indices = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(n - 1, i + 1)];
    const o = pts[Math.max(0, i - 1)];
    let d = [q[0] - o[0], q[1] - o[1], q[2] - o[2]];
    const dl = Math.hypot(...d);
    d = d.map((x) => x / dl);
    // Any vector not parallel to d gives the ring's plane.
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
    const l1 = Math.hypot(...e1);
    e1 = e1.map((x) => x / l1);
    const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
    const rad = r(i / (n - 1));
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      positions.push([0, 1, 2].map((m) => p[m] + rad * (Math.cos(a) * e1[m] + Math.sin(a) * e2[m])));
    }
  }
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < sides; k++) {
      const a = i * (sides + 1) + k, b = a + sides + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  // End caps.
  for (const [i, sgn] of [[0, 1], [n - 1, -1]]) {
    const c = positions.length;
    positions.push(pts[i]);
    for (let k = 0; k < sides; k++) {
      const a = i * (sides + 1) + k;
      if (sgn > 0) indices.push(c, a + 1, a);
      else indices.push(c, a, a + 1);
    }
  }
  addMesh(name, positions, [{ material: mat, indices }]);
}

/** Straight spar between two points (s, y, z), tapering from r0 to r1 (and r2 at the end). */
function spar(name, a, b, r0, r1, mat, mid = null) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([X(lerp(a[0], b[0], t)), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]);
  }
  const rf = mid ? (t) => lerp(r0, mid, 1 - Math.abs(2 * t - 1)) + (r1 - r0) * 0 : (t) => lerp(r0, r1, t);
  tube(name, pts, rf, mat);
}

/** Box from centre (s, y, z) and size (along, up, across). */
function boxTris(c, size) {
  const [cx, cy, cz] = [X(c[0]), c[1], c[2]];
  const [hx, hy, hz] = size.map((v) => v / 2);
  const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  const quad = (a, b, cc, d) => [[a, b, cc], [a, cc, d]];
  return [
    ...quad(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)),
    ...quad(v(1, -1, -1), v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1)),
    ...quad(v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1), v(-1, 1, -1)),
    ...quad(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)),
    ...quad(v(1, -1, 1), v(1, -1, -1), v(1, 1, -1), v(1, 1, 1)),
    ...quad(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)),
  ];
}

/** A flat plate (thickness t) between an upper and a lower outline in the (s, y) plane at z. */
function plateTris(top, bot, t, z = 0) {
  const tris = [];
  const P3 = ([s, y], dz) => [X(s), y, z + dz];
  const h = t / 2;
  for (let i = 0; i < top.length - 1; i++) {
    const [a, b, c, d] = [top[i], top[i + 1], bot[i], bot[i + 1]];
    // port face (+z) and starboard face (-z)
    tris.push([P3(a, h), P3(c, h), P3(b, h)], [P3(b, h), P3(c, h), P3(d, h)]);
    tris.push([P3(a, -h), P3(b, -h), P3(c, -h)], [P3(b, -h), P3(d, -h), P3(c, -h)]);
    // top and bottom edges
    tris.push([P3(a, h), P3(b, h), P3(b, -h)], [P3(a, h), P3(b, -h), P3(a, -h)]);
    tris.push([P3(c, h), P3(d, -h), P3(d, h)], [P3(c, h), P3(c, -h), P3(d, -h)]);
  }
  const ends = [[top[0], bot[0], 1], [top[top.length - 1], bot[bot.length - 1], -1]];
  for (const [a, c, sg] of ends) {
    if (sg > 0) tris.push([P3(a, h), P3(a, -h), P3(c, -h)], [P3(a, h), P3(c, -h), P3(c, h)]);
    else tris.push([P3(a, h), P3(c, -h), P3(a, -h)], [P3(a, h), P3(c, h), P3(c, -h)]);
  }
  return tris;
}

// ---------- Hull ----------

const C = H.colors;
const NS = 72;
const stations = Array.from({ length: NS + 1 }, (_, i) => (L * (1 - Math.cos((Math.PI * i) / NS))) / 2); // finer at the ends
{
  // Rows in paint bands (absolute heights), so colour edges are sharp.
  const bands = [
    { mat: material('Bottom', C.bottom), to: () => H.paint.bottomTop, n: 10 },
    { mat: material('Topsides', C.topsides), to: (T) => T - H.paint.wale - H.paint.stripe, n: 8 },
    { mat: material('Stripe', C.stripe, { roughness: 0.4 }), to: (T) => T - H.paint.wale, n: 1 },
    { mat: material('Wale', C.wale), to: (T) => T, n: 3 },
  ];
  const rowsPer = bands.reduce((a, b) => a + b.n, 0) + bands.length; // duplicated rows at band edges
  const bandOfRow = [];
  bands.forEach((b, bi) => {
    for (let j = 0; j <= b.n; j++) bandOfRow.push(bi);
  });
  const outer = [];
  const inner = [];
  for (const s of stations) {
    const k = keelY(s);
    const T = sheer(s);
    let lo = k;
    const col = [];
    for (const b of bands) {
      const hi = clamp(b.to(T), lo, T);
      for (let j = 0; j <= b.n; j++) col.push(lerp(lo, hi, j / b.n));
      lo = hi;
    }
    outer.push(col.map((y) => [X(s), y, halfWidth(s, y)]));
    inner.push(col.map((y) => [X(s), y, Math.max(0, halfWidth(s, y) - H.planking)]));
  }
  // Port side (+z) and starboard (mirror), outer skin in paint bands.
  const positions = [];
  const partIdx = bands.map(() => []);
  for (const side of [1, -1]) {
    const off = positions.length;
    for (const col of outer) for (const p of col) positions.push([p[0], p[1], side * p[2]]);
    const g = gridIndices(outer.length, rowsPer, off, side < 0, (j) => bandOfRow[j] === bandOfRow[j + 1] ? bandOfRow[j] : -1);
    for (const [bi, idx] of g) if (bi >= 0) partIdx[bi].push(...idx);
  }
  addMesh('Casco', positions, bands.map((b, i) => ({ material: b.mat, indices: partIdx[i] })));

  // Inside of the planking, facing in.
  const ipos = [];
  const iidx = [];
  for (const side of [1, -1]) {
    const off = ipos.length;
    for (const col of inner) for (const p of col) ipos.push([p[0], p[1], side * p[2]]);
    for (const [, idx] of gridIndices(inner.length, rowsPer, off, side > 0)) iidx.push(...idx);
  }
  addMesh('Interior', ipos, [{ material: material('Interior', C.interior), indices: iidx }]);

  // Gunwale cap: the top edge between the outer and inner skins.
  const cap = [];
  for (const side of [1, -1]) {
    for (let i = 0; i < NS; i++) {
      const o0 = outer[i][rowsPer - 1], o1 = outer[i + 1][rowsPer - 1];
      const n0 = inner[i][rowsPer - 1], n1 = inner[i + 1][rowsPer - 1];
      const f = (p, dy = 0.025) => [p[0], p[1] + dy, side * p[2]];
      const tri = [[f(o0), f(n0), f(o1)], [f(o1), f(n0), f(n1)]];
      cap.push(...(side > 0 ? tri.map(([a, b, c]) => [a, c, b]) : tri));
      // Outer edge of the cap.
      const e = [[f(o0, 0), f(o0), f(o1)], [f(o0, 0), f(o1), f(o1, 0)]];
      cap.push(...(side > 0 ? e.map(([a, b, c]) => [a, c, b]) : e));
    }
  }
  addFlat('Borda', cap, material('Wale', C.wale));

  // Floor boards.
  const fy = H.floor;
  const floor = [];
  for (let i = 0; i < NS; i++) {
    const [s0, s1] = [stations[i], stations[i + 1]];
    const w0 = Math.max(0, halfWidth(s0, fy) - H.planking - 0.01), w1 = Math.max(0, halfWidth(s1, fy) - H.planking - 0.01);
    if (keelY(s0) > fy || keelY(s1) > fy) continue;
    const a = [X(s0), fy, w0], b = [X(s1), fy, w1], c = [X(s1), fy, -w1], d = [X(s0), fy, -w0];
    floor.push([a, b, c], [a, c, d]);
  }
  addFlat('Pavimento', floor, material('Floor', C.floor));

  // Thwarts (seats across the boat).
  const thw = [];
  for (const s of H.thwarts) {
    const y = sheer(s) - 0.3;
    const w = halfWidth(s, y) - H.planking;
    thw.push(...boxTris([s, y, 0], [0.25, 0.04, 2 * w]));
  }
  addFlat('Bancos', thw, material('Floor', C.floor));

  // Keel and stem post: a plank along the bottom.
  const top = [];
  const bot = [];
  for (let i = 0; i <= 60; i++) {
    const s = lerp(H.keel.from, L, i / 60);
    top.push([s, keelY(s) + 0.05]);
    bot.push([s, keelY(s) - H.keel.depth]);
  }
  addFlat('Quilha', plateTris(top, bot, 0.1), material('Bottom', C.bottom));
}

// ---------- Masts, spars, sails ----------

const spars = material('Spar', C.spar, { roughness: 0.6 });
const canvas = material('Sail', C.sail, { doubleSided: true });
const report = { sails: [], masts: {} };

for (const m of P.masts) {
  const rake = (m.rakeDeg * Math.PI) / 180; // + = top leans aft
  const base = [m.s, m.foot, m.z ?? 0];
  const top = [m.s + Math.tan(rake) * (m.top - m.foot), m.top, m.z ?? 0];
  spar(m.id === 'main' ? 'Mastro' : `Mastro_${m.id}`, base, top, m.radius, m.radius * 0.6, spars);
  report.masts[m.id] = { base, top };
}

for (const sp of P.spars ?? []) spar(sp.name, sp.from, sp.to, sp.radius, sp.radius * 0.6, spars);

for (const sl of P.sails) {
  const { throat, peak, clew, tack } = sl.corners;
  const z = sl.z;
  // Yard from throat to peak, thickest near the mast.
  spar(sl.yardName, [...throat, z], [...peak, z], sl.yardRadius * 0.5, sl.yardRadius * 0.5, spars, sl.yardRadius);
  // Sail: a grid between the four corners, with a little belly (fullness) to port.
  const n = 12;
  const positions = [];
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const u = i / n; // throat-peak direction
      const v = j / n; // head (yard) to foot
      const headS = lerp(throat[0], peak[0], u), headY = lerp(throat[1], peak[1], u);
      const footS = lerp(tack[0], clew[0], u), footY = lerp(tack[1], clew[1], u);
      const belly = (sl.belly ?? 0) * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.2));
      positions.push([X(lerp(headS, footS, v)), lerp(headY, footY, v), z - 0.03 + belly]);
    }
  const [, idx] = [...gridIndices(n + 1, n + 1, 0, false)][0];
  addMesh(sl.sailName, positions, [{ material: canvas, indices: idx }]);

  // Area and centroid (s, y) of the quadrilateral.
  const poly = [throat, peak, clew, tack];
  let a2 = 0, cs = 0, cy = 0;
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % 4];
    const cr = x0 * y1 - x1 * y0;
    a2 += cr;
    cs += (x0 + x1) * cr;
    cy += (y0 + y1) * cr;
  }
  report.sails.push({ id: sl.id, mast: sl.mast, area: Math.abs(a2) / 2, cs: cs / (3 * a2), cy: cy / (3 * a2), clew: [X(clew[0]), clew[1], z] });
}

// ---------- Rudder and tiller ----------

const R = P.rudder;
{
  const top = R.blade.map(([s, y]) => [s, y]);
  const lead = R.pin.s;
  const outline = top; // trailing edge, from bottom to top
  const pinTop = [lead, outline[outline.length - 1][1]];
  const pinBot = [lead, outline[0][1]];
  // Plate between the pin line and the trailing edge.
  const t2 = outline.map((p) => p);
  const b2 = outline.map(([, y]) => [lead + (R.pin.rake ?? 0) * (y - pinBot[1]), y]);
  addFlat('Leme', plateTris(b2, t2, 0.06), material('Wale', C.wale));
  void pinTop;
  spar('Cana', R.tiller.from, R.tiller.to, R.tiller.radius, R.tiller.radius * 0.7, spars);
}

// Rudder area and centre (from the outline).
let rArea = 0, rMom = 0;
for (let i = 0; i < R.blade.length - 1; i++) {
  const [[s0, y0], [s1, y1]] = [R.blade[i], R.blade[i + 1]];
  const yA = Math.min(0, y0), yB = Math.min(0, y1);
  const chord = ((s0 + s1) / 2 - R.pin.s);
  const dy = Math.max(0, yB - yA);
  rArea += chord * dy;
  rMom += chord * dy * (R.pin.s + chord / 2);
}

await new NodeIO().write(outFile, doc);

// ---------- Numbers for the physics ----------

const sCG = cb;
let latA = 0, latM = 0;
for (let i = 0; i < 400; i++) {
  const s = ((i + 0.5) / 400) * L;
  const hgt = Math.max(0, Math.min(0, sheer(s)) - (keelY(s) - (s >= H.keel.from ? H.keel.depth : 0)));
  latA += hgt * (L / 400);
  latM += hgt * (L / 400) * s;
}
let wlLen = 0;
for (let i = 0; i < 400; i++) if (halfWidth(((i + 0.5) / 400) * L, 0) > 0.01) wlLen += L / 400;
const f = (v) => +v.toFixed(2);
console.log(`Wrote ${outFile}`);
console.log({
  displacement_m3: f(vol),
  hullDepthBelowWaterline: f(depth),
  draftWithKeel: f(depth + H.keel.depth),
  waterlineLength: f(wlLen),
  cgX_model: f(X(sCG)),
  lateralArea: f(latA),
  lateralCentre_fwdOfCG: f(sCG - latM / latA),
  rudder: { area: f(rArea), x: f(sCG - rMom / Math.max(rArea, 1e-9)) },
  sails: report.sails.map((s) => {
    const m = report.masts[s.mast].base;
    return { id: s.id, area: f(s.area), pivotFwd: f(sCG - m[0]), ceDistance: f(s.cs - m[0]), ceHeight: f(s.cy), clew: s.clew.map(f) };
  }),
  masts: Object.fromEntries(Object.entries(report.masts).map(([k, v]) => [k, { base: [f(X(v.base[0])), f(v.base[1]), v.base[2]], top: [f(X(v.top[0])), f(v.top[1]), v.top[2]] }])),
  sheerAt: { bow: f(sheer(0)), mid: f(sheer(L / 2)), stern: f(sheer(L)) },
});
