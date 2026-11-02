// Split merged meshes into their connected pieces, so a spar or a rudder that was modelled
// together with other parts can move on its own.
//
//   node scripts/split-mesh.mjs in.glb out.glb NodeA NodeB ...
//
// Node "X" becomes children "X_part0", "X_part1", ... (pieces larger than 0.8 m are listed
// with their bounds, in metres, to help find the right one).
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const [, , input, output, ...names] = process.argv;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const root = doc.getRoot();
for (const node of root.listNodes()) {
  if (!names.includes(node.getName()) || !node.getMesh()) continue;
  const parts = [];
  for (const prim of node.getMesh().listPrimitives()) {
    const idx = prim.getIndices(); const pos = prim.getAttribute('POSITION');
    const n = pos.getCount(); const parent = Int32Array.from({ length: n }, (_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    // Also merge vertices at the same position (meshes are often split along UV seams).
    const key = new Map(); const el = [];
    for (let i = 0; i < n; i++) { const v = pos.getElement(i, el); const k = v.map((x) => x.toFixed(4)).join(','); if (key.has(k)) parent[find(i)] = find(key.get(k)); else key.set(k, i); }
    const tri = idx ? idx.getArray() : Uint32Array.from({ length: n }, (_, i) => i);
    for (let t = 0; t < tri.length; t += 3) { const a = find(tri[t]); parent[find(tri[t + 1])] = a; parent[find(tri[t + 2])] = a; }
    const groups = new Map();
    for (let t = 0; t < tri.length; t += 3) { const g = find(tri[t]); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(tri[t], tri[t + 1], tri[t + 2]); }
    for (const list of groups.values()) parts.push({ prim, list });
  }
  // Merge tiny pieces (bolts, rings) into a "_small" bucket per material is overkill: keep all.
  parts.forEach(({ prim, list }, i) => {
    // Copy only this piece's vertices (compact), so each piece is small on the GPU.
    const remap = new Map();
    const order = [];
    const indices = list.map((v) => { if (!remap.has(v)) { remap.set(v, order.length); order.push(v); } return remap.get(v); });
    const p = doc.createPrimitive().setMaterial(prim.getMaterial()).setMode(prim.getMode());
    for (const sem of prim.listSemantics()) {
      const src = prim.getAttribute(sem); const size = src.getElementSize();
      const raw = src.getArray(); const Ctor = raw.constructor;
      const arr = new Ctor(order.length * size);
      order.forEach((v, k) => { for (let c = 0; c < size; c++) arr[k * size + c] = raw[v * size + c]; });
      p.setAttribute(sem, doc.createAccessor().setType(src.getType()).setArray(arr).setNormalized(src.getNormalized()).setBuffer(root.listBuffers()[0]));
    }
    p.setIndices(doc.createAccessor().setType('SCALAR').setArray(order.length > 65535 ? Uint32Array.from(indices) : Uint16Array.from(indices)).setBuffer(root.listBuffers()[0]));
    const mesh = doc.createMesh(`${node.getName()}_part${i}`).addPrimitive(p);
    const child = doc.createNode(`${node.getName()}_part${i}`).setMesh(mesh);
    node.addChild(child);
  });
  node.setMesh(null);
  console.log(`${node.getName()}: ${parts.length} parts`);
}
await io.write(output, doc);
// Report the parts' bounds (metres).
const doc2 = await io.read(output);
for (const n of doc2.getRoot().listNodes()) {
  if (!/_part\d+$/.test(n.getName())) continue;
  const b = getBounds(n); const f = (v) => v.map((x) => (x / 100).toFixed(2)).join(',');
  const size = Math.max(...b.max.map((x, k) => (x - b.min[k]) / 100));
  if (size > 0.8) console.log(n.getName().padEnd(22), 'min', f(b.min), ' max', f(b.max));
}
