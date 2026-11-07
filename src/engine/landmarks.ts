// Landmarks of the river, built from simple shapes (no model files):
//   Ponte 25 de Abril   suspension bridge, main span 1013 m, towers 190 m, deck 70 m up
//   Ponte Vasco da Gama low viaduct (12 km) with a cable-stayed span of 420 m, towers 150 m
//   Torre de Belém      the 16th-century tower in the river at Belém
//   Padrão dos Descobrimentos  the 52 m monument to the Discoveries, shaped like a prow
// Bridge routes are the deck lines from OpenStreetMap (tagus.json "bridges"); the rest is
// placed by its latitude and longitude. Sizes are real; details are simplified.
import { Color3, Mesh, MeshBuilder, PBRMaterial, Vector3, type Scene } from '@babylonjs/core';
import type { LandMask } from '../world/landMask';
import type { Terrain } from '../world/terrain';

export interface BridgeLine {
  length: number;
  /** Deck line, world metres [east, north]. */
  points: [number, number][];
}

export interface LandmarkLabel {
  name: string;
  x: number;
  y: number;
  height: number;
}

/** The same projection as scripts/fetch-map.mjs. */
function projector(origin: { lat: number; lon: number }) {
  const mLat = 110574;
  const mLon = 111320 * Math.cos((origin.lat * Math.PI) / 180);
  return (lat: number, lon: number): [number, number] => [(lon - origin.lon) * mLon, (lat - origin.lat) * mLat];
}

/** Physically based, like the boats (a plain material turns white in the bright sun). */
function material(scene: Scene, name: string, hex: string, roughness = 0.85): PBRMaterial {
  const m = new PBRMaterial(name, scene);
  m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
  m.metallic = 0;
  m.roughness = roughness;
  return m;
}

/** A polyline resampled every `step` metres: positions and the distance along it. */
function resample(points: [number, number][], step: number): { x: number; y: number; s: number }[] {
  const out: { x: number; y: number; s: number }[] = [];
  let s = 0;
  for (let i = 0; i + 1 < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = 0; d < len; d += step) out.push({ x: x0 + ((x1 - x0) * d) / len, y: y0 + ((y1 - y0) * d) / len, s: s + d });
    s += len;
  }
  const [lx, ly] = points[points.length - 1];
  out.push({ x: lx, y: ly, s });
  return out;
}

/** The longest stretch of the line over water: [start, end] distances along it. */
function waterCrossing(samples: { x: number; y: number; s: number }[], mask: LandMask): [number, number] {
  let best: [number, number] = [0, 0];
  let start = -1;
  samples.forEach((p, i) => {
    const wet = mask.isWater(p.x, p.y);
    if (wet && start < 0) start = p.s;
    if ((!wet || i === samples.length - 1) && start >= 0) {
      if (p.s - start > best[1] - best[0]) best = [start, p.s];
      start = -1;
    }
  });
  return best;
}

/** Point and direction on the line at distance s. */
function at(samples: { x: number; y: number; s: number }[], s: number): { x: number; y: number; dx: number; dy: number } {
  let i = samples.findIndex((p) => p.s >= s);
  if (i <= 0) i = 1;
  const a = samples[i - 1];
  const b = samples[Math.min(i, samples.length - 1)];
  const len = Math.max(1e-6, b.s - a.s);
  const k = Math.min(1, Math.max(0, (s - a.s) / len));
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: (b.x - a.x) / d, dy: (b.y - a.y) / d };
}

/** A deck: a flat box swept along the line at the given heights. */
function deck(scene: Scene, name: string, pts: { x: number; y: number; h: number }[], width: number, depth: number, mat: PBRMaterial): Mesh {
  const shape = [new Vector3(-width / 2, 0, 0), new Vector3(width / 2, 0, 0), new Vector3(width / 2, -depth, 0), new Vector3(-width / 2, -depth, 0), new Vector3(-width / 2, 0, 0)];
  const path = pts.map((p) => new Vector3(p.x, p.h, p.y));
  const m = MeshBuilder.ExtrudeShape(name, { shape, path, cap: Mesh.CAP_ALL, sideOrientation: Mesh.DOUBLESIDE }, scene);
  m.material = mat;
  m.isPickable = false;
  return m;
}

/** Many copies of one box (piers, tower legs): one mesh, one draw call. */
function boxes(scene: Scene, name: string, items: { x: number; y: number; z: number; w: number; h: number; d: number; rot?: number }[], mat: PBRMaterial): Mesh | null {
  if (!items.length) return null;
  const parts = items.map((it, i) => {
    const b = MeshBuilder.CreateBox(`${name}-${i}`, { width: it.w, height: it.h, depth: it.d }, scene);
    b.position.set(it.x, it.y, it.z);
    b.rotation.y = it.rot ?? 0;
    return b;
  });
  const m = Mesh.MergeMeshes(parts, true, true)!;
  m.name = name;
  m.material = mat;
  m.isPickable = false;
  return m;
}

/** Thin ropes and cables as one line system. */
function lines(scene: Scene, name: string, segments: Vector3[][], color: Color3): Mesh {
  const l = MeshBuilder.CreateLineSystem(name, { lines: segments }, scene);
  l.color = color;
  l.isPickable = false;
  return l;
}

export function createLandmarks(
  scene: Scene,
  mask: LandMask,
  terrain: Terrain | undefined,
  origin: { lat: number; lon: number },
  bridgeLines: Record<string, BridgeLine> = {},
): LandmarkLabel[] {
  const toXY = projector(origin);
  const ground = (x: number, y: number) => (mask.isWater(x, y) ? 0 : Math.max(0, terrain?.heightAt(x, y) ?? 0));
  const labels: LandmarkLabel[] = [];

  // --- Ponte 25 de Abril ------------------------------------------------------------------
  const p25 = bridgeLines['Ponte 25 de Abril'];
  if (p25) {
    const orange = material(scene, 'p25', '#b8432f', 0.6);
    const samples = resample(p25.points, 20);
    const [w0, w1] = waterCrossing(samples, mask);
    const mid = (w0 + w1) / 2;
    const towers = [mid - 506, mid + 506]; // main span 1013 m
    const DECK = 70;
    const TOWER = 190;
    // Deck height: 70 m over the river and the side spans, then down the approach viaducts
    // at about 4 %, ending where it meets the ground.
    const deckPts = samples
      .map((p) => {
        const out = Math.max(0, Math.max(towers[0] - 483 - p.s, p.s - (towers[1] + 483)));
        return { ...p, h: Math.max(ground(p.x, p.y) + 2, DECK - 0.04 * out) };
      })
      .filter((p) => p.h - ground(p.x, p.y) > 3);
    if (deckPts.length > 2) {
      // A deep truss (the bridge has a road above and a railway inside).
      deck(scene, 'p25-deck', deckPts, 24, 9, orange);
      // Piers under the approach viaducts.
      const piers = deckPts
        .filter((p, i) => i % 4 === 0 && (p.s < towers[0] - 483 || p.s > towers[1] + 483))
        .map((p) => {
          const g = ground(p.x, p.y);
          const h = p.h - 9 - g;
          return { x: p.x, y: g + h / 2, z: p.y, w: 6, h, d: 6 };
        })
        .filter((b) => b.h > 1);
      boxes(scene, 'p25-piers', piers, orange);
    }
    // Towers: two legs joined by cross beams.
    const legs: Parameters<typeof boxes>[2] = [];
    for (const s of towers) {
      const c = at(samples, s);
      const rot = Math.atan2(c.dx, c.dy);
      const nx = c.dy;
      const ny = -c.dx; // across the deck
      for (const side of [-1, 1]) legs.push({ x: c.x + nx * side * 14, y: TOWER / 2 - 5, z: c.y + ny * side * 14, w: 7, h: TOWER + 10, d: 9, rot });
      for (const h of [DECK + 10, 120, 160, TOWER - 4]) legs.push({ x: c.x, y: h, z: c.y, w: 30, h: 5, d: 6, rot: rot + Math.PI / 2 });
    }
    boxes(scene, 'p25-towers', legs, orange);
    // Main cables (catenary between the tower tops, down to the deck mid-span) and side
    // spans to the anchorages, with vertical hangers every 25 m.
    const cables: Vector3[][] = [];
    for (const side of [-1, 1]) {
      const cable: Vector3[] = [];
      const point = (s: number, h: number) => {
        const c = at(samples, s);
        return new Vector3(c.x + c.dy * side * 12, h, c.y - c.dx * side * 12);
      };
      const heightAt = (s: number) => {
        if (s >= towers[0] && s <= towers[1]) {
          const t = (s - towers[0]) / (towers[1] - towers[0]);
          return DECK + 4 + (TOWER - DECK - 4) * Math.pow(2 * t - 1, 2);
        }
        const out = s < towers[0] ? towers[0] - s : s - towers[1];
        return TOWER - (TOWER - DECK - 2) * Math.min(1, out / 483);
      };
      for (let s = towers[0] - 483; s <= towers[1] + 483; s += 25) {
        cable.push(point(s, heightAt(s)));
        if (Math.abs(s - towers[0]) > 20 && Math.abs(s - towers[1]) > 20) cables.push([point(s, heightAt(s)), point(s, DECK + 1)]);
      }
      cables.push(cable);
    }
    lines(scene, 'p25-cables', cables, new Color3(0.55, 0.2, 0.14));
    const top = at(samples, towers[0]);
    labels.push({ name: 'Ponte 25 de Abril', x: top.x, y: top.y, height: TOWER + 30 });
  }

  // --- Ponte Vasco da Gama ----------------------------------------------------------------
  const vg = bridgeLines['Ponte Vasco da Gama'];
  if (vg) {
    const concrete = material(scene, 'vg', '#c9c6bd');
    // Start from the Lisbon (north-west) end.
    const pts = vg.points[0][1] > vg.points[vg.points.length - 1][1] ? vg.points : [...vg.points].reverse();
    const samples = resample(pts, 40);
    const [w0] = waterCrossing(samples, mask);
    // The cable-stayed span crosses the main channel near the Lisbon bank.
    const main = w0 + 1400;
    const TOWER = 150;
    const deckH = (s: number) => {
      const d = Math.abs(s - main);
      return 14 + Math.max(0, 40 * (1 - Math.max(0, d - 210) / 1200));
    };
    const deckPts = samples.map((p) => ({ ...p, h: Math.max(ground(p.x, p.y) + 1, deckH(p.s)) })).filter((p) => p.h - ground(p.x, p.y) > 2.5);
    if (deckPts.length > 2) {
      deck(scene, 'vg-deck', deckPts, 30, 3, concrete);
      const piers = deckPts
        .filter((p) => Math.abs(p.s - main) > 220)
        .map((p) => ({ x: p.x, y: (p.h - 3) / 2 - 2, z: p.y, w: 3, h: p.h - 3 + 4, d: 3 }));
      boxes(scene, 'vg-piers', piers, concrete);
    }
    const legs: Parameters<typeof boxes>[2] = [];
    const stays: Vector3[][] = [];
    for (const s of [main - 210, main + 210]) {
      const c = at(samples, s);
      const rot = Math.atan2(c.dx, c.dy);
      for (const side of [-1, 1]) legs.push({ x: c.x + c.dy * side * 16, y: TOWER / 2 - 5, z: c.y - c.dx * side * 16, w: 5, h: TOWER + 10, d: 6, rot });
      legs.push({ x: c.x, y: deckH(s) - 4, z: c.y, w: 34, h: 4, d: 6, rot: rot + Math.PI / 2 });
      legs.push({ x: c.x, y: TOWER - 6, z: c.y, w: 34, h: 4, d: 6, rot: rot + Math.PI / 2 });
      // Fans of stay cables to the deck on both sides of each tower.
      for (const side of [-1, 1]) {
        const topP = new Vector3(c.x + c.dy * side * 16, TOWER - 10, c.y - c.dx * side * 16);
        for (let k = 1; k <= 12; k++) {
          for (const dir of [-1, 1]) {
            const d = at(samples, s + dir * k * 17);
            stays.push([topP, new Vector3(d.x + d.dy * side * 14, deckH(s + dir * k * 17), d.y - d.dx * side * 14)]);
          }
        }
      }
    }
    boxes(scene, 'vg-towers', legs, concrete);
    lines(scene, 'vg-stays', stays, new Color3(0.85, 0.85, 0.82));
    const c = at(samples, main);
    labels.push({ name: 'Ponte Vasco da Gama', x: c.x, y: c.y, height: TOWER + 30 });
  }

  // --- Torre de Belém (16th century, Manueline style): a bastion in the river with a
  // square tower behind it ------------------------------------------------------------------
  const stone = material(scene, 'limestone', '#e3dccb');
  {
    const [x, y] = toXY(38.69157, -9.216);
    const parts: Parameters<typeof boxes>[2] = [
      // Bastion (lower, towards the river, to the south) and the tower (north part).
      { x, y: 4, z: y - 14, w: 30, h: 10, d: 26 },
      { x, y: 10.5, z: y - 14, w: 31, h: 1.2, d: 27 },
      { x, y: 17, z: y + 4, w: 12, h: 34, d: 12 },
      { x, y: 34.5, z: y + 4, w: 13.5, h: 1.2, d: 13.5 },
    ];
    // Corner watchtowers (turrets) on the bastion and the tower.
    for (const [dx, dz] of [[-14, -26], [14, -26], [-14, -2], [14, -2]]) parts.push({ x: x + dx, y: 12.5, z: y + dz, w: 2.6, h: 5, d: 2.6 });
    for (const [dx, dz] of [[-6, -2], [6, -2], [-6, 10], [6, 10]]) parts.push({ x: x + dx, y: 37, z: y + dz, w: 2.2, h: 4, d: 2.2 });
    // Battlements along the bastion's edge.
    for (let k = -12; k <= 12; k += 3) parts.push({ x: x + k, y: 11.8, z: y - 27, w: 1.4, h: 1.5, d: 0.8 });
    boxes(scene, 'torre-belem', parts, stone);
    labels.push({ name: 'Torre de Belém', x, y, height: 60 });
  }

  // --- Padrão dos Descobrimentos (1960): a 52 m slab with the cross-sword, its prow facing
  // the river and the navigators on ramps up both sides ---------------------------------------
  {
    const [x, y] = toXY(38.69361, -9.20573);
    const parts: Parameters<typeof boxes>[2] = [
      { x, y: 1.5, z: y, w: 46, h: 3, d: 30 }, // platform
      { x, y: 26, z: y + 6, w: 20, h: 52, d: 7 }, // the tall slab (north)
      { x, y: 46, z: y + 9.8, w: 3, h: 12, d: 1 }, // sword hilt (on the land side)
      { x, y: 44, z: y + 9.8, w: 10, h: 2, d: 1 },
    ];
    // Prow: a wedge pointing south, rising towards the slab, carrying the figures.
    for (let k = 0; k < 8; k++) {
      const h = 6 + k * 4.5;
      parts.push({ x, y: h / 2 + 3, z: y - 14 + k * 2.6, w: 14 - k * 0.4, h, d: 2.6 });
      // Navigators: two rows of statues stepping up the ramps.
      for (const side of [-1, 1]) parts.push({ x: x + side * (5 - k * 0.3), y: h + 4.5, z: y - 14 + k * 2.6, w: 1.6, h: 3.4, d: 1.6 });
    }
    boxes(scene, 'padrao', parts, stone);
    labels.push({ name: 'Padrão dos Descobrimentos', x, y, height: 80 });
  }

  return labels;
}
