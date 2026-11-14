// On-screen display for the sailing games: plain HTML/CSS on top of the 3D canvas.
import { canFullscreen, canInstall, install, isFullscreen, isInstalled, isIos, onInstallChange, toggleFullscreen } from './app';
import { getArea } from '../world/area';
import { getEdition } from '../world/edition';
import './hud.css';

/** The commit and day this build was made (vite.config.ts), to tell versions apart. */
declare const __BUILD__: string;
import { groupsInMode, rad2deg, toKnots, type BoatSpec, type Controls, type ForceReport, type BoatState, type TrueWind } from '../physics';
import { CAMERA_VIEWS, DISTANCE_RANGE, type CameraView } from '../engine/cameraRig';
import { getLang, languageSwitch, t, tMaybe } from '../i18n';

export interface HudCallbacks {
  onBoat(id: string): void;
  onMode(id: string): void;
  onSheet(group: string, value: number): void;
  onWind(fromDeg: number, speed: number, gusty: boolean): void;
  onForces(visible: boolean): void;
  onCameraView(view: CameraView): void;
  onCameraDistance(metres: number): void;
  onCameraHeight(degrees: number): void;
  onTimeScale(scale: number): void;
  onWindVisible(on: boolean): void;
  onSound(on: boolean): void;
  onTraffic(on: boolean): void;
  onMissions(): void;
  onTimeOfDay(id: string): void;
  onNarration(mode: string): void;
  /** Toggle the fishing mode (boats with a net: the Muleta). */
  onFish(): void;
}

export interface Navigation {
  name: string;
  /** Distance to the destination, m. */
  distance: number;
  /** Compass bearing to the destination, degrees. */
  bearing: number;
  /** Sailing time since the destination was chosen, s. */
  elapsed: number;
  arrived: boolean;
  /** Heading line instead of "To <name>" (fishing shows the catch). */
  title?: string;
  /** Nothing to sail to (a drill): the title, a hint in `name`, and the clock. */
  noTarget?: boolean;
  /**
   * Where the destination is on the screen (CSS pixels from the top left of the view), and
   * whether it is in front of the camera; the destination's tag sits there, or at the edge of
   * the screen on its side.
   */
  screen?: { x: number; y: number; front: boolean };
}

/** "3,1 km" / "450 m", in the page's language. */
function distanceText(m: number): string {
  const f = new Intl.NumberFormat(getLang(), { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${f.format(m / 1000)} km`;
}
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s) % 60).padStart(2, '0')}`;


function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/** The time of day chosen last (remembered in the browser), or day. */
export function loadTimeOfDay(): string {
  try {
    const v = localStorage.getItem('fragateiro.timeOfDay');
    if (v === 'sunrise' || v === 'day' || v === 'sunset') return v;
  } catch {
    // storage blocked
  }
  return 'day';
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
  private readonly compassApparent: SVGGElement;
  private readonly compassTarget: SVGGElement;
  private readonly nav = el('div', 'nav');
  /** The destination's tag: on the destination, or at the screen edge pointing to it. */
  private readonly tag = el('div', 'target-tag');
  private readonly tagText = el('div', 'tag-text');
  private readonly tagArrow = el('div', 'tag-arrow');
  /** The sailing clock, shown in the instruments panel. */
  private elapsed: number | null = null;
  /** One slider for all the sheets of the mode (each sail on its own in the settings panel). */
  private readonly sheetAll = el('input');
  private readonly sheetAuto = el('span', 'sheet-auto');
  private groups: string[] = [];
  private fishBtn!: HTMLButtonElement;
  private readonly rudderBar = el('div', 'rudder-bar');
  private readonly rudderNeedle = el('div', 'rudder-needle');
  private readonly warning = el('div', 'warning');
  private readonly toastBox = el('div', 'toast');
  private toastTimer = 0;
  private readonly forcesBox: HTMLInputElement;
  private readonly soundBox: HTMLInputElement;
  /** Shown next to the speed, so it is clear the clock runs faster. */
  private timeScale = getEdition().timeScale;
  private readonly camButtons = el('div', 'buttons');
  private readonly camDistance: HTMLInputElement;
  private readonly camHeight: HTMLInputElement;
  private readonly camHeightLabel: HTMLLabelElement;
  private sliders = new Map<string, HTMLInputElement>();
  private readonly missionRow = el('div', 'mission-row');
  private readonly missionName = el('span', 'mission-name');
  private readonly levelName = el('span', 'level-name');
  private targetsLabel?: HTMLLabelElement;
  /** Easy level: the sails trim themselves (no sheet sliders). */
  private easy = false;

  constructor(
    root: HTMLElement,
    boats: BoatSpec[],
    private readonly cb: HudCallbacks,
    wind: { fromDeg: number; speed: number; gusty: boolean; narration?: string },
  ) {
    root.classList.add('hud');

    // --- Top left: boat, mode, description
    const info = el('section', 'panel info');
    const missionsBtn = el('button', '', t('hud.missions'));
    missionsBtn.title = t('hud.missionsTitle');
    missionsBtn.onclick = () => {
      missionsBtn.blur();
      cb.onMissions();
    };
    this.missionRow.append(this.missionName, this.levelName, missionsBtn);
    // The top-left panel holds only the chart; everything else is in the settings panel.
    info.append(this.mapSlot);
    const header = el('div', 'settings-header');
    header.append(
      el('h1', '', `<a href="../../" title="${t('hud.allGames')}">⟵</a> ${t(getArea().id === 'tejo' ? 'hud.title' : `hud.title.${getArea().id}`)}`),
      this.missionRow,
      this.boatBar,
      this.modeBar,
      this.about,
      el('h2', 'sheets-each', t('hud.sheetsEach')),
      this.sheets,
      this.settingsSlot,
    );
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
        <g class="target" visibility="hidden"><path d="M0,-47 L-5,-38 L5,-38 Z"/></g>
        <g class="wind"><path d="M0,-44 L0,-20 M-6,-28 L0,-20 L6,-28"/></g>
        <g class="apparent"><path d="M0,-44 L0,-24 M-5,-31 L0,-24 L5,-31"/></g>
        <g class="boat"><path d="M0,-22 C7,-10 7,12 5,20 L-5,20 C-7,12 -7,-10 0,-22 Z"/></g>
      </svg>`;
    this.compassBoat = inst.querySelector('g.boat')!;
    this.compassWind = inst.querySelector('g.wind')!;
    this.compassApparent = inst.querySelector('g.apparent')!;
    const key = el('div', 'wind-key', `<span class="true">↓</span> ${t('ro.trueWind')} <span class="app">↓</span> ${t('ro.apparentWind')}`);
    inst.querySelector('svg')!.after(key);
    this.compassTarget = inst.querySelector('g.target')!;
    inst.append(this.readout);
    // Directions, warnings and notes: large, at the top centre of the screen.
    const banner = el('section', 'banner');
    banner.append(this.nav, this.warning, this.toastBox);
    this.toastBox.hidden = true;

    // The destination's tag (placed every frame).
    this.tag.append(this.tagText, this.tagArrow);
    this.tagArrow.innerHTML = '<svg viewBox="-12 -12 24 24"><path d="M0,-10 L8,5 L0,1 L-8,5Z"/></svg>';
    this.tag.hidden = true;

    // --- Bottom centre: a thin strip for the sheets (all at once) and the rudder.
    const helm = el('section', 'panel helm');
    this.sheetAll.type = 'range';
    this.sheetAll.min = '0';
    this.sheetAll.max = '1';
    this.sheetAll.step = '0.01';
    this.sheetAll.className = 'sheet-all';
    this.sheetAll.addEventListener('input', () => {
      for (const g of this.groups) cb.onSheet(g, Number(this.sheetAll.value));
    });
    this.sheetAll.addEventListener('change', () => this.sheetAll.blur());
    this.sheetAuto.textContent = t('hud.sheetsAuto');
    const sheetsLabel = el('span', 'helm-label', t('hud.sheets'));
    sheetsLabel.title = `${t('hud.sheetsKeys')} · ${t('sheet.in')} ◂ ▸ ${t('sheet.out')}`;
    this.rudderLeft = el('button', 'hold', '◀');
    this.rudderLeft.title = `${t('hud.port')} (A, ←)`;
    this.rudderRight = el('button', 'hold', '▶');
    this.rudderRight.title = `${t('hud.starboard')} (D, →)`;
    this.rudderBar.append(this.rudderNeedle);
    const rudderLabel = el('span', 'helm-label', t('hud.rudder'));
    rudderLabel.title = t('hud.rudderKeys');
    helm.append(sheetsLabel, this.sheetAll, this.sheetAuto, el('span', 'helm-divider'), rudderLabel, this.rudderLeft, this.rudderBar, this.rudderRight);
    // Small commands by the helm: fishing (boats with a net), reefing and the anchor (coming).
    const tools = el('div', 'helm-tools');
    const tool = (cls: string, svg: string, title: string) => {
      const b = el('button', `tool ${cls}`, `<svg viewBox="0 0 24 24" width="20" height="20">${svg}</svg>`);
      b.title = title;
      b.setAttribute('aria-label', title);
      tools.append(b);
      return b;
    };
    this.fishBtn = tool('fish', '<path d="M2.5 12c3.2-5 9.5-6.2 14.5-2l4.5-3.2v10.4L17 14c-5 4.2-11.3 3-14.5-2Z" fill="currentColor"/><circle cx="7.5" cy="11" r="1.3" fill="#2b1a0c"/>', `${t('tool.fish')} (M)`);
    this.fishBtn.onclick = () => {
      this.fishBtn.blur();
      cb.onFish();
    };
    tool('reef', '<path d="M7 3v18M7 4l11 15H7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 13h6.5M7 16h8.7" stroke="currentColor" stroke-width="1.6" stroke-dasharray="1.6 1.4"/>', `${t('tool.reef')} · ${t('tool.soon')}`).disabled = true;
    tool('anchor', '<circle cx="12" cy="5" r="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7v14M8 11h8M4.5 14.5C5.5 18.5 8.5 21 12 21s6.5-2.5 7.5-6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>', `${t('tool.anchor')} · ${t('tool.soon')}`).disabled = true;
    helm.append(tools);

    // --- Bottom right: wind and view options
    const opts = el('section', 'panel options');
    opts.innerHTML = `
      <h2>${t('opts.wind')}</h2>
      <label>${t('opts.from')} <input type="range" min="0" max="355" step="5" name="dir"> <output name="dirOut"></output></label>
      <label>${t('opts.speed')} <input type="range" min="2" max="30" step="1" name="speed"> <output name="speedOut"></output></label>
      <label class="check"><input type="checkbox" name="gusty"> ${t('opts.gusty')}</label>
      <label class="check"><input type="checkbox" name="windVisible" checked> ${t('opts.showWind')}</label>
      <label>${t('opts.timeOfDay')} <select name="timeOfDay">
        <option value="sunrise">${t('opts.sunrise')}</option>
        <option value="day">${t('opts.day')}</option>
        <option value="sunset">${t('opts.sunset')}</option>
      </select></label>
      <h2>${t('opts.camera')} <small>${t('opts.cameraHint')}</small></h2>
      <div class="cam-buttons"></div>
      <label>${t('opts.distance')} <input type="range" min="${DISTANCE_RANGE.min}" max="${DISTANCE_RANGE.max}" step="1" name="camDist"> <output name="camDistOut"></output></label>
      <label class="cam-height">${t('opts.height')} <input type="range" min="3" max="85" step="1" name="camHeight"> <output name="camHeightOut"></output></label>
      <label class="check"><input type="checkbox" name="forces"> ${t('opts.forces')} <small>(F)</small></label>
      <label class="check"><input type="checkbox" name="sound" checked> ${t('opts.sound')} <small>(N)</small></label>
      <label class="check"><input type="checkbox" name="traffic" checked> ${t('opts.traffic')}</label>
      <label>${t('opts.gameSpeed')} <select name="timeScale">
        <option value="1">${t('opts.ts1')}</option>
        <option value="2">${t('opts.tsN', { n: 2 })}</option>
        <option value="3">${t('opts.tsN', { n: 3 })}</option>
        <option value="5">${t('opts.tsN', { n: 5 })}</option>
        <option value="10">${t('opts.tsN', { n: 10 })}</option>
      </select></label>
      <label>${t('opts.narration')} <select name="narration">
        <option value="on">${t('narr.on')}</option>
        <option value="test">${t('narr.test')}</option>
        <option value="off">${t('narr.off')}</option>
      </select></label>
      <div class="buttons app-row"></div>
      <label class="lang-row">${t('opts.language')} <span class="lang-slot"></span></label>
      <p class="keys">${t('opts.keys')}</p>
      <p class="build">${t('opts.version')} ${__BUILD__}</p>`;
    const dir = opts.querySelector<HTMLInputElement>('[name=dir]')!;
    const speed = opts.querySelector<HTMLInputElement>('[name=speed]')!;
    const gusty = opts.querySelector<HTMLInputElement>('[name=gusty]')!;
    const forces = opts.querySelector<HTMLInputElement>('[name=forces]')!;
    const dirOut = opts.querySelector<HTMLOutputElement>('[name=dirOut]')!;
    const speedOut = opts.querySelector<HTMLOutputElement>('[name=speedOut]')!;
    dir.value = String(wind.fromDeg);
    speed.value = String(Math.round(toKnots(wind.speed)));
    gusty.checked = wind.gusty;
    const windChanged = () => {
      dirOut.textContent = `${dir.value}°`;
      const ms = Number(speed.value) * 0.514444;
      speedOut.textContent = `${speed.value} kn · ${ms.toFixed(1)} m/s`;
      cb.onWind(Number(dir.value), ms, gusty.checked);
    };
    for (const i of [dir, speed, gusty]) i.addEventListener('input', windChanged);
    windChanged();
    forces.addEventListener('change', () => cb.onForces(forces.checked));
    this.forcesBox = forces;

    opts.querySelector('.cam-buttons')!.replaceWith(this.camButtons);
    opts.querySelector('.lang-slot')!.replaceWith(languageSwitch('buttons lang-switch'));
    for (const v of CAMERA_VIEWS) {
      const btn = el('button', '', t(`cam.${v.id}`));
      btn.dataset.view = v.id;
      btn.title = t('cam.key', { k: v.key });
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
    const timeScale = opts.querySelector<HTMLSelectElement>('[name=timeScale]')!;
    this.timeScaleSelect = timeScale;
    timeScale.value = String(this.timeScale);
    timeScale.addEventListener('change', () => {
      cb.onTimeScale(Number(timeScale.value));
      this.timeScale = Number(timeScale.value);
    });
    this.soundBox = opts.querySelector<HTMLInputElement>('[name=sound]')!;
    this.soundBox.addEventListener('change', () => cb.onSound(this.soundBox.checked));
    const traffic = opts.querySelector<HTMLInputElement>('[name=traffic]')!;
    traffic.addEventListener('change', () => cb.onTraffic(traffic.checked));
    const tod = opts.querySelector<HTMLSelectElement>('[name=timeOfDay]')!;
    tod.value = loadTimeOfDay();
    tod.addEventListener('change', () => {
      try {
        localStorage.setItem('fragateiro.timeOfDay', tod.value);
      } catch {
        // storage blocked: only this visit
      }
      cb.onTimeOfDay(tod.value);
    });
    // Full screen, and installing the game as an app (src/ui/app.ts).
    const appRow = opts.querySelector<HTMLDivElement>('.app-row')!;
    const fillAppRow = () => {
      appRow.replaceChildren();
      if (canFullscreen()) {
        const fs = el('button', '', t(isFullscreen() ? 'opts.fullscreenOff' : 'opts.fullscreen'));
        fs.onclick = () => void toggleFullscreen();
        appRow.append(fs);
      }
      if (canInstall()) {
        const inst = el('button', '', t('opts.install'));
        inst.onclick = () => void install();
        appRow.append(inst);
      } else if (isIos() && !isInstalled()) appRow.append(el('small', '', t('opts.installIos')));
      appRow.style.display = appRow.childElementCount ? '' : 'none';
    };
    fillAppRow();
    onInstallChange(fillAppRow);
    document.addEventListener('fullscreenchange', fillAppRow);
    const narration = opts.querySelector<HTMLSelectElement>('[name=narration]')!;
    narration.value = wind.narration ?? 'on';
    narration.addEventListener('change', () => cb.onNarration(narration.value));
    const windVisible = opts.querySelector<HTMLInputElement>('[name=windVisible]')!;
    windVisible.addEventListener('change', () => cb.onWindVisible(windVisible.checked));


    // Let the arrow keys steer the boat instead of moving a focused slider.
    opts.addEventListener('change', (e) => (e.target as HTMLElement).blur());

    // The settings panel (boats, mission, wind, view) starts closed and opens from the button
    // or the J key.
    opts.prepend(header);
    // A close button inside the panel (on a phone the panel covers the ⚙ button).
    const close = el('button', 'settings-close', '✕');
    close.title = t('hud.close');
    close.setAttribute('aria-label', t('hud.close'));
    close.onclick = () => this.toggleSettings(false);
    opts.prepend(close);
    const toggle = el('button', 'panel settings-toggle', `⚙ <small>J</small>`);
    toggle.title = t('hud.settingsTitle');
    toggle.onclick = () => {
      this.toggleSettings();
      toggle.blur();
    };
    this.opts = opts;

    // Phones: the chart opens from a round button (it has no room of its own).
    const mapToggle = el('button', 'panel map-toggle', '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z M9 4v14 M15 6v14" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>');
    mapToggle.title = t('hud.mapTitle');
    mapToggle.onclick = () => {
      info.classList.toggle('show');
      mapToggle.blur();
    };

    this.captionBox.hidden = true;
    root.append(info, inst, banner, this.tag, this.captionBox, helm, opts, toggle, mapToggle);
  }

  private camOutputs!: { distOut: HTMLOutputElement; heightOut: HTMLOutputElement };
  private opts!: HTMLElement;
  /** Where the chart's legend, its credit and the "Sail to" list go (in the settings panel). */
  readonly settingsSlot = el('div', 'settings-slot');

  /** Show a wind direction set by a mission on the wind slider. */
  setWindFrom(deg: number): void {
    const dir = this.opts.querySelector<HTMLInputElement>('[name=dir]');
    const out = this.opts.querySelector<HTMLOutputElement>('[name=dirOut]');
    if (dir) dir.value = String(Math.round(deg / 5) * 5);
    if (out) out.textContent = `${Math.round(deg)}°`;
  }

  /** Open or close the settings panel (J). */
  toggleSettings(open = !this.opts.classList.contains('open')): void {
    this.opts.classList.toggle('open', open);
  }

  /** Show the current camera settings (also after the mouse or keys changed them). */
  setCamera(view: CameraView, distance: number, elevation: number): void {
    for (const b of this.camButtons.querySelectorAll('button')) b.classList.toggle('active', b.dataset.view === view);
    if (document.activeElement !== this.camDistance) this.camDistance.value = String(Math.round(distance));
    if (document.activeElement !== this.camHeight) this.camHeight.value = String(Math.round(elevation));
    this.camOutputs.distOut.textContent = `${Math.round(distance)} m`;
    this.camOutputs.heightOut.textContent = `${Math.round(elevation)}°`;
    this.camHeightLabel.hidden = view === 'top' || view === 'free';
  }

  /** The narrator's line on screen (speaker and words), or none. */
  private readonly captionBox = el('div', 'caption');
  private captionId = '';
  caption(c: { id: string; speaker: string; text: string; delivery: string } | null): void {
    const id = c ? c.id : '';
    if (id === this.captionId) return;
    this.captionId = id;
    this.captionBox.hidden = !c;
    if (!c) return;
    this.captionBox.className = `caption ${c.delivery}`;
    this.captionBox.replaceChildren(el('span', 'speaker', c.speaker), el('span', 'words', c.text));
  }

  /** A short message under the instruments, for a few seconds. */
  toast(text: string, seconds = 6): void {
    this.toastBox.textContent = text;
    this.toastBox.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastBox.hidden = true), seconds * 1000);
  }

  private timeScaleSelect!: HTMLSelectElement;

  /** Set the game speed shown (the game sets it itself, e.g. real time for the drills). */
  setTimeScale(k: number): void {
    this.timeScale = k;
    this.timeScaleSelect.value = String(k);
  }

  setSound(on: boolean): void {
    this.soundBox.checked = on;
  }

  setForces(visible: boolean): void {
    this.forcesBox.checked = visible;
  }

  /** The current mission and level; free sailing shows the "Sail to" list. */
  setMission(title: string, level: string, free: boolean, boat: string | null, easy: boolean): void {
    this.missionName.textContent = title;
    this.levelName.textContent = level;
    if (this.targetsLabel) this.targetsLabel.hidden = !free;
    for (const b of this.boatBar.querySelectorAll('button')) b.disabled = !!boat && b.dataset.id !== boat;
    this.easy = easy;
  }

  /** Show that a boat's model is downloading (its button pulses). */
  setBoatLoading(id: string, on: boolean): void {
    for (const b of this.boatBar.querySelectorAll('button')) if (b.dataset.id === id) b.classList.toggle('loading', on);
  }

  /** Rebuild the boat-specific parts (after changing boat or mode). */
  setBoat(spec: BoatSpec, controls: Controls): void {
    for (const b of this.boatBar.querySelectorAll('button')) b.classList.toggle('active', b.dataset.id === spec.id);
    this.modeBar.replaceChildren();
    if (spec.modes.length > 1) {
      for (const m of spec.modes) {
        const btn = el('button', m.id === controls.mode ? 'active' : '', tMaybe(`mode.${m.id}`) ?? m.name);
        btn.onclick = () => this.cb.onMode(m.id);
        this.modeBar.append(btn);
      }
    }
    const mode = spec.modes.find((m) => m.id === controls.mode) ?? spec.modes[0];
    // The fishing button only for boats with a net, lit while the net is out.
    this.fishBtn.hidden = !spec.modes.some((m) => m.net);
    this.fishBtn.classList.toggle('active', !!mode.net);
    // Boat descriptions live on the main page; here only how to use a mode.
    this.about.textContent = spec.modes.length > 1 ? (tMaybe(`modeDesc.${spec.id}.${mode.id}`) ?? mode.description) : '';
    this.about.hidden = spec.modes.length <= 1;

    this.sheets.replaceChildren();
    this.sliders.clear();
    this.groups = groupsInMode(spec, mode.id);
    this.sheetAll.hidden = this.easy;
    this.sheetAuto.hidden = !this.easy;
    if (this.easy) {
      this.sheets.append(el('p', 'easy-note', t('hud.easyNote')));
      return;
    }
    for (const g of this.groups) {
      const label = el('label', 'sheet');
      const input = el('input');
      input.type = 'range';
      input.min = '0';
      input.max = '1';
      input.step = '0.01';
      input.value = String(controls.sheets[g] ?? 0.5);
      input.addEventListener('input', () => this.cb.onSheet(g, Number(input.value)));
      input.addEventListener('change', () => input.blur());
      label.append(el('span', 'name', tMaybe(`group.${g}`) ?? g), el('span', 'end', t('sheet.in')), input, el('span', 'end', t('sheet.out')));
      this.sheets.append(label);
      this.sliders.set(g, input);
    }
  }

  /**
   * The directions: the destination's tag on the view, and a one-line strip at the top only
   * when there is progress to show (the catch, the pieces picked up, a drill's count).
   */
  private updateNav(state: BoatState, nav: Navigation | null): void {
    this.compassTarget.setAttribute('visibility', nav && !nav.noTarget && !nav.arrived ? 'visible' : 'hidden');
    this.elapsed = nav ? nav.elapsed : null;
    const line = !nav ? '' : nav.arrived ? (nav.title ?? `${t('nav.arrived', { name: nav.name })} · ${clock(nav.elapsed)}`) : nav.noTarget ? `${nav.title ?? ''}` : (nav.title ?? '');
    this.nav.hidden = !line;
    if (this.nav.textContent !== line) this.nav.textContent = line;
    if (nav && nav.noTarget && !nav.arrived) this.nav.title = nav.name;
    const showTag = !!nav && !nav.noTarget && !nav.arrived;
    this.tag.hidden = !showTag;
    if (!nav || !showTag) return;
    this.compassTarget.setAttribute('transform', `rotate(${nav.bearing})`);
    const name = nav.name.charAt(0).toUpperCase() + nav.name.slice(1);
    const text = `<strong>${name}</strong><span>${distanceText(nav.distance)}</span>`;
    if (this.tagText.innerHTML !== text) this.tagText.innerHTML = text;
    this.placeTag(state, nav);
  }

  /** Put the tag on the destination, or at the edge of the view on its side, pointing to it. */
  private placeTag(state: BoatState, nav: Navigation): void {
    const W = window.innerWidth;
    const H = window.innerHeight;
    // Keep clear of the panels: the chart and compass at the top, the helm strip at the bottom.
    const phone = W <= 900;
    const box = { left: phone ? 8 : 24, right: W - (phone ? 8 : 24), top: phone ? 150 : 110, bottom: H - (phone ? 90 : 100) };
    let x: number;
    let y: number;
    let inView = false;
    if (nav.screen) {
      ({ x, y } = nav.screen);
      // (Behind the camera, the game gives a point far off in the destination's direction.)
      // (Far destinations sit on the horizon, high on the screen: they count as in view down to
      // just under the top panels.)
      inView = nav.screen.front && x > box.left && x < box.right && y > 30 && y < box.bottom;
    } else {
      // No projection: use the bearing relative to the bow (ahead is up).
      const rel = ((nav.bearing - rad2deg(state.heading) + 540) % 360) - 180;
      x = W / 2 + Math.sin((rel * Math.PI) / 180) * W;
      y = H / 2 - Math.cos((rel * Math.PI) / 180) * H;
    }
    const tw = this.tag.offsetWidth || 120;
    const th = this.tag.offsetHeight || 44;
    if (inView) {
      // Next to the destination, the arrow pointing at it: above it, or under it when it is high
      // on the screen (on the horizon), so the tag never hides it.
      const below = y - th - 34 < box.top;
      this.tag.classList.add('on-target');
      this.tag.style.transform = `translate(${Math.round(Math.min(box.right - tw, Math.max(box.left, x - tw / 2)))}px, ${Math.round(below ? y + 26 : y - th - 34)}px)`;
      this.tagArrow.style.transform = below ? 'rotate(0deg)' : 'rotate(180deg)';
      return;
    }
    this.tag.classList.remove('on-target');
    // From the centre of the view towards the destination, stopped at the edge of the box.
    const cx = W / 2;
    const cy = H / 2;
    const dx = x - cx;
    const dy = y - cy;
    const k = Math.min(dx ? (dx > 0 ? box.right - tw / 2 - cx : box.left + tw / 2 - cx) / dx : Infinity, dy ? (dy > 0 ? box.bottom - th / 2 - cy : box.top + th / 2 - cy) / dy : Infinity);
    const px = cx + dx * k;
    const py = cy + dy * k;
    this.tag.style.transform = `translate(${Math.round(px - tw / 2)}px, ${Math.round(py - th / 2)}px)`;
    this.tagArrow.style.transform = `rotate(${(Math.atan2(dx, -dy) * 180) / Math.PI}deg)`;
  }

  /** Panel where a game can put a map. */
  readonly mapSlot = el('div', 'map-slot');

  /** A list of places to move the boat to ("teleport"). */
  setDestinations(names: string[], onGo: (name: string) => void): void {
    const label = el('label', 'goto', `${t('hud.sailFrom')} <small>(T)</small>`);
    const select = el('select');
    select.append(new Option(t('hud.chooseTown'), ''));
    for (const n of names) select.append(new Option(n, n));
    select.addEventListener('change', () => {
      if (select.value) onGo(select.value);
      select.value = '';
      select.blur();
    });
    label.append(select);
    this.settingsSlot.prepend(label);
  }

  /** A list of places to sail to; the instruments then show distance and bearing. */
  setTargets(names: string[], onTarget: (name: string | null) => void): void {
    const label = el('label', 'goto', t('hud.sailTo'));
    this.targetsLabel = label;
    const select = el('select');
    select.append(new Option(t('hud.noDestination'), ''));
    for (const n of names) select.append(new Option(n, n));
    select.addEventListener('change', () => {
      onTarget(select.value || null);
      select.blur();
    });
    label.append(select);
    this.settingsSlot.prepend(label);
  }

  update(state: BoatState, controls: Controls, report: ForceReport, wind: TrueWind, paused: boolean, aground = false, nav: Navigation | null = null): void {
    this.updateNav(state, nav);
    const heading = (rad2deg(state.heading) + 360) % 360;
    const twa = Math.abs(report.trueWindAngleDeg);
    const pointOfSail =
      t(twa < 36 ? 'pos.irons' : twa < 60 ? 'pos.closeHauled' : twa < 80 ? 'pos.closeReach' : twa < 110 ? 'pos.beamReach' : twa < 150 ? 'pos.broadReach' : 'pos.running');
    const tack = t(report.trueWindAngleDeg >= 0 ? 'tack.starboard' : 'tack.port');
    const drift = this.easy ? '' : `<span class="drift" title="${t('ro.drift')}">${t('ro.driftShort')} ${toKnots(Math.abs(state.v)).toFixed(1)} ${state.v >= 0 ? '→' : '←'}</span>`;
    this.readout.innerHTML = `
      <div class="big">${toKnots(Math.hypot(state.u, state.v)).toFixed(1)}<small> kn</small>${drift}</div>
      <div class="tscale" title="${t('ro.timeTitle')}">${this.timeScale === 1 ? t('ro.realTime') : t('ro.timeX', { n: this.timeScale })}${this.elapsed !== null ? ` · ${clock(this.elapsed)}` : ''}</div>
      <dl>
        <dt>${t('ro.heading')}</dt><dd>${heading.toFixed(0)}°</dd>
        <dt>${t('ro.pointOfSail')}</dt><dd>${pointOfSail}${twa >= 36 ? `, ${tack}` : ''}</dd>
      </dl>`;
    this.compassBoat.setAttribute('transform', `rotate(${heading})`);
    this.compassWind.setAttribute('transform', `rotate(${rad2deg(wind.from)})`);
    // The apparent wind, as felt on board: from the boat's heading plus its angle.
    this.compassApparent.setAttribute('transform', `rotate(${heading + report.apparentWindAngleDeg})`);
    this.rudderNeedle.style.left = `${50 + controls.rudder * 45}%`;
    for (const [g, input] of this.sliders) {
      if (document.activeElement !== input) input.value = String(controls.sheets[g] ?? 0.5);
    }
    if (document.activeElement !== this.sheetAll && this.groups.length) {
      this.sheetAll.value = String(this.groups.reduce((sum, g) => sum + (controls.sheets[g] ?? 0.5), 0) / this.groups.length);
    }
    const luffing = report.sails.filter((s) => s.active && s.luffing).length;
    const msg = paused
      ? t('warn.paused')
      : aground
        ? t('warn.aground')
        : Math.abs(state.heel) > 0.45
        ? t('warn.heel')
        : luffing > 0 && twa > 45
          ? t('warn.flapping')
          : '';
    this.warning.textContent = msg;
    this.warning.hidden = !msg;
  }
}
