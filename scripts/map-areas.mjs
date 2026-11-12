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
    /** Origin of the map's coordinates (on the São Jacinto spit; the game starts in the lagoon). */
    origin: { lat: 40.655, lon: -8.725 },
    /** Seed the sea from outside the Barra (the lagoon fills through it). */
    seed: { lat: 40.7, lon: -8.8 },
    checks: {
      land: { Aveiro: [40.6405, -8.6538], Ílhavo: [40.6, -8.668], Ovar: [40.86, -8.625] },
      water: { 'sea off the Barra': [40.7, -8.8] },
      report: { 'off Torreira': [40.76, -8.69], 'the lagoon': [40.74, -8.69] },
    },
  },

  // Pasaia (Pasajes) in the Basque Country: its narrow harbour inlet, with San Sebastián and
  // La Concha to the west, Hondarribia and Hendaye at the mouth of the Bidasoa, and the coast
  // on to Socoa and Saint-Jean-de-Luz.
  pasaia: {
    file: 'pasaia',
    bbox: { south: 43.29, west: -2.03, north: 43.42, east: -1.63 },
    /** At sea off the harbour mouth. */
    origin: { lat: 43.345, lon: -1.93 },
    checks: {
      land: { 'San Sebastián': [43.3183, -1.9812], Hondarribia: [43.3626, -1.7915], 'Monte Ulía': [43.3305, -1.955], 'Saint-Jean-de-Luz': [43.3885, -1.661] },
      water: { origin: [43.345, -1.93], 'off Cabo Higuer': [43.405, -1.8], 'off Saint-Jean-de-Luz': [43.405, -1.68] },
      report: { 'Pasaia harbour': [43.3215, -1.9235], 'La Concha bay': [43.3195, -1.995], 'Txingudi bay': [43.365, -1.79], 'Saint-Jean-de-Luz bay': [43.393, -1.672] },
    },
  },

  // The Azores' central group: Faial (Horta), Pico (São Roque do Pico, Madalena) and São Jorge
  // (Velas), with the channels between them.
  azores: {
    file: 'azores',
    bbox: { south: 38.38, west: -28.85, north: 38.76, east: -28.02 },
    /** In the Faial–Pico channel, off Horta. */
    origin: { lat: 38.52, lon: -28.56 },
    checks: {
      land: { Horta: [38.5364, -28.6295], 'Pico summit': [38.4685, -28.399], 'São Jorge': [38.66, -28.15] },
      water: { origin: [38.52, -28.56], 'Pico–São Jorge channel': [38.6, -28.3], 'south of Pico': [38.39, -28.3] },
      report: { 'Horta marina': [38.531, -28.623], 'off São Roque': [38.53, -28.32], 'off Velas': [38.675, -28.205] },
    },
  },

  // The east end of Madeira: Santa Cruz, Machico and Porto da Cruz, and the long Ponta de
  // São Lourenço.
  madeira: {
    file: 'madeira',
    bbox: { south: 32.63, west: -16.93, north: 32.83, east: -16.63 },
    /** At sea off Machico. */
    origin: { lat: 32.705, lon: -16.74 },
    checks: {
      land: { 'Santa Cruz': [32.695, -16.81], Machico: [32.72, -16.765], 'Ponta de São Lourenço': [32.743, -16.7] },
      water: { origin: [32.705, -16.74], 'north coast': [32.8, -16.8], 'off the point': [32.73, -16.65] },
      report: { 'off Porto da Cruz': [32.775, -16.825], 'off Santa Cruz': [32.686, -16.785] },
    },
  },

  // The Oeste coast: the shell-shaped bay of São Martinho do Porto, Nazaré under its cliff,
  // the peninsula of Peniche and, 10 km out to sea, the Berlengas (Berlenga Grande, the
  // Estelas and the Farilhões). Cells of 15 m keep the narrow mouth of São Martinho's bay open.
  oeste: {
    file: 'oeste',
    cell: 15,
    bbox: { south: 39.33, west: -9.57, north: 39.64, east: -9.03 },
    /** At sea between Peniche and Nazaré. */
    origin: { lat: 39.46, lon: -9.3 },
    checks: {
      land: { Peniche: [39.3558, -9.3811], Nazaré: [39.6021, -9.0702], 'São Martinho do Porto': [39.5126, -9.1355], 'Berlenga Grande': [39.4135, -9.5085] },
      water: { origin: [39.46, -9.3], 'between Peniche and the Berlengas': [39.39, -9.45], 'off Nazaré': [39.6, -9.11] },
      report: { 'São Martinho bay': [39.507, -9.142], 'Peniche harbour': [39.352, -9.374], 'Nazaré harbour': [39.5862, -9.0755], 'off the Berlenga landing': [39.4155, -9.503] },
    },
  },

  // The middle Tagus: Vila Nova da Barquinha, Tancos, the castle of Almourol on its island,
  // Constância where the Zêzere joins, and Abrantes. No coast here: the water is the river's
  // own outlines (natural=water), drawn at 10 m for a river 150-300 m wide.
  medio: {
    file: 'medio',
    inland: true,
    cell: 10,
    bbox: { south: 39.42, west: -8.46, north: 39.5, east: -8.17 },
    /** The narrow channel north of the island of Almourol, which the data leaves closed. */
    extraWater: [{ width: 25, points: [[39.46216, -8.38799], [39.46243, -8.3859], [39.46279, -8.3845], [39.4627, -8.38264]] }],
    /** In the river by the castle of Almourol. */
    origin: { lat: 39.4595, lon: -8.385 },
    checks: {
      land: { Constância: [39.4757, -8.338], Abrantes: [39.4636, -8.1974] },
      water: {},
      report: { 'by Almourol': [39.4595, -8.385], 'off Constância': [39.4715, -8.338], 'off Barquinha': [39.4555, -8.433] },
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
