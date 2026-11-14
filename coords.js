// Lector de coordenadas: acepta GeoJSON o texto con una coordenada por línea.
// Formatos de texto aceptados (una por línea, con nombre opcional antes o después):
//   -4.80, 137.39            (latitud, longitud)
//   -4.80 137.39
//   -4,80; 137,39            (coma decimal, separado por punto y coma)
//   4.80S 137.39E            (con hemisferio: N/S para latitud, E/O/W para longitud, en cualquier orden)
//   4°48'S 137°23'24"E       (grados, minutos, segundos)
//   Base: -4.80, 137.39
// Sin letras de hemisferio se asume "latitud, longitud". Si el primer valor no puede ser latitud (|x| > 90),
// se interpreta como "longitud, latitud". Las longitudes 0–360 se pasan a ±180.

function parseCoordText(text) {
  const t = (text || '').trim();
  if (!t) throw new Error('No hay nada para importar. Escribí una coordenada como: -4.80, 137.39');
  if (t[0] === '{') return parseGeoJSONText(t);
  const points = [], errors = [];
  t.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim(); if (!line || line.startsWith('#')) return;
    try { points.push(parseCoordLine(line)); } catch (e) { errors.push(`Línea ${n + 1} ("${line}"): ${e.message}`); }
  });
  if (!points.length && errors.length) throw new Error(errors.join('\n'));
  return { points, lines: [], errors };
}

function parseCoordLine(line) {
  // Separar un nombre opcional: "Nombre: coords" o texto antes/después de los números.
  let name = '';
  const colon = line.match(/^([^:\d\-+]+):\s*(.+)$/);
  if (colon) { name = colon[1].trim(); line = colon[2]; }
  // Coma decimal: "-4,80; 137,39" o "-4,80 137,39"
  if (/;/.test(line) || /^\s*-?\d+,\d+\s+-?\d+,\d+\s*$/.test(line)) line = line.replace(/(\d),(\d)/g, '$1.$2').replace(/;/g, ',');
  const re = /([+-]?\d+(?:\.\d+)?)\s*(?:°|º|d)?\s*(?:(\d+(?:\.\d+)?)\s*['’′m])?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|”|″|''|s(?![a-z])))?\s*([NSEOW])?(?![a-z])/gi;
  const vals = []; let m, firstIdx = -1, lastIdx = 0;
  while ((m = re.exec(line)) && vals.length < 2) {
    if (m[0].trim() === '') { re.lastIndex++; continue; }
    if (firstIdx < 0) firstIdx = m.index; lastIdx = m.index + m[0].length;
    let v = Math.abs(parseFloat(m[1])) + (m[2] ? parseFloat(m[2]) / 60 : 0) + (m[3] ? parseFloat(m[3]) / 3600 : 0);
    if (/^-/.test(m[1])) v = -v;
    const h = m[4] ? m[4].toUpperCase() : '';
    if (h === 'S' || h === 'O' || h === 'W') v = -Math.abs(v);
    vals.push({ v, h });
  }
  if (vals.length < 2) throw new Error('hacen falta dos números (latitud y longitud). Ejemplo: -4.80, 137.39');
  if (!name) name = (line.slice(0, firstIdx) + ' ' + line.slice(lastIdx)).replace(/[,;:()]/g, ' ').trim();
  let lat, lon;
  const isLat = h => h === 'N' || h === 'S', isLon = h => h === 'E' || h === 'O' || h === 'W';
  if (isLon(vals[0].h) || isLat(vals[1].h)) { lon = vals[0].v; lat = vals[1].v; }
  else if (isLat(vals[0].h) || isLon(vals[1].h)) { lat = vals[0].v; lon = vals[1].v; }
  else if (Math.abs(vals[0].v) > 90 && Math.abs(vals[1].v) <= 90) { lon = vals[0].v; lat = vals[1].v; }
  else { lat = vals[0].v; lon = vals[1].v; }
  if (Math.abs(lat) > 90) throw new Error(`la latitud ${lat} está fuera de rango (−90 a 90)`);
  if (lon > 180 && lon <= 360) lon -= 360;
  if (Math.abs(lon) > 180) throw new Error(`la longitud ${lon} está fuera de rango (−180 a 180 o 0 a 360)`);
  return { lat, lon, name };
}

function parseGeoJSONText(t) {
  let g;
  try { g = JSON.parse(t); } catch (e) { throw new Error('El texto empieza con "{" pero no es un GeoJSON válido: ' + e.message); }
  const feats = g.type === 'FeatureCollection' ? g.features : g.type === 'Feature' ? [g] : [{ type: 'Feature', properties: {}, geometry: g }];
  const points = [], lines = [];
  (feats || []).forEach(f => {
    const geom = f && f.geometry, name = (f.properties && (f.properties.name || f.properties.nombre)) || '';
    if (!geom) return;
    if (geom.type === 'Point') points.push({ lon: geom.coordinates[0], lat: geom.coordinates[1], name });
    if (geom.type === 'MultiPoint') geom.coordinates.forEach(c => points.push({ lon: c[0], lat: c[1], name }));
    if (geom.type === 'LineString') lines.push({ name, coords: geom.coordinates.map(c => [c[1], c[0]]) });
    if (geom.type === 'MultiLineString') geom.coordinates.forEach(l => lines.push({ name, coords: l.map(c => [c[1], c[0]]) }));
  });
  if (!points.length && !lines.length) throw new Error('El GeoJSON no tiene puntos ni líneas.');
  return { points, lines, errors: [] };
}
