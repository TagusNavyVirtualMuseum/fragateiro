import type { TrueWind } from './types';

export interface WindField {
  /** True wind at time t (s) and position (east, north). */
  at(t: number, x: number, y: number): TrueWind;
}

export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rad2deg = (r: number) => (r * 180) / Math.PI;
export const KNOT = 0.514444; // m/s
export const toKnots = (ms: number) => ms / KNOT;

/** Steady wind. Change `fromDeg` / `speed` at any time. */
export class SteadyWind implements WindField {
  constructor(
    public fromDeg = 0,
    public speed = 6,
  ) {}
  at(): TrueWind {
    return { from: deg2rad(this.fromDeg), speed: this.speed };
  }
}

/**
 * Wind that shifts and gusts slowly around a mean value
 * (a sum of a few slow sine waves, so it is smooth and repeatable).
 */
export class GustyWind implements WindField {
  constructor(
    public fromDeg = 0,
    public speed = 6,
    /** Relative gust strength, e.g. 0.3 = ±30 % */
    public gust = 0.3,
    /** Maximum direction shift, degrees. */
    public shiftDeg = 15,
  ) {}
  at(t: number, x: number, y: number): TrueWind {
    const p = (x + y) * 0.002;
    const g = 0.6 * Math.sin(t * 0.21 + p) + 0.3 * Math.sin(t * 0.53 + 1.3) + 0.1 * Math.sin(t * 1.7 + 0.4);
    const s = 0.7 * Math.sin(t * 0.047 + 0.8) + 0.3 * Math.sin(t * 0.13 + p);
    return {
      from: deg2rad(this.fromDeg + this.shiftDeg * s),
      speed: Math.max(0, this.speed * (1 + this.gust * g)),
    };
  }
}
