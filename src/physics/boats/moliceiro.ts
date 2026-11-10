import type { BoatSpec } from '../types';

// Moliceiro of the Ria de Aveiro: a long, flat, shallow boat with a curling, painted prow,
// built to gather seaweed (moliço) in the lagoon; one lugsail on a yard, a big rudder (15 m,
// 2.5 m beam, about 6 t). The 3D model was made with Meshy from photos and cut by
// scripts/cut-model.mjs (scripts/boats/moliceiro-meshy.mjs); positions, the waterline and the
// rudder come from it. The model's sail measures about 96 m², which looks large: the
// physics uses 70 m² until better figures are found. Stability and resistance are estimates;
// tune them with `npm run polar`.

const mass = 6000; // kg
const lwl = 13;

export const MOLICEIRO: BoatSpec = {
  id: 'moliceiro',
  name: 'Moliceiro',
  description: 'The painted seaweed boat of the Ria de Aveiro: long, flat and shallow, with one big lugsail.',
  home: 'aveiro',
  length: 15,
  beam: 2.5,
  draft: 0.5,
  mass,
  gm: 1.8,
  rollPeriod: 3,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 5, // flat-bottomed: little grip (moliceiros used leeboards in open water)
    lateralCentre: -0.3,
    liftSlope: 2.6,
    stallDeg: 22,
    windageArea: 5,
  },
  rudder: { area: 1.6, x: -7.2, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    // One sail: it can be hauled right in, along the hull.
    { id: 'main', name: 'Lugsail', group: 'main', area: 70, pivot: [2.9, 0], ceDistance: 3, ceHeight: 5.9, minAngle: 0, maxAngle: 80, efficiency: 0.8 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Lugsail set.', sails: ['main'] }],
};
