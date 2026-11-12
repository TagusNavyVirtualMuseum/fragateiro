#!/usr/bin/env node
// Add every lighthouse (OpenStreetMap man_made=lighthouse) of a sailing area to its map file,
// src/assets/map/<file>.json, as "lighthouses": name, position, height and colours. The game
// draws a tower for each one it has no hand-made model for (src/engine/lighthouses.ts).
//
//   node scripts/fetch-lighthouses.mjs --area tejo
//   node scripts/fetch-lighthouses.mjs --all
//
// Run it after fetch-map.mjs (which rewrites the file). Data © OpenStreetMap contributors (ODbL).
import { readFileSync, writeFileSync } from 'node:fs';
import { AREAS } from './map-areas.mjs';

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

const args = process.argv.slice(2);
const ids = args.includes('--all') ? Object.keys(AREAS) : args.filter((a, i) => args[i - 1] === '--area');
if (!ids.length) {
  console.error('usage: node scripts/fetch-lighthouses.mjs --area <id> [--area <id>…] | --all');
  process.exit(1);
}

async function query(bbox) {
  const b = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const q = `[out:json][timeout:60];nwr["man_made"="lighthouse"](${b});out center tags;`;
  for (const url of OVERPASS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), headers: { 'User-Agent': 'fragateiro-map-builder (github.com/TagusNavyVirtualMuseum/fragateiro)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()).elements;
      } catch (e) {
        console.warn(`  ${url} failed: ${e.message}`);
        await new Promise((r) => setTimeout(r, 4000 * attempt));
      }
    }
  }
  throw new Error('Overpass unreachable');
}

/** A height in metres from tags such as "28", "28 m", "28.5". */
const metres = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 120 ? n : undefined;
};

for (const id of ids) {
  const area = AREAS[id];
  const file = new URL(`../src/assets/map/${area.file}.json`, import.meta.url);
  let meta;
  try {
    meta = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.warn(`${id}: no map file yet (run fetch-map.mjs first)`);
    continue;
  }
  const mLon = 111320 * Math.cos((meta.origin.lat * Math.PI) / 180);
  const toXY = (lat, lon) => [Math.round((lon - meta.origin.lon) * mLon), Math.round((lat - meta.origin.lat) * 110574)];
  const els = await query(area.bbox);
  const out = [];
  for (const el of els) {
    const t = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined) continue;
    const [x, y] = toXY(lat, lon);
    const colour = t['seamark:landmark:colour'] ?? t['building:colour'] ?? t.colour ?? t['seamark:lighthouse:colour'] ?? '';
    out.push({
      name: t.name ?? t['seamark:name'] ?? '',
      x,
      y,
      ...(metres(t.height) ? { height: metres(t.height) } : {}),
      colours: colour ? colour.split(/[;,]/).map((c) => c.trim().toLowerCase()) : [],
      pattern: t['seamark:landmark:colour_pattern'] ?? '',
    });
  }
  out.sort((a, b) => a.name.localeCompare(b.name) || a.x - b.x);
  meta.lighthouses = out;
  writeFileSync(file, JSON.stringify(meta, null, 2) + '\n');
  console.log(`${id}: ${out.length} lighthouses: ${out.map((l) => l.name || '(no name)').join(', ')}`);
}
