// Bac à voile of the Bassin d'Arcachon (11.5 m, 3.5 m beam, about 2.9 t): a decked boat with a
// gaff mainsail on a boom and a jib. Made with Meshy from photos
// (Meshy_AI_Bac_a_Voile_Sailboat_..._texture.glb); cut with:
//   node scripts/cut-model.mjs scripts/boats/bac-meshy.mjs bac-meshy.glb src/assets/models/bac.glb
// One piece, bow towards -x, y up. Coordinates in the model's units.

/** The mast's axis (it stands upright): x at a height y. */
const mastX = () => -0.225;

export default {
  // 11.5 m stem to stern (1.79 units); the hull came out 2.6 m wide: widened to 3.5 m. The
  // waterline is where it displaces 2.9 t.
  scale: { x: 6.44, y: 6.44, z: 8.68 },
  origin: { x: 0.007, y: -0.857, z: 0 },
  textureSize: 1024,
  triangles: { Casco: 45000, Vela: 9000, Foc: 4000, Leme: 1500 },

  classify(p) {
    if (p.x > 0.76 && p.y < -0.6) return 'Leme';
    // The gaff mainsail, its boom and gaff, aft of the mast.
    if (p.x > mastX(p.y) + 0.025 && p.x < 0.87 && p.y > -0.605 && Math.abs(p.z) < 0.035) return 'Vela';
    // The jib, forward of the mast.
    if (p.x < mastX(p.y) - 0.025 && p.y > -0.68 && Math.abs(p.z) < 0.04) return 'Foc';
    return 'Casco';
  },
};
