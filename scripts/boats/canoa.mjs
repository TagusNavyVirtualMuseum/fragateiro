// Canoa do Tejo: a lateen-rigged Tagus boat with a small mizzen (photo of a restored canoa,
// 8.8 m long, 2.2 m beam, about 5 t). Build the model with:
//   node scripts/generate-boat.mjs scripts/boats/canoa.mjs src/assets/models/canoa.glb
//
// s = metres aft of the bow, y = metres above the waterline, z = metres to port.
// Shapes read from the photo; the stern (not in the photo) is a guess: double-ended with a
// straight sternpost carrying the rudder.

export default {
  name: 'canoa',
  length: 8.8,
  beam: 2.2,
  mass: 5000, // kg; the hull's depth is found so it floats at this weight

  hull: {
    // Height of the top of the side above the waterline: low amidships, rising to a high bow.
    sheer: { mid: 0.72, lowAt: 0.62, bowRise: 0.5, sternRise: 0.2 },
    stemReach: 1.6, // the stem curves from the bow down into the keel over this length
    drag: 0.12, // the keel is this much deeper at the stern than forward
    maxBeamAt: 0.47, // widest point, share of the length from the bow
    planFullness: 0.55,
    bilge: 0.55, // section shape amidships (1 = V, lower = rounder)
    widestAt: 0.82, // height of the widest point, share of the side
    tumblehome: 0.03,
    planking: 0.04,
    floor: -0.2,
    thwarts: [2.1, 4.6, 6.5],
    keel: { from: 1.3, depth: 0.12 },
    paint: { bottomTop: 0.04, stripe: 0.03, wale: 0.2 },
    colors: {
      bottom: '#7a2418',
      topsides: '#efeee9',
      stripe: '#c9a227',
      wale: '#5e2014',
      interior: '#9c7650',
      floor: '#86643f',
      spar: '#5a2618',
      sail: '#ece6d6',
    },
  },

  masts: [
    { id: 'main', s: 3.4, foot: -0.35, top: 5.4, rakeDeg: -4, radius: 0.09 },
    { id: 'mizzen', s: 7.75, z: 0.3, foot: 0.0, top: 3.6, rakeDeg: 0, radius: 0.05 },
  ],

  // Fixed spars: the bowsprit (holds the tack of the lateen sail) and the bumkin at the
  // stern (holds the mizzen sheet).
  spars: [
    { name: 'Gurupes', from: [0.6, 1.12, 0], to: [-1.75, 1.38, 0], radius: 0.06 },
    { name: 'Pau_mezena', from: [7.9, 0.95, 0.15], to: [10.2, 0.98, 0.15], radius: 0.04 },
  ],

  // Lateen sails: four corners in (s, y). The yard runs from throat to peak.
  sails: [
    {
      id: 'main',
      mast: 'main',
      sailName: 'Vela',
      yardName: 'Verga',
      yardRadius: 0.08,
      z: 0.16, // the sail hangs on the port side of the mast
      belly: 0.25,
      corners: { tack: [-1.7, 1.42], throat: [-2.0, 2.2], peak: [7.6, 5.6], clew: [6.2, 1.35] },
    },
    {
      id: 'mizzen',
      mast: 'mizzen',
      sailName: 'Vela_mezena',
      yardName: 'Verga_mezena',
      yardRadius: 0.045,
      z: 0.42,
      belly: 0.08,
      corners: { tack: [7.3, 1.45], throat: [7.0, 1.95], peak: [9.6, 3.8], clew: [9.8, 1.5] },
    },
  ],

  // Rudder hung on the sternpost; the blade's trailing edge from bottom to top.
  rudder: {
    pin: { s: 8.8, rake: 0.0 },
    blade: [
      [9.0, -0.62],
      [9.42, -0.55],
      [9.46, 0.15],
      [9.15, 0.65],
      [8.95, 0.95],
    ],
    tiller: { from: [8.9, 0.95, 0], to: [7.2, 1.02, 0], radius: 0.04 },
  },
};
