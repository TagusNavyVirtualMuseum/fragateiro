// The boat workshop: load a model (from Meshy or a scan) or a side photo, give the boat's
// size and weight, click its points on the side view (bow, stern, masts, the corners of each
// sail by rig type, the rudder, the ropes), and build a model the game can sail, with its
// physics. The preview sails it with the game's own boat view and physics.
import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/im-fell-english/latin-400.css';
import {
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  FreeCamera,
  HemisphericLight,
  LoadAssetContainerAsync,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Texture,
  Vector3,
  type AssetContainer,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { buildBoat, specSource, visualSource, type BuildResult, type Project, type SailInput } from '../../src/workshop/build';
import { RIGS, RIG_TYPES, type RigType } from '../../src/workshop/rigs';
import { bellyCurve, type P2 } from '../../src/workshop/geometry';
import { SailboatSim, SteadyWind, groupsInMode, polar, type BoatSpec } from '../../src/physics';
import { BoatView } from '../../src/engine/boatView';
import type { BoatVisual } from '../../src/engine/boatVisuals';
import { AREA_IDS } from '../../src/world/area';

// ---------------------------------------------------------------- project and storage
const KEY = 'fragateiro.workshop';

function defaults(): Project {
  return {
    source: 'model',
    info: { id: 'newboat', name: 'New boat', length: 10, beam: 2.5, mass: 2000, home: 'tejo', description: '' },
    bow: [0, 0],
    stern: [0, 0],
    masts: [],
    sails: [],
    rudder: [],
    ropes: [],
    sailWidth: 0.05,
    sparRadius: 0.02,
    ropeRadius: 0.012,
    sheer: [],
    keel: [],
    transom: false,
    colors: { bottom: '#7a2418', topsides: '#efeee9', stripe: '#c9a227', sail: '#ece6d6', spar: '#5a2618' },
  };
}
let project: Project = (() => {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { ...defaults(), ...JSON.parse(s) };
  } catch {
    // nothing saved
  }
  return defaults();
})();
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(project));
  } catch {
    // storage blocked
  }
};
const has = (p: P2) => p[0] !== 0 || p[1] !== 0;

// ---------------------------------------------------------------- 3D: side view and preview
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const side = new Scene(engine);
side.useRightHandedSystem = true; // as glTF: x along the boat, y up, z to port, seen from port
side.clearColor = new Color4(0.86, 0.9, 0.94, 1);
new HemisphericLight('l', new Vector3(0.2, 1, 0.6), side).intensity = 1.2;
const cam = new FreeCamera('side', new Vector3(0, 0, 50), side);
cam.mode = Camera.ORTHOGRAPHIC_CAMERA;
cam.setTarget(new Vector3(0, 0, 0));
cam.minZ = 0.01;
cam.maxZ = 1000;
side.setRenderingAutoClearDepthStencil(1, true);
let view = { cx: 0, cy: 0, w: 2 };
/** The side view is drawn only for a few frames after something changes (the model can be heavy). */
let sideFrames = 30;
const touch = () => (sideFrames = Math.max(sideFrames, 20));
function setOrtho() {
  touch();
  const aspect = engine.getRenderWidth() / engine.getRenderHeight();
  cam.position.set(view.cx, view.cy, 50);
  cam.setTarget(new Vector3(view.cx, view.cy, 0));
  cam.orthoLeft = -view.w / 2;
  cam.orthoRight = view.w / 2;
  cam.orthoTop = view.w / aspect / 2;
  cam.orthoBottom = -view.w / aspect / 2;
}
setOrtho();

const preview = new Scene(engine);
preview.clearColor = new Color4(0.78, 0.85, 0.9, 1);
new HemisphericLight('sky', new Vector3(0, 1, 0), preview).intensity = 0.9;
new DirectionalLight('sun', new Vector3(0.4, -0.5, 0.6), preview).intensity = 2;
const pcam = new ArcRotateCamera('pcam', -Math.PI / 3, 1.2, 30, Vector3.Zero(), preview);
pcam.attachControl(canvas, true);
pcam.wheelDeltaPercentage = 0.01;
const sea = MeshBuilder.CreateDisc('sea', { radius: 200, tessellation: 64 }, preview);
sea.rotation.x = Math.PI / 2;
const seaMat = new StandardMaterial('sea', preview);
seaMat.diffuseColor = new Color3(0.1, 0.32, 0.4);
seaMat.specularColor = new Color3(0.2, 0.2, 0.2);
seaMat.alpha = 0.85;
sea.material = seaMat;

let tab: 'side' | 'preview' = 'side';
let source: AssetContainer | null = null;
let photoPlane: Mesh | null = null;
let sourceBytes: Uint8Array | null = null;

// The boat sailing in the preview: held in place, the wind steady, sheets and rudder from the panel.
let pview: BoatView | null = null;
let psim: SailboatSim | null = null;
let pspec: BoatSpec | null = null;
const pctl = { windDeg: 60, sheet: 0.3, rudder: 0 };
let time = 0;
/** Check mode: parts in flat colours, sails and rudder swinging. */
let checking = false;
const partColours = new Map<string, Color3>();
const originalMaterials = new Map<Mesh, StandardMaterial | null>();
function setCheck(on: boolean) {
  checking = on;
  if (!pview) return;
  for (const m of preview.meshes) {
    // The part a mesh belongs to: its own name or an ancestor's (Casco, Vela_x, Leme).
    let n: { name: string; parent: unknown } | null = m as unknown as { name: string; parent: unknown };
    let part = '';
    while (n) {
      if (/^(Casco|Leme|Vela_.+)$/.test(n.name.replace(/_primitive\d+$/, ''))) {
        part = n.name.replace(/_primitive\d+$/, '');
        break;
      }
      n = n.parent as typeof n;
    }
    if (!part) continue;
    const mesh = m as Mesh;
    if (on) {
      if (!originalMaterials.has(mesh)) originalMaterials.set(mesh, mesh.material as StandardMaterial | null);
      if (!partColours.has(part)) {
        const i = pspec?.sails.findIndex((s) => `Vela_${s.id}` === part) ?? -1;
        partColours.set(part, part === 'Casco' ? new Color3(0.38, 0.38, 0.4) : part === 'Leme' ? new Color3(0.1, 0.8, 0.2) : Color3.FromHexString(SAIL_COLOURS[Math.max(0, i) % SAIL_COLOURS.length]));
      }
      const mat = new StandardMaterial(`check-${part}`, preview);
      mat.diffuseColor = partColours.get(part)!;
      mat.backFaceCulling = false;
      mesh.material = mat;
    } else if (originalMaterials.has(mesh)) {
      mesh.material = originalMaterials.get(mesh)!;
    }
  }
  if (!on) originalMaterials.clear();
}

engine.runRenderLoop(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
  time += dt;
  if (tab === 'side') {
    if (sideFrames > 0) {
      side.render();
      sideFrames--;
    }
  }
  else {
    if (psim && pview && pspec) {
      for (const g of groupsInMode(pspec, 'sailing')) psim.controls.sheets[g] = pctl.sheet;
      psim.controls.rudder = pctl.rudder;
      psim.step(dt);
      // Held in place, heading free: the wind turns with the slider.
      Object.assign(psim.state, { x: 0, y: 0 });
      if (checking) {
        // Swing every sail through its range and the rudder from side to side, the boat still.
        const st = { ...psim.state, heel: 0, heading: 0, sailAngles: { ...psim.state.sailAngles } };
        for (const s of pspec.sails) st.sailAngles[s.id] = Math.sin(time * 0.8) * ((s.maxAngle * Math.PI) / 180);
        pview.update(st, psim.report, Math.sin(time * 1.3), time, dt);
      } else pview.update(psim.state, psim.report, psim.controls.rudder, time, dt);
      const kn = (Math.hypot(psim.state.u, psim.state.v) / 0.514444).toFixed(1);
      const twa = Math.round(psim.report.trueWindAngleDeg);
      const out = document.getElementById('pspeed');
      if (out) out.textContent = `${kn} kn · wind ${twa}° off the bow`;
    }
    preview.render();
  }
});
window.addEventListener('resize', () => {
  engine.resize();
  setOrtho();
});

// ---------------------------------------------------------------- loading
async function loadModel(bytes: Uint8Array) {
  sourceBytes = bytes;
  source?.dispose();
  photoPlane?.dispose();
  photoPlane = null;
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'model/gltf-binary' }));
  source = await LoadAssetContainerAsync(url, side, { pluginExtension: '.glb' });
  source.addAllToScene();
  sideFrames = 120; // textures arrive over a few frames
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const m of source.meshes) {
    m.computeWorldMatrix(true);
    const b = m.getBoundingInfo().boundingBox;
    if (!m.getTotalVertices()) continue;
    min = Vector3.Minimize(min, b.minimumWorld);
    max = Vector3.Maximize(max, b.maximumWorld);
  }
  frame(min.x, min.y, max.x, max.y);
  const L = max.x - min.x;
  if (!has(project.bow)) {
    project.sailWidth = +(0.025 * L).toFixed(4);
    project.sparRadius = +(0.011 * L).toFixed(4);
    project.ropeRadius = +(0.006 * L).toFixed(4);
  }
  status(`Model loaded: ${(bytes.length / 1e6).toFixed(1)} MB.`);
  redraw();
}

async function loadPhoto(file: File) {
  sourceBytes = null;
  source?.dispose();
  source = null;
  photoPlane?.dispose();
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  const w = 10;
  const h = (w * img.height) / img.width;
  photoPlane = MeshBuilder.CreatePlane('photo', { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE }, side);
  photoPlane.position.set(w / 2, h / 2, -0.01);
  const m = new StandardMaterial('photo', side);
  m.diffuseTexture = new Texture(url, side);
  m.emissiveColor = new Color3(1, 1, 1);
  m.disableLighting = true;
  photoPlane.material = m;
  frame(0, 0, w, h);
  status('Photo loaded: one unit is a tenth of its width.');
  redraw();
}

function frame(x0: number, y0: number, x1: number, y1: number) {
  view = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: Math.max(x1 - x0, ((y1 - y0) * engine.getRenderWidth()) / engine.getRenderHeight()) * 1.15 };
  setOrtho();
}

// ---------------------------------------------------------------- clicking points
interface Capture {
  labels: string[];
  /** Fixed number of points, or a list ended with Enter (at least `min`). */
  count?: number;
  min?: number;
  points: P2[];
  done: (pts: P2[]) => void;
}
let capture: Capture | null = null;
const promptBox = document.getElementById('prompt')!;
function showPrompt() {
  if (!capture) {
    promptBox.style.display = 'none';
    return;
  }
  const i = capture.points.length;
  const label = capture.labels[Math.min(i, capture.labels.length - 1)];
  promptBox.style.display = 'block';
  promptBox.innerHTML = `Click: ${label}<small>${capture.count ? `point ${i + 1} of ${capture.count}` : `${i} so far: Enter when done`} · Esc to cancel</small>`;
}
function startCapture(c: Omit<Capture, 'points'>) {
  setTab('side');
  capture = { ...c, points: [] };
  showPrompt();
  redraw();
}
function finishCapture() {
  if (!capture) return;
  const c = capture;
  if (!c.count && c.points.length < (c.min ?? 1)) return;
  capture = null;
  c.done(c.points);
  showPrompt();
  changed();
}
function worldAt(ev: PointerEvent | WheelEvent): P2 {
  const r = canvas.getBoundingClientRect();
  const ray = side.createPickingRay(ev.clientX - r.left, ev.clientY - r.top, null, cam);
  return [ray.origin.x, ray.origin.y];
}
let pan: { x: number; y: number; cx: number; cy: number } | null = null;
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('pointerdown', (e) => {
  if (tab !== 'side') return;
  if (e.button === 2 || e.button === 1) {
    pan = { x: e.clientX, y: e.clientY, cx: view.cx, cy: view.cy };
    return;
  }
  if (e.button === 0 && capture) {
    capture.points.push(worldAt(e));
    if (capture.count && capture.points.length >= capture.count) finishCapture();
    else {
      showPrompt();
      redraw();
    }
  }
});
window.addEventListener('pointermove', (e) => {
  if (!pan) return;
  const k = view.w / canvas.clientWidth;
  view.cx = pan.cx - (e.clientX - pan.x) * k;
  view.cy = pan.cy + (e.clientY - pan.y) * k;
  setOrtho();
});
window.addEventListener('pointerup', () => (pan = null));
canvas.addEventListener('wheel', (e) => {
  if (tab !== 'side') return;
  e.preventDefault();
  const before = worldAt(e);
  view.w *= Math.exp(e.deltaY * 0.001);
  setOrtho();
  const after = worldAt(e);
  view.cx += before[0] - after[0];
  view.cy += before[1] - after[1];
  setOrtho();
});
window.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea, select')) return;
  if (e.key === 'Escape' && capture) {
    capture = null;
    showPrompt();
    redraw();
  }
  if (e.key === 'Enter') finishCapture();
});

// ---------------------------------------------------------------- overlay
const SAIL_COLOURS = ['#d62828', '#1f6fd6', '#2a9d3a', '#9b30c8', '#e07b00', '#0aa5a5'];
let overlay: Mesh[] = [];
function redraw() {
  touch();
  for (const m of overlay) m.dispose();
  overlay = [];
  const z = 40;
  const k = view.w * 0.008;
  const line = (pts: P2[], colour: string, closed = false) => {
    if (pts.length < 2) return;
    const ps = pts.map((p) => new Vector3(p[0], p[1], z));
    if (closed) ps.push(ps[0]);
    const l = MeshBuilder.CreateLines('ov', { points: ps }, side);
    l.color = Color3.FromHexString(colour);
    l.renderingGroupId = 1;
    l.isPickable = false;
    overlay.push(l);
  };
  const mark = (p: P2, colour: string) => {
    line([[p[0] - k, p[1] - k], [p[0] + k, p[1] + k]], colour);
    line([[p[0] - k, p[1] + k], [p[0] + k, p[1] - k]], colour);
  };
  const P = project;
  if (has(P.bow)) mark(P.bow, '#ff0000');
  if (has(P.stern)) mark(P.stern, '#00a000');
  if (has(P.bow) && has(P.stern)) line([P.bow, P.stern], '#888888');
  line(P.sheer, '#ffffff');
  line(P.keel, '#333333');
  for (const m of P.masts) {
    line([m.foot, m.top], '#5a2618');
    mark(m.foot, '#5a2618');
    mark(m.top, '#5a2618');
  }
  P.sails.forEach((s, i) => {
    const c = SAIL_COLOURS[i % SAIL_COLOURS.length];
    for (const p of s.points) mark(p, c);
    if (s.points.length === RIGS[s.rig].points.length) {
      // A square sail: its curve, and the straight line closing the area taken as sail.
      if (s.rig === 'square') line(bellyCurve(s.points[0], s.points[1], s.points[2]), c, true);
      else line(s.points, c, true);
    }
    const rig = RIGS[s.rig];
    for (const [a, b] of rig.spars) {
      const ia = rig.points.indexOf(a);
      const ib = rig.points.indexOf(b);
      if (s.points[ia] && s.points[ib]) {
        line([s.points[ia], s.points[ib]], '#5a2618');
      }
    }
  });
  line(P.rudder, '#00c060', true);
  if (P.tiller) line(P.tiller, '#00c060');
  for (const a of P.hullAreas ?? []) line(a, '#40c0ff', true);
  for (const r of P.ropes) line([r.a, r.b], r.mode === 'remove' ? '#ff00ff' : r.mode === 'fixed' ? '#666666' : '#ff8c00');
  if (capture) {
    for (const p of capture.points) mark(p, '#ff8c00');
    line(capture.points, '#ff8c00');
  }
}

// ---------------------------------------------------------------- panel
const panel = document.getElementById('panel')!;
const statusLine = () => document.getElementById('status');
function status(text: string) {
  const s = statusLine();
  if (s) s.textContent = text;
}
let built: (BuildResult & { glb: Uint8Array }) | null = null;

function changed() {
  save();
  render();
  redraw();
}

const tabs = document.getElementById('tabs')!;
function setTab(t: 'side' | 'preview') {
  tab = t;
  touch();
  if (t === 'side') pcam.detachControl();
  else pcam.attachControl(canvas, true);
  tabs.innerHTML = '';
  for (const [id, label] of [
    ['side', 'Side view'],
    ['preview', '3D preview'],
  ] as const) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = id === tab ? 'active' : 'secondary';
    b.onclick = () => setTab(id);
    tabs.append(b);
  }
}
setTab('side');

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const okMark = (ok: boolean) => (ok ? '<span class="ok">✓</span>' : '<span class="todo">·</span>');

function render() {
  const P = project;
  const model = P.source === 'model';
  panel.innerHTML = `
    <h1>Boat workshop</h1>
    <p class="note">Build a boat for the game from a model or a photo. Your work is kept in this browser; save the project to keep it elsewhere.</p>

    <h2>1 · Source</h2>
    <div class="row">
      <label style="flex:1"><span>Made from</span><select id="src"><option value="model" ${model ? 'selected' : ''}>a 3D model (.glb)</option><option value="photo" ${!model ? 'selected' : ''}>a side photo</option></select></label>
    </div>
    <div class="row"><input type="file" id="file" accept="${model ? '.glb' : 'image/*'}" /></div>
    <p class="note">${model ? 'Download the GLB with textures from Meshy. Its sails can be kept or rebuilt from the points you click.' : 'A photo from the side, the whole hull visible. The hull is shaped from the lines you click.'}</p>
    <label><span>Id</span><input type="text" id="i-id" value="${esc(P.info.id)}" /></label>
    <label><span>Name</span><input type="text" id="i-name" value="${esc(P.info.name)}" /></label>
    <label><span>Length (m)</span><input type="number" step="0.1" id="i-length" value="${P.info.length}" /></label>
    <label><span>Beam (m)</span><input type="number" step="0.1" id="i-beam" value="${P.info.beam}" /></label>
    <label><span>Weight (kg)</span><input type="number" step="10" id="i-mass" value="${P.info.mass}" /></label>
    <label><span>Stability GM (m)</span><input type="number" step="0.1" id="i-gm" value="${P.info.gm ?? ''}" placeholder="estimated" /></label>
    <label><span>Home waters</span><select id="i-home">${AREA_IDS.map((a) => `<option ${a === P.info.home ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
    <label><span>Description</span><textarea id="i-desc">${esc(P.info.description)}</textarea></label>

    <h2>2 · Hull</h2>
    <div class="row">${okMark(has(P.bow))}<button id="c-bow">Bow</button>${okMark(has(P.stern))}<button id="c-stern">Stern</button></div>
    <p class="note">Click the very front and the very back of the hull (the tips of the stem and the stern). Their distance is the length.</p>
    ${
      model
        ? `<label><span>Sails off centre</span><input type="number" step="0.005" id="t-sail" value="${P.sailWidth}" /></label>
           <label><span>Spar thickness</span><input type="number" step="0.002" id="t-spar" value="${P.sparRadius}" /></label>
           <label><span>Rope thickness</span><input type="number" step="0.002" id="t-rope" value="${P.ropeRadius}" /></label>
           <p class="note">In the model's units: how far a sail may bulge from the centreline, how thick the masts and yards are. Make them larger if parts of a sail stay behind, smaller if bits of the hull go with it.</p>`
        : `<div class="row">${okMark(P.sheer.length > 1)}<button id="c-sheer">Sheer line</button>${okMark(P.keel.length > 1)}<button id="c-keel">Keel line</button></div>
           <p class="note">Sheer: the top edge of the side, from bow to stern (several points). Keel: the bottom of the hull (several points).</p>
           <label><span>Transom stern</span><input type="checkbox" id="transom" ${P.transom ? 'checked' : ''} /></label>
           <div class="row">${(['bottom', 'topsides', 'stripe', 'sail', 'spar'] as const).map((c) => `<label style="width:auto"><span style="width:auto">${c}</span><input type="color" id="col-${c}" value="${P.colors[c]}" /></label>`).join('')}</div>`
    }

    <h2>3 · Masts</h2>
    ${P.masts.map((_, i) => `<div class="item"><div class="head"><strong>Mast ${i + 1}</strong><button class="secondary" data-mast-redo="${i}">Click again</button><button class="secondary" data-mast-del="${i}">✕</button></div></div>`).join('')}
    <button id="add-mast">+ Mast (click its foot, then its top)</button>

    <h2>4 · Sails</h2>
    ${P.sails
      .map((s, i) => {
        const done = s.points.length === RIGS[s.rig].points.length;
        return `<div class="item"><div class="head"><span class="swatch" style="background:${SAIL_COLOURS[i % SAIL_COLOURS.length]}"></span><strong>${esc(s.id)} · ${RIGS[s.rig].name}</strong>${okMark(done)}</div>
          <label><span>Id</span><input type="text" data-sail-id="${i}" value="${esc(s.id)}" /></label>
          <label><span>Rig</span><select data-sail-rig="${i}">${RIG_TYPES.map((r) => `<option value="${r}" ${r === s.rig ? 'selected' : ''}>${RIGS[r].name}</option>`).join('')}</select></label>
          <p class="note">${RIGS[s.rig].hint}</p>
          ${model ? `<label><span>Keep model's sail</span><input type="checkbox" data-sail-keep="${i}" ${s.keep ? 'checked' : ''} /></label>` : ''}
          ${s.rig === 'square' ? `<label><span>Yard length (m)</span><input type="number" step="0.1" data-sail-yard="${i}" value="${s.yardLength ?? +(P.info.beam * 2).toFixed(1)}" /></label>` : ''}
          <div class="row"><button data-sail-click="${i}">Click its points</button><button class="secondary" data-sail-del="${i}">Remove</button></div></div>`;
      })
      .join('')}
    <div class="row"><select id="new-rig">${RIG_TYPES.map((r) => `<option value="${r}">${RIGS[r].name}</option>`).join('')}</select><button id="add-sail">+ Sail</button></div>

    <h2>5 · Rudder</h2>
    <div class="row">${okMark(P.rudder.length >= 3)}<button id="c-rudder">Blade outline</button>${okMark(!!P.tiller)}<button id="c-tiller">Tiller</button></div>
    <p class="note">The blade: click round its outline (Enter to close). The tiller: its two ends. A steering oar (like the rabelo's) is drawn the same way.</p>
    ${
      model
        ? `<h2>Keep with hull</h2>
           ${(P.hullAreas ?? []).map((_, i) => `<div class="item"><div class="head"><strong>Area ${i + 1}</strong><button class="secondary" data-area-del="${i}">✕</button></div></div>`).join('')}
           <button id="add-area">+ Area (click round it, Enter to close)</button>
           <p class="note">If the check shows bits of the hull moving with a sail or the rudder, draw round them here: everything inside stays with the hull. Then build again.</p>`
        : ''
    }

    ${
      model
        ? `<h2>6 · Ropes</h2>
           ${P.ropes
             .map(
               (r, i) => `<div class="item"><div class="head"><strong>Rope ${i + 1}</strong>
             <select data-rope-mode="${i}"><option value="remove" ${r.mode === 'remove' ? 'selected' : ''}>remove</option><option value="fixed" ${r.mode === 'fixed' ? 'selected' : ''}>fixed (stay, shroud)</option><option value="sail" ${r.mode === 'sail' ? 'selected' : ''}>moves with sail</option></select>
             ${r.mode === 'sail' ? `<select data-rope-sail="${i}">${P.sails.map((s) => `<option ${s.id === r.sail ? 'selected' : ''}>${esc(s.id)}</option>`).join('')}</select>` : ''}
             <button class="secondary" data-rope-del="${i}">✕</button></div></div>`,
             )
             .join('')}
           <button id="add-rope">+ Rope (click both ends)</button>
           <p class="note">Ropes in the model are fixed to the hull. Mark those that should go (they would hang in the air when the sail turns), stay (stays and shrouds), or turn with a sail (halyards). The game draws the sheets itself.</p>`
        : ''
    }

    <h2>${model ? 7 : 6} · Build</h2>
    <div class="row"><button class="big" id="build">Build the boat</button></div>
    <div id="status" class="note"></div>
    ${built ? report(built) : ''}

    <h2>Project</h2>
    <div class="row"><button class="secondary" id="save-json">Save project</button><label class="secondary" style="width:auto"><span style="width:auto">Open</span><input type="file" id="load-json" accept=".json" /></label><button class="secondary" id="reset">New</button></div>
  `;
  bind();
}

function report(b: BuildResult & { glb: Uint8Array }): string {
  const sp = b.spec;
  const pol = polar(sp, 'sailing', 6, [45, 60, 90, 120, 150, 180]);
  return `
    <p class="note">Model: ${(b.glb.length / 1e6).toFixed(1)} MB · ${Object.entries(b.report.triangles).map(([k, v]) => `${k} ${v}`).join(' · ')}<br>
    Waterline ${sp.hull.waterlineLength.toFixed(2)} m · draft ${sp.draft.toFixed(2)} m · lateral area ${sp.hull.lateralArea.toFixed(2)} m² · rudder ${sp.rudder.area.toFixed(2)} m²<br>
    ${sp.sails.map((s) => `${s.id}: ${s.area.toFixed(1)} m² (${s.group})`).join(' · ')}</p>
    <table><tr><th>wind</th>${pol.map((p) => `<th>${p.twaDeg}°</th>`).join('')}</tr><tr><td>knots</td>${pol.map((p) => `<td>${p.surgeKn.toFixed(1)}</td>`).join('')}</tr><tr><td>heel</td>${pol.map((p) => `<td>${Math.abs(p.heelDeg).toFixed(0)}°</td>`).join('')}</tr></table>
    <p class="note">Speeds in 12 knots of wind, sheets at their best.</p>
    <h2>Preview</h2>
    <label><span>Check parts</span><input type="checkbox" id="p-check" ${checking ? 'checked' : ''} /></label>
    <p class="note">Colours each part (hull grey, sails in their colours, rudder green) and swings the sails and the rudder from side to side: anything that moves in the wrong colour was cut wrongly.</p>
    <label><span>Wind from</span><input type="range" min="0" max="180" id="p-wind" value="${pctl.windDeg}" /></label>
    <label><span>Sheets</span><input type="range" min="0" max="1" step="0.01" id="p-sheet" value="${pctl.sheet}" /></label>
    <label><span>Rudder</span><input type="range" min="-1" max="1" step="0.01" id="p-rudder" value="${pctl.rudder}" /></label>
    <p class="note" id="pspeed"></p>
    <h2>Download</h2>
    <div class="row"><button id="dl-glb">${esc(sp.id)}.glb</button><button id="dl-spec">${esc(sp.id)}.ts (physics)</button><button id="dl-visual">wiring</button></div>
    <p class="note">Send these three to add the boat to the game: the model goes in src/assets/models, the physics in src/physics/boats, the wiring in src/engine/boatVisuals.ts.</p>`;
}

const num = (id: string) => Number((document.getElementById(id) as HTMLInputElement).value);
function bind() {
  const P = project;
  const on = (id: string, ev: string, fn: (e: Event) => void) => document.getElementById(id)?.addEventListener(ev, fn);
  on('src', 'change', (e) => {
    P.source = (e.target as HTMLSelectElement).value as 'model' | 'photo';
    changed();
  });
  on('file', 'change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    if (P.source === 'model') await loadModel(new Uint8Array(await f.arrayBuffer()));
    else await loadPhoto(f);
  });
  const info = () => {
    P.info.id = (document.getElementById('i-id') as HTMLInputElement).value.trim().toLowerCase().replace(/[^a-z0-9]/g, '') || 'newboat';
    P.info.name = (document.getElementById('i-name') as HTMLInputElement).value;
    P.info.length = num('i-length');
    P.info.beam = num('i-beam');
    P.info.mass = num('i-mass');
    const gm = (document.getElementById('i-gm') as HTMLInputElement).value;
    P.info.gm = gm ? Number(gm) : undefined;
    P.info.home = (document.getElementById('i-home') as HTMLSelectElement).value;
    P.info.description = (document.getElementById('i-desc') as HTMLTextAreaElement).value;
    save();
  };
  for (const id of ['i-id', 'i-name', 'i-length', 'i-beam', 'i-mass', 'i-gm', 'i-home', 'i-desc']) on(id, 'change', info);
  on('c-bow', 'click', () => startCapture({ labels: ['the bow (front tip of the hull)'], count: 1, done: ([p]) => (P.bow = p) }));
  on('c-stern', 'click', () => startCapture({ labels: ['the stern (back tip of the hull)'], count: 1, done: ([p]) => (P.stern = p) }));
  on('c-sheer', 'click', () => startCapture({ labels: ['the sheer line, from bow to stern'], min: 2, done: (pts) => (P.sheer = pts) }));
  on('c-keel', 'click', () => startCapture({ labels: ['the keel line (bottom of the hull), from bow to stern'], min: 2, done: (pts) => (P.keel = pts) }));
  on('transom', 'change', (e) => {
    P.transom = (e.target as HTMLInputElement).checked;
    save();
  });
  for (const c of ['bottom', 'topsides', 'stripe', 'sail', 'spar'] as const)
    on(`col-${c}`, 'change', (e) => {
      P.colors[c] = (e.target as HTMLInputElement).value;
      save();
    });
  const tol = (id: string, key: 'sailWidth' | 'sparRadius' | 'ropeRadius') => on(id, 'change', () => ((P[key] = num(id)), save()));
  tol('t-sail', 'sailWidth');
  tol('t-spar', 'sparRadius');
  tol('t-rope', 'ropeRadius');
  const mastCapture = (i: number | null) =>
    startCapture({
      labels: ['the foot of the mast (where it meets the deck)', 'the top of the mast'],
      count: 2,
      done: ([foot, top]) => {
        if (i === null) P.masts.push({ foot, top });
        else P.masts[i] = { foot, top };
      },
    });
  on('add-mast', 'click', () => mastCapture(null));
  panel.querySelectorAll<HTMLElement>('[data-mast-redo]').forEach((b) => (b.onclick = () => mastCapture(Number(b.dataset.mastRedo))));
  panel.querySelectorAll<HTMLElement>('[data-mast-del]').forEach((b) => (b.onclick = () => (P.masts.splice(Number(b.dataset.mastDel), 1), changed())));
  const sailCapture = (s: SailInput) => startCapture({ labels: RIGS[s.rig].points, count: RIGS[s.rig].points.length, done: (pts) => (s.points = pts) });
  on('add-sail', 'click', () => {
    const rig = (document.getElementById('new-rig') as HTMLSelectElement).value as RigType;
    const used = new Set(P.sails.map((s) => s.id));
    const base = rig === 'jib' ? 'jib' : used.has('main') ? 'mizzen' : 'main';
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}${n}`;
    const s: SailInput = { id, rig, points: [], keep: P.source === 'model' };
    P.sails.push(s);
    render();
    sailCapture(s);
  });
  panel.querySelectorAll<HTMLElement>('[data-sail-click]').forEach((b) => (b.onclick = () => sailCapture(P.sails[Number(b.dataset.sailClick)])));
  panel.querySelectorAll<HTMLElement>('[data-sail-del]').forEach((b) => (b.onclick = () => (P.sails.splice(Number(b.dataset.sailDel), 1), changed())));
  panel.querySelectorAll<HTMLInputElement>('[data-sail-id]').forEach((b) => (b.onchange = () => ((P.sails[Number(b.dataset.sailId)].id = b.value.trim() || 'sail'), changed())));
  panel.querySelectorAll<HTMLSelectElement>('[data-sail-rig]').forEach(
    (b) =>
      (b.onchange = () => {
        const s = P.sails[Number(b.dataset.sailRig)];
        s.rig = b.value as RigType;
        s.points = [];
        changed();
        sailCapture(s);
      }),
  );
  panel.querySelectorAll<HTMLInputElement>('[data-sail-keep]').forEach((b) => (b.onchange = () => ((P.sails[Number(b.dataset.sailKeep)].keep = b.checked), save())));
  panel.querySelectorAll<HTMLInputElement>('[data-sail-yard]').forEach((b) => (b.onchange = () => ((P.sails[Number(b.dataset.sailYard)].yardLength = Number(b.value)), save())));
  on('c-rudder', 'click', () => startCapture({ labels: ['round the rudder blade'], min: 3, done: (pts) => (P.rudder = pts) }));
  on('c-tiller', 'click', () => startCapture({ labels: ['the front end of the tiller', 'the back end of the tiller'], count: 2, done: ([a, b]) => (P.tiller = [a, b]) }));
  on('add-rope', 'click', () => startCapture({ labels: ['one end of the rope', 'the other end'], count: 2, done: ([a, b]) => P.ropes.push({ a, b, mode: 'remove' }) }));
  panel.querySelectorAll<HTMLSelectElement>('[data-rope-mode]').forEach(
    (b) =>
      (b.onchange = () => {
        const r = P.ropes[Number(b.dataset.ropeMode)];
        r.mode = b.value as 'remove' | 'fixed' | 'sail';
        if (r.mode === 'sail' && !r.sail) r.sail = P.sails[0]?.id;
        changed();
      }),
  );
  panel.querySelectorAll<HTMLSelectElement>('[data-rope-sail]').forEach((b) => (b.onchange = () => ((P.ropes[Number(b.dataset.ropeSail)].sail = b.value), save())));
  panel.querySelectorAll<HTMLElement>('[data-rope-del]').forEach((b) => (b.onclick = () => (P.ropes.splice(Number(b.dataset.ropeDel), 1), changed())));
  on('build', 'click', () => void build());
  on('add-area', 'click', () => startCapture({ labels: ['round the part that must stay with the hull'], min: 3, done: (pts) => (P.hullAreas = [...(P.hullAreas ?? []), pts]) }));
  panel.querySelectorAll<HTMLElement>('[data-area-del]').forEach((b) => (b.onclick = () => (P.hullAreas!.splice(Number(b.dataset.areaDel), 1), changed())));
  on('p-check', 'change', (e) => setCheck((e.target as HTMLInputElement).checked));
  on('p-wind', 'input', (e) => {
    pctl.windDeg = Number((e.target as HTMLInputElement).value);
    if (psim) psim.state.heading = (pctl.windDeg * Math.PI) / 180;
  });
  on('p-sheet', 'input', (e) => (pctl.sheet = Number((e.target as HTMLInputElement).value)));
  on('p-rudder', 'input', (e) => (pctl.rudder = Number((e.target as HTMLInputElement).value)));
  on('dl-glb', 'click', () => built && download(`${built.spec.id}.glb`, built.glb, 'model/gltf-binary'));
  on('dl-spec', 'click', () => built && download(`${built.spec.id}.ts`, specSource(built.spec), 'text/plain'));
  on('dl-visual', 'click', () => built && download(`${built.spec.id}-wiring.ts`, visualSource(built.spec.id, built.visual), 'text/plain'));
  on('save-json', 'click', () => download(`${P.info.id}-workshop.json`, JSON.stringify(P, null, 2), 'application/json'));
  on('load-json', 'change', async (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    project = { ...defaults(), ...JSON.parse(await f.text()) };
    changed();
  });
  on('reset', 'click', () => {
    if (!confirm('Start a new boat? The current points are cleared.')) return;
    project = defaults();
    built = null;
    changed();
  });
}

function download(name: string, data: Uint8Array | string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data as BlobPart], { type }));
  a.download = name;
  a.click();
}

// ---------------------------------------------------------------- build
function missing(): string | null {
  const P = project;
  if (P.source === 'model' && !sourceBytes) return 'Load the model first.';
  if (P.source === 'photo' && !photoPlane) return 'Load the photo first.';
  if (!has(P.bow) || !has(P.stern)) return 'Click the bow and the stern.';
  if (P.source === 'photo' && (P.sheer.length < 2 || P.keel.length < 2)) return 'Click the sheer and keel lines.';
  if (!P.sails.length) return 'Add at least one sail.';
  for (const s of P.sails) if (s.points.length !== RIGS[s.rig].points.length) return `Click all the points of the sail "${s.id}".`;
  if (P.sails.some((s) => s.rig !== 'jib') && !P.masts.length) return 'Add the mast.';
  if (P.rudder.length < 3) return 'Click the rudder outline.';
  return null;
}

async function compressTexture(data: Uint8Array, mime: string) {
  const bmp = await createImageBitmap(new Blob([data as BlobPart], { type: mime }));
  const k = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const type = mime === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await c.convertToBlob({ type, quality: 0.85 });
  return { data: new Uint8Array(await blob.arrayBuffer()), mime: type };
}

async function build() {
  const why = missing();
  if (why) {
    status(why);
    return;
  }
  status('Building…');
  await new Promise((r) => setTimeout(r, 30));
  try {
    const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
    const src = project.source === 'model' ? await io.readBinary(sourceBytes!) : null;
    const r = await buildBoat(project, src, { compressTexture });
    const glb = await io.writeBinary(r.doc);
    built = { ...r, glb };
    await showPreview();
    render();
    status('Built. Look at it in the 3D preview; change the points and build again if needed.');
  } catch (e) {
    console.error(e);
    status(`Could not build: ${(e as Error).message}`);
  }
}

async function showPreview() {
  if (!built) return;
  checking = false;
  originalMaterials.clear();
  pview?.dispose();
  const url = URL.createObjectURL(new Blob([built.glb as BlobPart], { type: 'model/gltf-binary' }));
  pspec = built.spec;
  pview = await BoatView.load(preview, pspec, { ...(built.visual as unknown as BoatVisual), url });
  psim = new SailboatSim(pspec, new SteadyWind(0, 6), { heading: (pctl.windDeg * Math.PI) / 180, u: 1.5 });
  psim.controls.mode = 'sailing';
  psim.controls.balanced = true;
  pcam.radius = pspec.length * 2.2;
  pcam.target.set(0, pspec.length * 0.3, 0);
  setTab('preview');
}

render();
redraw();
