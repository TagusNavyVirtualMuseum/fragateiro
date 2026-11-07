// Canoa do Tejo: a lateen-rigged Tagus boat with a small mizzen (photos of the restored canoa
// "Alma do Tejo": 8.8 m long, 2.2 m beam, about 5 t). Build the model with:
//   node scripts/generate-boat.mjs scripts/boats/canoa.mjs src/assets/models/canoa.glb
//
// s = metres aft of the bow, y = metres above the waterline, z = metres to port.
// Shapes and sail corners measured on a side photo under sail, scaled by the hull length
// (1 px = 1.07 cm): a big triangular lateen (about 52 m²) on a 15 m yard, its peak far aft and
// high; a small lateen mizzen sheeted to a long bumkin; a pointed stern with the rudder on
// the sternpost.

export default {
  name: 'canoa',
  length: 8.8,
  beam: 2.2,
  mass: 5000, // kg; the hull's depth is found so it floats at this weight

  hull: {
    // Height of the top of the side above the waterline: low amidships, rising to a high bow.
    sheer: { mid: 0.72, lowAt: 0.62, bowRise: 0.8, sternRise: 0.12 },
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
      wale: '#3a1c14',
      interior: '#9c7650',
      floor: '#86643f',
      spar: '#5a2618',
      sail: '#ece6d6',
    },
  },

  masts: [
    { id: 'main', s: 3.2, foot: -0.35, top: 11.3, rakeDeg: 2, radius: 0.11 },
    { id: 'mizzen', s: 8.3, z: 0.15, foot: 0.2, top: 5.6, rakeDeg: 0, radius: 0.06 },
  ],

  // Fixed spars: the bowsprit and the long bumkin at the stern (holds the mizzen sheet).
  spars: [
    { name: 'Gurupes', from: [0.5, 1.5, 0], to: [-1.5, 1.87, 0], radius: 0.06 },
    { name: 'Pau_mezena', from: [8.0, 0.95, 0.12], to: [11.2, 1.15, 0.12], radius: 0.045 },
  ],

  // Lateen sails, triangles: tack (the yard's lower end, here also the throat), peak, clew.
  sails: [
    {
      id: 'main',
      mast: 'main',
      sailName: 'Vela',
      yardName: 'Verga',
      yardRadius: 0.1,
      z: 0.2, // the sail hangs on the port side of the mast
      belly: 0.5,
      corners: { tack: [-1.12, 2.67], throat: [-1.1, 2.75], peak: [9.92, 12.64], clew: [8.06, 1.49] },
    },
    {
      id: 'mizzen',
      mast: 'mizzen',
      sailName: 'Vela_mezena',
      yardName: 'Verga_mezena',
      yardRadius: 0.05,
      z: 0.32,
      belly: 0.12,
      corners: { tack: [8.0, 2.03], throat: [8.02, 2.1], peak: [10.35, 5.98], clew: [10.24, 1.39] },
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
