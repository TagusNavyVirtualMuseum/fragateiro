// The mission menu (choose a mission and a level) and the result panel at the end.
import type { BoatSpec } from '../physics';
import type { Level, Mission } from '../world/missions';
import { LEVELS } from '../world/missions';

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

  constructor(
    parent: HTMLElement,
    private readonly missions: Mission[],
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

  /** The list of missions, with the level buttons above it. */
  show(): void {
    const o = this.overlay;
    o.replaceChildren();
    const panel = el('section', 'panel mission-panel');
    panel.append(el('h1', '', 'Choose a mission'));
    const levels = el('div', 'buttons levels');
    const levelText = el('p', 'level-text');
    const list = el('div', 'mission-list');
    const draw = () => {
      for (const b of levels.querySelectorAll('button')) b.classList.toggle('active', b.dataset.level === this.level);
      levelText.textContent = LEVELS.find((l) => l.id === this.level)!.description;
      list.replaceChildren();
      for (const m of this.missions) {
        const card = el('button', 'mission-card');
        const boat = m.kind === 'free' ? 'any boat' : (this.boats.find((b) => b.id === m.boat)?.name ?? m.boat);
        const best = m.kind === 'free' ? null : this.best(m.id, this.level);
        card.append(
          el('strong', '', m.title),
          el('span', 'boat', boat),
          el('span', 'desc', m.description),
          el('span', 'best', best !== null ? `best ${formatTime(best)}` : m.kind === 'free' ? '' : 'not yet sailed'),
        );
        card.onclick = () => this.onStart(m, this.level);
        list.append(card);
      }
    };
    for (const l of LEVELS) {
      const b = el('button', '', l.name);
      b.dataset.level = l.id;
      b.onclick = () => {
        this.level = l.id;
        draw();
      };
      levels.append(b);
    }
    panel.append(el('h2', '', 'Level'), levels, levelText, el('h2', '', 'Missions'), list);
    o.append(panel);
    draw();
    o.hidden = false;
  }

  hide(): void {
    this.overlay.hidden = true;
  }

  /** End of a mission: the time, the best time, and what next. */
  showResult(mission: Mission, level: Level, time: number, best: number | null, record: boolean, onAgain: () => void): void {
    const o = this.overlay;
    o.replaceChildren();
    const panel = el('section', 'panel mission-panel result');
    const levelName = LEVELS.find((l) => l.id === level)!.name;
    panel.append(
      el('h1', '', record ? 'New best time!' : 'Mission complete'),
      el('p', 'result-title', `${mission.title} · ${levelName}`),
      el('div', 'result-time', formatTime(time)),
      el('p', 'result-best', best !== null && !record ? `Best: ${formatTime(best)}` : 'Sailing time (game clock)'),
    );
    const row = el('div', 'buttons');
    const again = el('button', '', 'Sail it again');
    again.onclick = () => onAgain();
    const menu = el('button', '', 'Other missions');
    menu.onclick = () => this.show();
    row.append(again, menu);
    panel.append(row);
    o.append(panel);
    o.hidden = false;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
