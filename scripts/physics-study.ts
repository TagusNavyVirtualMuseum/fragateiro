// Physics study: how each boat model behaves in a set of fixed situations. Each run starts
// from rest, holds the heading (the boat cannot turn), keeps the sheets fixed, and logs the
// speed, heel and every force once a second for a minute.
//
//   npm run study                 # all studies, wind 12 kn
//   npm run study -- --wind 8     # another wind speed, knots
//
// Writes docs/physics-study/data/<study>.csv (one row per boat, case and second) and
// docs/physics-study/results.md (summary tables). The findings are in
// docs/physics-study/README.md, written by hand from these results.
//
// Studies:
//   heading-north  the boat faces north; the wind comes from N, S, E and W; sheets middle
//   sheets-in      wind from N; headings 000, 045, 090, 180; every sheet hauled in (0)
//   furled         wind from N; headings 000, 045, 090, 180; no sails set (bare poles)
//   sheets-middle  wind from N; headings 000, 045, 090, 180; every sheet half out (0.5)
//   sheets-out     wind from N; headings 000, 045, 090, 180; every sheet fully out (1)

import { mkdirSync, writeFileSync } from 'node:fs';
import { BOATS, SailboatSim, SteadyWind, deg2rad, groupsInMode, toKnots, type BoatSpec } from '../src/physics';

const args = process.argv.slice(2);
const windKn = Number(args[args.indexOf('--wind') + 1]) || 12;
const WIND = windKn * 0.514444; // m/s
const SECONDS = 60;
const DT = 1 / 30;
const OUT = new URL('../docs/physics-study/', import.meta.url);

interface Case {
  /** Label in the tables. */
  label: string;
  heading: number; // deg
  windFrom: number; // deg
  /** Sheet for every group, or null for no sails. */
  sheet: number | null;
}

interface Study {
  id: string;
  title: string;
  cases: Case[];
}

const HEADINGS = [0, 45, 90, 180];
const byHeading = (sheet: number | null): Case[] => HEADINGS.map((h) => ({ label: `heading ${String(h).padStart(3, '0')}`, heading: h, windFrom: 0, sheet }));

export const STUDIES: Study[] = [
  {
    id: 'heading-north',
    title: 'Boat facing north, wind from each side (sheets middle)',
    cases: [
      { label: 'wind from N (head to wind)', heading: 0, windFrom: 0, sheet: 0.5 },
      { label: 'wind from E (beam, starboard)', heading: 0, windFrom: 90, sheet: 0.5 },
      { label: 'wind from S (dead astern)', heading: 0, windFrom: 180, sheet: 0.5 },
      { label: 'wind from W (beam, port)', heading: 0, windFrom: 270, sheet: 0.5 },
    ],
  },
  { id: 'sheets-in', title: 'Wind from north, sheets hauled in', cases: byHeading(0) },
  { id: 'furled', title: 'Wind from north, no sails set (bare poles)', cases: byHeading(null) },
  { id: 'sheets-middle', title: 'Wind from north, sheets half out', cases: byHeading(0.5) },
  { id: 'sheets-out', title: 'Wind from north, sheets fully out', cases: byHeading(1) },
];

/** Each boat in each of its modes (the Muleta has two). */
function variants(): { name: string; spec: BoatSpec; mode: string }[] {
  const out: { name: string; spec: BoatSpec; mode: string }[] = [];
  for (const spec of BOATS) for (const m of spec.modes) out.push({ name: spec.modes.length > 1 ? `${spec.name} (${m.name})` : spec.name, spec, mode: m.id });
  return out;
}

const COLUMNS = [
  'boat', 'case', 't_s', 'speed_kn', 'surge_kn', 'sway_kn', 'heel_deg',
  'apparent_wind_kn', 'apparent_angle_deg',
  'sails_fx_N', 'sails_fy_N', 'keel_fx_N', 'keel_fy_N', 'rudder_fx_N', 'rudder_fy_N',
  'resistance_fx_N', 'windage_fx_N', 'windage_fy_N', 'net_fx_N', 'net_fy_N', 'total_fx_N', 'total_fy_N',
  'sail_angles_deg', 'sail_alpha_deg', 'sails_flapping',
];

export interface Sample {
  t: number;
  speedKn: number;
  surgeKn: number;
  swayKn: number;
  heelDeg: number;
  awKn: number;
  awaDeg: number;
  sails: [number, number];
  keel: [number, number];
  rudder: [number, number];
  resistance: number;
  windage: [number, number];
  net: [number, number];
  total: [number, number];
  sailAngles: string;
  alphas: string;
  flapping: string;
}

/** Run one case and sample it once a second (t = 1..60). */
export function runCase(spec: BoatSpec, mode: string, c: Case): Sample[] {
  // Bare poles: a copy of the boat with an extra mode that sets no sails.
  const s = c.sheet === null ? { ...spec, modes: [...spec.modes, { id: 'furled', name: 'Furled', description: '', sails: [] }] } : spec;
  const sim = new SailboatSim(s, new SteadyWind(c.windFrom, WIND), { heading: deg2rad(c.heading) });
  sim.lockHeading = true;
  sim.controls.mode = c.sheet === null ? 'furled' : mode;
  // As in the game's medium level: balanced sails, rudder centred.
  sim.controls.balanced = true;
  if (c.sheet !== null) for (const g of groupsInMode(s, mode)) sim.controls.sheets[g] = c.sheet;
  const samples: Sample[] = [];
  const steps = Math.round(1 / DT);
  for (let sec = 1; sec <= SECONDS; sec++) {
    for (let i = 0; i < steps; i++) sim.step(DT);
    const st = sim.state;
    const r = sim.report;
    const active = r.sails.filter((x) => x.active);
    const sum = (f: (x: { fx: number; fy: number }) => number, list: { fx: number; fy: number }[]) => list.reduce((a, x) => a + f(x), 0);
    const sails: [number, number] = [sum((x) => x.fx, active), sum((x) => x.fy, active)];
    const net: [number, number] = [sum((x) => x.fx, r.net), sum((x) => x.fy, r.net)];
    const total: [number, number] = [
      sails[0] + r.keel.fx + r.rudder.fx + r.resistance.fx + r.windage.fx + net[0],
      sails[1] + r.keel.fy + r.rudder.fy + r.resistance.fy + r.windage.fy + net[1],
    ];
    samples.push({
      t: sec,
      speedKn: toKnots(Math.hypot(st.u, st.v)),
      surgeKn: toKnots(st.u),
      swayKn: toKnots(st.v),
      heelDeg: (st.heel * 180) / Math.PI,
      awKn: toKnots(r.apparentWindSpeed),
      awaDeg: r.apparentWindAngleDeg,
      sails,
      keel: [r.keel.fx, r.keel.fy],
      rudder: [r.rudder.fx, r.rudder.fy],
      resistance: r.resistance.fx,
      windage: [r.windage.fx, r.windage.fy],
      net,
      total,
      sailAngles: active.map((x) => `${x.id}:${(((st.sailAngles[x.id] ?? 0) * 180) / Math.PI).toFixed(0)}`).join(' '),
      alphas: active.map((x) => `${x.id}:${x.alphaDeg.toFixed(0)}`).join(' '),
      flapping: active.filter((x) => x.luffing).map((x) => x.id).join(' '),
    });
  }
  return samples;
}

const f = (v: number, d = 1) => (Math.abs(v) < 0.05 && d <= 1 ? '0' : v.toFixed(d));

function main(): void {
  mkdirSync(new URL('data/', OUT), { recursive: true });
  const md: string[] = [
    '# Physics study: results',
    '',
    `Generated by \`npm run study\` (scripts/physics-study.ts). True wind ${windKn} kn (${WIND.toFixed(2)} m/s). ` +
      'Every run starts from rest, holds its heading (the boat cannot turn), keeps the sheets fixed and lasts 60 s; ' +
      'balanced sails and centred rudder, as in the medium level. Boat frame: x forward, y to starboard; ' +
      'forces in newtons. Full time series in `data/`.',
    '',
  ];
  for (const study of STUDIES) {
    const rows: string[] = [COLUMNS.join(',')];
    md.push(`## ${study.title}`, '', `\`data/${study.id}.csv\``, '');
    md.push('| Boat | Case | Speed at 10 s (kn) | Speed at 60 s (kn) | Surge / sway at 60 s (kn) | Heel (°) | Sails fx / fy (N) | Hull fy (N) | Windage fx (N) | Resistance fx (N) | Flapping |');
    md.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const v of variants()) {
      for (const c of study.cases) {
        const samples = runCase(v.spec, v.mode, c);
        for (const s of samples) {
          rows.push(
            [
              `"${v.name}"`, `"${c.label}"`, s.t, f(s.speedKn, 2), f(s.surgeKn, 2), f(s.swayKn, 2), f(s.heelDeg, 1), f(s.awKn, 1), f(s.awaDeg, 0),
              f(s.sails[0], 0), f(s.sails[1], 0), f(s.keel[0], 0), f(s.keel[1], 0), f(s.rudder[0], 0), f(s.rudder[1], 0),
              f(s.resistance, 0), f(s.windage[0], 0), f(s.windage[1], 0), f(s.net[0], 0), f(s.net[1], 0), f(s.total[0], 0), f(s.total[1], 0),
              `"${s.sailAngles}"`, `"${s.alphas}"`, `"${s.flapping}"`,
            ].join(','),
          );
        }
        const a = samples[9];
        const z = samples[samples.length - 1];
        md.push(
          `| ${v.name} | ${c.label} | ${f(a.speedKn)} | ${f(z.speedKn)} | ${f(z.surgeKn)} / ${f(z.swayKn)} | ${f(z.heelDeg)} | ${f(z.sails[0], 0)} / ${f(z.sails[1], 0)} | ${f(z.keel[1] + z.rudder[1], 0)} | ${f(z.windage[0], 0)} | ${f(z.resistance, 0)} | ${z.flapping || '–'} |`,
        );
      }
    }
    writeFileSync(new URL(`data/${study.id}.csv`, OUT), rows.join('\n') + '\n');
    md.push('');
    console.log(`${study.id}: ${rows.length - 1} rows`);
  }
  writeFileSync(new URL('results.md', OUT), md.join('\n'));
  console.log(`wrote ${new URL('results.md', OUT).pathname}`);
}

main();
