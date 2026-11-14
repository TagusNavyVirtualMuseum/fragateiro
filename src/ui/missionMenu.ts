// The mission menu, in two steps: first what to do (regatta, transport, fishing, free
// sailing), then where and with which boat. Also the result panel at the end of a mission.
import type { BoatSpec } from '../physics';
import { t } from '../i18n';
import { getEdition } from '../world/edition';
import { FISHING_TARGET_KG, LEVELS, placeName, MISSION_KINDS, areaMissions, makeMission, type Level, type Mission, type MissionKind } from '../world/missions';
import { MENU_AREAS, getArea, setArea } from '../world/area';
import { DRILLS, MINIGAMES, type MiniGame } from '../world/missions';
import faluaPic from '../assets/boats/falua.jpg?url';
import catraioPic from '../assets/boats/catraio.jpg?url';
import fragataPic from '../assets/boats/fragata.jpg?url';
import muletaPic from '../assets/boats/muleta.jpg?url';
import canoaPic from '../assets/boats/canoa.jpg?url';
import baleeiroPic from '../assets/boats/baleeiro.jpg?url';
import moliceiroPic from '../assets/boats/moliceiro.jpg?url';
import pinassePic from '../assets/boats/pinasse.jpg?url';
import bacPic from '../assets/boats/bac.jpg?url';

const BOAT_PICTURES: Record<string, string> = { falua: faluaPic, catraio: catraioPic, fragata: fragataPic, muleta: muletaPic, canoa: canoaPic, baleeiro: baleeiroPic, moliceiro: moliceiroPic, pinasse: pinassePic, bac: bacPic };

const AREA = getArea();
const { courses: COURSES, routes: ROUTES, grounds: GROUNDS, cleanups: CLEANUPS, supplies: SUPPLIES, whaling: WHALING } = areaMissions();

/** mm:ss (or h:mm:ss) of a game time in seconds. */
export function formatTime(seconds: number): string {
  const t = Math.max(0, Math.round(seconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export class MissionMenu {
  private readonly overlay = document.createElement('div');
  private level: Level;
  private ports: string[] = [];
  /** The choices of the second step, remembered between visits. */
  private choice: Record<MissionKind, { option: string; boat: string }> = {
    regatta: { option: COURSES[0]?.id ?? '', boat: AREA.boat },
    transport: { option: ROUTES[0]?.id ?? '', boat: ROUTES[0]?.boat ?? AREA.boat },
    fishing: { option: GROUNDS[0]?.id ?? '', boat: 'muleta' },
    cleanup: { option: CLEANUPS[0]?.id ?? '', boat: AREA.boat },
    supply: { option: SUPPLIES[0]?.id ?? '', boat: SUPPLIES[0]?.boat ?? AREA.boat },
    whaling: { option: WHALING[0] ?? '', boat: 'baleeiro' },
    free: { option: AREA.ports[0], boat: AREA.boat },
    run: { option: '', boat: 'falua' },
    seaweed: { option: '', boat: 'moliceiro' },
    drill: { option: '', boat: 'baleeiro' },
  };

  constructor(
    parent: HTMLElement,
    private readonly boats: BoatSpec[],
    private readonly best: (missionId: string, level: Level) => number | null,
    private readonly onStart: (mission: Mission, level: Level) => void,
    level: Level,
  ) {
    this.level = level;
    this.overlay.className = 'mission-overlay';
    this.overlay.hidden = true;
    parent.append(this.overlay);
  }

  get open(): boolean {
    return !this.overlay.hidden;
  }

  /** Ports for free sailing. */
  /** Which transport routes to offer (the museum edition leaves out the long ones). */
  private routeOk: (r: { from: string; to: string }) => boolean = () => true;
  setRouteFilter(ok: (r: { from: string; to: string }) => boolean): void {
    this.routeOk = ok;
    const first = this.routes[0];
    if (first && !this.routes.some((r) => r.id === this.choice.transport.option)) this.choice.transport = { option: first.id, boat: first.boat };
  }

  private get routes() {
    return ROUTES.filter((r) => this.routeOk(r));
  }

  setPorts(names: string[]): void {
    this.ports = names;
  }

  /** Step 1: the area, the level and the kind of mission (the museum: its mini-games). */
  show(): void {
    if (getEdition().id === 'museum') {
      this.showMiniGames();
      return;
    }
    const panel = this.panel(t('menu.whatToDo'));
    panel.append(this.areaPicker(), this.levelPicker());
    const list = el('div', 'mission-list kinds');
    const offered: Record<MissionKind, number> = { run: 0, seaweed: 0, regatta: COURSES.length, transport: this.routes.length, cleanup: CLEANUPS.length, supply: SUPPLIES.length, whaling: WHALING.length, fishing: GROUNDS.length, free: 1, drill: 0 };
    for (const k of MISSION_KINDS) {
      if (!offered[k.id]) continue;
      const card = el('button', 'mission-card');
      card.append(el('strong', '', k.title), el('span', 'desc', k.description));
      card.onclick = () => this.showOptions(k.id);
      list.append(card);
    }
    panel.append(list);
  }

  /** The museum's menu: one card per mini-game, with its boat's picture. */
  private showMiniGames(): void {
    const panel = this.panel(t('menu.whatToDo'));
    panel.append(this.levelPicker());
    // First row: the drills, to learn the basics.
    const drills = el('div', 'mission-list drills');
    DRILLS.forEach((g, i) => {
      const card = el('button', 'mission-card drill');
      const id = g.id.replace('drill-', '');
      card.append(el('span', 'drill-no', t('drill.n', { n: i + 1 })), el('strong', '', t(`drill.${id}`)), el('span', 'desc', t(`drill.${id}.desc`)));
      card.onclick = () => this.play(g);
      drills.append(card);
    });
    panel.append(el('h2', '', t('menu.drills')), drills, el('h2', '', t('menu.games')));
    const list = el('div', 'mission-list minigames');
    for (const g of MINIGAMES) {
      const card = el('button', 'mission-card minigame');
      const img = el('img');
      img.src = BOAT_PICTURES[g.boats[0]] ?? '';
      img.alt = '';
      card.append(img, el('strong', '', t(`mini.${g.id}`)), el('span', 'desc', t(`mini.${g.id}.desc`)));
      card.onclick = () => this.play(g);
      list.append(card);
    }
    // Last: free sailing, with any boat, in any area, from any port.
    const free = el('button', 'mission-card minigame free');
    const img = el('img');
    img.src = BOAT_PICTURES.falua;
    img.alt = '';
    free.append(img, el('strong', '', t('mini.free')), el('span', 'desc', t('mini.free.desc')));
    free.onclick = () => this.showFree();
    list.append(free);
    panel.append(list);
  }

  /**
   * Start a drill or mini-game with one of its boats, in one of its places, picked at random.
   * Each area is its own map: another area opens the page there, and the game starts it.
   */
  private play(g: MiniGame): void {
    const boat = g.boats[Math.floor(Math.random() * g.boats.length)];
    const place = Math.floor(Math.random() * g.places.length);
    if (g.places[place].area !== AREA.id) setArea(g.places[place].area, { play: g.id, boat, place: String(place) });
    else this.onStart(g.mission(this.boats, boat, place), this.level);
  }

  /** The free-sailing screen: area, boat and port. */
  showFree(): void {
    this.showOptions('free');
  }

  /** Step 2: where, and with which boat. */
  private showOptions(kind: MissionKind): void {
    const kindInfo = MISSION_KINDS.find((k) => k.id === kind)!;
    const panel = this.panel(kindInfo.title);
    const c = this.choice[kind];
    const body = el('div', 'mission-options');
    const footer = el('div', 'mission-footer');
    const bestText = el('span', 'best');
    const refresh = () => {
      const m = makeMission(kind, c.option, c.boat, this.boats);
      const best = kind === 'free' ? null : this.best(m.id, this.level);
      bestText.textContent = kind === 'free' ? '' : best !== null ? t('menu.best', { time: formatTime(best) }) : t('menu.notYet');
      for (const b of body.querySelectorAll<HTMLButtonElement>('button[data-option]')) b.classList.toggle('active', b.dataset.option === c.option);
      for (const b of body.querySelectorAll<HTMLButtonElement>('button[data-boat]')) b.classList.toggle('active', b.dataset.boat === c.boat);
    };
    const optionButtons = (title: string, items: { id: string; label: string; note?: string; onPick?: () => void }[]) => {
      body.append(el('h2', '', title));
      const row = el('div', 'buttons option-list');
      for (const it of items) {
        const b = el('button', 'option');
        b.dataset.option = it.id;
        b.append(el('span', '', it.label));
        if (it.note) b.append(el('small', '', it.note));
        b.onclick = () => {
          c.option = it.id;
          it.onPick?.();
          refresh();
        };
        row.append(b);
      }
      body.append(row);
    };
    const boatButtons = () => {
      body.append(el('h2', '', t('menu.boat')));
      const row = el('div', 'buttons');
      for (const boat of this.boats) {
        const b = el('button', '', boat.name);
        b.dataset.boat = boat.id;
        b.onclick = () => {
          c.boat = boat.id;
          refresh();
        };
        row.append(b);
      }
      body.append(row);
    };

    if (kind === 'regatta') {
      optionButtons(t('menu.course'), COURSES.map((r) => ({ id: r.id, label: r.name })));
      boatButtons();
      body.append(el('p', 'level-text', t('menu.regattaHelp')));
    } else if (kind === 'transport') {
      optionButtons(
        t('menu.route'),
        this.routes.map((r) => ({
          id: r.id,
          label: `${r.from} → ${placeName(r.to)}`,
          note: r.busy ? r.description : t('route.traditionally', { boat: this.boats.find((b) => b.id === r.boat)?.name ?? r.boat }),
          onPick: () => (c.boat = r.boat),
        })),
      );
      boatButtons();
    } else if (kind === 'whaling') {
      optionButtons(t('menu.whalingFrom'), WHALING.map((p) => ({ id: p, label: p })));
      boatButtons();
      body.append(el('p', 'level-text', t('menu.whalingHelp')));
    } else if (kind === 'cleanup') {
      optionButtons(t('menu.cleanupWhere'), CLEANUPS.map((c) => ({ id: c.id, label: c.name })));
      boatButtons();
      body.append(el('p', 'level-text', t('menu.cleanupHelp', { count: getEdition().trashCount })));
    } else if (kind === 'supply') {
      optionButtons(
        t('menu.supplyRun'),
        SUPPLIES.map((r) => ({ id: r.id, label: r.name, note: r.description, onPick: () => (c.boat = r.boat) })),
      );
      boatButtons();
      body.append(el('p', 'level-text', t('menu.supplyHelp')));
    } else if (kind === 'fishing') {
      optionButtons(t('menu.ground'), GROUNDS.map((g) => ({ id: g.id, label: g.name })));
      body.append(
        el('h2', '', t('menu.boatMuleta')),
        el(
          'p',
          'level-text',
          t('menu.fishingHelp', { kg: FISHING_TARGET_KG }),
        ),
      );
    } else {
      // Free sailing: the area (another one reopens the game there, on this screen), the boat,
      // and the port to start from.
      body.append(this.areaPicker({ play: 'free' }));
      boatButtons();
      body.append(el('h2', '', t('menu.startFrom')));
      const select = el('select', 'port-select');
      for (const p of this.ports) select.append(new Option(p, p));
      select.value = c.option;
      select.onchange = () => (c.option = select.value);
      body.append(select);
    }

    const back = el('button', '', t('menu.back'));
    back.onclick = () => this.show();
    const go = el('button', 'go', kind === 'free' ? t('menu.setSail') : t('menu.start'));
    go.onclick = () => this.onStart(makeMission(kind, c.option, c.boat, this.boats), this.level);
    footer.append(back, bestText, go);
    panel.append(body, footer);
    refresh();
  }

  hide(): void {
    this.overlay.hidden = true;
  }

  /** End of a mission: the time, the best time, and what next. */
  showResult(
    mission: Mission,
    level: Level,
    time: number,
    best: number | null,
    record: boolean,
    onAgain: () => void,
    /** The narrator's closing words, the curiosities heard (the logbook) and the sources. */
    logbook?: { closing: { speaker: string; text: string }[]; curiosities: { speaker: string; text: string }[]; credits: string[] },
  ): void {
    const levelName = LEVELS.find((l) => l.id === level)!.name;
    const panel = this.panel(record ? t('result.record') : mission.kind === 'fishing' ? t('result.full') : t('result.done'));
    panel.classList.add('result');
    panel.append(
      el('p', 'result-title', `${mission.title} · ${levelName}`),
      el('div', 'result-time', formatTime(time)),
      el('p', 'result-best', best !== null && !record ? t('result.best', { time: formatTime(best) }) : t('result.clock')),
    );
    if (logbook && (logbook.closing.length || logbook.curiosities.length)) {
      const book = el('div', 'logbook');
      for (const c of logbook.closing) {
        const p = el('p', 'closing');
        p.append(el('strong', '', c.speaker), document.createTextNode(c.text));
        book.append(p);
      }
      if (logbook.curiosities.length) {
        book.append(el('h2', '', t('result.logbook')));
        for (const c of logbook.curiosities) book.append(el('p', 'curiosity', c.text));
      }
      if (logbook.credits.length) book.append(el('p', 'sources', `${t('result.sources')}: ${logbook.credits.join(' · ')}`));
      panel.append(book);
    }
    const row = el('div', 'buttons');
    const again = el('button', '', t('result.again'));
    again.onclick = () => onAgain();
    const menu = el('button', '', t('result.other'));
    menu.onclick = () => this.show();
    row.append(again, menu);
    panel.append(row);
  }

  /** A drill that went wrong: why, and try again. */
  showFailed(mission: Mission, level: Level, why: string, onAgain: () => void): void {
    const levelName = LEVELS.find((l) => l.id === level)!.name;
    const panel = this.panel(why);
    panel.classList.add('result');
    panel.append(el('p', 'result-title', `${mission.title} · ${levelName}`));
    const row = el('div', 'buttons');
    const again = el('button', '', t('result.again'));
    again.onclick = () => onAgain();
    const menu = el('button', '', t('result.other'));
    menu.onclick = () => this.show();
    row.append(again, menu);
    panel.append(row);
  }

  /** A fresh panel in the overlay, with a title. */
  private panel(title: string): HTMLElement {
    this.overlay.replaceChildren();
    const panel = el('section', 'panel mission-panel');
    panel.append(el('h1', '', title));
    this.overlay.append(panel);
    this.overlay.hidden = false;
    return panel;
  }

  /** Each area is its own map: choosing another reloads the game there. */
  private areaPicker(extra: Record<string, string> = {}): HTMLElement {
    const box = el('div');
    const row = el('div', 'buttons levels');
    for (const id of MENU_AREAS) {
      const b = el('button', id === AREA.id ? 'active' : '', t(`area.${id}`));
      b.onclick = () => {
        if (id !== AREA.id) setArea(id, extra);
      };
      row.append(b);
    }
    box.append(el('h2', '', t('menu.area')), row, el('p', 'level-text', t(`area.${AREA.id}.desc`)));
    return box;
  }

  private levelPicker(): HTMLElement {
    const box = el('div');
    const row = el('div', 'buttons levels');
    const text = el('p', 'level-text');
    const draw = () => {
      for (const b of row.querySelectorAll('button')) b.classList.toggle('active', b.dataset.level === this.level);
      text.textContent = LEVELS.find((l) => l.id === this.level)!.description;
    };
    for (const l of LEVELS) {
      const b = el('button', '', l.name);
      b.dataset.level = l.id;
      b.onclick = () => {
        this.level = l.id;
        draw();
      };
      row.append(b);
    }
    box.append(el('h2', '', t('menu.level')), row, text);
    draw();
    return box;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
