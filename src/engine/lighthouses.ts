// Every lighthouse of the area (OpenStreetMap man_made=lighthouse, in the map file's
// "lighthouses", from scripts/fetch-lighthouses.mjs), drawn as a round tower with its lantern:
// its real height when the data has one, in its colours (bands when it has two). Those with a
// hand-made model (landmarks*.ts) are left out.
import { Color3, MeshBuilder, type Mesh, type Scene } from '@babylonjs/core';
import type { LandMask } from '../world/landMask';
import type { Terrain } from '../world/terrain';
import { material, merged, type LandmarkLabel } from './landmarks';

export interface LighthouseInfo {
  name: string;
  /** World metres east, north of the map's origin. */
  x: number;
  y: number;
  /** Tower height, m (when OpenStreetMap has it). */
  height?: number;
  /** Its colours, e.g. ["white", "red"]. */
  colours: string[];
  /** "horizontal" for bands. */
  pattern: string;
}

const HEX: Record<string, string> = {
  white: '#efece4',
  red: '#b3332a',
  black: '#2a2a2a',
  yellow: '#e2b13c',
  green: '#2e7d4a',
  grey: '#9a9a9a',
  gray: '#9a9a9a',
  blue: '#2c4f9e',
  brown: '#7a5a3a',
  orange: '#d9732b',
};

/** A lighthouse closer than this to a hand-made landmark is that landmark, m. */
const SAME_PLACE = 300;

export function createLighthouses(scene: Scene, mask: LandMask, terrain: Terrain | undefined, list: LighthouseInfo[], taken: { x: number; y: number }[]): LandmarkLabel[] {
  const ground = (x: number, y: number) => (mask.isWater(x, y) ? 0 : Math.max(0, terrain?.heightAt(x, y) ?? 0));
  const labels: LandmarkLabel[] = [];
  const pieces = new Map<string, Mesh[]>();
  const add = (colour: string, m: Mesh) => {
    const key = HEX[colour] ? colour : 'white';
    if (!pieces.has(key)) pieces.set(key, []);
    pieces.get(key)!.push(m);
  };
  const glass: Mesh[] = [];
  const domes: Mesh[] = [];
  for (const l of list) {
    if (taken.some((t) => Math.hypot(t.x - l.x, t.y - l.y) < SAME_PLACE)) continue;
    const g = ground(l.x, l.y);
    const h = l.height ?? 14;
    const d = Math.min(7, Math.max(2.2, h * 0.2));
    const colours = l.colours.length ? l.colours : ['white'];
    // Two colours or more in horizontal bands; otherwise the first colour all the way up.
    const bands = colours.length > 1 && l.pattern !== 'vertical' ? Math.max(3, Math.round(h / 4)) : 1;
    for (let k = 0; k < bands; k++) {
      const bh = h / bands;
      const taper = (z: number) => d * (1 - 0.25 * (z / h));
      const band = MeshBuilder.CreateCylinder('lighthouse', { height: bh, diameterBottom: taper(k * bh), diameterTop: taper((k + 1) * bh), tessellation: 14 }, scene);
      band.position.set(l.x, g + bh * (k + 0.5), l.y);
      add(colours[k % colours.length], band);
    }
    // The gallery, the glass lantern and its dome.
    const top = g + h;
    const lw = d * 0.75;
    const gallery = MeshBuilder.CreateCylinder('lighthouse-gallery', { height: 0.4, diameter: lw * 1.5, tessellation: 14 }, scene);
    gallery.position.set(l.x, top + 0.2, l.y);
    add('white', gallery);
    const lantern = MeshBuilder.CreateCylinder('lighthouse-lantern', { height: lw * 0.9, diameter: lw, tessellation: 12 }, scene);
    lantern.position.set(l.x, top + 0.4 + lw * 0.45, l.y);
    glass.push(lantern);
    const cap = MeshBuilder.CreateCylinder('lighthouse-dome', { height: lw * 0.5, diameterTop: 0.15, diameterBottom: lw * 1.1, tessellation: 12 }, scene);
    cap.position.set(l.x, top + 0.4 + lw * 0.9 + lw * 0.25, l.y);
    domes.push(cap);
    // The keepers' house beside a tall tower.
    if (h >= 12) {
      const house = MeshBuilder.CreateBox('lighthouse-house', { width: 10, height: 4.5, depth: 7 }, scene);
      house.position.set(l.x + d / 2 + 5, g + 2.25, l.y);
      add('white', house);
    }
    if (l.name) labels.push({ name: l.name, x: l.x, y: l.y, height: top + 25 });
  }
  for (const [colour, list] of pieces) merged(`lighthouses-${colour}`, list, material(scene, `lighthouse-${colour}`, HEX[colour], 0.6));
  if (glass.length) {
    const lantern = material(scene, 'lighthouse-glass', '#2f3b40', 0.2);
    lantern.emissiveColor = new Color3(0.9, 0.75, 0.35);
    merged('lighthouse-lanterns', glass, lantern);
    merged('lighthouse-domes', domes, material(scene, 'lighthouse-dome', '#8e2b22', 0.5));
  }
  return labels;
}
