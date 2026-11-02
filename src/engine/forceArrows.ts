// Draws the forces of the physics model as arrows (for learning and debugging).
import { Color4, MeshBuilder, Vector3, type LinesMesh, type Scene, type TransformNode } from '@babylonjs/core';
import type { ForceReport, TrueWind } from '../physics';

/** Metres of arrow per newton. */
const FORCE_SCALE = 1 / 400;
/** Metres of arrow per m/s of wind. */
const WIND_SCALE = 1.2;

export const ARROW_COLORS = {
  sail: new Color4(0.2, 0.8, 1, 1),
  keel: new Color4(0.3, 0.9, 0.3, 1),
  rudder: new Color4(1, 0.6, 0.1, 1),
  resistance: new Color4(1, 0.25, 0.25, 1),
  net: new Color4(0.9, 0.3, 0.9, 1),
  trueWind: new Color4(1, 1, 1, 1),
  apparentWind: new Color4(1, 0.9, 0.2, 1),
};

interface Arrow {
  from: Vector3;
  to: Vector3;
  color: Color4;
}

export class ForceArrows {
  private mesh?: LinesMesh;
  private count = -1;
  visible = false;

  constructor(private readonly scene: Scene) {}

  update(root: TransformNode, report: ForceReport, wind: TrueWind, heading: number, mastHeight: number): void {
    if (!this.visible) {
      this.mesh?.setEnabled(false);
      return;
    }
    const m = root.getWorldMatrix();
    const point = (fwd: number, stbd: number, up: number) => Vector3.TransformCoordinates(new Vector3(stbd, up, fwd), m);
    const dir = (fx: number, fy: number) => Vector3.TransformNormal(new Vector3(fy, 0, fx), m);
    const arrows: Arrow[] = [];
    const force = (x: number, y: number, up: number, fx: number, fy: number, color: Color4) => {
      const from = point(x, y, up);
      arrows.push({ from, to: from.add(dir(fx, fy).scale(FORCE_SCALE)), color });
    };

    for (const s of report.sails) force(s.ceX, s.ceY, 4, s.fx, s.fy, ARROW_COLORS.sail);
    force(report.keel.x, 0, 0.2, report.keel.fx, report.keel.fy, ARROW_COLORS.keel);
    force(report.rudder.x, 0, 0.2, report.rudder.fx, report.rudder.fy, ARROW_COLORS.rudder);
    force(0, 0, 0.6, report.resistance.fx, report.resistance.fy, ARROW_COLORS.resistance);
    for (const n of report.net) force(n.x, n.y, 0.5, n.fx, n.fy, ARROW_COLORS.net);

    // Wind arrows above the boat, pointing where the air goes.
    const top = point(0, 0, mastHeight + 2);
    const tw = new Vector3(-Math.sin(wind.from), 0, -Math.cos(wind.from)).scale(wind.speed * WIND_SCALE);
    arrows.push({ from: top.subtract(tw), to: top, color: ARROW_COLORS.trueWind });
    const awaWorld = heading + (report.apparentWindAngleDeg * Math.PI) / 180;
    const aw = new Vector3(-Math.sin(awaWorld), 0, -Math.cos(awaWorld)).scale(report.apparentWindSpeed * WIND_SCALE);
    const top2 = top.add(new Vector3(0, 1.5, 0));
    arrows.push({ from: top2.subtract(aw), to: top2, color: ARROW_COLORS.apparentWind });

    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    for (const a of arrows) {
      const d = a.to.subtract(a.from);
      const len = d.length();
      const side = len > 1e-3 ? Vector3.Cross(d, Vector3.Up()).normalize().scale(len * 0.12) : Vector3.Zero();
      const back = d.scale(-0.2);
      lines.push([a.from, a.to], [a.to, a.to.add(back).add(side)], [a.to, a.to.add(back).subtract(side)]);
      colors.push([a.color, a.color], [a.color, a.color], [a.color, a.color]);
    }

    if (!this.mesh || this.count !== lines.length) {
      this.mesh?.dispose();
      this.mesh = MeshBuilder.CreateLineSystem('forces', { lines, colors, updatable: true }, this.scene);
      this.mesh.isPickable = false;
      this.mesh.renderingGroupId = 1;
      this.count = lines.length;
    } else {
      MeshBuilder.CreateLineSystem('forces', { lines, colors, instance: this.mesh });
    }
    this.mesh.setEnabled(true);
  }

  reset(): void {
    this.mesh?.dispose();
    this.mesh = undefined;
    this.count = -1;
  }
}
