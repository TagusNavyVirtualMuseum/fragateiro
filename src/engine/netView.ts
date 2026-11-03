// The Muleta's net while fishing: a rigid net on the windward side, its top rope floating on
// the water and its bottom a few metres down, held by two ropes from the boom tips that sag
// and sway (the "flexible" part).
import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  Vector3,
  type LinesMesh,
  type Scene,
  type TransformNode,
} from '@babylonjs/core';
import type { BoatState, NetSpec } from '../physics';
import { waveHeight } from './waves';

const COLS = 14;

export class NetView {
  private net?: Mesh;
  private ropes?: LinesMesh;
  private side = 1;
  private readonly mat: StandardMaterial;

  constructor(private readonly scene: Scene) {
    // Netting: a grid of knotted lines, transparent between them.
    const tex = new DynamicTexture('netTex', { width: 128, height: 128 }, scene, true);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(200, 182, 138, 0.9)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 128);
      ctx.moveTo(0, i);
      ctx.lineTo(128, i);
      ctx.stroke();
    }
    tex.update();
    tex.hasAlpha = true;
    tex.uScale = 10;
    tex.vScale = 3;
    this.mat = new StandardMaterial('netMat', scene);
    this.mat.diffuseTexture = tex;
    this.mat.useAlphaFromDiffuseTexture = true;
    this.mat.backFaceCulling = false;
    this.mat.specularColor = Color3.Black();
    this.mat.emissiveColor = new Color3(0.12, 0.1, 0.07);
    this.mat.alpha = 0.7;
  }

  /**
   * @param windFromStarboard which side the net streams to (to windward)
   */
  update(root: TransformNode, net: NetSpec | undefined, active: boolean, state: BoatState, windFromStarboard: boolean, time: number): void {
    const show = !!net && active && net.points.length >= 2;
    this.net?.setEnabled(show);
    this.ropes?.setEnabled(show);
    if (!show || !net) return;

    // Swing smoothly to the windward side when the boat changes tack.
    this.side += ((windFromStarboard ? 1 : -1) - this.side) * 0.05;
    const s = this.side;
    const sh = Math.sin(state.heading);
    const ch = Math.cos(state.heading);
    // Boat frame (forward, starboard) -> world (x east, z north), ignoring heel.
    const world = (fwd: number, stbd: number, y: number) => new Vector3(state.x + fwd * sh + stbd * ch, y, state.y + fwd * ch - stbd * sh);

    const [bow, stern] = net.points;
    const span = (bow[0] - stern[0]) * 0.75;
    const top: Vector3[] = [];
    const mid: Vector3[] = [];
    const bottom: Vector3[] = [];
    for (let i = 0; i < COLS; i++) {
      const t = i / (COLS - 1);
      const fwd = span / 2 - span * t + (bow[0] + stern[0]) / 2;
      const bag = Math.sin(Math.PI * t); // the net bellies out in the middle
      const p = world(fwd, s * (11 + 4 * bag), 0);
      p.y = waveHeight(p.x, p.z, time) + 0.05; // the top rope floats
      top.push(p);
      mid.push(world(fwd * 0.92, s * (13 + 6 * bag), -2.2 - 0.8 * bag));
      bottom.push(world(fwd * 0.82, s * (15 + 8 * bag), -4 - 1.5 * bag));
    }

    // Ropes from the boom tips to the two ends of the net's top rope, sagging and swaying.
    const tipHeights = [1.0, 3.4];
    const ropes: Vector3[][] = [];
    const m = root.getWorldMatrix();
    [bow, stern].forEach(([fwd, stbd], k) => {
      const a = Vector3.TransformCoordinates(new Vector3(stbd, tipHeights[k], fwd), m);
      const b = k === 0 ? top[0] : top[COLS - 1];
      const line: Vector3[] = [];
      for (let j = 0; j <= 16; j++) {
        const t = j / 16;
        const p = Vector3.Lerp(a, b, t);
        const sag = (1.6 + 0.25 * Math.sin(time * 1.3 + k * 2)) * 4 * t * (1 - t);
        p.y -= sag;
        line.push(p);
      }
      ropes.push(line);
    });

    if (!this.net) {
      this.net = MeshBuilder.CreateRibbon('net', { pathArray: [top, mid, bottom], updatable: true, sideOrientation: Mesh.DOUBLESIDE }, this.scene);
      this.net.material = this.mat;
      this.net.isPickable = false;
      this.ropes = MeshBuilder.CreateLineSystem('netRopes', { lines: ropes, updatable: true }, this.scene);
      this.ropes.color = new Color3(0.75, 0.66, 0.48);
      this.ropes.isPickable = false;
    } else {
      MeshBuilder.CreateRibbon('net', { pathArray: [top, mid, bottom], instance: this.net });
      MeshBuilder.CreateLineSystem('netRopes', { lines: ropes, instance: this.ropes });
    }
  }
}
