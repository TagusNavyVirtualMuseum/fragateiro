// Places the boat can be moved to (teleport), each with a mooring spot in open water.
import { LandMask, hullAfloat } from './landMask';

export const DESTINATION_NAMES = [
  // The coast, from the west
  'Cascais', 'Oeiras', 'Trafaria', 'Cabo Espichel', 'Sesimbra', 'Setúbal',
  // The estuary
  'Lisboa', 'Almada', 'Alfeite', 'Seixal', 'Amora', 'Barreiro', 'Alhos Vedros', 'Moita', 'Sarilhos Pequenos', 'Montijo', 'Ilha do Rato', 'Alcochete',
  // Upriver
  'Sacavém', 'Alverca do Ribatejo', 'Vila Franca de Xira',
];

/**
 * Places that are not named towns in OpenStreetMap, added by their latitude and longitude
 * (the Lisbon naval base at Alfeite).
 */
export const EXTRA_PLACES: { name: string; kind: string; lat: number; lon: number }[] = [{ name: 'Alfeite', kind: 'village', lat: 38.6575, lon: -9.1335 }];

/** Add places (EXTRA_PLACES for the Tagus) to the map's places (once), with the projection of scripts/fetch-map.mjs. */
export function addExtraPlaces(
  meta: { origin: { lat: number; lon: number }; places: { name: string; kind: string; x: number; y: number }[] },
  extra: { name: string; kind: string; lat: number; lon: number }[] = EXTRA_PLACES,
): void {
  const mLon = 111320 * Math.cos((meta.origin.lat * Math.PI) / 180);
  for (const p of extra) {
    if (meta.places.some((q) => q.name === p.name)) continue;
    meta.places.push({ name: p.name, kind: p.kind, x: Math.round((p.lon - meta.origin.lon) * mLon), y: Math.round((p.lat - meta.origin.lat) * 110574) });
  }
}

export interface Destination {
  name: string;
  /** The town itself (for labels), world metres. */
  town: { x: number; y: number };
  /** Where the boat is placed, and its heading (rad), bow towards open water. */
  x: number;
  y: number;
  heading: number;
}

/** How far one can sail from (x, y) in a direction before reaching land (capped). */
export function freeRun(mask: LandMask, x: number, y: number, heading: number, max = 600): number {
  const sx = Math.sin(heading);
  const sy = Math.cos(heading);
  for (let d = 10; d <= max; d += 10) if (!mask.isReachable(x + sx * d, y + sy * d)) return d;
  return max;
}

/**
 * Mooring spot for a town: the nearest reachable water, then moved out until a boat of
 * `boatLength` fits, facing the most open direction.
 */
export function mooring(mask: LandMask, town: { x: number; y: number }, boatLength: number): { x: number; y: number; heading: number } {
  let p = mask.nearestWater(town.x, town.y, 4000, (a, b) => mask.isReachable(a, b));
  // Direction from the town out to the water: point the bow that way when it is open.
  const away = Math.atan2(p.x - town.x, p.y - town.y);
  let heading = away;
  for (let attempt = 0; attempt < 30; attempt++) {
    let best = -Infinity;
    for (let k = 0; k < 24; k++) {
      const h = (2 * Math.PI * k) / 24;
      const score = freeRun(mask, p.x, p.y, h) + 250 * Math.cos(h - away);
      if (score > best) {
        best = score;
        heading = h;
      }
    }
    if (hullAfloat(mask, p.x, p.y, heading, boatLength * 1.5)) break;
    p = { x: p.x + Math.sin(heading) * 10, y: p.y + Math.cos(heading) * 10 };
  }
  return { ...p, heading };
}

export function findDestinations(mask: LandMask, boatLength = 16, names = DESTINATION_NAMES): Destination[] {
  const out: Destination[] = [];
  for (const name of names) {
    const place = mask.meta.places.find((p) => p.name === name);
    if (!place) continue;
    out.push({ name, town: { x: place.x, y: place.y }, ...mooring(mask, place, boatLength) });
  }
  return out;
}

/**
 * A heading for leaving a mooring that is not straight into the wind (where a boat cannot
 * sail or steer): keeps `heading` if it is fine, otherwise the most open heading 70-110°
 * off the wind that leaves room for the hull.
 */
export function sailableHeading(mask: LandMask, x: number, y: number, heading: number, windFrom: number, boatLength: number): number {
  const off = (h: number) => Math.abs(Math.atan2(Math.sin(h - windFrom), Math.cos(h - windFrom)));
  if (off(heading) > (60 * Math.PI) / 180) return heading;
  let best = heading;
  let bestRun = -1;
  for (const deg of [70, 80, 90, 100, 110, -70, -80, -90, -100, -110]) {
    const h = windFrom + (deg * Math.PI) / 180;
    if (!hullAfloat(mask, x, y, h, boatLength)) continue;
    const run = freeRun(mask, x, y, h);
    if (run > bestRun) {
      bestRun = run;
      best = h;
    }
  }
  return bestRun >= 60 ? best : heading;
}
