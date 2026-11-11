import { describe, expect, it } from 'vitest';
import { BOATS, GustyWind, SailboatSim } from '../src/physics';
import { Drill, HOLD_TIME, SLALOM_LIMIT, slalomBuoys, type DrillInput } from '../src/world/drills';

const step = (d: Drill, twaDeg: number, more: Partial<DrillInput> = {}) =>
  d.update({ twaDeg, heel: 0, sheet: 0.3, speed: 2, x: 0, y: 0, elapsed: 0, dt: 1, ...more });

/** Swing the wind across the boat from `a` to `b` degrees in small steps. */
function swing(d: Drill, a: number, b: number, more: Partial<DrillInput> = {}) {
  const events = [];
  const n = 40;
  for (let k = 0; k <= n; k++) {
    let x = a + ((b - a) * k) / n;
    if (x > 180) x -= 360;
    if (x < -180) x += 360;
    events.push(step(d, x, more));
  }
  return events.filter(Boolean);
}

describe('drills', () => {
  it('holding a beam reach for 30 s', () => {
    const d = new Drill('hold');
    for (let t = 0; t < HOLD_TIME - 1; t++) step(d, 90);
    step(d, 30); // luffed up: starts again
    expect(d.held).toBe(0);
    for (let t = 0; t < HOLD_TIME; t++) step(d, -95);
    expect(d.status).toBe('done');
  });

  it('counts tacks through the bow and gybes through the stern', () => {
    const d = new Drill('tack');
    expect(swing(d, 50, -50)).toEqual(['tack']);
    expect(swing(d, -50, -150)).toEqual([]); // bearing away is not a turn
    expect(swing(d, -150, -210)).toEqual(['wrongTurn']); // a gybe, in the tacking drill
    expect(swing(d, 150, 50)).toEqual([]);
    expect(swing(d, 50, -50)).toEqual(['tack']);
    expect(d.status).toBe('done');
  });

  it('sitting head to wind is not a string of tacks', () => {
    const d = new Drill('tack');
    step(d, 40);
    for (let k = 0; k < 20; k++) step(d, k % 2 ? 5 : -5);
    step(d, 40);
    expect(d.turns).toBe(0);
  });

  it('a gybe with the sheet let fly does not count', () => {
    const d = new Drill('gybe');
    expect(swing(d, 150, 210, { sheet: 1 })).toEqual(['wildGybe']);
    expect(swing(d, -150, -210, { sheet: 0.4 })).toEqual(['gybe']);
    expect(swing(d, 150, 210, { sheet: 1, autoTrim: true })).toEqual(['gybe']);
    expect(d.status).toBe('done');
  });

  it('capsizing ends a turning drill', () => {
    const d = new Drill('gybe');
    expect(step(d, 150, { heel: 0.8 })).toBe('capsize');
    expect(d.status).toBe('failed');
  });

  it('the slalom has a time limit', () => {
    const d = new Drill('slalom');
    swing(d, 50, -50);
    expect(step(d, -50, { elapsed: SLALOM_LIMIT + 1 })).toBe('timeout');
    expect(d.failure).toBe('timeout');
  });

  it('anchoring: stopped within a boat length', () => {
    const d = new Drill('anchor', { x: 100, y: 0 }, 8);
    step(d, 0, { x: 95, y: 0, speed: 1.5 });
    expect(d.status).toBe('on');
    step(d, 0, { x: 115, y: 0, speed: 0.1 });
    expect(d.status).toBe('on');
    step(d, 0, { x: 95, y: 3, speed: 0.2 });
    expect(d.status).toBe('done');
  });

  it('slalom buoys zigzag up the wind', () => {
    const b = slalomBuoys({ x: 0, y: 0 }, 0); // wind from the north
    expect(b).toHaveLength(4);
    expect(b.every((p, i) => i === 0 || p.y > b[i - 1].y)).toBe(true);
    expect(Math.sign(b[0].x)).toBe(-Math.sign(b[1].x));
  });

  it('a falua tacking every 22 s makes the four tacks inside the slalom limit', () => {
    const spec = BOATS.find((b) => b.id === 'falua')!;
    const sim = new SailboatSim(spec, new GustyWind(0, 12 * 0.514444, 0, 0), { heading: (50 * Math.PI) / 180, u: 1.5 });
    sim.controls.balanced = true;
    const d = new Drill('slalom');
    const dt = 1 / 30;
    let side = 1;
    let t = 0;
    for (; t < SLALOM_LIMIT && d.status === 'on'; t += dt) {
      sim.controls.rudder = Math.max(-1, Math.min(1, (sim.report.trueWindAngleDeg - 50 * side) * 0.05));
      Object.assign(sim.controls.sheets, sim.bestSheets());
      sim.step(dt);
      d.update({ twaDeg: sim.report.trueWindAngleDeg, heel: sim.state.heel, sheet: 0.3, speed: 2, x: 0, y: 0, elapsed: t, dt });
      if (Math.abs(t % 22) < dt) side = -side;
    }
    expect(d.status).toBe('done');
  });
});
