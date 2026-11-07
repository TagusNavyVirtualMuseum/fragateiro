// Other boats sailing on the river around the player: each has its own physics, an
// autopilot (src/world/autopilot.ts) and a light model. They stay within a few km of the
// player: one left far behind comes back somewhere around the player, out in open water.
import type { Scene } from '@babylonjs/core';
import { SailboatSim, type BoatSpec, type WindField } from '../physics';
import { pickWaypoint, steer, type Pilot } from '../world/autopilot';
import { sailableHeading } from '../world/destinations';
import { hullAfloat, type LandMask } from '../world/landMask';
import { BoatView } from './boatView';
import { BOAT_VISUALS, LITE_URLS } from './boatVisuals';

/** Boats further than this from the player come back near it, m. */
const RANGE = 3500;
/** Not drawn beyond this distance (lost in the haze anyway), m. */
const DRAW_DISTANCE = 3000;

interface Boat {
  spec: BoatSpec;
  sim: SailboatSim;
  pilot: Pilot;
  view?: BoatView;
}

export class Traffic {
  private readonly boats: Boat[] = [];
  private visible = true;

  constructor(
    private readonly scene: Scene,
    specs: BoatSpec[],
    private readonly wind: WindField,
    private readonly mask: LandMask,
    player: { x: number; y: number },
  ) {
    for (const spec of specs) {
      const sim = new SailboatSim(spec, wind, {});
      const boat: Boat = { spec, sim, pilot: { wx: 0, wy: 0, tack: 1, nextTack: 0, lastTack: 0 } };
      this.place(boat, player);
      this.boats.push(boat);
      // Light models load in the background, one after another, after the game has started.
    }
    void this.loadModels();
  }

  private async loadModels(): Promise<void> {
    for (const b of this.boats) {
      try {
        b.view = await BoatView.load(this.scene, b.spec, { ...BOAT_VISUALS[b.spec.id], url: LITE_URLS[b.spec.id] });
        b.view.setVisible(this.visible);
      } catch (e) {
        console.warn(`could not load the light ${b.spec.id}`, e);
      }
    }
  }

  /** Put a boat somewhere in open water around the player, sailing. */
  private place(b: Boat, player: { x: number; y: number }): void {
    const spot = pickWaypoint(this.mask, player.x, player.y, Math.random, 400, 1800);
    if (!spot) return;
    const t = b.sim.state.time;
    const windFrom = this.wind.at(t, spot.x, spot.y).from;
    const heading = sailableHeading(this.mask, spot.x, spot.y, Math.random() * Math.PI * 2, windFrom, b.spec.length);
    b.sim = new SailboatSim(b.spec, this.wind, { x: spot.x, y: spot.y, heading, u: 1.5, time: t });
    b.sim.controls.balanced = true;
    this.newWaypoint(b);
  }

  private newWaypoint(b: Boat): void {
    const s = b.sim.state;
    const w = pickWaypoint(this.mask, s.x, s.y, Math.random, 600, 2000);
    if (w) Object.assign(b.pilot, { wx: w.x, wy: w.y });
  }

  setVisible(on: boolean): void {
    this.visible = on;
    for (const b of this.boats) b.view?.setVisible(on);
  }

  /** Positions for the minimap. */
  get positions(): { x: number; y: number; heading: number }[] {
    return this.visible ? this.boats.map((b) => ({ x: b.sim.state.x, y: b.sim.state.y, heading: b.sim.state.heading })) : [];
  }

  /** gameDt: simulated seconds this frame; dt: real seconds (for the drawing). */
  update(player: { x: number; y: number }, gameDt: number, time: number, dt: number): void {
    if (!this.visible) return;
    for (const b of this.boats) {
      const s = b.sim.state;
      if (Math.hypot(s.x - player.x, s.y - player.y) > RANGE) this.place(b, player);
      // Small steps (the simulator caps one step at 0.25 s).
      for (let left = gameDt; left > 1e-6; left -= 0.2) {
        const step = Math.min(0.2, left);
        const st = b.sim.state;
        const windFrom = this.wind.at(st.time, st.x, st.y).from;
        if (steer(b.sim, b.pilot, windFrom, this.mask)) this.newWaypoint(b);
        const before = { x: st.x, y: st.y, heading: st.heading };
        b.sim.step(step);
        if (!hullAfloat(this.mask, st.x, st.y, st.heading, b.spec.length)) {
          // Ran aground: back off, turn away and choose somewhere else to go.
          Object.assign(st, before, { u: 0, v: 0, r: 0 });
          st.heading += Math.PI / 2;
          this.newWaypoint(b);
        }
      }
      if (b.view) {
        const near = Math.hypot(b.sim.state.x - player.x, b.sim.state.y - player.y) < DRAW_DISTANCE;
        b.view.setVisible(near);
        if (near) b.view.update(b.sim.state, b.sim.report, b.sim.controls.rudder, time, dt);
      }
    }
  }
}
