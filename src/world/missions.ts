// Missions: regattas round buoys, transport between ports, fishing, or free sailing.
// Plain TypeScript (no 3D), so the rules can be tested.
import type { LandMask } from './landMask';
import { t } from '../i18n';
import { getArea, type AreaId } from './area';

export type Level = 'easy' | 'medium' | 'hard';

export const LEVELS: { id: Level; name: string; description: string }[] = [
  { id: 'easy', name: t('level.easy'), description: t('level.easy.desc') },
  { id: 'medium', name: t('level.medium'), description: t('level.medium.desc') },
  { id: 'hard', name: t('level.hard'), description: t('level.hard.desc') },
];

export type MissionKind = 'regatta' | 'transport' | 'fishing' | 'free';

export type Mission =
  | { id: string; kind: 'transport'; title: string; boat: string; from: string; to: string }
  | { id: string; kind: 'regatta'; title: string; boat: string; at: string; buoys: 2 | 3 }
  | { id: string; kind: 'fishing'; title: string; boat: string; at: string; targetKg: number }
  | { id: string; kind: 'free'; title: string; boat: string; from: string };

/** The four kinds of mission, as the menu shows them first. */
export const MISSION_KINDS: { id: MissionKind; title: string; description: string }[] = [
  { id: 'regatta', title: t('kind.regatta'), description: t('kind.regatta.desc') },
  { id: 'transport', title: t('kind.transport'), description: t('kind.transport.desc') },
  { id: 'fishing', title: t('kind.fishing'), description: t('kind.fishing.desc') },
  { id: 'free', title: t('kind.free'), description: t('kind.free.desc') },
];

export interface RegattaCourse {
  id: string;
  name: string;
  at: string;
  buoys: 2 | 3;
}
export interface Route {
  id: string;
  from: string;
  to: string;
  boat: string;
  description: string;
}
export interface FishingGroundInfo {
  id: string;
  name: string;
  at: string;
}

/** Regatta courses on the Tagus: laid to the wind off a port. */
export const REGATTA_COURSES: RegattaCourse[] = [
  { id: 'lisboa', name: t('course.lisboa'), at: 'Lisboa', buoys: 3 },
  { id: 'cascais', name: t('course.cascais'), at: 'Cascais', buoys: 2 },
  { id: 'oeiras', name: t('course.oeiras'), at: 'Oeiras', buoys: 2 },
];

/** Transport routes on the Tagus, with the boat that traditionally sailed them. */
export const ROUTES: Route[] = [
  { id: 'lisboa-almada', from: 'Lisboa', to: 'Almada', boat: 'catraio', description: t('route.lisboa-almada') },
  { id: 'moita-lisboa', from: 'Moita', to: 'Lisboa', boat: 'fragata', description: t('route.moita-lisboa') },
  { id: 'sarilhos-barreiro', from: 'Sarilhos Pequenos', to: 'Barreiro', boat: 'fragata', description: t('route.sarilhos-barreiro') },
  { id: 'vfx-lisboa', from: 'Vila Franca de Xira', to: 'Lisboa', boat: 'fragata', description: t('route.vfx-lisboa') },
];

/** Fishing grounds of the Muleta (on the Tagus). */
export const FISHING_GROUNDS: FishingGroundInfo[] = [
  { id: 'seixal', name: t('ground.seixal'), at: 'Seixal' },
  { id: 'barra', name: t('ground.barra'), at: 'Trafaria' },
  { id: 'cascais', name: t('ground.cascais'), at: 'Cascais' },
];

/** The missions of each sailing area. */
export const AREA_MISSIONS: Record<AreaId, { courses: RegattaCourse[]; routes: Route[]; grounds: FishingGroundInfo[] }> = {
  tejo: { courses: REGATTA_COURSES, routes: ROUTES, grounds: FISHING_GROUNDS },
  arcachon: {
    courses: [
      { id: 'arcachon', name: t('course.arcachon'), at: 'Arcachon', buoys: 3 },
      { id: 'andernos', name: t('course.andernos'), at: 'Andernos-les-Bains', buoys: 2 },
      { id: 'cap-ferret', name: t('course.cap-ferret'), at: 'Le Cap Ferret', buoys: 2 },
    ],
    routes: [
      { id: 'arcachon-capferret', from: 'Arcachon', to: 'Le Cap Ferret', boat: 'pinasse', description: t('route.arcachon-capferret') },
      { id: 'gujan-andernos', from: 'Gujan-Mestras', to: 'Andernos-les-Bains', boat: 'pinasse', description: t('route.gujan-andernos') },
      { id: 'arcachon-ileoiseaux', from: 'Arcachon', to: 'Île aux Oiseaux', boat: 'pinasse', description: t('route.arcachon-ileoiseaux') },
    ],
    grounds: [],
  },
  aveiro: {
    courses: [
      { id: 'aveiro-sjacinto', name: t('course.aveiro-sjacinto'), at: 'São Jacinto', buoys: 3 },
      { id: 'torreira', name: t('course.torreira'), at: 'Torreira', buoys: 2 },
    ],
    routes: [
      { id: 'torreira-aveiro', from: 'Torreira', to: 'Aveiro', boat: 'canoa', description: t('route.torreira-aveiro') },
      { id: 'sjacinto-costanova', from: 'São Jacinto', to: 'Costa Nova', boat: 'canoa', description: t('route.sjacinto-costanova') },
    ],
    grounds: [],
  },
  pasaia: {
    courses: [
      { id: 'concha', name: t('course.concha'), at: 'Donostia / San Sebastián', buoys: 3 },
      { id: 'pasaia', name: t('course.pasaia'), at: 'Pasaia', buoys: 2 },
      { id: 'sjdl', name: t('course.sjdl'), at: 'Saint-Jean-de-Luz', buoys: 2 },
    ],
    routes: [
      { id: 'pasaia-donostia', from: 'Pasaia', to: 'Donostia / San Sebastián', boat: 'pinasse', description: t('route.pasaia-donostia') },
      { id: 'hondarribia-sjdl', from: 'Hondarribia', to: 'Saint-Jean-de-Luz', boat: 'pinasse', description: t('route.hondarribia-sjdl') },
      { id: 'pasaia-hondarribia', from: 'Pasaia', to: 'Hondarribia', boat: 'pinasse', description: t('route.pasaia-hondarribia') },
    ],
    grounds: [],
  },
};

/** The missions of the area open now. */
export function areaMissions(): { courses: RegattaCourse[]; routes: Route[]; grounds: FishingGroundInfo[] } {
  return AREA_MISSIONS[getArea().id];
}
const ALL = Object.values(AREA_MISSIONS);
const findCourse = (id: string) => ALL.flatMap((a) => a.courses).find((x) => x.id === id);
const findRoute = (id: string) => ALL.flatMap((a) => a.routes).find((x) => x.id === id);
const findGround = (id: string) => ALL.flatMap((a) => a.grounds).find((x) => x.id === id);

/** Fish to bring home on a fishing trip, kg. */
export const FISHING_TARGET_KG = 150;

const boatName = (boats: { id: string; name: string }[], id: string) => boats.find((b) => b.id === id)?.name ?? id;

/** Build a mission from the menu's choices: a kind, one of its options, and a boat. */
export function makeMission(kind: MissionKind, option: string, boat: string, boats: { id: string; name: string }[]): Mission {
  const b = boatName(boats, boat);
  if (kind === 'regatta') {
    const c = findCourse(option) ?? REGATTA_COURSES[0];
    return { id: `regatta-${c.id}-${boat}`, kind, title: t('title.regatta', { course: t(`course.${c.id}.short`), boat: b }), boat, at: c.at, buoys: c.buoys };
  }
  if (kind === 'transport') {
    const r = findRoute(option) ?? ROUTES[0];
    return { id: `transport-${r.id}-${boat}`, kind, title: t('title.transport', { from: r.from, to: r.to, boat: b }), boat, from: r.from, to: r.to };
  }
  if (kind === 'fishing') {
    const g = findGround(option) ?? FISHING_GROUNDS[0];
    return { id: `fishing-${g.id}`, kind, title: t('title.fishing', { ground: g.name }), boat: 'muleta', at: g.at, targetKg: FISHING_TARGET_KG };
  }
  return { id: `free-${option}-${boat}`, kind: 'free', title: t('title.free', { boat: b }), boat, from: option };
}

/** Passing this close to a buoy counts as rounding it, m. */
export const ROUNDING_RADIUS = 45;
/** Arriving within this distance of a port or the finish line ends the mission, m. */
export const ARRIVAL_RADIUS = 150;
export const FINISH_RADIUS = 60;

export interface Course {
  /** Start and finish line (its middle). */
  start: { x: number; y: number };
  buoys: { x: number; y: number }[];
}

/**
 * A regatta course in open water around `centre`, laid to the wind: the first buoy straight
 * upwind of the start (a beat), then reaching legs, then back to the line. Shrinks and turns
 * the course until every buoy and leg is in open water.
 */
export function buildCourse(mask: LandMask, centre: { x: number; y: number }, windFrom: number, buoys: 2 | 3, length = 600): Course | null {
  const open = (x: number, y: number) => {
    if (!mask.isReachable(x, y)) return false;
    for (let a = 0; a < 8; a++) if (!mask.isWater(x + 60 * Math.cos((a * Math.PI) / 4), y + 60 * Math.sin((a * Math.PI) / 4))) return false;
    return true;
  };
  const clearLeg = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = 0; s <= d; s += 40) if (!open(a.x + ((b.x - a.x) * s) / d, a.y + ((b.y - a.y) * s) / d)) return false;
    return true;
  };
  for (let L = length; L >= 250; L *= 0.85) {
    // turn: shift the whole course across the wind (in course lengths) to find room.
    for (const turn of [0, 0.25, -0.25, 0.5, -0.5]) {
      for (const side of [1, -1]) {
        // u: towards the wind; c: across it.
        const u = { x: Math.sin(windFrom), y: Math.cos(windFrom) };
        const c = { x: u.y * side, y: -u.x * side };
        const s0 = { x: centre.x - u.x * L * 0.4 + c.x * L * turn, y: centre.y - u.y * L * 0.4 + c.y * L * turn };
        const at = (ku: number, kc: number) => ({ x: s0.x + u.x * L * ku + c.x * L * kc, y: s0.y + u.y * L * ku + c.y * L * kc });
        const marks = buoys === 3 ? [at(1, 0), at(0.5, 0.6), at(0.12, 0.35)] : [at(1, 0), at(0.35, 0.55)];
        const path = [s0, ...marks, s0];
        if (path.every((p) => open(p.x, p.y)) && path.every((p, i) => i === 0 || clearLeg(path[i - 1], p))) return { start: s0, buoys: marks };
      }
    }
  }
  return null;
}

/** Progress through a mission: which buoy is next, and when it ended. */
export class MissionRun {
  /** Index of the next buoy (regatta); equals buoys.length when heading for the finish. */
  next = 0;
  finishedAt: number | null = null;

  constructor(
    readonly mission: Mission,
    readonly startedAt: number,
    readonly course: Course | null,
    readonly target: { x: number; y: number } | null,
  ) {}

  /** The point to sail to now (next buoy, the finish, or the port). */
  get goal(): { x: number; y: number } | null {
    if (this.course) return this.next < this.course.buoys.length ? this.course.buoys[this.next] : this.course.start;
    return this.target;
  }

  get goalName(): string {
    const m = this.mission;
    if (m.kind === 'transport') return m.to;
    if (this.course) return this.next < this.course.buoys.length ? t('goal.buoy', { n: this.next + 1, total: this.course.buoys.length }) : t('goal.finish');
    return '';
  }

  /** Call every step with the boat's position and the game time. Returns true when it ends. */
  update(x: number, y: number, time: number): boolean {
    if (this.finishedAt !== null) return true;
    const g = this.goal;
    if (!g) return false;
    const d = Math.hypot(g.x - x, g.y - y);
    if (this.course) {
      if (this.next < this.course.buoys.length) {
        if (d < ROUNDING_RADIUS) this.next++;
      } else if (d < FINISH_RADIUS) this.finishedAt = time;
    } else if (d < ARRIVAL_RADIUS) this.finishedAt = time;
    return this.finishedAt !== null;
  }

  elapsed(time: number): number {
    return (this.finishedAt ?? time) - this.startedAt;
  }
}

/** Best times, kept in the browser: key per mission and level. */
export function bestTimeKey(missionId: string, level: Level): string {
  return `fragateiro.best.${missionId}.${level}`;
}
