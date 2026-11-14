// One game, two settings: the museum edition (a visit of a few minutes: short challenges, the
// clock faster) and the home edition (the full challenges). Chosen with ?edition=museum or
// ?edition=home; museum by default. Plain TypeScript, so the rules can be tested.

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
  /** Downwind and upwind runs: distance to the mark, m. */
  runDistance: number;
  /** The whale is first sighted this far from the port, m. */
  whaleDistance: number;
  /** Game clock speed at the start (the player can change it). */
  timeScale: number;
}

export const EDITIONS: Record<EditionId, Edition> = {
  museum: { id: 'museum', regattaLength: 350, trashCount: 6, trashRadius: 800, transferTime: 12, supplyStart: 900, maxRoute: 4000, runDistance: 800, whaleDistance: 1200, timeScale: 3 },
  home: { id: 'home', regattaLength: 600, trashCount: 12, trashRadius: 1600, transferTime: 25, supplyStart: null, maxRoute: Infinity, runDistance: 1500, whaleDistance: 2500, timeScale: 3 },
};

function detect(): EditionId {
  // Only from the address (not remembered: a browser that once opened the home edition would
  // otherwise skip the museum's mini-games). Areas keep the address's parameters when reloading.
  if (typeof location === 'undefined') return 'museum';
  return new URLSearchParams(location.search).get('edition') === 'home' ? 'home' : 'museum';
}

const current = EDITIONS[detect()];

/** The edition in use. */
export function getEdition(): Edition {
  return current;
}
