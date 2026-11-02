// How each 3D model is wired to the physics. Coordinates are in the model's own
// frame, in metres: x along the hull (bow towards -x), y up, z across.
// Positions were measured from the model (see docs/MODELS.md).

import faluaUrl from '../assets/models/falua.glb?url';
import muletaUrl from '../assets/models/muleta.glb?url';

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
  /** The sails are single planes and must be drawn from both sides. */
  singleSidedSails?: boolean;
}

export const BOAT_VISUALS: Record<string, BoatVisual> = {
  falua: {
    boat: 'falua',
    url: faluaUrl,
    unit: 0.01,
    scale: 1.34, // model hull is 10.4 m; the physics uses 14 m
    cgX: -0.6,
    waterline: -0.25,
    singleSidedSails: true,
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
    rudder: { nodes: ['Leme01', 'Leme02', 'Leme03'], pivot: [4.05, 0, 0] },
  },
  muleta: {
    boat: 'muleta',
    url: muletaUrl,
    unit: 0.01,
    scale: 1,
    cgX: 0.56,
    waterline: 0.05,
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
    rudder: { nodes: ['direcao', 'direcao.001'], pivot: [6.8, 0, 0] },
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
};
