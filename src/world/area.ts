// The sailing areas the game offers, and which one is open. Plain TypeScript (no 3D).
// The maps themselves are built by scripts/fetch-map.mjs (areas in scripts/map-areas.mjs).
import { DESTINATION_NAMES, EXTRA_PLACES } from './destinations';

export type AreaId = 'tejo' | 'arcachon' | 'aveiro';

export interface AreaInfo {
  id: AreaId;
  /** Ports one can start from or sail to, as named on OpenStreetMap. */
  ports: string[];
  /** Boat picked when the game opens here. */
  boat: string;
  /** The Tagus landmarks (bridges, towers, lighthouses) and its dolphins and orcas. */
  tagusExtras: boolean;
  /** Ports that are not named places on OpenStreetMap, by latitude and longitude. */
  extraPlaces: { name: string; kind: string; lat: number; lon: number }[];
  /**
   * A point in the main body of water (all the water joined to it is sailable). Default: the
   * map's origin.
   */
  start?: { lat: number; lon: number };
}

/** A latitude and longitude in the map's metres (east, north of its origin), as fetch-map.mjs. */
export function toMapXY(origin: { lat: number; lon: number }, p: { lat: number; lon: number }): { x: number; y: number } {
  const mLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return { x: (p.lon - origin.lon) * mLon, y: (p.lat - origin.lat) * 110574 };
}

export const AREAS: Record<AreaId, AreaInfo> = {
  tejo: { id: 'tejo', ports: DESTINATION_NAMES, boat: 'falua', tagusExtras: true, extraPlaces: EXTRA_PLACES },
  arcachon: {
    id: 'arcachon',
    ports: ['Arcachon', 'Le Moulleau', 'Pyla-sur-Mer', 'La Teste-de-Buch', 'Gujan-Mestras', 'Le Teich', 'Port de Biganos', 'Audenge', 'Lanton', 'Andernos-les-Bains', 'Arès', 'Claouey', 'Le Canon', "L'Herbe", 'Le Cap Ferret', 'Île aux Oiseaux'],
    boat: 'pinasse',
    tagusExtras: false,
    extraPlaces: [
      { name: 'Le Cap Ferret', kind: 'village', lat: 44.6405, lon: -1.2465 }, // the Bélisaire jetty
      { name: "L'Herbe", kind: 'hamlet', lat: 44.6905, lon: -1.243 },
      { name: 'Le Canon', kind: 'hamlet', lat: 44.703, lon: -1.243 },
      { name: 'Claouey', kind: 'village', lat: 44.7475, lon: -1.1835 },
      { name: 'Le Moulleau', kind: 'village', lat: 44.6435, lon: -1.2045 },
      { name: 'Pyla-sur-Mer', kind: 'village', lat: 44.6355, lon: -1.2105 },
    ],
  },
  aveiro: {
    id: 'aveiro',
    ports: ['São Jacinto', 'Torreira', 'Cais do Bico', 'Murtosa', 'Ovar', 'Aveiro', 'Ílhavo', 'Gafanha da Nazaré', 'Costa Nova', 'Barra', 'Vagos', 'Praia da Vagueira'],
    boat: 'canoa',
    tagusExtras: false,
    extraPlaces: [{ name: 'Cais do Bico', kind: 'hamlet', lat: 40.7298, lon: -8.6455 }],
    start: { lat: 40.74, lon: -8.69 }, // the open lagoon off Torreira
  },
};
export const AREA_IDS = Object.keys(AREAS) as AreaId[];

const KEY = 'fragateiro.area';

function detect(): AreaId {
  if (typeof location === 'undefined') return 'tejo';
  const fromUrl = new URLSearchParams(location.search).get('area');
  if (fromUrl && fromUrl in AREAS) return fromUrl as AreaId;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && saved in AREAS) return saved as AreaId;
  } catch {
    // storage blocked: the Tagus
  }
  return 'tejo';
}

const current = detect();

/** The area open now (from ?area=, else the last one chosen, else the Tagus). */
export function getArea(): AreaInfo {
  return AREAS[current];
}

/** Open another area: remembered, and the page reloads with its map. */
export function setArea(id: AreaId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: only this visit
  }
  const url = new URL(location.href);
  url.searchParams.set('area', id);
  location.href = url.toString();
}
