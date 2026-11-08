import type { BoatSpec } from '../types';

// Falua: fast passenger and cargo boat of the Tagus, about 14–18 m long, with two
// large lateen sails (paper, Table 1: length 14–18 m, beam 3.5–4.5 m, draft 1.5 m).
// Sail positions and areas are measured on the 3D model (scaled to 14 m).
// Mass, stability and resistance values are estimates; tune them with `npm run polar`.

const mass = 15000; // kg
const lwl = 13; // m

export const FALUA: BoatSpec = {
  id: 'falua',
  name: 'Falua',
  description:
    'A fast Tagus boat that carried passengers and light cargo to the Lisbon markets. ' +
    'Two triangular lateen sails, crew of two or three. No original Falua survives today.',
  length: 14,
  beam: 4,
  draft: 1.5,
  mass,
  gm: 2.2, // doubled from the first version: half the heel
  rollPeriod: 4,
  hull: {
    waterlineLength: lwl,
    // Wetted surface estimate used by the original simulator: S = 2.6 * sqrt(volume * Lwl)
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 11,
    lateralCentre: 0.3,
    liftSlope: 2.8, // doubled: half the leeway
    stallDeg: 25,
    windageArea: 8,
  },
  rudder: { area: 2.1, x: -6.6, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    {
      id: 'fore',
      name: 'Fore sail',
      group: 'fore',
      area: 45,
      pivot: [3.9, 0],
      ceDistance: 0.8,
      ceHeight: 5.5,
      minAngle: 20,
      maxAngle: 80,
      efficiency: 0.8,
    },
    {
      id: 'main',
      name: 'Main sail',
      group: 'main',
      area: 65,
      pivot: [-0.9, 0],
      ceDistance: 1.3,
      ceHeight: 5.5,
      minAngle: 20,
      maxAngle: 80,
      efficiency: 0.8,
    },
  ],
  modes: [
    {
      id: 'sailing',
      name: 'Sailing',
      description: 'Both lateen sails set.',
      sails: ['fore', 'main'],
    },
  ],
};
