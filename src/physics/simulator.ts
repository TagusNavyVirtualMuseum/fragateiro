// Planar sailing simulator ("3 degrees of freedom": surge, sway, yaw) with a
// simple heel model. There is no buoyancy: the boat always floats at its waterline,
// and wave motion is added only in the 3D view.
//
// Conventions (standard ship-manoeuvring convention):
//   boat frame  x = forward, y = starboard, yaw rate r positive turning to starboard
//   world frame x = east, y = north, heading = compass angle (0 = north, clockwise)
//
// Equations of motion, with added masses mu (surge) and mv (sway):
//   mu (du/dt - v r) = X
//   mv (dv/dt + u r) = Y
//   Iz dr/dt         = N
//   Ix d²φ/dt² = M_heel - m g GM sin φ - c dφ/dt

import { foilForce, hydrofoilCurve, sailCurve, type CoefficientCurve } from './foil';
import type { BoatSpec, BoatState, Controls, ForceReport, ModeSpec, PointForce, SailReport } from './types';
import { SteadyWind, deg2rad, rad2deg, type WindField } from './wind';

export const RHO_AIR = 1.204;
export const RHO_WATER = 1025;
export const GRAVITY = 9.81;

const MAX_STEP = 1 / 120;
const KEEL_STRIPS = 6;
/** Time for a sail to swing to its new position, s. */
const SAIL_LAG = 0.35;
/** A sail crosses over (gybes) only once the wind is this far past dead astern. */
const GYBE_MARGIN = deg2rad(12);
/** Below this angle of attack the sail is considered to be flapping. */
const LUFF_ALPHA_DEG = 6;
/** Drag coefficient of the hull moving stern first. */
const STERNWAY_CD = 1.2;
/** With balanced sails, the rudder steers as if the boat moved at least this fast, m/s. */
const BALANCED_RUDDER_FLOW = 1.5;
/** Extra yaw damping with balanced sails, 1/s. */
const BALANCED_YAW_DAMPING = 0.6;

const ZERO_FORCE: PointForce = { fx: 0, fy: 0, x: 0, y: 0 };

export function wrapPi(a: number): number {
  let r = (a + Math.PI) % (2 * Math.PI);
  if (r < 0) r += 2 * Math.PI;
  return r - Math.PI;
}

export function createState(spec: BoatSpec, init: Partial<BoatState> = {}): BoatState {
  const sailAngles: Record<string, number> = {};
  for (const s of spec.sails) sailAngles[s.id] = 0;
  return { x: 0, y: 0, heading: 0, u: 0, v: 0, r: 0, heel: 0, heelRate: 0, time: 0, sailAngles, ...init };
}

export function defaultControls(spec: BoatSpec, mode = spec.modes[0].id): Controls {
  const sheets: Record<string, number> = {};
  for (const s of spec.sails) sheets[s.group] = 0.5;
  return { rudder: 0, sheets, mode };
}

/** The sail groups that can be trimmed in a mode, in the order they appear on the boat. */
export function groupsInMode(spec: BoatSpec, modeId: string): string[] {
  const mode = spec.modes.find((m) => m.id === modeId) ?? spec.modes[0];
  const groups: string[] = [];
  for (const s of spec.sails) if (mode.sails.includes(s.id) && !groups.includes(s.group)) groups.push(s.group);
  return groups;
}

export class SailboatSim {
  state: BoatState;
  controls: Controls;
  report: ForceReport;
  /** Keep the heading fixed (used to compute speed polars). */
  lockHeading = false;

  private readonly sailCurves = new Map<string, CoefficientCurve>();
  private readonly keelCurve: CoefficientCurve;
  private readonly rudderCurve: CoefficientCurve;
  private readonly massU: number;
  private readonly massV: number;
  private readonly inertia: number;
  private readonly rollInertia: number;
  private readonly rollStiffness: number;
  private readonly rollDamping: number;

  constructor(
    readonly spec: BoatSpec,
    public wind: WindField = new SteadyWind(),
    init: Partial<BoatState> = {},
  ) {
    this.state = createState(spec, init);
    this.controls = defaultControls(spec);
    for (const s of spec.sails) this.sailCurves.set(s.id, sailCurve(s.efficiency ?? 1));
    this.keelCurve = hydrofoilCurve(spec.hull.liftSlope, spec.hull.stallDeg, 0);
    this.rudderCurve = hydrofoilCurve(spec.rudder.liftSlope, spec.rudder.stallDeg, 0.01);

    const m = spec.mass;
    this.massU = 1.05 * m;
    this.massV = 1.6 * m;
    this.inertia = (1.3 * m * (spec.length ** 2 + spec.beam ** 2)) / 12;
    this.rollStiffness = m * GRAVITY * spec.gm;
    this.rollInertia = this.rollStiffness * (spec.rollPeriod / (2 * Math.PI)) ** 2;
    this.rollDamping = 2 * 0.25 * Math.sqrt(this.rollStiffness * this.rollInertia);
    this.report = this.emptyReport();
  }

  get mode(): ModeSpec {
    return this.spec.modes.find((m) => m.id === this.controls.mode) ?? this.spec.modes[0];
  }

  /** Speed over ground, m/s. */
  get speed(): number {
    return Math.hypot(this.state.u, this.state.v);
  }

  /** Advance the simulation by dt seconds (split internally into small fixed steps). */
  step(dt: number): void {
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-9) {
      const h = Math.min(MAX_STEP, remaining);
      this.integrate(h);
      remaining -= h;
    }
  }

  /** Same as step() but with a custom fixed step (faster, used for offline polars). */
  stepFixed(dt: number, h: number): void {
    for (let t = 0; t < dt - 1e-9; t += h) this.integrate(Math.min(h, dt - t));
  }

  private integrate(h: number): void {
    const s = this.state;
    const spec = this.spec;
    const mode = this.mode;
    const c = this.controls;

    const wind = this.wind.at(s.time, s.x, s.y);
    const sinH = Math.sin(s.heading);
    const cosH = Math.cos(s.heading);
    // Air velocity (where the wind blows TO), world frame, then boat frame.
    const we = -wind.speed * Math.sin(wind.from);
    const wn = -wind.speed * Math.cos(wind.from);
    const wf = we * sinH + wn * cosH;
    const ws = we * cosH - wn * sinH;

    let X = 0;
    let Y = 0;
    let N = 0;
    let heelMoment = 0;
    const cosHeel = Math.cos(s.heel);
    const sails: SailReport[] = [];

    // --- Sails -------------------------------------------------------------
    for (const sail of spec.sails) {
      const active = mode.sails.includes(sail.id);
      let delta = s.sailAngles[sail.id] ?? 0;
      if (!active) {
        s.sailAngles[sail.id] = delta * (1 - Math.min(1, h / SAIL_LAG));
        sails.push({ id: sail.id, active, fx: 0, fy: 0, ceX: sail.pivot[0], ceY: sail.pivot[1], alphaDeg: 0, luffing: false });
        continue;
      }
      const sheet = clamp01(c.sheets[sail.group] ?? 0.5);
      const limit = deg2rad(sail.minAngle + sheet * (sail.maxAngle - sail.minAngle));

      // Air flow seen at the centre of effort (includes the boat's own motion and rotation).
      let bx = -Math.cos(delta);
      let by = Math.sin(delta);
      let ceX = sail.pivot[0] + bx * sail.ceDistance;
      let ceY = sail.pivot[1] + by * sail.ceDistance;
      const ax = wf - (s.u - s.r * ceY);
      const ay = ws - (s.v + s.r * ceX);

      // A free sail streams downwind like a flag; the sheet stops it at `limit`.
      const free = wrapPi(Math.PI - Math.atan2(ay, ax));
      let side = Math.sign(free) || Math.sign(delta) || 1;
      if (Math.sign(delta) !== 0 && side !== Math.sign(delta) && Math.abs(free) > Math.PI - GYBE_MARGIN) {
        side = Math.sign(delta);
      }
      const target = Math.abs(free) <= limit ? free : side * limit;
      delta += (target - delta) * Math.min(1, h / SAIL_LAG);
      s.sailAngles[sail.id] = delta;

      bx = -Math.cos(delta);
      by = Math.sin(delta);
      ceX = sail.pivot[0] + bx * sail.ceDistance;
      ceY = sail.pivot[1] + by * sail.ceDistance;
      const f = foilForce(bx, by, ax, ay, sail.area, RHO_AIR, this.sailCurves.get(sail.id)!);
      const fx = f.fx * cosHeel;
      const fy = f.fy * cosHeel;
      X += fx;
      Y += fy;
      // Balanced: the force acts at the centre of lateral resistance, where the hull's side
      // force cancels its turning effect.
      N += c.balanced ? spec.hull.lateralCentre * fy : ceX * fy - ceY * fx;
      heelMoment += fy * (sail.ceHeight + spec.draft * 0.5);
      sails.push({ id: sail.id, active, fx, fy, ceX, ceY, alphaDeg: f.alphaDeg, luffing: f.alphaDeg < LUFF_ALPHA_DEG });
    }

    // --- Windage: air drag on hull, masts and rigging --------------------------------
    {
      const ax = wf - s.u;
      const ay = ws - s.v;
      const k = 0.5 * RHO_AIR * spec.hull.windageArea * Math.hypot(ax, ay);
      X += k * ax;
      Y += k * ay;
    }

    // --- Hull and keel: a row of strips, each one a small underwater wing ---------
    const hull = spec.hull;
    const L = hull.waterlineLength;
    const span = L * (hull.lateralSpan ?? 0.5);
    const stripArea = hull.lateralArea / KEEL_STRIPS;
    let kx = 0;
    let ky = 0;
    let kn = 0;
    for (let i = 0; i < KEEL_STRIPS; i++) {
      const xi = hull.lateralCentre + ((i + 0.5) / KEEL_STRIPS - 0.5) * span;
      const f = foilForce(-1, 0, -s.u, -(s.v + s.r * xi), stripArea, RHO_WATER, this.keelCurve);
      kx += f.fx;
      ky += f.fy;
      kn += xi * f.fy;
    }
    X += kx;
    Y += ky;
    N += kn;

    // --- Forward resistance: skin friction + wave making ------------------------
    const froude = Math.abs(s.u) / Math.sqrt(GRAVITY * hull.waterlineLength);
    const cw = hull.waveCoef * (froude / 0.4) ** 4;
    let resistance = -0.5 * RHO_WATER * hull.wettedArea * (hull.cf + cw) * s.u * Math.abs(s.u);
    // Going backwards the hull is blunt (flow separates at the stern, rudder and keel):
    // bluff-body drag on most of the underwater cross-section, so a stalled boat only creeps back.
    if (s.u < 0) resistance += 0.5 * RHO_WATER * STERNWAY_CD * 0.6 * spec.beam * spec.draft * s.u * s.u;
    X += resistance;

    // --- Rudder -------------------------------------------------------------------
    const rd = spec.rudder;
    const rudderAngle = clamp(c.rudder, -1, 1) * deg2rad(rd.maxAngleDeg);
    // Balanced: the rudder ignores the sideways drift, which would otherwise push the stern
    // round (part of what makes a real boat want to turn).
    // It also always steers as if the boat were moving at least BALANCED_RUDDER_FLOW, so it
    // keeps control when the boat is slow (just after a tack); real rudders lose it.
    const rudderSway = c.balanced ? s.r * rd.x : s.v + s.r * rd.x;
    // (Not reversed either when the boat drifts backwards: that would steer the wrong way.)
    const rudderFlow = c.balanced ? Math.max(Math.abs(s.u), BALANCED_RUDDER_FLOW) : s.u;
    const rf = foilForce(-Math.cos(rudderAngle), Math.sin(rudderAngle), -rudderFlow, -rudderSway, rd.area, RHO_WATER, this.rudderCurve);
    X += rf.fx;
    Y += rf.fy;
    N += rd.x * rf.fy;
    // Balanced (easier) mode: the boat stops turning by itself within a few seconds when the
    // rudder is centred, instead of carrying the spin of a tack.
    // Only with the rudder near the centre: a hard-over turn (a tack) is not slowed.
    if (c.balanced) N -= this.inertia * s.r * BALANCED_YAW_DAMPING * Math.max(0, 1 - Math.abs(c.rudder) / 0.3);

    // --- Fishing net, dragged from the boom tips -----------------------------------
    const net: PointForce[] = [];
    if (mode.net && spec.net) {
      for (const [px, py] of spec.net.points) {
        const vx = s.u - s.r * py;
        const vy = s.v + s.r * px;
        const k = -0.5 * RHO_WATER * spec.net.dragArea * Math.hypot(vx, vy);
        const fx = k * vx;
        const fy = k * vy;
        X += fx;
        Y += fy;
        N += px * fy - py * fx;
        net.push({ fx, fy, x: px, y: py });
      }
    }

    // --- Integrate (semi-implicit Euler) ----------------------------------------------
    const du = (X + this.massV * s.v * s.r) / this.massU;
    const dv = (Y - this.massU * s.u * s.r) / this.massV;
    const dr = N / this.inertia;
    s.u += du * h;
    s.v += dv * h;
    s.r = this.lockHeading ? 0 : s.r + dr * h;

    const heelAcc = (heelMoment - this.rollStiffness * Math.sin(s.heel) - this.rollDamping * s.heelRate) / this.rollInertia;
    s.heelRate += heelAcc * h;
    s.heel = clamp(s.heel + s.heelRate * h, -1.2, 1.2);

    s.heading = wrapPi(s.heading + s.r * h);
    const sh = Math.sin(s.heading);
    const ch = Math.cos(s.heading);
    s.x += (s.u * sh + s.v * ch) * h;
    s.y += (s.u * ch - s.v * sh) * h;
    s.time += h;

    // --- Report (for the HUD, force arrows and tests) -----------------------------
    const awx = wf - s.u;
    const awy = ws - s.v;
    this.report = {
      sails,
      keel: { fx: kx, fy: ky, x: hull.lateralCentre, y: 0 },
      rudder: { fx: rf.fx, fy: rf.fy, x: rd.x, y: 0 },
      resistance: { fx: resistance, fy: 0, x: 0, y: 0 },
      net,
      apparentWindSpeed: Math.hypot(awx, awy),
      apparentWindAngleDeg: rad2deg(Math.atan2(-awy, -awx)),
      trueWindAngleDeg: rad2deg(Math.atan2(-ws, -wf)),
      heelMoment,
    };
  }

  private emptyReport(): ForceReport {
    return {
      sails: [],
      keel: ZERO_FORCE,
      rudder: ZERO_FORCE,
      resistance: ZERO_FORCE,
      net: [],
      apparentWindSpeed: 0,
      apparentWindAngleDeg: 0,
      trueWindAngleDeg: 0,
      heelMoment: 0,
    };
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
