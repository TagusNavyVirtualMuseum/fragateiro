// Whaling in the Azores, as the island whalers did it until 1987: the lookout on the cliff
// spots a sperm whale's blow, the boats sail out, and the boat must come up on the whale from
// astern, where it cannot see it. A sperm whale breathes at the surface for a few minutes,
// blowing every few seconds, then lifts its tail (fluke) and dives for a long time,
// coming up again some way further on. Approached from ahead or from the side it takes fright
// and sounds at once, and comes up further away. Plain TypeScript, so the rules can be tested.
import type { LandMask } from './landMask';

/** Close enough to strike, m (from the boat's centre to the whale's). */
export const STRIKE_DISTANCE = 22;
/** Astern means the boat is within this angle of the whale's tail, rad (±50°). */
export const ASTERN_HALF_ANGLE = (50 * Math.PI) / 180;
/** Seen from ahead or the side closer than this, the whale takes fright, m. */
export const NOTICE_DISTANCE = 140;
/** Times at the surface and under water, game seconds. */
export const SURFACE_TIME = 120;
export const DIVE_TIME = 150;
/** Swimming speed at the surface and under water, m/s. */
const SURFACE_SPEED = 0.8;
const DIVE_SPEED = 1.6;
/** After a fright it swims fast under water. */
const FRIGHT_SPEED = 3.0;

export type WhalePhase = 'surface' | 'fluke' | 'dive' | 'struck';

export interface Whale {
  x: number;
  y: number;
  /** Swimming direction, rad from north (clockwise). */
  heading: number;
  phase: WhalePhase;
  /** Game time the phase started. */
  since: number;
  /** It was frightened on its last dive. */
  frightened: boolean;
}

/** Where the boat is seen from the whale: 0 dead ahead, ±π dead astern. */
export function bearingFromWhale(w: Whale, x: number, y: number): number {
  const b = Math.atan2(x - w.x, y - w.y) - w.heading;
  return Math.atan2(Math.sin(b), Math.cos(b));
}

/** The boat is in the whale's blind sector, behind its tail. */
export function isAstern(w: Whale, x: number, y: number): boolean {
  return Math.PI - Math.abs(bearingFromWhale(w, x, y)) <= ASTERN_HALF_ANGLE;
}

export class WhaleHunt {
  readonly whale: Whale;
  /** How many times it took fright (for the result). */
  frights = 0;

  constructor(
    private readonly mask: LandMask,
    start: { x: number; y: number },
    time: number,
    rand = Math.random,
    /** Distance of the first sighting from the start, m. */
    distance = 2500,
  ) {
    // A spot in open, deep water, roughly `distance` away (well clear of the coast).
    let spot = { x: start.x, y: start.y };
    for (let tries = 0; tries < 400; tries++) {
      const a = rand() * Math.PI * 2;
      const d = distance * (0.8 + 0.4 * rand());
      const p = { x: start.x + Math.sin(a) * d, y: start.y + Math.cos(a) * d };
      if (this.open(p.x, p.y, 400)) {
        spot = p;
        break;
      }
    }
    this.whale = { ...spot, heading: rand() * Math.PI * 2, phase: 'surface', since: time, frightened: false };
  }

  /** Water all round, `r` metres out (whales keep to deep water off the coast). */
  private open(x: number, y: number, r: number): boolean {
    if (!this.mask.isReachable(x, y)) return false;
    for (let k = 0; k < 8; k++) if (!this.mask.isWater(x + r * Math.sin((k * Math.PI) / 4), y + r * Math.cos((k * Math.PI) / 4))) return false;
    return true;
  }

  get struck(): boolean {
    return this.whale.phase === 'struck';
  }

  /** Visible: at the surface or lifting its tail. */
  get visible(): boolean {
    return this.whale.phase === 'surface' || this.whale.phase === 'fluke' || this.whale.phase === 'struck';
  }

  /** Call every step with the boat's position; returns 'struck', 'fright' or null. */
  update(boat: { x: number; y: number }, time: number, dt: number, rand = Math.random): 'struck' | 'fright' | null {
    const w = this.whale;
    if (w.phase === 'struck') return null;
    const t = time - w.since;
    const d = Math.hypot(boat.x - w.x, boat.y - w.y);
    let event: 'struck' | 'fright' | null = null;

    if (w.phase === 'surface') {
      if (d < STRIKE_DISTANCE && isAstern(w, boat.x, boat.y)) {
        w.phase = 'struck';
        w.since = time;
        return 'struck';
      }
      if (d < NOTICE_DISTANCE && !isAstern(w, boat.x, boat.y)) {
        // Seen: it lifts its tail and sounds at once, and turns away from the boat.
        w.phase = 'fluke';
        w.since = time;
        w.frightened = true;
        w.heading = Math.atan2(w.x - boat.x, w.y - boat.y) + (rand() - 0.5) * 0.8;
        this.frights++;
        event = 'fright';
      } else if (t > SURFACE_TIME) {
        w.phase = 'fluke';
        w.since = time;
      }
    } else if (w.phase === 'fluke') {
      if (t > 6) {
        w.phase = 'dive';
        w.since = time;
      }
    } else if (w.phase === 'dive') {
      if (t > (w.frightened ? DIVE_TIME * 0.6 : DIVE_TIME)) {
        // Up again: a new direction, roughly onwards.
        w.phase = 'surface';
        w.since = time;
        w.frightened = false;
        w.heading += (rand() - 0.5) * 1.2;
      }
    }

    // Swim on (a little at the surface, more under water), turning away from the coast.
    const speed = w.phase === 'surface' ? SURFACE_SPEED : w.phase === 'fluke' ? SURFACE_SPEED : w.frightened ? FRIGHT_SPEED : DIVE_SPEED;
    const nx = w.x + Math.sin(w.heading) * speed * dt;
    const ny = w.y + Math.cos(w.heading) * speed * dt;
    if (this.open(nx, ny, 250)) {
      w.x = nx;
      w.y = ny;
    } else {
      w.heading += Math.PI * 0.5 * dt; // turn until the way is open
    }
    return event;
  }
}
