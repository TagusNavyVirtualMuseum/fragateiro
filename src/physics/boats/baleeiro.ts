import type { BoatSpec } from '../types';

// Bote baleeiro of the Azores: the light, narrow open whaleboat (12 m, 2 m beam, about 500 kg)
// that went out after sperm whales, rowed or sailed with a jib and a big mainsail on a boom.
// The 3D model was made with Meshy from photos and cut by scripts/cut-model.mjs
// (scripts/boats/baleeiro-meshy.mjs); sail areas and centres, the waterline and the rudder are
// measured on it. Stability (the crew sits to windward) and resistance are estimates.

const mass = 500; // kg, the boat alone
const lwl = 10.4;

export const BALEEIRO: BoatSpec = {
  id: 'baleeiro',
  name: 'Baleeiro',
  description: 'The Azorean whaleboat: long, light and narrow, very fast under its jib and big mainsail.',
  home: 'azores',
  length: 12,
  beam: 2,
  draft: 0.3,
  mass,
  gm: 5, // a crew of seven sits to windward: without them it would capsize
  rollPeriod: 2.2,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.035,
    lateralArea: 2.6, // a shallow hull and its centreboard
    lateralCentre: 0.2,
    liftSlope: 3.0,
    stallDeg: 22,
    windageArea: 1.6,
  },
  rudder: { area: 0.5, x: -5.38, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    { id: 'jib', name: 'Jib', group: 'jib', area: 7.2, pivot: [5.76, 0], ceDistance: 2.25, ceHeight: 3.9, minAngle: 20, maxAngle: 80, efficiency: 0.8 },
    { id: 'main', name: 'Mainsail', group: 'main', area: 32, pivot: [2.23, 0], ceDistance: 3.36, ceHeight: 5.0, minAngle: 20, maxAngle: 80, efficiency: 0.8 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Jib and mainsail set.', sails: ['jib', 'main'] }],
};
