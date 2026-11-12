// Sailing drills: five short exercises that teach the basics before the mini-games.
//   1 Hold the course: keep a beam reach for 30 s.
//   2 Run and gybe: two controlled gybes (sheet hauled in as the stern crosses), no capsize.
//   3 Run and tack: two controlled tacks, no capsize.
//   4 Tack through the buoys: four tacks within 2:00.
//   5 Anchor approach: stop within one boat length of the anchor spot.
// The numbers can be changed in content/minigames.json ("drills" and "drillRules"); the
// constants here are the defaults. Plain TypeScript (no 3D), so the rules can be tested.

export type DrillId = 'hold' | 'gybe' | 'tack' | 'slalom' | 'anchor';
export const DRILL_IDS: DrillId[] = ['hold', 'gybe', 'tack', 'slalom', 'anchor'];

/** A beam reach: the true wind this many degrees off the bow (either side). */
export const BEAM_MIN = 70;
export const BEAM_MAX = 110;
/** Seconds to hold the beam reach. */
export const HOLD_TIME = 30;
/** Slower than this does not count as sailing, m/s (about 1 knot). */
export const HOLD_MIN_SPEED = 0.5;
/** Gybes and tacks asked for in drills 2 and 3. */
export const TURNS = 2;
/** Tacks within the time limit in drill 4. */
export const SLALOM_TACKS = 4;
export const SLALOM_LIMIT = 120;
/** Heeled further than this, the boat has capsized (rad, 30°). */
export const CAPSIZE_HEEL = (30 * Math.PI) / 180;
/**
 * A controlled gybe: the sheet hauled at least this far in (0 = in, 1 = out) as the stern
 * goes through the wind, so the boom does not slam across.
 */
export const GYBE_SHEET = 0.5;
/** Stopped: slower than this, m/s (under a knot). */
export const STOP_SPEED = 0.4;
/**
 * A turn changes side only once the wind is clearly on the other side (this far from the bow
 * or the stern, degrees): sitting head to wind does not count as many tacks.
 */
const SIDE_MARGIN = 20;

/** The rules all drills share (content/minigames.json, "drillRules"). */
export interface DrillRules {
  beamMin: number;
  beamMax: number;
  /** Rad. */
  capsizeHeel: number;
  gybeSheet: number;
  /** M/s. */
  stopSpeed: number;
}
export const DEFAULT_RULES: DrillRules = { beamMin: BEAM_MIN, beamMax: BEAM_MAX, capsizeHeel: CAPSIZE_HEEL, gybeSheet: GYBE_SHEET, stopSpeed: STOP_SPEED };

/** One drill's own targets: seconds to hold (hold), turns to make, the time limit (slalom). */
export interface DrillGoals {
  seconds?: number;
  turns?: number;
  limit?: number;
}

export type DrillStatus = 'on' | 'done' | 'failed';

export interface DrillInput {
  /** True wind angle off the bow, degrees, -180..180 (sign: which side the wind comes from). */
  twaDeg: number;
  /** Heel, rad. */
  heel: number;
  /** The most eased sheet, 0 (in) to 1 (out). */
  sheet: number;
  /** The crew trims the sails (easy level): the sheet is not checked in a gybe. */
  autoTrim?: boolean;
  /** Boat speed, m/s. */
  speed: number;
  x: number;
  y: number;
  /** Game seconds since the drill started. */
  elapsed: number;
  dt: number;
}

/** What happened this step, for a message. */
export type DrillEvent = 'tack' | 'gybe' | 'wrongTurn' | 'wildGybe' | 'capsize' | 'timeout' | null;

/** Progress through one drill. */
export class Drill {
  status: DrillStatus = 'on';
  /** Seconds held on a beam reach (drill 1). */
  held = 0;
  /** Turns that count (gybes in drill 2, tacks in 3 and 4). */
  turns = 0;
  /** Why it failed. */
  failure: 'capsize' | 'timeout' | null = null;
  /** Which side the wind is on (+1 / -1), once clearly on one side. */
  private side = 0;
  /** The last time the wind crossed the boat's line: over the bow or over the stern. */
  private lastCross: 'bow' | 'stern' | null = null;
  private prevTwa: number | null = null;
  /** The sheet was hauled in when the stern last went through the wind. */
  private sheetInAtCross = true;

  constructor(
    readonly id: DrillId,
    /** Drill 5: where to stop, and the boat's length (the distance allowed). */
    readonly anchor: { x: number; y: number } | null = null,
    readonly boatLength = 8,
    readonly goals: DrillGoals = {},
    readonly rules: DrillRules = DEFAULT_RULES,
  ) {}

  /** Turns the drill asks for (0 for drills without turns). */
  get turnsNeeded(): number {
    return this.id === 'gybe' || this.id === 'tack' ? (this.goals.turns ?? TURNS) : this.id === 'slalom' ? (this.goals.turns ?? SLALOM_TACKS) : 0;
  }

  /** Seconds to hold the beam reach (hold). */
  get holdTime(): number {
    return this.goals.seconds ?? HOLD_TIME;
  }

  /** The slalom's time limit, s. */
  get limit(): number {
    return this.goals.limit ?? SLALOM_LIMIT;
  }

  update(i: DrillInput): DrillEvent {
    if (this.status !== 'on') return null;
    const R = this.rules;
    if (Math.abs(i.heel) > R.capsizeHeel && this.id !== 'hold' && this.id !== 'anchor') {
      this.fail('capsize');
      return 'capsize';
    }
    const turn = this.watchTurns(i.twaDeg, i.autoTrim || i.sheet <= R.gybeSheet);
    let ev: DrillEvent = null;
    switch (this.id) {
      case 'hold': {
        const a = Math.abs(i.twaDeg);
        if (a >= R.beamMin && a <= R.beamMax && i.speed > HOLD_MIN_SPEED) this.held += i.dt;
        else this.held = 0;
        if (this.held >= this.holdTime) this.status = 'done';
        break;
      }
      case 'gybe':
      case 'tack':
      case 'slalom': {
        const want = this.id === 'gybe' ? 'gybe' : 'tack';
        if (turn === want && (turn === 'tack' || this.sheetInAtCross)) {
          this.turns++;
          ev = turn;
        } else if (turn === want) ev = 'wildGybe';
        else if (turn) ev = 'wrongTurn';
        if (this.turns >= this.turnsNeeded) this.status = 'done';
        else if (this.id === 'slalom' && i.elapsed > this.limit) {
          this.fail('timeout');
          ev = 'timeout';
        }
        break;
      }
      case 'anchor': {
        const a = this.anchor!;
        if (Math.hypot(a.x - i.x, a.y - i.y) <= this.boatLength && i.speed < R.stopSpeed) this.status = 'done';
        break;
      }
    }
    return ev;
  }

  private fail(why: 'capsize' | 'timeout'): void {
    this.status = 'failed';
    this.failure = why;
  }

  /** A tack (bow through the wind) or a gybe (stern through the wind), when one ends. */
  private watchTurns(twa: number, sheetIn: boolean): 'tack' | 'gybe' | null {
    if (this.prevTwa !== null && Math.sign(twa) !== Math.sign(this.prevTwa) && twa !== 0) {
      // Crossing the bow the angle passes through 0 (a small jump); the stern, through 180.
      this.lastCross = Math.abs(twa) + Math.abs(this.prevTwa) < 180 ? 'bow' : 'stern';
      if (this.lastCross === 'stern') this.sheetInAtCross = sheetIn;
    }
    this.prevTwa = twa;
    const a = Math.abs(twa);
    if (a < SIDE_MARGIN || a > 180 - SIDE_MARGIN) return null;
    const side = Math.sign(twa);
    const was = this.side;
    this.side = side;
    if (was === 0 || was === side || !this.lastCross) return null;
    return this.lastCross === 'bow' ? 'tack' : 'gybe';
  }
}

/**
 * Drill 4's buoys: a zigzag up the wind from `start` (wind blowing from `windFrom`, rad,
 * compass), one buoy for each tack. Each leg is about 50° off the wind, close-hauled.
 */
export function slalomBuoys(start: { x: number; y: number }, windFrom: number, n = SLALOM_TACKS, step = 30, width = 18): { x: number; y: number }[] {
  const u = { x: Math.sin(windFrom), y: Math.cos(windFrom) };
  const c = { x: u.y, y: -u.x };
  return Array.from({ length: n }, (_, k) => {
    const side = k % 2 === 0 ? 1 : -1;
    const up = step * (k + 1);
    return { x: start.x + u.x * up + c.x * width * side, y: start.y + u.y * up + c.y * width * side };
  });
}
