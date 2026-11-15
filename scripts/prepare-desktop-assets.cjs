const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '..', 'node_modules', 'leaflet', 'dist');
const destination = path.resolve(__dirname, '..', 'vendor', 'leaflet');
const required = ['leaflet.js', 'leaflet.css', 'images'];

for (const item of required) {
  if (!fs.existsSync(path.join(source, item))) {
    throw new Error(`Leaflet asset missing: ${item}. Run npm install first.`);
  }
}

fs.mkdirSync(destination, { recursive: true });
for (const item of required) {
  fs.cpSync(path.join(source, item), path.join(destination, item), { recursive: true });
}
console.log('Prepared local Leaflet assets in vendor/leaflet.');
