import type { BoatSpec } from '../types';

// Canoa do Tejo: a small Tagus boat with a lateen sail (vela latina) on a long yard, its
// tack on a bowsprit, and a small lateen mizzen at the stern (8.8 m, 2.2 m beam, about 5 t).
// The 3D model is generated from these dimensions and a photo (scripts/boats/canoa.mjs);
// areas, centres and the waterline length below are what that script prints.
// Stability and resistance values are estimates; tune them with `npm run polar`.

const mass = 5000; // kg
const lwl = 8.1;

export const CANOA: BoatSpec = {
  id: 'canoa',
  name: 'Canoa',
  description:
    'A small, narrow Tagus boat with one big lateen sail on a long yard and a small mizzen ' +
    'at the stern. Light and quick to turn, but it heels more than the beamier boats.',
  length: 8.8,
  beam: 2.2,
  draft: 0.76,
  mass,
  gm: 1.4, // narrow hull: less stable than the Catraio (heels more)
  rollPeriod: 3,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 6.2,
    lateralCentre: -0.33,
    liftSlope: 2.8,
    stallDeg: 25,
    windageArea: 3.5,
  },
  // Blade area 0.6 m², ×1.5 like the other boats so it steers well at game speed.
  rudder: { area: 0.9, x: -4.5, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    { id: 'main', name: 'Lateen sail', group: 'main', area: 21, pivot: [1.25, 0], ceDistance: 0.1, ceHeight: 2.9, minAngle: 6, maxAngle: 80, efficiency: 0.8 },
    { id: 'mizzen', name: 'Mizzen', group: 'mizzen', area: 3.8, pivot: [-3.1, 0], ceDistance: 0.9, ceHeight: 2.3, minAngle: 6, maxAngle: 80, efficiency: 0.8 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Lateen sail and mizzen set.', sails: ['main', 'mizzen'] }],
};
