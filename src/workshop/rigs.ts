// The kinds of sail the boat workshop knows: which points the user clicks on the side view
// (in order), which spars carry the sail, and how it turns in the game. Plain TypeScript.

export type RigType = 'lateen' | 'lug' | 'gaff' | 'sprit' | 'jib' | 'square';

export interface RigInfo {
  id: RigType;
  name: string;
  /** What it is, for the menu. */
  hint: string;
  /** Points to click, in order (side view). */
  points: string[];
  /**
   * Spars, as pairs of point names: the yard of a lateen, the gaff and the boom, the sprit.
   * (A square sail's yard runs across the boat: it is built from the yard length instead.)
   */
  spars: [string, string][];
  /** The sail turns about its mast, about the stay (a jib), or swings on its yard (square). */
  turns: 'mast' | 'stay' | 'yard';
}

export const RIGS: Record<RigType, RigInfo> = {
  lateen: {
    id: 'lateen',
    name: 'Lateen',
    hint: 'A triangle on a long yard slanting up the mast (Falua, Canoa).',
    points: ['tack (front low corner)', 'peak (top of the yard)', 'clew (back low corner)'],
    spars: [['tack (front low corner)', 'peak (top of the yard)']],
    turns: 'mast',
  },
  lug: {
    id: 'lug',
    name: 'Lugsail',
    hint: 'Four sides, the head on a yard that crosses the mast (Moliceiro, Pinasse).',
    points: ['throat (front end of the yard)', 'peak (back end of the yard)', 'clew (back low corner)', 'tack (front low corner)'],
    spars: [['throat (front end of the yard)', 'peak (back end of the yard)']],
    turns: 'mast',
  },
  gaff: {
    id: 'gaff',
    name: 'Gaff sail',
    hint: 'Four sides, the head on a gaff and the foot on a boom (Fragata, Bac).',
    points: ['throat (gaff at the mast)', 'peak (end of the gaff)', 'clew (end of the boom)', 'tack (boom at the mast)'],
    spars: [
      ['throat (gaff at the mast)', 'peak (end of the gaff)'],
      ['tack (boom at the mast)', 'clew (end of the boom)'],
    ],
    turns: 'mast',
  },
  sprit: {
    id: 'sprit',
    name: 'Spritsail',
    hint: 'Four sides, held up by a diagonal spar, the espicha (Catraio).',
    points: ['throat (top of the luff, at the mast)', 'peak (top back corner)', 'clew (back low corner)', 'tack (front low corner)'],
    spars: [['tack (front low corner)', 'peak (top back corner)']],
    turns: 'mast',
  },
  jib: {
    id: 'jib',
    name: 'Jib / staysail',
    hint: 'A triangle on a stay, in front of the mast.',
    points: ['tack (low front corner)', 'head (top)', 'clew (back low corner)'],
    spars: [],
    turns: 'stay',
  },
  square: {
    id: 'square',
    name: 'Square sail',
    hint: 'Set across the boat on a yard (Rabelo). Seen from the side it is a curve: click its top at the yard, the furthest point of its belly, and its foot; then give the yard length.',
    points: ['yard (top, at the mast)', 'belly (furthest point of the curve)', 'foot (bottom of the sail)'],
    spars: [],
    turns: 'yard',
  },
};
export const RIG_TYPES = Object.keys(RIGS) as RigType[];
