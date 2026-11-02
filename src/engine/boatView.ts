import {
  LoadAssetContainerAsync,
  Quaternion,
  TransformNode,
  Vector3,
  type AssetContainer,
  type Node,
  type Scene,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import type { BoatSpec, BoatState, ForceReport } from '../physics';
import type { BoatVisual } from './boatVisuals';
import { waveHeight } from './waves';

interface Pivot {
  node: TransformNode;
  sail?: string;
  /** Model nodes moved by this pivot (a node may be a mesh or a group of meshes). */
  parts: TransformNode[];
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
    model.rotation.y = -Math.PI / 2;
    model.scaling.setAll(visual.unit * s);
    model.position.set(0, -visual.waterline * s, visual.cgX * s);
    gltfRoot.parent = model;

    const byName = new Map<string, Node>();
    for (const n of [...container.meshes, ...container.transformNodes]) byName.set(n.name, n);

    // Pivots live in the glTF root's space, so re-parenting keeps the meshes exactly in place.
    // In that space +x is aft and -z is starboard; rotating by +angle about y swings
    // an aft-pointing boom (or rudder blade) to starboard.
    const makePivot = (name: string, nodes: string[], pivot: [number, number, number]): Pivot => {
      const node = new TransformNode(name, scene);
      node.parent = gltfRoot;
      node.position.set(pivot[0] / visual.unit, pivot[1] / visual.unit, pivot[2] / visual.unit);
      gltfRoot.computeWorldMatrix(true);
      node.computeWorldMatrix(true);
      const parts: TransformNode[] = [];
      for (const n of nodes) {
        const found = byName.get(n);
        if (!found) {
          console.warn(`[${spec.id}] model has no node named "${n}"`);
          continue;
        }
        (found as TransformNode).setParent(node);
        parts.push(found as TransformNode);
      }
      return { node, parts };
    };

    for (const sv of visual.sails) {
      const p = makePivot(`${spec.id}-sail-${sv.sail}`, sv.nodes, sv.pivot);
      p.sail = sv.sail;
      this.sails.set(sv.sail, p);
    }
    this.rudder = makePivot(`${spec.id}-rudder`, visual.rudder.nodes, visual.rudder.pivot);
  }

  static async load(scene: Scene, spec: BoatSpec, visual: BoatVisual): Promise<BoatView> {
    const container = await LoadAssetContainerAsync(visual.url, scene);
    container.addAllToScene();
    for (const m of container.meshes) m.isPickable = false;
    // Sails are single planes: draw both faces.
    for (const mat of container.materials) mat.backFaceCulling = false;
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
      const flap = r?.luffing ? 0.06 * Math.sin(time * 17 + i * 1.3) : 0;
      p.node.rotation.y = (state.sailAngles[id] ?? 0) + flap;
      i++;
    }
    if (this.rudder) this.rudder.node.rotation.y = rudder * (spec.rudder.maxAngleDeg * Math.PI) / 180;
  }

  dispose(): void {
    this.container.dispose();
    this.root.dispose();
  }
}
