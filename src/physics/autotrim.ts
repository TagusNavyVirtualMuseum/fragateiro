// Sheets for the easy level: each sail eased until it meets the apparent wind at the angle
// of attack where these sails pull best, like a crew that trims perfectly.
import type { BoatSpec } from './types';

/** Angle of attack the trimmer aims for, degrees (the sail tables pull best around here). */
export const BEST_ALPHA_DEG = 15;

/** Sheet settings (0 = hauled in, 1 = eased out) for every sail group in a mode. */
export function autoTrimSheets(spec: BoatSpec, modeId: string, apparentWindAngleDeg: number): Record<string, number> {
  const mode = spec.modes.find((m) => m.id === modeId) ?? spec.modes[0];
  const out: Record<string, number> = {};
  const awa = Math.abs(apparentWindAngleDeg);
  for (const sail of spec.sails) {
    if (!mode.sails.includes(sail.id) || sail.group in out) continue;
    const boom = awa - BEST_ALPHA_DEG;
    out[sail.group] = Math.max(0, Math.min(1, (boom - sail.minAngle) / (sail.maxAngle - sail.minAngle)));
  }
  return out;
}
