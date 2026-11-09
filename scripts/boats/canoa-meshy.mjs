// Canoa do Tejo "Alma do Tejo", made with Meshy from photos (Meshy_AI_Urban_Sails_..._texture.glb).
// Cut into parts with:
//   node scripts/cut-model.mjs scripts/boats/canoa-meshy.mjs canoa-meshy.glb src/assets/models/canoa.glb
//
// The Meshy model is one piece, about 1.9 units tall, bow towards -x, y up, sails on the
// centreline. Coordinates below are in its units. Photos show the boat afloat, so the model
// stops near the waterline (its bottom, y = -0.95); the waterline is put at y = -0.91.

const inBox = (p, b) => p.x > b.x[0] && p.x < b.x[1] && p.y > b.y[0] && p.y < b.y[1] && p.z > b.z[0] && p.z < b.z[1];

// The crew, and the outboard engine on the starboard quarter, are dropped.
const DROP = [
  { x: [-0.24, -0.1], y: [-0.86, -0.68], z: [-0.17, -0.035] }, // by the mast, starboard
  { x: [-0.23, -0.09], y: [-0.86, -0.68], z: [0.035, 0.17] }, // by the mast, port
  { x: [0.16, 0.29], y: [-0.87, -0.735], z: [-0.045, 0.095] }, // amidships
  { x: [0.565, 0.76], y: [-0.97, -0.64], z: [-0.16, -0.035] }, // outboard engine, aft of the transom
  { x: [0.63, 0.76], y: [-0.97, -0.64], z: [-0.035, -0.005] },
  { x: [0.5, 0.565], y: [-0.81, -0.64], z: [-0.16, -0.035] }, // its head, above the quarter
];
/** The rudder, hung on the transom. */
const RUDDER = { x: [0.57, 0.63], y: [-0.96, -0.8], z: [-0.02, 0.02] };
/** Connected pieces dropped: the two flags on the stern. */
const DROP_PIECES = [1, 3];

export default {
  // 8.8 m between the stem and the transom (1.28 units); the mast then stands 11.3 m above
  // the water, as on the real boat. The hull is 0.42 units wide: narrowed to 2.2 m.
  scale: { x: 6.875, y: 6.875, z: 5.26 },
  origin: { x: -0.08, y: -0.91, z: 0 },
  textureSize: 1024,
  triangles: { Casco: 60000, Vela: 16000, Vela_mezena: 4000, Leme: 1500 },

  classify(p, piece) {
    if (DROP_PIECES.includes(piece)) return null;
    if (DROP.some((b) => inBox(p, b))) return null;
    if (inBox(p, RUDDER)) return 'Leme';
    // The mizzen: on the port side of the centreline, aft, above the bumkin.
    if (p.x > 0.44 && p.x < 0.84 && p.z > 0.008 && p.y > -0.775 && p.y < 0) return 'Vela_mezena';
    // The lateen sail and its yard: everything aloft near the centreline (it bellies to
    // starboard), above the gunwale; forward, above the bowsprit and the stem head. The mast
    // above the gunwale goes with it: it turns about its own axis, so that does not show.
    const foot = p.x < -0.64 ? -0.63 : p.x < -0.55 ? -0.7 : -0.78;
    if (p.y > foot && p.z > -0.17 && p.z < 0.012) return 'Vela';
    return 'Casco';
  },
};
