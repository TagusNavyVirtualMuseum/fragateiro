import type { BoatSpec } from '../types';

// Barco rabelo of the Douro: the flat-bottomed boat that brought the casks of port wine down
// the river to Porto (20 m, 4.5 m beam, about 40 t loaded). One square sail on a yard, set
// across the boat, used with the wind from astern or on the quarter; steered by the
// espadela, a long oar over the stern worked from a platform by the mast. The 3D model was
// made with Meshy from photos and cut by scripts/cut-model.mjs (scripts/boats/rabelo-meshy.mjs).
// The sail (about 10 x 9 m) and the waterline come from it; the rest are estimates.

const mass = 40000; // kg, loaded
const lwl = 17.3;

export const RABELO: BoatSpec = {
  id: 'rabelo',
  name: 'Rabelo',
  description: 'The Douro boat that carried port wine to Porto: one square sail, steered by a long oar over the stern.',
  home: 'douro',
  length: 20,
  beam: 4.5,
  draft: 1.15,
  mass,
  gm: 2.2,
  rollPeriod: 5,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 12, // a flat bottom and no keel: it makes leeway
    lateralCentre: -0.5,
    liftSlope: 2.2,
    stallDeg: 22,
    windageArea: 16,
  },
  // The espadela: a big blade far aft.
  rudder: { area: 2.4, x: -9.4, liftSlope: 3.2, stallDeg: 25, maxAngleDeg: 40 },
  sails: [
    // A square sail turns about the mast; its yard cannot be braced closer than about 35°.
    { id: 'main', name: 'Square sail', group: 'main', area: 75, pivot: [0.5, 0], ceDistance: 0, ceHeight: 6.7, minAngle: 35, maxAngle: 90, efficiency: 0.75 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Square sail set.', sails: ['main'] }],
};
