// Ruta sugerida: A* sobre una grilla de elevación MOLA, con costo por pendiente y preferencia por agua/hielo.
// Depende de agua.js (WATER_ZONES, VALLEY_SAMPLES, wHav, wInPoly, W_DEG_KM).

// --- Elevación: capa MOLA de 8 bits de Mars Trek (PNG en escala de grises, CORS abierto, zoom máx. 5 ≈ 1,3 km/píxel).
// Calibración lineal hecha en la prueba contra alturas conocidas (Olympus, Arsia, Hellas, Jezero): error ~±500 m.
const DEM_URL = 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_DEM_mosaic_global_463m_8/1.0.0/default/default028mm';
const DEM_MAXZ = 5;
const DEM_M_PER_DN = 123.6;
const DEM_OFFSET_M = -9065;
const dnToM = v => DEM_OFFSET_M + v * DEM_M_PER_DN;

const demTiles = new Map();
function demTile(z, x, y) {
  const key = `${z}/${y}/${x}`;
  if (!demTiles.has(key)) demTiles.set(key, new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, 256, 256).data, out = new Uint8Array(65536);
      for (let i = 0; i < 65536; i++) out[i] = d[i * 4];
      resolve(out);
    };
    img.onerror = () => resolve(null);
    img.src = `${DEM_URL}/${z}/${y}/${x}.png`;
  }));
  return demTiles.get(key);
}
function demPixel(z, lat, lon) {
  const W = 256 * 2 ** (z + 1), H = W / 2;
  const gx = Math.min(W - 1, Math.max(0, Math.floor((lon + 180) / 360 * W)));
  const gy = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / 180 * H)));
  return { tx: gx >> 8, ty: gy >> 8, i: (gy & 255) * 256 + (gx & 255) };
}
async function elevationAt(lat, lon) {
  const p = demPixel(DEM_MAXZ, lat, lon), t = await demTile(DEM_MAXZ, p.tx, p.ty);
  return t ? dnToM(t[p.i]) : NaN;
}

// --- Grilla ---
function buildGridSpec(a, b) {
  const span = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  const pad = Math.max(1, span * 0.35);
  const latMin = Math.max(-85, Math.min(a[0], b[0]) - pad), latMax = Math.min(85, Math.max(a[0], b[0]) + pad);
  const lonMin = Math.max(-180, Math.min(a[1], b[1]) - pad), lonMax = Math.min(180, Math.max(a[1], b[1]) + pad);
  const demDeg = 360 / (256 * 2 ** (DEM_MAXZ + 1));
  const cell = Math.max(demDeg, Math.max(latMax - latMin, lonMax - lonMin) / 260);
  let z = DEM_MAXZ;
  while (z > 0 && 360 / (256 * 2 ** z) <= cell) z--; // zoom más bajo que todavía tiene ≥1 píxel por celda
  const nx = Math.ceil((lonMax - lonMin) / cell), ny = Math.ceil((latMax - latMin) / cell);
  return { latMin, latMax, lonMin, lonMax, cell, nx, ny, z };
}
const cellLat = (g, r) => g.latMax - (r + 0.5) * g.cell;
const cellLon = (g, c) => g.lonMin + (c + 0.5) * g.cell;

async function loadElevations(g) {
  const raw = new Float32Array(g.nx * g.ny), need = new Map();
  const pix = [];
  for (let r = 0; r < g.ny; r++) for (let c = 0; c < g.nx; c++) {
    const p = demPixel(g.z, cellLat(g, r), cellLon(g, c)); pix.push(p);
    const k = p.tx + ',' + p.ty; if (!need.has(k)) need.set(k, demTile(g.z, p.tx, p.ty));
  }
  const tiles = new Map(); for (const [k, pr] of need) tiles.set(k, await pr);
  let missing = 0;
  pix.forEach((p, i) => { const t = tiles.get(p.tx + ',' + p.ty); if (t) raw[i] = dnToM(t[p.i]); else { raw[i] = NaN; missing++; } });
  // Suavizado 3x3 para atenuar los escalones de 124 m de la cuantización de 8 bits.
  const e = new Float32Array(raw.length);
  for (let r = 0; r < g.ny; r++) for (let c = 0; c < g.nx; c++) {
    let s = 0, n = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= g.ny || cc >= g.nx) continue;
      const v = raw[rr * g.nx + cc]; if (!isNaN(v)) { s += v; n++; }
    }
    e[r * g.nx + c] = n ? s / n : NaN;
  }
  return { elev: e, tiles: need.size, missing };
}

const ATTRACT = { hielo: 1, radar: 0.9, pasada: 0.6, debatido: 0.4, valle: 0.7 };
function buildAttraction(g, bufKm) {
  const at = new Float32Array(g.nx * g.ny);
  WATER_ZONES.forEach(z => {
    const lats = z.poly.map(p => p[0]), lons = z.poly.map(p => p[1]);
    const r0 = Math.max(0, Math.floor((g.latMax - Math.max(...lats)) / g.cell)), r1 = Math.min(g.ny - 1, Math.ceil((g.latMax - Math.min(...lats)) / g.cell));
    const c0 = Math.max(0, Math.floor((Math.min(...lons) - g.lonMin) / g.cell)), c1 = Math.min(g.nx - 1, Math.ceil((Math.max(...lons) - g.lonMin) / g.cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++)
      if (wInPoly([cellLat(g, r), cellLon(g, c)], z.poly)) at[r * g.nx + c] = Math.max(at[r * g.nx + c], ATTRACT[z.cat]);
  });
  const bufDeg = bufKm / W_DEG_KM;
  VALLEY_SAMPLES.forEach(q => {
    const [lat, lon] = q.p;
    if (lat < g.latMin - bufDeg || lat > g.latMax + bufDeg) return;
    const lonBuf = bufDeg / Math.max(0.1, Math.cos(lat * Math.PI / 180));
    if (lon < g.lonMin - lonBuf || lon > g.lonMax + lonBuf) return;
    const r0 = Math.max(0, Math.floor((g.latMax - lat - bufDeg) / g.cell)), r1 = Math.min(g.ny - 1, Math.ceil((g.latMax - lat + bufDeg) / g.cell));
    const c0 = Math.max(0, Math.floor((lon - lonBuf - g.lonMin) / g.cell)), c1 = Math.min(g.nx - 1, Math.ceil((lon + lonBuf - g.lonMin) / g.cell));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const i = r * g.nx + c; if (at[i] >= ATTRACT.valle) continue;
      if (wHav([cellLat(g, r), cellLon(g, c)], q.p) <= bufKm) at[i] = ATTRACT.valle;
    }
  });
  return at;
}

// --- A* con montículo binario ---
class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) { const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i > 0) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; } k[i] = key; v[i] = val; }
  pop() { const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(); const n = k.length;
    if (n) { let i = 0; while (true) { let l = 2 * i + 1; if (l >= n) break; const r = l + 1; if (r < n && k[r] < k[l]) l = r; if (k[l] >= lk) break; k[i] = k[l]; v[i] = v[l]; i = l; } k[i] = lk; v[i] = lv; }
    return top; }
  get size() { return this.k.length; }
}

async function suggestRoute(a, b, opts) {
  const t0 = performance.now();
  const g = buildGridSpec(a, b);
  const { elev, tiles, missing } = await loadElevations(g);
  if (missing === elev.length) throw new Error('No se pudieron descargar los datos de elevación de Mars Trek.');
  const attr = buildAttraction(g, opts.bufKm);
  const N = g.nx * g.ny, toIdx = p => {
    const r = Math.min(g.ny - 1, Math.max(0, Math.floor((g.latMax - p[0]) / g.cell)));
    const c = Math.min(g.nx - 1, Math.max(0, Math.floor((p[1] - g.lonMin) / g.cell)));
    return r * g.nx + c;
  };
  const s = toIdx(a), t = toIdx(b), goal = [cellLat(g, Math.floor(t / g.nx)), cellLon(g, t % g.nx)];
  const gs = new Float64Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const maxTan = Math.tan(opts.maxSlopeDeg * Math.PI / 180), pref = opts.waterPref;
  const h = i => wHav([cellLat(g, (i / g.nx) | 0), cellLon(g, i % g.nx)], goal) * (1 - pref);
  const heap = new Heap(); gs[s] = 0; heap.push(h(s), s);
  const D = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  let expanded = 0;
  while (heap.size) {
    const i = heap.pop(); if (closed[i]) continue; closed[i] = 1; expanded++;
    if (i === t) break;
    const r = (i / g.nx) | 0, c = i % g.nx, la = cellLat(g, r), lo = cellLon(g, c);
    for (const [dr, dc] of D) {
      const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= g.ny || cc >= g.nx) continue;
      const j = rr * g.nx + cc; if (closed[j] || isNaN(elev[j])) continue;
      const d = wHav([la, lo], [cellLat(g, rr), cellLon(g, cc)]);
      const tan = Math.abs(elev[j] - elev[i]) / (d * 1000);
      if (tan > maxTan) continue;
      const cost = d * (1 + 3 * (tan / maxTan) ** 2) * (1 - pref * attr[j]);
      const ng = gs[i] + cost;
      if (ng < gs[j]) { gs[j] = ng; came[j] = i; heap.push(ng + h(j), j); }
    }
  }
  if (came[t] === -1 && s !== t) throw new Error(`No hay camino con pendientes de hasta ${opts.maxSlopeDeg}°. Probá con un valor mayor.`);
  const cells = []; for (let i = t; i !== -1; i = came[i]) cells.push(i); cells.reverse();
  const path = cells.map(i => [cellLat(g, (i / g.nx) | 0), cellLon(g, i % g.nx)]);
  path[0] = a; path[path.length - 1] = b;
  // Perfil y estadísticas sobre la grilla
  const prof = []; let dist = 0, up = 0, down = 0, maxSl = 0;
  cells.forEach((ci, k) => {
    if (k) { const p0 = path[k - 1], p1 = path[k], dd = wHav(p0, p1), dh = elev[ci] - elev[cells[k - 1]];
      dist += dd; if (dh > 0) up += dh; else down -= dh; maxSl = Math.max(maxSl, Math.atan(Math.abs(dh) / (dd * 1000)) * 180 / Math.PI); }
    prof.push([dist, elev[ci]]);
  });
  return {
    path: simplifyPath(path, g.cell * 0.6), profile: prof,
    stats: { km: dist, up, down, maxSlope: maxSl, cellKm: g.cell * W_DEG_KM, grid: `${g.nx}×${g.ny}`, zoom: g.z, tiles, expanded, ms: performance.now() - t0 },
  };
}

// Douglas–Peucker en grados (suficiente para simplificar la polilínea de la grilla).
function simplifyPath(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i0, i1] = stack.pop(), [y0, x0] = pts[i0], [y1, x1] = pts[i1];
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1e-12;
    let best = -1, bi = -1;
    for (let i = i0 + 1; i < i1; i++) { const d = Math.abs(dy * (pts[i][1] - x0) - dx * (pts[i][0] - y0)) / len; if (d > best) { best = d; bi = i; } }
    if (best > tol) { keep[bi] = 1; stack.push([i0, bi], [bi, i1]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function profileSvg(profile, w = 268, h = 70) {
  if (profile.length < 2) return '';
  const xs = profile.map(p => p[0]), ys = profile.map(p => p[1]);
  const x1 = xs[xs.length - 1] || 1, y0 = Math.min(...ys), y1 = Math.max(...ys), dy = (y1 - y0) || 1;
  const pad = 14, X = x => (x / x1) * w, Y = y => pad / 2 + (1 - (y - y0) / dy) * (h - pad);
  const line = profile.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h + 12}" width="100%" role="img" aria-label="Perfil de elevación">
    <polygon points="0,${h - pad / 2} ${line} ${w},${h - pad / 2}" fill="var(--accent)" fill-opacity="0.18"/>
    <polyline points="${line}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
    <text x="0" y="${pad / 2 + 2}" font-size="10" fill="var(--muted)">${(y1 / 1000).toFixed(1)} km</text>
    <text x="0" y="${h + 8}" font-size="10" fill="var(--muted)">${(y0 / 1000).toFixed(1)} km</text>
    <text x="${w}" y="${h + 8}" font-size="10" fill="var(--muted)" text-anchor="end">${x1.toFixed(0)} km recorridos</text>
  </svg>`;
}
