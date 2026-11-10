import type { BoatSpec } from '../types';

// Bac à voile of the Bassin d'Arcachon (11.5 m, 3.5 m beam, about 2.9 t): a decked boat with a
// gaff mainsail on a boom and a jib. The 3D model was made with Meshy from photos and cut by
// scripts/cut-model.mjs (scripts/boats/bac-meshy.mjs); sail areas and centres, the waterline
// and the rudder are measured on it. Stability and resistance are estimates.

const mass = 2900; // kg
const lwl = 10.3;

export const BAC: BoatSpec = {
  id: 'bac',
  name: 'Bac',
  description: 'A decked boat of the Bassin d’Arcachon with a gaff mainsail and a jib.',
  home: 'arcachon',
  length: 11.5,
  beam: 3.5,
  draft: 0.65,
  mass,
  gm: 1.6,
  rollPeriod: 3,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 4.5,
    lateralCentre: 0,
    liftSlope: 2.8,
    stallDeg: 24,
    windageArea: 3.5,
  },
  rudder: { area: 0.7, x: -4.68, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    { id: 'jib', name: 'Jib', group: 'jib', area: 14.8, pivot: [6.01, 0], ceDistance: 2.72, ceHeight: 4.1, minAngle: 20, maxAngle: 80, efficiency: 0.8 },
    { id: 'main', name: 'Gaff mainsail', group: 'main', area: 44.8, pivot: [1.79, 0], ceDistance: 2.75, ceHeight: 6.0, minAngle: 20, maxAngle: 80, efficiency: 0.8 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Gaff mainsail and jib set.', sails: ['jib', 'main'] }],
};
