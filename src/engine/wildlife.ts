// Rare visitors: bottlenose dolphins in the lower Tagus (from the sea up to Lisbon) and orcas
// on the open Atlantic coast. About once every five minutes, if the boat is where they live,
// a pod surfaces near it for some twenty seconds: dolphins in quick arcs, sometimes leaping
// clear; orcas rolling slowly, tall dorsal fin first, with a blow at each breath.
// Models are built from simple shapes, one mesh per animal (colours painted per vertex).
import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3, VertexBuffer, VertexData, type Scene } from '@babylonjs/core';
import type { LandMask } from '../world/landMask';
import { waveHeight } from './waves';

export type Species = 'dolphin' | 'orca';

/** Lisbon's longitude in world metres: dolphins come up the river to about here. */
const LISBON_X = -2500;
/** West of the river mouth (Bugio), or south of the estuary: the open Atlantic. */
const OCEAN_WEST_X = -17300;
const OCEAN_SOUTH_Y = -9000;

/** Which animals can be seen at a point. */
export function speciesAt(x: number, y: number): Species[] {
  const ocean = x < OCEAN_WEST_X || y < OCEAN_SOUTH_Y;
  if (ocean) return ['dolphin', 'orca'];
  if (x < LISBON_X) return ['dolphin'];
  return [];
}

/** Seconds between sightings (real time), and how long one lasts. */
const GAP: [number, number] = [240, 360];
const DURATION = 20;

interface Animal {
  mesh: Mesh;
  /** Start point, swimming direction (rad from north) and speed. */
  x: number;
  y: number;
  dir: number;
  speed: number;
  /** Phase of the surfacing cycle. */
  phase: number;
  leaps: boolean;
  spout?: Mesh;
  /** White water where the animal breaks the surface. */
  splash: Mesh;
}

function paint(m: Mesh, c: Color3): Mesh {
  const n = m.getTotalVertices();
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b, 1], i * 4);
  m.setVerticesData(VertexBuffer.ColorKind, col);
  return m;
}

/** A fin: a thin triangle, base along the body (z), tip up and swept back. */
function fin(scene: Scene, base: number, height: number, sweep: number, thick: number): Mesh {
  const p = [
    [0, 0, base / 2],
    [0, 0, -base / 2],
    [0, height, -base / 2 - sweep],
  ];
  const positions: number[] = [];
  for (const side of [-1, 1]) for (const [x, y, z] of p) positions.push(x + (side * thick) / 2, y, z);
  const indices = [0, 1, 2, 3, 5, 4, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
  const m = new Mesh('fin', scene);
  const d = new VertexData();
  d.positions = positions;
  d.indices = indices;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  d.normals = normals;
  d.uvs = new Array((positions.length / 3) * 2).fill(0);
  d.applyToMesh(m);
  return m;
}

/** An animal along +z (head forward), its back up, origin at its middle. */
function buildAnimal(scene: Scene, species: Species, scale: number): Mesh {
  const parts: Mesh[] = [];
  const add = (m: Mesh, c: Color3) => parts.push(paint(m, c));
  if (species === 'dolphin') {
    const grey = new Color3(0.42, 0.46, 0.5);
    const light = new Color3(0.78, 0.8, 0.82);
    const L = 2.5 * scale;
    const body = MeshBuilder.CreateSphere('d-body', { diameterX: 0.55 * scale, diameterY: 0.6 * scale, diameterZ: L, segments: 12 }, scene);
    add(body, grey);
    const belly = MeshBuilder.CreateSphere('d-belly', { diameterX: 0.45 * scale, diameterY: 0.35 * scale, diameterZ: L * 0.8, segments: 10 }, scene);
    belly.position.set(0, -0.15 * scale, 0.05 * scale);
    add(belly, light);
    const beak = MeshBuilder.CreateCylinder('d-beak', { height: 0.35 * scale, diameterTop: 0.08 * scale, diameterBottom: 0.2 * scale, tessellation: 8 }, scene);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.05 * scale, L / 2 + 0.1 * scale);
    add(beak, grey);
    const dorsal = fin(scene, 0.5 * scale, 0.4 * scale, 0.2 * scale, 0.06 * scale);
    dorsal.position.set(0, 0.25 * scale, -0.05 * scale);
    add(dorsal, grey);
    for (const side of [-1, 1]) {
      const fluke = MeshBuilder.CreateBox('d-fluke', { width: 0.35 * scale, height: 0.04 * scale, depth: 0.22 * scale }, scene);
      fluke.position.set(side * 0.2 * scale, 0, -L / 2 - 0.05 * scale);
      fluke.rotation.y = side * 0.4;
      add(fluke, grey);
    }
  } else {
    const black = new Color3(0.05, 0.05, 0.06);
    const white = new Color3(0.92, 0.92, 0.9);
    const L = 7 * scale;
    const body = MeshBuilder.CreateSphere('o-body', { diameterX: 1.7 * scale, diameterY: 1.9 * scale, diameterZ: L, segments: 14 }, scene);
    add(body, black);
    const belly = MeshBuilder.CreateSphere('o-belly', { diameterX: 1.3 * scale, diameterY: 0.9 * scale, diameterZ: L * 0.6, segments: 10 }, scene);
    belly.position.set(0, -0.55 * scale, 0.6 * scale);
    add(belly, white);
    for (const side of [-1, 1]) {
      const patch = MeshBuilder.CreateSphere('o-eye', { diameterX: 0.2 * scale, diameterY: 0.35 * scale, diameterZ: 0.9 * scale, segments: 8 }, scene);
      patch.position.set(side * 0.72 * scale, 0.25 * scale, L / 2 - 1.3 * scale);
      add(patch, white);
      const fluke = MeshBuilder.CreateBox('o-fluke', { width: 1.0 * scale, height: 0.1 * scale, depth: 0.6 * scale }, scene);
      fluke.position.set(side * 0.55 * scale, 0, -L / 2 - 0.15 * scale);
      fluke.rotation.y = side * 0.35;
      add(fluke, black);
    }
    // The tall dorsal fin (up to 1.8 m on a male).
    const dorsal = fin(scene, 0.9 * scale, 1.7 * scale, 0.15 * scale, 0.12 * scale);
    dorsal.position.set(0, 0.8 * scale, 0);
    add(dorsal, black);
  }
  const m = Mesh.MergeMeshes(parts, true, true)!;
  m.useVertexColors = true;
  m.isPickable = false;
  return m;
}

export class Wildlife {
  private animals: Animal[] = [];
  private readonly material: StandardMaterial;
  private readonly spoutMaterial: StandardMaterial;
  private nextAt = GAP[0] * 0.5 + Math.random() * 60; // the first one a bit sooner
  private clock = 0;
  private endsAt = 0;
  private visible = true;
  /** Called when a pod appears: the species and where, relative to the boat. */
  onSighting?: (species: Species, side: 'port' | 'starboard' | 'ahead' | 'astern') => void;

  constructor(
    private readonly scene: Scene,
    private readonly mask: LandMask,
  ) {
    this.material = new StandardMaterial('wildlife', scene);
    this.material.diffuseColor = Color3.White();
    this.material.specularColor = new Color3(0.5, 0.5, 0.5);
    this.material.specularPower = 40;
    this.spoutMaterial = new StandardMaterial('spout', scene);
    this.spoutMaterial.diffuseColor = Color3.White();
    this.spoutMaterial.emissiveColor = new Color3(0.8, 0.8, 0.8);
    this.spoutMaterial.alpha = 0.5;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (!on) this.clear();
  }

  private clear(): void {
    for (const a of this.animals) {
      a.mesh.dispose();
      a.spout?.dispose();
      a.splash.dispose();
    }
    this.animals = [];
  }

  /** Make a pod appear now near the boat (also used for testing). */
  spawn(species: Species, boat: { x: number; y: number; heading: number }): boolean {
    this.clear();
    // Somewhere 40-100 m off the boat, ahead or to one side, swimming roughly alongside.
    for (let attempt = 0; attempt < 12; attempt++) {
      const bearing = boat.heading + (Math.random() * 2 - 1) * 1.8;
      const dist = 40 + Math.random() * 60;
      const cx = boat.x + Math.sin(bearing) * dist;
      const cy = boat.y + Math.cos(bearing) * dist;
      const dir = boat.heading + (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() * 2 - 1) * 0.5;
      const speed = species === 'dolphin' ? 4 : 2.5;
      // The water must be open where they swim for the whole sighting.
      let open = true;
      for (let t = -2; t <= DURATION + 2 && open; t += 4) open = this.mask.isWater(cx + Math.sin(dir) * speed * t, cy + Math.cos(dir) * speed * t);
      if (!open) continue;
      const count = species === 'dolphin' ? 4 + Math.floor(Math.random() * 5) : 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const scale = species === 'dolphin' ? 0.85 + Math.random() * 0.3 : i === 0 ? 1 : 0.7 + Math.random() * 0.15;
        const mesh = buildAnimal(this.scene, species, scale);
        mesh.material = this.material;
        const spread = species === 'dolphin' ? 8 : 15;
        this.animals.push({
          mesh,
          x: cx + (Math.random() * 2 - 1) * spread,
          y: cy + (Math.random() * 2 - 1) * spread,
          dir: dir + (Math.random() * 2 - 1) * 0.1,
          speed: speed * (0.9 + Math.random() * 0.2),
          phase: Math.random(),
          leaps: species === 'dolphin' && Math.random() < 0.35,
          splash: (() => {
            const d = MeshBuilder.CreateDisc('splash', { radius: species === 'orca' ? 2.2 : 1, tessellation: 16 }, this.scene);
            d.rotation.x = Math.PI / 2;
            d.material = this.spoutMaterial;
            d.isPickable = false;
            return d;
          })(),
          spout:
            species === 'orca'
              ? (() => {
                  const s = MeshBuilder.CreateCylinder('spout', { height: 3, diameterTop: 1.6, diameterBottom: 0.2, tessellation: 10 }, this.scene);
                  s.material = this.spoutMaterial;
                  s.isPickable = false;
                  return s;
                })()
              : undefined,
        });
      }
      this.endsAt = this.clock + DURATION;
      const rel = Math.atan2(Math.sin(bearing - boat.heading), Math.cos(bearing - boat.heading));
      const side = Math.abs(rel) < 0.5 ? 'ahead' : Math.abs(rel) > 2.6 ? 'astern' : rel > 0 ? 'starboard' : 'port';
      this.onSighting?.(species, side);
      return true;
    }
    return false;
  }

  /** dt: real seconds; time: clock for the waves. */
  update(boat: { x: number; y: number; heading: number }, time: number, dt: number): void {
    if (!this.visible) return;
    this.clock += dt;
    if (!this.animals.length && this.clock >= this.nextAt) {
      const here = speciesAt(boat.x, boat.y);
      if (here.length) {
        // On the open sea orcas are the rarer of the two.
        const species = here.includes('orca') && Math.random() < 0.4 ? 'orca' : 'dolphin';
        this.spawn(species, boat);
        this.nextAt = this.clock + GAP[0] + Math.random() * (GAP[1] - GAP[0]);
      } else {
        this.nextAt = this.clock + 15; // look again a little later
      }
    }
    if (!this.animals.length) return;
    const left = this.endsAt - this.clock;
    if (left < -4) {
      this.clear();
      return;
    }
    const t = DURATION - left;
    for (const a of this.animals) {
      const isOrca = !!a.spout;
      const x = a.x + Math.sin(a.dir) * a.speed * t;
      const z = a.y + Math.cos(a.dir) * a.speed * t;
      // Surfacing cycle: dolphins every ~2.5 s, orcas every ~6 s. Up for part of it.
      const period = isOrca ? 6 : 2.5;
      const up = isOrca ? 0.45 : 0.4;
      const c = ((t / period + a.phase) % 1 + 1) % 1;
      const s = c < up ? c / up : -1; // 0..1 while surfacing
      const surface = waveHeight(x, z, time);
      let y: number;
      let pitch: number;
      if (s >= 0 && left > 0 && this.mask.isWater(x, z)) {
        // An arc: up through the surface and down again.
        const height = a.leaps && Math.floor(t / period + a.phase) % 2 === 0 ? 1.8 : isOrca ? 0.15 : 0.1;
        y = surface - 0.9 * (isOrca ? 1.4 : 0.5) + Math.sin(Math.PI * s) * ((isOrca ? 1.4 : 0.5) + height);
        pitch = -Math.cos(Math.PI * s) * (a.leaps ? 0.7 : isOrca ? 0.25 : 0.45);
      } else {
        y = surface - 6;
        pitch = 0;
      }
      a.mesh.position.set(x, y, z);
      a.mesh.rotation.set(pitch, a.dir, 0);
      a.mesh.setEnabled(y > surface - 3);
      // Foam where the back breaks the surface and where it dives again.
      const foam = s >= 0 && left > 0 ? Math.max(0, 1 - Math.abs(s - 0.5) * 1.6) : 0;
      a.splash.setEnabled(foam > 0.05);
      if (foam > 0.05) {
        a.splash.position.set(x, surface + 0.06, z);
        a.splash.scaling.set(0.6 + foam, 0.6 + foam, 1);
        a.splash.visibility = 0.35 + 0.5 * foam;
      }
      if (a.spout) {
        // The blow: a puff of mist as the back breaks the surface, fading in a second.
        const puff = s >= 0 && s < 0.35 ? s / 0.35 : -1;
        a.spout.setEnabled(puff >= 0 && left > 0);
        if (puff >= 0) {
          const head = new Vector3(x + Math.sin(a.dir) * 2.2, surface, z + Math.cos(a.dir) * 2.2);
          a.spout.position.set(head.x, surface + 1.5 + puff * 2.5, head.z);
          a.spout.scaling.setAll(0.6 + puff * 1.2);
          a.spout.visibility = 1 - puff;
        }
      }
    }
  }
}
