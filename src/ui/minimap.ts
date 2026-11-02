// Small map of the whole estuary with the boat on it.
import type { LandMask } from '../world/landMask';

const WATER = [92, 150, 180];
const LAND = [214, 205, 176];

export class Minimap {
  readonly canvas = document.createElement('canvas');
  private readonly base: HTMLCanvasElement;
  private readonly scale: number;

  constructor(
    parent: HTMLElement,
    private readonly mask: LandMask,
    widthPx = 260,
  ) {
    const m = mask.meta;
    this.scale = widthPx / m.width;
    const w = widthPx;
    const h = Math.round(m.height * this.scale);
    this.canvas.width = w * 2; // sharp on high-DPI screens
    this.canvas.height = h * 2;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.className = 'minimap';
    this.canvas.title = 'Map of the estuary';

    // Pre-render land and water once.
    this.base = document.createElement('canvas');
    this.base.width = w * 2;
    this.base.height = h * 2;
    const ctx = this.base.getContext('2d')!;
    const img = ctx.createImageData(w * 2, h * 2);
    for (let y = 0; y < h * 2; y++) {
      for (let x = 0; x < w * 2; x++) {
        const v = mask.water[Math.floor(y / (2 * this.scale)) * m.width + Math.floor(x / (2 * this.scale))] / 255;
        const c = v >= 0.5 ? WATER : LAND;
        const o = (y * w * 2 + x) * 4;
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const p of m.places) {
      if (p.kind !== 'city' && p.kind !== 'town') continue;
      const [px, py] = this.toPx(p.x, p.y);
      ctx.fillStyle = '#3d3528';
      ctx.fillText(p.name, px, py - 6);
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    parent.append(this.canvas);
  }

  private toPx(x: number, y: number): [number, number] {
    const m = this.mask.meta;
    return [((x - m.northWest.x) / m.cellSize) * this.scale * 2, ((m.northWest.y - y) / m.cellSize) * this.scale * 2];
  }

  /** Redraw with the boat at (x east, y north) and its heading (rad). */
  draw(x: number, y: number, heading: number, target?: { x: number; y: number }): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.drawImage(this.base, 0, 0);
    if (target) {
      const [tx, ty] = this.toPx(target.x, target.y);
      ctx.strokeStyle = '#e3a33b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(tx, ty, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    const [px, py] = this.toPx(x, y);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.fillStyle = '#c0262d';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(7, 9);
    ctx.lineTo(-7, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}
