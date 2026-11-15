// ============================================================================
// ATHENEA MISSIONS
// Each mission is a profile. To create a new mission, copy a profile, change the values
// and add the rover data file in mission.html if it uses a new one.
// All coordinates: planetocentric latitude, longitude, East longitude ±180.
// ============================================================================
const MISSIONS = {

  gale: {
    name: 'Mount Sharp EVA',
    place: 'Gale crater · boxwork region · 4.80°S 137.39°E',
    // Exploration zone: rectangle where the route is computed (keep it under ~5 × 5 km).
    bbox: { s: -4.832, n: -4.772, w: 137.366, e: 137.414 },
    rover: { key: 'curiosity', name: 'Curiosity', sinceSol: 4300 },   // data in data/curiosity.js
    habSol: 4425,                                                       // the base is placed where the rover was on this sol
    // NASA Mars Trek optical layers (layer id, max native zoom, covered area)
    hirise: { id: 'curiosity_hirise_mosaic', maxN: 18, label: 'HiRISE (MRO, up to ~25 cm/px)', bounds: [[-4.9255, 137.1225], [-4.2490, 137.7298]] },
    ctx: { id: 'curiosity_ctx_mosaic', maxN: 10, label: 'CTX (MRO, ~6 m/px)', bounds: [[-7.214, 136.277], [-3.580, 139.386]] },
    // Elevation: Trek image service that returns real heights in meters
    dem: { service: 'Gale_DEM_SMG_1m', label: 'Gale HiRISE DTM (1 m)', grayTiles: { id: 'Gale_DEM_SMG_1m', maxN: 14 } },
    weather: 'msl',
    defaults: { walk: 2 },
    intro: '<b>Boxwork</b> is a network of mineral ridges that cross each other forming cells. It forms when groundwater flows through fractures and leaves minerals that harden the walls; the softer rock in between erodes away later. Curiosity studied it in 2025.',
    stations: [
      { sol: 4455, name: 'North overlook', obj: 'Context panorama: map the extent of the boxwork network and choose ridges to sample.', min: 25, on: true },
      { sol: 4525, name: 'Main ridge', obj: 'Sample the cemented rock of a ridge: minerals deposited by groundwater.', min: 40, on: true },
      { sol: 4585, name: 'Hollow between ridges', obj: 'Sample the hollow fill and compare its chemistry with the ridge.', min: 40, on: true },
      { sol: 4650, name: 'Ridge intersection', obj: 'Look for calcium sulfate veins and estimate the orientation of the fractures.', min: 30, on: true },
      { sol: 4705, name: 'Sulfate strata', obj: 'Measure and photograph layers of the sulfate unit: a record of the climate drying out.', min: 30, on: false },
      { sol: 4750, name: 'South edge', obj: 'Contrast with terrain without boxwork to delimit the unit.', min: 20, on: false },
    ],
  },

  jezero: {
    name: 'Jezero Delta EVA',
    place: 'Jezero crater · delta front and upper fan · 18.46°N 77.40°E',
    bbox: { s: 18.440, n: 18.490, w: 77.355, e: 77.440 },
    rover: { key: 'perseverance', name: 'Perseverance', sinceSol: 380 },
    habSol: 560,
    hirise: { id: 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', maxN: 17, label: 'Controlled HiRISE (MRO, 25 cm/px)', bounds: [[18.3068, 77.2229], [18.6693, 77.5840]] },
    ctx: { id: 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0', maxN: 13, label: 'Controlled CTX (MRO, 6 m/px)', bounds: [[18.2110, 77.1605], [18.7212, 77.6992]] },
    // Jezero's HiRISE DTM is not published as a service on Trek: the global 200 m HRSC+MOLA blend is used instead.
    dem: { service: 'Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw', label: 'Global HRSC + MOLA (200 m)', coarse: true },
    weather: 'mars2020',
    defaults: { walk: 2.5 },
    intro: 'Jezero was a <b>lake</b> about 3.5 billion years ago. A river left a <b>delta</b> of layered sediments: fine-grained rocks may preserve traces of ancient life. Perseverance explored the delta front in 2022 and climbed the upper fan in 2023.',
    stations: [
      { sol: 430, name: 'Delta front', obj: 'Photograph and measure the delta front stratification to reconstruct how the river advanced over the lake.', min: 30, on: true },
      { sol: 495, name: 'Fine-grained rock', obj: 'Sample mudstone or fine sandstone, the rock type most likely to preserve organic matter.', min: 40, on: true },
      { sol: 620, name: 'Sample depot', obj: 'Inspect the sample tubes left by Perseverance at Three Forks and retrieve one to bring back to the base.', min: 30, on: true },
      { sol: 700, name: 'Climb to the upper fan', obj: 'Record the change from fine to coarse sediments: a sign of stronger river floods.', min: 25, on: true },
      { sol: 790, name: 'Boulder conglomerate', obj: 'Measure the size and shape of the boulders carried by floods.', min: 30, on: false },
      { sol: 860, name: 'Upper fan overlook', obj: 'Panorama of the crater and its rim: plan the next EVA.', min: 20, on: false },
    ],
  },

};
