// The castle of Almourol, on its rocky island in the middle of the Tagus between Tancos and
// Praia do Ribatejo: a Templar castle of 1171, an irregular curtain wall with nine round
// towers following the rock, and the tall square keep in the middle. Built from simple
// shapes at its OpenStreetMap position; sizes are about real, details simplified.
import { Mesh, MeshBuilder, type Scene } from '@babylonjs/core';
import type { LandMask } from '../world/landMask';
import type { Terrain } from '../world/terrain';
import { boxes, material, merged, projector, type LandmarkLabel } from './landmarks';

export function createMedioLandmarks(scene: Scene, mask: LandMask, terrain: Terrain | undefined, origin: { lat: number; lon: number }): LandmarkLabel[] {
  const toXY = projector(origin);
  const ground = (x: number, y: number) => (mask.isWater(x, y) ? 0 : Math.max(0, terrain?.heightAt(x, y) ?? 0));
  const stone = material(scene, 'almourol-stone', '#cbbf9f');
  const rock = material(scene, 'almourol-rock', '#7d7466');
  const [cx, cy] = toXY(39.46198, -8.3845);
  // The rock rises a few metres out of the water; the castle stands on it.
  const g = Math.max(ground(cx, cy), 6);
  const base = MeshBuilder.CreateCylinder('almourol-rock', { height: g + 2, diameterTop: 46, diameterBottom: 70, tessellation: 14 }, scene);
  base.scaling.z = 0.55;
  base.position.set(cx, (g + 2) / 2 - 2, cy);
  merged('almourol-rock', [base], rock);

  // The curtain wall: an irregular ring of towers (local metres, x along the island).
  const ring: [number, number][] = [
    [-24, -4], [-16, -9], [-4, -10], [8, -9], [20, -6], [25, 1], [16, 8], [2, 9], [-14, 7], [-22, 3],
  ];
  const H = 9;
  const parts: Mesh[] = [];
  const merlons: Parameters<typeof boxes>[2] = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, az] = ring[i];
    const [bx, bz] = ring[(i + 1) % ring.length];
    const len = Math.hypot(bx - ax, bz - az);
    const rot = Math.atan2(bx - ax, bz - az);
    const wall = MeshBuilder.CreateBox('almourol-wall', { width: 1.6, height: H, depth: len }, scene);
    wall.position.set(cx + (ax + bx) / 2, g + H / 2, cy + (az + bz) / 2);
    wall.rotation.y = rot;
    parts.push(wall);
    for (let d = 1; d < len - 0.5; d += 1.6) {
      merlons.push({ x: cx + ax + ((bx - ax) * d) / len, y: g + H + 0.5, z: cy + az + ((bz - az) * d) / len, w: 1.7, h: 1, d: 0.8, rot });
    }
    // A round tower at each corner.
    const tower = MeshBuilder.CreateCylinder('almourol-tower', { height: H + 2.5, diameter: 4.4, tessellation: 14 }, scene);
    tower.position.set(cx + ax, g + (H + 2.5) / 2, cy + az);
    parts.push(tower);
  }
  // The keep: a tall square tower with its own battlements.
  const K = 22;
  const keep = MeshBuilder.CreateBox('almourol-keep', { width: 8, height: K, depth: 8 }, scene);
  keep.position.set(cx + 4, g + K / 2, cy);
  parts.push(keep);
  for (let k = 0; k < 4; k++) {
    for (let j = -1; j <= 1; j++) {
      const side = [
        [j * 2.6, 4],
        [j * 2.6, -4],
        [4, j * 2.6],
        [-4, j * 2.6],
      ][k];
      merlons.push({ x: cx + 4 + side[0], y: g + K + 0.6, z: cy + side[1], w: 1.4, h: 1.2, d: 1.4 });
    }
  }
  merged('almourol-castle', parts, stone);
  boxes(scene, 'almourol-merlons', merlons, stone);
  return [{ name: 'Castelo de Almourol', x: cx, y: cy, height: g + K + 25 }];
}
