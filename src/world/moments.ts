// The moments the game reports to the narrator (content/narrative/from-game/moments.json), worked
// out from the boat's state every step. Plain TypeScript, no 3D. Times are real seconds (what
// the player feels), not the game clock that may run faster.
// The mission itself reports start, arrive, mission_end, catch, net_out, pickup, alongside,
// collision and the whale's moments; this detector the sailing ones.

export interface MomentInput {
  /** True wind angle off the bow, degrees, -180..180. */
  twaDeg: number;
  /** Speed through the water, m/s. */
  speed: number;
  /** Share of the set sails that are luffing, 0..1. */
  luffing: number;
  /** Heel, rad. */
  heel: number;
  /** Heading, rad. */
  heading: number;
  aground: boolean;
  /** Distance to the mission's goal, m (null without one). */
  distanceToTarget: number | null;
  x: number;
  y: number;
  /** Real seconds since the last step. */
  dt: number;
  /** Mean sheet setting, 0 hauled in … 1 let out (for sheet_in, sheet_out). */
  sheets?: number;
  /** How far the sheets are from the best trim, 0 = best (for trim_good). */
  trimError?: number;
}

/** Sheets moved this much within SHEET_WINDOW s report sheet_in or sheet_out. */
export const SHEET_STEP = 0.2;
export const SHEET_WINDOW = 3;
/** Turning this much towards or away from the wind within TURN_WINDOW s: head_up, bear_away, degrees. */
export const TURN_STEP = 20;
export const TURN_WINDOW = 5;
/** Trim error above TRIM_BAD, then below TRIM_GOOD for 2 s: trim_good. */
export const TRIM_BAD = 0.25;
export const TRIM_GOOD = 0.1;

/** The point-of-sail bands (as the instruments name them). */
export function pointOfSail(twaDeg: number): string {
  const a = Math.abs(twaDeg);
  return a < 36 ? 'irons' : a < 60 ? 'close_hauled' : a < 80 ? 'close_reach' : a < 110 ? 'beam_reach' : a < 150 ? 'broad_reach' : 'running';
}

/** Distance under which `approach_target` is reported, m. */
export const APPROACH = 300;
/** Passing this close to a named place reports `near_place:<name>`, m. */
export const NEAR_PLACE = 800;
/** Heeled further than this reports `heel_warning`, rad (as the instruments' warning). */
export const HEEL_WARNING = 0.45;

const angleDiff = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

export class MomentDetector {
  private t = 0;
  // Tacks and gybes: which side the wind is on, and how it last crossed the boat's line.
  private side = 0;
  private lastCross: 'bow' | 'stern' | null = null;
  private prevTwa: number | null = null;
  // In irons.
  private ironsFor = 0;
  private inIrons = false;
  // Luffing.
  private luffFor = 0;
  private luffHeading = 0;
  private quietFor = 0;
  private luffing = false;
  // Steady legs and point of sail.
  private band = '';
  private bandFor = 0;
  private reportedBand = '';
  private steadyHeading = 0;
  private steadyFor = 0;
  // Edges.
  private heeled = false;
  private wasAground = false;
  private approached = false;
  private readonly nearDone = new Set<string>();
  // Actions that answer an instruction: recent sheets and wind angles, and the trim.
  private sheetHist: { t: number; v: number }[] = [];
  private twaHist: { t: number; v: number }[] = [];
  private trimWasBad = false;
  private trimGoodFor = 0;
  /** Real seconds of the last manoeuvre or trouble (for "calm"). */
  private lastBusy = -Infinity;

  constructor(private readonly places: { name: string; x: number; y: number }[] = []) {}

  /** No manoeuvre or trouble in the last few seconds: a story may be told. */
  calm(seconds = 8): boolean {
    return this.t - this.lastBusy >= seconds && !this.wasAground && !this.inIrons && !this.luffing;
  }

  /** The goal changed (a new buoy, port or boat): `approach_target` can fire again. */
  newTarget(): void {
    this.approached = false;
  }

  update(i: MomentInput): string[] {
    const out: string[] = [];
    const busy = (m: string) => {
      out.push(m);
      this.lastBusy = this.t;
    };
    this.t += i.dt;

    // Tacks (bow through the wind) and gybes (stern through the wind), once clearly on the
    // other side (20° from the bow or the stern).
    if (this.prevTwa !== null && Math.sign(i.twaDeg) !== Math.sign(this.prevTwa) && i.twaDeg !== 0) {
      this.lastCross = Math.abs(i.twaDeg) + Math.abs(this.prevTwa) < 180 ? 'bow' : 'stern';
    }
    this.prevTwa = i.twaDeg;
    const a = Math.abs(i.twaDeg);
    if (a >= 20 && a <= 160) {
      const s = Math.sign(i.twaDeg);
      if (this.side !== 0 && s !== this.side && this.lastCross) busy(this.lastCross === 'bow' ? 'tack' : 'gybe');
      this.side = s;
    }

    // In irons: head to wind and stopped for 3 s; out again when sailing off at speed.
    if (!this.inIrons) {
      this.ironsFor = a < 36 && i.speed < 0.5 ? this.ironsFor + i.dt : 0;
      if (this.ironsFor >= 3) {
        this.inIrons = true;
        busy('enter_irons');
      }
    } else if (a > 45 && i.speed > 0.8) {
      this.inIrons = false;
      this.ironsFor = 0;
      busy('out_of_irons');
    }

    // Luffing: over half the sails flapping for 5 s on a steady heading; stopped when under a
    // fifth for 3 s.
    if (!this.luffing) {
      if (i.luffing > 0.5 && (this.luffFor === 0 || angleDiff(i.heading, this.luffHeading) < (10 * Math.PI) / 180)) {
        if (this.luffFor === 0) this.luffHeading = i.heading;
        this.luffFor += i.dt;
      } else this.luffFor = 0;
      if (this.luffFor >= 5) {
        this.luffing = true;
        this.quietFor = 0;
        busy('luffing_start');
      }
    } else {
      this.quietFor = i.luffing < 0.2 ? this.quietFor + i.dt : 0;
      if (this.quietFor >= 3) {
        this.luffing = false;
        this.luffFor = 0;
        busy('luffing_stop');
      }
    }

    // Heeling hard.
    const heeled = Math.abs(i.heel) > HEEL_WARNING;
    if (heeled && !this.heeled) busy('heel_warning');
    this.heeled = heeled;

    // Point of sail: a new band held for 5 s.
    const band = pointOfSail(i.twaDeg);
    if (band !== this.band) {
      this.band = band;
      this.bandFor = 0;
    } else this.bandFor += i.dt;
    if (this.bandFor >= 5 && band !== this.reportedBand) {
      if (this.reportedBand) out.push('point_of_sail_change');
      this.reportedBand = band;
    }

    // A steady leg: the same heading (within 10°) and point of sail for 20 s; again after
    // another 20 s.
    if (angleDiff(i.heading, this.steadyHeading) > (10 * Math.PI) / 180 || this.bandFor === 0 || i.speed < 0.5) {
      this.steadyHeading = i.heading;
      this.steadyFor = 0;
    } else {
      this.steadyFor += i.dt;
      if (this.steadyFor >= 20) {
        out.push('steady_leg');
        this.steadyFor = 0;
      }
    }

    // Aground and afloat again.
    if (i.aground && !this.wasAground) busy('aground');
    if (!i.aground && this.wasAground) out.push('refloat');
    this.wasAground = i.aground;

    // Nearing the goal.
    if (i.distanceToTarget !== null && i.distanceToTarget < APPROACH && !this.approached) {
      this.approached = true;
      out.push('approach_target');
    }

    // Actions that answer an instruction (a cue's "expects").
    if (i.sheets !== undefined) {
      const m = this.change(this.sheetHist, i.sheets, SHEET_WINDOW, SHEET_STEP);
      if (m) out.push(m < 0 ? 'sheet_in' : 'sheet_out');
    }
    const turn = this.change(this.twaHist, Math.abs(i.twaDeg), TURN_WINDOW, TURN_STEP);
    if (turn) out.push(turn < 0 ? 'head_up' : 'bear_away');
    if (i.trimError !== undefined) {
      if (i.trimError > TRIM_BAD) {
        this.trimWasBad = true;
        this.trimGoodFor = 0;
      } else if (this.trimWasBad && i.trimError < TRIM_GOOD) {
        this.trimGoodFor += i.dt;
        if (this.trimGoodFor >= 2) {
          out.push('trim_good');
          this.trimWasBad = false;
          this.trimGoodFor = 0;
        }
      } else this.trimGoodFor = 0;
    }

    // Passing a named place.
    for (const p of this.places) {
      if (this.nearDone.has(p.name) || Math.hypot(p.x - i.x, p.y - i.y) > NEAR_PLACE) continue;
      this.nearDone.add(p.name);
      out.push(`near_place:${p.name}`);
    }
    return out;
  }

  /**
   * A value that moved by at least `step` within `window` seconds: its sign (-1 down, 1 up), and
   * the history restarts so one move is reported once; 0 otherwise.
   */
  private change(hist: { t: number; v: number }[], v: number, window: number, step: number): number {
    hist.push({ t: this.t, v });
    while (hist.length && hist[0].t < this.t - window) hist.shift();
    const lo = Math.min(...hist.map((h) => h.v)), hi = Math.max(...hist.map((h) => h.v));
    let sign = 0;
    if (v - hi <= -step) sign = -1;
    else if (v - lo >= step) sign = 1;
    if (sign) hist.splice(0, hist.length, { t: this.t, v });
    return sign;
  }

  /** Mark something the mission reports (a collision…) as trouble, for `calm`. */
  trouble(): void {
    this.lastBusy = this.t;
  }
}
