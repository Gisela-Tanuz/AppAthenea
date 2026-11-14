// Capa "Agua y hielo" para la prueba técnica.
// IMPORTANTE: geometrías APROXIMADAS, digitalizadas a mano a partir de publicaciones.
// Sirven para probar la mecánica (capas + análisis de ruta), no para planificar nada real.
// Coordenadas [lat, lon] planetocéntricas, longitud Este ±180.

const W_R_MARS = 3389.5;
const W_DEG_KM = Math.PI * W_R_MARS / 180; // ~59,16 km por grado

const WATER_CATS = {
  hielo:    { label: 'Hielo confirmado',                     color: '#4cc9f0', rank: 1 },
  radar:    { label: 'Hielo probable (radar / glaciares)',   color: '#a0c4ff', rank: 2 },
  pasada:   { label: 'Agua en el pasado (lagos, deltas)',    color: '#2ec4b6', rank: 3 },
  debatido: { label: 'Agua actual debatida',                 color: '#c77dff', rank: 4 },
  valle:    { label: 'Cerca de un valle o canal',            color: '#ff9f1c', rank: 5 },
  ninguno:  { label: 'Sin indicios cargados',                color: '#ffffff', rank: 9 },
};

function circlePoly(lat, lon, rKm, n = 40) {
  const dLat = rKm / W_DEG_KM, out = [];
  for (let i = 0; i < n; i++) {
    const a = 2 * Math.PI * i / n;
    out.push([lat + dLat * Math.sin(a), lon + dLat * Math.cos(a) / Math.cos(lat * Math.PI / 180)]);
  }
  return out;
}

const WATER_ZONES = [
  { name: 'Casquete polar norte', cat: 'hielo', src: 'MGS / MRO', poly: [[80, -180], [80, 180], [90, 180], [90, -180]] },
  { name: 'Casquete polar sur', cat: 'hielo', src: 'Mars Express / MRO', poly: [[-84, -180], [-84, 180], [-90, 180], [-90, -180]] },
  { name: 'Cráter Korolev (hielo)', cat: 'hielo', src: 'Mars Express', poly: circlePoly(73, 165, 41) },
  { name: 'Arcadia Planitia: hielo somero', cat: 'radar', src: 'SWIM / SHARAD', poly: [[35, -170], [35, -145], [50, -145], [50, -170]] },
  { name: 'Utopia Planitia: hielo enterrado', cat: 'radar', src: 'SHARAD (Stuurman et al. 2016)', poly: [[39, 79], [39, 101], [49, 101], [49, 79]] },
  { name: 'Deuteronilus Mensae: glaciares cubiertos', cat: 'radar', src: 'SHARAD', poly: [[40, 15], [40, 32], [48, 32], [48, 15]] },
  { name: 'Protonilus Mensae: glaciares cubiertos', cat: 'radar', src: 'SHARAD', poly: [[40, 40], [40, 58], [48, 58], [48, 40]] },
  { name: 'Este de Hellas: glaciares de derrubios', cat: 'radar', src: 'SHARAD (Holt et al. 2008)', poly: [[-38, 96], [-38, 112], [-46, 112], [-46, 96]] },
  { name: 'Jezero: paleolago y delta', cat: 'pasada', src: 'Perseverance', poly: circlePoly(18.38, 77.58, 23) },
  { name: 'Gale: paleolago', cat: 'pasada', src: 'Curiosity', poly: circlePoly(-5.4, 137.8, 77) },
  { name: 'Gusev: posible paleolago', cat: 'pasada', src: 'Spirit', poly: circlePoly(-14.5, 175.4, 83) },
];

const WATER_VALLEYS = [
  { name: 'Valles Marineris', coords: [[-6, -93], [-8, -80], [-10, -70], [-8, -60], [-4, -50], [-1, -42]] },
  { name: 'Kasei Valles', coords: [[10, -75], [20, -70], [25, -60], [24, -50]] },
  { name: 'Ares Vallis', coords: [[-3, -17], [3, -20], [10, -25], [17, -31]] },
  { name: 'Mawrth Vallis', coords: [[20, -13], [22.5, -17], [24.5, -20]] },
  { name: "Ma'adim Vallis", coords: [[-28, -178], [-24, 179], [-18, 177], [-15, 175.6]] },
  { name: 'Nirgal Vallis', coords: [[-28, -48], [-28, -42], [-27, -38]] },
  { name: 'Dao Vallis', coords: [[-31, 92], [-33, 88], [-37, 85]] },
  { name: 'Niger Vallis', coords: [[-30, 95], [-32, 92]] },
  { name: 'Harmakhis Vallis', coords: [[-37, 97], [-39, 93], [-41, 88]] },
  { name: 'Reull Vallis', coords: [[-40, 115], [-42, 108], [-41, 100]] },
  { name: 'Neretva Vallis (entrada a Jezero)', coords: [[18.75, 76.7], [18.6, 77.0], [18.5, 77.25], [18.47, 77.4]] },
  { name: 'Sava Vallis (entrada a Jezero)', coords: [[19.1, 77.7], [18.75, 77.6]] },
];

const WATER_POINTS = [
  { name: 'Phoenix: hielo excavado (2008)', cat: 'hielo', lat: 68.22, lon: -125.75 },
  { name: 'Mawrth Vallis: arcillas', cat: 'pasada', lat: 24, lon: -19 },
  { name: 'Cráter Newton: líneas de pendiente recurrentes', cat: 'debatido', lat: -41.6, lon: -158.1 },
  { name: 'Posible lago bajo el hielo (MARSIS 2018)', cat: 'debatido', lat: -81, lon: -167 },
  { name: 'Fondo de Hellas: presión suficiente para agua líquida breve', cat: 'debatido', lat: -42.4, lon: 70.5 },
];

const EXAMPLE_ROUTES = {
  hellas: { label: 'Harmakhis Vallis → glaciares de Hellas este', view: [-40, 99, 5],
    coords: [[-41, 88.5], [-39.8, 91], [-39, 93], [-38, 95.5], [-39.5, 98], [-41, 100.5], [-42, 104], [-43, 107]] },
  jezero: { label: 'Neretva Vallis → delta de Jezero', view: [18.55, 77.2, 8],
    coords: [[18.75, 76.75], [18.6, 77.0], [18.5, 77.25], [18.4447, 77.4508], [18.38, 77.58]] },
};

// ---------- Geometría ----------
function wHav(a, b) {
  const t = Math.PI / 180, dLat = (b[0] - a[0]) * t, dLon = (b[1] - a[1]) * t;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLon / 2) ** 2;
  return 2 * W_R_MARS * Math.asin(Math.sqrt(h));
}
function wDensify(coords, stepKm) {
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i], n = Math.max(1, Math.ceil(wHav(a, b) / stepKm));
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
function wInPoly(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > p[0]) !== (yj > p[0]) && p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const VALLEY_SAMPLES = WATER_VALLEYS.flatMap(v => wDensify(v.coords, 3).map(p => ({ p, name: v.name })));
function nearestValley(p, maxKm) {
  let best = null; const latWin = maxKm / W_DEG_KM + 0.1;
  for (const q of VALLEY_SAMPLES) {
    if (Math.abs(q.p[0] - p[0]) > latWin) continue;
    const d = wHav(p, q.p);
    if (d <= maxKm && (!best || d < best.d)) best = { d, name: q.name };
  }
  return best;
}
function classifyPoint(p, bufKm) {
  const hits = [];
  WATER_ZONES.forEach(z => { if (wInPoly(p, z.poly)) hits.push({ cat: z.cat, name: z.name }); });
  const v = nearestValley(p, bufKm);
  if (v) hits.push({ cat: 'valle', name: v.name });
  hits.sort((a, b) => WATER_CATS[a.cat].rank - WATER_CATS[b.cat].rank);
  return { cat: hits.length ? hits[0].cat : 'ninguno', hits };
}

// Recorre la ruta en pasos de ~stepKm y agrupa tramos por categoría.
function analyzeRoute(latlngs, bufKm, stepKm = 2) {
  const pts = latlngs.map(ll => [ll.lat, ll.lng]);
  const res = { segments: [], totals: {}, features: new Map(), totalKm: 0 };
  if (pts.length < 2) return res;
  const dense = wDensify(pts, stepKm);
  let cur = null;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const km = wHav(a, b), c = classifyPoint(mid, bufKm);
    res.totalKm += km;
    res.totals[c.cat] = (res.totals[c.cat] || 0) + km;
    c.hits.forEach(h => res.features.set(h.name, h.cat));
    if (cur && cur.cat === c.cat) cur.coords.push(b);
    else { cur = { cat: c.cat, coords: [a, b] }; res.segments.push(cur); }
  }
  return res;
}

// ---------- Capas Leaflet ----------
function buildWaterLayers() {
  const zones = L.layerGroup(), valleys = L.layerGroup(), points = L.layerGroup();
  WATER_ZONES.forEach(z => L.polygon(z.poly, { color: WATER_CATS[z.cat].color, weight: 1.5, fillOpacity: 0.22, dashArray: z.cat === 'radar' ? '5 4' : null })
    .bindTooltip(`${z.name}<br><small>${WATER_CATS[z.cat].label} · ${z.src}</small>`, { sticky: true }).addTo(zones));
  WATER_VALLEYS.forEach(v => L.polyline(v.coords, { color: WATER_CATS.valle.color, weight: 3, opacity: 0.9 })
    .bindTooltip(v.name, { sticky: true }).addTo(valleys));
  WATER_POINTS.forEach(p => L.circleMarker([p.lat, p.lon], { radius: 6, color: '#fff', weight: 1.5, fillColor: WATER_CATS[p.cat].color, fillOpacity: 1 })
    .bindTooltip(`${p.name}<br><small>${WATER_CATS[p.cat].label}</small>`).addTo(points));
  return { zones, valleys, points };
}
