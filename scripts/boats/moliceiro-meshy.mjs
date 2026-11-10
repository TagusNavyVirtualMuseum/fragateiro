// Moliceiro of the Ria de Aveiro (15 m, 2.5 m beam, about 6 t), made with Meshy from photos
// (Meshy_AI_Moliceiro_Boat_..._image-to-3d-texture.glb). Cut into parts with:
//   node scripts/cut-model.mjs scripts/boats/moliceiro-meshy.mjs moliceiro-meshy.glb src/assets/models/moliceiro.glb
//
// One piece, bow (the painted, curling prow) towards -x, y up: a lugsail on a yard, the mast
// raked aft, a big rudder with its tiller. Coordinates in the model's units.

/** The mast's axis: x at a height y. */
const mastX = (y) => -0.31 + (y + 0.66) * 0.263;

export default {
  // 15 m from the prow to the stern (1.65 units); the hull came out 4.4 m wide: narrowed to
  // 2.5 m. The waterline is where it displaces 6 t.
  scale: { x: 9.1, y: 9.1, z: 5.2 },
  origin: { x: -0.1, y: -0.75, z: 0 },
  textureSize: 1024,
  triangles: { Casco: 50000, Vela: 12000, Leme: 2500 },

  classify(p) {
    // The Portuguese flag at the peak of the yard.
    if (p.x > 0.8 && p.y > 0.55) return null;
    // The rudder hung on the stern, and its tiller.
    if (Math.abs(p.z) < 0.045 && p.x > 0.73 && p.y < -0.35) return 'Leme';
    if (Math.abs(p.z) < 0.03 && p.x > 0.62 && p.y > -0.6 && p.y < -0.52) return 'Leme';
    // The mast stays, except where the yard crosses it.
    if (Math.hypot(p.x - mastX(p.y), p.z) < 0.035 && (p.y < 0.28 || p.y > 0.42)) return 'Casco';
    // The sail and its yard: aloft on the centreline, clear of the prow.
    if (p.y > -0.64 && Math.abs(p.z) < 0.08 && p.x > -0.6 && p.x < 0.8) return 'Vela';
    return 'Casco';
  },
};
