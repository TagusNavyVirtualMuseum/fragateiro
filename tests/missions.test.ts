import { t } from '../src/i18n';
import { describe, expect, it } from 'vitest';
import { LandMask, type MapMeta } from '../src/world/landMask';
import { BOATS } from '../src/physics';
import { CLEANUPS, FISHING_GROUNDS, MISSION_KINDS, SUPPLIES, WHALING, REGATTA_COURSES, ROUTES, MissionRun, buildCourse, makeMission } from '../src/world/missions';

// 20 x 20 km: open water, land in the east (x >= 4 km).
function mask(): LandMask {
  const meta: MapMeta = { cellSize: 100, width: 200, height: 200, northWest: { x: -10000, y: 10000 }, origin: { lat: 0, lon: 0 }, places: [] };
  const water = new Uint8Array(200 * 200);
  for (let r = 0; r < 200; r++) for (let c = 0; c < 200; c++) water[r * 200 + c] = c < 140 ? 255 : 0;
  return new LandMask(meta, water);
}

describe('missions', () => {
  it('lays a course with the first buoy upwind of the start', () => {
    const m = mask();
    const course = buildCourse(m, { x: 0, y: 0 }, 0, 3)!; // wind from the north
    expect(course.buoys).toHaveLength(3);
    expect(course.buoys[0].y - course.start.y).toBeGreaterThan(400);
    expect(Math.abs(course.buoys[0].x - course.start.x)).toBeLessThan(1);
    for (const b of course.buoys) expect(m.isWater(b.x, b.y)).toBe(true);
  });

  it('keeps the course off the land (shifts or shrinks it)', () => {
    const m = mask();
    // Centre 300 m from the shore, wind from the west: the course must stay in the water.
    const course = buildCourse(m, { x: 3700, y: 0 }, -Math.PI / 2, 2)!;
    expect(course).not.toBeNull();
    for (const p of [course.start, ...course.buoys]) expect(p.x).toBeLessThan(4000 - 50);
  });

  it('counts buoys in order and finishes back at the line', () => {
    const course = { start: { x: 0, y: 0 }, buoys: [{ x: 0, y: 500 }, { x: 300, y: 250 }] };
    const run = new MissionRun(makeMission('regatta', 'cascais', 'falua', BOATS), 10, course, null);
    run.update(300, 250, 20); // the second buoy first: does not count
    expect(run.next).toBe(0);
    run.update(10, 490, 30);
    run.update(290, 260, 40);
    expect(run.goalName).toBe(t('goal.finish'));
    expect(run.update(20, 20, 50)).toBe(true);
    expect(run.elapsed(99)).toBe(40);
  });

  it('builds a mission for every choice, with ids that keep best times apart', () => {
    const ids = new Set<string>();
    for (const k of MISSION_KINDS) {
      const options =
        k.id === 'regatta'
          ? REGATTA_COURSES.map((c) => c.id)
          : k.id === 'transport'
            ? ROUTES.map((r) => r.id)
            : k.id === 'cleanup'
              ? CLEANUPS.tejo.map((c) => c.id)
              : k.id === 'supply'
                ? SUPPLIES.tejo.map((c) => c.id)
                : k.id === 'whaling'
                  ? WHALING.azores
                : k.id === 'fishing'
                  ? FISHING_GROUNDS.map((g) => g.id)
                  : ['Lisboa'];
      for (const o of options) {
        for (const b of BOATS) {
          const m = makeMission(k.id, o, b.id, BOATS);
          expect(m.kind).toBe(k.id);
          if (m.kind === 'fishing') expect(m.boat).toBe('muleta');
          else expect(m.boat).toBe(b.id);
          ids.add(m.id);
        }
      }
    }
    // Regattas, transport, clean-ups and supply runs keep one best time per boat; fishing is
    // always the Muleta.
    const perBoat = REGATTA_COURSES.length + ROUTES.length + CLEANUPS.tejo.length + SUPPLIES.tejo.length + WHALING.azores.length + 1;
    expect(ids.size).toBe(perBoat * BOATS.length + FISHING_GROUNDS.length);
  });
});

describe('museum mini-games', () => {
  it('each starts a mission with its boat, from a port of its area', async () => {
    const { MINIGAMES } = await import('../src/world/missions');
    const { AREAS } = await import('../src/world/area');
    for (const g of MINIGAMES) {
      const m = g.mission(BOATS);
      expect(m.boat).toBe(g.boat);
      expect(BOATS.some((b) => b.id === g.boat)).toBe(true);
      const place = 'from' in m ? m.from : 'at' in m ? m.at : '';
      expect(AREAS[g.area].ports).toContain(place);
    }
  });
});

describe('content/minigames.json', () => {
  it('has no mistakes (areas, boats, ports, fields, texts)', async () => {
    const { checkGames } = await import('../src/world/missions');
    const { tMaybe } = await import('../src/i18n');
    const cfg = (await import('../content/minigames.json')).default;
    expect(checkGames(cfg as never, BOATS.map((b) => b.id), (k) => tMaybe(k) !== undefined)).toEqual([]);
  });
  it('reports mistakes in plain words', async () => {
    const { checkGames } = await import('../src/world/missions');
    const bad = {
      drills: [{ id: 'hold', drill: 'hover', area: 'tejo', boat: 'baleeiro', from: 'Lisbon' }],
      minigames: [{ id: 'nothing', type: 'transport', area: 'mars', boat: 'yacht', from: 'Lisboa' }],
    };
    const out = checkGames(bad as never, BOATS.map((b) => b.id), (k) => k.startsWith('drill.'));
    expect(out.join('\n')).toMatch(/unknown kind "hover"/);
    expect(out.join('\n')).toMatch(/"Lisbon" is not a port of tejo/);
    expect(out.join('\n')).toMatch(/unknown area "mars"/);
    expect(out.join('\n')).toMatch(/unknown boat "yacht"/);
    expect(out.join('\n')).toMatch(/needs "to"/);
    expect(out.join('\n')).toMatch(/no text "mini.nothing"/);
  });
  it('drills take their numbers from the file', async () => {
    const { DRILLS } = await import('../src/world/missions');
    const m = DRILLS.find((d) => d.id === 'drill-slalom')!.mission(BOATS);
    expect(m.kind === 'drill' && m.goals).toEqual({ seconds: undefined, limit: 120, turns: 4 });
  });
});
