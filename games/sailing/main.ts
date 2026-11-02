// Free sailing on the Tagus: switch between the Falua and the Muleta.
import { BOATS, GustyWind, SailboatSim, defaultControls, deg2rad, groupsInMode, type BoatSpec } from '../../src/physics';
import { BOAT_VISUALS } from '../../src/engine/boatVisuals';
import { BoatView } from '../../src/engine/boatView';
import { CAMERA_VIEWS, CameraRig } from '../../src/engine/cameraRig';
import { ForceArrows } from '../../src/engine/forceArrows';
import { Input } from '../../src/engine/input';
import { Marks } from '../../src/engine/marks';
import { NetView } from '../../src/engine/netView';
import { createSailingScene } from '../../src/engine/scene';
import { SailingHud } from '../../src/ui/hud';

const RUDDER_RATE = 1.6; // full travel per second
const RUDDER_RETURN = 1.2;
const SHEET_RATE = 0.35;

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const loading = document.getElementById('loading')!;
const { engine, scene, camera, water } = createSailingScene(canvas);
const cameraRig = new CameraRig(camera);
const marks = new Marks(scene);
const arrows = new ForceArrows(scene);
const netView = new NetView(scene);
const input = new Input();

const wind = new GustyWind(0, 6, 0, 0);
let gusty = false;
const views = new Map<string, BoatView>();
let spec: BoatSpec = BOATS[0];
let sim = new SailboatSim(spec, wind, { heading: deg2rad(90) });
let view: BoatView;
let paused = false;
let time = 0;

const hud = new SailingHud(document.getElementById('hud')!, BOATS, {
  onBoat: (id) => switchBoat(id),
  onMode: (id) => setMode(id),
  onSheet: (g, v) => (sim.controls.sheets[g] = v),
  onWind: (fromDeg, speed, g) => {
    wind.fromDeg = fromDeg;
    wind.speed = speed;
    gusty = g;
    wind.gust = g ? 0.3 : 0;
    wind.shiftDeg = g ? 15 : 0;
  },
  onForces: (v) => (arrows.visible = v),
  onCameraView: (v) => cameraRig.setView(v),
  onCameraDistance: (d) => cameraRig.setDistance(d),
  onCameraHeight: (h) => cameraRig.setElevation(h),
}, { fromDeg: wind.fromDeg, speed: wind.speed, gusty });
input.bindHoldButton(hud.rudderLeft, 'KeyA');
input.bindHoldButton(hud.rudderRight, 'KeyD');

function switchBoat(id: string): void {
  if (id === spec.id || !views.has(id)) return;
  const old = sim.state;
  spec = BOATS.find((b) => b.id === id)!;
  sim = new SailboatSim(spec, wind, { x: old.x, y: old.y, heading: old.heading, u: old.u, v: old.v, r: old.r, time: old.time });
  view.setVisible(false);
  view = views.get(id)!;
  view.setVisible(true);
  arrows.reset();
  hud.setBoat(spec, sim.controls);
}

function setMode(id: string): void {
  const sheets = sim.controls.sheets;
  sim.controls = { ...defaultControls(spec, id), sheets: { ...defaultControls(spec, id).sheets, ...sheets } };
  if (id === 'fishing') for (const g of groupsInMode(spec, id)) sim.controls.sheets[g] = 0.1; // fishing starts with sheets in
  hud.setBoat(spec, sim.controls);
}

function cycleMode(): void {
  const i = spec.modes.findIndex((m) => m.id === sim.controls.mode);
  setMode(spec.modes[(i + 1) % spec.modes.length].id);
}

function restart(): void {
  sim = new SailboatSim(spec, wind, { heading: deg2rad(90) });
  hud.setBoat(spec, sim.controls);
}

input.onPress('KeyM', cycleMode);
input.onPress('KeyB', () => switchBoat(BOATS[(BOATS.indexOf(spec) + 1) % BOATS.length].id));
input.onPress('KeyP', () => (paused = !paused));
input.onPress('KeyR', restart);
for (const v of CAMERA_VIEWS) input.onPress(`Digit${v.key}`, () => cameraRig.setView(v.id));
input.onPress('KeyC', () => cameraRig.setView('back'));
cameraRig.onChange = () => hud.setCamera(cameraRig.view, cameraRig.distance, cameraRig.elevation);
hud.setCamera(cameraRig.view, cameraRig.distance, cameraRig.elevation);
input.onPress('KeyF', () => {
  arrows.visible = !arrows.visible;
  hud.setForces(arrows.visible);
});

function applyInput(dt: number): void {
  const c = sim.controls;
  const left = input.held('KeyA', 'ArrowLeft');
  const right = input.held('KeyD', 'ArrowRight');
  if (left !== right) c.rudder = Math.max(-1, Math.min(1, c.rudder + (right ? 1 : -1) * RUDDER_RATE * dt));
  else c.rudder -= Math.sign(c.rudder) * Math.min(Math.abs(c.rudder), RUDDER_RETURN * dt);

  const haul = input.held('KeyW', 'ArrowUp');
  const ease = input.held('KeyS', 'ArrowDown');
  if (haul !== ease) {
    for (const g of groupsInMode(spec, c.mode)) {
      c.sheets[g] = Math.max(0, Math.min(1, (c.sheets[g] ?? 0.5) + (ease ? 1 : -1) * SHEET_RATE * dt));
    }
  }
}

async function main(): Promise<void> {
  const loaded = await Promise.all(BOATS.map((b) => BoatView.load(scene, b, BOAT_VISUALS[b.id])));
  for (const v of loaded) {
    views.set(v.spec.id, v);
    v.setVisible(false);
  }
  view = views.get(spec.id)!;
  view.setVisible(true);
  hud.setBoat(spec, sim.controls);
  loading.classList.add('done');
  // Handy in the browser console and for automated checks.
  Object.assign(window, { game: { get sim() { return sim; }, camera, scene, cameraRig } });

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    if (!paused) {
      applyInput(dt);
      sim.step(dt);
      time += dt;
    }
    const s = sim.state;
    const w = wind.at(s.time, s.x, s.y);
    view.update(s, sim.report, sim.controls.rudder, time, dt);
    arrows.update(view.root, sim.report, w, s.heading, 12);
    netView.update(view.root, spec.net, !!sim.mode.net, s);
    marks.update(time);
    cameraRig.update(s.x, s.y, s.heading, dt);
    water.update(time, camera.target, camera.position);
    hud.update(s, sim.controls, sim.report, w, paused);
    scene.render();
  });
}

main().catch((e) => {
  loading.textContent = `Could not start: ${e?.message ?? e}`;
  console.error(e);
});
