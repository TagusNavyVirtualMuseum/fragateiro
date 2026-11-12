// Missions: regattas round buoys, transport between ports, fishing, or free sailing.
// Plain TypeScript (no 3D), so the rules can be tested.
import type { LandMask } from './landMask';
import { t, tMaybe } from '../i18n';
import { getEdition } from './edition';
import { AREAS, getArea, type AreaId } from './area';
import { DEFAULT_RULES, DRILL_IDS, type DrillGoals, type DrillId, type DrillRules } from './drills';
import gamesConfig from '../../content/minigames.json';

export type Level = 'easy' | 'medium' | 'hard';

export const LEVELS: { id: Level; name: string; description: string }[] = [
  { id: 'easy', name: t('level.easy'), description: t('level.easy.desc') },
  { id: 'medium', name: t('level.medium'), description: t('level.medium.desc') },
  { id: 'hard', name: t('level.hard'), description: t('level.hard.desc') },
];

export type MissionKind = 'regatta' | 'transport' | 'cleanup' | 'supply' | 'whaling' | 'fishing' | 'free' | 'run' | 'seaweed' | 'drill';

export type Mission =
  | { id: string; kind: 'transport'; title: string; boat: string; from: string; to: string; busy?: boolean }
  | { id: string; kind: 'cleanup'; title: string; boat: string; at: string; count: number }
  | { id: string; kind: 'whaling'; title: string; boat: string; from: string; watch?: boolean }
  | { id: string; kind: 'run'; title: string; boat: string; from: string; dir: 'downwind' | 'upwind'; distance: number }
  | { id: string; kind: 'seaweed'; title: string; boat: string; at: string; count: number }
  | { id: string; kind: 'supply'; title: string; boat: string; from: string; meet: { lat: number; lon: number }; meetBoat: string }
  | { id: string; kind: 'regatta'; title: string; boat: string; at: string; buoys: 2 | 3 }
  | { id: string; kind: 'fishing'; title: string; boat: string; at: string; targetKg: number }
  | { id: string; kind: 'free'; title: string; boat: string; from: string }
  | { id: string; kind: 'drill'; title: string; boat: string; from: string; drill: DrillId; goals?: DrillGoals; distance?: number };

/** The kinds of mission, as the menu shows them first. */
export const MISSION_KINDS: { id: MissionKind; title: string; description: string }[] = [
  { id: 'regatta', title: t('kind.regatta'), description: t('kind.regatta.desc') },
  { id: 'transport', title: t('kind.transport'), description: t('kind.transport.desc') },
  { id: 'cleanup', title: t('kind.cleanup'), description: t('kind.cleanup.desc') },
  { id: 'supply', title: t('kind.supply'), description: t('kind.supply.desc') },
  { id: 'whaling', title: t('kind.whaling'), description: t('kind.whaling.desc') },
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
  /** A port, or a mark (a place on the map that is not a port, e.g. a race buoy). */
  to: string;
  boat: string;
  description: string;
  /** A crowded crossing: many boats about, strong gusts and big wind shifts. */
  busy?: boolean;
}
export interface CleanupInfo {
  id: string;
  name: string;
  at: string;
}
export interface SupplyInfo {
  id: string;
  name: string;
  /** The port one sails from, and back to. */
  from: string;
  /** Where the fishing boat lies at anchor. */
  meet: { lat: number; lon: number };
  /** Which boat that is. */
  meetBoat: string;
  /** The boat that does the run. */
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
  { id: 'moita-gaio', from: 'Moita', to: 'Gaio-Rosário', boat: 'catraio', description: t('route.moita-gaio') },
  { id: 'sarilhos-boia', from: 'Sarilhos Pequenos', to: 'Boia de Sarilhos', boat: 'catraio', description: t('route.sarilhos-boia') },
  { id: 'almada-lisboa-busy', from: 'Almada', to: 'Lisboa', boat: 'catraio', description: t('route.almada-lisboa-busy'), busy: true },
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
  azores: {
    courses: [
      { id: 'horta', name: t('course.horta'), at: 'Horta', buoys: 3 },
      { id: 'sroque', name: t('course.sroque'), at: 'São Roque do Pico', buoys: 2 },
    ],
    routes: [
      { id: 'horta-madalena', from: 'Horta', to: 'Madalena', boat: 'baleeiro', description: t('route.horta-madalena') },
      { id: 'horta-sroque', from: 'Horta', to: 'São Roque do Pico', boat: 'baleeiro', description: t('route.horta-sroque') },
      { id: 'sroque-velas', from: 'São Roque do Pico', to: 'Velas', boat: 'baleeiro', description: t('route.sroque-velas') },
    ],
    grounds: [],
  },
  madeira: {
    courses: [
      { id: 'machico', name: t('course.machico'), at: 'Machico', buoys: 3 },
      { id: 'santacruz', name: t('course.santacruz'), at: 'Santa Cruz', buoys: 2 },
    ],
    routes: [
      { id: 'santacruz-slourenco', from: 'Santa Cruz', to: 'Ponta de São Lourenço', boat: 'falua', description: t('route.santacruz-slourenco') },
      { id: 'portocruz-slourenco', from: 'Porto da Cruz', to: 'Ponta de São Lourenço', boat: 'falua', description: t('route.portocruz-slourenco') },
      { id: 'machico-santacruz', from: 'Machico', to: 'Santa Cruz', boat: 'falua', description: t('route.machico-santacruz') },
    ],
    grounds: [],
  },
  medio: {
    courses: [],
    routes: [
      { id: 'barquinha-almourol', from: 'Vila Nova da Barquinha', to: 'Castelo de Almourol', boat: 'canoa', description: t('route.barquinha-almourol') },
      { id: 'tancos-constancia', from: 'Tancos', to: 'Constância', boat: 'canoa', description: t('route.tancos-constancia') },
      { id: 'constancia-abrantes', from: 'Constância', to: 'Abrantes', boat: 'catraio', description: t('route.constancia-abrantes') },
    ],
    grounds: [],
  },
};

/** Clean-ups: rubbish to pick up off a port, in every area. */
export const CLEANUPS: Record<AreaId, CleanupInfo[]> = {
  medio: [{ id: 'clean-constancia', name: t('cleanup.constancia'), at: 'Constância' }],
  tejo: [
    { id: 'clean-lisboa', name: t('cleanup.lisboa'), at: 'Lisboa' },
    { id: 'clean-seixal', name: t('cleanup.seixal'), at: 'Seixal' },
    { id: 'clean-cascais', name: t('cleanup.cascais'), at: 'Cascais' },
  ],
  arcachon: [{ id: 'clean-arcachon', name: t('cleanup.arcachon'), at: 'Arcachon' }],
  aveiro: [{ id: 'clean-sjacinto', name: t('cleanup.sjacinto'), at: 'São Jacinto' }],
  pasaia: [{ id: 'clean-concha', name: t('cleanup.concha'), at: 'Donostia / San Sebastián' }],
  azores: [{ id: 'clean-horta', name: t('cleanup.horta'), at: 'Horta' }],
  madeira: [{ id: 'clean-machico', name: t('cleanup.machico'), at: 'Machico' }],
};

/** Supply runs: out to a fishing boat at anchor and back. */
export const SUPPLIES: Record<AreaId, SupplyInfo[]> = {
  medio: [],
  tejo: [
    {
      id: 'bugio-muleta',
      name: t('supply.bugio'),
      from: 'Trafaria',
      meet: { lat: 38.64, lon: -9.3 }, // about 2.4 km south of the Bugio
      meetBoat: 'muleta',
      boat: 'falua',
      description: t('supply.bugio.desc'),
    },
  ],
  arcachon: [],
  aveiro: [],
  pasaia: [],
  azores: [],
  madeira: [],
};

/** Whaling: the ports a whale hunt can start from (the Azores only). */
export const WHALING: Record<AreaId, string[]> = {
  medio: [],
  tejo: [],
  arcachon: [],
  aveiro: [],
  pasaia: [],
  azores: ['Horta', 'Madalena', 'São Roque do Pico', 'Velas'],
  madeira: [],
};

/** The missions of the area open now. */
export function areaMissions(): { courses: RegattaCourse[]; routes: Route[]; grounds: FishingGroundInfo[]; cleanups: CleanupInfo[]; supplies: SupplyInfo[]; whaling: string[] } {
  const id = getArea().id;
  return { ...AREA_MISSIONS[id], cleanups: CLEANUPS[id], supplies: SUPPLIES[id], whaling: WHALING[id] };
}
const ALL = Object.values(AREA_MISSIONS);
const findCourse = (id: string) => ALL.flatMap((a) => a.courses).find((x) => x.id === id);
const findRoute = (id: string) => ALL.flatMap((a) => a.routes).find((x) => x.id === id);
const findGround = (id: string) => ALL.flatMap((a) => a.grounds).find((x) => x.id === id);
const findCleanup = (id: string) => Object.values(CLEANUPS).flat().find((x) => x.id === id);
const findSupply = (id: string) => Object.values(SUPPLIES).flat().find((x) => x.id === id);

/** Fish to bring home on a fishing trip, kg. */
export const FISHING_TARGET_KG = 150;

/** A place's name as shown (marks such as race buoys have translated names). */
export const placeName = (name: string) => tMaybe(`place.${name}`) ?? name;

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
    return { id: `transport-${r.id}-${boat}`, kind, title: t(r.busy ? 'title.busy' : 'title.transport', { from: r.from, to: placeName(r.to), boat: b }), boat, from: r.from, to: r.to, busy: r.busy };
  }
  if (kind === 'whaling') {
    return { id: `whaling-${option}-${boat}`, kind, title: t('title.whaling', { from: option, boat: b }), boat, from: option };
  }
  if (kind === 'cleanup') {
    const c = findCleanup(option) ?? CLEANUPS.tejo[0];
    return { id: `cleanup-${c.id}-${boat}`, kind, title: t('title.cleanup', { at: c.name, boat: b }), boat, at: c.at, count: getEdition().trashCount };
  }
  if (kind === 'supply') {
    const c = findSupply(option) ?? SUPPLIES.tejo[0];
    return { id: `supply-${c.id}-${boat}`, kind, title: t('title.supply', { name: c.name, boat: b }), boat, from: c.from, meet: c.meet, meetBoat: c.meetBoat };
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
  /** Seconds added for collisions. */
  penalty = 0;

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
    if (m.kind === 'transport') return placeName(m.to);
    if (m.kind === 'run') return t('goal.mark');
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
    return (this.finishedAt ?? time) - this.startedAt + this.penalty;
  }
}

/** Best times, kept in the browser: key per mission and level. */
export function bestTimeKey(missionId: string, level: Level): string {
  // The museum edition's shorter challenges keep their own best times.
  const ed = getEdition().id === 'museum' ? '.museum' : '';
  return `fragateiro.best.${missionId}.${level}${ed}`;
}

/** The museum's mini-games: one boat and one task each, chosen straight from the menu. */
export interface MiniGame {
  id: string;
  area: AreaId;
  boat: string;
  /** The mission (built when chosen, so titles are in the current language). */
  mission: (boats: { id: string; name: string }[]) => Mission;
}

// --- The drills and mini-games, as set in content/minigames.json (see content/README.md).

export interface DrillEntry {
  id: string;
  drill: DrillId;
  show?: boolean;
  area: string;
  boat: string;
  from: string;
  /** Hold: seconds on the beam reach. Slalom: the time limit. */
  seconds?: number;
  /** Gybes or tacks to make. */
  turns?: number;
  /** Anchor: how far the anchor spot is, m. */
  distance?: number;
}
export interface GameEntry {
  id: string;
  type: 'run' | 'transport' | 'whales' | 'seaweed' | 'fishing' | 'supply';
  show?: boolean;
  area: string;
  boat: string;
  from?: string;
  to?: string;
  at?: string;
  direction?: 'downwind' | 'upwind';
  distance?: number;
  busy?: boolean;
  count?: number;
  kg?: number;
  meet?: { lat: number; lon: number };
  meetBoat?: string;
}
export interface GamesConfig {
  drills: DrillEntry[];
  drillRules?: { beamFromDeg?: number; beamToDeg?: number; capsizeHeelDeg?: number; gybeSheetMax?: number; stopSpeedKnots?: number };
  minigames: GameEntry[];
}

const GAME_FIELDS: Record<GameEntry['type'], (keyof GameEntry)[]> = {
  run: ['from', 'direction', 'distance'],
  transport: ['from', 'to'],
  whales: ['from'],
  seaweed: ['at', 'count'],
  fishing: ['at', 'kg'],
  supply: ['from', 'meet', 'meetBoat'],
};

/**
 * Mistakes in the drills and mini-games file, as sentences (empty when all is well): unknown
 * areas, boats, ports or kinds, missing fields, missing titles in the texts.
 */
export function checkGames(cfg: GamesConfig, boats: string[], hasText: (key: string) => boolean): string[] {
  const out: string[] = [];
  const areas = Object.keys(AREAS);
  const ids = new Set<string>();
  const port = (area: string, name: string | undefined) => !!name && !!AREAS[area as AreaId] && (AREAS[area as AreaId].ports.includes(name) || AREAS[area as AreaId].extraPlaces.some((p) => p.name === name));
  const common = (e: { id: string; area: string; boat: string }, what: string, textKey: string) => {
    if (!e.id) out.push(`A ${what} has no "id".`);
    if (ids.has(`${what}:${e.id}`)) out.push(`Two ${what}s have the id "${e.id}".`);
    ids.add(`${what}:${e.id}`);
    if (!areas.includes(e.area)) out.push(`${what} "${e.id}": unknown area "${e.area}" (one of ${areas.join(', ')}).`);
    if (!boats.includes(e.boat)) out.push(`${what} "${e.id}": unknown boat "${e.boat}" (one of ${boats.join(', ')}).`);
    for (const k of [textKey, `${textKey}.desc`]) if (!hasText(k)) out.push(`${what} "${e.id}": no text "${k}" in content/texts/pt.txt.`);
  };
  for (const d of cfg.drills ?? []) {
    common(d, 'drill', `drill.${d.id}`);
    if (!(DRILL_IDS as string[]).includes(d.drill)) out.push(`drill "${d.id}": unknown kind "${d.drill}" (one of ${DRILL_IDS.join(', ')}).`);
    if (!port(d.area, d.from)) out.push(`drill "${d.id}": "${d.from}" is not a port of ${d.area}.`);
  }
  for (const g of cfg.minigames ?? []) {
    common(g, 'mini-game', `mini.${g.id}`);
    const need = GAME_FIELDS[g.type];
    if (!need) {
      out.push(`mini-game "${g.id}": unknown type "${g.type}" (one of ${Object.keys(GAME_FIELDS).join(', ')}).`);
      continue;
    }
    for (const k of need) if (g[k] === undefined) out.push(`mini-game "${g.id}" (${g.type}) needs "${k}".`);
    for (const k of ['from', 'at'] as const) if (g[k] !== undefined && !port(g.area, g[k])) out.push(`mini-game "${g.id}": "${g[k]}" is not a port of ${g.area}.`);
    if (g.direction !== undefined && g.direction !== 'downwind' && g.direction !== 'upwind') out.push(`mini-game "${g.id}": "direction" is "downwind" or "upwind".`);
    if (g.meetBoat !== undefined && !boats.includes(g.meetBoat)) out.push(`mini-game "${g.id}": unknown boat "${g.meetBoat}".`);
  }
  return out;
}

const CONFIG = gamesConfig as GamesConfig;
const R = CONFIG.drillRules ?? {};
/** The rules all drills share. */
export const DRILL_RULES: DrillRules = {
  beamMin: R.beamFromDeg ?? DEFAULT_RULES.beamMin,
  beamMax: R.beamToDeg ?? DEFAULT_RULES.beamMax,
  capsizeHeel: R.capsizeHeelDeg !== undefined ? (R.capsizeHeelDeg * Math.PI) / 180 : DEFAULT_RULES.capsizeHeel,
  gybeSheet: R.gybeSheetMax ?? DEFAULT_RULES.gybeSheet,
  stopSpeed: R.stopSpeedKnots !== undefined ? R.stopSpeedKnots * 0.514444 : DEFAULT_RULES.stopSpeed,
};

/** The drills, in the file's order (those with "show": false left out). */
export const DRILLS: MiniGame[] = CONFIG.drills
  .filter((d) => d.show !== false)
  .map((d) => ({
    id: `drill-${d.id}`,
    area: d.area as AreaId,
    boat: d.boat,
    mission: () => ({
      id: `drill-${d.id}`,
      kind: 'drill' as const,
      title: t(`drill.${d.id}`),
      boat: d.boat,
      from: d.from,
      drill: d.drill,
      goals: { seconds: d.drill === 'hold' ? d.seconds : undefined, limit: d.drill === 'slalom' ? d.seconds : undefined, turns: d.turns },
      distance: d.distance,
    }),
  }));

function gameMission(g: GameEntry): Mission {
  const base = { id: `mini-${g.id}`, title: t(`mini.${g.id}`), boat: g.boat };
  switch (g.type) {
    case 'run':
      return { ...base, kind: 'run', from: g.from!, dir: g.direction ?? 'downwind', distance: g.distance ?? getEdition().runDistance };
    case 'transport':
      return { ...base, kind: 'transport', from: g.from!, to: g.to!, busy: g.busy };
    case 'whales':
      return { ...base, kind: 'whaling', from: g.from!, watch: true };
    case 'seaweed':
      return { ...base, kind: 'seaweed', at: g.at!, count: g.count ?? getEdition().trashCount };
    case 'fishing':
      return { ...base, kind: 'fishing', at: g.at!, targetKg: g.kg ?? FISHING_TARGET_KG };
    case 'supply':
      return { ...base, kind: 'supply', from: g.from!, meet: g.meet!, meetBoat: g.meetBoat! };
  }
}

/** The mini-games, in the file's order (those with "show": false left out). */
export const MINIGAMES: MiniGame[] = CONFIG.minigames
  .filter((g) => g.show !== false && GAME_FIELDS[g.type])
  .map((g) => ({ id: g.id, area: g.area as AreaId, boat: g.boat, mission: () => gameMission(g) }));
