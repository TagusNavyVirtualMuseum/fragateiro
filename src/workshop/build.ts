// The boat workshop's builder: from a one-piece model (from Meshy or a scan) or from a side
// photo, plus the points the user clicked on the side view, it makes a model the game can
// move (hull, each sail with its spars, the rudder), in metres with the waterline at 0, and
// the numbers the physics needs. Runs in the browser (tools/workshop) and in Node (tests).
import { Document, type Material, type Primitive } from '@gltf-transform/core';
import { prune, simplifyPrimitive, weldPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import type { BoatSpec, SailSpec } from '../physics/types';
import { RIGS, type RigType } from './rigs';
import { clipBelow, distToSegment, floatHull, hullMesh, nearPolygon, pointInPolygon, polygonAreaCentroid, sailMesh, sparMesh, xAt, type MeshData, type P2, type P3 } from './geometry';

export interface SailInput {
  id: string;
  rig: RigType;
  /** The rig's points, side view, in the source's units (see RIGS). */
  points: P2[];
  /** Keep the model's own sail (true) or build a new one from the points (false). */
  keep: boolean;
  /** Square sails: length of the yard across the boat, m. */
  yardLength?: number;
}

export interface RopeInput {
  a: P2;
  b: P2;
  /** Remove it, leave it with the hull (stays, shrouds), or move it with a sail. */
  mode: 'remove' | 'fixed' | 'sail';
  sail?: string;
}

export interface Project {
  source: 'model' | 'photo';
  info: {
    id: string;
    name: string;
    length: number;
    beam: number;
    mass: number;
    home: string;
    description: string;
    /** Metacentric height, m (empty: estimated from the beam). */
    gm?: number;
  };
  bow: P2;
  stern: P2;
  masts: { foot: P2; top: P2 }[];
  sails: SailInput[];
  /** Rudder blade outline, and the tiller. */
  rudder: P2[];
  tiller?: [P2, P2];
  ropes: RopeInput[];
  /**
   * Model mode: turn about the vertical (degrees) so the model is seen exactly from the side
   * (a model a few degrees off shows a square sail's yard as a bar). The built boat is turned
   * the same way.
   */
  turnDeg?: number;
  /** Outlines on the side view whose triangles always stay with the hull (fixes for wrong cuts). */
  hullAreas?: P2[][];
  /** Model mode: how far (source units) the sails stand off the centreline, the spars' and ropes' thickness. */
  sailWidth: number;
  sparRadius: number;
  ropeRadius: number;
  /** Photo mode: the hull's side profile and paint. */
  sheer: P2[];
  keel: P2[];
  transom: boolean;
  colors: { bottom: string; topsides: string; stripe: string; sail: string; spar: string };
}

export interface BuildOptions {
  /** Shrink textures (browser: through a canvas). */
  compressTexture?: (data: Uint8Array, mime: string) => Promise<{ data: Uint8Array; mime: string }>;
  simplify?: boolean;
  /** Triangle budgets per part. */
  budgets?: { hull: number; sail: number; rudder: number };
}

export interface BuildResult {
  doc: Document;
  spec: BoatSpec;
  /** The entry for src/engine/boatVisuals.ts (without the url). */
  visual: Record<string, unknown>;
  /** Measurements, for the report. */
  report: {
    waterlineLength: number;
    draft: number;
    cgX: number;
    triangles: Record<string, number>;
    level: number;
    /** Sail triangles another part took (inside a sail's outline), as messages for the user. */
    sailWarnings: string[];
  };
}

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace('#', ''), 16);
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)];
};

/** The mast a sail belongs to: the nearest to its first point. */
function mastOf(p: Project, s: SailInput): number {
  let best = 0;
  let bestD = Infinity;
  p.masts.forEach((m, i) => {
    const d = Math.min(...s.points.map((q) => distToSegment(q, m.foot, m.top)));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/**
 * A square sail's yard and foot: the top and bottom of its contour (older projects: the two
 * points clicked).
 */
function ends(s: SailInput): [P2, P2] {
  if (s.points.length < 3) return [s.points[0], s.points[s.points.length - 1]];
  const byY = [...s.points].sort((a, b) => b[1] - a[1]);
  return [byY[0], byY[byY.length - 1]];
}

/**
 * The sail's outline on the side view. A square sail: the contour clicked round it (older
 * projects: a thin strip from yard to foot).
 */
function outline(s: SailInput, width: number): P2[] {
  if (s.rig === 'square') {
    if (s.points.length >= 3) return s.points;
    const [a, b] = ends(s);
    return [
      [a[0] - width, a[1]],
      [a[0] + width, a[1]],
      [b[0] + width, b[1]],
      [b[0] - width, b[1]],
    ];
  }
  return s.points;
}

function sparsOf(s: SailInput): [P2, P2][] {
  const rig = RIGS[s.rig];
  return rig.spars.map(([na, nb]) => [s.points[rig.points.indexOf(na)], s.points[rig.points.indexOf(nb)]]);
}

/**
 * How far a model is turned off the side view (degrees, for `turnDeg`): the long axis of its
 * lower half (the hull, not the rig) in plan view.
 */
export function estimateTurn(doc: Document): number {
  const pts: number[][] = [];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const a = prim.getAttribute('POSITION')?.getArray();
      if (!a) continue;
      const step = Math.max(3, Math.floor(a.length / 3 / 20000) * 3); // a sample is enough
      for (let i = 0; i < a.length; i += step) {
        const [x, y, z] = [a[i], a[i + 1], a[i + 2]];
        pts.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
      }
    }
  }
  if (!pts.length) return 0;
  const ys = pts.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const low = pts.filter((p) => p[1] <= mid);
  const mx = low.reduce((s, p) => s + p[0], 0) / low.length;
  const mz = low.reduce((s, p) => s + p[2], 0) / low.length;
  let sxx = 0;
  let szz = 0;
  let sxz = 0;
  for (const p of low) {
    sxx += (p[0] - mx) ** 2;
    szz += (p[2] - mz) ** 2;
    sxz += (p[0] - mx) * (p[2] - mz);
  }
  const phi = 0.5 * Math.atan2(2 * sxz, sxx - szz); // the long axis, from x towards z
  return +((-phi * 180) / Math.PI).toFixed(1);
}

export async function buildBoat(project: Project, source: Document | null, opts: BuildOptions = {}): Promise<BuildResult> {
  const P = project;
  const { length: L, beam: B, mass } = P.info;
  const doc = source ?? new Document();
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0] ?? doc.createBuffer();
  const scene = root.listScenes()[0] ?? doc.createScene();
  const flip = P.bow[0] > P.stern[0]; // the game wants the bow towards -x
  const xm = (P.bow[0] + P.stern[0]) / 2;
  const s = L / Math.abs(P.stern[0] - P.bow[0]);

  // --- Sort the model's triangles into parts (model mode).
  type Part = Map<Primitive, number[]>;
  const parts = new Map<string, Part>();
  const put = (name: string, prim: Primitive, a: number, b: number, c: number) => {
    if (!parts.has(name)) parts.set(name, new Map());
    const m = parts.get(name)!;
    if (!m.has(prim)) m.set(prim, []);
    m.get(prim)!.push(a, b, c);
  };
  const worldPositions = new Map<Primitive, Float32Array>();
  /** Triangles inside a sail's outline that another part took, by sail and by what took them. */
  const stolen = new Map<string, Map<string, number>>();
  const oldMeshes = root.listMeshes();
  if (P.source === 'model') {
    const outlines = P.sails.map((x) => outline(x, P.sparRadius));
    const spars = P.sails.map(sparsOf);
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;
      const mtx = node.getWorldMatrix();
      for (const prim of mesh.listPrimitives()) {
        const src = prim.getAttribute('POSITION')!.getArray()!;
        const pos = new Float32Array(src.length);
        const turn = ((P.turnDeg ?? 0) * Math.PI) / 180;
        const [tc, ts] = [Math.cos(turn), Math.sin(turn)];
        for (let i = 0; i < src.length; i += 3) {
          const [x, y, z] = [src[i], src[i + 1], src[i + 2]];
          const wx = mtx[0] * x + mtx[4] * y + mtx[8] * z + mtx[12];
          const wz = mtx[2] * x + mtx[6] * y + mtx[10] * z + mtx[14];
          pos[i] = wx * tc - wz * ts;
          pos[i + 1] = mtx[1] * x + mtx[5] * y + mtx[9] * z + mtx[13];
          pos[i + 2] = wx * ts + wz * tc;
        }
        worldPositions.set(prim, pos);
        const idx = prim.getIndices()?.getArray() ?? Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
        for (let t = 0; t < idx.length; t += 3) {
          const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
          const x = (pos[3 * a] + pos[3 * b] + pos[3 * c]) / 3;
          const y = (pos[3 * a + 1] + pos[3 * b + 1] + pos[3 * c + 1]) / 3;
          const z = (pos[3 * a + 2] + pos[3 * b + 2] + pos[3 * c + 2]) / 3;
          put(classify([x, y], z, outlines, spars), prim, a, b, c);
        }
      }
      node.setMesh(null);
    }
  }

  function classify(p: P2, z: number, outlines: P2[][], spars: [P2, P2][][]): string {
    const name = pick(p, z, outlines, spars);
    P.sails.forEach((sl, i) => {
      const own = sl.keep ? `Vela_${sl.id}` : 'drop';
      if (name.what === own || !(sl.rig === 'square' || Math.abs(z) < P.sailWidth) || !nearPolygon(p, outlines[i], P.sparRadius)) return;
      const m = stolen.get(sl.id) ?? new Map<string, number>();
      m.set(name.why, (m.get(name.why) ?? 0) + 1);
      stolen.set(sl.id, m);
    });
    return name.what;
  }

  function pick(p: P2, z: number, outlines: P2[][], spars: [P2, P2][][]): { what: string; why: string } {
    const az = Math.abs(z);
    if (P.hullAreas?.some((a) => a.length >= 3 && pointInPolygon(p, a))) return { what: 'Casco', why: 'a "keep with hull" area' };
    if (P.rudder.length >= 3 && az < P.sailWidth * 1.5 && nearPolygon(p, P.rudder, P.sparRadius * 0.5)) return { what: 'Leme', why: 'the rudder' };
    if (P.tiller && az < P.sailWidth && distToSegment(p, P.tiller[0], P.tiller[1]) < P.sparRadius * 1.5) return { what: 'Leme', why: 'the tiller' };
    // Inside a square sail's outline the sail wins over the ropes: a rope line crossing it on
    // the side view would otherwise take a band right across the sail.
    const inSquare = P.sails.findIndex((sl, i) => sl.rig === 'square' && sl.points.length >= 3 && pointInPolygon(p, outlines[i]));
    for (const r of P.ropes) {
      if (inSquare >= 0 && r.sail !== P.sails[inSquare].id) continue;
      if (distToSegment(p, r.a, r.b) < P.ropeRadius) return { what: r.mode === 'remove' ? 'drop' : r.mode === 'fixed' ? 'Casco' : `Vela_${r.sail}`, why: 'a rope (rope thickness)' };
    }
    for (let i = 0; i < P.sails.length; i++) {
      const sl = P.sails[i];
      const name = sl.keep ? `Vela_${sl.id}` : 'drop';
      if (az < P.sailWidth && spars[i].some(([a, b]) => distToSegment(p, a, b) < P.sparRadius * 1.3)) return { what: name, why: `the spars of sail "${sl.id}"` };
    }
    for (const m of P.masts) if (az < P.sparRadius * 2.5 && distToSegment(p, m.foot, m.top) < P.sparRadius) return { what: 'Casco', why: 'the mast (spar thickness)' };
    for (let i = 0; i < P.sails.length; i++) {
      const sl = P.sails[i];
      const wide = sl.rig === 'square'; // a square sail spreads across the boat
      if ((wide || az < P.sailWidth) && nearPolygon(p, outlines[i], P.sparRadius)) return { what: sl.keep ? `Vela_${sl.id}` : 'drop', why: `sail "${sl.id}"` };
    }
    return { what: 'Casco', why: 'the hull' };
  }

  // Source units -> metres (x, y); z by the measured beam.
  let zs = s;
  if (P.source === 'model') {
    // Widest part of the hull below the sheer (the lower of the two ends).
    const gun = Math.min(P.bow[1], P.stern[1]);
    let maxZ = 0;
    for (const [prim, list] of parts.get('Casco') ?? []) {
      const pos = worldPositions.get(prim)!;
      for (const v of list) if (pos[3 * v + 1] < gun) maxZ = Math.max(maxZ, Math.abs(pos[3 * v + 2]));
    }
    if (maxZ > 0) zs = B / 2 / maxZ;
  }
  let level = 0;
  const X = (x: number) => (flip ? -1 : 1) * (x - xm) * s;
  const M = (p: P2, z = 0): P3 => [X(p[0]), p[1] * s - level, z];

  // --- Materials for what is built.
  const mat = (name: string, color: string, rough = 0.85): Material =>
    doc.createMaterial(name).setBaseColorFactor([...hex(color), 1]).setMetallicFactor(0).setRoughnessFactor(rough).setDoubleSided(true);
  const canvas = mat('Workshop_sail', P.colors.sail);
  const wood = mat('Workshop_spar', P.colors.spar, 0.6);

  const addGenerated = (name: string, pieces: { data: MeshData; material: Material }[]) => {
    let node = root.listNodes().find((n) => n.getName() === name);
    let mesh = node?.getMesh();
    if (!node) {
      mesh = doc.createMesh(name);
      node = doc.createNode(name).setMesh(mesh);
      scene.addChild(node);
    }
    for (const { data, material } of pieces) {
      const prim = doc.createPrimitive().setMaterial(material);
      prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(data.positions)).setBuffer(buffer));
      prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normalsOf(data)).setBuffer(buffer));
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(data.indices)).setBuffer(buffer));
      mesh!.addPrimitive(prim);
    }
    return node;
  };

  // --- Hull triangles in metres (before the waterline is known), to float it.
  const hullTris: [P3, P3, P3][] = [];
  if (P.source === 'model') {
    for (const [prim, list] of parts.get('Casco') ?? []) {
      const pos = worldPositions.get(prim)!;
      const V = (v: number): P3 => [X(pos[3 * v]), pos[3 * v + 1] * s, pos[3 * v + 2] * zs];
      for (let i = 0; i < list.length; i += 3) hullTris.push([V(list[i]), V(list[i + 1]), V(list[i + 2])]);
    }
  } else {
    const h = hullMesh({ bow: P.bow, stern: P.stern, sheer: P.sheer, keel: P.keel, halfBeam: B / 2 / s, transom: P.transom });
    for (let i = 0; i < h.indices.length; i += 3) {
      const V = (v: number): P3 => [X(h.positions[3 * v]), h.positions[3 * v + 1] * s, h.positions[3 * v + 2] * s];
      hullTris.push([V(h.indices[i]), V(h.indices[i + 1]), V(h.indices[i + 2])]);
    }
  }
  const fl = floatHull(hullTris, mass / 1025);
  level = fl.level;
  const cg = fl.cx;

  // --- Copy the model's parts into new nodes, in metres, waterline at 0.
  const triangles: Record<string, number> = {};
  if (P.source === 'model') {
    for (const [name, byPrim] of parts) {
      if (name === 'drop') continue;
      const mesh = doc.createMesh(name);
      for (const [prim, list] of byPrim) {
        const remap = new Map<number, number>();
        const order: number[] = [];
        const indices = list.map((v) => {
          if (!remap.has(v)) {
            remap.set(v, order.length);
            order.push(v);
          }
          return remap.get(v)!;
        });
        const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
        const world = worldPositions.get(prim)!;
        for (const sem of prim.listSemantics()) {
          const a = prim.getAttribute(sem)!;
          const size = a.getElementSize();
          const raw = sem === 'POSITION' ? world : a.getArray()!;
          const arr = new Float32Array(order.length * size);
          order.forEach((v, k) => {
            for (let c = 0; c < size; c++) arr[k * size + c] = raw[v * size + c];
          });
          if (sem === 'POSITION') {
            for (let k = 0; k < arr.length; k += 3) {
              arr[k] = X(arr[k]);
              arr[k + 1] = arr[k + 1] * s - level;
              arr[k + 2] *= zs;
            }
          } else if (sem === 'NORMAL') {
            const turn = ((P.turnDeg ?? 0) * Math.PI) / 180;
            const [tc, ts] = [Math.cos(turn), Math.sin(turn)];
            for (let k = 0; k < arr.length; k += 3) {
              const tx = arr[k] * tc - arr[k + 2] * ts; // turned as the positions
              const tz = arr[k] * ts + arr[k + 2] * tc;
              const nx = (flip ? -1 : 1) * (tx / s);
              const ny = arr[k + 1] / s;
              const nz = tz / zs;
              const l = Math.hypot(nx, ny, nz) || 1;
              arr[k] = nx / l;
              arr[k + 1] = ny / l;
              arr[k + 2] = nz / l;
            }
          }
          p.setAttribute(sem, doc.createAccessor().setType(a.getType()).setArray(arr).setNormalized(a.getNormalized()).setBuffer(buffer));
        }
        // Mirrored along x: turn the triangles round so they still face out.
        const ind = new Uint32Array(indices);
        if (flip) for (let k = 0; k < ind.length; k += 3) [ind[k + 1], ind[k + 2]] = [ind[k + 2], ind[k + 1]];
        p.setIndices(doc.createAccessor().setType('SCALAR').setArray(ind).setBuffer(buffer));
        mesh.addPrimitive(p);
      }
      scene.addChild(doc.createNode(name).setMesh(mesh));
    }
    for (const m of oldMeshes) m.dispose();
  } else {
    // Photo mode: the lofted hull in three paint bands, the masts and the rudder.
    const h = hullMesh({ bow: P.bow, stern: P.stern, sheer: P.sheer, keel: P.keel, halfBeam: B / 2 / s, transom: P.transom });
    const pos: number[] = [];
    for (let i = 0; i < h.positions.length; i += 3) pos.push(...M([h.positions[i], h.positions[i + 1]], h.positions[i + 2] * s));
    const bands = [P.colors.bottom, P.colors.topsides, P.colors.stripe].map((c, i) => mat(`Workshop_hull${i}`, c, 0.7));
    const pieces = bands.map((material, bi) => {
      const indices: number[] = [];
      for (let t = 0; t < h.indices.length / 3; t++) if (h.band[t] === bi) indices.push(h.indices[3 * t], h.indices[3 * t + 1], h.indices[3 * t + 2]);
      if (flip) for (let k = 0; k < indices.length; k += 3) [indices[k + 1], indices[k + 2]] = [indices[k + 2], indices[k + 1]];
      return { data: { positions: pos, indices }, material };
    });
    addGenerated('Casco', pieces);
    // Masts.
    for (const m of P.masts) addGenerated('Casco', [{ data: sparMesh(M(m.foot), M(m.top), 0.012 * L, 0.008 * L), material: wood }]);
    // Rudder: a plate with the blade's outline.
    if (P.rudder.length >= 3) {
      const out = P.rudder.map((q) => M(q));
      const t = 0.03 * B;
      const positions: number[] = [];
      for (const side of [t, -t]) for (const q of out) positions.push(q[0], q[1], side);
      const n = out.length;
      const indices: number[] = [];
      for (let i = 1; i + 1 < n; i++) indices.push(0, i, i + 1, n, n + i + 1, n + i);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        indices.push(i, j, n + j, i, n + j, n + i);
      }
      addGenerated('Leme', [{ data: { positions, indices }, material: wood }]);
    }
    if (P.tiller) addGenerated('Leme', [{ data: sparMesh(M(P.tiller[0]), M(P.tiller[1]), 0.004 * L), material: wood }]);
  }

  // --- New sails and their spars (sails not kept, and every sail in photo mode).
  const port: P3 = [0, 0, 1];
  for (const sl of P.sails) {
    if (P.source === 'model' && sl.keep) continue;
    const name = `Vela_${sl.id}`;
    const r = 0.007 * L;
    if (sl.rig === 'square') {
      const [top, foot] = ends(sl).map((q) => M(q));
      const half = (sl.yardLength ?? B * 2) / 2;
      const corners: P3[] = [
        [top[0], top[1], half],
        [top[0], top[1], -half],
        [foot[0], foot[1], -half * 0.95],
        [foot[0], foot[1], half * 0.95],
      ];
      addGenerated(name, [
        { data: sailMesh(corners, 0.08 * half * 2, [-1, 0, 0]), material: canvas },
        { data: sparMesh([top[0], top[1], half * 1.05], [top[0], top[1], -half * 1.05], r, r), material: wood },
      ]);
    } else {
      const corners = sl.points.map((q) => M(q, 0.05));
      const chord = Math.hypot(corners[0][0] - corners[corners.length - 1][0], corners[0][1] - corners[corners.length - 1][1]);
      const pieces = [{ data: sailMesh(corners, 0.06 * Math.max(chord, 1), port), material: canvas }];
      for (const [a, b] of sparsOf(sl)) pieces.push({ data: sparMesh(M(a, 0.05), M(b, 0.05), r, r * 0.7), material: wood });
      addGenerated(name, pieces);
    }
  }

  // --- Lighter: each part down to its budget.
  const budgets = opts.budgets ?? { hull: 50000, sail: 9000, rudder: 2000 };
  if (opts.simplify !== false) await MeshoptSimplifier.ready;
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const name = node.getName();
    const budget = name === 'Casco' ? budgets.hull : name === 'Leme' ? budgets.rudder : budgets.sail;
    let total = 0;
    for (const prim of mesh.listPrimitives()) total += (prim.getIndices()?.getCount() ?? 0) / 3;
    for (const prim of mesh.listPrimitives()) {
      if (opts.simplify !== false && total > budget) {
        weldPrimitive(prim);
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: budget / total, error: 0.01, lockBorder: true });
      }
    }
    triangles[name] = mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
  }
  await doc.transform(prune());
  if (opts.compressTexture) {
    for (const tex of root.listTextures()) {
      const img = tex.getImage();
      if (!img) continue;
      const out = await opts.compressTexture(img, tex.getMimeType());
      tex.setImage(out.data).setMimeType(out.mime);
    }
  }

  // --- Numbers for the physics and the wiring.
  const deckY = (x: number) => {
    // Height of the gunwale near x: the highest hull point there, away from the centreline.
    let best = -Infinity;
    for (const [a, b, c] of hullTris) for (const q of [a, b, c]) if (Math.abs(q[0] - x) < 0.4 && Math.abs(q[2]) > fl.halfBeamAtWater * 0.5) best = Math.max(best, q[1]);
    return Number.isFinite(best) ? best - level : 0.6;
  };
  const area = (sl: SailInput) => {
    if (sl.rig === 'square') {
      const [a, b] = ends(sl).map((q) => M(q));
      return { area: Math.abs(a[1] - b[1]) * (sl.yardLength ?? B * 2), cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2 };
    }
    return polygonAreaCentroid(sl.points.map((q) => M(q).slice(0, 2) as P2));
  };
  const areas = P.sails.map(area);
  // Which mast is the main one: the one carrying the most sail.
  const mastArea = P.masts.map((_, i) => P.sails.reduce((sum, sl, k) => (sl.rig !== 'jib' && mastOf(P, sl) === i ? sum + areas[k].area : sum), 0));
  const mainMast = mastArea.indexOf(Math.max(...mastArea));
  const foreAft = P.sails.filter((x) => x.rig !== 'jib' && x.rig !== 'square').length;
  const sails: SailSpec[] = [];
  const visualSails: Record<string, unknown>[] = [];
  const sheets: Record<string, unknown>[] = [];
  const f = (v: number) => +v.toFixed(3);
  for (let k = 0; k < P.sails.length; k++) {
    const sl = P.sails[k];
    const { area: A, cx, cy } = areas[k];
    const rig = RIGS[sl.rig];
    let pivotX: number;
    let axis: { base: P3; top: P3 };
    let group: string;
    if (sl.rig === 'jib') {
      const [tack, head] = sl.points.map((q) => M(q));
      pivotX = tack[0];
      axis = { base: tack, top: head };
      group = 'jib';
    } else {
      const mi = mastOf(P, sl);
      const m = P.masts[mi];
      const foot = M(m.foot);
      const top = M(m.top);
      pivotX = xAt([foot[0], foot[1]], [top[0], top[1]], cy);
      axis = { base: foot, top };
      group = mi === mainMast ? 'main' : top[0] > M(P.masts[mainMast].foot)[0] ? 'mizzen' : 'fore';
    }
    const single = foreAft === 1 && P.sails.length === 1;
    sails.push({
      id: sl.id,
      name: rig.name,
      group,
      area: f(A),
      pivot: [f(cg - pivotX), 0],
      ceDistance: sl.rig === 'square' ? 0 : f(cx - pivotX),
      ceHeight: f(cy),
      minAngle: sl.rig === 'square' ? 35 : single ? 0 : 20,
      maxAngle: sl.rig === 'square' ? 90 : 80,
      efficiency: sl.rig === 'square' ? 0.75 : 0.8,
    });
    visualSails.push({
      sail: sl.id,
      nodes: [`Vela_${sl.id}`],
      ...(sl.rig === 'square' ? { restAngle: Math.PI / 2 } : {}),
      pivot: [f(pivotX), 0, 0],
      axis: { base: axis.base.map(f), top: axis.top.map(f) },
    });
    if (sl.rig !== 'square') {
      const clew = M(sl.points[2]);
      const dy = deckY(clew[0]);
      sheets.push(
        sl.rig === 'jib'
          ? { sail: sl.id, clew: clew.map(f), to: { port: [f(clew[0] + 0.3), f(dy), f(fl.halfBeamAtWater * 0.7)], starboard: [f(clew[0] + 0.3), f(dy), f(-fl.halfBeamAtWater * 0.7)] } }
          : { sail: sl.id, clew: clew.map(f), to: [f(clew[0]), f(dy), 0] },
      );
    }
  }
  // Rudder: the part of the blade under water.
  const blade = P.rudder.map((q) => M(q).slice(0, 2) as P2);
  const wet = polygonAreaCentroid(clipBelow(blade, 0));
  const rx = blade.length ? Math.min(...blade.map((q) => q[0])) : X(P.stern[0]);
  const ry = blade.length ? [Math.min(...blade.map((q) => q[1])), Math.max(...blade.map((q) => q[1]))] : [-0.5, 1];
  const wetted = 2.6 * Math.sqrt((mass / 1025) * fl.waterlineLength);
  const spec: BoatSpec = {
    id: P.info.id,
    name: P.info.name,
    description: P.info.description,
    home: P.info.home,
    length: L,
    beam: B,
    draft: f(fl.draft),
    mass,
    gm: P.info.gm ?? f(Math.max(0.6, 0.62 * B)),
    rollPeriod: f(Math.min(5, Math.max(2, 1.5 + 0.15 * L))),
    hull: {
      waterlineLength: f(fl.waterlineLength),
      wettedArea: f(wetted),
      cf: 0.005,
      waveCoef: 0.04,
      lateralArea: f(Math.max(0.5, fl.lateralArea)),
      lateralCentre: f(cg - fl.lateralCx),
      liftSlope: 2.8,
      stallDeg: 24,
      windageArea: f(0.18 * L * B),
    },
    rudder: { area: f(Math.max(0.2, wet.area)), x: f(cg - (wet.area ? wet.cx : rx)), liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
    sails,
    modes: [{ id: 'sailing', name: 'Sailing', description: 'All sails set.', sails: sails.map((x) => x.id) }],
  };
  const visual = {
    boat: P.info.id,
    hullNodes: ['Casco'],
    unit: 1,
    scale: 1,
    cgX: f(cg),
    waterline: 0,
    sails: visualSails,
    sheets,
    rudder: { nodes: ['Leme'], pivot: [f(rx), 0, 0], axis: { base: [f(rx), f(ry[0]), 0], top: [f(rx), f(ry[1]), 0] } },
  };
  const sailWarnings = [...stolen].map(([id, m]) => `Sail "${id}": ${[...m].map(([why, n]) => `${n} triangles inside its outline went to ${why}`).join('; ')}.`);
  return { doc, spec, visual, report: { waterlineLength: fl.waterlineLength, draft: fl.draft, cgX: cg, triangles, level, sailWarnings } };
}

/** Smooth normals from the triangles. */
function normalsOf(d: MeshData): Float32Array {
  const n = new Float32Array(d.positions.length);
  const p = d.positions;
  for (let i = 0; i < d.indices.length; i += 3) {
    const [a, b, c] = [d.indices[i], d.indices[i + 1], d.indices[i + 2]];
    const ux = p[3 * b] - p[3 * a], uy = p[3 * b + 1] - p[3 * a + 1], uz = p[3 * b + 2] - p[3 * a + 2];
    const vx = p[3 * c] - p[3 * a], vy = p[3 * c + 1] - p[3 * a + 1], vz = p[3 * c + 2] - p[3 * a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      n[3 * v] += nx;
      n[3 * v + 1] += ny;
      n[3 * v + 2] += nz;
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

/** The physics file for src/physics/boats/<id>.ts. */
export function specSource(spec: BoatSpec): string {
  const id = spec.id.toUpperCase().replace(/[^A-Z0-9]/g, '_');
  return `import type { BoatSpec } from '../types';

// ${spec.name}: made in the boat workshop (tools/workshop). Sail areas and centres, the
// waterline, the draft, the lateral area and the rudder are measured on the model; stability
// and resistance are estimates: tune them with \`npm run polar\`.

export const ${id}: BoatSpec = ${JSON.stringify(spec, null, 2).replace(/"([a-zA-Z_]+)":/g, '$1:')};
`;
}

/** The wiring for src/engine/boatVisuals.ts. */
export function visualSource(id: string, visual: Record<string, unknown>): string {
  return `  ${id}: ${JSON.stringify({ ...visual, url: `__${id}Url__` }, null, 2)
    .replace(/"([a-zA-Z_]+)":/g, '$1:')
    .replace(`"__${id}Url__"`, `${id}Url`)
    .replace(/\n/g, '\n  ')},\n`;
}

