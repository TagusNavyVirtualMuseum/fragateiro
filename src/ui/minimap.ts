// Small chart of the river with the boat on it. It shows a window of about 15 km that
// follows the boat, or (with the button under it) the whole map.
import type { Destination } from '../world/destinations';
import type { LandMask } from '../world/landMask';

// Old chart colours: pale blue-grey water on parchment.
const WATER = [160, 182, 178];
const LAND = [228, 210, 170];
/** Width of the window that follows the boat, m. */
const NEAR_WIDTH = 15000;

export class Minimap {
  readonly canvas = document.createElement('canvas');
  private readonly base: HTMLCanvasElement;
  /** Metres per pixel of the pre-rendered chart. */
  private readonly mPerPx: number;
  private whole = false;
  /** Key to the symbols, under the chart. */
  private readonly legend = document.createElement('div');
  /** The part of the world shown now: north-west corner and size, m. */
  private view = { x: 0, y: 0, w: 1, h: 1 };

  constructor(
    parent: HTMLElement,
    private readonly mask: LandMask,
    destinations: Destination[],
    onPick?: (d: Destination) => void,
    private readonly widthPx = 260,
  ) {
    const m = mask.meta;
    const { width, height } = mask.sizeMetres;
    // Pre-render land, water and town names once, at the near view's scale (2 px per CSS
    // pixel, for high-DPI screens).
    this.mPerPx = NEAR_WIDTH / (widthPx * 2);
    this.base = document.createElement('canvas');
    this.base.width = Math.ceil(width / this.mPerPx);
    this.base.height = Math.ceil(height / this.mPerPx);
    const ctx = this.base.getContext('2d')!;
    const img = ctx.createImageData(this.base.width, this.base.height);
    const cellsPerPx = this.mPerPx / m.cellSize;
    for (let y = 0; y < this.base.height; y++) {
      const row = Math.min(m.height - 1, Math.floor(y * cellsPerPx)) * m.width;
      for (let x = 0; x < this.base.width; x++) {
        const c = mask.water[row + Math.min(m.width - 1, Math.floor(x * cellsPerPx))] >= 128 ? WATER : LAND;
        const o = (y * this.base.width + x) * 4;
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    ctx.font = '20px "IM Fell English", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a2c17';
    for (const d of destinations) {
      const px = (d.town.x - m.northWest.x) / this.mPerPx;
      const py = (m.northWest.y - d.town.y) / this.mPerPx;
      ctx.fillText(d.name, px, py - 7);
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    this.canvas.className = 'minimap';
    this.canvas.title = 'Chart of the river';
    this.resize();

    // Click near a town to move the boat there.
    if (onPick) {
      this.canvas.style.cursor = 'pointer';
      this.canvas.title = 'Click a town to sail from there';
      this.canvas.addEventListener('click', (e) => {
        const r = this.canvas.getBoundingClientRect();
        const cx = ((e.clientX - r.left) / r.width) * this.canvas.width;
        const cy = ((e.clientY - r.top) / r.height) * this.canvas.height;
        let best: Destination | undefined;
        let bestD = 40; // px (canvas is drawn at 2x)
        for (const d of destinations) {
          const [px, py] = this.toPx(d.town.x, d.town.y);
          const dist = Math.hypot(px - cx, py - cy);
          if (dist < bestD) {
            bestD = dist;
            best = d;
          }
        }
        if (best) onPick(best);
      });
    }
    const toggle = document.createElement('button');
    toggle.className = 'map-zoom';
    toggle.textContent = 'Whole map';
    toggle.onclick = () => {
      this.whole = !this.whole;
      toggle.textContent = this.whole ? 'Near the boat' : 'Whole map';
      this.resize();
      toggle.blur();
    };
    this.legend.className = 'map-legend';
    parent.append(this.canvas, this.legend, toggle);
  }

  /** Near view: a fixed 4:3 window; whole map: the map's own shape. */
  private resize(): void {
    const { width, height } = this.mask.sizeMetres;
    const w = this.widthPx;
    const h = this.whole ? Math.round((w * height) / width) : Math.round(w * 0.75);
    this.canvas.width = w * 2;
    this.canvas.height = h * 2;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  private toPx(x: number, y: number): [number, number] {
    const v = this.view;
    return [((x - v.x) / v.w) * this.canvas.width, ((v.y - y) / v.h) * this.canvas.height];
  }

  /** Redraw with the boat at (x east, y north) and its heading (rad). */
  draw(x: number, y: number, heading: number, target?: { x: number; y: number }, others: { x: number; y: number }[] = [], marks: { x: number; y: number }[] = [], marksAre: 'buoys' | 'shoals' = 'buoys'): void {
    const m = this.mask.meta;
    const { width, height } = this.mask.sizeMetres;
    if (this.whole) {
      this.view = { x: m.northWest.x, y: m.northWest.y, w: width, h: height };
    } else {
      const w = NEAR_WIDTH;
      const h = (w * this.canvas.height) / this.canvas.width;
      // Centred on the boat, but not past the edges of the map.
      const vx = Math.max(m.northWest.x, Math.min(m.northWest.x + width - w, x - w / 2));
      const vy = Math.min(m.northWest.y, Math.max(m.northWest.y - height + h, y + h / 2));
      this.view = { x: vx, y: vy, w, h };
    }
    const v = this.view;
    const ctx = this.canvas.getContext('2d')!;
    ctx.drawImage(this.base, (v.x - m.northWest.x) / this.mPerPx, (m.northWest.y - v.y) / this.mPerPx, v.w / this.mPerPx, v.h / this.mPerPx, 0, 0, this.canvas.width, this.canvas.height);
    // Other boats: small dark dots.
    ctx.fillStyle = '#3b2312';
    for (const o of others) {
      const [ox, oy] = this.toPx(o.x, o.y);
      ctx.beginPath();
      ctx.arc(ox, oy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Regatta buoys: yellow rings. Shoals of fish: blue-green discs.
    ctx.lineWidth = 3;
    for (const m of marks) {
      const [mx, my] = this.toPx(m.x, m.y);
      ctx.beginPath();
      if (marksAre === 'shoals') {
        ctx.arc(mx, my, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#1f8a8a';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.lineWidth = 3;
      } else {
        ctx.arc(mx, my, 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#d9a400';
        ctx.stroke();
      }
    }
    this.legend.innerHTML =
      '<span class="lg-me">▲</span> you' +
      (others.length ? ' · <span class="lg-boat">●</span> other boats' : '') +
      (marks.length ? (marksAre === 'shoals' ? ' · <span class="lg-shoal">●</span> shoals of fish' : ' · <span class="lg-buoy">○</span> regatta buoys') : '') +
      (target ? ' · <span class="lg-target">○</span> where to go' : '');
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
