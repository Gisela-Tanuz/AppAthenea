// ATHENEA · Planificador de EVA. Funciona para cualquier misión definida en misiones.js (elegida con ?m=gale, ?m=jezero…).
// Datos NASA: HiRISE/CTX (óptico), DTM vía Mars Trek (topográfico), THEMIS (térmico), recorrido del rover (in situ),
// RAD (radiación medida en superficie), DONKI (clima espacial en vivo), REMS/MEDA (meteorología de los rovers).

// ---------- Misión elegida ----------
const MISSION_ID = (new URLSearchParams(location.search).get('m') || 'gale').toLowerCase();
const M = MISSIONS[MISSION_ID] || MISSIONS.gale;
const ROVER = ROVER_DATA[M.rover.key];

// ---------- Constantes ----------
const MARS_R_KM = 3389.5;
const DEG_M = Math.PI * MARS_R_KM * 1000 / 180;          // metros por grado de latitud (~59 160 m)
const BBOX = M.bbox;
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const TREK_IMG = 'https://trek.nasa.gov/mars/trekarcgis/rest/services';
const CELL_M = 10;                                         // celda de la grilla de navegación
const CELL_DEG = CELL_M / DEG_M;
const MID_LAT = (BBOX.s + BBOX.n) / 2;
// RAD (Hassler et al. 2014, Science): dosis equivalente medida por Curiosity en la superficie de Gale ≈ 0,64 mSv/día.
const RAD = { mSvDay: 0.64, careerLimit: 600 };            // límite de carrera NASA-STD-3001 (2022): 600 mSv
const STATION_DEFS = M.stations;
const HAB_SOL = M.habSol;

// Encabezado y textos según la misión
document.title = 'Athenea · ' + M.name;
document.getElementById('brand').innerHTML = `ATHENEA · ${M.name}<small>${M.place}</small>`;
document.getElementById('intro').innerHTML = `${M.intro} Las paradas están en lugares que ${M.rover.name} visitó; los objetivos son propuestas a validar con el equipo científico.`;
document.getElementById('lbl-hirise').textContent = M.hirise.label;
document.getElementById('lbl-ctx').textContent = M.ctx.label;
document.getElementById('lbl-dem').textContent = 'Pendiente calculada (' + M.dem.label + ')';
document.getElementById('lbl-rover').textContent = 'Recorrido de ' + M.rover.name;
document.getElementById('lbl-wp').textContent = `Paradas de ${M.rover.name} (inclinación medida)`;
document.getElementById('wx-title').textContent = `Meteorología (${M.weather === 'msl' ? 'REMS, Curiosity' : 'MEDA, Perseverance'})`;
const sel = document.getElementById('mission-select');
sel.innerHTML = Object.entries(MISSIONS).map(([k, v]) => `<option value="${k}" ${k === MISSION_ID ? 'selected' : ''}>${v.name}</option>`).join('');
sel.onchange = () => { location.search = '?m=' + sel.value; };
document.getElementById('p-walk').value = M.defaults.walk;
document.getElementById('o-walk').textContent = M.defaults.walk + ' km';

// ---------- Utilidades ----------
const $ = id => document.getElementById(id);
const toRad = Math.PI / 180;
function havM(a, b) {
  const dLat = (b[0] - a[0]) * toRad, dLon = (b[1] - a[1]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * toRad) * Math.cos(b[0] * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * MARS_R_KM * 1000 * Math.asin(Math.sqrt(h));
}
const fmtH = h => { const m = Math.round(h * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const fmtClock = h => { h = ((h % 24) + 24) % 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`; };
const nearestWaypoint = sol => ROVER.waypoints.reduce((best, w) => Math.abs(w[0] - sol) < Math.abs(best[0] - sol) ? w : best);
function setChip(id, text, state) { const el = $(id); el.querySelector('b').textContent = text; el.className = 'chip ' + (state || ''); }

// ---------- Mapa ----------
const map = L.map('map', { crs: L.CRS.EPSG4326, center: [MID_LAT, (BBOX.w + BBOX.e) / 2], zoom: 14, minZoom: 6, maxZoom: 20, zoomSnap: 0.5 });
const trek = (id, maxN, o = {}) => L.tileLayer(`${TREK}/${id}/1.0.0/default/default028mm/{z}/{y}/{x}.${o.ext || 'png'}`,
  Object.assign({ maxNativeZoom: maxN, maxZoom: 20, noWrap: true, attribution: 'NASA/JPL-Caltech/UArizona/MSSS/ASU · Mars Trek' }, o));
trek('Mars_MGS_MOLA_ClrShade_merge_global_463m', 7, { ext: 'jpg' }).addTo(map);
const ctx = trek(M.ctx.id, M.ctx.maxN, { bounds: M.ctx.bounds }).addTo(map);
const hirise = trek(M.hirise.id, M.hirise.maxN, { bounds: M.hirise.bounds }).addTo(map);
// Vista de la elevación: teselas grises si la misión las tiene; si no, se dibuja desde la grilla calculada.
let demLayer = M.dem.grayTiles ? trek(M.dem.grayTiles.id, M.dem.grayTiles.maxN, { opacity: 0.55, bounds: M.hirise.bounds }) : L.layerGroup();
const themis = trek('THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', 9, { opacity: 0.6 });
map.fitBounds([[BBOX.s, BBOX.w], [BBOX.n, BBOX.e]]);
L.rectangle([[BBOX.s, BBOX.w], [BBOX.n, BBOX.e]], { color: '#fff', weight: 1, dashArray: '6 6', fill: false, interactive: false }).addTo(map);
L.control.scale({ imperial: false }).addTo(map); // nota: Leaflet usa radio terrestre; la escala es orientativa

$('l-hirise').onchange = () => hirise.addTo(map);
$('l-ctx').onchange = () => map.removeLayer(hirise);
const bindToggle = (id, layer) => $(id).addEventListener('change', e => e.target.checked ? layer.addTo(map) : map.removeLayer(layer));
$('l-dem').addEventListener('change', e => e.target.checked ? demLayer.addTo(map) : map.removeLayer(demLayer));
bindToggle('l-themis', themis);

// Rover: recorrido y paradas coloreadas por inclinación medida
const trav = L.polyline(ROVER.traverse, { color: '#ffffff', weight: 2, opacity: 0.8, dashArray: '4 4', interactive: false }).addTo(map);
const wpLayer = L.layerGroup().addTo(map);
ROVER.waypoints.filter(w => w[0] >= M.rover.sinceSol).forEach(w => {
  const col = w[4] > 15 ? '#ff5d5d' : w[4] > 8 ? '#ffd166' : '#3ddc97';
  L.circleMarker([w[1], w[2]], { radius: 4, color: '#000', weight: 1, fillColor: col, fillOpacity: 1 })
    .bindTooltip(`${M.rover.name} · sol ${w[0]}<br>Elevación ${w[3].toFixed(0)} m<br>Inclinación medida del rover ${w[4].toFixed(1)}°`).addTo(wpLayer);
});
const last = ROVER.waypoints[ROVER.waypoints.length - 1];
L.circleMarker([last[1], last[2]], { radius: 8, color: '#fff', weight: 2, fillColor: '#6cc4ff', fillOpacity: 1 })
  .bindTooltip(`${M.rover.name}, última posición publicada (sol ${last[0]})`).addTo(wpLayer);
bindToggle('l-trav', trav); bindToggle('l-wp', wpLayer);

// ---------- Terreno: elevación real (Mars Trek ImageServer) → grilla de 10 m → pendiente ----------
let T = null; // { nx, ny, E, S }
function blur(a, nx, ny) {
  const o = new Float32Array(a.length);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    let s = 0, n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < ny && cc < nx) { const v = a[rr * nx + cc]; if (!isNaN(v)) { s += v; n++; } } }
    o[r * nx + c] = n ? s / n : NaN;
  }
  return o;
}
// Pide al servidor de imágenes de Trek la elevación del área como números de 32 bits (metros), sin pasar por PNG.
// Se pide al doble de resolución que la grilla y se promedian bloques de 2×2 para reducir el ruido.
async function fetchElevation(nx, ny) {
  const k = 2, w = nx * k, h = ny * k;
  const e = BBOX.w + nx * CELL_DEG, s = BBOX.n - ny * CELL_DEG;
  const url = `${TREK_IMG}/${M.dem.service}/ImageServer/exportImage?bbox=${BBOX.w},${s},${e},${BBOX.n}` +
    `&size=${w},${h}&format=bsq&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image`;
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = await r.arrayBuffer();
  if (buf.byteLength < w * h * 4) throw new Error(`respuesta incompleta (${buf.byteLength} bytes)`);
  const f = new Float32Array(buf.slice(0, w * h * 4));
  const raw = new Float32Array(nx * ny);
  for (let r0 = 0; r0 < ny; r0++) for (let c0 = 0; c0 < nx; c0++) {
    let sum = 0, n = 0;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
      const v = f[(r0 * k + a) * w + c0 * k + b];
      if (isFinite(v) && v > -12000 && v < 25000) { sum += v; n++; } // descarta "sin datos"
    }
    raw[r0 * nx + c0] = n ? sum / n : NaN;
  }
  return { raw, bytes: buf.byteLength, url };
}
async function buildTerrain() {
  const nx = Math.ceil((BBOX.e - BBOX.w) / CELL_DEG), ny = Math.ceil((BBOX.n - BBOX.s) / CELL_DEG);
  const { raw, bytes } = await fetchElevation(nx, ny);
  const E = blur(raw, nx, ny);
  const S = new Float32Array(nx * ny).fill(NaN);
  const dx = CELL_M * Math.cos(MID_LAT * toRad), dy = CELL_M;
  for (let r = 1; r < ny - 1; r++) for (let c = 1; c < nx - 1; c++) {
    const i = r * nx + c, gx = (E[i + 1] - E[i - 1]) / (2 * dx), gy = (E[i + nx] - E[i - nx]) / (2 * dy);
    S[i] = Math.atan(Math.hypot(gx, gy)) / toRad;
  }
  const missing = raw.reduce((s, v) => s + (isNaN(v) ? 1 : 0), 0);
  return { nx, ny, E, S, bytes, missing };
}
// Vista de elevación dibujada desde la grilla (para misiones sin teselas grises de elevación)
function drawElevation() {
  if (M.dem.grayTiles) return;
  let lo = Infinity, hi = -Infinity; // bucle: Math.min(...array) desborda la pila con >100 000 valores
  for (const v of T.E) if (!isNaN(v)) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const cv = document.createElement('canvas'); cv.width = T.nx; cv.height = T.ny;
  const g = cv.getContext('2d'), img = g.createImageData(T.nx, T.ny);
  for (let i = 0; i < T.E.length; i++) { if (isNaN(T.E[i])) continue; const v = Math.round(255 * (T.E[i] - lo) / ((hi - lo) || 1)); img.data.set([v, v, v, 255], i * 4); }
  g.putImageData(img, 0, 0);
  const on = map.hasLayer(demLayer); map.removeLayer(demLayer);
  demLayer = L.imageOverlay(cv.toDataURL(), [[BBOX.n - T.ny * CELL_DEG, BBOX.w], [BBOX.n, BBOX.w + T.nx * CELL_DEG]], { opacity: 0.55, interactive: false });
  if (on) demLayer.addTo(map);
}
const cellOf = ll => { const r = Math.floor((BBOX.n - ll[0]) / CELL_DEG), c = Math.floor((ll[1] - BBOX.w) / CELL_DEG);
  return (r < 0 || c < 0 || r >= T.ny || c >= T.nx) ? -1 : r * T.nx + c; };
const cellLL = i => [BBOX.n - (Math.floor(i / T.nx) + 0.5) * CELL_DEG, BBOX.w + (i % T.nx + 0.5) * CELL_DEG];

const SLOPE_CLASSES = [[8, '#3ddc97', 'Menos de 8°: cómodo'], [15, '#ffd166', '8–15°: con cuidado'], [25, '#ff9b42', '15–25°: difícil con traje'], [90, '#ff5d5d', 'Más de 25°: evitar']];
const slopeColor = s => SLOPE_CLASSES.find(k => s < k[0])[1];
$('slope-legend').innerHTML = SLOPE_CLASSES.map(k => `<div><span class="sw" style="background:${k[1]}"></span>${k[2]}</div>`).join('');
let slopeOverlay = null;
function drawSlope() {
  const cv = document.createElement('canvas'); cv.width = T.nx; cv.height = T.ny;
  const g = cv.getContext('2d'), img = g.createImageData(T.nx, T.ny);
  for (let i = 0; i < T.S.length; i++) {
    const s = T.S[i]; if (isNaN(s) || s < 8) continue;
    const h = slopeColor(s); img.data.set([parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 150], i * 4);
  }
  g.putImageData(img, 0, 0);
  slopeOverlay = L.imageOverlay(cv.toDataURL(), [[BBOX.n - T.ny * CELL_DEG, BBOX.w], [BBOX.n, BBOX.w + T.nx * CELL_DEG]], { opacity: 0.5, interactive: false });
  if ($('l-slope').checked) slopeOverlay.addTo(map);
  $('l-slope').onchange = e => e.target.checked ? slopeOverlay.addTo(map) : map.removeLayer(slopeOverlay);
}

// ---------- Base, paradas y obstáculos ----------
const habW = nearestWaypoint(HAB_SOL);
let hab = L.marker([habW[1], habW[2]], { draggable: true, icon: L.divIcon({ className: 'hab-icon', iconSize: [22, 22] }) })
  .bindTooltip('Base / hábitat', { permanent: true, direction: 'right', offset: [12, 0] }).addTo(map);
hab.on('dragend', () => { drawWalk(); schedulePlan(); });
const walkCircle = L.circle(hab.getLatLng(), { radius: 1, color: '#6cc4ff', weight: 1.5, dashArray: '8 6', fill: false, interactive: false }).addTo(map);
function drawWalk() { walkCircle.setLatLng(hab.getLatLng()); walkCircle.setRadius(+$('p-walk').value * 1000 * (6371 / MARS_R_KM)); } // Leaflet mide con radio terrestre
bindToggle('l-walk', walkCircle);

const usedWp = new Set();
const stations = STATION_DEFS.map((d, k) => {
  // la parada del rover más cercana a ese sol que no se haya usado ya
  const w = ROVER.waypoints.filter(x => !usedWp.has(x[0])).reduce((b, x) => Math.abs(x[0] - d.sol) < Math.abs(b[0] - d.sol) ? x : b);
  usedWp.add(w[0]);
  return Object.assign({}, d, { id: k, ll: [w[1], w[2]], src: `${M.rover.name} estuvo aquí (sol ${w[0]})` });
});
const stLayer = L.layerGroup().addTo(map);
function renderStations() {
  stLayer.clearLayers();
  const box = $('stations'); box.innerHTML = '';
  stations.forEach((s, k) => {
    s.label = 'E' + (k + 1);
    const m = L.marker(s.ll, { draggable: true, opacity: s.on ? 1 : 0.45, icon: L.divIcon({ className: 'st-icon', html: s.label, iconSize: [26, 26] }) })
      .bindTooltip(`<b>${s.label} · ${s.name}</b><br>${s.obj}<br><i>${s.src}</i>`).addTo(stLayer);
    m.on('dragend', () => { const p = m.getLatLng(); s.ll = [p.lat, p.lng]; s.src = 'Movida a mano'; renderStations(); schedulePlan(); });
    const el = document.createElement('div'); el.className = 'st';
    el.innerHTML = `<input type="checkbox" id="st-${k}" ${s.on ? 'checked' : ''} aria-label="Incluir ${s.name}">
      <div><span class="n">${s.label} · ${s.name}</span></div><span class="t">${s.min} min</span>
      <div class="o">${s.obj}<br><i>${s.src}</i></div>`;
    const go = document.createElement('button'); go.textContent = 'Ver'; go.onclick = () => map.setView(s.ll, 17);
    el.querySelector('.t').after(go); el.style.gridTemplateColumns = '22px 1fr auto auto';
    el.querySelector('input').onchange = e => { s.on = e.target.checked; renderStations(); schedulePlan(); };
    box.appendChild(el);
  });
}

const obstacles = []; const obsLayer = L.layerGroup().addTo(map);
function addObstacle(ll, r = 25) {
  obstacles.push({ ll, r });
  L.circle(ll, { radius: r * (6371 / MARS_R_KM), color: '#ff5d5d', weight: 2, fillOpacity: 0.35 }).bindTooltip(`Obstáculo (${r} m de radio)`).addTo(obsLayer);
}
$('clear-obs').onclick = () => { obstacles.length = 0; obsLayer.clearLayers(); schedulePlan(); };

let mode = 'pan';
const hints = { pan: 'Arrastrá el cuadrado verde para mover la base. Arrastrá los círculos naranjas para mover paradas.',
  obs: 'Tocá el mapa para marcar una roca grande u otro obstáculo (25 m de radio). La ruta lo esquiva.',
  stop: 'Tocá el mapa para agregar una parada científica.' };
function setMode(m) { mode = m; ['pan', 'obs', 'stop'].forEach(k => $('m-' + k).setAttribute('aria-pressed', k === m)); $('mode-hint').textContent = hints[m]; $('map').classList.toggle('cross', m !== 'pan'); }
['pan', 'obs', 'stop'].forEach(k => $('m-' + k).onclick = () => setMode(k));
map.on('click', e => {
  const ll = [e.latlng.lat, e.latlng.lng];
  if (mode === 'obs') { addObstacle(ll); schedulePlan(); }
  if (mode === 'stop') { stations.push({ name: 'Parada agregada', obj: 'Objetivo a definir por la tripulación.', min: 20, on: true, ll, src: 'Agregada en el mapa' }); renderStations(); schedulePlan(); setMode('pan'); }
});

// ---------- Importar coordenadas escritas ----------
const inZone = p => p.lat > BBOX.s && p.lat < BBOX.n && p.lon > BBOX.w && p.lon < BBOX.e;
function importCoords(kind) {
  const msg = $('ci-msg');
  try {
    const r = parseCoordText($('coord-in').value);
    const pts = r.points.concat(r.lines.flatMap(l => l.coords.map(c => ({ lat: c[0], lon: c[1], name: l.name }))));
    const ok = pts.filter(inZone), out = pts.filter(p => !inZone(p));
    if (!ok.length) throw new Error(`Ninguna coordenada cae dentro de la zona de exploración (latitud ${BBOX.s} a ${BBOX.n}, longitud ${BBOX.w} a ${BBOX.e}). La primera fue ${pts[0].lat.toFixed(4)}, ${pts[0].lon.toFixed(4)}.`);
    if (kind === 'hab') { hab.setLatLng([ok[0].lat, ok[0].lon]); drawWalk(); }
    ok.forEach(p => {
      if (kind === 'stop') stations.push({ name: p.name || 'Parada importada', obj: 'Objetivo a definir por la tripulación.', min: 20, on: true, ll: [p.lat, p.lon], src: `Importada: ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}` });
      if (kind === 'obs') addObstacle([p.lat, p.lon]);
    });
    if (kind === 'stop') renderStations();
    map.fitBounds(ok.map(p => [p.lat, p.lon]).concat([[hab.getLatLng().lat, hab.getLatLng().lng]]), { maxZoom: 17, padding: [40, 40] });
    schedulePlan();
    const what = { stop: 'parada(s)', obs: 'obstáculo(s)', hab: 'base movida a la primera coordenada' }[kind];
    msg.style.color = 'var(--ok)';
    msg.textContent = (kind === 'hab' ? 'Listo: ' + what : `Agregado: ${ok.length} ${what}`) + '.' +
      (out.length ? ` ${out.length} coordenada(s) quedaron fuera de la zona y no se usaron.` : '') +
      (r.errors.length ? ` Líneas con error: ${r.errors.join(' · ')}` : '');
  } catch (e) { msg.style.color = 'var(--bad)'; msg.textContent = 'No se pudo importar. ' + e.message; }
}
$('ci-stop').onclick = () => importCoords('stop');
$('ci-obs').onclick = () => importCoords('obs');
$('ci-hab').onclick = () => importCoords('hab');

// ---------- Planificación (A* con costo en tiempo de caminata) ----------
class Heap { constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) { let i = 0; for (;;) { let l = 2 * i + 1; if (l >= n) break; if (l + 1 < n && k[l + 1] < k[l]) l++; if (k[l] >= lk) break; k[i] = k[l]; v[i] = v[l]; i = l; } k[i] = lk; v[i] = lv; } return top; }
  get size() { return this.k.length; } }

function params() {
  return { maxSlope: +$('p-slope').value, v0: +$('p-speed').value, load: +$('p-load').value, eva: +$('p-eva').value, walk: +$('p-walk').value, start: +$('p-start').value };
}
// Velocidad con traje: función de Tobler (caminata) normalizada a la velocidad en llano, reducida por la carga.
function speedKmh(tan, P) { const lf = Math.max(0.4, 1 - P.load / 120); return P.v0 * lf * Math.exp(-3.5 * Math.abs(tan + 0.05)) / Math.exp(-0.175); }

function blockedMask() {
  const B = new Uint8Array(T.nx * T.ny);
  obstacles.forEach(o => { const c = cellOf(o.ll); if (c < 0) return; const rc = Math.ceil(o.r / CELL_M) + 1, r0 = Math.floor(c / T.nx), c0 = c % T.nx;
    for (let r = r0 - rc; r <= r0 + rc; r++) for (let cc = c0 - rc; cc <= c0 + rc; cc++) { if (r < 0 || cc < 0 || r >= T.ny || cc >= T.nx) continue;
      const i = r * T.nx + cc; if (havM(cellLL(i), o.ll) <= o.r + CELL_M * 0.7) B[i] = 1; } });
  return B;
}
function legPath(a, b, P, B) {
  const s = cellOf(a), t = cellOf(b); if (s < 0 || t < 0) return null;
  const N = T.nx * T.ny, g = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const vmaxH = speedKmh(-0.05, P), goal = cellLL(t), heap = new Heap();
  const h = i => havM(cellLL(i), goal) / 1000 / vmaxH;
  g[s] = 0; heap.push(h(s), s);
  const D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1], [-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]];
  while (heap.size) {
    const i = heap.pop(); if (closed[i]) continue; closed[i] = 1; if (i === t) break;
    const r = (i / T.nx) | 0, c = i % T.nx;
    for (const [dr, dc] of D) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= T.ny || cc >= T.nx) continue;
      const j = rr * T.nx + cc; if (closed[j] || B[j] || isNaN(T.E[j]) || !(T.S[j] <= P.maxSlope)) continue;
      if (Math.abs(dr) + Math.abs(dc) === 3) { const m = (r + Math.sign(dr) * (Math.abs(dr) > 1 ? 1 : 0)) * T.nx + (c + Math.sign(dc) * (Math.abs(dc) > 1 ? 1 : 0)); if (B[m] || !(T.S[m] <= P.maxSlope)) continue; }
      const d = CELL_M * Math.hypot(dr, dc), tan = (T.E[j] - T.E[i]) / d;
      const ng = g[i] + (d / 1000) / speedKmh(tan, P);
      if (ng < g[j]) { g[j] = ng; came[j] = i; heap.push(ng + h(j), j); }
    }
  }
  if (s !== t && came[t] === -1) return null;
  const cells = []; for (let i = t; i !== -1; i = came[i]) cells.push(i); cells.reverse();
  return { cells, hours: g[t] };
}

const routeLayer = L.layerGroup().addTo(map);
let lastPlan = null, planTimer = null;
function schedulePlan() { clearTimeout(planTimer); planTimer = setTimeout(plan, 250); }
function plan() {
  if (!T) return;
  const P = params(), B = blockedMask(), habLL = [hab.getLatLng().lat, hab.getLatLng().lng];
  routeLayer.clearLayers();
  const sel = stations.filter(s => s.on);
  const stops = [{ label: 'Base', name: 'Base', ll: habLL, min: 0 }, ...sel, { label: 'Base', name: 'Regreso a base', ll: habLL, min: 0 }];
  const legs = [], alerts = [];
  for (let k = 1; k < stops.length; k++) {
    const r = legPath(stops[k - 1].ll, stops[k].ll, P, B);
    if (!r) { alerts.push(['bad', `No hay camino a pie de ${stops[k - 1].label} a ${stops[k].label} con pendientes de hasta ${P.maxSlope}° y los obstáculos marcados. Probá subir la pendiente máxima o mover la parada.`]); legs.push(null); continue; }
    legs.push(Object.assign(r, { from: stops[k - 1], to: stops[k] }));
  }
  // Recorrido completo, perfil y métricas
  let km = 0, hours = 0, up = 0, down = 0, maxS = 0, far = 0;
  const prof = [], rows = [];
  let clock = P.start;
  legs.forEach((L_, k) => {
    if (!L_) return;
    let legKm = 0;
    L_.cells.forEach((c, n) => {
      const ll = cellLL(c);
      if (n) { const p = cellLL(L_.cells[n - 1]), d = havM(p, ll) / 1000, dh = T.E[c] - T.E[L_.cells[n - 1]]; legKm += d; if (dh > 0) up += dh; else down -= dh; }
      maxS = Math.max(maxS, T.S[c] || 0); far = Math.max(far, havM(ll, habLL) / 1000);
      prof.push([km + legKm, T.E[c]]);
    });
    // Dibujo por tramos coloreados según pendiente
    let seg = [cellLL(L_.cells[0])], col = slopeColor(T.S[L_.cells[0]] || 0);
    L_.cells.slice(1).forEach(c => { const cc = slopeColor(T.S[c] || 0), ll = cellLL(c); seg.push(ll);
      if (cc !== col) { L.polyline(seg, { color: col, weight: 5, opacity: 0.95 }).addTo(routeLayer); seg = [ll]; col = cc; } });
    L.polyline(seg, { color: col, weight: 5, opacity: 0.95 }).addTo(routeLayer);
    km += legKm; hours += L_.hours;
    const arrive = clock + L_.hours; clock = arrive + (L_.to.min || 0) / 60; hours += (L_.to.min || 0) / 60;
    rows.push(`<tr><td>${L_.from.label} → ${L_.to.label}</td><td class="r">${(legKm * 1000).toFixed(0)} m</td><td class="r">${fmtH(L_.hours)}</td><td class="r">${fmtClock(arrive)}</td><td class="r">${L_.to.min ? L_.to.min + ' min' : ''}</td></tr>`);
  });
  const reserve = P.eva - hours, dose = hours * RAD.mSvDay / 24;
  // Verificaciones de seguridad
  if (reserve < 0) alerts.push(['bad', `La EVA dura ${fmtH(hours)} y supera la autonomía del traje (${P.eva} h). Quitá paradas o acortá tiempos.`]);
  else if (reserve < 1) alerts.push(['warn', `Reserva de solo ${fmtH(reserve)}. Se recomienda al menos 1 h para imprevistos.`]);
  if (far > P.walk) alerts.push(['bad', `La ruta se aleja ${far.toFixed(2)} km de la base y supera el límite de regreso a pie (${P.walk} km).`]);
  if (maxS > P.maxSlope * 0.85) alerts.push(['warn', `Hay tramos de ${maxS.toFixed(0)}°, cerca del límite de ${P.maxSlope}°. Ir con bastones y en fila.`]);
  if (sun && P.start + hours > sun.set - 0.5) alerts.push(['bad', `La EVA termina a las ${fmtClock(P.start + hours)} y la puesta de sol es a las ${fmtClock(sun.set)}. Salir antes.`]);
  if (spaceWeather.level === 'bad') alerts.push(['bad', spaceWeather.msg]);
  else if (spaceWeather.level === 'warn') alerts.push(['warn', spaceWeather.msg]);
  if (!alerts.length) alerts.push(['ok', 'Sin alertas: la ruta respeta pendiente, autonomía, distancia de regreso y horario de luz.']);
  $('alerts').innerHTML = alerts.map(a => `<div class="alert ${a[0]}">${a[1]}</div>`).join('');
  $('timeline').innerHTML = `<table><tr><th>Tramo</th><th class="r">Dist.</th><th class="r">Camino</th><th class="r">Llegada</th><th class="r">Trabajo</th></tr>${rows.join('')}</table>
    <div class="muted" style="margin-top:6px">Sube ${up.toFixed(0)} m · baja ${down.toFixed(0)} m · salida ${fmtClock(P.start)} · regreso ${fmtClock(P.start + hours)}</div>`;
  $('profile').innerHTML = profileSvg(prof);
  // Barra superior
  const verdict = alerts.some(a => a[0] === 'bad') ? 'bad' : alerts.some(a => a[0] === 'warn') ? 'warn' : 'ok';
  $('verdict').className = verdict; $('verdict').textContent = { ok: 'EVA APTA', warn: 'EVA CON PRECAUCIÓN', bad: 'EVA NO APTA' }[verdict];
  setChip('c-time', fmtH(hours), hours > P.eva ? 'bad' : '');
  setChip('c-res', reserve >= 0 ? fmtH(reserve) : '−' + fmtH(-reserve), reserve < 0 ? 'bad' : reserve < 1 ? 'warn' : 'ok');
  setChip('c-dist', km.toFixed(2) + ' km');
  setChip('c-far', far.toFixed(2) + ' km', far > P.walk ? 'bad' : 'ok');
  setChip('c-slope', maxS.toFixed(0) + '°', maxS > P.maxSlope * 0.85 ? 'warn' : 'ok');
  setChip('c-dose', dose.toFixed(3) + ' mSv', spaceWeather.level === 'bad' ? 'bad' : '');
  $('rad').innerHTML = `<table>
    <tr><td>Tasa en superficie (RAD, Curiosity, Gale)${M.rover.key !== 'curiosity' ? ' *' : ''}</td><td class="r">${RAD.mSvDay} mSv/día</td></tr>
    <tr><td>Dosis de esta EVA (${fmtH(hours)})</td><td class="r">${dose.toFixed(3)} mSv</td></tr>
    <tr><td>Equivale a % del límite de carrera NASA (${RAD.careerLimit} mSv)</td><td class="r">${(100 * dose / RAD.careerLimit).toFixed(4)} %</td></tr></table>
    <div class="muted">El traje casi no frena los rayos cósmicos: la dosis depende sobre todo del tiempo fuera. El riesgo agudo son las tormentas solares (SEP): ante una alerta, volver a la base o refugiarse al pie de una pared alta, que tapa parte del cielo.${M.rover.key !== 'curiosity' ? `<br>* ${M.rover.name} no lleva detector de radiación: se usa la medición de Curiosity como referencia. En un sitio más alto hay menos atmósfera encima y la dosis real puede ser algo mayor.` : ''}</div>`;
  lastPlan = { stops, legs, km, hours, dose, alerts };
}

function profileSvg(p, w = 320, h = 90) {
  if (p.length < 2) return '';
  const x1 = p[p.length - 1][0] || 1, ys = p.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), dy = (y1 - y0) || 1;
  const X = x => (x / x1) * w, Y = y => 8 + (1 - (y - y0) / dy) * (h - 16);
  const pts = p.map(q => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h + 14}" width="100%" role="img" aria-label="Perfil de elevación de la EVA">
    <polygon points="0,${h - 8} ${pts} ${w},${h - 8}" fill="#f08a4b" fill-opacity=".18"/><polyline points="${pts}" fill="none" stroke="#f08a4b" stroke-width="1.6"/>
    <text x="0" y="10" font-size="10" fill="#a8968c">${y1.toFixed(0)} m</text><text x="0" y="${h + 10}" font-size="10" fill="#a8968c">${y0.toFixed(0)} m</text>
    <text x="${w}" y="${h + 10}" font-size="10" fill="#a8968c" text-anchor="end">${x1.toFixed(2)} km · perfil de elevación</text></svg>`;
}

// ---------- Parámetros ----------
const outs = { 'p-slope': v => v + '°', 'p-speed': v => v + ' km/h', 'p-load': v => v + ' kg', 'p-eva': v => v + ' h', 'p-walk': v => v + ' km', 'p-start': v => fmtClock(+v) };
Object.keys(outs).forEach(id => $(id).addEventListener('input', e => { $('o-' + id.slice(2)).textContent = outs[id](e.target.value); if (id === 'p-walk') drawWalk(); schedulePlan(); }));
$('plan').onclick = plan;
$('copy').onclick = async () => {
  if (!lastPlan) return;
  const fc = { type: 'FeatureCollection', properties: { mision: 'Athenea · ' + M.name, duracion_h: +lastPlan.hours.toFixed(2), distancia_km: +lastPlan.km.toFixed(3), dosis_mSv: +lastPlan.dose.toFixed(4) }, features: [] };
  lastPlan.stops.forEach(s => fc.features.push({ type: 'Feature', properties: { nombre: s.name, objetivo: s.obj || '', minutos: s.min }, geometry: { type: 'Point', coordinates: [s.ll[1], s.ll[0]] } }));
  lastPlan.legs.filter(Boolean).forEach(l => fc.features.push({ type: 'Feature', properties: { tramo: `${l.from.label} → ${l.to.label}`, horas: +l.hours.toFixed(3) }, geometry: { type: 'LineString', coordinates: l.cells.map(c => { const ll = cellLL(c); return [+ll[1].toFixed(6), +ll[0].toFixed(6)]; }) } }));
  const txt = JSON.stringify(fc);
  try { await navigator.clipboard.writeText(txt); $('copy').textContent = 'Plan copiado'; } catch { $('copy').textContent = 'No se pudo copiar'; }
  setTimeout(() => $('copy').textContent = 'Copiar plan (GeoJSON)', 2000);
};

// ---------- Clima espacial (DONKI, NASA) ----------
const spaceWeather = { level: 'unknown', msg: '' };
async function loadDonki() {
  const end = new Date(), start = new Date(end - 30 * 864e5), f = d => d.toISOString().slice(0, 10);
  try {
    const r = await fetch(`https://api.nasa.gov/DONKI/notifications?startDate=${f(start)}&endDate=${f(end)}&type=all&api_key=DEMO_KEY`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const list = await r.json();
    const names = { FLR: 'Fulguración solar', SEP: 'Partículas solares (SEP)', CME: 'Eyección de masa coronal', IPS: 'Choque interplanetario', GST: 'Tormenta geomagnética', RBE: 'Cinturones de radiación (Tierra)', MPC: 'Cruce de magnetopausa', Report: 'Informe semanal' };
    const recentDays = d => (Date.now() - new Date(d)) / 864e5;
    const mars = list.filter(n => /\bMars\b/i.test(n.messageBody));
    const sepRecent = list.filter(n => n.messageType === 'SEP' && recentDays(n.messageIssueTime) < 3);
    const marsRecent = mars.filter(n => recentDays(n.messageIssueTime) < 5 && n.messageType !== 'Report');
    if (sepRecent.length) Object.assign(spaceWeather, { level: 'bad', msg: 'Alerta de partículas solares (SEP) en los últimos 3 días. Suspender EVA hasta confirmar niveles con RAD.' });
    else if (marsRecent.length) Object.assign(spaceWeather, { level: 'warn', msg: `DONKI menciona a Marte en ${marsRecent.length} aviso(s) de los últimos 5 días (posible eyección hacia Marte). Planificar EVA corta y cerca de la base.` });
    else Object.assign(spaceWeather, { level: 'ok', msg: 'Sin eventos solares recientes dirigidos a Marte.' });
    setChip('c-sw', { ok: 'Tranquilo', warn: 'Atención', bad: 'Alerta' }[spaceWeather.level], spaceWeather.level);
    const counts = {}; list.forEach(n => counts[n.messageType] = (counts[n.messageType] || 0) + 1);
    $('donki').innerHTML = `<div class="alert ${spaceWeather.level}">${spaceWeather.msg}</div>
      <div style="margin-top:6px">Avisos DONKI de los últimos 30 días: ${Object.entries(counts).map(([k, v]) => `${names[k] || k}: <b>${v}</b>`).join(' · ')}</div>
      <div style="margin-top:6px">${list.filter(n => n.messageType !== 'Report').slice(-5).reverse().map(n => `<div class="ev"><b>${n.messageIssueTime.slice(0, 16).replace('T', ' ')}</b> · ${names[n.messageType] || n.messageType}${/\bMars\b/i.test(n.messageBody) ? ' · <b style="color:var(--warn)">menciona Marte</b>' : ''} · <a href="${n.messageURL}" target="_blank" style="color:var(--info)">ver</a></div>`).join('')}</div>
      <div class="muted" style="margin-top:6px">DONKI se centra en la Tierra; para Marte solo sirve como aviso temprano. Una misión real usaría el monitoreo de RAD en tiempo real.</div>`;
  } catch (e) {
    Object.assign(spaceWeather, { level: 'warn', msg: 'No se pudo consultar DONKI. Sin datos de clima espacial: confirmar con control de misión antes de salir.' });
    setChip('c-sw', 'Sin datos', 'warn'); $('donki').innerHTML = `<div class="alert warn">${spaceWeather.msg} (${e.message})</div>`;
  }
  schedulePlan();
}

// ---------- Meteorología (REMS de Curiosity o MEDA de Perseverance) ----------
let sun = null;
const WEATHER = {
  msl: { url: 'https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json', src: 'REMS (Centro de Astrobiología / NASA-JPL)',
    pick: j => j.soles.find(x => x.max_temp !== '--' && x.sunrise !== '--') },
  mars2020: { url: 'https://mars.nasa.gov/rss/api/?feed=weather&category=mars2020&feedtype=json', src: 'MEDA (Centro de Astrobiología / NASA-JPL)',
    pick: j => j.sols.filter(x => x.min_temp !== '--' && x.sunrise).pop() },
};
async function loadWeather() {
  const W = WEATHER[M.weather];
  try {
    const r = await fetch(W.url);
    const s = W.pick(await r.json()); if (!s) throw new Error('el feed no trae datos');
    const hm = t => { const [a, b] = t.split(':').map(Number); return a + b / 60; }, hhmm = t => t.slice(0, 5);
    const num = v => typeof v === 'number' ? v.toFixed(0) : v;
    sun = { rise: hm(s.sunrise), set: hm(s.sunset) };
    setChip('c-sun', `${hhmm(s.sunrise)}–${hhmm(s.sunset)}`, 'ok');
    const uv = s.local_uv_irradiance_index ? `<tr><td>Radiación UV</td><td class="r">${({ Low: 'Baja', Moderate: 'Moderada', High: 'Alta', 'Very_High': 'Muy alta', 'Very High': 'Muy alta' })[s.local_uv_irradiance_index] || s.local_uv_irradiance_index}</td></tr>` : '';
    const ground = s.min_gts_temp && s.min_gts_temp !== '--' ? `<tr><td>Temperatura del suelo</td><td class="r">${s.min_gts_temp} a ${s.max_gts_temp} °C</td></tr>` : '';
    const sky = s.atmo_opacity ? `<tr><td>Cielo</td><td class="r">${s.atmo_opacity === 'Sunny' ? 'Despejado' : s.atmo_opacity}</td></tr>` : '';
    $('rems').innerHTML = `<table>
      <tr><td>Último sol con datos</td><td class="r">${s.sol} (${s.terrestrial_date})</td></tr>
      <tr><td>Temperatura del aire</td><td class="r">${num(s.min_temp)} a ${num(s.max_temp)} °C</td></tr>
      ${ground}<tr><td>Presión</td><td class="r">${num(s.pressure)} Pa</td></tr>${uv}${sky}
      <tr><td>Salida / puesta del sol</td><td class="r">${hhmm(s.sunrise)} / ${hhmm(s.sunset)}</td></tr></table>
      <div class="muted">Fuente: ${W.src}. El feed público trae el último sol procesado (${s.terrestrial_date}), no el clima de hoy.</div>`;
  } catch (e) { $('rems').innerHTML = `<div class="alert warn">No se pudo consultar la meteorología (${e.message}).</div>`; setChip('c-sun', 'Sin datos', 'warn'); }
  schedulePlan();
}

// ---------- Arranque ----------
renderStations(); drawWalk();
loadDonki(); loadWeather();
(async () => {
  const t0 = performance.now();
  try { T = await buildTerrain(); }
  catch (e) {
    $('verdict').className = 'bad'; $('verdict').textContent = 'SIN TERRENO';
    $('alerts').innerHTML = `<div class="alert bad">No se pudo descargar la elevación de Mars Trek (${e.message}). Sin terreno no se puede calcular una ruta segura.</div>`;
    return;
  }
  drawSlope(); drawElevation();
  // Validación contra lo que midió el rover en sus paradas dentro de la zona: altura e inclinación
  const inside = ROVER.waypoints.filter(w => w[1] > BBOX.s && w[1] < BBOX.n && w[2] > BBOX.w && w[2] < BBOX.e);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const pairs = inside.map(w => [T.S[cellOf([w[1], w[2]])], w[4]]).filter(p => !isNaN(p[0]));
  const ePairs = inside.map(w => [T.E[cellOf([w[1], w[2]])], w[3]]).filter(p => !isNaN(p[0]));
  const eBias = mean(ePairs.map(p => p[0] - p[1])), eErr = mean(ePairs.map(p => Math.abs(p[0] - p[1] - eBias)));
  const mae = mean(pairs.map(p => Math.abs(p[0] - p[1])));
  const mx = mean(pairs.map(p => p[0])), my = mean(pairs.map(p => p[1]));
  const cov = mean(pairs.map(p => (p[0] - mx) * (p[1] - my))), sx = Math.sqrt(mean(pairs.map(p => (p[0] - mx) ** 2))), sy = Math.sqrt(mean(pairs.map(p => (p[1] - my) ** 2)));
  $('quality').innerHTML = `<table>
    <tr><td>Fuente de elevación</td><td class="r">${M.dem.label}</td></tr>
    <tr><td>Grilla de navegación</td><td class="r">${T.nx}×${T.ny} celdas de ${CELL_M} m</td></tr>
    <tr><td>Celdas sin datos</td><td class="r">${T.missing}</td></tr>
    <tr><td>Paradas de ${M.rover.name} en la zona</td><td class="r">${pairs.length}</td></tr>
    <tr><td>Altura: diferencia con el rover (desvío fijo / error)</td><td class="r">${eBias.toFixed(1)} m / ${eErr.toFixed(1)} m</td></tr>
    <tr><td>Pendiente media calculada / medida por el rover</td><td class="r">${mx.toFixed(1)}° / ${my.toFixed(1)}°</td></tr>
    <tr><td>Diferencia media de pendiente</td><td class="r">${mae.toFixed(1)}°</td></tr>
    <tr><td>Correlación de pendiente</td><td class="r">${(cov / (sx * sy)).toFixed(2)}</td></tr>
    <tr><td>Tiempo de preparación</td><td class="r">${((performance.now() - t0) / 1000).toFixed(1)} s</td></tr></table>
    <div class="muted">La inclinación del rover incluye rocas y ondulaciones de menos de 10 m que la grilla no ve; por eso la pendiente calculada tiende a ser menor.${M.dem.coarse ? ' <b>En esta misión la elevación es de baja resolución (200 m): las pendientes locales no se ven y el margen de seguridad depende de los obstáculos marcados a mano.</b>' : ''}</div>`;
  if (M.dem.coarse) $('alerts-static').innerHTML = `<div class="alert warn">Elevación de baja resolución (${M.dem.label}): la ruta no ve escalones ni pendientes de menos de ~200 m. Marcar obstáculos al revisar la imagen HiRISE.</div>`;
  window.__quality = { mae, n: pairs.length, mx, my, r: cov / (sx * sy), eBias, eErr };
  plan();
})();
