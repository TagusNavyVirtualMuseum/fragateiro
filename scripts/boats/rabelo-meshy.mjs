// Barco rabelo of the Douro (20 m, 4.5 m beam, about 40 t loaded with port-wine casks), made
// with Meshy from photos (Meshy_AI_Rabelo_Boat_..._image-to-3d-texture.glb). Cut with:
//   node scripts/cut-model.mjs scripts/boats/rabelo-meshy.mjs rabelo-meshy.glb src/assets/models/rabelo.glb
//
// One piece, bow towards +x, y up: a square sail on a yard across the boat, the steersman's
// platform (apégada) by the mast, and the long steering oar (espadela) over the stern.
// Coordinates in the model's units.

/** The espadela, from its blade aft of the stern up to the platform: y on its line at x. */
const oarY = (x) => -0.46 + (x + 0.94) * 0.31;

export default {
  // 20 m from the stern to the stem (1.25 units); the hull came out 6.9 m wide: narrowed to
  // 4.5 m. The waterline is where it displaces 40 t.
  scale: { x: 16, y: 16, z: 10.4 },
  origin: { x: 0.33, y: -0.393, z: 0 },
  textureSize: 1024,
  triangles: { Casco: 60000, Vela: 12000, Leme: 3000 },

  classify(p) {
    // The espadela turns about the sternpost: its blade aft and its loom up to the platform.
    if (p.x < -0.29) return 'Leme';
    if (p.x < 0.26 && p.z > -0.01 && p.z < 0.1 && Math.abs(p.y - oarY(p.x)) < 0.025) return 'Leme';
    // The square sail and its yard, forward of the mast, clear of the casks below it (their
    // tops reach y = -0.2 either side of the centreline).
    if (p.x > 0.31 && p.x < 0.62 && (p.y > -0.2 || (Math.abs(p.z) < 0.05 && p.y > -0.28))) return 'Vela';
    return 'Casco';
  },
};
