// Checks the folder shared with the narrative tool (content/narrative, see its README).
import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dir = new URL('../content/narrative/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, dir), 'utf8'));

const contract = read('contract.json');
const world = read('from-game/world.json');
const moments: string[] = read('from-game/moments.json').moments.map((m: { id: string }) => m.id);
const index = read('from-tool/index.json');

const names = (v: unknown): string[] =>
  Array.isArray(v) ? v.flatMap(names) : v && typeof v === 'object' ? Object.values(v).flatMap(names) : typeof v === 'string' ? [v] : [];
const areas = new Set(Object.keys(world.area_names));
const boats = new Set<string>(world.boats.map((b: { name: string }) => b.name.toLowerCase()));
const places = new Set([...names(world.ports), ...names(world.extra_places), ...names(world.map_places), ...names(world.landmarks)]);

describe('content/narrative', () => {
  it('uses one contract version everywhere', () => {
    expect(contract.version).toBe(1);
    for (const f of ['from-game/moments.json', 'from-tool/index.json']) expect(read(f).version).toBe(contract.version);
    expect(places.size).toBeGreaterThan(0);
    expect(boats.has('falua')).toBe(true);
  });

  it('lists only line banks that exist and are valid', () => {
    for (const entry of index.banks) {
      expect(existsSync(new URL(`from-tool/${entry.file}`, dir)), entry.file).toBe(true);
      const bank = read(`from-tool/${entry.file}`);
      expect(bank.version).toBe(contract.version);
      expect(bank.minigame).toBe(entry.minigame);
      expect(bank.languages).toContain(contract.default_language);
      const cast = new Set(bank.cast.map((c: { id: string }) => c.id));
      const ids = new Set<string>();
      for (const line of bank.lines) {
        const where = `${entry.file} ${line.id}`;
        expect(ids.has(line.id), `duplicate ${where}`).toBe(false);
        ids.add(line.id);
        if (line.trigger.startsWith('near_place:')) {
          expect(places.has(line.trigger.slice('near_place:'.length)), `unknown place in ${where}`).toBe(true);
        } else expect(moments, `unknown moment in ${where}`).toContain(line.trigger);
        expect(contract.deliveries, where).toContain(line.delivery);
        expect(cast.has(line.speaker), `unknown speaker in ${where}`).toBe(true);
        for (const lang of bank.languages) expect(line.text[lang], `${lang} missing in ${where}`).toBeTruthy();
        for (const b of line.when?.boats ?? []) expect(boats.has(b), `unknown boat ${b} in ${where}`).toBe(true);
        for (const a of line.when?.areas ?? []) expect(areas.has(a), `unknown area ${a} in ${where}`).toBe(true);
        for (const p of line.when?.places ?? []) expect(places.has(p), `unknown place ${p} in ${where}`).toBe(true);
      }
    }
  });
});
