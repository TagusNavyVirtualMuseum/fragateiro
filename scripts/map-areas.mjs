// The sailing areas: where each map is cut from OpenStreetMap and Copernicus.
//   node scripts/fetch-map.mjs --area arcachon
//   node scripts/fetch-heights.mjs --area arcachon
// Each area writes src/assets/map/<file>-mask.png, <file>-height.png and <file>.json.

export const AREAS = {
  // The Tagus from Vila Franca de Xira to the sea, the coast from Cascais (and the Sintra
  // coast) round to Cabo Espichel and Sesimbra.
  tejo: {
    file: 'tagus',
    bbox: { south: 38.38, west: -9.5, north: 38.99, east: -8.85 },
    /** Local origin (and flood-fill seed): mid-river between Terreiro do Paço and Barreiro. */
    origin: { lat: 38.685, lon: -9.1 },
    /** Landmark bridges: their deck lines are saved for drawing. */
    bridges: /^Ponte (25 de Abril|Vasco da Gama|Marechal Carmona)$/,
    /** Must be land / water, or the data is wrong (checked after building the grid). */
    checks: {
      land: {
        Moita: [38.6507, -8.9905], Montijo: [38.7067, -8.9739], Barreiro: [38.6631, -9.0724], Lisboa: [38.7139, -9.1394], Alcochete: [38.7553, -8.9608],
        Cascais: [38.6979, -9.4215], Sesimbra: [38.4445, -9.1015], 'Vila Franca de Xira': [38.9553, -8.9897], Sintra: [38.8, -9.38],
      },
      water: {
        origin: [38.685, -9.1], 'Montijo channel': [38.695, -9.05], 'off Seixal': [38.655, -9.1],
        'off Cascais': [38.68, -9.42], 'off Cabo Espichel': [38.4, -9.23], 'Sesimbra bay': [38.43, -9.1],
      },
      /** Reported, not checked: upriver the river is a water area rather than coastline. */
      report: { 'Tagus off Alhandra': [38.9, -9.03], 'Tagus off Póvoa': [38.86, -9.05], 'Tagus at Vila Franca': [38.955, -8.985] },
    },
  },

  // The Bassin d'Arcachon, the passes and the ocean off Cap Ferret and the Dune du Pilat.
  arcachon: {
    file: 'arcachon',
    bbox: { south: 44.52, west: -1.36, north: 44.79, east: -0.98 },
    /** In the Teychan channel, off Arcachon. */
    origin: { lat: 44.672, lon: -1.19 },
    checks: {
      land: { Arcachon: [44.652, -1.17], 'Andernos-les-Bains': [44.745, -1.095], 'Cap Ferret lighthouse': [44.6436, -1.2497] },
      water: { origin: [44.672, -1.19], 'ocean off Cap Ferret': [44.68, -1.33] },
      report: { 'off Arès': [44.75, -1.15], 'off Audenge': [44.68, -1.04], 'the passes': [44.6, -1.25] },
    },
  },

  // The Ria de Aveiro lagoon, from Ovar to Mira, with the Barra and the sea outside.
  aveiro: {
    file: 'aveiro',
    bbox: { south: 40.52, west: -8.82, north: 40.9, east: -8.55 },
    /** In the lagoon by São Jacinto, inside the Barra. */
    origin: { lat: 40.655, lon: -8.725 },
    /** Seed the sea from outside the Barra (the lagoon fills through it). */
    seed: { lat: 40.7, lon: -8.8 },
    checks: {
      land: { Aveiro: [40.6405, -8.6538], Ílhavo: [40.6, -8.668], Ovar: [40.86, -8.625] },
      water: { 'sea off the Barra': [40.7, -8.8] },
      report: { origin: [40.655, -8.725], 'off Torreira': [40.76, -8.69], 'canal de Mira': [40.55, -8.74], 'off Murtosa': [40.74, -8.66] },
    },
  },
};

/** The area named by `--area` on the command line (default: the Tagus). */
export function areaFromArgs(args = process.argv.slice(2)) {
  const i = args.indexOf('--area');
  const id = i >= 0 ? args[i + 1] : 'tejo';
  const area = AREAS[id];
  if (!area) throw new Error(`unknown area ${id}; one of ${Object.keys(AREAS).join(', ')}`);
  return { id, ...area };
}
