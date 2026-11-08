// Data that describes a boat. Everything is in SI units and in the boat frame:
//   x = forward (from the centre of gravity), y = starboard, heights above the waterline.
// The physics never looks at the 3D model; the engine maps these numbers onto it.

export type Vec2 = readonly [number, number];

export interface SailSpec {
  id: string;
  name: string;
  /** Sails in the same group share one sheet control (e.g. "front", "main", "rear"). */
  group: string;
  /** Sail area, m². */
  area: number;
  /** Pivot of the sail (mast or tack), boat frame, m. */
  pivot: Vec2;
  /** Distance from the pivot to the centre of effort, measured aft along the boom, m. */
  ceDistance: number;
  /** Height of the centre of effort above the waterline, m (heeling arm). */
  ceHeight: number;
  /**
   * Boom angle with the sheet hauled fully in, degrees. Traditional rigs (lateen yards,
   * sprits, gaffs) cannot be hauled as flat as a yacht's boom: 20° for all our boats.
   */
  minAngle: number;
  /** Boom angle with the sheet fully eased, degrees. */
  maxAngle: number;
  /** Multiplies the lift coefficient (rig efficiency), default 1. */
  efficiency?: number;
}

export interface ModeSpec {
  id: string;
  name: string;
  description: string;
  /** Ids of the sails that are set in this mode. */
  sails: string[];
  /** Is the fishing net in the water? */
  net?: boolean;
}

export interface HullSpec {
  waterlineLength: number;
  /** Wetted surface, m². */
  wettedArea: number;
  /** Skin-friction coefficient. */
  cf: number;
  /** Wave-making resistance coefficient at Froude number 0.4. */
  waveCoef: number;
  /** Underwater side area of hull + keel, m². */
  lateralArea: number;
  /** Centre of lateral resistance, forward of the CG, m. */
  lateralCentre: number;
  /** Lift slope of the hull/keel seen as a (very low aspect ratio) wing, per radian. */
  liftSlope: number;
  stallDeg: number;
  /** Air drag area (Cd * A) of hull, masts and rigging, m². Hurts upwind sailing. */
  windageArea: number;
  /**
   * Share of the waterline length over which the side force acts (the keel and the
   * deepest part of the hull), default 0.5. Smaller = the boat turns more easily.
   */
  lateralSpan?: number;
}

export interface RudderSpec {
  area: number;
  /** Position along the boat (negative = aft of CG), m. */
  x: number;
  liftSlope: number;
  stallDeg: number;
  maxAngleDeg: number;
}

export interface NetSpec {
  /** Points where the net is attached (boom tips), boat frame, m. */
  points: Vec2[];
  /** Drag area (Cd * A) at each point, m². */
  dragArea: number;
}

export interface BoatSpec {
  id: string;
  name: string;
  description: string;
  length: number;
  beam: number;
  draft: number;
  /** Displacement, kg. */
  mass: number;
  /** Metacentric height, m: sets how stiff the boat is against heeling. */
  gm: number;
  /** Natural roll period, s. */
  rollPeriod: number;
  hull: HullSpec;
  rudder: RudderSpec;
  sails: SailSpec[];
  modes: ModeSpec[];
  net?: NetSpec;
}

/** Player inputs. */
export interface Controls {
  /** -1 (hard to port) .. 1 (hard to starboard). */
  rudder: number;
  /** Sheet per sail group: 0 = hauled in, 1 = fully eased. */
  sheets: Record<string, number>;
  mode: string;
  /**
   * Balanced sails: the sails push the boat as if they acted at the centre of lateral
   * resistance, so they do not turn it (easier to steer; real boats are rarely this well
   * balanced).
   */
  balanced?: boolean;
  /** No leeway in the track: the boat goes where it points (easy level). */
  noDrift?: boolean;
}

export interface BoatState {
  /** Position: x = east, y = north, m. */
  x: number;
  y: number;
  /** Compass heading, radians (0 = north, clockwise positive). */
  heading: number;
  /** Surge (forward) and sway (starboard) speed through the water, m/s. */
  u: number;
  v: number;
  /** Yaw rate, rad/s (positive = turning to starboard). */
  r: number;
  /** Heel angle, rad (positive = heeled to starboard), and its rate. */
  heel: number;
  heelRate: number;
  /** Boom angle per sail, rad (positive = boom out to starboard). */
  sailAngles: Record<string, number>;
  time: number;
}

export interface TrueWind {
  /** Direction the wind blows FROM, radians (compass). */
  from: number;
  /** m/s */
  speed: number;
}

export interface SailReport {
  id: string;
  active: boolean;
  /** Force in the boat frame, N. */
  fx: number;
  fy: number;
  /** Centre of effort, boat frame. */
  ceX: number;
  ceY: number;
  alphaDeg: number;
  /** The sail is not drawing (flapping). */
  luffing: boolean;
}

export interface PointForce {
  fx: number;
  fy: number;
  x: number;
  y: number;
}

export interface ForceReport {
  sails: SailReport[];
  keel: PointForce;
  rudder: PointForce;
  resistance: PointForce;
  /** Air drag on hull, masts and rigging. */
  windage: PointForce;
  net: PointForce[];
  /** Apparent wind at the boat: speed (m/s) and angle off the bow (deg, + = from starboard). */
  apparentWindSpeed: number;
  apparentWindAngleDeg: number;
  /** True wind angle off the bow, deg (+ = from starboard). */
  trueWindAngleDeg: number;
  heelMoment: number;
}
