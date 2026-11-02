// Buoys scattered on the water, so you can see that you are moving.
import { Color3, MeshBuilder, StandardMaterial, type Mesh, type Scene } from '@babylonjs/core';
import { waveHeight } from './waves';

export class Marks {
  private readonly buoys: Mesh[] = [];

  constructor(scene: Scene, radius = 1200, spacing = 160) {
    const red = new StandardMaterial('buoyRed', scene);
    red.diffuseColor = new Color3(0.85, 0.15, 0.1);
    const green = new StandardMaterial('buoyGreen', scene);
    green.diffuseColor = new Color3(0.1, 0.6, 0.25);
    const base = MeshBuilder.CreateCylinder('buoy', { height: 1.6, diameterTop: 0.3, diameterBottom: 1.1, tessellation: 12 }, scene);
    base.isVisible = false;
    let i = 0;
    for (let x = -radius; x <= radius; x += spacing) {
      for (let z = -radius; z <= radius; z += spacing) {
        if (Math.hypot(x, z) < 60) continue;
        const jitter = ((i * 7919) % 97) / 97 - 0.5;
        const b = base.clone(`buoy${i}`)!;
        b.isVisible = true;
        b.material = (i + Math.floor(x / spacing)) % 2 ? red : green;
        b.position.set(x + jitter * spacing * 0.6, 0, z - jitter * spacing * 0.4);
        b.isPickable = false;
        this.buoys.push(b);
        i++;
      }
    }
  }

  update(time: number): void {
    for (const b of this.buoys) b.position.y = waveHeight(b.position.x, b.position.z, time) + 0.4;
  }
}
