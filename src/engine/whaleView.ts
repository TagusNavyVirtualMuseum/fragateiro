// The sperm whale of the whaling mission: a long, dark grey-brown body (about 15 m) with the
// huge square head, a low hump instead of a dorsal fin, and the broad triangular tail. At the
// surface it lies low, rolling with the swell, and blows every few seconds: a bushy spout
// slanting forward and to the left (the sperm whale's blowhole is on the left of its head).
// When it dives it arches its back and lifts its tail high, then slides under.
import { Color3, Mesh, MeshBuilder, StandardMaterial, TransformNode, type Scene } from '@babylonjs/core';
import type { Whale } from '../world/whaling';
import { waveHeight } from './waves';

const L = 15; // m

export class WhaleView {
  private readonly root: TransformNode;
  private readonly body: TransformNode;
  private readonly tail: TransformNode;
  private readonly spout: Mesh;
  private readonly spoutMat: StandardMaterial;

  constructor(scene: Scene) {
    this.root = new TransformNode('whale', scene);
    this.body = new TransformNode('whale-body', scene);
    this.body.parent = this.root;
    const skin = new StandardMaterial('whale-skin', scene);
    skin.diffuseColor = new Color3(0.16, 0.15, 0.15);
    skin.specularColor = new Color3(0.15, 0.15, 0.15);
    const part = (m: Mesh, parent: TransformNode = this.body) => {
      m.material = skin;
      m.parent = parent;
      m.isPickable = false;
      return m;
    };
    // The square head (a third of the length) and the body tapering to the tail stock.
    const head = part(MeshBuilder.CreateBox('whale-head', { width: 3, height: 3.2, depth: 5.5 }, scene));
    head.position.set(0, -0.6, L / 2 - 2.75);
    const front = part(MeshBuilder.CreateCylinder('whale-snout', { height: 3, diameter: 3.2, tessellation: 16 }, scene));
    front.rotation.z = Math.PI / 2;
    front.position.set(0, -0.6, L / 2 - 0.2);
    const trunk = part(MeshBuilder.CreateCylinder('whale-trunk', { height: 8, diameterTop: 3.1, diameterBottom: 1.2, tessellation: 16 }, scene));
    trunk.rotation.x = Math.PI / 2;
    trunk.position.set(0, -0.8, L / 2 - 5.5 - 4);
    const hump = part(MeshBuilder.CreateSphere('whale-hump', { diameterX: 0.8, diameterY: 0.8, diameterZ: 2, segments: 8 }, scene));
    hump.position.set(0, 0.6, -1.5);
    // The tail, on its own node so it can rise when the whale dives.
    this.tail = new TransformNode('whale-tail', scene);
    this.tail.parent = this.body;
    this.tail.position.set(0, -0.8, -L / 2 + 0.5);
    const stock = part(MeshBuilder.CreateCylinder('whale-stock', { height: 2.2, diameterTop: 1.2, diameterBottom: 0.6, tessellation: 12 }, scene), this.tail);
    stock.rotation.x = Math.PI / 2;
    stock.position.z = -0.8;
    for (const side of [-1, 1]) {
      const fluke = part(MeshBuilder.CreateBox('whale-fluke', { width: 2.4, height: 0.25, depth: 1.4 }, scene), this.tail);
      fluke.position.set(side * 1.2, 0, -2.2);
      fluke.rotation.y = side * 0.35;
    }
    // The blow.
    this.spoutMat = new StandardMaterial('whale-spout', scene);
    this.spoutMat.diffuseColor = new Color3(1, 1, 1);
    this.spoutMat.emissiveColor = new Color3(0.85, 0.85, 0.85);
    this.spoutMat.alpha = 0;
    this.spoutMat.disableDepthWrite = true;
    this.spout = MeshBuilder.CreateSphere('whale-blow', { diameterX: 1.6, diameterY: 4.5, diameterZ: 1.6, segments: 8 }, scene);
    this.spout.material = this.spoutMat;
    this.spout.parent = this.root;
    this.spout.position.set(-0.8, 2.6, L / 2 + 0.3);
    this.spout.rotation.x = 0.7; // slanting forward
    this.spout.rotation.z = 0.25; // and to the left
    this.spout.isPickable = false;
    this.root.setEnabled(false);
  }

  setVisible(on: boolean): void {
    this.root.setEnabled(on);
  }

  dispose(): void {
    this.root.dispose(false, true);
    this.spoutMat.dispose();
  }

  /** time: real seconds (for the drawing); gameTime: the game clock. */
  update(w: Whale | null, time: number, gameTime: number): void {
    if (!w) {
      this.root.setEnabled(false);
      return;
    }
    const t = gameTime - w.since;
    const show = w.phase !== 'dive' || t < 4;
    this.root.setEnabled(show);
    if (!show) return;
    const h = waveHeight(w.x, w.y, time);
    // The back and the top of the head show above the water.
    this.root.position.set(w.x, h + 1.1, w.y);
    this.root.rotation.y = w.heading;
    this.body.rotation.z = 0.04 * Math.sin(time * 0.7);
    if (w.phase === 'surface' || w.phase === 'struck') {
      this.body.rotation.x = 0;
      this.body.position.y = 0.1 * Math.sin(time * 0.9);
      this.tail.rotation.x = 0.08 * Math.sin(time * 1.3);
      // A blow every 10 s (game time), lasting 2 s.
      const k = (gameTime % 10) / 2;
      this.spoutMat.alpha = w.phase === 'surface' && k < 1 ? 0.75 * Math.sin(k * Math.PI) : 0;
      this.spout.scaling.y = 0.4 + Math.min(1, k * 2);
    } else {
      // Fluke up: the head goes down, the back arches and the tail rises out of the water,
      // then it all slides under.
      const k = Math.min(1, t / 6);
      this.spoutMat.alpha = 0;
      this.body.rotation.x = 0.35 * Math.sin(k * Math.PI * 0.9);
      this.tail.rotation.x = -1.3 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5);
      this.body.position.y = w.phase === 'dive' ? -2 - t * 2 : -1.5 * k;
    }
  }
}
