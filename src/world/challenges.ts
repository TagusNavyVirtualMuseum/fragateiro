// Rules of the newer challenges, as plain TypeScript (no 3D) so they can be tested:
// - Clean-up: floating rubbish scattered off a port; sail over each piece to pick it up.
// - Supply run: sail out to a fishing boat at anchor, come alongside slowly and stay while the
//   goods go aboard and the fish come back, then sail home.
// - Collisions with other boats: they push the boats apart and cost time.
import type { LandMask } from './landMask';

export type TrashKind = 'bottle' | 'bag' | 'crate' | 'barrel' | 'net' | 'seaweed';
export const TRASH_KINDS: TrashKind[] = ['bottle', 'bag', 'crate', 'barrel', 'net'];

export interface Trash {
  x: number;
  y: number;
  kind: TrashKind;
  /** Game time it was picked up, or null while it floats. */
  pickedAt: number | null;
  /** Spin and bobbing phase, for the drawing. */
  phase: number;
}

/** A boat this close to a piece (from its centre) picks it up, m. */
export const PICK_RADIUS = 14;
/** Pieces of rubbish in a clean-up. */
export const TRASH_COUNT = 12;

/** Rubbish floating in open water around a port. */
export class TrashField {
  readonly items: Trash[] = [];

  /**
   * Scatter `count` pieces in reachable water between `minFromStart` and `radius` from
   * `centre`, at least `spacing` apart, none right by the start.
   */
  constructor(mask: LandMask, centre: { x: number; y: number }, count = TRASH_COUNT, rand = Math.random, start = centre, radius = 1600, spacing = 140, minFromStart = 180, kinds: TrashKind[] = TRASH_KINDS) {
    for (let tries = 0; this.items.length < count && tries < count * 400; tries++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      const x = centre.x + Math.sin(a) * r;
      const y = centre.y + Math.cos(a) * r;
      if (!mask.isReachable(x, y)) continue;
      // Not right against the shore (a boat must be able to get there).
      if (![0, 1, 2, 3].every((k) => mask.isReachable(x + 25 * Math.sin((k * Math.PI) / 2), y + 25 * Math.cos((k * Math.PI) / 2)))) continue;
      if (Math.hypot(x - start.x, y - start.y) < minFromStart) continue;
      if (this.items.some((t) => Math.hypot(t.x - x, t.y - y) < spacing)) continue;
      this.items.push({ x, y, kind: kinds[Math.floor(rand() * kinds.length)], pickedAt: null, phase: rand() * Math.PI * 2 });
    }
  }

  get left(): number {
    return this.items.filter((t) => t.pickedAt === null).length;
  }

  get picked(): number {
    return this.items.length - this.left;
  }

  /** Pick up what the boat at (x, y) is over; returns the pieces picked this step. */
  update(x: number, y: number, time: number): Trash[] {
    const got: Trash[] = [];
    for (const t of this.items) {
      if (t.pickedAt === null && Math.hypot(t.x - x, t.y - y) < PICK_RADIUS) {
        t.pickedAt = time;
        got.push(t);
      }
    }
    return got;
  }

  nearest(x: number, y: number): Trash | null {
    let best: Trash | null = null;
    let bestD = Infinity;
    for (const t of this.items) {
      if (t.pickedAt !== null) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  }
}

/** Alongside the boat at anchor: closer than this, m. */
export const ALONGSIDE = 35;
/** ...and slower than this, m/s (about 1.5 knots). */
export const ALONGSIDE_SPEED = 0.8;
/** Game seconds alongside to pass the goods and take the fish. */
export const TRANSFER_TIME = 25;

export type SupplyPhase = 'out' | 'alongside' | 'home' | 'done';

/** A supply run: out to the boat at anchor, the transfer alongside, home again. */
export class SupplyRun {
  phase: SupplyPhase = 'out';
  /** Game seconds spent alongside so far. */
  transferred = 0;

  constructor(
    readonly meet: { x: number; y: number },
    readonly home: { x: number; y: number },
    readonly arrival = 150,
    /** Game seconds alongside to finish the transfer. */
    readonly transferTime = TRANSFER_TIME,
  ) {}

  /** Where to sail now. */
  get goal(): { x: number; y: number } {
    return this.phase === 'home' || this.phase === 'done' ? this.home : this.meet;
  }

  /** Share of the transfer done, 0..1. */
  get progress(): number {
    return Math.min(1, this.transferred / this.transferTime);
  }

  /** Call every step with the boat's position and speed (m/s); returns true when it ends. */
  update(x: number, y: number, speed: number, dt: number): boolean {
    if (this.phase === 'done') return true;
    if (this.phase === 'home') {
      if (Math.hypot(this.home.x - x, this.home.y - y) < this.arrival) this.phase = 'done';
      return this.phase === 'done';
    }
    const close = Math.hypot(this.meet.x - x, this.meet.y - y) < ALONGSIDE;
    if (close && speed < ALONGSIDE_SPEED) {
      this.phase = 'alongside';
      this.transferred += dt;
      if (this.transferred >= this.transferTime) this.phase = 'home';
    } else if (this.phase === 'alongside') {
      // Drifted off or too fast: the transfer pauses (what was passed stays aboard).
      this.phase = 'out';
    }
    return false;
  }
}

/** Seconds added to a mission's time for each collision. */
export const COLLISION_PENALTY = 15;

/**
 * Two boats touch when their centres are closer than this share of their mean length (a
 * hull is long and narrow, so this is between the beam and the length).
 */
export function touching(a: { x: number; y: number; length: number }, b: { x: number; y: number; length: number }): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) < 0.4 * (a.length + b.length) * 0.5 + 2;
}
