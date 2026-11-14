// Touch gestures on the 3D view:
//   one finger, left/right  -> rudder (follows the finger, centres again when released)
//   one finger, up/down     -> sheets (up = haul in, down = ease out)
//   two fingers, pinch      -> camera distance

export interface TouchCallbacks {
  /** Change of sheet setting (0..1 scale); negative = haul in. */
  onSheets(delta: number): void;
  /** Pinch: multiply the camera distance by this factor. */
  onZoom(factor: number): void;
}

/** Is this a phone or tablet (touch is the main way to point)? */
export const isTouchDevice = (): boolean => window.matchMedia('(pointer: coarse)').matches;

export class TouchControls {
  /** Rudder from the finger (-1..1), or null when no finger is steering. */
  rudder: number | null = null;

  private readonly points = new Map<number, { x: number; y: number }>();
  private start: { x: number; y: number } | null = null;
  private lastY = 0;
  private pinchDistance = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly cb: TouchCallbacks,
  ) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave'] as const) el.addEventListener(t, (e) => this.up(e));
  }

  private down(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // the pointer is already gone: nothing to capture
    }
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.points.size === 1) {
      this.start = { x: e.clientX, y: e.clientY };
      this.lastY = e.clientY;
    } else if (this.points.size === 2) {
      this.rudder = null; // two fingers: zoom only
      this.start = null;
      this.pinchDistance = this.spread();
    }
  }

  private move(e: PointerEvent): void {
    if (!this.points.has(e.pointerId)) return;
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.points.size === 1 && this.start) {
      const w = this.el.clientWidth;
      const h = this.el.clientHeight;
      // A quarter of the screen width to either side = rudder hard over.
      this.rudder = Math.max(-1, Math.min(1, (e.clientX - this.start.x) / (w * 0.25)));
      // Moving 40 % of the screen height takes the sheets from fully in to fully out.
      this.cb.onSheets((e.clientY - this.lastY) / (h * 0.4));
      this.lastY = e.clientY;
    } else if (this.points.size === 2) {
      const d = this.spread();
      if (this.pinchDistance > 0 && d > 0) this.cb.onZoom(this.pinchDistance / d);
      this.pinchDistance = d;
    }
  }

  private up(e: PointerEvent): void {
    if (!this.points.delete(e.pointerId)) return;
    if (this.points.size === 0) {
      this.rudder = null;
      this.start = null;
    } else if (this.points.size === 1) {
      // Back to one finger: restart steering from where it is now.
      const [p] = this.points.values();
      this.start = { ...p };
      this.lastY = p.y;
    }
  }

  private spread(): number {
    const [a, b] = [...this.points.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}
