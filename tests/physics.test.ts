import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATRAIO,
  FALUA,
  FRAGATA,
  MULETA,
  SailboatSim,
  SteadyWind,
  deg2rad,
  foilForce,
  groupsInMode,
  polar,
  sailCurve,
  steadyState,
  toKnots,
  wrapPi,
} from '../src/physics';

const WIND = 6; // m/s, the wind used in the paper's tests

describe('foil force', () => {
  it('lift is perpendicular to the flow and drag is along it', () => {
    // Chord pointing aft and slightly to starboard, flow from the port side.
    const f = foilForce(-Math.cos(0.5), Math.sin(0.5), 0, 5, 10, 1.2, sailCurve());
    const dragPart = f.fy; // the flow is along +y
    expect(dragPart).toBeCloseTo(f.drag, 6);
    expect(Math.abs(f.fx)).toBeCloseTo(Math.abs(f.lift), 6);
  });

  it('beam reach: a sheeted sail drives the boat forward', () => {
    const delta = deg2rad(45);
    const f = foilForce(-Math.cos(delta), Math.sin(delta), 0, 6, 20, 1.2, sailCurve());
    expect(f.fx).toBeGreaterThan(0);
  });

  it('no flow, no force', () => {
    const f = foilForce(-1, 0, 0, 0, 20, 1.2, sailCurve());
    expect(f.fx).toBe(0);
    expect(f.fy).toBe(0);
  });
});

describe('wrapPi', () => {
  it('wraps angles into [-π, π)', () => {
    expect(Math.abs(wrapPi(3 * Math.PI))).toBeCloseTo(Math.PI, 9);
    expect(wrapPi(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 9);
    expect(wrapPi(2 * Math.PI + 0.1)).toBeCloseTo(0.1, 9);
  });
});

for (const [boat, mode] of [
  [FALUA, 'sailing'],
  [MULETA, 'regular'],
  [FRAGATA, 'sailing'],
  [CATRAIO, 'sailing'],
] as const) {
  describe(`${boat.name} (${mode}) points of sail`, () => {
    const angles = [30, 45, 90, 180];
    const [p30, p45, p90, p180] = polar(boat, mode, WIND, angles, 5);

    it('cannot sail straight into the wind (no-go zone)', () => {
      expect(p30.surgeKn).toBeLessThan(0.5);
    });

    it('can sail close-hauled at about 45°', () => {
      expect(p45.surgeKn).toBeGreaterThan(1);
    });

    it('is faster on a beam reach than close-hauled, with plausible speeds', () => {
      expect(p90.surgeKn).toBeGreaterThan(p45.surgeKn);
      expect(p90.surgeKn).toBeGreaterThan(3);
      expect(p90.surgeKn).toBeLessThan(8);
    });

    it('sheet setting: in when close-hauled, half-way on a beam reach, out when running', () => {
      expect(p45.bestSheet).toBeLessThanOrEqual(0.2);
      expect(p90.bestSheet).toBeGreaterThan(0.2);
      expect(p90.bestSheet).toBeLessThan(0.8);
      expect(p180.bestSheet).toBeGreaterThanOrEqual(0.8);
    });

    it('heels and drifts away from the wind', () => {
      // Wind from starboard (positive TWA): heel and leeway go to port (negative).
      expect(p90.heelDeg).toBeLessThan(0);
      expect(p45.swayKn).toBeLessThan(0);
    });
  });
}

describe('steering', () => {
  function turn(rudder: number) {
    const sim = new SailboatSim(FALUA, new SteadyWind(0, WIND), { heading: deg2rad(-90), u: 2 });
    sim.controls.sheets = { fore: 0.4, main: 0.4 };
    sim.controls.rudder = rudder;
    for (let i = 0; i < 5 * 60; i++) sim.step(1 / 60);
    return wrapPi(sim.state.heading - deg2rad(-90));
  }
  it('rudder to starboard turns the bow to starboard, and vice versa', () => {
    expect(turn(0.5)).toBeGreaterThan(deg2rad(5));
    expect(turn(-0.5)).toBeLessThan(-deg2rad(5));
  });

  it('a boat pointing into the wind stops and its sails flap', () => {
    const sim = new SailboatSim(FALUA, new SteadyWind(0, WIND), { heading: 0, u: 0 });
    for (let i = 0; i < 20 * 60; i++) sim.step(1 / 60);
    expect(toKnots(sim.state.u)).toBeLessThan(0.3);
    expect(sim.report.sails.every((s) => s.luffing)).toBe(true);
  });
});

describe('Muleta modes', () => {
  it('regular mode trims front and main; fishing mode adds the rear sails', () => {
    expect(groupsInMode(MULETA, 'regular').sort()).toEqual(['front', 'main']);
    expect(groupsInMode(MULETA, 'fishing').sort()).toEqual(['front', 'main', 'rear']);
  });

  it('regular mode sails only the main and front sails', () => {
    const sim = new SailboatSim(MULETA, new SteadyWind(0, WIND), { heading: deg2rad(-90) });
    sim.controls.mode = 'regular';
    sim.step(0.1);
    const active = sim.report.sails.filter((s) => s.active).map((s) => s.id);
    expect(active.sort()).toEqual(['front', 'main']);
    expect(sim.report.net).toHaveLength(0);
  });

  it('lateral fishing: beam-on with sheets in, the boat drifts sideways, slowly', () => {
    const r = steadyState(MULETA, 'fishing', 90, WIND, 0);
    expect(Math.abs(r.swayKn)).toBeGreaterThan(0.6);
    expect(Math.abs(r.swayKn)).toBeLessThan(3);
    expect(Math.abs(r.surgeKn)).toBeLessThan(0.6);
  });

  it('the net slows the boat down', () => {
    const regular = steadyState(MULETA, 'regular', 90, WIND, 0.4);
    const fishing = steadyState(MULETA, 'fishing', 90, WIND, 0.4);
    expect(Math.hypot(fishing.surgeKn, fishing.swayKn)).toBeLessThan(regular.surgeKn / 2);
  });
});

describe('architecture', () => {
  it('the physics never imports the 3D engine', () => {
    const dir = join(__dirname, '../src/physics');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.isDirectory()) walk(join(d, e.name));
        else files.push(join(d, e.name));
      }
    };
    walk(dir);
    for (const f of files) expect(readFileSync(f, 'utf8')).not.toMatch(/@babylonjs|document\.|window\./);
  });
});
