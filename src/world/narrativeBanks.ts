// The line banks the narrative tool writes (content/narrative/from-tool/lines/<mini-game>.json),
// and the narration setting: off, on (approved lines only) or playtest (also lines not yet
// approved). The setting comes from ?narration=off|on|test, else the last choice.
import type { LineBank } from './narrator';

const BANKS = import.meta.glob('../../content/narrative/from-tool/lines/*.json', { eager: true, import: 'default' }) as Record<string, LineBank>;

/** The line bank of a mini-game (its id in content/minigames.json), if the tool wrote one. */
export function bankFor(minigame: string): LineBank | null {
  return Object.values(BANKS).find((b) => b.minigame === minigame) ?? null;
}

export type NarrationMode = 'off' | 'on' | 'test';
const KEY = 'fragateiro.narration';
const isMode = (v: unknown): v is NarrationMode => v === 'off' || v === 'on' || v === 'test';

export function loadNarrationMode(): NarrationMode {
  if (typeof location !== 'undefined') {
    const fromUrl = new URLSearchParams(location.search).get('narration');
    if (isMode(fromUrl)) return fromUrl;
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (isMode(saved)) return saved;
  } catch {
    // storage blocked
  }
  return 'on';
}

export function saveNarrationMode(mode: NarrationMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // storage blocked: only this visit
  }
}
