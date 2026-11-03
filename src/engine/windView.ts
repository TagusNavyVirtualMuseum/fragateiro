// The wind made visible: short horizontal streaks over the water, lying along the wind and
// drifting downwind past the boat (like gusts on a chart), fading in and out.
import { Color4, MeshBuilder, Vector3, type LinesMesh, type Scene } from '@babylonjs/core';
import type { TrueWind } from '../physics';

const COUNT = 43;
const POINTS = 6; // per streak (a gentle ripple along it)
const AREA = 90; // m, half-size of the square around the camera target
const LIFE = 9; // s

interface Streak {
  /** Position of the streak's middle relative to the area centre, m. */
  x: number;
  z: number;
  y: number;
  length: number;
  age: number;
  phase: number;
}

export class WindView {
  private readonly streaks: Streak[] = [];
  private mesh?: LinesMesh;
  private visible = true;
  private centre = new Vector3();

  constructor(private readonly scene: Scene) {
    for (let i = 0; i < COUNT; i++) this.streaks.push(this.spawn(Math.random() * LIFE));
  }

  private spawn(age = 0): Streak {
    return {
      x: (Math.random() * 2 - 1) * AREA,
      z: (Math.random() * 2 - 1) * AREA,
      y: 0.6 + Math.random() * 7,
      length: 6 + Math.random() * 8,
      age,
      phase: Math.random() * Math.PI * 2,
    };
  }

  setVisible(on: boolean): void {
    this.visible = on;
    this.mesh?.setEnabled(on);
  }

  /** dt in real seconds; streaks move at the real wind speed (not sped up with the game clock). */
  update(centre: Vector3, wind: TrueWind, timeScale: number, dt: number): void {
    if (!this.visible) return;
    // Keep positions relative to the area centre; when the camera moves, streaks stay put
    // in the world (shift them back by the camera's movement).
    const moved = centre.subtract(this.centre);
    this.centre.copyFrom(centre);

    // Air moves towards (−sin from, −cos from) in (east, north) = Babylon (x, z).
    const dx = -Math.sin(wind.from);
    const dz = -Math.cos(wind.from);
    void timeScale;
    const speed = wind.speed;
    const lines: Vector3[][] = [];
    const colors: Color4[][] = [];
    for (let i = 0; i < this.streaks.length; i++) {
      let s = this.streaks[i];
      s.age += dt;
      s.x += dx * speed * dt - moved.x;
      s.z += dz * speed * dt - moved.z;
      if (s.age > LIFE || Math.abs(s.x) > AREA || Math.abs(s.z) > AREA) {
        s = this.streaks[i] = this.spawn();
        // Enter from the upwind side so the flow reads as coming from the wind.
        s.x -= dx * AREA * 0.6;
        s.z -= dz * AREA * 0.6;
      }
      // Fade in, hold, fade out.
      const a = Math.min(1, s.age / 2, (LIFE - s.age) / 2) * 0.9;
      const pts: Vector3[] = [];
      const col: Color4[] = [];
      for (let j = 0; j < POINTS; j++) {
        const t = j / (POINTS - 1) - 0.5;
        const along = t * s.length;
        // A fixed gentle curve (an animated wobble made the thin lines shimmer).
        const ripple = 0.15 * Math.sin(t * 5 + s.phase);
        pts.push(new Vector3(centre.x + s.x + dx * along - dz * ripple, s.y, centre.z + s.z + dz * along + dx * ripple));
        // Thinner at the ends: fade the end points.
        col.push(new Color4(1, 1, 1, a * (1 - Math.abs(t) * 1.6)));
      }
      lines.push(pts);
      colors.push(col);
      // A second line just above: reads as a slightly thicker streak.
      lines.push(pts.map((p) => p.add(new Vector3(0, 0.05, 0))));
      colors.push(col);
    }
    if (!this.mesh) {
      this.mesh = MeshBuilder.CreateLineSystem('wind', { lines, colors, updatable: true, useVertexAlpha: true }, this.scene);
      this.mesh.isPickable = false;
      this.mesh.alwaysSelectAsActiveMesh = true;
    } else {
      MeshBuilder.CreateLineSystem('wind', { lines, colors, instance: this.mesh });
    }
  }
}
