# AppAthenea for Windows

AppAthenea can run in a secure local Electron window or as the existing static browser demo. It does not need a local web server once Electron and its dependencies are installed.

## Set up and run

Install Node.js 20.19+ or 22.12+, then from this folder run:

```powershell
npm install
npm start
```

`npm install` needs Internet access the first time to obtain Electron, Leaflet, and the Windows packaging tools. `npm start` copies Leaflet into the local `vendor/leaflet` directory and opens the Jezero EVA planner. Once installed, the application shell and bundled mission datasets load from disk. Other mission profiles remain in the code for future expansion but are not offered in the current interface.

## Build a Windows installer

```powershell
npm run package:win
```

The Windows NSIS installer is written to `dist/`. Packaging downloads Electron's runtime if it is not already cached; it is not a self-contained offline build from a clean machine.

## What works offline

- The application shell, controls, mission-planning code, local rover datasets, and the Jezero geology GeoJSON are bundled locally.
- The Leaflet library is copied locally during setup and included in the installer. The static browser demo also uses that local copy after setup.
- When Windows reports no network, the pages show a clear notice. The mission page retains its existing fallback behavior when terrain, weather, or space-weather requests fail.

## What still needs Internet

- NASA Mars Trek map tiles and terrain elevation tiles are requested from `trek.nasa.gov`; these are NOT bundled or available offline.
- Jezero routes use a native ~200 m HRSC + MOLA elevation model. The 10 m calculation grid interpolates that data; routes are preliminary estimates, not validated walking paths or local hazard assessments.
- DONKI space-weather and REMS/MEDA weather feeds come from NASA endpoints and require a connection. Failure leaves the app in its existing unavailable/estimated state; do not treat missing feeds or coarse terrain fallback as operational guidance.
- First-time dependency installation and a clean Windows installer build require downloading npm/Electron packages.

The Electron window uses a private `appathenea://` protocol, context isolation, sandboxing, no renderer Node integration, a restrictive content-security policy, blocked in-app navigation, and HTTPS-only external-link handoff. The Windows installer excludes `video/index.html`; the updated English video demo remains in the repository.
