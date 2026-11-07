// Missions: regattas round buoys, transport between ports, fishing, or free sailing.
// Plain TypeScript (no 3D), so the rules can be tested.
import type { LandMask } from './landMask';

export type Level = 'easy' | 'medium' | 'hard';

export const LEVELS: { id: Level; name: string; description: string }[] = [
  { id: 'easy', name: 'Easy', description: 'The crew trims the sails for the best speed; no drift; balanced sails. Just steer.' },
  { id: 'medium', name: 'Medium', description: 'You trim the sheets; balanced sails.' },
  { id: 'hard', name: 'Hard', description: 'You trim the sheets; the sails turn the boat, and there is no help through a tack: ease the sheets as you turn through the wind, then steer to hold the new course.' },
];

export type MissionKind = 'regatta' | 'transport' | 'fishing' | 'free';

export type Mission =
  | { id: string; kind: 'transport'; title: string; boat: string; from: string; to: string }
  | { id: string; kind: 'regatta'; title: string; boat: string; at: string; buoys: 2 | 3 }
  | { id: string; kind: 'fishing'; title: string; boat: string; at: string; targetKg: number }
  | { id: string; kind: 'free'; title: string; boat: string; from: string };

/** The four kinds of mission, as the menu shows them first. */
export const MISSION_KINDS: { id: MissionKind; title: string; description: string }[] = [
  { id: 'regatta', title: 'Regatta', description: 'Round the buoys against the clock.' },
  { id: 'transport', title: 'Transport', description: 'Carry passengers or cargo from one port to another.' },
  { id: 'fishing', title: 'Fishing', description: 'Drift sideways with the Muleta and drag its net through the shoals.' },
  { id: 'free', title: 'Free sailing', description: 'Any boat, anywhere, no clock.' },
];

/** Regatta courses: laid to the wind off a port. */
export const REGATTA_COURSES: { id: string; name: string; at: string; buoys: 2 | 3 }[] = [
  { id: 'lisboa', name: 'In front of Lisbon (3 buoys)', at: 'Lisboa', buoys: 3 },
  { id: 'cascais', name: 'Cascais bay (2 buoys)', at: 'Cascais', buoys: 2 },
  { id: 'oeiras', name: 'Off Oeiras (2 buoys)', at: 'Oeiras', buoys: 2 },
];

/** Transport routes, with the boat that traditionally sailed them. */
export const ROUTES: { id: string; from: string; to: string; boat: string; description: string }[] = [
  { id: 'lisboa-almada', from: 'Lisboa', to: 'Almada', boat: 'catraio', description: 'Passengers across the river, as the catraios did every day.' },
  { id: 'moita-lisboa', from: 'Moita', to: 'Lisboa', boat: 'fragata', description: 'Cargo from the south bank to the city.' },
  { id: 'sarilhos-barreiro', from: 'Sarilhos Pequenos', to: 'Barreiro', boat: 'fragata', description: 'From the boatyards of Sarilhos to the quays of Barreiro.' },
  { id: 'vfx-lisboa', from: 'Vila Franca de Xira', to: 'Lisboa', boat: 'fragata', description: 'Down the river from the lezírias: a long haul.' },
];

/** Fishing grounds of the Muleta. */
export const FISHING_GROUNDS: { id: string; name: string; at: string }[] = [
  { id: 'seixal', name: 'Off Seixal', at: 'Seixal' },
  { id: 'barra', name: 'The river mouth (Trafaria)', at: 'Trafaria' },
  { id: 'cascais', name: 'Cascais bay', at: 'Cascais' },
];

/** Fish to bring home on a fishing trip, kg. */
export const FISHING_TARGET_KG = 150;

const boatName = (boats: { id: string; name: string }[], id: string) => boats.find((b) => b.id === id)?.name ?? id;

/** Build a mission from the menu's choices: a kind, one of its options, and a boat. */
export function makeMission(kind: MissionKind, option: string, boat: string, boats: { id: string; name: string }[]): Mission {
  const b = boatName(boats, boat);
  if (kind === 'regatta') {
    const c = REGATTA_COURSES.find((x) => x.id === option) ?? REGATTA_COURSES[0];
    return { id: `regatta-${c.id}-${boat}`, kind, title: `Regatta: ${c.name.replace(/ \(.*\)/, '')} · ${b}`, boat, at: c.at, buoys: c.buoys };
  }
  if (kind === 'transport') {
    const r = ROUTES.find((x) => x.id === option) ?? ROUTES[0];
    return { id: `transport-${r.id}-${boat}`, kind, title: `${r.from} to ${r.to} · ${b}`, boat, from: r.from, to: r.to };
  }
  if (kind === 'fishing') {
    const g = FISHING_GROUNDS.find((x) => x.id === option) ?? FISHING_GROUNDS[0];
    return { id: `fishing-${g.id}`, kind, title: `Fishing: ${g.name}`, boat: 'muleta', at: g.at, targetKg: FISHING_TARGET_KG };
  }
  return { id: `free-${option}-${boat}`, kind: 'free', title: `Free sailing · ${b}`, boat, from: option };
}

/** Passing this close to a buoy counts as rounding it, m. */
export const ROUNDING_RADIUS = 45;
/** Arriving within this distance of a port or the finish line ends the mission, m. */
export const ARRIVAL_RADIUS = 150;
export const FINISH_RADIUS = 60;

export interface Course {
  /** Start and finish line (its middle). */
  start: { x: number; y: number };
  buoys: { x: number; y: number }[];
}

/**
 * A regatta course in open water around `centre`, laid to the wind: the first buoy straight
 * upwind of the start (a beat), then reaching legs, then back to the line. Shrinks and turns
 * the course until every buoy and leg is in open water.
 */
export function buildCourse(mask: LandMask, centre: { x: number; y: number }, windFrom: number, buoys: 2 | 3, length = 600): Course | null {
  const open = (x: number, y: number) => {
    if (!mask.isReachable(x, y)) return false;
    for (let a = 0; a < 8; a++) if (!mask.isWater(x + 60 * Math.cos((a * Math.PI) / 4), y + 60 * Math.sin((a * Math.PI) / 4))) return false;
    return true;
  };
  const clearLeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = 0; s <= d; s += 40) if (!open(a.x + ((b.x - a.x) * s) / d, a.y + ((b.y - a.y) * s) / d)) return false;
    return true;
  };
  for (let L = length; L >= 250; L *= 0.85) {
    // turn: shift the whole course across the wind (in course lengths) to find room.
    for (const turn of [0, 0.25, -0.25, 0.5, -0.5]) {
      for (const side of [1, -1]) {
        // u: towards the wind; c: across it.
        const u = { x: Math.sin(windFrom), y: Math.cos(windFrom) };
        const c = { x: u.y * side, y: -u.x * side };
        const s0 = { x: centre.x - u.x * L * 0.4 + c.x * L * turn, y: centre.y - u.y * L * 0.4 + c.y * L * turn };
        const at = (ku: number, kc: number) => ({ x: s0.x + u.x * L * ku + c.x * L * kc, y: s0.y + u.y * L * ku + c.y * L * kc });
        const marks = buoys === 3 ? [at(1, 0), at(0.5, 0.6), at(0.12, 0.35)] : [at(1, 0), at(0.35, 0.55)];
        const path = [s0, ...marks, s0];
        if (path.every((p) => open(p.x, p.y)) && path.every((p, i) => i === 0 || clearLeg(path[i - 1], p))) return { start: s0, buoys: marks };
      }
    }
  }
  return null;
}

/** Progress through a mission: which buoy is next, and when it ended. */
export class MissionRun {
  /** Index of the next buoy (regatta); equals buoys.length when heading for the finish. */
  next = 0;
  finishedAt: number | null = null;

  constructor(
    readonly mission: Mission,
    readonly startedAt: number,
    readonly course: Course | null,
    readonly target: { x: number; y: number } | null,
  ) {}

  /** The point to sail to now (next buoy, the finish, or the port). */
  get goal(): { x: number; y: number } | null {
    if (this.course) return this.next < this.course.buoys.length ? this.course.buoys[this.next] : this.course.start;
    return this.target;
  }

  get goalName(): string {
    const m = this.mission;
    if (m.kind === 'transport') return m.to;
    if (this.course) return this.next < this.course.buoys.length ? `Buoy ${this.next + 1} of ${this.course.buoys.length}` : 'Finish line';
    return '';
  }

  /** Call every step with the boat's position and the game time. Returns true when it ends. */
  update(x: number, y: number, time: number): boolean {
    if (this.finishedAt !== null) return true;
    const g = this.goal;
    if (!g) return false;
    const d = Math.hypot(g.x - x, g.y - y);
    if (this.course) {
      if (this.next < this.course.buoys.length) {
        if (d < ROUNDING_RADIUS) this.next++;
      } else if (d < FINISH_RADIUS) this.finishedAt = time;
    } else if (d < ARRIVAL_RADIUS) this.finishedAt = time;
    return this.finishedAt !== null;
  }

  elapsed(time: number): number {
    return (this.finishedAt ?? time) - this.startedAt;
  }
}

/** Best times, kept in the browser: key per mission and level. */
export function bestTimeKey(missionId: string, level: Level): string {
  return `fragateiro.best.${missionId}.${level}`;
}
