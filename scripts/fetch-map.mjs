#!/usr/bin/env node
// Build the land/water map of the Tagus estuary from OpenStreetMap.
//
//   node scripts/fetch-map.mjs                 # download from the Overpass API
//   node scripts/fetch-map.mjs --input osm.json # use a saved Overpass response
//
// Output (committed to the repo, so the game never calls OpenStreetMap):
//   src/assets/map/tagus-mask.png  R = water (255) / land (0), slightly blurred for smooth shores
//                                  G = the same, blurred wide (used to colour beaches inland)
//   src/assets/map/tagus.json      grid size, origin, place names, sea marks (buoys and
//                                  beacons, as shown on OpenSeaMap)
//
// How: draw the coastline into a grid, flood-fill the sea from a point in the river,
// then add lakes and rivers (natural=water). Data © OpenStreetMap contributors (ODbL).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// --- Area: the Tagus from Vila Franca de Xira to the sea, the coast from Cascais (and the
// Sintra coast) round to Cabo Espichel and Sesimbra ----------------------------------------
const BBOX = { south: 38.38, west: -9.5, north: 38.99, east: -8.85 };
/** Local origin (and flood-fill seed): mid-river between Terreiro do Paço and Barreiro. */
const ORIGIN = { lat: 38.685, lon: -9.1 };
// 20 m cells keep the mask under 4096 px a side (the most phones can load as a texture).
const CELL = 20; // metres
const OUT_DIR = new URL('../src/assets/map/', import.meta.url);

const PLACES_WANTED = /^(city|town|village|hamlet|island|islet)$/;
/** Landmark bridges: their deck lines are saved for drawing. */
const BRIDGES = /^Ponte (25 de Abril|Vasco da Gama)$/;
/** Must be land / water, or the data is wrong (checked after building the grid). */
const CHECKS = {
  land: {
    Moita: [38.6507, -8.9905], Montijo: [38.7067, -8.9739], Barreiro: [38.6631, -9.0724], Lisboa: [38.7139, -9.1394], Alcochete: [38.7553, -8.9608],
    Cascais: [38.6979, -9.4215], Sesimbra: [38.4445, -9.1015], 'Vila Franca de Xira': [38.9553, -8.9897], Sintra: [38.8, -9.38],
  },
  water: {
    origin: [ORIGIN.lat, ORIGIN.lon], 'Montijo channel': [38.695, -9.05], 'off Seixal': [38.655, -9.1],
    'off Cascais': [38.68, -9.42], 'off Cabo Espichel': [38.4, -9.23], 'Sesimbra bay': [38.43, -9.1],
  },
};

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

// --- Projection: metres east / north of the origin ------------------------------------
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
const toXY = (lat, lon) => [(lon - ORIGIN.lon) * M_PER_DEG_LON, (lat - ORIGIN.lat) * M_PER_DEG_LAT];

const [minX, minY] = toXY(BBOX.south, BBOX.west);
const [maxX, maxY] = toXY(BBOX.north, BBOX.east);
const W = Math.ceil((maxX - minX) / CELL);
const H = Math.ceil((maxY - minY) / CELL);
// Grid row 0 is the NORTH edge (like an image).
const toCell = (lat, lon) => {
  const [x, y] = toXY(lat, lon);
  return [(x - minX) / CELL, (maxY - y) / CELL];
};

async function download() {
  const b = `${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
  const query = `[out:json][timeout:240];
(
  way["natural"="coastline"](${b});
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["waterway"="riverbank"](${b});
  relation["waterway"="riverbank"](${b});
  node["place"](${b});
  way["place"~"island|islet"]["name"](${b});
  relation["place"~"island|islet"]["name"](${b});
  node["seamark:type"](${b});
  node["natural"="cape"]["name"](${b});
  way["highway"]["bridge"]["name"~"^Ponte (25 de Abril|Vasco da Gama)$"](${b});
);
out geom;`;
  for (const url of OVERPASS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Overpass: ${url} (attempt ${attempt})`);
        const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'fragateiro-map-builder (github.com/TagusNavyVirtualMuseum/fragateiro)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        console.warn(`  failed: ${e.message}`);
        await new Promise((r) => setTimeout(r, 5000 * attempt));
      }
    }
  }
  throw new Error('All Overpass servers failed');
}

// --- Rasterisation ----------------------------------------------------------------------
const UNKNOWN = 0, BARRIER = 1, WATER = 2;
const grid = new Uint8Array(W * H);

function line(x0, y0, x1, y1) {
  // 8-connected Bresenham; with a 4-connected flood fill the water cannot leak through.
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 >= 0 && y0 >= 0 && x0 < W && y0 < H) grid[y0 * W + x0] = BARRIER;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function floodFill(cx, cy) {
  const stack = [cy * W + cx];
  let filled = 0;
  while (stack.length) {
    const i = stack.pop();
    if (grid[i] !== UNKNOWN) continue;
    grid[i] = WATER;
    filled++;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  return filled;
}

/** Even-odd scanline fill of a set of closed rings (works for multipolygons with holes). */
function fillRings(rings) {
  const edges = [];
  for (const ring of rings) for (let i = 0; i + 1 < ring.length; i++) edges.push([ring[i], ring[i + 1]]);
  let y0 = Infinity, y1 = -Infinity;
  for (const r of rings) for (const p of r) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
    const yc = y + 0.5;
    const xs = [];
    for (const [a, b] of edges) {
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) grid[y * W + x] = WATER;
    }
  }
}

const geomToCells = (geometry) => geometry.map((p) => toCell(p.lat, p.lon));

/** Join open member ways of a relation into closed rings. */
function joinRings(ways) {
  const open = ways.filter((w) => w.length > 1).map((w) => [...w]);
  const rings = [];
  const same = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
  while (open.length) {
    let ring = open.pop();
    let grown = true;
    while (!same(ring[0], ring[ring.length - 1]) && grown) {
      grown = false;
      for (let i = 0; i < open.length; i++) {
        const w = open[i];
        const end = ring[ring.length - 1];
        if (same(w[0], end)) ring = ring.concat(w.slice(1));
        else if (same(w[w.length - 1], end)) ring = ring.concat([...w].reverse().slice(1));
        else continue;
        open.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (same(ring[0], ring[ring.length - 1])) rings.push(ring);
  }
  return rings;
}

// --- Main ---------------------------------------------------------------------------------
const args = process.argv.slice(2);
const inputIdx = args.indexOf('--input');
const osm = inputIdx >= 0 ? JSON.parse(readFileSync(args[inputIdx + 1], 'utf8')) : await download();
const elements = osm.elements ?? [];
console.log(`${elements.length} OSM elements, grid ${W} x ${H} cells of ${CELL} m`);

let coast = 0;
for (const el of elements) {
  if (el.type === 'way' && el.tags?.natural === 'coastline' && el.geometry) {
    const c = geomToCells(el.geometry);
    for (let i = 0; i + 1 < c.length; i++) line(c[i][0], c[i][1], c[i + 1][0], c[i + 1][1]);
    coast++;
  }
}
console.log(`coastline ways: ${coast}`);
// --seed lat,lon overrides the flood-fill start (only useful for testing with other data).
const seedIdx = args.indexOf('--seed');
const seed = seedIdx >= 0 ? args[seedIdx + 1].split(',').map(Number) : [ORIGIN.lat, ORIGIN.lon];
const [sx, sy] = toCell(seed[0], seed[1]).map(Math.floor);
const sea = floodFill(sx, sy);
console.log(`sea cells: ${sea} (${((100 * sea) / (W * H)).toFixed(1)} %)`);

let lakes = 0;
for (const el of elements) {
  const t = el.tags ?? {};
  if (!(t.natural === 'water' || t.waterway === 'riverbank')) continue;
  if (el.type === 'way' && el.geometry) {
    const c = geomToCells(el.geometry);
    if (c.length > 3) { fillRings([c]); lakes++; }
  } else if (el.type === 'relation' && el.members) {
    const ways = el.members.filter((m) => m.type === 'way' && m.geometry).map((m) => geomToCells(m.geometry));
    const rings = joinRings(ways);
    if (rings.length) { fillRings(rings); lakes++; }
  }
}
console.log(`water areas: ${lakes}`);

// Shoreline cells count as land; everything not water is land.
const water = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) water[i] = grid[i] === WATER ? 255 : 0;

// --- Sanity checks --------------------------------------------------------------------------
const isWaterAt = (lat, lon) => {
  const [x, y] = toCell(lat, lon).map(Math.floor);
  return water[y * W + x] > 0;
};
const problems = [];
// Upriver, where the river is a water area rather than coastline: report only (for now).
for (const [name, [lat, lon]] of Object.entries({ 'Tagus off Alhandra': [38.9, -9.03], 'Tagus off Póvoa': [38.86, -9.05], 'Tagus at Vila Franca': [38.955, -8.985] })) {
  console.log(`${name}: ${isWaterAt(lat, lon) ? 'water' : 'LAND'}`);
}
for (const [name, [lat, lon]] of Object.entries(CHECKS.land)) if (isWaterAt(lat, lon)) problems.push(`${name} should be land`);
for (const [name, [lat, lon]] of Object.entries(CHECKS.water)) if (!isWaterAt(lat, lon)) problems.push(`${name} should be water`);
const waterShare = water.reduce((s, v) => s + (v ? 1 : 0), 0) / (W * H);
console.log(`water share: ${(100 * waterShare).toFixed(1)} %`);
if (waterShare > 0.8) problems.push('almost everything is water: the coastline is probably not closed around the estuary');
if (problems.length && !args.includes('--no-checks')) {
  console.error('Map checks failed:\n  ' + problems.join('\n  '));
  process.exit(1);
}

// --- Smooth and write ---------------------------------------------------------------------------
function blur(src, radius) {
  // Separable box blur.
  const tmp = new Float32Array(W * H), out = new Uint8Array(W * H), n = 2 * radius + 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += src[y * W + Math.min(W - 1, Math.max(0, x + k))];
    tmp[y * W + x] = s / n;
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -radius; k <= radius; k++) s += tmp[Math.min(H - 1, Math.max(0, y + k)) * W + x];
    out[y * W + x] = Math.round(s / n);
  }
  return out;
}
const sharp = blur(water, 1);
const wide = blur(blur(water, 2), 2);

function png(width, height, rgb) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const rgb = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) { rgb[i * 3] = sharp[i]; rgb[i * 3 + 1] = wide[i]; rgb[i * 3 + 2] = 0; }

const places = [];
for (const el of elements) {
  // Capes (Cabo Espichel) count as places too.
  const kind = el.tags?.natural === 'cape' ? 'cape' : el.tags?.place;
  if (!el.tags?.name || !(kind === 'cape' || PLACES_WANTED.test(kind ?? ''))) continue;
  // Towns are points; islands are usually outlines (use the middle of their points).
  let lat = el.lat;
  let lon = el.lon;
  const pts = el.geometry ?? el.members?.flatMap((m) => m.geometry ?? []) ?? [];
  if (lat === undefined && pts.length) {
    lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
    lon = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
  }
  if (lat === undefined) continue;
  const [x, y] = toXY(lat, lon);
  places.push({ name: el.tags.name, kind, x: Math.round(x), y: Math.round(y) });
}
places.sort((a, b) => a.name.localeCompare(b.name));

// Sea marks (the OpenSeaMap layer is drawn from these OpenStreetMap tags).
const seamarks = [];
for (const el of elements) {
  const t = el.tags ?? {};
  const type = t['seamark:type'];
  if (el.type !== 'node' || !type || !/buoy|beacon|light/.test(type)) continue;
  const colour = t[`seamark:${type}:colour`] ?? t['seamark:light:colour'] ?? '';
  const category = t[`seamark:${type}:category`] ?? '';
  const [x, y] = toXY(el.lat, el.lon);
  seamarks.push({ type, category, colour, name: t['seamark:name'] ?? t.name ?? '', x: Math.round(x), y: Math.round(y) });
}
console.log(`sea marks: ${seamarks.length}`);

// Bridges: the longest road on each (its deck line), in world metres.
const bridges = {};
for (const el of elements) {
  const name = el.tags?.name;
  if (el.type !== 'way' || !el.tags?.highway || !BRIDGES.test(name ?? '') || !el.geometry) continue;
  const pts = el.geometry.map((g) => toXY(g.lat, g.lon).map((v) => Math.round(v)));
  const length = pts.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0), 0);
  if (!bridges[name] || bridges[name].length < length) bridges[name] = { length: Math.round(length), points: pts };
}
console.log(`bridges: ${Object.entries(bridges).map(([n, b]) => `${n} ${b.length} m`).join(', ') || 'none'}`);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(new URL('tagus-mask.png', OUT_DIR), png(W, H, rgb));
writeFileSync(
  new URL('tagus.json', OUT_DIR),
  JSON.stringify(
    {
      source: 'OpenStreetMap contributors (ODbL), via the Overpass API',
      built: new Date().toISOString().slice(0, 10),
      bbox: BBOX,
      origin: ORIGIN,
      cellSize: CELL,
      width: W,
      height: H,
      /** World position (metres east, north of the origin) of the mask's north-west corner. */
      northWest: { x: Number(minX.toFixed(2)), y: Number(maxY.toFixed(2)) },
      places,
      seamarks,
      bridges,
    },
    null,
    2,
  ) + '\n',
);
console.log(`wrote tagus-mask.png (${W} x ${H}) and tagus.json with ${places.length} places and ${seamarks.length} sea marks`);
