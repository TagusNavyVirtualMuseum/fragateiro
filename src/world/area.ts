// The sailing areas the game offers, and which one is open. Plain TypeScript (no 3D).
// The maps themselves are built by scripts/fetch-map.mjs (areas in scripts/map-areas.mjs).
import { DESTINATION_NAMES, EXTRA_PLACES } from './destinations';

export type AreaId = 'tejo' | 'medio' | 'arcachon' | 'aveiro' | 'pasaia' | 'azores' | 'madeira' | 'oeste';

export interface AreaInfo {
  id: AreaId;
  /** Ports one can start from or sail to, as named on OpenStreetMap. */
  ports: string[];
  /** Boat picked when the game opens here. */
  boat: string;
  /** The Tagus wildlife (dolphins up to Lisbon, orcas offshore). Landmarks: mapView.ts. */
  tagusExtras: boolean;
  /** Metres between land vertices near the camera (default 50; a narrow river needs 10). */
  landDetail?: number;
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
  oeste: {
    id: 'oeste',
    ports: ['São Martinho do Porto', 'Porto da Nazaré', 'Porto de Peniche', 'Berlenga'],
    boat: 'baleeiro',
    tagusExtras: false,
    // The harbours (the towns' OpenStreetMap places sit inland or on the open beach).
    extraPlaces: [
      { name: 'Porto da Nazaré', kind: 'town', lat: 39.5868, lon: -9.0745 },
      { name: 'Porto de Peniche', kind: 'town', lat: 39.3535, lon: -9.3765 },
      { name: 'Berlenga', kind: 'village', lat: 39.4158, lon: -9.5065 }, // the landing at the Carreiro do Mosteiro
    ],
  },
  medio: {
    id: 'medio',
    landDetail: 10,
    ports: ['Vila Nova da Barquinha', 'Tancos', 'Castelo de Almourol', 'Praia do Ribatejo', 'Constância', 'Tramagal', 'Abrantes'],
    boat: 'canoa',
    tagusExtras: false,
    extraPlaces: [{ name: 'Castelo de Almourol', kind: 'mark', lat: 39.4613, lon: -8.3845 }],
    start: { lat: 39.4598, lon: -8.392 }, // in the river off Tancos, the castle ahead
  },
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
  pasaia: {
    id: 'pasaia',
    ports: ['Pasaia', 'Donostia / San Sebastián', 'Hondarribia', 'Hendaye', 'Socoa', 'Saint-Jean-de-Luz'],
    boat: 'pinasse',
    tagusExtras: false,
    extraPlaces: [{ name: 'Socoa', kind: 'village', lat: 43.3945, lon: -1.6855 }],
  },
  azores: {
    id: 'azores',
    ports: ['Horta', 'Madalena', 'São Roque do Pico', 'Velas'],
    boat: 'baleeiro',
    tagusExtras: false,
    // The harbours (OpenStreetMap places sit inland, in the towns).
    extraPlaces: [
      { name: 'Horta', kind: 'town', lat: 38.531, lon: -28.625 },
      { name: 'Madalena', kind: 'town', lat: 38.536, lon: -28.53 },
      { name: 'São Roque do Pico', kind: 'village', lat: 38.527, lon: -28.319 },
      { name: 'Velas', kind: 'town', lat: 38.681, lon: -28.208 },
    ],
  },
  madeira: {
    id: 'madeira',
    ports: ['Santa Cruz', 'Machico', 'Ponta de São Lourenço', 'Porto da Cruz'],
    boat: 'falua',
    tagusExtras: false,
    extraPlaces: [
      { name: 'Santa Cruz', kind: 'town', lat: 32.687, lon: -16.79 },
      { name: 'Machico', kind: 'town', lat: 32.716, lon: -16.762 },
      { name: 'Ponta de São Lourenço', kind: 'village', lat: 32.744, lon: -16.705 }, // the quay in the Baía d'Abra
      { name: 'Porto da Cruz', kind: 'village', lat: 32.773, lon: -16.826 },
    ],
  },
};
export const AREA_IDS = Object.keys(AREAS) as AreaId[];
/** Areas offered in the menu (Pasaia is hidden for now; ?area=pasaia still opens it). */
export const MENU_AREAS: AreaId[] = AREA_IDS.filter((id) => id !== 'pasaia');

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
export function setArea(id: AreaId, extra: Record<string, string> = {}): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage blocked: only this visit
  }
  const url = new URL(location.href);
  url.searchParams.set('area', id);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  location.href = url.toString();
}
