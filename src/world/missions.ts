// Missions: sail from one port to another, or round a course of buoys against the clock.
// Plain TypeScript (no 3D), so the rules can be tested.
import type { LandMask } from './landMask';

export type Level = 'easy' | 'medium' | 'hard';

export const LEVELS: { id: Level; name: string; description: string }[] = [
  { id: 'easy', name: 'Easy', description: 'The sails trim themselves; balanced sails.' },
  { id: 'medium', name: 'Medium', description: 'You trim the sheets; balanced sails.' },
  { id: 'hard', name: 'Hard', description: 'You trim the sheets; the boat is not balanced and tacking needs skill.' },
];

export type Mission =
  | { id: string; kind: 'route'; title: string; boat: string; from: string; to: string; description: string }
  | { id: string; kind: 'regatta'; title: string; boat: string; at: string; buoys: 2 | 3; description: string }
  | { id: string; kind: 'free'; title: string; description: string };

export const MISSIONS: Mission[] = [
  { id: 'lisboa-almada', kind: 'route', title: 'Lisbon to Almada', boat: 'catraio', from: 'Lisboa', to: 'Almada', description: 'Cross the river with passengers, as the catraios did every day.' },
  { id: 'moita-lisboa', kind: 'route', title: 'Moita to Lisbon', boat: 'fragata', from: 'Moita', to: 'Lisboa', description: 'Bring a cargo from the south bank to the city.' },
  { id: 'sarilhos-barreiro', kind: 'route', title: 'Sarilhos to Barreiro', boat: 'fragata', from: 'Sarilhos Pequenos', to: 'Barreiro', description: 'From the boatyards of Sarilhos to the quays of Barreiro.' },
  { id: 'vfx-lisboa', kind: 'route', title: 'Vila Franca to Lisbon', boat: 'fragata', from: 'Vila Franca de Xira', to: 'Lisboa', description: 'Down the river from the lezírias to Lisbon, a long haul.' },
  { id: 'regatta-lisboa-falua', kind: 'regatta', title: 'Lisbon regatta (Falua)', boat: 'falua', at: 'Lisboa', buoys: 3, description: 'Three buoys in front of Lisbon: round them in order and back to the line.' },
  { id: 'regatta-lisboa-catraio', kind: 'regatta', title: 'Lisbon regatta (Catraio)', boat: 'catraio', at: 'Lisboa', buoys: 3, description: 'Three buoys in front of Lisbon: round them in order and back to the line.' },
  { id: 'regatta-cascais', kind: 'regatta', title: 'Cascais regatta', boat: 'falua', at: 'Cascais', buoys: 2, description: 'Two buoys in Cascais bay, open to the sea.' },
  { id: 'regatta-oeiras', kind: 'regatta', title: 'Oeiras regatta', boat: 'catraio', at: 'Oeiras', buoys: 2, description: 'Two buoys off Oeiras, at the mouth of the river.' },
  { id: 'free', kind: 'free', title: 'Free sailing', description: 'Any boat, anywhere: move between ports and choose where to sail.' },
];

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
    if (m.kind === 'route') return m.to;
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
