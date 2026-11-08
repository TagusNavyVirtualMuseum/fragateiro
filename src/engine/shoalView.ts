// Shoals of fish seen from the boat: a darker patch of water, bubbles rising and popping all
// over it, small fish jumping now and then, and a few gulls circling low over it (which is
// how fishermen spotted them from far away). All bubbles and fish are thin instances of one
// small mesh each, so a whole fishing ground costs a handful of draw calls.
import { Color3, DynamicTexture, Matrix, Mesh, MeshBuilder, Quaternion, StandardMaterial, Vector3, type Scene } from '@babylonjs/core';
import type { Shoal } from '../world/fishing';
import { Birds } from './birds';
import { waveHeight } from './waves';

const BUBBLES = 90;
const FISH = 14;

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
    // The patch: water "boiling" with fish, lighter and flecked with foam, fading at the edge.
    const tex = new DynamicTexture('shoal-foam', { width: 256, height: 256 }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    grad.addColorStop(0, 'rgba(210, 235, 232, 0.75)');
    grad.addColorStop(0.7, 'rgba(170, 215, 210, 0.5)');
    grad.addColorStop(1, 'rgba(170, 215, 210, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * 110;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.random() * 0.5})`;
      ctx.beginPath();
      ctx.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 1 + Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    tex.update();
    tex.hasAlpha = true;
    this.patchMat = new StandardMaterial('shoal-patch', scene);
    this.patchMat.diffuseTexture = tex;
    this.patchMat.useAlphaFromDiffuseTexture = true;
    this.patchMat.emissiveColor = new Color3(0.45, 0.5, 0.5);
    this.patchMat.specularColor = Color3.Black();
    this.patchMat.disableDepthWrite = true;
    this.patchMat.zOffset = -2;
    this.patchMat.fogEnabled = false;

    const bubbleMat = new StandardMaterial('shoal-bubble', scene);
    bubbleMat.diffuseColor = Color3.White();
    bubbleMat.emissiveColor = new Color3(0.7, 0.75, 0.75);
    bubbleMat.specularColor = Color3.Black();
    bubbleMat.alpha = 0.9;
    bubbleMat.fogEnabled = false;
    this.bubble = MeshBuilder.CreateDisc('bubble', { radius: 0.5, tessellation: 10 }, scene);
    this.bubble.rotation.x = Math.PI / 2;
    this.bubble.bakeCurrentTransformIntoVertices();
    this.bubble.material = bubbleMat;
    this.bubble.isPickable = false;
    this.bubble.alwaysSelectAsActiveMesh = true;
    this.bubble.renderingGroupId = 1;

    const fishMat = new StandardMaterial('shoal-fish', scene);
    fishMat.diffuseColor = new Color3(0.75, 0.8, 0.85);
    fishMat.specularColor = new Color3(0.9, 0.9, 0.9);
    this.fish = MeshBuilder.CreateSphere('fish', { diameterX: 0.2, diameterY: 0.16, diameterZ: 0.7, segments: 6 }, scene);
    this.fish.material = fishMat;
    this.fish.isPickable = false;
    this.fish.alwaysSelectAsActiveMesh = true;
    this.fish.renderingGroupId = 1;
    // Draw the shoals after the water (group 0), keeping its depth so the boats still hide them.
    scene.setRenderingAutoClearDepthStencil(1, false, false);
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
      // A grid that follows the waves (a flat disc would dip under the crests).
      const patch = MeshBuilder.CreateGround('shoal', { width: 2, height: 2, subdivisions: 24, updatable: true }, this.scene);
      patch.material = this.patchMat;
      patch.renderingGroupId = 1;
      patch.alwaysSelectAsActiveMesh = true;
      patch.isPickable = false;
      const bubbles = Array.from({ length: BUBBLES }, () => {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        return { dx: Math.cos(a) * r, dz: Math.sin(a) * r, phase: Math.random(), speed: 0.4 + Math.random() * 0.6, size: 0.8 + Math.random() * 1.6 };
      });
      const fish = Array.from({ length: FISH }, () => ({ dx: Math.random() * 1.6 - 0.8, dz: Math.random() * 1.6 - 0.8, phase: Math.random() * 6, dir: Math.random() * Math.PI * 2 }));
      // A flock wheeling over the shoal: the cue fishermen looked for. Drawn larger than life so
      // it can be seen from a kilometre away.
      const birds = new Birds(this.scene, { count: 14, spread: [0, 30], height: [8, 35], range: 90, size: 3 });
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
      const r = s.radius * 1.15;
      const pos = look.patch.getVerticesData('position')!;
      for (let i = 0; i < pos.length; i += 3) {
        const gx = s.x + pos[i] * r;
        const gz = s.y + pos[i + 2] * r;
        pos[i + 1] = waveHeight(gx, gz, time) + 0.12;
      }
      look.patch.position.set(s.x, 0, s.y);
      look.patch.scaling.set(r, 1, r);
      look.patch.updateVerticesData('position', pos);
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
        const cycle = (time + f.phase) % 3;
        if (cycle > 0.8) continue;
        const t = cycle / 0.8;
        const x = s.x + f.dx * s.radius + Math.sin(f.dir) * (t - 0.5) * 1.5;
        const z = s.y + f.dz * s.radius + Math.cos(f.dir) * (t - 0.5) * 1.5;
        const y = waveHeight(x, z, time) + Math.sin(Math.PI * t) * 1.2;
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
