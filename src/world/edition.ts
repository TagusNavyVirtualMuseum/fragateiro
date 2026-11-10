// One game, two settings: the museum edition (a visit of a few minutes: short challenges, the
// clock faster) and the home edition (the full challenges). Chosen with ?edition=museum or
// ?edition=home (remembered); home by default. Plain TypeScript, so the rules can be tested.

export type EditionId = 'museum' | 'home';

export interface Edition {
  id: EditionId;
  /** Regatta course length (the first leg, upwind), m. */
  regattaLength: number;
  /** Pieces of rubbish in a clean-up, and how far around the port they float, m. */
  trashCount: number;
  trashRadius: number;
  /** Game seconds alongside the boat at anchor in a supply run. */
  transferTime: number;
  /** Supply runs start this far from the boat at anchor (m), or from the port (null). */
  supplyStart: number | null;
  /** Transport routes longer than this are not offered, m (straight line). */
  maxRoute: number;
  /** Game clock speed at the start (the player can change it). */
  timeScale: number;
}

export const EDITIONS: Record<EditionId, Edition> = {
  museum: { id: 'museum', regattaLength: 350, trashCount: 6, trashRadius: 800, transferTime: 12, supplyStart: 900, maxRoute: 4000, timeScale: 5 },
  home: { id: 'home', regattaLength: 600, trashCount: 12, trashRadius: 1600, transferTime: 25, supplyStart: null, maxRoute: Infinity, timeScale: 3 },
};

const KEY = 'fragateiro.edition';

function detect(): EditionId {
  if (typeof location === 'undefined') return 'home';
  const fromUrl = new URLSearchParams(location.search).get('edition');
  if (fromUrl === 'museum' || fromUrl === 'home') {
    try {
      localStorage.setItem(KEY, fromUrl);
    } catch {
      // storage blocked: only this visit
    }
    return fromUrl;
  }
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'museum' || saved === 'home') return saved;
  } catch {
    // storage blocked
  }
  return 'home';
}

const current = EDITIONS[detect()];

/** The edition in use. */
export function getEdition(): Edition {
  return current;
}
