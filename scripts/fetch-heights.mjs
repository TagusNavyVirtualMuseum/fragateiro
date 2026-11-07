// Land heights for the estuary map, from the Copernicus GLO-30 elevation model (30 m,
// © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under
// COPERNICUS by the European Union and ESA; free to use).
//
//   npm install --no-save geotiff@3.0.5
//   node scripts/fetch-heights.mjs
//
// Reads the map grid from src/assets/map/tagus.json (written by fetch-map.mjs), samples the
// elevation at the centre of every 40 m cell and writes:
//   src/assets/map/tagus-height.png   height = (R * 256 + G) * 0.1 - 100 metres
//   tagus.json "heights"              grid size, cell size and how to decode
// The model is a surface model: towns and woods add their height, which reads well from
// the river. Over water it is not used (the land is cut out there).

import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fromArrayBuffer } from 'geotiff';

const OUT_DIR = new URL('../src/assets/map/', import.meta.url);
// 40 m keeps the image small for the whole area (the source is 30 m).
const CELL = 40; // m
const SCALE = 0.1; // m per step
const OFFSET = -100; // m

const meta = JSON.parse(readFileSync(new URL('tagus.json', OUT_DIR), 'utf8'));
const { origin, northWest, cellSize } = meta;
// The same projection as fetch-map.mjs.
const M_PER_DEG_LAT = 110574;
const M_PER_DEG_LON = 111320 * Math.cos((origin.lat * Math.PI) / 180);
const toLatLon = (x, y) => [origin.lat + y / M_PER_DEG_LAT, origin.lon + x / M_PER_DEG_LON];

const W = Math.ceil((meta.width * cellSize) / CELL);
const H = Math.ceil((meta.height * cellSize) / CELL);

// --- The 1° tiles that cover the map ------------------------------------------------------
const tileName = (lat, lon) => {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  const la = String(Math.abs(Math.floor(lat))).padStart(2, '0');
  const lo = String(Math.abs(Math.floor(lon))).padStart(3, '0');
  return `Copernicus_DSM_COG_10_${ns}${la}_00_${ew}${lo}_00_DEM`;
};
const { bbox } = meta;
const tiles = new Map();
for (const lat of [bbox.south, bbox.north])
  for (const lon of [bbox.west, bbox.east]) tiles.set(tileName(lat, lon), null);

for (const name of tiles.keys()) {
  const url = `https://copernicus-dem-30m.s3.amazonaws.com/${name}/${name}.tif`;
  console.log(`downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const tiff = await fromArrayBuffer(await res.arrayBuffer());
  const image = await tiff.getImage();
  const [west, south, east, north] = image.getBoundingBox();
  const w = image.getWidth();
  const h = image.getHeight();
  const [data] = await image.readRasters();
  tiles.set(name, { west, south, east, north, w, h, data });
}

/** Elevation at a point, bilinear between the four nearest samples. */
function elevation(lat, lon) {
  const t = tiles.get(tileName(lat, lon));
  const fx = ((lon - t.west) / (t.east - t.west)) * t.w - 0.5;
  const fy = ((t.north - lat) / (t.north - t.south)) * t.h - 0.5;
  const x0 = Math.max(0, Math.min(t.w - 2, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(t.h - 2, Math.floor(fy)));
  const ax = Math.min(1, Math.max(0, fx - x0));
  const ay = Math.min(1, Math.max(0, fy - y0));
  const v = (x, y) => t.data[y * t.w + x];
  const top = v(x0, y0) * (1 - ax) + v(x0 + 1, y0) * ax;
  const bottom = v(x0, y0 + 1) * (1 - ax) + v(x0 + 1, y0 + 1) * ax;
  return top * (1 - ay) + bottom * ay;
}

// --- Sample the grid and write the image ---------------------------------------------------
const rgb = Buffer.alloc(W * H * 3);
let max = -Infinity;
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    const x = northWest.x + (i + 0.5) * CELL;
    const y = northWest.y - (j + 0.5) * CELL;
    const e = elevation(...toLatLon(x, y));
    max = Math.max(max, e);
    const v = Math.max(0, Math.min(65535, Math.round((e - OFFSET) / SCALE)));
    const o = (j * W + i) * 3;
    rgb[o] = v >> 8;
    rgb[o + 1] = v & 255;
  }
}

function png(width, height, data) {
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
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type), body]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

writeFileSync(new URL('tagus-height.png', OUT_DIR), png(W, H, rgb));
meta.heights = {
  source: 'Copernicus GLO-30 DEM (© DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA)',
  cellSize: CELL,
  width: W,
  height: H,
  scale: SCALE,
  offset: OFFSET,
};
writeFileSync(new URL('tagus.json', OUT_DIR), JSON.stringify(meta, null, 2) + '\n');
console.log(`wrote tagus-height.png (${W} x ${H}), highest point ${max.toFixed(0)} m`);
