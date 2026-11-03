import type { BoatSpec } from '../types';

// Catraio: small transport boat of the Tagus, about 10 m, with a spritsail (vela de
// espicha: a diagonal spar holds the peak), a jib on a bowsprit and a small mizzen.
// Sail positions and areas are measured on the 3D model (10 m long).
// Mass, stability and resistance values are estimates; tune them with `npm run polar`.

const mass = 5000; // kg
const lwl = 9.2;

export const CATRAIO: BoatSpec = {
  id: 'catraio',
  name: 'Catraio',
  description:
    'A small Tagus boat for passengers and goods. Its mainsail is held up by a diagonal spar ' +
    '(a sprit, "espicha"), with a jib on the bowsprit and a small mizzen at the stern.',
  length: 10,
  beam: 3.2,
  draft: 1.0,
  mass,
  gm: 2.0, // doubled from the first version: half the heel
  rollPeriod: 3.5,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 7.5,
    lateralCentre: 0.2,
    liftSlope: 2.8, // doubled: half the leeway
    stallDeg: 25,
    windageArea: 5,
  },
  rudder: { area: 1.35, x: -4.8, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    { id: 'jib', name: 'Jib', group: 'jib', area: 14, pivot: [6.7, 0], ceDistance: 1.8, ceHeight: 3.5, minAngle: 8, maxAngle: 80, efficiency: 0.8 },
    { id: 'main', name: 'Spritsail', group: 'main', area: 32, pivot: [3.2, 0], ceDistance: 3, ceHeight: 5.5, minAngle: 6, maxAngle: 80, efficiency: 0.8 },
    { id: 'mizzen', name: 'Mizzen', group: 'mizzen', area: 3, pivot: [-4.45, 0], ceDistance: 0.8, ceHeight: 2.2, minAngle: 6, maxAngle: 80, efficiency: 0.8 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Spritsail, jib and mizzen set.', sails: ['jib', 'main', 'mizzen'] }],
};
