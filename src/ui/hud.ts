// On-screen display for the sailing games: plain HTML/CSS on top of the 3D canvas.
import './hud.css';
import { groupsInMode, rad2deg, toKnots, type BoatSpec, type Controls, type ForceReport, type BoatState, type TrueWind } from '../physics';
import { CAMERA_VIEWS, DISTANCE_RANGE, type CameraView } from '../engine/cameraRig';

export interface HudCallbacks {
  onBoat(id: string): void;
  onMode(id: string): void;
  onSheet(group: string, value: number): void;
  onWind(fromDeg: number, speed: number, gusty: boolean): void;
  onForces(visible: boolean): void;
  onCameraView(view: CameraView): void;
  onCameraDistance(metres: number): void;
  onCameraHeight(degrees: number): void;
}

const GROUP_NAMES: Record<string, string> = { fore: 'Fore sail', main: 'Main sail', front: 'Front sails', rear: 'Rear sails' };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export class SailingHud {
  readonly rudderLeft: HTMLButtonElement;
  readonly rudderRight: HTMLButtonElement;
  private readonly boatBar = el('div', 'buttons');
  private readonly modeBar = el('div', 'buttons');
  private readonly about = el('p', 'about');
  private readonly sheets = el('div', 'sheets');
  private readonly readout = el('div', 'readout');
  private readonly compassBoat: SVGGElement;
  private readonly compassWind: SVGGElement;
  private readonly rudderBar = el('div', 'rudder-bar');
  private readonly rudderNeedle = el('div', 'rudder-needle');
  private readonly warning = el('div', 'warning');
  private readonly forcesBox: HTMLInputElement;
  private readonly camButtons = el('div', 'buttons');
  private readonly camDistance: HTMLInputElement;
  private readonly camHeight: HTMLInputElement;
  private readonly camHeightLabel: HTMLLabelElement;
  private sliders = new Map<string, HTMLInputElement>();

  constructor(
    root: HTMLElement,
    boats: BoatSpec[],
    private readonly cb: HudCallbacks,
    wind: { fromDeg: number; speed: number; gusty: boolean },
  ) {
    root.classList.add('hud');

    // --- Top left: boat, mode, description
    const info = el('section', 'panel info');
    info.append(el('h1', '', '<a href="../../" title="All games">⟵</a> Sailing the Tagus'), this.boatBar, this.modeBar, this.about);
    for (const b of boats) {
      const btn = el('button', '', b.name);
      btn.dataset.id = b.id;
      btn.onclick = () => cb.onBoat(b.id);
      this.boatBar.append(btn);
    }

    // --- Top right: instruments
    const inst = el('section', 'panel instruments');
    inst.innerHTML = `
      <svg viewBox="-50 -50 100 100" class="compass" aria-label="compass">
        <circle r="46" class="ring"/>
        <text y="-34" class="n">N</text><text x="36" y="4" class="t">E</text><text y="42" class="t">S</text><text x="-36" y="4" class="t">W</text>
        <g class="wind"><path d="M0,-44 L0,-20 M-6,-28 L0,-20 L6,-28"/></g>
        <g class="boat"><path d="M0,-22 C7,-10 7,12 5,20 L-5,20 C-7,12 -7,-10 0,-22 Z"/></g>
      </svg>`;
    this.compassBoat = inst.querySelector('g.boat')!;
    this.compassWind = inst.querySelector('g.wind')!;
    inst.append(this.readout, this.warning);

    // --- Bottom left: sails
    const sails = el('section', 'panel sails');
    sails.append(el('h2', '', 'Sheets <small>W/S or ↑/↓</small>'), this.sheets);

    // --- Bottom centre: rudder (touch-friendly)
    const helm = el('section', 'panel helm');
    this.rudderLeft = el('button', 'hold', '◀ Port');
    this.rudderRight = el('button', 'hold', 'Starboard ▶');
    this.rudderBar.append(this.rudderNeedle);
    const helmRow = el('div', 'helm-row');
    helmRow.append(this.rudderLeft, this.rudderBar, this.rudderRight);
    helm.append(el('h2', '', 'Rudder <small>A/D or ←/→</small>'), helmRow);

    // --- Bottom right: wind and view options
    const opts = el('section', 'panel options');
    opts.innerHTML = `
      <h2>Wind</h2>
      <label>From <input type="range" min="0" max="355" step="5" name="dir"> <output name="dirOut"></output></label>
      <label>Speed <input type="range" min="1" max="14" step="0.5" name="speed"> <output name="speedOut"></output></label>
      <label class="check"><input type="checkbox" name="gusty"> Gusts and shifts</label>
      <h2>Camera <small>keys 1–6 · drag to orbit · wheel to zoom</small></h2>
      <div class="cam-buttons"></div>
      <label>Distance <input type="range" min="${DISTANCE_RANGE.min}" max="${DISTANCE_RANGE.max}" step="1" name="camDist"> <output name="camDistOut"></output></label>
      <label class="cam-height">Height <input type="range" min="3" max="85" step="1" name="camHeight"> <output name="camHeightOut"></output></label>
      <label class="check"><input type="checkbox" name="forces"> Show forces <small>(F)</small></label>
      <p class="keys">M: change mode · B: change boat · P: pause · R: restart</p>`;
    const dir = opts.querySelector<HTMLInputElement>('[name=dir]')!;
    const speed = opts.querySelector<HTMLInputElement>('[name=speed]')!;
    const gusty = opts.querySelector<HTMLInputElement>('[name=gusty]')!;
    const forces = opts.querySelector<HTMLInputElement>('[name=forces]')!;
    const dirOut = opts.querySelector<HTMLOutputElement>('[name=dirOut]')!;
    const speedOut = opts.querySelector<HTMLOutputElement>('[name=speedOut]')!;
    dir.value = String(wind.fromDeg);
    speed.value = String(wind.speed);
    gusty.checked = wind.gusty;
    const windChanged = () => {
      dirOut.textContent = `${dir.value}°`;
      speedOut.textContent = `${speed.value} m/s · ${toKnots(Number(speed.value)).toFixed(0)} kn`;
      cb.onWind(Number(dir.value), Number(speed.value), gusty.checked);
    };
    for (const i of [dir, speed, gusty]) i.addEventListener('input', windChanged);
    windChanged();
    forces.addEventListener('change', () => cb.onForces(forces.checked));
    this.forcesBox = forces;

    opts.querySelector('.cam-buttons')!.replaceWith(this.camButtons);
    for (const v of CAMERA_VIEWS) {
      const btn = el('button', '', v.label);
      btn.dataset.view = v.id;
      btn.title = `Key ${v.key}`;
      btn.onclick = () => cb.onCameraView(v.id);
      this.camButtons.append(btn);
    }
    this.camDistance = opts.querySelector<HTMLInputElement>('[name=camDist]')!;
    this.camHeight = opts.querySelector<HTMLInputElement>('[name=camHeight]')!;
    this.camHeightLabel = opts.querySelector<HTMLLabelElement>('.cam-height')!;
    const distOut = opts.querySelector<HTMLOutputElement>('[name=camDistOut]')!;
    const heightOut = opts.querySelector<HTMLOutputElement>('[name=camHeightOut]')!;
    this.camDistance.addEventListener('input', () => {
      distOut.textContent = `${this.camDistance.value} m`;
      cb.onCameraDistance(Number(this.camDistance.value));
    });
    this.camHeight.addEventListener('input', () => {
      heightOut.textContent = `${this.camHeight.value}°`;
      cb.onCameraHeight(Number(this.camHeight.value));
    });
    this.camOutputs = { distOut, heightOut };

    // Let the arrow keys steer the boat instead of moving a focused slider.
    opts.addEventListener('change', (e) => (e.target as HTMLElement).blur());

    // On small screens the options panel opens from a button.
    const toggle = el('button', 'panel settings-toggle', '⚙ Wind & camera');
    toggle.onclick = () => opts.classList.toggle('open');

    root.append(info, inst, sails, helm, opts, toggle);
  }

  private camOutputs!: { distOut: HTMLOutputElement; heightOut: HTMLOutputElement };

  /** Show the current camera settings (also after the mouse or keys changed them). */
  setCamera(view: CameraView, distance: number, elevation: number): void {
    for (const b of this.camButtons.querySelectorAll('button')) b.classList.toggle('active', b.dataset.view === view);
    if (document.activeElement !== this.camDistance) this.camDistance.value = String(Math.round(distance));
    if (document.activeElement !== this.camHeight) this.camHeight.value = String(Math.round(elevation));
    this.camOutputs.distOut.textContent = `${Math.round(distance)} m`;
    this.camOutputs.heightOut.textContent = `${Math.round(elevation)}°`;
    this.camHeightLabel.hidden = view === 'top' || view === 'free';
  }

  setForces(visible: boolean): void {
    this.forcesBox.checked = visible;
  }

  /** Rebuild the boat-specific parts (after changing boat or mode). */
  setBoat(spec: BoatSpec, controls: Controls): void {
    for (const b of this.boatBar.querySelectorAll('button')) b.classList.toggle('active', b.dataset.id === spec.id);
    this.modeBar.replaceChildren();
    if (spec.modes.length > 1) {
      for (const m of spec.modes) {
        const btn = el('button', m.id === controls.mode ? 'active' : '', m.name);
        btn.onclick = () => this.cb.onMode(m.id);
        this.modeBar.append(btn);
      }
    }
    const mode = spec.modes.find((m) => m.id === controls.mode) ?? spec.modes[0];
    this.about.textContent = `${spec.description} ${spec.modes.length > 1 ? mode.description : ''}`;

    this.sheets.replaceChildren();
    this.sliders.clear();
    for (const g of groupsInMode(spec, mode.id)) {
      const label = el('label', 'sheet');
      const input = el('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.01';
      input.value = String(controls.sheets[g] ?? 0.5);
      input.addEventListener('input', () => this.cb.onSheet(g, Number(input.value)));
      input.addEventListener('change', () => input.blur());
      label.append(el('span', 'name', GROUP_NAMES[g] ?? g), el('span', 'end', 'in'), input, el('span', 'end', 'out'));
      this.sheets.append(label);
      this.sliders.set(g, input);
    }
  }

  update(state: BoatState, controls: Controls, report: ForceReport, wind: TrueWind, paused: boolean): void {
    const heading = (rad2deg(state.heading) + 360) % 360;
    const twa = Math.abs(report.trueWindAngleDeg);
    const pointOfSail =
      twa < 40 ? 'In irons — too close to the wind' : twa < 60 ? 'Close-hauled' : twa < 80 ? 'Close reach' : twa < 110 ? 'Beam reach' : twa < 150 ? 'Broad reach' : 'Running';
    const tack = report.trueWindAngleDeg >= 0 ? 'starboard tack' : 'port tack';
    this.readout.innerHTML = `
      <div class="big">${toKnots(Math.hypot(state.u, state.v)).toFixed(1)}<small> kn</small></div>
      <dl>
        <dt>Heading</dt><dd>${heading.toFixed(0)}°</dd>
        <dt>Point of sail</dt><dd>${pointOfSail}${twa >= 40 ? `, ${tack}` : ''}</dd>
        <dt>True wind</dt><dd>${twa.toFixed(0)}° · ${wind.speed.toFixed(1)} m/s</dd>
        <dt>Apparent wind</dt><dd>${Math.abs(report.apparentWindAngleDeg).toFixed(0)}° · ${report.apparentWindSpeed.toFixed(1)} m/s</dd>
        <dt>Heel</dt><dd>${Math.abs(rad2deg(state.heel)).toFixed(0)}°</dd>
        <dt>Drift</dt><dd>${toKnots(state.v).toFixed(1)} kn ${state.v >= 0 ? '→' : '←'}</dd>
      </dl>`;
    this.compassBoat.setAttribute('transform', `rotate(${heading})`);
    this.compassWind.setAttribute('transform', `rotate(${rad2deg(wind.from)})`);
    this.rudderNeedle.style.left = `${50 + controls.rudder * 45}%`;
    for (const [g, input] of this.sliders) {
      if (document.activeElement !== input) input.value = String(controls.sheets[g] ?? 0.5);
    }
    const luffing = report.sails.filter((s) => s.active && s.luffing).length;
    const msg = paused
      ? 'Paused (P)'
      : Math.abs(state.heel) > 0.45
        ? 'Heeling a lot — ease the sheets!'
        : luffing > 0 && twa > 45
          ? 'Sails flapping — haul in the sheets'
          : '';
    this.warning.textContent = msg;
    this.warning.hidden = !msg;
  }
}
