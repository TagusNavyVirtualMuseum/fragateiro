import {
  LoadAssetContainerAsync,
  Quaternion,
  TransformNode,
  Vector3,
  VertexBuffer,
  type AbstractMesh,
  type AssetContainer,
  type Node,
  type Scene,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { BoatSpec, BoatState, ForceReport } from '../physics';
import type { BoatVisual, PartVisual } from './boatVisuals';
import { HULL_BINS, type HullProfile } from './water';
import { waveHeight } from './waves';

interface Pivot {
  node: TransformNode;
  sail?: string;
  /** Model nodes moved by this pivot (a node may be a mesh or a group of meshes). */
  parts: TransformNode[];
  /** Rotation axis in the glTF root's space (unit vector). */
  axis: Vector3;
  /** 0..1, eases the flapping in and out. */
  flap: number;
}

/**
 * A boat in the 3D scene.
 *
 * `root` is the boat frame: x = starboard, y = up, z = forward, origin at the
 * centre of gravity on the waterline. Babylon's yaw (rotation about y) uses the
 * same sense as a compass heading, so world x = east and world z = north.
 */
export class BoatView {
  readonly root: TransformNode;
  /** The hull's shape at the waterline (for keeping water out of the hull). */
  readonly hullProfile: HullProfile;
  private readonly sails = new Map<string, Pivot>();
  private rudder?: Pivot;
  private heave = 0;
  private pitch = 0;
  private roll = 0;

  private constructor(
    readonly spec: BoatSpec,
    readonly visual: BoatVisual,
    private readonly container: AssetContainer,
    scene: Scene,
  ) {
    this.root = new TransformNode(`${spec.id}-boat`, scene);
    const gltfRoot = container.meshes[0];
    const s = visual.scale;

    // Model frame -> boat frame (see the comment above BOAT_VISUALS).
    const model = new TransformNode(`${spec.id}-model`, scene);
    model.parent = this.root;
    // Turn the model so its bow points along the boat's +z (forward).
    const bow = visual.bowPositiveX ? 1 : -1;
    model.rotation.y = (bow * Math.PI) / 2;
    model.scaling.setAll(visual.unit * s);
    model.position.set(0, -visual.waterline * s, bow * -visual.cgX * s);
    gltfRoot.parent = model;

    const byName = new Map<string, Node>();
    for (const n of [...container.meshes, ...container.transformNodes]) byName.set(n.name, n);

    // Pivots live in the glTF root's space, so re-parenting keeps the meshes exactly in place.
    // In that space +x is aft and -z is starboard; rotating by +angle about an upward axis
    // swings an aft-pointing boom (or rudder blade) to starboard.
    const makePivot = (name: string, part: PartVisual): Pivot => {
      const node = new TransformNode(name, scene);
      node.parent = gltfRoot;
      // A raked mast: turn about the mast's own axis, pivoting at the masthead.
      const [px, py, pz] = part.axis ? part.axis.top : part.pivot;
      node.position.set(px / visual.unit, py / visual.unit, pz / visual.unit);
      node.rotationQuaternion = Quaternion.Identity();
      const axis = part.axis
        ? Vector3.FromArray(part.axis.top).subtract(Vector3.FromArray(part.axis.base)).normalize()
        : Vector3.Up();
      gltfRoot.computeWorldMatrix(true);
      node.computeWorldMatrix(true);
      const parts: TransformNode[] = [];
      for (const n of part.nodes) {
        const found = byName.get(n);
        if (!found) {
          console.warn(`[${spec.id}] model has no node named "${n}"`);
          continue;
        }
        (found as TransformNode).setParent(node);
        parts.push(found as TransformNode);
      }
      return { node, parts, axis, flap: 0 };
    };

    for (const sv of visual.sails) {
      const p = makePivot(`${spec.id}-sail-${sv.sail}`, sv);
      p.sail = sv.sail;
      this.sails.set(sv.sail, p);
    }
    this.rudder = makePivot(`${spec.id}-rudder`, visual.rudder);

    for (const n of visual.hiddenNodes ?? []) byName.get(n)?.setEnabled(false);
    this.hullProfile = this.measureWaterline(visual.hullNodes.map((n) => byName.get(n)).filter((n): n is Node => !!n));

    // A sail modelled as a single plane must be drawn from both sides; a sail that already
    // has both faces must not (the faces would fight and flicker). Decide from the normals.
    for (const sv of visual.sails) {
      for (const name of sv.nodes) {
        const found = byName.get(name) as TransformNode | undefined;
        if (!found) continue;
        for (const m of [found, ...found.getChildMeshes(false)] as AbstractMesh[]) {
          if (!m.material || !('getVerticesData' in m)) continue;
          if (isSingleSided(m)) m.material.backFaceCulling = false;
        }
      }
    }
  }

  /**
   * Half-width of the hull at the waterline in slices along its length: where the planking's
   * triangles cross a plane just below the waterline (boat frame: x starboard, y up,
   * z forward). Slightly inset so no gap shows between hull and water.
   */
  private measureWaterline(nodes: Node[]): HullProfile {
    this.root.computeWorldMatrix(true);
    const LEVEL = -0.05;
    const pts: [number, number][] = [];
    for (const n of nodes) {
      for (const m of [n, ...(n as TransformNode).getChildMeshes(false)] as AbstractMesh[]) {
        if (!('getVerticesData' in m)) continue;
        const pos = m.getVerticesData(VertexBuffer.PositionKind);
        const idx = m.getIndices();
        if (!pos || !idx) continue;
        const wm = m.computeWorldMatrix(true);
        const w: Vector3[] = [];
        for (let i = 0; i < pos.length; i += 3) w.push(Vector3.TransformCoordinatesFromFloatsToRef(pos[i], pos[i + 1], pos[i + 2], wm, new Vector3()));
        for (let t = 0; t < idx.length; t += 3) {
          // Where the triangle crosses the plane: a segment between two edge crossings.
          const cross: [number, number][] = [];
          for (let e = 0; e < 3; e++) {
            const a = w[idx[t + e]];
            const b = w[idx[t + ((e + 1) % 3)]];
            if ((a.y - LEVEL) * (b.y - LEVEL) > 0 || a.y === b.y) continue;
            const k = (LEVEL - a.y) / (b.y - a.y);
            cross.push([a.z + (b.z - a.z) * k, Math.abs(a.x + (b.x - a.x) * k)]);
          }
          if (cross.length < 2) continue;
          const [p, q] = cross;
          for (let j = 0; j <= 12; j++) pts.push([p[0] + ((q[0] - p[0]) * j) / 12, p[1] + ((q[1] - p[1]) * j) / 12]);
        }
      }
    }
    if (!pts.length) return { fwdStart: 0, step: 0, halfWidths: new Array(HULL_BINS).fill(0) };
    const zs = pts.map((p) => p[0]);
    const fwdStart = Math.min(...zs);
    const step = (Math.max(...zs) - fwdStart) / HULL_BINS;
    const halfWidths = new Array(HULL_BINS).fill(0);
    for (const [z, x] of pts) {
      const b = Math.min(HULL_BINS - 1, Math.floor((z - fwdStart) / step));
      halfWidths[b] = Math.max(halfWidths[b], x);
    }
    // Each slice takes the narrower of itself and its neighbours (the hull tapers within a
    // slice), minus a small margin.
    const inset = halfWidths.map((x, i) => Math.max(0, Math.min(x, halfWidths[i - 1] ?? 0, halfWidths[i + 1] ?? 0) * 0.94 - 0.05));
    return { fwdStart, step, halfWidths: inset };
  }

  static async load(scene: Scene, spec: BoatSpec, visual: BoatVisual): Promise<BoatView> {
    const container = await LoadAssetContainerAsync(visual.url, scene);
    container.addAllToScene();
    for (const m of container.meshes) m.isPickable = false;
    return new BoatView(spec, visual, container, scene);
  }

  setVisible(visible: boolean): void {
    this.root.setEnabled(visible);
  }

  /** Boat-frame point (forward, starboard, height) -> local position of `root`. */
  static local(fwd: number, stbd: number, up = 0): Vector3 {
    return new Vector3(stbd, up, fwd);
  }

  update(state: BoatState, report: ForceReport, rudder: number, time: number, dt: number): void {
    const spec = this.spec;
    const sh = Math.sin(state.heading);
    const ch = Math.cos(state.heading);

    // --- Floating, simplified: follow the wave surface under bow, stern and both sides.
    const L = spec.hull.waterlineLength * 0.8;
    const B = spec.beam * 0.8;
    const at = (fwd: number, stbd: number) =>
      waveHeight(state.x + fwd * sh + stbd * ch, state.y + fwd * ch - stbd * sh, time);
    const hb = at(L / 2, 0);
    const hs = at(-L / 2, 0);
    const hp = at(0, -B / 2);
    const hsb = at(0, B / 2);
    const k = Math.min(1, dt / 0.35); // hull inertia: smooth the motion
    this.heave += ((hb + hs + hp + hsb) / 4 - this.heave) * k;
    this.pitch += (Math.atan2(hb - hs, L) - this.pitch) * k;
    this.roll += (Math.atan2(hp - hsb, B) - this.roll) * k;

    this.root.position.set(state.x, this.heave, state.y);
    const heel = state.heel + this.roll; // + = starboard side down
    this.root.rotationQuaternion = Quaternion.RotationYawPitchRoll(state.heading, -this.pitch, -heel);

    // --- Sails and rudder
    const reports = new Map(report.sails.map((s) => [s.id, s]));
    let i = 0;
    for (const [id, p] of this.sails) {
      const r = reports.get(id);
      const active = r?.active ?? true;
      for (const m of p.parts) m.setEnabled(active);
      p.flap += ((r?.luffing && active ? 1 : 0) - p.flap) * Math.min(1, dt / 0.5);
      const flap = p.flap * 0.045 * Math.sin(time * 7 + i * 1.3) * (0.7 + 0.3 * Math.sin(time * 2.3 + i));
      Quaternion.RotationAxisToRef(p.axis, (state.sailAngles[id] ?? 0) + flap, p.node.rotationQuaternion!);
      i++;
    }
    if (this.rudder) {
      Quaternion.RotationAxisToRef(this.rudder.axis, (rudder * spec.rudder.maxAngleDeg * Math.PI) / 180, this.rudder.node.rotationQuaternion!);
    }
  }

  dispose(): void {
    this.container.dispose();
    this.root.dispose();
  }
}

/** Do (almost) all normals of the mesh face the same side? */
function isSingleSided(mesh: AbstractMesh): boolean {
  const n = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!n || n.length < 9) return false;
  const [ax, ay, az] = [n[0], n[1], n[2]];
  let same = 0;
  let opposite = 0;
  for (let i = 0; i < n.length; i += 3) {
    const d = n[i] * ax + n[i + 1] * ay + n[i + 2] * az;
    if (d > 0.3) same++;
    else if (d < -0.3) opposite++;
  }
  return opposite < 0.2 * Math.max(1, same);
}
