import { describe, expect, it } from 'vitest';
import { clipBelow, floatHull, hullMesh, nearPolygon, polygonAreaCentroid, type P3 } from '../src/workshop/geometry';
import { buildBoat, estimateTurn, specSource, visualSource, type Project } from '../src/workshop/build';
import { polar } from '../src/physics';

describe('workshop geometry', () => {
  it('area and centroid of a square; clipping below a level', () => {
    const sq: [number, number][] = [[0, 0], [2, 0], [2, 2], [0, 2]];
    expect(polygonAreaCentroid(sq)).toEqual({ area: 4, cx: 1, cy: 1 });
    expect(polygonAreaCentroid(clipBelow(sq, 0.5)).area).toBeCloseTo(1);
    expect(nearPolygon([2.05, 1], sq, 0.1)).toBe(true);
    expect(nearPolygon([2.5, 1], sq, 0.1)).toBe(false);
  });

  it('a box 4 x 2 m floats 0.5 m deep with 4 m3 displaced', () => {
    const tris: [P3, P3, P3][] = [];
    for (let x = 0; x < 4; x += 0.05) for (let z = -1; z < 1; z += 0.05) tris.push([[x, -1, z], [x + 0.05, -1, z], [x, -1, z + 0.05]]);
    const f = floatHull(tris, 4);
    expect(f.level).toBeCloseTo(-0.5, 1);
    expect(f.waterlineLength).toBeCloseTo(4, 0);
    expect(f.cx).toBeCloseTo(2, 1);
  });
});

/** A boat drawn on a "photo" 10 units long: 8 m, 2 m beam, 1 t, a lugsail and a jib. */
const photo: Project = {
  source: 'photo',
  info: { id: 'test', name: 'Test', length: 8, beam: 2, mass: 1000, home: 'tejo', description: '' },
  bow: [0, 1.2],
  stern: [10, 1],
  sheer: [[0, 1.2], [5, 0.9], [10, 1]],
  keel: [[0, 0.6], [1.5, 0], [9, 0], [10, 0.3]],
  transom: false,
  masts: [{ foot: [3.5, 0.3], top: [3.6, 9] }],
  sails: [
    { id: 'main', rig: 'lug', points: [[3, 7.5], [8, 9], [9, 1.5], [3.2, 1.4]], keep: false },
    { id: 'jib', rig: 'jib', points: [[0.3, 1.3], [3.4, 7.5], [2.8, 1.5]], keep: false },
  ],
  rudder: [[9.8, 0.9], [10.6, 0.9], [10.6, -0.4], [9.9, -0.4]],
  tiller: [[8.6, 1.2], [9.9, 1.1]],
  ropes: [],
  sailWidth: 0.1,
  sparRadius: 0.05,
  ropeRadius: 0.02,
  colors: { bottom: '#7a2418', topsides: '#efeee9', stripe: '#c9a227', sail: '#ece6d6', spar: '#5a2618' },
};

describe('workshop builder (photo mode)', () => {
  it('builds a floating boat with its parts, and a spec that sails', async () => {
    const r = await buildBoat(photo, null, { simplify: false });
    const names = r.doc.getRoot().listNodes().map((n) => n.getName()).sort();
    expect(names).toEqual(['Casco', 'Leme', 'Vela_jib', 'Vela_main']);
    expect(r.spec.length).toBe(8);
    expect(r.spec.hull.waterlineLength).toBeGreaterThan(5);
    expect(r.spec.hull.waterlineLength).toBeLessThan(8.5);
    expect(r.spec.draft).toBeGreaterThan(0.1);
    // Sail areas in m²: the lug is about 0.8² of its 'photo' area.
    const main = r.spec.sails.find((s) => s.id === 'main')!;
    expect(main.group).toBe('main');
    expect(main.area).toBeGreaterThan(15);
    expect(r.spec.sails.find((s) => s.id === 'jib')!.group).toBe('jib');
    expect(r.spec.rudder.x).toBeLessThan(0); // aft of the centre
    const [p45, p90] = polar(r.spec, 'sailing', 6, [45, 90]);
    expect(p45.surgeKn).toBeGreaterThan(1);
    expect(p90.surgeKn).toBeGreaterThan(p45.surgeKn);
    // The bow is towards -x in the game.
    expect((r.visual.sails as { axis: { base: number[] } }[])[0].axis.base[0]).toBeLessThan(0);
    expect(specSource(r.spec)).toContain('export const TEST: BoatSpec');
    expect(visualSource('test', r.visual)).toContain('url: testUrl');
  });

  it('the lofted hull is closed at a pointed stern and open at a transom', () => {
    const shape = { bow: [0, 1] as [number, number], stern: [10, 1] as [number, number], sheer: [[0, 1], [10, 1]] as [number, number][], keel: [[0, 0], [10, 0]] as [number, number][], halfBeam: 1 };
    const zAtStern = (m: { positions: number[] }) => Math.max(...m.positions.filter((_, i) => i % 3 === 2 && m.positions[i - 2] > 9.99));
    expect(zAtStern(hullMesh({ ...shape, transom: false }))).toBeLessThan(0.05);
    expect(zAtStern(hullMesh({ ...shape, transom: true }))).toBeGreaterThan(0.4);
  });
});

describe('workshop builder (model mode)', () => {
  /** A flat strip of triangles along x (a 'hull' 0..10) and a blade beyond the stern (10..11). */
  async function model() {
    const { Document } = await import('@gltf-transform/core');
    const doc = new Document();
    const buf = doc.createBuffer();
    const pos: number[] = [];
    const idx: number[] = [];
    for (let x = 0; x < 11; x += 0.25) {
      for (const [y0, y1] of [[-1, -0.5], [-0.5, 0]]) {
        const o = pos.length / 3;
        pos.push(x, y0, 0.4, x + 0.25, y0, 0.4, x, y1, 0.4, x + 0.25, y1, 0.4);
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
        const p = pos.length / 3;
        pos.push(x, y0, -0.4, x + 0.25, y0, -0.4, x, y1, -0.4, x + 0.25, y1, -0.4);
        idx.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
      }
    }
    const prim = doc.createPrimitive();
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf));
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf));
    doc.createScene().addChild(doc.createNode('m').setMesh(doc.createMesh('m').addPrimitive(prim)));
    return doc;
  }
  const base: Project = {
    ...photo,
    source: 'model',
    bow: [0, 0],
    stern: [10, 0],
    masts: [],
    sails: [{ id: 'jib', rig: 'jib', points: [[1, 0.5], [3, 5], [3, 0.5]], keep: false }],
    // Drawn too far forward: it takes the last metre of the hull with it.
    rudder: [[9, 0.1], [11, 0.1], [11, -1.1], [9, -1.1]],
    tiller: undefined,
    sailWidth: 1,
  };
  const legTriangles = async (p: Project) => (await buildBoat(p, await model(), { simplify: false })).report.triangles.Leme;
  it('a "keep with hull" area takes back the hull caught by a too-large rudder outline', async () => {
    const wrong = await legTriangles(base);
    const fixed = await legTriangles({ ...base, hullAreas: [[[8.9, 0.2], [10, 0.2], [10, -1.2], [8.9, -1.2]]] });
    expect(fixed).toBeLessThan(wrong);
    expect(fixed).toBeGreaterThan(0);
  });

  it('a square sail drawn by its contour is taken whole, round and wide as it is', async () => {
    const { cloneDocument } = await import('@gltf-transform/functions');
    const doc = await model(); // the hull
    const buf = doc.getRoot().listBuffers()[0];
    const pos: number[] = [];
    const idx: number[] = [];
    // A sail across the boat (z -2..2) from y = 6 down to y = 1, bulging forward of x = 5:
    // 1.2 m in the middle, less towards its sides (so from the side it is a wide band).
    const bx = (y: number, z: number) => 5 - 1.2 * (1 - (z * z) / 8) * Math.sin((Math.PI * (6 - y)) / 5);
    let tris = 0;
    for (let y = 6; y > 1.01; y -= 0.25) {
      for (let z = -2; z < 1.99; z += 0.5) {
        const o = pos.length / 3;
        const y1 = y - 0.25;
        const z1 = z + 0.5;
        pos.push(bx(y, z), y, z, bx(y, z1), y, z1, bx(y1, z), y1, z, bx(y1, z1), y1, z1);
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
        tris += 2;
      }
    }
    const prim = doc.createPrimitive();
    prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buf));
    prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buf));
    doc.getRoot().listScenes()[0].addChild(doc.createNode('sail').setMesh(doc.createMesh('sail').addPrimitive(prim)));
    const project = (points: [number, number][]): Project => ({
      ...base,
      masts: [{ foot: [5, 0], top: [5, 7] }],
      sails: [{ id: 'sq', rig: 'square', points, keep: true, yardLength: 4 }],
      rudder: [],
    });
    const sailTris = async (p: Project) => (await buildBoat(p, cloneDocument(doc), { simplify: false })).report.triangles.Vela_sq ?? 0;
    // Yard and foot only (older projects): most of the belly stays behind with the hull.
    expect(await sailTris(project([[5, 6], [5, 1]]))).toBeLessThan(tris / 2);
    // Its contour clicked round it: all of it.
    expect(await sailTris(project([[5, 6.1], [4.4, 5.6], [3.7, 4.2], [3.7, 2.8], [4.4, 1.4], [5, 0.9], [5.15, 3.5]]))).toBe(tris);
    const contour: [number, number][] = [[5, 6.1], [4.4, 5.6], [3.7, 4.2], [3.7, 2.8], [4.4, 1.4], [5, 0.9], [5.15, 3.5]];
    // A stay drawn across it on the side view (kept with the hull) no longer cuts a band out of it.
    const withStay: Project = { ...project(contour), ropes: [{ a: [0, 0], b: [5, 6], mode: 'fixed' }], ropeRadius: 0.3 };
    expect(await sailTris(withStay)).toBe(tris);
    // What still takes pieces of sail is named: here a mast drawn through the belly, too thick.
    const thick: Project = { ...project(contour), masts: [{ foot: [4, 0], top: [4, 7] }], sparRadius: 0.5 };
    const r = await buildBoat(thick, cloneDocument(doc), { simplify: false });
    expect(r.report.triangles.Vela_sq).toBeLessThan(tris);
    expect(r.report.sailWarnings.join(' ')).toMatch(/the mast/);
  });

  it('a model turned off the side view: Straighten finds the turn that undoes it', async () => {
    const doc = await model();
    const b = (7 * Math.PI) / 180;
    for (const prim of doc.getRoot().listMeshes()[0].listPrimitives()) {
      const a = prim.getAttribute('POSITION')!;
      const arr = a.getArray()!.slice();
      for (let i = 0; i < arr.length; i += 3) {
        const [x, z] = [arr[i], arr[i + 2]];
        arr[i] = x * Math.cos(b) - z * Math.sin(b);
        arr[i + 2] = x * Math.sin(b) + z * Math.cos(b);
      }
      a.setArray(arr);
    }
    expect(estimateTurn(doc)).toBeCloseTo(-7, 0);
    expect(estimateTurn(await model())).toBeCloseTo(0, 1);
  });
});
