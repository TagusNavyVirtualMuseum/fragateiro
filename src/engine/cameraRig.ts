// Camera views that stay attached to the boat: behind, ahead, either side, from above,
// or free (orbit with the mouse / touch). Distance and height can be changed at any time.
import { PointerEventTypes, type ArcRotateCamera } from '@babylonjs/core';

export type CameraView = 'back' | 'front' | 'port' | 'starboard' | 'top' | 'free';

export const CAMERA_VIEWS: { id: CameraView; label: string; key: string }[] = [
  { id: 'back', label: 'Behind', key: '1' },
  { id: 'front', label: 'Ahead', key: '2' },
  { id: 'port', label: 'Port', key: '3' },
  { id: 'starboard', label: 'Starboard', key: '4' },
  { id: 'top', label: 'Top', key: '5' },
  { id: 'free', label: 'Free', key: '6' },
];

/** Where the camera sits, relative to the bow (radians, clockwise). */
const BEARING: Record<Exclude<CameraView, 'free'>, number> = {
  back: Math.PI,
  front: 0,
  port: -Math.PI / 2,
  starboard: Math.PI / 2,
  top: Math.PI,
};

export const DISTANCE_RANGE = { min: 12, max: 220 };

export class CameraRig {
  view: CameraView = 'back';
  /** Distance from the boat, m. */
  distance = 45;
  /** Height of the view above the water, degrees (5 = skimming the water, 85 = nearly overhead). */
  elevation = 18;
  onChange?: () => void;

  constructor(private readonly camera: ArcRotateCamera) {
    camera.lowerRadiusLimit = DISTANCE_RANGE.min;
    camera.upperRadiusLimit = DISTANCE_RANGE.max;
    camera.lowerBetaLimit = 0.01;
    camera.upperBetaLimit = 1.5;
    camera.radius = this.distance;
    // Dragging the view switches to free orbit; the wheel / pinch changes the distance.
    camera.onViewMatrixChangedObservable.add(() => {
      if (Math.abs(camera.radius - this.distance) > 0.01) {
        this.distance = camera.radius;
        this.onChange?.();
      }
    });
    camera.getScene().onPointerObservable.add((info) => {
      if (info.type === PointerEventTypes.POINTERMOVE && info.event.buttons > 0 && this.view !== 'free') {
        this.view = 'free';
        this.onChange?.();
      }
    });
  }

  setView(view: CameraView): void {
    this.view = view;
    this.onChange?.();
  }

  setDistance(d: number): void {
    this.distance = Math.max(DISTANCE_RANGE.min, Math.min(DISTANCE_RANGE.max, d));
    this.camera.radius = this.distance;
    this.onChange?.();
  }

  setElevation(deg: number): void {
    this.elevation = Math.max(3, Math.min(85, deg));
    this.onChange?.();
  }

  /** Call every frame with the boat position (east, north) and heading. */
  update(x: number, y: number, heading: number, dt: number): void {
    const cam = this.camera;
    // Move the target in place: assigning cam.target would recompute the distance.
    const k0 = Math.min(1, dt * 6);
    cam.target.x += (x - cam.target.x) * k0;
    cam.target.y += (3 - cam.target.y) * k0;
    cam.target.z += (y - cam.target.z) * k0;
    if (this.view === 'free') return;

    // Babylon's ArcRotateCamera sits at target + r (cos α sin β, cos β, sin α sin β).
    // A camera on compass bearing b from the boat has (east, north) = (sin b, cos b),
    // so α = atan2(cos b, sin b).
    const b = heading + BEARING[this.view];
    const wantAlpha = Math.atan2(Math.cos(b), Math.sin(b));
    const wantBeta = this.view === 'top' ? 0.02 : Math.PI / 2 - (this.elevation * Math.PI) / 180;
    const k = Math.min(1, dt * 3);
    let d = wantAlpha - cam.alpha;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    cam.alpha += d * k;
    cam.beta += (wantBeta - cam.beta) * k;
  }
}
