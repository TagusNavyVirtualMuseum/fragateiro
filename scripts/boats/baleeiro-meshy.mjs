// Bote baleeiro of the Azores: the light, narrow open whaleboat (12 m, 2 m beam, about 500 kg)
// that went out from the islands after sperm whales, under oars or under a jib and a big
// mainsail on a boom. Made with Meshy from photos (Meshy_AI_Bote_Baleeiro_Boat_..._texture.glb);
// cut with:
//   node scripts/cut-model.mjs scripts/boats/baleeiro-meshy.mjs baleeiro-meshy.glb src/assets/models/baleeiro.glb
// One piece, bow towards -x, y up. Coordinates in the model's units.

export default {
  // 12 m stem to stern (1.87 units); the hull came out 3.1 m wide: narrowed to 2 m. The
  // waterline is where it displaces 500 kg.
  scale: { x: 6.42, y: 6.42, z: 4.18 },
  origin: { x: -0.01, y: -0.784, z: 0 },
  textureSize: 1024,
  triangles: { Casco: 45000, Vela: 9000, Bujarrona: 4000, Leme: 1500 },

  classify(p) {
    if (p.x > 0.86 && p.y < -0.44) return 'Leme';
    if (p.x > 0.86 && p.x < 0.96 && p.y < -0.405 && Math.abs(p.z) < 0.03) return 'Leme'; // the tiller
    // The mainsail with its boom and yard, aft of the mast (x -0.33..-0.29).
    if (p.x > -0.29 && p.x < 0.98 && p.y > -0.5 && Math.abs(p.z) < 0.03) return 'Vela';
    // The jib, forward of the mast.
    if (p.x < -0.335 && p.x > -0.89 && p.y > -0.455 && Math.abs(p.z) < 0.03) return 'Bujarrona';
    return 'Casco';
  },
};
