// ATHENEA · EVA planner. Works for any mission defined in missions.js (chosen with ?m=gale, ?m=jezero…).
// NASA data: HiRISE/CTX (optical), DTM via Mars Trek (topographic), THEMIS (thermal), rover traverse (in situ),
// RAD (surface radiation measurement), DONKI (live space weather), REMS/MEDA (rover weather stations).

// ---------- Selected mission ----------
const MISSION_ID = (new URLSearchParams(location.search).get('m') || 'gale').toLowerCase();
const M = MISSIONS[MISSION_ID] || MISSIONS.gale;
const ROVER = ROVER_DATA[M.rover.key];

// ---------- Constants ----------
const MARS_R_KM = 3389.5;
const DEG_M = Math.PI * MARS_R_KM * 1000 / 180;          // meters per degree of latitude (~59,160 m)
const BBOX = M.bbox;
const TREK = 'https://trek.nasa.gov/tiles/Mars/EQ';
const TREK_IMG = 'https://trek.nasa.gov/mars/trekarcgis/rest/services';
const CELL_M = 10;                                         // navigation grid cell
const CELL_DEG = CELL_M / DEG_M;
const MID_LAT = (BBOX.s + BBOX.n) / 2;
const TERRAIN_TIMEOUT_MS = 30_000;
// RAD (Hassler et al. 2014, Science): dose equivalent measured by Curiosity on the surface at Gale ≈ 0.64 mSv/day.
const RAD = { mSvDay: 0.64, careerLimit: 600 };            // NASA-STD-3001 (2022) career limit: 600 mSv
// Planning-only consumables: user-provided research; not validated Mars suit rates.
const EVA_RESOURCE_ESTIMATES = {
  metabolicO2KgPerHour: 0.09, // Mars PLSS schematic at 350 W average
  leakageO2KgPerHour: 0.026,  // provisional suit-leakage analog
  potableWaterLPerHour: 0.24, // minimum provision, not measured intake
  coolingWaterKgPerHour: 0.45 // sublimator-class analog; architecture may differ on Mars
};
const STATION_DEFS = M.stations;
const HAB_SOL = M.habSol;

// Header and texts for the selected mission
document.title = 'Athenea · ' + M.name;
document.getElementById('brand').innerHTML = `ATHENEA · ${M.name}<small>${M.place}</small>`;
document.getElementById('intro').innerHTML = `${M.intro} The stops are at places ${M.rover.name} visited; the objectives are proposals to be validated with the science team.`;
document.getElementById('lbl-hirise').textContent = M.hirise.label;
document.getElementById('lbl-ctx').textContent = M.ctx.label;
document.getElementById('lbl-dem').textContent = 'Calculated slope (' + M.dem.label + ')';
document.getElementById('lbl-rover').textContent = M.rover.name + ' traverse';
document.getElementById('lbl-wp').textContent = `${M.rover.name} stops (measured tilt)`;
document.getElementById('wx-title').textContent = `Weather (${M.weather === 'msl' ? 'REMS, Curiosity' : 'MEDA, Perseverance'})`;
const sel = document.getElementById('mission-select');
sel.innerHTML = Object.entries(MISSIONS).map(([k, v]) => `<option value="${k}" ${k === MISSION_ID ? 'selected' : ''}>${v.name}</option>`).join('');
sel.onchange = () => { location.search = '?m=' + sel.value; };
document.getElementById('p-walk').value = M.defaults.walk;
document.getElementById('o-walk').textContent = M.defaults.walk + ' km';

// ---------- Utilities ----------
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
function renderConsumables(hours) {
  const extraO2Rate = Number($('o2-architecture').value);
  const metabolicO2 = hours * EVA_RESOURCE_ESTIMATES.metabolicO2KgPerHour;
  const leakageO2 = hours * EVA_RESOURCE_ESTIMATES.leakageO2KgPerHour;
  const ventilationO2 = hours * extraO2Rate;
  const totalO2 = metabolicO2 + leakageO2 + ventilationO2;
  const drinkingWater = hours * EVA_RESOURCE_ESTIMATES.potableWaterLPerHour;
  const coolingWater = hours * EVA_RESOURCE_ESTIMATES.coolingWaterKgPerHour;
  const foodEVA = hours * 200;
  $('consumables').innerHTML = `<div class="muted">Estimate for 1 astronaut · ${fmtH(hours)} of EVA</div>
    <table>
      <tr><td>Metabolic O₂ (350 W)</td><td class="r">${metabolicO2.toFixed(2)} kg</td></tr>
      <tr><td>O₂ lost to leakage (provisional)</td><td class="r">${leakageO2.toFixed(2)} kg</td></tr>
      <tr><td>Extra O₂ for ventilation</td><td class="r">${ventilationO2.toFixed(2)} kg</td></tr>
      <tr><th>Total estimated O₂</th><th class="r">${totalO2.toFixed(2)} kg</th></tr>
      <tr><td>Drinking water to provide</td><td class="r">${drinkingWater.toFixed(2)} L</td></tr>
      <tr><td>Cooling water (scenario)</td><td class="r">${coolingWater.toFixed(2)} kg</td></tr>
      <tr><td>Food: daily budget¹</td><td class="r">3,035 + ${foodEVA.toFixed(0)} = ${(3035 + foodEVA).toFixed(0)} kcal</td></tr>
    </table>
    <div class="muted">Planning estimates, not validated rates for a Mars suit. ¹Per-person budget for the EVA day; it does not imply eating inside the suit. The 240 mL/h is a minimum provision, not measured intake. Cooling water depends on the thermal system; 0.45 kg/h is an analog of sublimator-based systems and may not apply on Mars.</div>`;
}

// ---------- Map ----------
const map = L.map('map', { crs: L.CRS.EPSG4326, center: [MID_LAT, (BBOX.w + BBOX.e) / 2], zoom: 14, minZoom: 6, maxZoom: 20, zoomSnap: 0.5 });
const trek = (id, maxN, o = {}) => L.tileLayer(`${TREK}/${id}/1.0.0/default/default028mm/{z}/{y}/{x}.${o.ext || 'png'}`,
  Object.assign({ maxNativeZoom: maxN, maxZoom: 20, noWrap: true, attribution: 'NASA/JPL-Caltech/UArizona/MSSS/ASU · Mars Trek' }, o));
trek('Mars_MGS_MOLA_ClrShade_merge_global_463m', 7, { ext: 'jpg' }).addTo(map);
const ctx = trek(M.ctx.id, M.ctx.maxN, { bounds: M.ctx.bounds }).addTo(map);
const hirise = trek(M.hirise.id, M.hirise.maxN, { bounds: M.hirise.bounds }).addTo(map);
// Elevation view: grayscale tiles if the mission has them; otherwise it is drawn from the computed grid.
let demLayer = M.dem.grayTiles ? trek(M.dem.grayTiles.id, M.dem.grayTiles.maxN, { opacity: 0.55, bounds: M.hirise.bounds }) : L.layerGroup();
const themis = trek('THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018', 9, { opacity: 0.6 });
map.fitBounds([[BBOX.s, BBOX.w], [BBOX.n, BBOX.e]]);
L.rectangle([[BBOX.s, BBOX.w], [BBOX.n, BBOX.e]], { color: '#fff', weight: 1, dashArray: '6 6', fill: false, interactive: false }).addTo(map);
L.control.scale({ imperial: false }).addTo(map); // note: Leaflet uses Earth's radius; the scale is approximate

$('l-hirise').onchange = () => hirise.addTo(map);
$('l-ctx').onchange = () => map.removeLayer(hirise);
const bindToggle = (id, layer) => $(id).addEventListener('change', e => e.target.checked ? layer.addTo(map) : map.removeLayer(layer));
$('l-dem').addEventListener('change', e => e.target.checked ? demLayer.addTo(map) : map.removeLayer(demLayer));
bindToggle('l-themis', themis);

// Mapped geologic unit at Jezero; it does not represent a confirmed sample location.
const geologyLayer = L.geoJSON(null, {
  style: { color: '#d7b56d', weight: 1.5, opacity: 0.65, fillColor: '#c79b4b', fillOpacity: 0.4 },
  onEachFeature: (feature, layer) => layer.bindPopup(
    '<b>NHjf₂ · Jezero fan 2</b><br>Mapped geologic unit; it does not represent a confirmed sample location.<br><i>Source: NHjf2_CTX.gpkg</i>'
  )
});
let geologyFeatures = null;
let geologyState = MISSION_ID === 'jezero' ? 'loading' : 'unavailable';
function pointInRing(point, ring) {
  const [x, y] = point; let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-10 && x >= Math.min(xi, xj) - 1e-10 && x <= Math.max(xi, xj) + 1e-10 && y >= Math.min(yi, yj) - 1e-10 && y <= Math.max(yi, yj) + 1e-10) return true;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInMultiPolygon(point, features) {
  return features.some(feature => {
    const geometry = feature.geometry;
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
    return polygons.some(polygon => pointInRing(point, polygon[0]) && !polygon.slice(1).some(hole => pointInRing(point, hole)));
  });
}
function geologyContextForStation(station) {
  if (MISSION_ID !== 'jezero') return '';
  if (geologyState === 'loading') return 'Loading NHjf₂ geologic context…';
  if (geologyState !== 'ready') return 'NHjf₂ geologic context unavailable.';
  const inside = pointInMultiPolygon([station.ll[1], station.ll[0]], geologyFeatures);
  return inside
    ? 'Inside the mapped NHjf₂ unit; this does not confirm a sample location.'
    : 'Outside / not assigned to NHjf₂; no other geologic unit is inferred.';
}
const geologyToggle = $('l-geology');
geologyToggle.closest('label').hidden = MISSION_ID !== 'jezero';
bindToggle('l-geology', geologyLayer);
if (MISSION_ID === 'jezero') {
  fetch('data/jezero-geology.geojson')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      geologyLayer.addData(data);
      geologyFeatures = data.features;
      geologyState = 'ready';
      renderStations();
    })
    .catch(error => {
      geologyState = 'unavailable';
      renderStations();
      console.warn('Could not load the Jezero geology layer:', error);
    });
}

// Rover: traverse and stops colored by measured tilt
const trav = L.polyline(ROVER.traverse, { color: '#ffffff', weight: 2, opacity: 0.8, dashArray: '4 4', interactive: false }).addTo(map);
const wpLayer = L.layerGroup().addTo(map);
ROVER.waypoints.filter(w => w[0] >= M.rover.sinceSol).forEach(w => {
  const col = w[4] > 15 ? '#ff5d5d' : w[4] > 8 ? '#ffd166' : '#3ddc97';
  L.circleMarker([w[1], w[2]], { radius: 4, color: '#000', weight: 1, fillColor: col, fillOpacity: 1 })
    .bindTooltip(`${M.rover.name} · sol ${w[0]}<br>Elevation ${w[3].toFixed(0)} m<br>Measured rover tilt ${w[4].toFixed(1)}°`).addTo(wpLayer);
});
const last = ROVER.waypoints[ROVER.waypoints.length - 1];
L.circleMarker([last[1], last[2]], { radius: 8, color: '#fff', weight: 2, fillColor: '#6cc4ff', fillOpacity: 1 })
  .bindTooltip(`${M.rover.name}, last published position (sol ${last[0]})`).addTo(wpLayer);
bindToggle('l-trav', trav); bindToggle('l-wp', wpLayer);

// ---------- Terrain: real elevation (Mars Trek ImageServer) → 10 m grid → slope ----------
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
// Asks the Trek image server for the area's elevation as 32-bit numbers (meters), without going through PNG.
// It is requested at twice the grid resolution and 2×2 blocks are averaged to reduce noise.
async function fetchElevation(nx, ny) {
  const k = 2, w = nx * k, h = ny * k;
  const e = BBOX.w + nx * CELL_DEG, s = BBOX.n - ny * CELL_DEG;
  const url = `${TREK_IMG}/${M.dem.service}/ImageServer/exportImage?bbox=${BBOX.w},${s},${e},${BBOX.n}` +
    `&size=${w},${h}&format=bsq&pixelType=F32&interpolation=RSP_BilinearInterpolation&f=image`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TERRAIN_TIMEOUT_MS);
  let buf;
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    buf = await r.arrayBuffer();
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error(`timed out (${TERRAIN_TIMEOUT_MS / 1000} s)`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  if (buf.byteLength < w * h * 4) throw new Error(`incomplete response (${buf.byteLength} bytes)`);
  const f = new Float32Array(buf.slice(0, w * h * 4));
  const raw = new Float32Array(nx * ny);
  for (let r0 = 0; r0 < ny; r0++) for (let c0 = 0; c0 < nx; c0++) {
    let sum = 0, n = 0;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
      const v = f[(r0 * k + a) * w + c0 * k + b];
      if (isFinite(v) && v > -12000 && v < 25000) { sum += v; n++; } // discards "no data"
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
// Elevation view drawn from the grid (for missions without grayscale elevation tiles)
function drawElevation() {
  if (M.dem.grayTiles) return;
  let lo = Infinity, hi = -Infinity; // loop: Math.min(...array) overflows the stack with >100,000 values
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

const SLOPE_CLASSES = [[8, '#3ddc97', 'Under 8°: comfortable'], [15, '#ffd166', '8–15°: with care'], [25, '#ff9b42', '15–25°: hard in a suit'], [90, '#ff5d5d', 'Over 25°: avoid']];
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

// ---------- Base, stops and obstacles ----------
const habW = nearestWaypoint(HAB_SOL);
let hab = L.marker([habW[1], habW[2]], { draggable: true, icon: L.divIcon({ className: 'hab-icon', iconSize: [22, 22] }) })
  .bindTooltip('Base / habitat', { permanent: true, direction: 'right', offset: [12, 0] }).addTo(map);
hab.on('dragend', () => { drawWalk(); schedulePlan(); });
const walkCircle = L.circle(hab.getLatLng(), { radius: 1, color: '#6cc4ff', weight: 1.5, dashArray: '8 6', fill: false, interactive: false }).addTo(map);
function drawWalk() { walkCircle.setLatLng(hab.getLatLng()); walkCircle.setRadius(+$('p-walk').value * 1000 * (6371 / MARS_R_KM)); } // Leaflet measures with Earth's radius
bindToggle('l-walk', walkCircle);

const usedWp = new Set();
const stations = STATION_DEFS.map((d, k) => {
  // the rover stop closest to that sol that has not been used yet
  const w = ROVER.waypoints.filter(x => !usedWp.has(x[0])).reduce((b, x) => Math.abs(x[0] - d.sol) < Math.abs(b[0] - d.sol) ? x : b);
  usedWp.add(w[0]);
  return Object.assign({}, d, { id: k, ll: [w[1], w[2]], src: `${M.rover.name} was here (sol ${w[0]})` });
});
const stLayer = L.layerGroup().addTo(map);
function renderStations() {
  stLayer.clearLayers();
  const box = $('stations'); box.innerHTML = '';
  stations.forEach((s, k) => {
    s.label = 'S' + (k + 1);
    const geologyContext = geologyContextForStation(s);
    const m = L.marker(s.ll, { draggable: true, opacity: s.on ? 1 : 0.45, icon: L.divIcon({ className: 'st-icon', html: s.label, iconSize: [26, 26] }) })
      .bindTooltip(`<b>${s.label} · ${s.name}</b><br>${s.obj}<br><i>${s.src}</i>${geologyContext ? `<br>${geologyContext}` : ''}`).addTo(stLayer);
    m.on('dragend', () => { const p = m.getLatLng(); s.ll = [p.lat, p.lng]; s.src = 'Moved by hand'; renderStations(); schedulePlan(); });
    const el = document.createElement('div'); el.className = 'st';
    el.innerHTML = `<input type="checkbox" id="st-${k}" ${s.on ? 'checked' : ''} aria-label="Include ${s.name}">
      <div><span class="n">${s.label} · ${s.name}</span></div><span class="t">${s.min} min</span>
      <div class="o">${s.obj}<br><i>${s.src}</i>${geologyContext ? `<br>${geologyContext}` : ''}</div>`;
    const go = document.createElement('button'); go.textContent = 'View'; go.onclick = () => map.setView(s.ll, 17);
    el.querySelector('.t').after(go); el.style.gridTemplateColumns = '22px 1fr auto auto';
    el.querySelector('input').onchange = e => { s.on = e.target.checked; renderStations(); schedulePlan(); };
    box.appendChild(el);
  });
}

const obstacles = []; const obsLayer = L.layerGroup().addTo(map);
function addObstacle(ll, r = 25) {
  obstacles.push({ ll, r });
  L.circle(ll, { radius: r * (6371 / MARS_R_KM), color: '#ff5d5d', weight: 2, fillOpacity: 0.35 }).bindTooltip(`Obstacle (${r} m radius)`).addTo(obsLayer);
}
$('clear-obs').onclick = () => { obstacles.length = 0; obsLayer.clearLayers(); schedulePlan(); };

let mode = 'pan';
const hints = { pan: 'Drag the green square to move the base. Drag the orange circles to move stops.',
  obs: 'Tap the map to mark a large rock or other obstacle (25 m radius). The route avoids it.',
  stop: 'Tap the map to add a science stop.' };
function setMode(m) { mode = m; ['pan', 'obs', 'stop'].forEach(k => $('m-' + k).setAttribute('aria-pressed', k === m)); $('mode-hint').textContent = hints[m]; $('map').classList.toggle('cross', m !== 'pan'); }
['pan', 'obs', 'stop'].forEach(k => $('m-' + k).onclick = () => setMode(k));
map.on('click', e => {
  const ll = [e.latlng.lat, e.latlng.lng];
  if (mode === 'obs') { addObstacle(ll); schedulePlan(); }
  if (mode === 'stop') { stations.push({ name: 'Added stop', obj: 'Objective to be defined by the crew.', min: 20, on: true, ll, src: 'Added on the map' }); renderStations(); schedulePlan(); setMode('pan'); }
});

// ---------- Import typed coordinates ----------
const inZone = p => p.lat > BBOX.s && p.lat < BBOX.n && p.lon > BBOX.w && p.lon < BBOX.e;
function importCoords(kind) {
  const msg = $('ci-msg');
  try {
    const r = parseCoordText($('coord-in').value);
    const pts = r.points.concat(r.lines.flatMap(l => l.coords.map(c => ({ lat: c[0], lon: c[1], name: l.name }))));
    const ok = pts.filter(inZone), out = pts.filter(p => !inZone(p));
    if (!ok.length) throw new Error(`No coordinate falls inside the exploration zone (latitude ${BBOX.s} to ${BBOX.n}, longitude ${BBOX.w} to ${BBOX.e}). The first one was ${pts[0].lat.toFixed(4)}, ${pts[0].lon.toFixed(4)}.`);
    if (kind === 'hab') { hab.setLatLng([ok[0].lat, ok[0].lon]); drawWalk(); }
    ok.forEach(p => {
      if (kind === 'stop') stations.push({ name: p.name || 'Imported stop', obj: 'Objective to be defined by the crew.', min: 20, on: true, ll: [p.lat, p.lon], src: `Imported: ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}` });
      if (kind === 'obs') addObstacle([p.lat, p.lon]);
    });
    if (kind === 'stop') renderStations();
    map.fitBounds(ok.map(p => [p.lat, p.lon]).concat([[hab.getLatLng().lat, hab.getLatLng().lng]]), { maxZoom: 17, padding: [40, 40] });
    schedulePlan();
    const what = { stop: 'stop(s)', obs: 'obstacle(s)', hab: 'base moved to the first coordinate' }[kind];
    msg.style.color = 'var(--ok)';
    msg.textContent = (kind === 'hab' ? 'Done: ' + what : `Added: ${ok.length} ${what}`) + '.' +
      (out.length ? ` ${out.length} coordinate(s) fell outside the zone and were not used.` : '') +
      (r.errors.length ? ` Lines with errors: ${r.errors.join(' · ')}` : '');
  } catch (e) { msg.style.color = 'var(--bad)'; msg.textContent = 'Could not import. ' + e.message; }
}
$('ci-stop').onclick = () => importCoords('stop');
$('ci-obs').onclick = () => importCoords('obs');
$('ci-hab').onclick = () => importCoords('hab');

// ---------- Planning (A* with walking-time cost) ----------
class Heap { constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) { let i = 0; for (;;) { let l = 2 * i + 1; if (l >= n) break; if (l + 1 < n && k[l + 1] < k[l]) l++; if (k[l] >= lk) break; k[i] = k[l]; v[i] = v[l]; i = l; } k[i] = lk; v[i] = lv; } return top; }
  get size() { return this.k.length; } }

function params() {
  return { maxSlope: +$('p-slope').value, v0: +$('p-speed').value, load: +$('p-load').value, eva: +$('p-eva').value, walk: +$('p-walk').value, start: +$('p-start').value };
}
// Suited walking speed: Tobler's hiking function normalized to flat-ground speed, reduced by the load.
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
$('o2-architecture').addEventListener('change', () => { if (lastPlan) renderConsumables(lastPlan.hours); });
function plan() {
  if (!T) return;
  const P = params(), B = blockedMask(), habLL = [hab.getLatLng().lat, hab.getLatLng().lng];
  routeLayer.clearLayers();
  const sel = stations.filter(s => s.on);
  const stops = [{ label: 'Base', name: 'Base', ll: habLL, min: 0 }, ...sel, { label: 'Base', name: 'Return to base', ll: habLL, min: 0 }];
  const legs = [], alerts = [];
  if (M.dem.coarse) alerts.push(['warn', 'Low-resolution terrain (HRSC + MOLA, 200 m): this route is preliminary; local relief and hazards are not validated. Review HiRISE and mark obstacles before using it.']);
  for (let k = 1; k < stops.length; k++) {
    const r = legPath(stops[k - 1].ll, stops[k].ll, P, B);
    if (!r) { alerts.push(['bad', `No walking path from ${stops[k - 1].label} to ${stops[k].label} with slopes up to ${P.maxSlope}° and the marked obstacles. Try raising the max slope or moving the stop.`]); legs.push(null); continue; }
    legs.push(Object.assign(r, { from: stops[k - 1], to: stops[k] }));
  }
  // Full traverse, profile and metrics
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
    // Draw segments colored by slope
    let seg = [cellLL(L_.cells[0])], col = slopeColor(T.S[L_.cells[0]] || 0);
    L_.cells.slice(1).forEach(c => { const cc = slopeColor(T.S[c] || 0), ll = cellLL(c); seg.push(ll);
      if (cc !== col) { L.polyline(seg, { color: col, weight: 5, opacity: 0.95 }).addTo(routeLayer); seg = [ll]; col = cc; } });
    L.polyline(seg, { color: col, weight: 5, opacity: 0.95 }).addTo(routeLayer);
    km += legKm; hours += L_.hours;
    const arrive = clock + L_.hours; clock = arrive + (L_.to.min || 0) / 60; hours += (L_.to.min || 0) / 60;
    rows.push(`<tr><td>${L_.from.label} → ${L_.to.label}</td><td class="r">${(legKm * 1000).toFixed(0)} m</td><td class="r">${fmtH(L_.hours)}</td><td class="r">${fmtClock(arrive)}</td><td class="r">${L_.to.min ? L_.to.min + ' min' : ''}</td></tr>`);
  });
  const reserve = P.eva - hours, dose = hours * RAD.mSvDay / 24;
  renderConsumables(hours);
  // Safety checks
  if (reserve < 0) alerts.push(['bad', `The EVA lasts ${fmtH(hours)} and exceeds the suit endurance (${P.eva} h). Remove stops or shorten their time.`]);
  else if (reserve < 1) alerts.push(['warn', `Only ${fmtH(reserve)} of reserve. At least 1 h is recommended for contingencies.`]);
  if (far > P.walk) alerts.push(['bad', `The route goes ${far.toFixed(2)} km from the base and exceeds the walk-back limit (${P.walk} km).`]);
  if (maxS > P.maxSlope * 0.85) alerts.push(['warn', `There are ${maxS.toFixed(0)}° segments, close to the ${P.maxSlope}° limit. Use poles and walk in single file.`]);
  if (sun && P.start + hours > sun.set - 0.5) alerts.push(['bad', `The EVA ends at ${fmtClock(P.start + hours)} and sunset is at ${fmtClock(sun.set)}. Leave earlier.`]);
  if (spaceWeather.level === 'bad') alerts.push(['bad', spaceWeather.msg]);
  else if (spaceWeather.level === 'warn') alerts.push(['warn', spaceWeather.msg]);
  if (!alerts.length) alerts.push(['ok', 'No alerts: the route respects slope, endurance, walk-back distance and daylight.']);
  $('alerts').innerHTML = alerts.map(a => `<div class="alert ${a[0]}">${a[1]}</div>`).join('');
  $('timeline').innerHTML = `<table><tr><th>Leg</th><th class="r">Dist.</th><th class="r">Walk</th><th class="r">Arrival</th><th class="r">Work</th></tr>${rows.join('')}</table>
    <div class="muted" style="margin-top:6px">Up ${up.toFixed(0)} m · down ${down.toFixed(0)} m · departure ${fmtClock(P.start)} · return ${fmtClock(P.start + hours)}</div>`;
  $('profile').innerHTML = profileSvg(prof);
  // Top bar
  const verdict = alerts.some(a => a[0] === 'bad') ? 'bad' : alerts.some(a => a[0] === 'warn') ? 'warn' : 'ok';
  $('verdict').className = verdict;
  $('verdict').textContent = verdict === 'bad' ? 'EVA NOT CLEARED' : M.dem.coarse ? 'PRELIMINARY ROUTE' : verdict === 'warn' ? 'EVA WITH CAUTION' : 'EVA CLEARED';
  setChip('c-time', fmtH(hours), hours > P.eva ? 'bad' : '');
  setChip('c-res', reserve >= 0 ? fmtH(reserve) : '−' + fmtH(-reserve), reserve < 0 ? 'bad' : reserve < 1 ? 'warn' : 'ok');
  setChip('c-dist', km.toFixed(2) + ' km');
  setChip('c-far', far.toFixed(2) + ' km', far > P.walk ? 'bad' : 'ok');
  setChip('c-slope', maxS.toFixed(0) + '°', maxS > P.maxSlope * 0.85 ? 'warn' : 'ok');
  setChip('c-dose', dose.toFixed(3) + ' mSv', spaceWeather.level === 'bad' ? 'bad' : '');
  $('rad').innerHTML = `<table>
    <tr><td>Surface rate (RAD, Curiosity, Gale)${M.rover.key !== 'curiosity' ? ' *' : ''}</td><td class="r">${RAD.mSvDay} mSv/day</td></tr>
    <tr><td>Dose for this EVA (${fmtH(hours)})</td><td class="r">${dose.toFixed(3)} mSv</td></tr>
    <tr><td>Share of NASA career limit (${RAD.careerLimit} mSv)</td><td class="r">${(100 * dose / RAD.careerLimit).toFixed(4)} %</td></tr></table>
    <div class="muted">The suit barely stops cosmic rays: the dose depends mostly on time outside. The acute risk is solar storms (SEP): after an alert, return to the base or shelter at the foot of a tall wall, which blocks part of the sky.${M.rover.key !== 'curiosity' ? `<br>* ${M.rover.name} carries no radiation detector: Curiosity's measurement is used as a reference. A higher site has less atmosphere overhead, so the real dose may be somewhat higher.` : ''}</div>`;
  lastPlan = { stops, legs, km, hours, dose, alerts };
}

function profileSvg(p, w = 320, h = 90) {
  if (p.length < 2) return '';
  const x1 = p[p.length - 1][0] || 1, ys = p.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), dy = (y1 - y0) || 1;
  const X = x => (x / x1) * w, Y = y => 8 + (1 - (y - y0) / dy) * (h - 16);
  const pts = p.map(q => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h + 14}" width="100%" role="img" aria-label="EVA elevation profile">
    <polygon points="0,${h - 8} ${pts} ${w},${h - 8}" fill="#f08a4b" fill-opacity=".18"/><polyline points="${pts}" fill="none" stroke="#f08a4b" stroke-width="1.6"/>
    <text x="0" y="10" font-size="10" fill="#a8968c">${y1.toFixed(0)} m</text><text x="0" y="${h + 10}" font-size="10" fill="#a8968c">${y0.toFixed(0)} m</text>
    <text x="${w}" y="${h + 10}" font-size="10" fill="#a8968c" text-anchor="end">${x1.toFixed(2)} km · elevation profile</text></svg>`;
}

// ---------- Parameters ----------
const outs = { 'p-slope': v => v + '°', 'p-speed': v => v + ' km/h', 'p-load': v => v + ' kg', 'p-eva': v => v + ' h', 'p-walk': v => v + ' km', 'p-start': v => fmtClock(+v) };
Object.keys(outs).forEach(id => $(id).addEventListener('input', e => { $('o-' + id.slice(2)).textContent = outs[id](e.target.value); if (id === 'p-walk') drawWalk(); schedulePlan(); }));
$('plan').onclick = plan;
$('copy').onclick = async () => {
  if (!lastPlan) return;
  const fc = { type: 'FeatureCollection', properties: { mission: 'Athenea · ' + M.name, duration_h: +lastPlan.hours.toFixed(2), distance_km: +lastPlan.km.toFixed(3), dose_mSv: +lastPlan.dose.toFixed(4) }, features: [] };
  lastPlan.stops.forEach(s => fc.features.push({ type: 'Feature', properties: { name: s.name, objective: s.obj || '', minutes: s.min }, geometry: { type: 'Point', coordinates: [s.ll[1], s.ll[0]] } }));
  lastPlan.legs.filter(Boolean).forEach(l => fc.features.push({ type: 'Feature', properties: { leg: `${l.from.label} → ${l.to.label}`, hours: +l.hours.toFixed(3) }, geometry: { type: 'LineString', coordinates: l.cells.map(c => { const ll = cellLL(c); return [+ll[1].toFixed(6), +ll[0].toFixed(6)]; }) } }));
  const txt = JSON.stringify(fc);
  try { await navigator.clipboard.writeText(txt); $('copy').textContent = 'Plan copied'; } catch { $('copy').textContent = 'Could not copy'; }
  setTimeout(() => $('copy').textContent = 'Copy plan (GeoJSON)', 2000);
};

// ---------- Space weather (DONKI, NASA) ----------
const spaceWeather = { level: 'unknown', msg: '' };
async function loadDonki() {
  const end = new Date(), start = new Date(end - 30 * 864e5), f = d => d.toISOString().slice(0, 10);
  try {
    const r = await fetch(`https://api.nasa.gov/DONKI/notifications?startDate=${f(start)}&endDate=${f(end)}&type=all&api_key=DEMO_KEY`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const list = await r.json();
    const names = { FLR: 'Solar flare', SEP: 'Solar energetic particles (SEP)', CME: 'Coronal mass ejection', IPS: 'Interplanetary shock', GST: 'Geomagnetic storm', RBE: 'Radiation belt enhancement (Earth)', MPC: 'Magnetopause crossing', Report: 'Weekly report' };
    const recentDays = d => (Date.now() - new Date(d)) / 864e5;
    const mars = list.filter(n => /\bMars\b/i.test(n.messageBody));
    const sepRecent = list.filter(n => n.messageType === 'SEP' && recentDays(n.messageIssueTime) < 3);
    const marsRecent = mars.filter(n => recentDays(n.messageIssueTime) < 5 && n.messageType !== 'Report');
    if (sepRecent.length) Object.assign(spaceWeather, { level: 'bad', msg: 'Solar energetic particle (SEP) alert in the last 3 days. Suspend the EVA until levels are confirmed with RAD.' });
    else if (marsRecent.length) Object.assign(spaceWeather, { level: 'warn', msg: `DONKI mentions Mars in ${marsRecent.length} notification(s) from the last 5 days (possible ejection toward Mars). Plan a short EVA close to the base.` });
    else Object.assign(spaceWeather, { level: 'ok', msg: 'No recent solar events directed at Mars.' });
    setChip('c-sw', { ok: 'Quiet', warn: 'Watch', bad: 'Alert' }[spaceWeather.level], spaceWeather.level);
    const counts = {}; list.forEach(n => counts[n.messageType] = (counts[n.messageType] || 0) + 1);
    $('donki').innerHTML = `<div class="alert ${spaceWeather.level}">${spaceWeather.msg}</div>
      <div style="margin-top:6px">DONKI notifications in the last 30 days: ${Object.entries(counts).map(([k, v]) => `${names[k] || k}: <b>${v}</b>`).join(' · ')}</div>
      <div style="margin-top:6px">${list.filter(n => n.messageType !== 'Report').slice(-5).reverse().map(n => `<div class="ev"><b>${n.messageIssueTime.slice(0, 16).replace('T', ' ')}</b> · ${names[n.messageType] || n.messageType}${/\bMars\b/i.test(n.messageBody) ? ' · <b style="color:var(--warn)">mentions Mars</b>' : ''} · <a href="${n.messageURL}" target="_blank" style="color:var(--info)">view</a></div>`).join('')}</div>
      <div class="muted" style="margin-top:6px">DONKI is Earth-centered; for Mars it only serves as an early warning. A real mission would use real-time RAD monitoring.</div>`;
  } catch (e) {
    Object.assign(spaceWeather, { level: 'warn', msg: 'Could not query DONKI. No space weather data: confirm with mission control before going out.' });
    setChip('c-sw', 'No data', 'warn'); $('donki').innerHTML = `<div class="alert warn">${spaceWeather.msg} (${e.message})</div>`;
  }
  schedulePlan();
}

// ---------- Weather (Curiosity's REMS or Perseverance's MEDA) ----------
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
    const s = W.pick(await r.json()); if (!s) throw new Error('the feed has no data');
    const hm = t => { const [a, b] = t.split(':').map(Number); return a + b / 60; }, hhmm = t => t.slice(0, 5);
    const num = v => typeof v === 'number' ? v.toFixed(0) : v;
    sun = { rise: hm(s.sunrise), set: hm(s.sunset) };
    setChip('c-sun', `${hhmm(s.sunrise)}–${hhmm(s.sunset)}`, 'ok');
    const uv = s.local_uv_irradiance_index ? `<tr><td>UV radiation</td><td class="r">${({ Low: 'Low', Moderate: 'Moderate', High: 'High', 'Very_High': 'Very high', 'Very High': 'Very high' })[s.local_uv_irradiance_index] || s.local_uv_irradiance_index}</td></tr>` : '';
    const ground = s.min_gts_temp && s.min_gts_temp !== '--' ? `<tr><td>Ground temperature</td><td class="r">${s.min_gts_temp} to ${s.max_gts_temp} °C</td></tr>` : '';
    const sky = s.atmo_opacity ? `<tr><td>Sky</td><td class="r">${s.atmo_opacity === 'Sunny' ? 'Clear' : s.atmo_opacity}</td></tr>` : '';
    $('rems').innerHTML = `<table>
      <tr><td>Latest sol with data</td><td class="r">${s.sol} (${s.terrestrial_date})</td></tr>
      <tr><td>Air temperature</td><td class="r">${num(s.min_temp)} to ${num(s.max_temp)} °C</td></tr>
      ${ground}<tr><td>Pressure</td><td class="r">${num(s.pressure)} Pa</td></tr>${uv}${sky}
      <tr><td>Sunrise / sunset</td><td class="r">${hhmm(s.sunrise)} / ${hhmm(s.sunset)}</td></tr></table>
      <div class="muted">Source: ${W.src}. The public feed carries the latest processed sol (${s.terrestrial_date}), not today's weather.</div>`;
  } catch (e) { $('rems').innerHTML = `<div class="alert warn">Could not query the weather (${e.message}).</div>`; setChip('c-sun', 'No data', 'warn'); }
  schedulePlan();
}

// ---------- Startup ----------
renderStations(); drawWalk();
loadDonki(); loadWeather();
(async () => {
  const t0 = performance.now();
  $('verdict').textContent = 'LOADING TERRAIN…';
  try { T = await buildTerrain(); }
  catch (e) {
    $('verdict').className = 'bad'; $('verdict').textContent = 'NO TERRAIN';
    $('alerts').innerHTML = `<div class="alert bad">Could not download the elevation from Mars Trek (${e.message}). Without terrain a safe route cannot be computed.</div>`;
    return;
  }
  drawSlope(); drawElevation();
  // Validation against what the rover measured at its stops inside the zone: height and tilt
  const inside = ROVER.waypoints.filter(w => w[1] > BBOX.s && w[1] < BBOX.n && w[2] > BBOX.w && w[2] < BBOX.e);
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const pairs = inside.map(w => [T.S[cellOf([w[1], w[2]])], w[4]]).filter(p => !isNaN(p[0]));
  const ePairs = inside.map(w => [T.E[cellOf([w[1], w[2]])], w[3]]).filter(p => !isNaN(p[0]));
  const eBias = mean(ePairs.map(p => p[0] - p[1])), eErr = mean(ePairs.map(p => Math.abs(p[0] - p[1] - eBias)));
  const mae = mean(pairs.map(p => Math.abs(p[0] - p[1])));
  const mx = mean(pairs.map(p => p[0])), my = mean(pairs.map(p => p[1]));
  const cov = mean(pairs.map(p => (p[0] - mx) * (p[1] - my))), sx = Math.sqrt(mean(pairs.map(p => (p[0] - mx) ** 2))), sy = Math.sqrt(mean(pairs.map(p => (p[1] - my) ** 2)));
  const slopeCorrelation = cov / (sx * sy);
  const slopeCorrelationText = Number.isFinite(slopeCorrelation) ? slopeCorrelation.toFixed(2) : 'No data';
  $('quality').innerHTML = `<table>
    <tr><td>Elevation source</td><td class="r">${M.dem.label}</td></tr>
    ${M.dem.coarse ? `<tr><td>Native terrain resolution</td><td class="r">≈200 m/pixel</td></tr>` : ''}
    <tr><td>Route calculation step</td><td class="r">${T.nx}×${T.ny} cells of ${CELL_M} m${M.dem.coarse ? ' (interpolated)' : ''}</td></tr>
    <tr><td>Cells without data</td><td class="r">${T.missing}</td></tr>
    <tr><td>Points compared with ${M.rover.name}</td><td class="r">${pairs.length}</td></tr>
    <tr><td>Height: mean bias / MAE without bias</td><td class="r">${eBias.toFixed(1)} m / ${eErr.toFixed(1)} m</td></tr>
    <tr><td>Mean tilt: terrain / rover</td><td class="r">${mx.toFixed(1)}° / ${my.toFixed(1)}°</td></tr>
    <tr><td>Mean tilt difference</td><td class="r">${mae.toFixed(1)}°</td></tr>
    <tr><td>Terrain–rover linear correlation (−1 to 1)</td><td class="r">${slopeCorrelationText}</td></tr>
    <tr><td>Preparation time</td><td class="r">${((performance.now() - t0) / 1000).toFixed(1)} s</td></tr></table>
    <div class="muted">${M.dem.coarse
      ? '<b>Quality reading:</b> the source has a native resolution of ~200 m; the 10 m grid only interpolates that data and adds no detail. It is useful for regional context and preliminary planning, not for detecting rocks, steps or local slopes. The comparison with the rover is indicative, not an independent safety validation.'
      : 'The rover tilt includes rocks and local undulations that may not appear in the model. The comparison is indicative and is not an independent safety validation.'}
      The correlation summarizes the linear relationship across ${pairs.length} compared points; a value near 0 means this sample shows no clear linear relationship. It does not prove the route is safe or unsafe.</div>`;
  window.__quality = { mae, n: pairs.length, mx, my, r: slopeCorrelation, eBias, eErr };
  plan();
})();
