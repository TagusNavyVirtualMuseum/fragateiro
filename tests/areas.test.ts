import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AREAS, AREA_IDS } from '../src/world/area';
import { AREA_MISSIONS } from '../src/world/missions';
import { BOATS } from '../src/physics';

const FILES = { tejo: 'tagus', arcachon: 'arcachon', aveiro: 'aveiro' } as const;

describe('sailing areas', () => {
  for (const id of AREA_IDS) {
    const area = AREAS[id];
    const meta = JSON.parse(readFileSync(new URL(`../src/assets/map/${FILES[id]}.json`, import.meta.url), 'utf8'));
    const names = new Set<string>([...meta.places.map((p: { name: string }) => p.name), ...area.extraPlaces.map((p) => p.name)]);
    it(`${id}: every port is a place on its map`, () => {
      expect(area.ports.filter((p) => !names.has(p))).toEqual([]);
    });
    it(`${id}: missions start and end at its ports, with a boat the game has`, () => {
      const m = AREA_MISSIONS[id];
      const places = [...m.courses.map((c) => c.at), ...m.routes.flatMap((r) => [r.from, r.to]), ...m.grounds.map((g) => g.at)];
      expect(places.filter((p) => !area.ports.includes(p))).toEqual([]);
      expect(m.routes.filter((r) => !BOATS.some((b) => b.id === r.boat))).toEqual([]);
      expect(BOATS.some((b) => b.id === area.boat)).toBe(true);
    });
  }
  it('mission ids are unique across areas', () => {
    const ids = AREA_IDS.flatMap((id) => [...AREA_MISSIONS[id].courses.map((c) => c.id), ...AREA_MISSIONS[id].routes.map((r) => r.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
