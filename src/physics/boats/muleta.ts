import type { BoatSpec } from '../types';

// Muleta of Seixal: fishing boat famous for trawling SIDEWAYS, pushed by the wind
// with many sails set on long booms at the bow and stern (paper, Table 1:
// length 10–12 m, beam 2.5–3 m, draft 0.8–1 m).
//
// Two modes:
//  - regular: main sail + front sail, steered with the rudder like any boat;
//  - fishing: every sail is set and the net hangs from the boom tips. The boat lies
//    beam-on to the wind and drifts sideways; trimming the front and rear sails
//    against each other keeps it square to the wind.
//
// Sail positions and areas are measured on the 3D model. Mass, stability and
// resistance values are estimates; tune them with `npm run polar`.

const mass = 7000; // kg
const lwl = 10.5; // m

export const MULETA: BoatSpec = {
  id: 'muleta',
  name: 'Muleta',
  description:
    'The legendary fishing boat of Seixal (15th–19th century). It dragged its net sideways ' +
    'through the water, driven by up to 12 sails. The technique has been almost entirely lost.',
  length: 11,
  beam: 3,
  draft: 0.9,
  mass,
  gm: 2.4, // doubled from the first version: half the heel
  rollPeriod: 3.5,
  hull: {
    waterlineLength: lwl,
    wettedArea: 2.6 * Math.sqrt((mass / 1025) * lwl),
    cf: 0.005,
    waveCoef: 0.04,
    lateralArea: 6.5,
    lateralCentre: 0.2,
    liftSlope: 2.8, // doubled: half the leeway
    stallDeg: 25,
    windageArea: 6,
  },
  rudder: { area: 1.5, x: -6.8, liftSlope: 3.5, stallDeg: 25, maxAngleDeg: 35 },
  sails: [
    { id: 'main', name: 'Main sail', group: 'main', area: 60, pivot: [1.7, 0], ceDistance: 1.5, ceHeight: 6, minAngle: 6, maxAngle: 80, efficiency: 0.8 },
    { id: 'front', name: 'Front sail', group: 'front', area: 12, pivot: [5.6, 0], ceDistance: 0.9, ceHeight: 4.5, minAngle: 6, maxAngle: 80, efficiency: 0.8 },
    // Fishing sails (bowsprit and net booms)
    { id: 'advanced', name: 'Vela avançada', group: 'front', area: 6, pivot: [11.8, 0], ceDistance: 1.5, ceHeight: 5, minAngle: 4, maxAngle: 70, efficiency: 0.8 },
    { id: 'front-low', name: 'Lower front sail', group: 'front', area: 8, pivot: [9, 0], ceDistance: 2.5, ceHeight: 3, minAngle: 4, maxAngle: 70, efficiency: 0.8 },
    { id: 'front-top', name: 'Upper front sail', group: 'front', area: 9, pivot: [9.2, 0], ceDistance: 1.6, ceHeight: 5, minAngle: 4, maxAngle: 70, efficiency: 0.8 },
    { id: 'net-sails', name: 'Net-boom sails', group: 'front', area: 5, pivot: [11.6, 0], ceDistance: 0.9, ceHeight: 4, minAngle: 4, maxAngle: 70, efficiency: 0.8 },
    { id: 'rear-1', name: 'Rear sail 1', group: 'rear', area: 15, pivot: [-0.6, 0], ceDistance: 3.5, ceHeight: 5, minAngle: 4, maxAngle: 70, efficiency: 0.8 },
    { id: 'rear-2', name: 'Rear sail 2', group: 'rear', area: 15, pivot: [-4.5, 0], ceDistance: 2.4, ceHeight: 6, minAngle: 4, maxAngle: 70, efficiency: 0.8 },
  ],
  modes: [
    {
      id: 'regular',
      name: 'Regular sailing',
      description: 'Main and front sails only. Steer with the rudder.',
      sails: ['main', 'front'],
    },
    {
      id: 'fishing',
      name: 'Lateral fishing',
      description:
        'All sails set and the net out. Lie beam-on to the wind and drift sideways; ' +
        'balance the front and rear sails to stay square to the wind.',
      sails: ['main', 'front', 'advanced', 'front-low', 'front-top', 'net-sails', 'rear-1', 'rear-2'],
      net: true,
    },
  ],
  net: {
    // Tips of the net booms at the bow and at the stern.
    points: [
      [12.8, 0],
      [-12.4, 0],
    ],
    dragArea: 8,
  },
};
