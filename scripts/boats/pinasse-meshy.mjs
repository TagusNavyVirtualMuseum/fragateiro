// Pinasse à voile of the Bassin d'Arcachon (8.65 m, 1.82 m beam, about 600 kg), made with
// Meshy from photos (Meshy_AI_Pinasse_Sailboat_3D_..._image-to-3d-texture.glb). Cut into parts with:
//   node scripts/cut-model.mjs scripts/boats/pinasse-meshy.mjs pinasse-meshy.glb src/assets/models/pinasse.glb
//
// The Meshy model is one piece, bow towards -x, y up, the sail on the centreline: a lugsail on
// a yard hoisted on a mast raked slightly aft, a centreboard, and a rudder hung on the
// sternpost with a tiller. Coordinates below are in its units (the hull is 1.825 long).

const inBox = (p, b) => p.x > b.x[0] && p.x < b.x[1] && p.y > b.y[0] && p.y < b.y[1] && p.z > b.z[0] && p.z < b.z[1];

/** The rudder blade, aft of the sternpost, and the tiller over the stern. */
function isRudder(p) {
  if (Math.abs(p.z) > 0.025) return false;
  if (p.y > -0.45 && p.x > 0.878) return true; // the blade's head, and the tiller's end
  if (p.y <= -0.45 && p.y > -0.56 && p.x > 0.87) return true;
  if (p.y <= -0.56 && p.x > 0.81) return true; // the blade below the hull
  return p.x > 0.74 && p.y > -0.386 && p.y < -0.33 && Math.abs(p.z) < 0.02; // the tiller
}

// Meshy made the mast as two poles splayed in a V (a hollow tube each, from the mast partners
// on either side up to the masthead). Each is moved onto the centreline, so together they
// make one mast, and its foot is taken down to the floor.
/** A pole's centre at a height y: x (it rakes aft) and |z|. */
const poleX = (y) => -0.2057 + 0.0814 * y;
const poleZ = (y) => Math.max(0, 0.073 - 0.0857 * y);
/** The mast once moved: its axis, and whether a point is on it. */
const onMast = (p) => Math.hypot(p.x - poleX(p.y), p.z) < 0.024;

/** The sheet, from the clew down to the tiller (the game draws its own). */
const SHEET = { x: [0.74, 0.85], y: [-0.345, -0.3], z: [-0.03, 0.03] };

export default {
  // 8.65 m from the stem head to the sternpost (the beam is then 1.74 m). The waterline is
  // where the hull displaces 600 kg: 0.30 m of draft at the keel, 7.9 m long.
  scale: 4.74,
  origin: { x: -0.04, y: -0.542, z: 0 },
  textureSize: 1024,
  triangles: { Casco: 50000, Vela: 12000, Leme: 2000 },

  move(v) {
    if (v.y < -0.39 || v.y > 0.64) return;
    const zc = poleZ(v.y);
    if (Math.abs(v.x - poleX(v.y)) > 0.03 || Math.abs(Math.abs(v.z) - zc) > 0.026) return;
    v.z -= Math.sign(v.z) * zc;
    if (v.y < -0.36) v.y = -0.47;
  },

  classify(p) {
    if (isRudder(p)) return 'Leme';
    if (inBox(p, SHEET)) return null;
    // The lugsail and its yard: everything aloft on the centreline, clear of the stem head,
    // but not the mast (except where the yard crosses it).
    if (onMast(p) && (p.y < 0.47 || p.y > 0.62)) return 'Casco';
    if (p.y > -0.335 && Math.abs(p.z) < 0.045 && p.x > -0.88 && p.x < 0.85) return 'Vela';
    return 'Casco';
  },
};
