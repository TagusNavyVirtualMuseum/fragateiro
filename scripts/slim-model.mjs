// Makes a boat model lighter to download and draw, without changing how it looks at
// sailing distance: small fittings (hooks, rings, blocks, the anchor), often modelled with
// thousands of triangles each, are simplified hard; larger parts only lose triangles that
// change their shape by less than a few millimetres. Node names stay the same, so the
// wiring in boatVisuals.ts still works.
//
//   node scripts/slim-model.mjs in.glb out.glb [unit=0.01]
//
// unit: model units -> metres (the `unit` in boatVisuals.ts).
// Or run the "Slim a model" workflow on GitHub (Actions tab), which commits the result.

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, getBounds, prune, quantize, simplifyPrimitive, weld, weldPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const [, , input, output, unitArg] = process.argv;
if (!input || !output) {
  console.error('usage: node scripts/slim-model.mjs in.glb out.glb [unit]');
  process.exit(1);
}
const unit = Number(unitArg ?? 0.01);
/** Parts smaller than this (m) count as fittings. */
const SMALL = 0.8;
/** More triangles than this per metre of a part's size counts as over-detailed. */
const DENSE = 800;
/** Largest change in shape allowed on a long part, m. */
const MAX_ERROR = 0.003;

await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const triangles = () => {
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? 0) / 3;
  return Math.round(t);
};
const before = triangles();

await doc.transform(dequantize());
// Join vertices that sit at the same place with the same attributes, so the simplifier
// can collapse edges.
await doc.transform(weld());

const done = new Set();
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || done.has(mesh)) continue;
  done.add(mesh);
  const { min, max } = getBounds(node);
  const size = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) * unit;
  for (const prim of mesh.listPrimitives()) {
    const tri = (prim.getIndices()?.getCount() ?? 0) / 3;
    if (tri < 64) continue;
    // Fittings, or groups of fittings spread along a spar (all the rings of a yard can be
    // one mesh): small, or very many triangles for their size.
    const dense = tri / Math.max(size, 0.01) > DENSE;
    if (size < SMALL || dense) {
      // Their corners are often stored once per triangle (hard edges), which stops the
      // simplifier: drop the normals, merge the corners, simplify, then smooth normals.
      const normal = prim.getAttribute('NORMAL');
      if (normal) {
        prim.setAttribute('NORMAL', null);
        if (normal.listParents().length <= 1) normal.dispose();
      }
      weldPrimitive(prim);
      if (size < SMALL) {
        // A few hundred triangles are plenty for something this size.
        const budget = 150 + 600 * (size / SMALL);
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: Math.min(1, budget / tri), error: 0.05, lockBorder: false });
      } else {
        // At most a few millimetres off, so thin ropes keep their shape.
        simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: Math.min(1, (DENSE * 0.25 * size) / tri), error: MAX_ERROR / size, lockBorder: false });
      }
      smoothNormals(prim);
    } else {
      // Error is relative to the part's size: 0.1 % of a 10 m hull is 1 cm.
      simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: 0, error: 0.001, lockBorder: false });
    }
  }
}
await doc.transform(prune(), quantize());

/** Area-weighted vertex normals from the triangles. */
function smoothNormals(prim) {
  const pos = prim.getAttribute('POSITION').getArray();
  const idx = prim.getIndices().getArray();
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
  const acc = doc.createAccessor().setType('VEC3').setArray(n).setBuffer(doc.getRoot().listBuffers()[0]);
  prim.setAttribute('NORMAL', acc);
}
await io.write(output, doc);
console.log(`${input}: ${before} -> ${triangles()} triangles`);
