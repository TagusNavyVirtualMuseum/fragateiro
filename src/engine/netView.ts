// The Muleta's net, drawn as a curve hanging from the boom tips into the water,
// trailing behind the boat's drift.
import { Color3, MeshBuilder, Vector3, type LinesMesh, type Scene, type TransformNode } from '@babylonjs/core';
import type { BoatState, NetSpec } from '../physics';

const POINTS = 16;

export class NetView {
  private mesh?: LinesMesh;

  constructor(private readonly scene: Scene) {}

  update(root: TransformNode, net: NetSpec | undefined, active: boolean, state: BoatState): void {
    if (!net || !active || net.points.length < 2) {
      this.mesh?.setEnabled(false);
      return;
    }
    const m = root.getWorldMatrix();
    const [a, b] = net.points;
    // The net streams away from the direction of drift (to windward when fishing).
    const speed = Math.hypot(state.u, state.v);
    const trail = speed > 0.05 ? -Math.sign(state.v || 1) : 1;
    const pts: Vector3[] = [];
    for (let i = 0; i < POINTS; i++) {
      const t = i / (POINTS - 1);
      const fwd = a[0] + (b[0] - a[0]) * t;
      const sag = Math.sin(Math.PI * t);
      const stbd = a[1] + (b[1] - a[1]) * t + trail * sag * 7;
      const up = 2 - sag * 3.2;
      pts.push(Vector3.TransformCoordinates(new Vector3(stbd, up, fwd), m));
    }
    if (!this.mesh) {
      this.mesh = MeshBuilder.CreateLines('net', { points: pts, updatable: true }, this.scene);
      this.mesh.color = new Color3(0.85, 0.8, 0.65);
      this.mesh.isPickable = false;
    } else {
      MeshBuilder.CreateLines('net', { points: pts, instance: this.mesh });
    }
    this.mesh.setEnabled(true);
  }
}
