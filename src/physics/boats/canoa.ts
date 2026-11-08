import type { BoatSpec } from '../types';

// Canoa do Tejo: a small Tagus boat with a lateen sail (vela latina) on a long yard, its
// tack at the bow, and a small lateen mizzen at the stern (8.8 m, 2.2 m beam, about 5 t).
// The 3D model is generated from these dimensions and photos of the "Alma do Tejo"
// (scripts/boats/canoa.mjs);
// areas, centres and the waterline length below are what that script prints.
// Stability and resistance values are estimates; tune them with `npm run polar`.

const mass = 5000; // kg
const lwl = 8.1;

export const CANOA: BoatSpec = {
  id: 'canoa',
  name: 'Canoa',
  description:
    'A small, narrow Tagus boat with one big triangular lateen sail on a long yard and a small ' +
    'mizzen at the stern. Light and quick, with a lot of sail for its size.',
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
    lateralCentre: -0.7, // the deep sternpost and the rudder grip the water aft
    liftSlope: 2.8,
    stallDeg: 25,
    windageArea: 3.5,
  },
  // A big rudder, as canoas carry, to steer the large lateen.
  rudder: { area: 1.2, x: -4.5, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    { id: 'main', name: 'Lateen sail', group: 'main', area: 52.6, pivot: [1.5, 0], ceDistance: 2.4, ceHeight: 5.6, minAngle: 20, maxAngle: 80, efficiency: 0.8 },
    { id: 'mizzen', name: 'Mizzen', group: 'mizzen', area: 5.2, pivot: [-3.6, 0], ceDistance: 1.2, ceHeight: 3.1, minAngle: 20, maxAngle: 80, efficiency: 0.8 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Lateen sail and mizzen set.', sails: ['main', 'mizzen'] }],
};
