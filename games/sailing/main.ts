// Free sailing on the Tagus: switch between the Falua and the Muleta.
import { BOATS, GustyWind, SailboatSim, defaultControls, deg2rad, groupsInMode, type BoatSpec } from '../../src/physics';
import { BOAT_VISUALS } from '../../src/engine/boatVisuals';
import { BoatView } from '../../src/engine/boatView';
import { CAMERA_VIEWS, CameraRig } from '../../src/engine/cameraRig';
import { ForceArrows } from '../../src/engine/forceArrows';
import { Input } from '../../src/engine/input';
import { TouchControls, isTouchDevice } from '../../src/engine/touchControls';
import { createMapView, loadMapMask, type MapView } from '../../src/engine/mapView';
import { getArea, toMapXY } from '../../src/world/area';

const AREA = getArea();
import { NetView } from '../../src/engine/netView';
import { createSailingScene } from '../../src/engine/scene';
import { WindView } from '../../src/engine/windView';
import { Sound } from '../../src/engine/sound';
import { Birds } from '../../src/engine/birds';
import { Wildlife } from '../../src/engine/wildlife';
import { Traffic } from '../../src/engine/traffic';
import { CourseView } from '../../src/engine/courseView';
import { MissionMenu } from '../../src/ui/missionMenu';
import { LEVELS, MissionRun, bestTimeKey, buildCourse, makeMission, type Level, type Mission } from '../../src/world/missions';
import { FishingGround } from '../../src/world/fishing';
import { ShoalView } from '../../src/engine/shoalView';
import { SailingHud } from '../../src/ui/hud';
import { getLang, t } from '../../src/i18n';
import { Minimap } from '../../src/ui/minimap';
import { findDestinations, sailableHeading, type Destination } from '../../src/world/destinations';
import { hullAfloat, type LandMask } from '../../src/world/landMask';
import type { Terrain } from '../../src/world/terrain';

const RUDDER_RATE = 1.6; // full travel per second
const RUDDER_RETURN = 1.2;
const SHEET_RATE = 0.35;
/** Turning rate when aground (pushing off with an oar), rad/s. */
const PUSH_OFF_RATE = 0.25;
const START_HEADING = deg2rad(90);

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const loading = document.getElementById('loading')!;
loading.textContent = t('game.loading');
document.title = t(AREA.id === 'tejo' ? 'game.pageTitle' : `game.pageTitle.${AREA.id}`);
document.documentElement.lang = getLang();
const { engine, scene, camera, water, skyColor, sunDirection, fogDensity, sky } = createSailingScene(canvas);
const cameraRig = new CameraRig(camera);
const arrows = new ForceArrows(scene);
const netView = new NetView(scene);
const windView = new WindView(scene);
const sound = new Sound();
const birds = new Birds(scene);
const input = new Input();

const wind = new GustyWind(0, 12 * 0.514444, 0, 0); // 12 knots
let gusty = false;
const views = new Map<string, BoatView>();
let spec: BoatSpec = BOATS.find((b) => b.id === AREA.boat) ?? BOATS[0];
let sim = new SailboatSim(spec, wind, { heading: START_HEADING });
let view: BoatView;
let mask: LandMask;
let terrain: Terrain | undefined;
let mapView: MapView;
let minimap: Minimap;
let traffic: Traffic | undefined;
let wildlife: Wildlife | undefined;
let trafficOn = true;
let start = { x: 0, y: 0 };
let aground = false;
let destinations: Destination[] = [];
let nextDestination = 0;
/** Simulated seconds per real second: speeds stay realistic, the trip goes faster. */
let timeScale = 3;
/** Difficulty: easy trims the sails automatically; hard turns off the balanced sails and
 * the help with tacking that comes with them. */
let level: Level = loadLevel();
let mission: Mission = makeMission('free', 'Lisboa', BOATS[0].id, BOATS);
/** The shoals of the fishing ground, during a fishing trip. */
let fishing: FishingGround | null = null;
let run: MissionRun | null = null;
let missionDone = false;
/** Boat a mission requires (others cannot be chosen meanwhile), or null in free sailing. */
let requiredBoat: string | null = null;
let target: Destination | null = null;
let targetSince = 0;
let arrivedAt: number | null = null;
const ARRIVAL_RADIUS = 150; // m
let paused = false;
let time = 0;

const hud = new SailingHud(document.getElementById('hud')!, BOATS, {
  onBoat: (id) => void switchBoat(id),
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
  onTimeScale: (k) => (timeScale = k),
  onMissions: () => {
    paused = true;
    menu.show();
  },
  onWindVisible: (on) => windView.setVisible(on),
  onSound: (on) => sound.setMuted(!on),
  onTraffic: (on) => {
    trafficOn = on;
    traffic?.setVisible(on);
  },
}, { fromDeg: wind.fromDeg, speed: wind.speed, gusty });
// Phones and tablets: gestures on the 3D view steer and trim; the camera keeps its views
// (buttons) but does not orbit with one finger.
const touch = new TouchControls(canvas, {
  onSheets: (delta) => {
    if (level === 'easy') return;
    for (const g of groupsInMode(spec, sim.controls.mode)) {
      sim.controls.sheets[g] = Math.max(0, Math.min(1, (sim.controls.sheets[g] ?? 0.5) + delta));
    }
  },
  onZoom: (factor) => cameraRig.setDistance(cameraRig.distance * factor),
});
if (isTouchDevice()) camera.inputs.removeByType('ArcRotateCameraPointersInput');
input.bindHoldButton(hud.rudderLeft, 'KeyA');
input.bindHoldButton(hud.rudderRight, 'KeyD');

/** Boats load the first time they are picked (only the first one loads at start). */
const pending = new Map<string, Promise<BoatView>>();
function loadView(id: string): Promise<BoatView> {
  let p = pending.get(id);
  if (!p) {
    const b = BOATS.find((x) => x.id === id)!;
    p = BoatView.load(scene, b, BOAT_VISUALS[id]).then((v) => {
      v.setVisible(false);
      views.set(id, v);
      return v;
    });
    pending.set(id, p);
    p.catch(() => pending.delete(id)); // allow a retry
  }
  return p;
}

/** The boat last asked for (may still be loading). */
let wanted = BOATS[0].id;

async function switchBoat(id: string): Promise<void> {
  if (requiredBoat && id !== requiredBoat) return;
  wanted = id;
  if (id === spec.id) return;
  if (!views.has(id)) {
    hud.setBoatLoading(id, true);
    try {
      await loadView(id);
    } catch (e) {
      console.error(e);
      return;
    } finally {
      hud.setBoatLoading(id, false);
    }
    if (wanted !== id) return; // another boat was picked meanwhile
  }
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
  sim = new SailboatSim(spec, wind, { ...start, heading: START_HEADING });
  aground = false;
  hud.setBoat(spec, sim.controls);
}

/** Move the boat (stopped) to a town's mooring, bow towards open water. */
function teleport(d: Destination): void {
  const t = sim.state.time;
  const heading = sailableHeading(mask, d.x, d.y, d.heading, wind.at(t, d.x, d.y).from, spec.length);
  sim = new SailboatSim(spec, wind, { x: d.x, y: d.y, heading, time: t });
  sim.controls.mode = spec.modes[0].id;
  aground = false;
  camera.target.set(d.x, camera.target.y, d.y);
  targetSince = sim.state.time;
  arrivedAt = null;
  hud.setBoat(spec, sim.controls);
}

/**
 * Advance the boat, but never onto land. When a step would put the hull on land the boat
 * stays where it was, stopped; the rudder keys then turn it in place (like pushing off with
 * an oar) until the wind can carry it back into open water.
 */
function stepWithLand(dt: number): void {
  const s = sim.state;
  const before = { x: s.x, y: s.y, heading: s.heading };
  sim.step(dt);
  if (hullAfloat(mask, s.x, s.y, s.heading, spec.length)) {
    aground = false;
    return;
  }
  aground = true;
  Object.assign(s, before, { u: 0, v: 0, r: 0 });
  const turn = sim.controls.rudder * PUSH_OFF_RATE * dt;
  if (turn && hullAfloat(mask, s.x, s.y, s.heading + turn, spec.length)) s.heading += turn;
}

input.onPress('KeyM', cycleMode);
input.onPress('KeyB', () => {
  if (requiredBoat) return;
  const i = BOATS.findIndex((b) => b.id === wanted);
  void switchBoat(BOATS[(i + 1) % BOATS.length].id);
});
input.onPress('KeyP', () => (paused = !paused));
input.onPress('KeyN', () => {
  sound.setMuted(sound.enabled);
  hud.setSound(sound.enabled);
});
input.onPress('KeyR', () => (run ? void startMission(mission, level) : restart()));
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
  if (touch.rudder !== null) c.rudder = touch.rudder;
  else if (left !== right) c.rudder = Math.max(-1, Math.min(1, c.rudder + (right ? 1 : -1) * RUDDER_RATE * dt));
  else c.rudder -= Math.sign(c.rudder) * Math.min(Math.abs(c.rudder), RUDDER_RETURN * dt);

  if (level === 'easy') {
    // The crew trims: every sail eased to the best angle for the wind it feels.
    Object.assign(c.sheets, sim.bestSheets());
    return;
  }
  const haul = input.held('KeyW', 'ArrowUp');
  const ease = input.held('KeyS', 'ArrowDown');
  if (haul !== ease) {
    for (const g of groupsInMode(spec, c.mode)) {
      c.sheets[g] = Math.max(0, Math.min(1, (c.sheets[g] ?? 0.5) + (ease ? 1 : -1) * SHEET_RATE * dt));
    }
  }
}

const courseView = new CourseView(scene);
const shoalView = new ShoalView(scene);
const menu = new MissionMenu(document.getElementById('hud')!, BOATS, readBest, (m, l) => void startMission(m, l), level);

function loadLevel(): Level {
  try {
    const l = localStorage.getItem('fragateiro.level');
    if (l === 'easy' || l === 'medium' || l === 'hard') return l;
  } catch {
    // storage blocked: use the default
  }
  return 'medium';
}

function readBest(id: string, l: Level): number | null {
  try {
    const v = localStorage.getItem(bestTimeKey(id, l));
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

/** Start a mission at a level: boat, start position, course or destination, clock. */
async function startMission(m: Mission, l: Level): Promise<void> {
  menu.hide();
  level = l;
  try {
    localStorage.setItem('fragateiro.level', l);
  } catch {
    // storage blocked: the level is just not remembered
  }
  mission = m;
  missionDone = false;
  run = null;
  fishing = null;
  shoalView.clear();
  courseView.setCourse(null);
  target = null;
  mapView.setTarget(null);
  // Free sailing starts in the chosen boat but lets you change; missions keep their boat.
  requiredBoat = null;
  if (m.boat !== spec.id) await switchBoat(m.boat);
  requiredBoat = m.kind === 'free' ? null : m.boat;
  const levelName = LEVELS.find((x) => x.id === l)!.name;
  if (m.kind === 'free') {
    const from = destinations.find((d) => d.name === m.from);
    if (from) teleport(from);
  } else if (m.kind === 'fishing') {
    const at = destinations.find((d) => d.name === m.at);
    if (at) {
      teleport(at);
      // The ground: open water about a kilometre off the port.
      let centre = { x: at.x + Math.sin(at.heading) * 1000, y: at.y + Math.cos(at.heading) * 1000 };
      if (!mask.isReachable(centre.x, centre.y)) centre = { x: at.x, y: at.y };
      fishing = new FishingGround(mask, centre, 6, Math.random, { x: sim.state.x, y: sim.state.y });
      run = new MissionRun(m, sim.state.time, null, null);
    }
  } else if (m.kind === 'transport') {
    const from = destinations.find((d) => d.name === m.from);
    const to = destinations.find((d) => d.name === m.to);
    if (from && to) {
      teleport(from);
      run = new MissionRun(m, sim.state.time, null, { x: to.x, y: to.y });
    }
  } else if (m.kind === 'regatta') {
    const at = destinations.find((d) => d.name === m.at);
    if (at) {
      // The course is laid in open water about 700 m off the port, to the wind of the day.
      let centre = { x: at.x + Math.sin(at.heading) * 700, y: at.y + Math.cos(at.heading) * 700 };
      if (!mask.isReachable(centre.x, centre.y)) centre = { x: at.x, y: at.y };
      const windFrom = wind.at(sim.state.time, centre.x, centre.y).from;
      const course = buildCourse(mask, centre, windFrom, m.buoys);
      if (course) {
        // Start just to leeward of the line, sailing across the wind.
        const sx = course.start.x - Math.sin(windFrom) * 80;
        const sy = course.start.y - Math.cos(windFrom) * 80;
        const heading = sailableHeading(mask, sx, sy, windFrom + Math.PI / 2, windFrom, spec.length);
        sim = new SailboatSim(spec, wind, { x: sx, y: sy, heading, u: 1.5, time: sim.state.time });
        aground = false;
        camera.target.set(sx, camera.target.y, sy);
        courseView.setCourse(course);
        run = new MissionRun(m, sim.state.time, course, null);
      }
    }
  }
  hud.setMission(m.title, levelName, m.kind === 'free', requiredBoat, l === 'easy');
  if (m.kind === 'free') run = null;
  hud.setBoat(spec, sim.controls);
  paused = false;
}

function finishMission(): void {
  if (!run) return;
  missionDone = true;
  const t = run.elapsed(sim.state.time);
  const before = readBest(mission.id, level);
  const record = before === null || t < before;
  if (record) {
    try {
      localStorage.setItem(bestTimeKey(mission.id, level), String(t));
    } catch {
      // storage blocked: the best time is just not kept
    }
  }
  paused = true;
  menu.showResult(mission, level, t, before, record, () => void startMission(mission, level));
}

/**
 * The net's top rope in the world while fishing, on the windward side (as NetView draws it),
 * or null when the net is not out.
 */
function netSweep() {
  const net = spec.net;
  if (!net || !sim.mode.net) return null;
  const s = sim.state;
  const side = sim.report.trueWindAngleDeg >= 0 ? 1 : -1;
  const [bow, stern] = net.points;
  const span = (bow[0] - stern[0]) * 0.75;
  const mid = (bow[0] + stern[0]) / 2;
  const sh = Math.sin(s.heading);
  const ch = Math.cos(s.heading);
  const world = (fwd: number, stbd: number) => ({ x: s.x + fwd * sh + stbd * ch, y: s.y + fwd * ch - stbd * sh });
  return { a: world(mid + span / 2, side * 13), b: world(mid - span / 2, side * 13), sway: s.v, surge: s.u };
}

/** Hills: never let the camera end up inside the land (lift it over the slope instead). */
function keepCameraAboveGround(): void {
  if (!terrain) return;
  camera.getViewMatrix(true); // refresh the camera position after the rig moved it
  const p = camera.position;
  const ground = mask.isWater(p.x, p.z) ? 0 : Math.max(0, terrain.heightAt(p.x, p.z));
  const minY = ground + 3;
  if (p.y >= minY) return;
  // Arc-rotate camera: height above the target = radius * cos(beta).
  const c = Math.min(1, Math.max(-1, (minY - camera.target.y) / camera.radius));
  camera.beta = Math.max(0.05, Math.min(camera.beta, Math.acos(c)));
}

async function main(): Promise<void> {
  const [first, map] = await Promise.all([loadView(spec.id), loadMapMask()]);
  mask = map.mask;
  terrain = map.terrain;
  await document.fonts.ready; // labels and minimap are drawn once, with the period font
  mapView = createMapView(scene, mask, skyColor, sunDirection, fogDensity, AREA.ports, map.terrain);
  const s0 = AREA.start ? toMapXY(mask.meta.origin, AREA.start) : { x: 0, y: 0 };
  start = mask.nearestWater(s0.x, s0.y);
  mask.markReachableFrom(start.x, start.y);
  destinations = findDestinations(mask, 16, AREA.ports);
  // In free sailing, click a town on the minimap to sail from there.
  minimap = new Minimap(hud.mapSlot, mask, destinations, (d) => {
    if (!run) teleport(d);
  });
  menu.setPorts(destinations.map((d) => d.name));
  hud.setTargets(destinations.map((d) => d.name), (name) => {
    target = destinations.find((d) => d.name === name) ?? null;
    targetSince = sim.state.time;
    arrivedAt = null;
    mapView.setTarget(target);
  });
  input.onPress('KeyT', () => {
    if (!destinations.length || run) return;
    teleport(destinations[nextDestination % destinations.length]);
    nextDestination++;
  });
  const credit = document.createElement('div');
  credit.className = 'credit';
  credit.textContent = t('map.credit');
  hud.mapSlot.append(credit);
  restart();
  view = first;
  view.setVisible(true);
  hud.setBoat(spec, sim.controls);
  loading.classList.add('done');
  // Other boats on the river (light models, loaded in the background): one of each, and a
  // second Falua.
  // Only boats of these waters sail around the player (the pinasse stays in Arcachon); where
  // no boat of ours is at home, a few of the player's kind.
  const local = BOATS.filter((b) => (b.home ?? 'tejo') === AREA.id);
  traffic = new Traffic(scene, local.length ? [...local, local[0]] : [spec, spec], wind, mask, sim.state);
  traffic.setVisible(trafficOn);
  // Dolphins (up to Lisbon) and orcas (open Atlantic), now and then.
  if (AREA.tagusExtras) wildlife = new Wildlife(scene, mask);
  if (wildlife) wildlife.onSighting = (species, side) => {
    const name = t(species === 'orca' ? 'wild.orcas' : 'wild.dolphins');
    hud.toast(side === 'ahead' || side === 'astern' ? t(`wild.${side}`, { name }) : t('wild.side', { name, side: t(`nav.${side}`) }));
  };
  // Start with the mission menu.
  paused = true;
  menu.show();
  // Handy in the browser console and for automated checks.
  Object.assign(window, { game: { get wildlife() { return wildlife; }, netSweep, get fishing() { return fishing; }, get run() { return run; }, get sim() { return sim; }, camera, scene, cameraRig, mask, destinations, teleport, views, switchBoat, get traffic() { return traffic; } } });

  engine.runRenderLoop(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
    if (!paused) {
      applyInput(dt);
      sim.controls.balanced = level !== 'hard';
      sim.controls.noDrift = level === 'easy';
      stepWithLand(dt * timeScale);
      time += dt;
      if (fishing && run && !missionDone) {
        fishing.update(netSweep(), dt * timeScale);
        if (mission.kind === 'fishing' && fishing.caught >= mission.targetKg) {
          run.finishedAt = sim.state.time;
          finishMission();
        }
      } else if (run && !missionDone && run.update(sim.state.x, sim.state.y, sim.state.time)) finishMission();
    }
    const s = sim.state;
    const w = wind.at(s.time, s.x, s.y);
    view.update(s, sim.report, sim.controls.rudder, time, dt);
    arrows.update(view.root, sim.report, w, s.heading, 12);
    netView.update(view.root, spec.net, !!sim.mode.net, s, sim.report.trueWindAngleDeg >= 0, time);
    mapView.update(time, camera);
    traffic?.update(s, paused ? 0 : dt * timeScale, time, dt);
    courseView.update(run?.next ?? -1, time);
    if (fishing) shoalView.update(fishing.shoals, sim.state.time, dt);
    const shoal = fishing ? fishing.nearest(s.x, s.y) : null;
    const goal = fishing ? shoal : run ? run.goal : target;
    minimap.draw(s.x, s.y, s.heading, goal ?? undefined, traffic?.positions, run?.course?.buoys ?? fishing?.shoals.filter((x) => x.kg >= 5), fishing ? 'shoals' : 'buoys');
    let nav = null;
    if (fishing && run && mission.kind === 'fishing') {
      const dx = (shoal?.x ?? s.x) - s.x;
      const dy = (shoal?.y ?? s.y) - s.y;
      // The tall orange post marks the nearest shoal, except on the hard level.
      mapView.setTarget(level === 'hard' ? null : shoal);
      nav = {
        title: t('fish.catch', { kg: Math.floor(fishing.caught), target: mission.targetKg }),
        name: t(sim.mode.net ? 'fish.nearest' : 'fish.nearestM'),
        distance: Math.hypot(dx, dy),
        bearing: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360,
        elapsed: run.elapsed(s.time),
        arrived: missionDone,
      };
    } else if (run && run.goal) {
      const g = run.goal;
      const dx = g.x - s.x;
      const dy = g.y - s.y;
      mapView.setTarget(g);
      nav = {
        name: run.goalName,
        distance: Math.hypot(dx, dy),
        bearing: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360,
        elapsed: run.elapsed(s.time),
        arrived: missionDone,
      };
    } else if (target) {
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const distance = Math.hypot(dx, dy);
      if (arrivedAt === null && distance < ARRIVAL_RADIUS) arrivedAt = s.time;
      nav = {
        name: target.name,
        distance,
        bearing: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360,
        elapsed: (arrivedAt ?? s.time) - targetSince,
        arrived: arrivedAt !== null,
      };
    }
    cameraRig.update(s.x, s.y, s.heading, dt);
    keepCameraAboveGround();
    windView.update(camera.target, w, timeScale, paused ? 0 : dt);
    const still = paused ? 0 : dt;
    sky.update(still * timeScale, w.from, w.speed);
    birds.update(camera.target, -Math.sin(w.from) * w.speed, -Math.cos(w.from) * w.speed, still);
    wildlife?.update(s, time, still);
    const set = sim.report.sails.filter((x) => x.active);
    sound.update(
      {
        apparentWind: paused ? 0 : sim.report.apparentWindSpeed,
        boatSpeed: paused ? 0 : Math.hypot(s.u, s.v),
        flapping: paused || !set.length ? 0 : set.filter((x) => x.luffing).length / set.length,
      },
      dt,
    );
    water.update(time, camera.target, camera.position);
    // Keep the water out of the hull, so open holds stay dry.
    water.setHull({ ...view.hullProfile, x: s.x, y: s.y, heading: s.heading, heave: view.waterlineHeight });
    hud.update(s, sim.controls, sim.report, w, paused, aground, nav);
    scene.render();
  });
}

main().catch((e) => {
  loading.textContent = t('game.error', { msg: e?.message ?? e });
  console.error(e);
});
