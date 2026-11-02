// How each 3D model is wired to the physics. Coordinates are in the model's own
// frame, in metres: x along the hull (bow towards -x), y up, z across.
// Positions were measured from the model (see docs/MODELS.md).

import faluaUrl from '../assets/models/falua.glb?url';
import muletaUrl from '../assets/models/muleta.glb?url';

export interface PartVisual {
  /** Node names in the glTF file that move together. */
  nodes: string[];
  /** Point (model frame) around which the part turns, about the vertical axis. */
  pivot: [number, number, number];
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
}

export const BOAT_VISUALS: Record<string, BoatVisual> = {
  falua: {
    boat: 'falua',
    url: faluaUrl,
    unit: 0.01,
    scale: 1.34, // model hull is 10.4 m; the physics uses 14 m
    cgX: -0.6,
    waterline: 0.35,
    sails: [
      { sail: 'fore', nodes: ['Vela Frente', 'Mastro03', 'Cordas_Mastro01'], pivot: [-3.53, 0, 0] },
      { sail: 'main', nodes: ['Vela Principal', 'Mastro04', 'Cordas_Mastro02'], pivot: [0.05, 0, 0] },
    ],
    rudder: { nodes: ['Leme01', 'Leme02', 'Leme03'], pivot: [4.05, 0, 0] },
  },
  muleta: {
    boat: 'muleta',
    url: muletaUrl,
    unit: 0.01,
    scale: 1,
    cgX: 0.56,
    waterline: 0.45,
    sails: [
      { sail: 'main', nodes: ['Vela_principal', 'Mastro_vela_maior', 'Mastro_vela_brancos', 'Mastro_vela_rope'], pivot: [-1.13, 0, 0] },
      { sail: 'front', nodes: ['Vela_frente2'], pivot: [-5.07, 0, 0] },
      { sail: 'advanced', nodes: ['vela_avançada'], pivot: [-11.2, 0, -0.2] },
      { sail: 'front-low', nodes: ['vela_frente1'], pivot: [-8.4, 0, -1.1] },
      { sail: 'front-top', nodes: ['vela_frente_cima'], pivot: [-8.68, 0, -0.25] },
      { sail: 'net-sails', nodes: ['mini-vela_rede-frente2', 'mini-vela_rede-frente2.001'], pivot: [-11.1, 0, -0.7] },
      { sail: 'rear-1', nodes: ['vela_tras1'], pivot: [1.13, 0, 0.4] },
      { sail: 'rear-2', nodes: ['vela_tras2'], pivot: [5.04, 0, 0] },
    ],
    rudder: { nodes: ['direcao', 'direcao.001'], pivot: [6.8, 0, 0] },
  },
};
