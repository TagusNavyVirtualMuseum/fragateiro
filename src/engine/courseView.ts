// Regatta marks: yellow special-mark pillar buoys (IALA) bobbing on the waves, and two posts
// marking the start and finish line. A glowing ring floats round the next buoy to round.
import { Color3, Mesh, MeshBuilder, PBRMaterial, TransformNode, type Scene } from '@babylonjs/core';
import type { Course } from '../world/missions';
import { waveHeight } from './waves';
import { SPECIAL_MARK, createBuoy } from './buoys';

export class CourseView {
  private marks: TransformNode[] = [];
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
    this.glow = mat('mark-next', '#ffb000');
    this.glow.emissiveColor = new Color3(0.9, 0.55, 0.05);
    this.flag = mat('mark-flag', '#c0262d');
    this.post = mat('line-post', '#f4f1ea');
  }

  /** Show a course (or none). */
  setCourse(course: Course | null, line = true): void {
    for (const m of this.marks) m.dispose();
    this.marks = [];
    if (!course) return;
    course.buoys.forEach((b, i) => {
      const root = new TransformNode(`mark-${i}`, this.scene);
      root.position.set(b.x, 0, b.y);
      // A yellow special-mark pillar buoy with its X topmark; a ring glows on the next one.
      const buoy = createBuoy(this.scene, `course-mark-${i}`, SPECIAL_MARK);
      buoy.parent = root;
      const ring = MeshBuilder.CreateTorus(`mark-ring-${i}`, { diameter: 4.4, thickness: 0.35, tessellation: 24 }, this.scene);
      ring.position.y = 0.4;
      ring.material = this.glow;
      ring.parent = root;
      ring.isPickable = false;
      root.metadata = { ring };
      this.marks.push(root);
    });
    if (!line) return; // drills: buoys only
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
      m.position.y = waveHeight(m.position.x, m.position.z, time) - 0.2;
      const ring = m.metadata?.ring as Mesh | undefined;
      if (ring) ring.setEnabled(i === next);
    });
  }
}
