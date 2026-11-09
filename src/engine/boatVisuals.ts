// How each 3D model is wired to the physics. Coordinates are in the model's own
// frame, in metres: x along the hull (bow towards -x), y up, z across.
// Positions were measured from the model (see docs/MODELS.md).

import faluaUrl from '../assets/models/falua.glb?url';
import muletaUrl from '../assets/models/muleta.glb?url';
import fragataUrl from '../assets/models/fragata.glb?url';
import catraioUrl from '../assets/models/catraio.glb?url';
import canoaUrl from '../assets/models/canoa.glb?url';
// Light versions for boats seen from afar (scripts/lite-models.ts).
import faluaLite from '../assets/models/lite/falua.glb?url';
import muletaLite from '../assets/models/lite/muleta.glb?url';
import fragataLite from '../assets/models/lite/fragata.glb?url';
import catraioLite from '../assets/models/lite/catraio.glb?url';
import canoaLite from '../assets/models/lite/canoa.glb?url';
import pinasseUrl from '../assets/models/pinasse.glb?url';
import pinasseLite from '../assets/models/lite/pinasse.glb?url';

/** Light model of each boat, for the other boats sailing on the river. */
export const LITE_URLS: Record<string, string> = { falua: faluaLite, muleta: muletaLite, fragata: fragataLite, catraio: catraioLite, canoa: canoaLite, pinasse: pinasseLite };

type V3 = [number, number, number];

export interface PartVisual {
  /** Node names in the glTF file that move together. */
  nodes: string[];
  /** Point (model frame) around which the part turns, about the vertical axis. */
  pivot: V3;
  /**
   * For a raked (leaning) mast: turn about the mast's own axis instead, pivoting at the
   * masthead, so the yard stays against the mast. Points measured on the mast mesh.
   */
  axis?: { base: V3; top: V3 };
}

export interface SailVisual extends PartVisual {
  /** Physics sail id. */
  sail: string;
}

export interface BoatVisual {
  boat: string;
  url: string;
  /** Model units -> metres. */
  unit: number;
  /** Extra scale so the model matches the boat length used by the physics. */
  scale: number;
  /** Model x of the centre of gravity. */
  cgX: number;
  /** Model y of the waterline. */
  waterline: number;
  sails: SailVisual[];
  rudder: PartVisual;
  /** Model nodes never shown (e.g. ropes of sails that move, which would float in the air). */
  hiddenNodes?: string[];
  /** The model's bow points towards +x (most of our models point towards -x). */
  bowPositiveX?: boolean;
  /**
   * The hull's outer planking. Its shape at the waterline is measured when the model loads,
   * and no water is drawn inside it (so open holds stay dry).
   */
  hullNodes: string[];
  /**
   * Metal arch across the stern, above the tiller (the "horse" the mainsheet runs on), in
   * the model frame: its position along the hull, its feet's half-width and height, and
   * the height of its top.
   */
  horse?: { x: number; halfWidth: number; footY: number; topY: number };
  /** Sheets (ropes from a sail's clew to the boat), drawn as lines. */
  sheets?: SheetVisual[];
}

export interface SheetVisual {
  sail: string;
  /** The sail's clew (lower aft corner), model frame. */
  clew: V3;
  /**
   * 'horse': to a block sliding on the arch; a point: to that one fitting; or fittings on
   * each side (the leeward sheet taut, the windward one slack).
   */
  to: 'horse' | V3 | { port: V3; starboard: V3 };
}

export const BOAT_VISUALS: Record<string, BoatVisual> = {
  falua: {
    boat: 'falua',
    hullNodes: ['Casco'],
    url: faluaUrl,
    unit: 0.01,
    scale: 1.34, // model hull is 10.4 m; the physics uses 14 m
    cgX: -0.6,
    waterline: -0.32, // same share of hull under water as the Muleta (this model has no red bottom paint)
    sails: [
      {
        sail: 'fore',
        nodes: ['Vela Frente', 'Mastro03', 'Cordas_Mastro01'],
        pivot: [-3.53, 0, 0],
        axis: { base: [-3.85, 0.51, 0], top: [-3.11, 6.49, 0] }, // mast Mastro01
      },
      {
        sail: 'main',
        nodes: ['Vela Principal', 'Mastro04', 'Cordas_Mastro02'],
        pivot: [0.05, 0, 0],
        axis: { base: [-0.45, 0.38, 0], top: [0.73, 7.16, 0] }, // mast Mastro02
      },
    ],
    // Blade and tiller turn about the raked pin (the thin grey cylinder between hull and rudder).
    // Mainsheet on an arch over the tiller at the narrow stern; fore sheets to the rails.
    // (Bow towards -x: starboard is -z.)
    horse: { x: 3.6, halfWidth: 0.92, footY: 1.12, topY: 1.9 },
    sheets: [
      { sail: 'main', clew: [3.23, 1.75, 0.0], to: 'horse' },
      { sail: 'fore', clew: [-0.54, 1.49, -0.17], to: { port: [0.3, 0.85, 1.45], starboard: [0.3, 0.85, -1.45] } },
    ],
    rudder: {
      nodes: ['Leme01', 'Leme02', 'Leme03'],
      pivot: [4.3, 0, 0],
      axis: { base: [3.897, -0.738, 0], top: [4.784, 1.003, 0] }, // node Pin
    },
    // Halyard blocks: their ropes turn with the yards, so on their own they would float in the air.
    hiddenNodes: ['Roldana02', 'Roldana02.001'],
  },
  muleta: {
    boat: 'muleta',
    hullNodes: ['casco.001', 'casco.002'],
    url: muletaUrl,
    unit: 0.01,
    scale: 1,
    cgX: 0.56,
    waterline: -0.5, // top 20 % of the red bottom paint shows (red spans -0.86..-0.41 at midships)
    sails: [
      {
        sail: 'main',
        // Sail, yards, and the blocks and rings that hang from the yard.
        nodes: ['Vela_principal', 'Mastro_vela_maior', 'Mastro_vela_brancos', 'Mastro_vela_rope', 'Torus.006', 'Torus.007', 'Cylinder.016', 'Cylinder.017'],
        pivot: [-1.13, 0, 0],
        axis: { base: [-0.09, 0.24, 0], top: [-2.32, 7.32, 0] }, // mast mastro_principal
      },
      {
        sail: 'front',
        nodes: ['Vela_frente2'],
        pivot: [-5.07, 0, 0],
        axis: { base: [-3.42, 0.51, 0], top: [-6.64, 6.79, 0] }, // mast mastro_frente2
      },
      { sail: 'advanced', nodes: ['vela_avançada'], pivot: [-11.2, 0, -0.2] },
      { sail: 'front-low', nodes: ['vela_frente1'], pivot: [-8.4, 0, -1.1] },
      { sail: 'front-top', nodes: ['vela_frente_cima'], pivot: [-8.68, 0, -0.25] },
      { sail: 'net-sails', nodes: ['mini-vela_rede-frente2', 'mini-vela_rede-frente2.001'], pivot: [-11.1, 0, -0.7] },
      { sail: 'rear-1', nodes: ['vela_tras1'], pivot: [1.13, 0, 0.4] },
      { sail: 'rear-2', nodes: ['vela_tras2'], pivot: [5.04, 0, 0] },
    ],
    // Mainsheet on an arch at the stern; front sheets to the rails; when fishing, the stern
    // sails sheet to the tip of the stern net boom and the bow sails to the rails.
    horse: { x: 5.6, halfWidth: 1.15, footY: 1.0, topY: 1.9 },
    sheets: [
      { sail: 'main', clew: [5.55, 2.44, -0.33], to: 'horse' },
      { sail: 'front', clew: [-4.43, 3.07, -0.62], to: { port: [-3.0, 1.0, 1.8], starboard: [-3.0, 1.0, -1.8] } },
      { sail: 'rear-1', clew: [11.6, 3.47, -0.02], to: [13.0, 2.79, 0.06] },
      { sail: 'rear-2', clew: [12.29, 3.35, 0.0], to: [13.0, 2.79, 0.06] },
      { sail: 'front-low', clew: [-1.05, 1.85, -1.74], to: [-0.5, 1.0, -1.8] },
      { sail: 'front-top', clew: [-3.83, 6.35, -0.02], to: { port: [-3.0, 1.0, 1.8], starboard: [-3.0, 1.0, -1.8] } },
      { sail: 'advanced', clew: [-6.96, 4.48, -0.04], to: { port: [-5.2, 1.3, 0.9], starboard: [-5.2, 1.3, -0.9] } },
    ],
    // Blade plus the yoke on its head (the cross bar 'Guia' and its blocks).
    rudder: {
      nodes: ['direcao', 'direcao.001', 'Guia', 'roldana_direcao1'],
      pivot: [7.0, 0, 0],
      axis: { base: [7.05, -0.1, 0], top: [6.97, 0.9, 0] }, // through the gudgeons suporte_quilha_1/2
    },
    // Halyards and sheets of the fishing sails. They are fixed in the model, so they would
    // hang in the air as soon as the sails (or the main yard) turn.
    hiddenNodes: [
      // bow sails
      'Cylinder.001', 'Cylinder.002', 'Cylinder.003', 'Cylinder.005', 'Cylinder.008', 'Cylinder.009',
      // stern sails: halyards to the main yard, head blocks, sheets to the stern boom
      'Cylinder.014', 'Cylinder.015', 'Cylinder.018', 'Cylinder.019', 'Cylinder.020', 'Cylinder.021',
      'Cylinder.022', 'Cylinder.023', 'Cylinder.024', 'Torus.001', 'Torus.002', 'Torus.003', 'Torus.004', 'Torus.005', 'Torus.013',
    ],
  },
  fragata: {
    boat: 'fragata',
    hullNodes: ['Corpo_part12'],
    url: fragataUrl,
    unit: 0.01,
    scale: 1,
    bowPositiveX: true,
    cgX: -0.8,
    waterline: -0.6,
    sails: [
      {
        sail: 'jib',
        nodes: ['Vela Frontal.001'],
        pivot: [9.32, 3.06, 0],
        axis: { base: [9.32, 3.06, 0.02], top: [2.09, 15.53, 0.04] }, // the stay: tack to head
      },
      {
        sail: 'main',
        // Mainsail, gaff (Circle.001 was split into pieces; part69 is the gaff), the blocks and
        // rings along the gaff, and the halyards between gaff and mast. Their mast ends are on
        // the turning axis, so they stay attached at both ends.
        nodes: [
          'vela_Trazeira.001', 'Circle.001_part69',
          ...[5, 6, 7, 8, 9, 10, ...rangeNums(25, 47), 53, 54, 56].map((i) => `Circle.001_part${i}`),
          'Circle.029', 'Circle.047', 'Circle.048', 'Circle.049',
        ],
        pivot: [4.5, 0, 0],
        axis: { base: [5.174, -0.854, 0.016], top: [0.413, 18.184, 0.007] }, // mast, Circle.001_part52
      },
    ],
    // Mainsheet on an arch over the tiller; jib sheets to the rails at midships.
    // (Bow towards +x here, so starboard is +z.)
    horse: { x: -9.0, halfWidth: 2.25, footY: 1.85, topY: 2.95 },
    sheets: [
      { sail: 'main', clew: [-8.11, 2.95, 1.11], to: 'horse' },
      { sail: 'jib', clew: [4.47, 2.91, 1.34], to: { port: [2.5, 1.9, -2.4], starboard: [2.5, 1.9, 2.4] } },
    ],
    // Rudder blade and tiller (pieces of the hull mesh Corpo), about the hinge line.
    rudder: {
      nodes: ['Corpo_part9', 'Corpo_part23'],
      pivot: [-10, 0, 0],
      axis: { base: [-9.941, -1.684, 0], top: [-10.662, 2.314, 0] },
    },
  },
  catraio: {
    boat: 'catraio',
    hullNodes: ['Casco'],
    url: catraioUrl,
    unit: 0.01,
    scale: 1,
    cgX: -0.55,
    waterline: -0.32, // same hull as the Falua
    sails: [
      {
        sail: 'jib',
        nodes: ['Vela.001'],
        pivot: [-7.26, 1.28, 0],
        axis: { base: [-7.26, 1.28, 0.13], top: [-2.72, 7.64, 0.08] }, // the stay: bowsprit end to mast
      },
      {
        sail: 'main',
        // Spritsail, its sprit (Mastro_part4) and the lacing along the sprit.
        nodes: ['Vela', 'Mastro_part4', ...range('CordasMastro.', 13, 30)],
        pivot: [-3.3, 0, 0],
        axis: { base: [-3.894, 0.53, 0], top: [-2.408, 8.014, 0] }, // main mast, Mastro_part1
      },
      {
        sail: 'mizzen',
        nodes: ['Vela.002', 'Mastro_part3', ...range('CordasMastro.', 31, 50)],
        pivot: [4.0, 0, 0],
        axis: { base: [3.716, 0.965, 0.673], top: [4.304, 3.201, 0.677] }, // mizzen mast, Mastro_part2
      },
    ],
    // Spritsail sheet on an arch over the tiller; jib sheets to the rails; mizzen sheet to
    // the end of the bumkin. The model's fixed copies of these ropes are hidden.
    horse: { x: 3.1, halfWidth: 1.02, footY: 0.92, topY: 1.75 },
    sheets: [
      { sail: 'main', clew: [2.66, 1.49, 0.11], to: 'horse' },
      { sail: 'jib', clew: [-3.83, 1.53, 0.01], to: { port: [-2.0, 0.85, 1.5], starboard: [-2.0, 0.85, -1.5] } },
      { sail: 'mizzen', clew: [5.54, 1.28, 0.36], to: [6.12, 0.76, 0.29] },
    ],
    hiddenNodes: ['Cordas_part1', 'Cordas_part2', 'Cordas_part5'],
    rudder: {
      nodes: ['Leme01', 'Leme01.001', 'Leme02', 'Leme02.001'],
      pivot: [4, 0, 0],
      axis: { base: [3.614, -0.739, 0], top: [4.434, 1.003, 0] }, // node Pin
    },
  },
  canoa: {
    boat: 'canoa',
    // Made with Meshy from photos of the "Alma do Tejo", cut into parts by
    // scripts/cut-model.mjs (scripts/boats/canoa-meshy.mjs); model in metres, waterline at 0.
    hullNodes: ['Casco'],
    url: canoaUrl,
    unit: 1,
    scale: 1,
    cgX: 0.59,
    waterline: 0,
    sails: [
      {
        sail: 'main',
        // The mast above the gunwale is part of 'Vela': it turns about its own axis.
        nodes: ['Vela'],
        pivot: [-0.91, 0, 0],
        axis: { base: [-0.914, 0.89, 0], top: [-0.722, 11.28, 0] }, // mast, raked slightly aft
      },
      {
        sail: 'mizzen',
        nodes: ['Vela_mezena'],
        pivot: [3.77, 0, 0.1],
        axis: { base: [3.767, 0.93, 0.105], top: [3.987, 4.19, 0.21] }, // the mizzen's luff
      },
    ],
    // Lateen sheet on an arch over the after deck; mizzen sheet to the end of the bumkin.
    horse: { x: 3.0, halfWidth: 0.75, footY: 0.65, topY: 1.15 },
    sheets: [
      { sail: 'main', clew: [3.92, 1.6, -0.26], to: 'horse' },
      { sail: 'mizzen', clew: [6.26, 0.83, 0.16], to: [6.85, 0.93, 0] },
    ],
    rudder: {
      nodes: ['Leme'],
      pivot: [4.43, 0, 0],
      axis: { base: [4.43, -0.34, 0], top: [4.43, 0.83, 0] }, // hung on the transom
    },
  },
  pinasse: {
    boat: 'pinasse',
    // Made with Meshy from photos, cut into parts by scripts/cut-model.mjs
    // (scripts/boats/pinasse-meshy.mjs); model in metres, waterline at 0.
    hullNodes: ['Casco'],
    url: pinasseUrl,
    unit: 1,
    scale: 1,
    cgX: 0.2,
    waterline: 0,
    sails: [
      {
        sail: 'main',
        nodes: ['Vela'],
        pivot: [-0.95, 0, 0],
        axis: { base: [-0.967, 0.34, 0], top: [-0.531, 5.7, 0] }, // the mast, raked aft
      },
    ],
    // The sheet from the clew to the stern, by the tiller.
    sheets: [{ sail: 'main', clew: [3.77, 1.1, 0], to: [3.95, 0.75, 0] }],
    rudder: {
      nodes: ['Leme'],
      pivot: [4.35, 0, 0],
      axis: { base: [4.35, -0.42, 0], top: [4.35, 1.0, 0] }, // hung on the sternpost
    },
  },
};

function rangeNums(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** ['CordasMastro.013', ...] style node name lists. */
function range(prefix: string, from: number, to: number): string[] {
  const out: string[] = [];
  for (let i = from; i <= to; i++) out.push(`${prefix}${String(i).padStart(3, '0')}`);
  return out;
}
