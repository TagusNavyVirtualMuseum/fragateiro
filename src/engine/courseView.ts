// Regatta marks: large yellow inflatable buoys with a flag, bobbing on the waves, and two
// posts marking the start and finish line. The next buoy to round glows.
import { Color3, Mesh, MeshBuilder, PBRMaterial, TransformNode, type Scene } from '@babylonjs/core';
import type { Course } from '../world/missions';
import { waveHeight } from './waves';

export class CourseView {
  private marks: TransformNode[] = [];
  private readonly yellow: PBRMaterial;
  private readonly glow: PBRMaterial;
  private readonly flag: PBRMaterial;
  private readonly post: PBRMaterial;

  constructor(private readonly scene: Scene) {
    const mat = (name: string, hex: string) => {
      const m = new PBRMaterial(name, scene);
      m.albedoColor = Color3.FromHexString(hex).toLinearSpace();
      m.metallic = 0;
      m.roughness = 0.6;
      return m;
    };
    this.yellow = mat('mark', '#f2c21b');
    this.glow = mat('mark-next', '#ffb000');
    this.glow.emissiveColor = new Color3(0.9, 0.55, 0.05);
    this.flag = mat('mark-flag', '#c0262d');
    this.post = mat('line-post', '#f4f1ea');
  }

  /** Show a course (or none). */
  setCourse(course: Course | null): void {
    for (const m of this.marks) m.dispose();
    this.marks = [];
    if (!course) return;
    course.buoys.forEach((b, i) => {
      const root = new TransformNode(`mark-${i}`, this.scene);
      root.position.set(b.x, 0, b.y);
      const body = MeshBuilder.CreateCylinder(`mark-body-${i}`, { height: 4, diameterTop: 1.6, diameterBottom: 3, tessellation: 16 }, this.scene);
      body.position.y = 1.6;
      body.material = this.yellow;
      const pole = MeshBuilder.CreateCylinder(`mark-pole-${i}`, { height: 4, diameter: 0.15 }, this.scene);
      pole.position.y = 5.4;
      pole.material = this.post;
      const flag = MeshBuilder.CreatePlane(`mark-flag-${i}`, { width: 2, height: 1.2, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
      flag.position.set(1, 6.6, 0);
      flag.material = this.flag;
      for (const m of [body, pole, flag]) {
        m.parent = root;
        m.isPickable = false;
      }
      root.metadata = { body };
      this.marks.push(root);
    });
    // Start/finish line: two white posts across the wind, 120 m apart.
    const b0 = course.buoys[0];
    const ux = b0.x - course.start.x;
    const uy = b0.y - course.start.y;
    const l = Math.hypot(ux, uy) || 1;
    for (const side of [-1, 1]) {
      const root = new TransformNode(`line-${side}`, this.scene);
      root.position.set(course.start.x + (uy / l) * 60 * side, 0, course.start.y - (ux / l) * 60 * side);
      const post = MeshBuilder.CreateCylinder('line-post', { height: 8, diameter: 0.6 }, this.scene);
      post.position.y = 3;
      post.material = this.post;
      const top = MeshBuilder.CreatePlane('line-flag', { width: 2.4, height: 1.4, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
      top.position.set(1.2, 6.2, 0);
      top.material = this.flag;
      for (const m of [post, top]) {
        m.parent = root;
        m.isPickable = false;
      }
      this.marks.push(root);
    }
  }

  /** Highlight the next buoy and bob everything on the waves. */
  update(next: number, time: number): void {
    this.marks.forEach((m, i) => {
      m.position.y = waveHeight(m.position.x, m.position.z, time) - 0.6;
      const body = m.metadata?.body as Mesh | undefined;
      if (body) body.material = i === next ? this.glow : this.yellow;
    });
  }
}
