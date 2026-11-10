// Floating rubbish for the clean-up challenge: plastic bottles, bags, fish crates, barrels and
// tangles of lost net, bobbing on the waves and turning slowly, each in a ring of scum so it
// shows from a distance. Drawn a little larger than life (a bottle is hard to see from 50 m).
// When picked up a piece sinks and fades.
import { Color3, Mesh, MeshBuilder, StandardMaterial, type Scene } from '@babylonjs/core';
import type { Trash, TrashField, TrashKind } from '../world/challenges';
import { waveHeight } from './waves';

/** Drawing scale (pieces are small at sailing distance). */
const SCALE = 2.4;

export class TrashView {
  private readonly meshes = new Map<Trash, { piece: Mesh; scum: Mesh }>();
  private readonly mats: Record<TrashKind | 'scum', StandardMaterial>;
  private field: TrashField | null = null;

  constructor(private readonly scene: Scene) {
    const mat = (name: string, hex: string, emissive = 0.25) => {
      const m = new StandardMaterial(`trash-${name}`, scene);
      m.diffuseColor = Color3.FromHexString(hex);
      m.emissiveColor = Color3.FromHexString(hex).scale(emissive);
      m.specularColor = new Color3(0.2, 0.2, 0.2);
      return m;
    };
    this.mats = {
      bottle: mat('bottle', '#cfe6ee', 0.4),
      bag: mat('bag', '#3a6fb0', 0.3),
      crate: mat('crate', '#d9802b', 0.3),
      barrel: mat('barrel', '#2f7d4a', 0.25),
      net: mat('net', '#4fa6a0', 0.3),
      scum: mat('scum', '#e8e2c8', 0.6),
    };
    this.mats.scum.alpha = 0.55;
    this.mats.scum.disableDepthWrite = true;
  }

  /** Show a clean-up's rubbish (or none). */
  setField(field: TrashField | null): void {
    for (const m of this.meshes.values()) {
      m.piece.dispose();
      m.scum.dispose();
    }
    this.meshes.clear();
    this.field = field;
    if (!field) return;
    for (const t of field.items) this.meshes.set(t, this.build(t));
  }

  private build(t: Trash): { piece: Mesh; scum: Mesh } {
    const s = this.scene;
    let piece: Mesh;
    switch (t.kind) {
      case 'bottle': {
        piece = MeshBuilder.CreateCylinder('trash-bottle', { height: 0.9, diameter: 0.28, tessellation: 8 }, s);
        piece.rotation.z = Math.PI / 2; // lying on the water
        break;
      }
      case 'bag':
        piece = MeshBuilder.CreateSphere('trash-bag', { diameterX: 1.2, diameterY: 0.35, diameterZ: 0.9, segments: 6 }, s);
        break;
      case 'crate':
        piece = MeshBuilder.CreateBox('trash-crate', { width: 1, height: 0.45, depth: 0.7 }, s);
        break;
      case 'barrel': {
        piece = MeshBuilder.CreateCylinder('trash-barrel', { height: 1.2, diameter: 0.7, tessellation: 12 }, s);
        piece.rotation.z = Math.PI / 2;
        break;
      }
      default:
        piece = MeshBuilder.CreateTorusKnot('trash-net', { radius: 0.6, tube: 0.08, radialSegments: 24, tubularSegments: 6, p: 3, q: 5 }, s);
    }
    piece.material = this.mats[t.kind];
    piece.scaling.setAll(SCALE);
    piece.isPickable = false;
    const scum = MeshBuilder.CreateDisc('trash-scum', { radius: 3, tessellation: 16 }, s);
    scum.rotation.x = Math.PI / 2;
    scum.material = this.mats.scum;
    scum.isPickable = false;
    piece.position.set(t.x, 0, t.y);
    scum.position.set(t.x, 0, t.y);
    return { piece, scum };
  }

  update(time: number, gameTime: number): void {
    if (!this.field) return;
    for (const [t, { piece, scum }] of this.meshes) {
      const h = waveHeight(t.x, t.y, time);
      if (t.pickedAt !== null) {
        // Sinks and fades over two seconds, then goes.
        const k = (gameTime - t.pickedAt) / 2;
        if (k >= 1) {
          piece.setEnabled(false);
          scum.setEnabled(false);
          continue;
        }
        piece.position.y = h - k * 1.5;
        piece.visibility = 1 - k;
        scum.visibility = 1 - k;
        continue;
      }
      piece.position.y = h + 0.1;
      piece.rotation.y = t.phase + time * 0.15;
      scum.position.y = h + 0.03;
    }
  }
}
