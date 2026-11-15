// Coordinate reader: accepts GeoJSON or text with one coordinate per line.
// Accepted text formats (one per line, with an optional name before or after):
//   -4.80, 137.39            (latitude, longitude)
//   -4.80 137.39
//   -4,80; 137,39            (decimal comma, separated by semicolon)
//   4.80S 137.39E            (with hemisphere: N/S for latitude, E/W for longitude, in any order)
//   4°48'S 137°23'24"E       (degrees, minutes, seconds)
//   Base: -4.80, 137.39
// Without hemisphere letters, "latitude, longitude" is assumed. If the first value cannot be a latitude (|x| > 90),
// it is read as "longitude, latitude". Longitudes 0–360 are converted to ±180.
// "O" (oeste) is still accepted as West so coordinates written in Spanish keep working.

function parseCoordText(text) {
  const t = (text || '').trim();
  if (!t) throw new Error('Nothing to import. Type a coordinate such as: -4.80, 137.39');
  if (t[0] === '{') return parseGeoJSONText(t);
  const points = [], errors = [];
  t.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim(); if (!line || line.startsWith('#')) return;
    try { points.push(parseCoordLine(line)); } catch (e) { errors.push(`Line ${n + 1} ("${line}"): ${e.message}`); }
  });
  if (!points.length && errors.length) throw new Error(errors.join('\n'));
  return { points, lines: [], errors };
}

function parseCoordLine(line) {
  // Split off an optional name: "Name: coords" or text before/after the numbers.
  let name = '';
  const colon = line.match(/^([^:\d\-+]+):\s*(.+)$/);
  if (colon) { name = colon[1].trim(); line = colon[2]; }
  // Decimal comma: "-4,80; 137,39" or "-4,80 137,39"
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
  if (vals.length < 2) throw new Error('two numbers are needed (latitude and longitude). Example: -4.80, 137.39');
  if (!name) name = (line.slice(0, firstIdx) + ' ' + line.slice(lastIdx)).replace(/[,;:()]/g, ' ').trim();
  let lat, lon;
  const isLat = h => h === 'N' || h === 'S', isLon = h => h === 'E' || h === 'O' || h === 'W';
  if (isLon(vals[0].h) || isLat(vals[1].h)) { lon = vals[0].v; lat = vals[1].v; }
  else if (isLat(vals[0].h) || isLon(vals[1].h)) { lat = vals[0].v; lon = vals[1].v; }
  else if (Math.abs(vals[0].v) > 90 && Math.abs(vals[1].v) <= 90) { lon = vals[0].v; lat = vals[1].v; }
  else { lat = vals[0].v; lon = vals[1].v; }
  if (Math.abs(lat) > 90) throw new Error(`latitude ${lat} is out of range (−90 to 90)`);
  if (lon > 180 && lon <= 360) lon -= 360;
  if (Math.abs(lon) > 180) throw new Error(`longitude ${lon} is out of range (−180 to 180 or 0 to 360)`);
  return { lat, lon, name };
}

function parseGeoJSONText(t) {
  let g;
  try { g = JSON.parse(t); } catch (e) { throw new Error('The text starts with "{" but is not valid GeoJSON: ' + e.message); }
  const feats = g.type === 'FeatureCollection' ? g.features : g.type === 'Feature' ? [g] : [{ type: 'Feature', properties: {}, geometry: g }];
  const points = [], lines = [];
  (feats || []).forEach(f => {
    // "nombre" is still read so plans exported by the earlier Spanish version keep importing.
    const geom = f && f.geometry, name = (f.properties && (f.properties.name || f.properties.nombre)) || '';
    if (!geom) return;
    if (geom.type === 'Point') points.push({ lon: geom.coordinates[0], lat: geom.coordinates[1], name });
    if (geom.type === 'MultiPoint') geom.coordinates.forEach(c => points.push({ lon: c[0], lat: c[1], name }));
    if (geom.type === 'LineString') lines.push({ name, coords: geom.coordinates.map(c => [c[1], c[0]]) });
    if (geom.type === 'MultiLineString') geom.coordinates.forEach(l => lines.push({ name, coords: l.map(c => [c[1], c[0]]) }));
  });
  if (!points.length && !lines.length) throw new Error('The GeoJSON has no points or lines.');
  return { points, lines, errors: [] };
}
