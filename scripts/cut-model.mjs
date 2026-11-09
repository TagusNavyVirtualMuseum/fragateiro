// Turns a one-piece model (from a photo-to-3D service such as Meshy, or a scan) into a boat
// the game can move: cuts it into named parts (hull, each sail with its yard, rudder), drops
// what should not be there (people, an outboard engine, flags), scales it to metres with
// the waterline at y = 0, and makes it light enough for the web.
//
//   node scripts/cut-model.mjs scripts/boats/canoa-meshy.mjs in.glb out.glb
//
// The config file (see scripts/boats/canoa-meshy.mjs) says, in the input model's own units:
// - `classify(p, piece)`: the part a triangle belongs to, from its centre `p` ({x, y, z})
//   and `piece` (the rank of its connected piece by size, 0 = the largest), or null to drop
//   it;
// - `move(v)` (optional): moves a vertex ({x, y, z}, changed in place) before anything else,
//   to fix the shape (the pinasse's mast came out as two poles in a V);
// - `scale`, `origin`: model units -> metres (a number, or {x, y, z} to fix proportions), and
//   the model point that becomes (0, 0, 0) (the bow points to -x, y up, z to port, as in the
//   game);
// - `triangles`: how many triangles each part may keep, roughly;
// - `textureSize`: largest texture side, px.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, simplifyPrimitive, textureCompress, weldPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [, , configPath, input, output] = process.argv;
if (!configPath || !input || !output) {
  console.error('usage: node scripts/cut-model.mjs config.mjs in.glb out.glb');
  process.exit(1);
}
const config = (await import(pathToFileURL(resolve(configPath)).href)).default;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();
const buffer = root.listBuffers()[0];
const scene = root.listScenes()[0];

/** Connected pieces of a primitive (vertices at the same place count as joined). */
function pieces(pos, tri) {
  const n = pos.length / 3;
  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]];
    return a;
  };
  const seen = new Map();
  for (let i = 0; i < n; i++) {
    const k = `${pos[3 * i].toFixed(5)},${pos[3 * i + 1].toFixed(5)},${pos[3 * i + 2].toFixed(5)}`;
    if (seen.has(k)) parent[find(i)] = find(seen.get(k));
    else seen.set(k, i);
  }
  for (let t = 0; t < tri.length; t += 3) {
    const a = find(tri[t]);
    parent[find(tri[t + 1])] = a;
    parent[find(tri[t + 2])] = a;
  }
  const size = new Map();
  for (let t = 0; t < tri.length; t += 3) size.set(find(tri[t]), (size.get(find(tri[t])) ?? 0) + 1);
  const rank = new Map([...size.entries()].sort((a, b) => b[1] - a[1]).map(([r], i) => [r, i]));
  return Int32Array.from({ length: tri.length / 3 }, (_, t) => rank.get(find(tri[3 * t])));
}

// Sort every triangle into its part.
const parts = new Map(); // name -> [{ prim, list }]
const oldMeshes = root.listMeshes();
let dropped = 0;
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const tri = prim.getIndices().getArray();
    const rank = pieces(pos, tri);
    if (config.move) for (let i = 0; i < pos.length; i += 3) {
      const v = { x: pos[i], y: pos[i + 1], z: pos[i + 2] };
      config.move(v);
      pos[i] = v.x;
      pos[i + 1] = v.y;
      pos[i + 2] = v.z;
    }
    for (let t = 0; t < tri.length; t += 3) {
      const [a, b, c] = [tri[t], tri[t + 1], tri[t + 2]];
      const p = {
        x: (pos[3 * a] + pos[3 * b] + pos[3 * c]) / 3,
        y: (pos[3 * a + 1] + pos[3 * b + 1] + pos[3 * c + 1]) / 3,
        z: (pos[3 * a + 2] + pos[3 * b + 2] + pos[3 * c + 2]) / 3,
      };
      const part = config.classify(p, rank[t / 3]);
      if (!part) {
        dropped++;
        continue;
      }
      if (!parts.has(part)) parts.set(part, new Map());
      const byPrim = parts.get(part);
      if (!byPrim.has(prim)) byPrim.set(prim, []);
      byPrim.get(prim).push(a, b, c);
    }
  }
  node.setMesh(null);
}
console.log(`dropped ${dropped} triangles`);

// One node per part, in metres, with the origin moved.
const { origin } = config;
const scale = typeof config.scale === 'number' ? { x: config.scale, y: config.scale, z: config.scale } : config.scale;
for (const [name, byPrim] of parts) {
  const mesh = doc.createMesh(name);
  for (const [prim, list] of byPrim) {
    const remap = new Map();
    const order = [];
    const indices = list.map((v) => {
      if (!remap.has(v)) {
        remap.set(v, order.length);
        order.push(v);
      }
      return remap.get(v);
    });
    const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
    for (const sem of prim.listSemantics()) {
      const src = prim.getAttribute(sem);
      const size = src.getElementSize();
      const raw = src.getArray();
      const arr = new Float32Array(order.length * size);
      order.forEach((v, k) => {
        for (let c = 0; c < size; c++) arr[k * size + c] = raw[v * size + c];
      });
      if (sem === 'POSITION') for (let k = 0; k < arr.length; k += 3) {
        arr[k] = (arr[k] - origin.x) * scale.x;
        arr[k + 1] = (arr[k + 1] - origin.y) * scale.y;
        arr[k + 2] = (arr[k + 2] - origin.z) * scale.z;
      }
      // A stretch in one direction turns the normals the other way.
      if (sem === 'NORMAL') for (let k = 0; k < arr.length; k += 3) {
        const [x, y, z] = [arr[k] / scale.x, arr[k + 1] / scale.y, arr[k + 2] / scale.z];
        const l = Math.hypot(x, y, z) || 1;
        arr[k] = x / l;
        arr[k + 1] = y / l;
        arr[k + 2] = z / l;
      }
      p.setAttribute(sem, doc.createAccessor().setType(src.getType()).setArray(arr).setBuffer(buffer));
    }
    p.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint32Array.from(indices)).setBuffer(buffer));
    mesh.addPrimitive(p);
  }
  scene.addChild(doc.createNode(name).setMesh(mesh));
}
for (const n of root.listNodes()) if (!n.getMesh() && n.listChildren().length === 0) n.dispose();
for (const m of oldMeshes) m.dispose();

// Lighter: each part down to about its triangle budget (keeping UV seams and borders).
for (const mesh of root.listMeshes()) {
  const budget = config.triangles?.[mesh.getName()] ?? 20000;
  for (const prim of mesh.listPrimitives()) {
    const before = prim.getIndices().getCount() / 3;
    weldPrimitive(prim);
    if (before > budget) simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: budget / before, error: 0.01, lockBorder: true });
    console.log(`${mesh.getName().padEnd(14)} ${before} -> ${prim.getIndices().getCount() / 3} triangles`);
  }
}
await doc.transform(
  prune(),
  dedup(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [config.textureSize ?? 1024, config.textureSize ?? 1024], quality: 82 }),
);
await io.write(output, doc);
