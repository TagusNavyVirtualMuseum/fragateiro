// Shoals of fish seen from the boat: a darker patch of water, bubbles rising and popping all
// over it, small fish jumping now and then, and a few gulls circling low over it (which is
// how fishermen spotted them from far away). All bubbles and fish are thin instances of one
// small mesh each, so a whole fishing ground costs a handful of draw calls.
import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, Vector3, type Scene } from '@babylonjs/core';
import type { Shoal } from '../world/fishing';
import { Birds } from './birds';
import { waveHeight } from './waves';

const BUBBLES = 70;
const FISH = 6;

interface Look {
  patch: Mesh;
  birds: Birds;
  bubbles: { dx: number; dz: number; phase: number; speed: number; size: number }[];
  fish: { dx: number; dz: number; phase: number; dir: number }[];
}

export class ShoalView {
  private readonly looks = new Map<Shoal, Look>();
  private readonly bubble: Mesh;
  private readonly fish: Mesh;
  private readonly patchMat: StandardMaterial;
  private visible = true;

  constructor(private readonly scene: Scene) {
    this.patchMat = new StandardMaterial('shoal-patch', scene);
    this.patchMat.diffuseColor = new Color3(0.02, 0.1, 0.12);
    this.patchMat.specularColor = Color3.Black();
    this.patchMat.alpha = 0.35;
    this.patchMat.disableDepthWrite = true;
    this.patchMat.zOffset = -2;

    const bubbleMat = new StandardMaterial('shoal-bubble', scene);
    bubbleMat.diffuseColor = Color3.White();
    bubbleMat.emissiveColor = new Color3(0.7, 0.75, 0.75);
    bubbleMat.specularColor = Color3.Black();
    bubbleMat.alpha = 0.85;
    this.bubble = MeshBuilder.CreateDisc('bubble', { radius: 0.5, tessellation: 10 }, scene);
    this.bubble.rotation.x = Math.PI / 2;
    this.bubble.bakeCurrentTransformIntoVertices();
    this.bubble.material = bubbleMat;
    this.bubble.isPickable = false;
    this.bubble.alwaysSelectAsActiveMesh = true;

    const fishMat = new StandardMaterial('shoal-fish', scene);
    fishMat.diffuseColor = new Color3(0.75, 0.8, 0.85);
    fishMat.specularColor = new Color3(0.9, 0.9, 0.9);
    this.fish = MeshBuilder.CreateSphere('fish', { diameterX: 0.12, diameterY: 0.1, diameterZ: 0.45, segments: 6 }, scene);
    this.fish.material = fishMat;
    this.fish.isPickable = false;
    this.fish.alwaysSelectAsActiveMesh = true;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (!on) this.sync([]);
  }

  /** Make the looks match the shoals (new shoals appear, fished-out ones go). */
  private sync(shoals: Shoal[]): void {
    for (const [s, look] of this.looks) {
      if (!shoals.includes(s)) {
        look.patch.dispose();
        look.birds.dispose();
        this.looks.delete(s);
      }
    }
    for (const s of shoals) {
      if (this.looks.has(s)) continue;
      const patch = MeshBuilder.CreateDisc('shoal', { radius: 1, tessellation: 32 }, this.scene);
      patch.rotation.x = Math.PI / 2;
      patch.material = this.patchMat;
      patch.isPickable = false;
      const bubbles = Array.from({ length: BUBBLES }, () => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        return { dx: Math.cos(a) * r, dz: Math.sin(a) * r, phase: Math.random(), speed: 0.4 + Math.random() * 0.6, size: 0.3 + Math.random() * 0.6 };
      });
      const fish = Array.from({ length: FISH }, () => ({ dx: Math.random() * 1.6 - 0.8, dz: Math.random() * 1.6 - 0.8, phase: Math.random() * 6, dir: Math.random() * Math.PI * 2 }));
      const birds = new Birds(this.scene, { count: 6, spread: [0, 15], height: [4, 14], range: 80 });
      this.looks.set(s, { patch, bubbles, fish, birds });
    }
  }

  /** time: game clock for the animation; dt: real seconds (birds). */
  update(shoals: Shoal[], time: number, dt: number): void {
    if (!this.visible) return;
    this.sync(shoals);
    const bubbleMatrices: number[] = [];
    const fishMatrices: number[] = [];
    const m = new Matrix();
    const q = new Quaternion();
    for (const [s, look] of this.looks) {
      // Fewer bubbles and a fainter patch as the shoal is fished out.
      const fullness = Math.min(1, s.kg / 100);
      const y0 = waveHeight(s.x, s.y, time);
      look.patch.position.set(s.x, y0 + 0.06, s.y);
      look.patch.scaling.setAll(s.radius);
      look.patch.visibility = 0.4 + 0.6 * fullness;
      look.birds.update(new Vector3(s.x, 0, s.y), 0, 0, dt);
      const shown = Math.round(look.bubbles.length * (0.3 + 0.7 * fullness));
      for (let i = 0; i < shown; i++) {
        const b = look.bubbles[i];
        // Each bubble grows at the surface and pops, again and again.
        const t = (time * b.speed + b.phase) % 1;
        const size = b.size * Math.sin(Math.PI * t);
        const x = s.x + b.dx * s.radius;
        const z = s.y + b.dz * s.radius;
        Matrix.ComposeToRef(new Vector3(size, 1, size), Quaternion.Identity(), new Vector3(x, waveHeight(x, z, time) + 0.08, z), m);
        bubbleMatrices.push(...m.asArray());
      }
      for (const f of look.fish) {
        // A fish leaps every few seconds: a short arc out of the water.
        const cycle = (time + f.phase) % 5;
        if (cycle > 0.8) continue;
        const t = cycle / 0.8;
        const x = s.x + f.dx * s.radius + Math.sin(f.dir) * (t - 0.5) * 1.5;
        const z = s.y + f.dz * s.radius + Math.cos(f.dir) * (t - 0.5) * 1.5;
        const y = waveHeight(x, z, time) + Math.sin(Math.PI * t) * 0.8;
        Quaternion.RotationYawPitchRollToRef(f.dir, -Math.cos(Math.PI * t) * 1.1, 0, q);
        Matrix.ComposeToRef(Vector3.One(), q, new Vector3(x, y, z), m);
        fishMatrices.push(...m.asArray());
      }
    }
    this.setInstances(this.bubble, bubbleMatrices);
    this.setInstances(this.fish, fishMatrices);
  }

  private setInstances(mesh: Mesh, matrices: number[]): void {
    const count = matrices.length / 16;
    mesh.setEnabled(count > 0);
    if (!count) return;
    mesh.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16, false);
  }

  /** Remove everything (when the fishing trip ends). */
  clear(): void {
    this.sync([]);
    this.bubble.setEnabled(false);
    this.fish.setEnabled(false);
  }
}
