const { app, BrowserWindow, net, protocol, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const scheme = 'appathenea';
const appRoot = path.resolve(__dirname, '..');
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://trek.nasa.gov",
  "connect-src 'self' https://trek.nasa.gov https://api.nasa.gov https://mars.nasa.gov",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

protocol.registerSchemesAsPrivileged([{
  scheme,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

function resolveAppFile(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== `${scheme}:` || parsed.hostname !== 'app') return null;
  let decoded;
  try { decoded = decodeURIComponent(parsed.pathname); } catch { return null; }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^[/\\]+/, '');
  const candidate = path.resolve(appRoot, relative);
  if (candidate !== appRoot && !candidate.startsWith(`${appRoot}${path.sep}`)) return null;
  return candidate;
}

async function serveAppFile(request) {
  const filePath = resolveAppFile(request.url);
  if (!filePath) return new Response('Not found', { status: 404 });
  try {
    const data = await fs.promises.readFile(filePath);
    const headers = new Headers({
      'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': contentSecurityPolicy,
      'Cache-Control': 'no-store',
    });
    return new Response(data, { headers });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) shell.openExternal(parsed.href);
  } catch { /* Ignore malformed or unsafe external URLs. */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    backgroundColor: '#0f0d0c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${scheme}://app/`)) event.preventDefault();
  });
  win.loadURL(`${scheme}://app/mission.html?m=jezero`);
}

app.whenReady().then(() => {
  protocol.handle(scheme, serveAppFile);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', event => event.preventDefault());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
