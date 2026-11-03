// The wind made visible: faint streaks drifting past the boat with the true wind.
import { Color4, DynamicTexture, ParticleSystem, Vector3, type Scene } from '@babylonjs/core';
import type { TrueWind } from '../physics';

export class WindView {
  private readonly ps: ParticleSystem;
  private visible = true;

  constructor(scene: Scene) {
    // A soft round dot; "stretched" billboards turn it into a streak along the motion.
    const tex = new DynamicTexture('windDot', { width: 32, height: 32 }, scene, false);
    const ctx = tex.getContext() as CanvasRenderingContext2D;
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    tex.update();
    tex.hasAlpha = true;

    const ps = new ParticleSystem('wind', 1200, scene);
    ps.particleTexture = tex;
    ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    // Stretched billboards are lengthened by their speed: keep the dot small and thin.
    ps.minSize = 0.05;
    ps.maxSize = 0.08;
    ps.minScaleX = 1.2;
    ps.maxScaleX = 1.6;
    ps.minScaleY = 0.12;
    ps.maxScaleY = 0.18;
    ps.minLifeTime = 2.5;
    ps.maxLifeTime = 4;
    ps.emitRate = 450;
    ps.color1 = new Color4(1, 1, 1, 0.75);
    ps.color2 = new Color4(0.92, 0.96, 1, 0.55);
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.addSizeGradient(0, 0.05);
    ps.addSizeGradient(0.2, 1);
    ps.addSizeGradient(1, 0.6);
    ps.emitter = new Vector3(0, 0, 0);
    ps.createBoxEmitter(new Vector3(1, 0, 0), new Vector3(1, 0, 0), new Vector3(-70, 0.5, -70), new Vector3(70, 14, 70));
    ps.start();
    this.ps = ps;
  }

  setVisible(on: boolean): void {
    this.visible = on;
    if (on) this.ps.start();
    else this.ps.stop();
  }

  /** Follow the camera target; streaks move with the wind (sped up like the game clock). */
  update(centre: Vector3, wind: TrueWind, timeScale: number): void {
    if (!this.visible) return;
    // Air moves towards (−sin from, −cos from) in (east, north) = Babylon (x, z).
    const dir = new Vector3(-Math.sin(wind.from), 0, -Math.cos(wind.from));
    const speed = wind.speed * Math.min(timeScale, 4);
    this.ps.direction1 = dir;
    this.ps.direction2 = dir;
    this.ps.minEmitPower = speed * 0.9;
    this.ps.maxEmitPower = speed * 1.1;
    // Emit a little upwind, so the streaks flow over the boat.
    (this.ps.emitter as Vector3).copyFrom(centre.subtract(dir.scale(25)));
    this.ps.updateSpeed = 1 / 60;
  }
}
