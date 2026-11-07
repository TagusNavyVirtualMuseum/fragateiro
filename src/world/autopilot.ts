// A simple helmsman for the other boats on the river: sails towards a waypoint, beats
// (tacks back and forth) when the waypoint is upwind, trims the sails to the wind and turns
// away from the shore. Plain TypeScript (no 3D), so it can be tested.
import { groupsInMode, type SailboatSim } from '../physics';
import type { LandMask } from './landMask';

/** Closest the helmsman sails to the wind, rad (the boats point about 45°). */
const CLOSE_HAULED = (55 * Math.PI) / 180;

export interface Pilot {
  /** Where the boat is heading, m east / north. */
  wx: number;
  wy: number;
  /** Which side the wind comes from while beating (+1 / -1). */
  tack: 1 | -1;
  /** Game time of the next tack while beating, and of the last one, s. */
  nextTack: number;
  lastTack: number;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function tack(pilot: Pilot, time: number, holdFor: number): void {
  pilot.tack = pilot.tack > 0 ? -1 : 1;
  pilot.lastTack = time;
  pilot.nextTack = time + holdFor;
}

/** A waypoint in open water a few hundred metres to a few km away, with open water on the way. */
export function pickWaypoint(mask: LandMask, x: number, y: number, rand = Math.random, min = 500, max = 1500): { x: number; y: number } | null {
  for (let i = 0; i < 40; i++) {
    const a = rand() * Math.PI * 2;
    const d = min + rand() * (max - min);
    const px = x + Math.sin(a) * d;
    const py = y + Math.cos(a) * d;
    if (!mask.isReachable(px, py)) continue;
    let clear = true;
    for (let s = 60; s < d && clear; s += 60) clear = mask.isReachable(x + Math.sin(a) * s, y + Math.cos(a) * s);
    if (clear) return { x: px, y: py };
  }
  return null;
}

/**
 * Set the rudder and sheets for this moment. Returns true when the boat needs a new
 * waypoint (it arrived, or the way ahead is blocked by land).
 */
export function steer(sim: SailboatSim, pilot: Pilot, windFrom: number, mask: LandMask, rand = Math.random): boolean {
  const s = sim.state;
  const dx = pilot.wx - s.x;
  const dy = pilot.wy - s.y;
  if (Math.hypot(dx, dy) < 80) return true;
  const bearing = Math.atan2(dx, dy);
  // 0 = the waypoint is straight upwind.
  const rel = wrap(bearing - windFrom);
  const beating = Math.abs(rel) < CLOSE_HAULED;
  let desired: number;
  if (beating) {
    if (s.time > pilot.nextTack) tack(pilot, s.time, 60 + rand() * 90);
    desired = windFrom + pilot.tack * CLOSE_HAULED;
  } else {
    desired = bearing;
    pilot.tack = rel > 0 ? 1 : -1;
  }

  // Land ahead: tack now when beating, otherwise choose somewhere else to go.
  let blocked = false;
  for (const d of [40, 90]) {
    if (!mask.isWater(s.x + Math.sin(s.heading) * d, s.y + Math.cos(s.heading) * d)) blocked = true;
  }
  // (Not again until the boat has had time to turn through the wind.)
  if (blocked && beating && s.time - pilot.lastTack > 25) tack(pilot, s.time, 60 + rand() * 60);

  const err = wrap(desired - s.heading);
  sim.controls.rudder = Math.max(-1, Math.min(1, 1.6 * err - 0.8 * s.r));
  // Sheets: in when the wind is ahead, out as it comes aft (as in the speed polars).
  const twa = (Math.abs(wrap(windFrom - s.heading)) * 180) / Math.PI;
  const sheet = Math.max(0.05, Math.min(1, (twa - 30) / 150));
  for (const g of groupsInMode(sim.spec, sim.controls.mode)) sim.controls.sheets[g] = sheet;
  return blocked && !beating;
}
