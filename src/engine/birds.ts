// Gulls circling over the river near the boat. The whole flock is one mesh (one draw call)
// whose few vertices are moved every frame: each bird glides in wide circles, flaps now and
// then, and drifts with the wind. Birds left far behind come back near the camera.
import { Color3, Mesh, StandardMaterial, Vector3, VertexBuffer, VertexData, type Scene } from '@babylonjs/core';

const COUNT = 24;
/** Vertices per bird: nose, tail, then per wing a root pair, the elbow and the tip. */
const VERTS = 10;
const RANGE = 250; // m: birds further than this from the camera target are moved back near it

interface Bird {
  /** Centre of the circle it is gliding round. */
  cx: number;
  cz: number;
  radius: number;
  height: number;
  /** Angle on the circle, rad, and angular speed (sign = turning direction). */
  angle: number;
  turn: number;
  /** Flapping: time left in the current bout of flapping, and wing phase. */
  flapping: number;
  phase: number;
  size: number;
}

export class Birds {
  private readonly birds: Bird[] = [];
  private readonly mesh: Mesh;
  private readonly positions: Float32Array;
  private placed = false;

  constructor(scene: Scene) {
    for (let i = 0; i < COUNT; i++) this.birds.push(this.spawn(0, 0));
    this.positions = new Float32Array(COUNT * VERTS * 3);
    const indices: number[] = [];
    const colors: number[] = [];
    // Light grey wings with dark tips, white body.
    const white = [0.95, 0.95, 0.94, 1];
    const wing = [0.78, 0.8, 0.82, 1];
    const tip = [0.15, 0.15, 0.17, 1];
    for (let b = 0; b < COUNT; b++) {
      const o = b * VERTS;
      // 0 nose, 1 tail; left wing 2 root-front, 3 root-back, 4 elbow, 5 tip; right wing 6..9
      indices.push(o, o + 2, o + 1, o, o + 1, o + 6); // body
      for (const w of [2, 6]) {
        indices.push(o + w, o + w + 1, o + w + 2); // inner wing
        indices.push(o + w + 2, o + w + 1, o + w + 3); // outer wing
      }
      colors.push(...white, ...white, ...wing, ...wing, ...wing, ...tip, ...wing, ...wing, ...wing, ...tip);
    }
    this.mesh = new Mesh('birds', scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.indices = indices;
    data.colors = colors;
    data.normals = new Float32Array(this.positions.length).map((_, i) => (i % 3 === 1 ? 1 : 0));
    data.applyToMesh(this.mesh, true);
    const mat = new StandardMaterial('birdsMat', scene);
    mat.backFaceCulling = false;
    mat.diffuseColor = Color3.White();
    mat.emissiveColor = new Color3(0.35, 0.35, 0.35);
    mat.specularColor = Color3.Black();
    this.mesh.material = mat;
    this.mesh.useVertexColors = true;
    this.mesh.isPickable = false;
    this.mesh.alwaysSelectAsActiveMesh = true;
  }

  private spawn(x: number, z: number): Bird {
    const a = Math.random() * Math.PI * 2;
    const d = 15 + Math.random() * 110;
    const radius = 15 + Math.random() * 45;
    const speed = 7 + Math.random() * 4; // m/s
    return {
      cx: x + Math.cos(a) * d,
      cz: z + Math.sin(a) * d,
      radius,
      height: 6 + Math.random() * 22,
      angle: Math.random() * Math.PI * 2,
      turn: (speed / radius) * (Math.random() < 0.5 ? -1 : 1),
      flapping: Math.random() * 2,
      phase: Math.random() * 10,
      size: 0.8 + Math.random() * 0.4, // wingspan about 1.2-1.7 m (with the 1.4 m base below)
    };
  }

  setVisible(on: boolean): void {
    this.mesh.setEnabled(on);
  }

  /** dt in real seconds; wind drift in m/s towards (x, z). */
  update(centre: Vector3, windX: number, windZ: number, dt: number): void {
    if (!this.mesh.isEnabled()) return;
    if (!this.placed) {
      this.placed = true;
      for (let i = 0; i < COUNT; i++) this.birds[i] = this.spawn(centre.x, centre.z);
    }
    const p = this.positions;
    for (let i = 0; i < COUNT; i++) {
      let b = this.birds[i];
      if (Math.hypot(b.cx - centre.x, b.cz - centre.z) > RANGE) b = this.birds[i] = this.spawn(centre.x, centre.z);
      b.angle += b.turn * dt;
      b.cx += windX * 0.3 * dt;
      b.cz += windZ * 0.3 * dt;
      // Glide most of the time; now and then a short bout of flapping.
      b.flapping -= dt;
      if (b.flapping < -3 - Math.random() * 6) b.flapping = 0.8 + Math.random() * 1.5;
      const flapping = b.flapping > 0;
      b.phase += dt * (flapping ? 9 : 0);
      const beat = flapping ? Math.sin(b.phase) : 0.15; // wings slightly raised when gliding
      const x = b.cx + Math.cos(b.angle) * b.radius;
      const z = b.cz + Math.sin(b.angle) * b.radius;
      const y = b.height + Math.sin(b.angle * 2 + i) * 1.5;
      // Heading along the circle; bank into the turn.
      const dir = b.angle + (b.turn > 0 ? Math.PI / 2 : -Math.PI / 2);
      const fx = Math.cos(dir);
      const fz = Math.sin(dir);
      const bank = Math.sign(b.turn) * 0.35;
      // Bird frame: forward (fx, 0, fz); right (fz, 0, -fx) tilted by the bank.
      const rx = fz * Math.cos(bank);
      const rz = -fx * Math.cos(bank);
      const ry = Math.sin(bank);
      const s = b.size * 0.7; // half-span
      const put = (k: number, fwd: number, side: number, up: number) => {
        const o = (i * VERTS + k) * 3;
        p[o] = x + fx * fwd + rx * side;
        p[o + 1] = y + up + ry * side;
        p[o + 2] = z + fz * fwd + rz * side;
      };
      put(0, 0.35 * s, 0, 0);
      put(1, -0.45 * s, 0, 0.02);
      for (const side of [-1, 1]) {
        const k = side < 0 ? 2 : 6;
        const lift = beat * 0.35 * s;
        put(k, 0.12 * s, side * 0.08 * s, 0);
        put(k + 1, -0.12 * s, side * 0.08 * s, 0);
        // Gull wings bend at the elbow: the outer part sweeps back.
        put(k + 2, 0.02 * s, side * 0.5 * s, lift * 0.6 + 0.08 * s);
        put(k + 3, -0.25 * s, side * s, lift * 1.4);
      }
    }
    this.mesh.updateVerticesData(VertexBuffer.PositionKind, p);
  }
}
