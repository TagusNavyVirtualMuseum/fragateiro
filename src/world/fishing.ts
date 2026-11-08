// Fishing with the Muleta: shoals of fish in the water, and the net that catches them as the
// boat drifts sideways and drags it through a shoal. Plain TypeScript (no 3D), so it can be
// tested.
import type { LandMask } from './landMask';

export interface Shoal {
  x: number;
  y: number;
  /** Radius of the patch, m. */
  radius: number;
  /** Fish left in it, kg. */
  kg: number;
  /** Slow wandering, m/s. */
  vx: number;
  vy: number;
}

/** The net's top rope in the world, and how it moves. */
export interface NetSweep {
  a: { x: number; y: number };
  b: { x: number; y: number };
  /** Sideways (sway) and forward (surge) speed of the boat, m/s. */
  sway: number;
  surge: number;
}

/** Share of the fish in the swept water that end up in the net. */
const NET_EFFICIENCY = 0.8;
/** Below this sideways speed the net hangs slack and catches nothing, m/s. */
const MIN_SWEEP = 0.15;

/** Distance from a point to a segment, and the length of the segment inside a circle. */
function overlap(cx: number, cy: number, r: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return 0;
  const ux = dx / len;
  const uy = dy / len;
  // Projection of the centre on the segment's line, and distance to it.
  const t = (cx - a.x) * ux + (cy - a.y) * uy;
  const d = Math.abs((cx - a.x) * uy - (cy - a.y) * ux);
  if (d >= r) return 0;
  const half = Math.sqrt(r * r - d * d);
  return Math.max(0, Math.min(len, t + half) - Math.max(0, t - half));
}

/**
 * Fish caught in dt seconds: the water the net sweeps through a shoal holds fish in
 * proportion to the shoal's density. A net dragged sideways sweeps its whole length; a boat
 * sailing forward drags it edge-on, so it catches far less.
 */
export function catchFish(shoals: Shoal[], net: NetSweep, dt: number): number {
  const sweep = Math.abs(net.sway);
  if (sweep < MIN_SWEEP) return 0;
  const sideways = sweep / (sweep + Math.abs(net.surge));
  let caught = 0;
  for (const s of shoals) {
    if (s.kg <= 0) continue;
    const len = overlap(s.x, s.y, s.radius, net.a, net.b);
    if (!len) continue;
    const density = s.kg / (Math.PI * s.radius * s.radius);
    const kg = Math.min(s.kg, density * len * sweep * dt * NET_EFFICIENCY * sideways);
    s.kg -= kg;
    caught += kg;
  }
  return caught;
}

/** A new shoal in open water, min..max metres from (x, y). */
export function spawnShoal(mask: LandMask, x: number, y: number, rand = Math.random, min = 300, max = 1400): Shoal | null {
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const d = min + rand() * (max - min);
    const sx = x + Math.sin(a) * d;
    const sy = y + Math.cos(a) * d;
    const radius = 25 + rand() * 25;
    // The whole patch, and room around it to drift over it, must be open water.
    let open = mask.isReachable(sx, sy);
    for (let k = 0; k < 8 && open; k++) open = mask.isWater(sx + Math.cos((k * Math.PI) / 4) * (radius + 60), sy + Math.sin((k * Math.PI) / 4) * (radius + 60));
    if (!open) continue;
    const heading = rand() * Math.PI * 2;
    return { x: sx, y: sy, radius, kg: 60 + rand() * 90, vx: Math.sin(heading) * 0.15, vy: Math.cos(heading) * 0.15 };
  }
  return null;
}

/**
 * The shoals of a fishing ground: they wander slowly, and when one is fished out (or left
 * far behind) another rises somewhere else on the ground.
 */
export class FishingGround {
  readonly shoals: Shoal[] = [];
  caught = 0;

  constructor(
    private readonly mask: LandMask,
    readonly centre: { x: number; y: number },
    count = 6,
    private readonly rand = Math.random,
    /** Where the boat starts: the first shoal rises 300-500 m from it, to be found quickly. */
    start?: { x: number; y: number },
  ) {
    for (let i = 0; i < count; i++) {
      const from = i === 0 && start ? start : centre;
      const s = spawnShoal(mask, from.x, from.y, rand, i === 0 ? 300 : 400, i === 0 ? 500 : 1600);
      if (s) this.shoals.push(s);
    }
  }

  /** dt in game seconds. Returns the fish caught in this step, kg. */
  update(net: NetSweep | null, dt: number): number {
    const got = net ? catchFish(this.shoals, net, dt) : 0;
    this.caught += got;
    for (let i = 0; i < this.shoals.length; i++) {
      const s = this.shoals[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // Keep off the shore: turn back when heading into shallow water.
      if (!this.mask.isWater(s.x + s.vx * 200, s.y + s.vy * 200)) {
        s.vx = -s.vx;
        s.vy = -s.vy;
      }
      const far = Math.hypot(s.x - this.centre.x, s.y - this.centre.y) > 2500;
      if (s.kg < 5 || far) {
        const n = spawnShoal(this.mask, this.centre.x, this.centre.y, this.rand, 400, 1600);
        if (n) this.shoals[i] = n;
      }
    }
    return got;
  }

  /** The nearest shoal with fish in it. */
  nearest(x: number, y: number): Shoal | null {
    let best: Shoal | null = null;
    let bd = Infinity;
    for (const s of this.shoals) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (s.kg >= 5 && d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }
}
