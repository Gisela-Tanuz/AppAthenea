// ============================================================================
// MISIONES DE ATHENEA
// Cada misión es una ficha. Para crear una misión nueva, copiá una ficha, cambiá los valores
// y agregá el archivo de datos del rover en mision.html si usa uno nuevo.
// Todas las coordenadas: latitud, longitud planetocéntricas, longitud Este ±180.
// ============================================================================
const MISSIONS = {

  gale: {
    name: 'EVA Monte Sharp',
    place: 'Cráter Gale · región de retículas (boxwork) · 4,80°S 137,39°E',
    // Zona de exploración: rectángulo donde se calcula la ruta (mantenerlo por debajo de ~5 × 5 km).
    bbox: { s: -4.832, n: -4.772, w: 137.366, e: 137.414 },
    rover: { key: 'curiosity', name: 'Curiosity', sinceSol: 4300 },   // datos en data/curiosity.js
    habSol: 4425,                                                       // la base se ubica donde estuvo el rover ese sol
    // Capas ópticas de NASA Mars Trek (id de la capa, zoom nativo máximo, área cubierta)
    hirise: { id: 'curiosity_hirise_mosaic', maxN: 18, label: 'HiRISE (MRO, hasta ~25 cm/px)', bounds: [[-4.9255, 137.1225], [-4.2490, 137.7298]] },
    ctx: { id: 'curiosity_ctx_mosaic', maxN: 10, label: 'CTX (MRO, ~6 m/px)', bounds: [[-7.214, 136.277], [-3.580, 139.386]] },
    // Elevación: servicio de imágenes de Trek que entrega alturas reales en metros
    dem: { service: 'Gale_DEM_SMG_1m', label: 'HiRISE DTM de Gale (1 m)', grayTiles: { id: 'Gale_DEM_SMG_1m', maxN: 14 } },
    weather: 'msl',
    defaults: { walk: 2 },
    intro: 'Las <b>retículas</b> (boxwork) son crestas minerales que se cruzan formando celdas. Se forman cuando agua subterránea circula por fracturas y deja minerales que endurecen las paredes; la roca blanda del medio se erosiona después. Curiosity las estudió en 2025.',
    stations: [
      { sol: 4455, name: 'Mirador norte', obj: 'Panorámica de contexto: mapear la extensión de la red de retículas y elegir crestas para muestrear.', min: 25, on: true },
      { sol: 4525, name: 'Cresta principal', obj: 'Muestrear la roca cementada de una cresta: minerales depositados por agua subterránea.', min: 40, on: true },
      { sol: 4585, name: 'Hueco entre crestas', obj: 'Muestrear el relleno del hueco y comparar su química con la cresta.', min: 40, on: true },
      { sol: 4650, name: 'Cruce de crestas', obj: 'Buscar vetas de sulfato de calcio y estimar la orientación de las fracturas.', min: 30, on: true },
      { sol: 4705, name: 'Estratos de sulfatos', obj: 'Medir y fotografiar capas de la unidad de sulfatos: registro del secado del clima.', min: 30, on: false },
      { sol: 4750, name: 'Borde sur', obj: 'Contraste con terreno sin retículas para delimitar la unidad.', min: 20, on: false },
    ],
  },

  jezero: {
    name: 'EVA Delta de Jezero',
    place: 'Cráter Jezero · frente y delta superior · 18,46°N 77,40°E',
    bbox: { s: 18.440, n: 18.490, w: 77.355, e: 77.440 },
    rover: { key: 'perseverance', name: 'Perseverance', sinceSol: 380 },
    habSol: 560,
    hirise: { id: 'JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd', maxN: 17, label: 'HiRISE controlado (MRO, 25 cm/px)', bounds: [[18.3068, 77.2229], [18.6693, 77.5840]] },
    ctx: { id: 'JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0', maxN: 13, label: 'CTX controlado (MRO, 6 m/px)', bounds: [[18.2110, 77.1605], [18.7212, 77.6992]] },
    // Jezero no tiene su DTM HiRISE publicado como servicio en Trek: se usa el global HRSC+MOLA de 200 m.
    dem: { service: 'Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw', label: 'HRSC + MOLA global (200 m)', coarse: true },
    weather: 'mars2020',
    defaults: { walk: 2.5 },
    intro: 'Jezero fue un <b>lago</b> hace unos 3500 millones de años. Un río dejó un <b>delta</b> de sedimentos en capas: las rocas de grano fino pueden conservar rastros de vida antigua. Perseverance exploró el frente del delta en 2022 y subió al delta superior en 2023.',
    stations: [
      { sol: 430, name: 'Frente del delta', obj: 'Fotografiar y medir la estratificación del frente del delta para reconstruir cómo avanzó el río sobre el lago.', min: 30, on: true },
      { sol: 495, name: 'Roca de grano fino', obj: 'Muestrear lodolita o arenisca fina, el tipo de roca con más chances de conservar materia orgánica.', min: 40, on: true },
      { sol: 620, name: 'Depósito de muestras', obj: 'Inspeccionar los tubos de muestras dejados por Perseverance en Three Forks y recuperar uno para traer a la base.', min: 30, on: true },
      { sol: 700, name: 'Subida al delta superior', obj: 'Registrar el cambio de sedimentos finos a gruesos: señal de crecidas más fuertes del río.', min: 25, on: true },
      { sol: 790, name: 'Conglomerado de cantos', obj: 'Medir tamaño y forma de los cantos rodados transportados por inundaciones.', min: 30, on: false },
      { sol: 860, name: 'Mirador del delta superior', obj: 'Panorámica del cráter y del borde: planificar la siguiente EVA.', min: 20, on: false },
    ],
  },

};
