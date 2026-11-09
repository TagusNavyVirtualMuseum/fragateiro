import type { BoatSpec } from '../types';

// Pinasse à voile: the light, narrow, pointed fishing boat of the Bassin d'Arcachon (8.65 m,
// 1.82 m beam, about 600 kg), with one lugsail on a yard and a centreboard. The 3D model was
// made with Meshy from photos and cut into parts by scripts/cut-model.mjs
// (scripts/boats/pinasse-meshy.mjs); the sail's area and centre, the waterline and the draft
// are measured on it. Stability and resistance values are estimates; tune them with
// `npm run polar`.

const mass = 600; // kg, the boat with its gear (the crew not counted)
const lwl = 7.9;

export const PINASSE: BoatSpec = {
  id: 'pinasse',
  name: 'Pinasse',
  description:
    'The light, narrow fishing boat of the Bassin d’Arcachon, with one lugsail and a ' +
    'centreboard. Very light: quick to speed up and to slow down.',
  home: 'arcachon',
  length: 8.65,
  beam: 1.82,
  draft: 0.3,
  mass,
  gm: 1.6, // narrow and light, but the crew sits to windward (it heels more than the others)
  rollPeriod: 2.2,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 2.2, // shallow hull and the centreboard
    lateralCentre: 0.25,
    liftSlope: 3.2, // the centreboard is a deep, efficient foil
    stallDeg: 22,
    windageArea: 1.6,
  },
  rudder: { area: 0.5, x: -4.15, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    { id: 'main', name: 'Lugsail', group: 'main', area: 22, pivot: [1.15, 0], ceDistance: 1.15, ceHeight: 3.0, minAngle: 20, maxAngle: 80, efficiency: 0.8 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Lugsail set, centreboard down.', sails: ['main'] }],
};
