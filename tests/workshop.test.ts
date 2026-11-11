import { describe, expect, it } from 'vitest';
import { clipBelow, floatHull, hullMesh, nearPolygon, polygonAreaCentroid, type P3 } from '../src/workshop/geometry';
import { buildBoat, specSource, visualSource, type Project } from '../src/workshop/build';
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
