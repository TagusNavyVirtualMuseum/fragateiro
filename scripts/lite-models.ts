// Light versions of the boat models, for boats seen from a distance (other boats sailing on
// the river). For each boat in BOAT_VISUALS:
//   - the parts that move (sails, yards, rudder: the nodes named in boatVisuals.ts) stay
//     separate and keep their names, simplified;
//   - small fittings (under 0.5 m) and hidden parts are dropped;
//   - everything else is merged into one mesh per material and simplified hard; its
//     textures are replaced by their average colour (detail you cannot see from afar, and
//     texture seams would stop the simplifier);
//   - textures shrink to 128 px.
// Writes src/assets/models/lite/<boat>.glb.
//
//   npx tsx --import ./scripts/url-stub.mjs scripts/lite-models.ts [boat ...]

import { mkdirSync } from 'node:fs';
import { Document, NodeIO, type Material, type Node, type Primitive } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, getBounds, joinPrimitives, prune, quantize, simplifyPrimitive, textureCompress, transformPrimitive, weld, weldPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { BOAT_VISUALS } from '../src/engine/boatVisuals';

const SMALL = 0.5; // m: fittings smaller than this are dropped
const STATIC_KEEP = 0.12; // share of triangles kept in the merged hull and fittings
const MOVING_KEEP = 0.3; // share kept in sails, yards and rudder

const flatCache = new Map<Material | null, Material | null>();

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const outDir = new URL('../src/assets/models/lite/', import.meta.url);
mkdirSync(outDir, { recursive: true });

const only = process.argv.slice(2);
for (const [id, visual] of Object.entries(BOAT_VISUALS)) {
  if (only.length && !only.includes(id)) continue;
  const src = new URL(`../src/assets/models/${id}.glb`, import.meta.url);
  const doc = await io.read(src.pathname);
  const root = doc.getRoot();
  const before = triangles(doc);
  await doc.transform(dequantize(), weld());

  const moving = new Set([...visual.sails.flatMap((s) => s.nodes), ...visual.rudder.nodes]);
  const hidden = new Set(visual.hiddenNodes ?? []);
  const nodes = root.listNodes();
  // A node moves if it, or one of its ancestors, is named in boatVisuals.ts; its ancestors
  // must stay too (they hold it in place).
  const parentOf = new Map<Node, Node>();
  for (const n of nodes) for (const c of n.listChildren()) parentOf.set(c, n);
  const ancestors = (n: Node) => {
    const out: Node[] = [];
    for (let p = parentOf.get(n); p; p = parentOf.get(p)) out.push(p);
    return out;
  };
  const isMoving = (n: Node) => moving.has(n.getName()) || ancestors(n).some((a) => moving.has(a.getName()));
  const holdsMoving = new Set<Node>();
  for (const n of nodes) if (moving.has(n.getName())) for (const a of ancestors(n)) holdsMoving.add(a);

  const merged = new Map<Material | null, Primitive[]>();
  for (const n of nodes) {
    const mesh = n.getMesh();
    if (!mesh) continue;
    if (hidden.has(n.getName()) || ancestors(n).some((a) => hidden.has(a.getName()))) {
      n.setMesh(null);
      continue;
    }
    const { min, max } = getBounds(n);
    const size = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * visual.unit;
    if (isMoving(n)) {
      for (const p of mesh.listPrimitives()) simplify(p, MOVING_KEEP);
      continue;
    }
    if (size < SMALL) {
      n.setMesh(null);
      continue;
    }
    if (holdsMoving.has(n)) continue; // keep its own mesh in place, unmerged
    // Bake the node's placement into the geometry and collect it for merging.
    const world = n.getWorldMatrix();
    for (const p of mesh.listPrimitives()) {
      const copy = p.clone();
      transformPrimitive(copy, world);
      const mat = await flatMaterial(copy.getMaterial());
      copy.setMaterial(mat);
      for (const sem of copy.listSemantics()) if (sem !== 'POSITION' && sem !== 'NORMAL') copy.setAttribute(sem, null);
      if (!merged.has(mat)) merged.set(mat, []);
      merged.get(mat)!.push(copy);
    }
    n.setMesh(null);
  }
  const hull = doc.createMesh('lite_static');
  flatCache.clear();
  for (const prims of merged.values()) {
    // Only primitives with the same attributes can be joined.
    const groups = new Map<string, Primitive[]>();
    for (const p of prims) {
      const key = p.listSemantics().sort().join(',');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(p);
    }
    for (const g of groups.values()) {
      const joined = g.length > 1 ? joinPrimitives(g) : g[0];
      simplify(joined, STATIC_KEEP);
      hull.addPrimitive(joined);
    }
  }
  root.listScenes()[0].addChild(doc.createNode('lite_static').setMesh(hull));

  await doc.transform(
    prune(),
    textureCompress({ encoder: sharp, resize: [128, 128] }),
    quantize(),
  );
  const out = new URL(`${id}.glb`, outDir).pathname;
  await io.write(out, doc);
  console.log(`${id}: ${before} -> ${triangles(doc)} triangles, ${root.listMeshes().length} meshes -> ${out}`);
}

/** A copy of a material with its colour texture replaced by the texture's average colour. */
async function flatMaterial(mat: Material | null): Promise<Material | null> {
  if (!mat || !mat.getBaseColorTexture()) return mat;
  if (flatCache.has(mat)) return flatCache.get(mat)!;
  const image = mat.getBaseColorTexture()!.getImage()!;
  const { channels } = await sharp(Buffer.from(image)).stats();
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const f = mat.getBaseColorFactor();
  const flat = mat.clone().setName(`${mat.getName()}_flat`);
  flat.setBaseColorTexture(null);
  flat.setBaseColorFactor([f[0] * lin(channels[0].mean / 255), f[1] * lin(channels[1].mean / 255), f[2] * lin(channels[2].mean / 255), f[3]]);
  for (const slot of ['setNormalTexture', 'setOcclusionTexture', 'setMetallicRoughnessTexture', 'setEmissiveTexture'] as const) flat[slot](null);
  flatCache.set(mat, flat);
  return flat;
}

function simplify(p: Primitive, keep: number) {
  const tri = (p.getIndices()?.getCount() ?? 0) / 3;
  if (tri < 40) return;
  // Hard edges store corners once per triangle, which blocks simplification; merge them.
  const normal = p.getAttribute('NORMAL');
  if (normal) p.setAttribute('NORMAL', null);
  weldPrimitive(p);
  simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: keep, error: 0.02, lockBorder: false });
  smoothNormals(p);
}

function smoothNormals(prim: Primitive) {
  const pos = prim.getAttribute('POSITION')!.getArray()!;
  const idx = prim.getIndices()!.getArray()!;
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
  const doc = Document.fromGraph(prim.getGraph())!;
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(n).setBuffer(doc.getRoot().listBuffers()[0]));
}

function triangles(doc: Document): number {
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? 0) / 3;
  return Math.round(t);
}
