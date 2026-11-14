import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEG_GAP, Narrator, readingTime, type LineBank, type NarrativeLine } from '../src/world/narrator';
import { MomentDetector, NEAR_PLACE, type MomentInput } from '../src/world/moments';

const line = (id: string, trigger: string, delivery: NarrativeLine['delivery'], extra: Partial<NarrativeLine> = {}): NarrativeLine => ({
  id,
  trigger,
  delivery,
  speaker: 'k1',
  text: { pt: `pt ${id}`, en: `en ${id}` },
  status: 'approved',
  ...extra,
});

const bank = (lines: NarrativeLine[]): LineBank => ({
  version: 1,
  minigame: 'test',
  languages: ['pt', 'en'],
  cast: [{ id: 'k1', name: { pt: 'Arrais Joaquim', en: 'Skipper Joaquim' } }],
  lines,
  credits: [{ id: 's', title: 'A source' }],
});

const opts = { lang: 'pt', playtest: false, boat: 'muleta', area: 'tejo', places: ['Seixal'], random: () => 0 };

describe('narrator', () => {
  it('plays only approved lines, unless in playtest mode', () => {
    const b = bank([line('x.b1.l1', 'start', 'story'), line('x.b2.l1', 'start', 'story', { status: 'verified' })]);
    expect(new Narrator(b, opts).count).toBe(1);
    expect(new Narrator(b, { ...opts, playtest: true }).count).toBe(2);
  });

  it('keeps lines for other boats, areas or places out', () => {
    const b = bank([
      line('x.b1.l1', 'start', 'story', { when: { boats: ['falua'] } }),
      line('x.b2.l1', 'start', 'story', { when: { areas: ['tejo'], places: ['Seixal'] } }),
      line('x.b3.l1', 'start', 'story', { when: { places: ['Barreiro'] } }),
    ]);
    expect(new Narrator(b, opts).count).toBe(1);
  });

  it('one line of each group of alternatives, in the language chosen, with its speaker', () => {
    const n = new Narrator(bank([line('x.b1.l1', 'start', 'story'), line('x.b1.l2', 'start', 'story')]), { ...opts, lang: 'en' });
    n.report('start', 0);
    const c = n.update(0, true)!;
    expect(c).toMatchObject({ speaker: 'Skipper Joaquim', text: 'en x.b1.l1' });
    n.report('start', 1);
    expect(n.update(100, true)).toBeNull(); // the other alternative never plays
  });

  it('a story waits for a calm moment; a cue does not, and goes first', () => {
    const n = new Narrator(bank([line('x.b1.l1', 'start', 'story'), line('x.b2.l1', 'luffing_start', 'cue')]), opts);
    n.report('start', 0);
    expect(n.update(0, false)).toBeNull();
    n.report('luffing_start', 1);
    expect(n.update(1, false)?.id).toBe('x.b2.l1');
    const later = 1 + readingTime('pt x.b2.l1') + 1.5;
    expect(n.update(later, false)).toBeNull();
    expect(n.update(later, true)?.id).toBe('x.b1.l1');
  });

  it('a cue not shown in time is dropped', () => {
    const n = new Narrator(bank([line('x.b1.l1', 'start', 'story'), line('x.b2.l1', 'luffing_start', 'cue')]), opts);
    n.report('start', 0);
    expect(n.update(0, true)?.id).toBe('x.b1.l1');
    n.report('luffing_start', 1);
    expect(n.update(30, true)).toBeNull(); // the story took the screen until after the cue expired
  });

  it('lines for long legs one at a time, with a gap', () => {
    const n = new Narrator(bank([line('x.b1.l1', 'steady_leg', 'leg'), line('x.b1.l2', 'steady_leg', 'leg')]), opts);
    n.report('steady_leg', 0);
    expect(n.update(0, true)?.id).toBe('x.b1.l1');
    n.report('steady_leg', 20);
    expect(n.update(20, true)).toBeNull();
    n.report('steady_leg', LEG_GAP + 1);
    expect(n.update(LEG_GAP + 1, true)?.id).toBe('x.b1.l2');
  });

  it('curiosities go to the logbook, not on screen', () => {
    const n = new Narrator(bank([line('x.b7.l1', 'net_out', 'curiosity')]), opts);
    n.report('net_out', 0);
    expect(n.update(0, true)).toBeNull();
    expect(n.logbook.map((c) => c.text)).toEqual(['pt x.b7.l1']);
    expect(n.credits).toEqual(['A source']);
  });

  it('the fishing bank from the narrative tool plays in playtest mode', () => {
    const real = JSON.parse(readFileSync(new URL('../content/narrative/from-tool/lines/fishing.json', import.meta.url), 'utf8')) as LineBank;
    const n = new Narrator(real, { ...opts, playtest: true });
    expect(n.placesToWatch).toContain('Seixal');
    n.report('start', 0);
    const c = n.update(0, true)!;
    expect(c.speaker).toBe('Arrais Joaquim');
    expect(c.text.length).toBeGreaterThan(20);
  });
});

describe('moments', () => {
  const base: MomentInput = { twaDeg: 50, speed: 2, luffing: 0, heel: 0, heading: 0, aground: false, distanceToTarget: null, x: 0, y: 0, dt: 0.1 };
  const run = (d: MomentDetector, seconds: number, input: Partial<MomentInput>) => {
    const out: string[] = [];
    for (let t = 0; t < seconds; t += 0.1) out.push(...d.update({ ...base, ...input }));
    return out;
  };

  it('a tack, a gybe, and a calm moment after them', () => {
    const d = new MomentDetector();
    run(d, 1, { twaDeg: 50 });
    expect(run(d, 0.3, { twaDeg: -50 })).toContain('tack');
    expect(d.calm()).toBe(false);
    run(d, 1, { twaDeg: -150 });
    expect(run(d, 0.3, { twaDeg: 150 })).toContain('gybe');
    run(d, 9, { twaDeg: 150 });
    expect(d.calm()).toBe(true);
  });

  it('into irons and out again', () => {
    const d = new MomentDetector();
    expect(run(d, 4, { twaDeg: 10, speed: 0.2 })).toContain('enter_irons');
    expect(run(d, 1, { twaDeg: 60, speed: 1.2 })).toContain('out_of_irons');
  });

  it('luffing, and trimmed again', () => {
    const d = new MomentDetector();
    expect(run(d, 6, { luffing: 1 })).toContain('luffing_start');
    expect(run(d, 4, { luffing: 0 })).toContain('luffing_stop');
  });

  it('a steady leg every 20 s on the same heading', () => {
    const d = new MomentDetector();
    expect(run(d, 30, { twaDeg: 90 }).filter((m) => m === 'steady_leg')).toHaveLength(1);
    expect(run(d, 21, { twaDeg: 90 }).filter((m) => m === 'steady_leg')).toHaveLength(1);
  });

  it('nearing the goal, and passing a named place once', () => {
    const d = new MomentDetector([{ name: 'Seixal', x: 0, y: NEAR_PLACE + 100 }]);
    expect(run(d, 0.5, { distanceToTarget: 250 })).toEqual(['approach_target']);
    expect(run(d, 0.5, { y: 200, distanceToTarget: 250 })).toEqual(['near_place:Seixal']);
    expect(run(d, 0.5, { y: 200 })).toEqual([]);
  });
});
