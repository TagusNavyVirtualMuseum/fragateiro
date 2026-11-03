import type { BoatSpec } from '../types';

// Fragata do Tejo: the big sailing barge of the Tagus (about 18-25 m), which carried cargo
// between Lisbon and the river towns. One raked mast with a large gaff mainsail and a jib.
// Sail positions and areas are measured on the 3D model (22 m long with the rudder).
// Mass, stability and resistance values are estimates; tune them with `npm run polar`.

const mass = 30000; // kg, part-loaded
const lwl = 19;

export const FRAGATA: BoatSpec = {
  id: 'fragata',
  name: 'Fragata',
  description:
    'The large sailing barge of the Tagus, carrying cargo between Lisbon and the river towns. ' +
    'A raked mast with a big gaff mainsail and a jib. A few have been restored and still sail.',
  length: 21,
  beam: 6,
  draft: 1.5,
  mass,
  gm: 3.2, // doubled from the first version: half the heel
  rollPeriod: 5,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 17,
    lateralCentre: 0,
    liftSlope: 2.6, // doubled: half the leeway
    stallDeg: 25,
    windageArea: 16,
  },
  rudder: { area: 5.25, x: -9.5, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    { id: 'jib', name: 'Jib', group: 'jib', area: 45, pivot: [10.1, 0], ceDistance: 2.5, ceHeight: 6.5, minAngle: 8, maxAngle: 80, efficiency: 0.8 },
    { id: 'main', name: 'Mainsail', group: 'main', area: 150, pivot: [5.2, 0], ceDistance: 6, ceHeight: 9, minAngle: 6, maxAngle: 80, efficiency: 0.8 },
  ],
  modes: [{ id: 'sailing', name: 'Sailing', description: 'Mainsail and jib set.', sails: ['jib', 'main'] }],
};
