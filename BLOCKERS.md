# Technical prototype: interactive Mars map

## What was tested

| Requirement | How | Result |
|---|---|---|
| Show a region of Mars | Leaflet 1.9.4 + NASA Mars Trek tiles (WMTS, equirectangular), initial view on Jezero crater | OK: 15/15 tiles loaded, 0 errors |
| Add layers | 2 base maps (MOLA relief, Viking color), 1 raster overlay with opacity, graticule, GeoJSON layer of landing sites | OK |
| Mark points | "Point" mode: a click adds a draggable marker with coordinates | OK |
| Draw a route | "Route" mode: clicks add vertices, double-click finishes, length computed with the Mars radius | OK (sample route: 6.92 km) |
| Data exchange | Export and import GeoJSON, or plain coordinates (one per line) | OK |
| Automatically suggested route | "Suggest" mode: click start and destination. A* search over a MOLA elevation grid (Mars Trek, 8-bit PNG read in the browser). Cost by distance, slope penalty, segments above the max slope forbidden, and a discount for passing through ice, paleolakes or valleys. Shows elevation profile, ascent, descent and max slope | OK. Hellas (883 km): 1 s the first time, 0.2 s cached. Jezero (57 km): 55 ms. With water preference 0.8 the route detours and runs 40% near valleys (2% with preference 0) |
| Routes through valleys and ice or water zones | "Water and ice" layer (12 valleys, 11 zones, 5 point evidences). The route is colored per segment and the panel sums how many km cross ice, paleolakes or run near valleys (adjustable distance) | OK with approximate data (Hellas example: 59% over glaciers with probable ice, 39% near valleys) |

How to run it: `powershell -ExecutionPolicy Bypass -File serve.ps1` and open http://localhost:8765 (no Node or Python needed).

## Global map blockers and risks

### Confirmed during testing

1. **Leaflet assumes Earth.** The `EPSG4326` CRS is only used as a flat lat/lon projection. Everything that measures distance (scale control, `map.distance()`, measuring plugins) uses Earth's radius (6371 km) and gives values **×1.88 larger** than on Mars (3389.5 km). Distance had to be computed by hand. The scale control shown on the map is still wrong.
2. **Tile format.** Mars Trek serves `.jpg`, not `.png`; with the wrong extension it returns a silent 404. The grid is 2×1 at zoom 0 (it matches Leaflet EPSG4326), but this must be checked for each layer.
3. **Limited native zoom.** MOLA and Viking only go up to zoom 7 (~460 m and ~230 m/pixel). Beyond that the last level is shown enlarged and blurry. Crater-level detail (HiRISE, CTX) needs other layers, which only cover specific areas.
4. **Layers that do not exist.** The THEMIS layer name that was tried returned 404. Mars Trek layer identifiers are not stable or documented in one place; they have to be read from each layer's `WMTSCapabilities.xml`.
5. **Leaflet initialization order.** Adding vector layers before setting the view breaks the map (`Cannot read properties of undefined (reading 'min')`). Fixed by passing `center` and `zoom` when creating the map.
6. **Hosting platforms that block external images.** Some page hosts (for example, sandboxed artifact viewers) block images from other domains, so NASA tiles would not load. The app must be hosted on its own server or on a static host.

### To validate in the next iteration

7. **Longitude convention.** Data comes with East longitude 0–360°, East ±180°, and positive West (old Viking maps). The app uses East ±180° and also shows 0–360°. A convention must be fixed and everything imported must be converted.
8. **Planetocentric vs planetographic.** Latitudes differ by up to ~0.3° at mid-latitudes. Define which one the source data uses (IAU_2015:49900 is planetocentric).
9. **Poles.** The equirectangular projection distorts heavily above ±60°. If the region of interest is polar, a polar stereographic projection (Proj4Leaflet) and other tiles are needed.
10. **Antimeridian.** Routes crossing 180° are drawn wrapping around the planet. Not handled in this prototype.
11. **Geodesic routes.** Segments are drawn straight in the projection and do not follow the great circle. At short distances it does not matter; for long routes segments must be densified.
12. **Dependence on an external service.** Mars Trek offers no SLA, documented usage limits or availability guarantee. For production, tiles should be cached or generated in-house from USGS mosaics (GDAL + `gdal2tiles`).
13. **Elevation and slopes.** If the route must consider terrain (height profile, traversable slope), the MOLA/HRSC DEM is needed and must be processed. (Partly addressed later; see 19–23.)

### Valleys, ice and water

14. **The prototype data is approximate.** Valleys and zones were drawn by hand from publications, with errors of tens of km. They test the mechanics, not route decisions. Real data sources:
    - Valleys: Hynek et al. (2010) global valley network map, as a shapefile (also available as the `Hynek_Valley_Networks` layer on Mars Trek).
    - Subsurface ice: SWIM project maps (Subsurface Water Ice Mapping, Morgan et al. 2021), as regional rasters.
    - Glaciers and buried ice: SHARAD radar detections published per area.
    They must be converted to GeoJSON or tiles, checking each one's longitude convention.
15. **"Valley" does not mean "water today".** Almost all valleys are channels that dried billions of years ago. Present-day ice is mostly at mid and high latitudes (above about 35°), far from most equatorial valleys. Decide what is being searched for: traces of past water or ice accessible today.
16. **The ice is buried.** Ice zones indicate ice under one to tens of meters of soil. Depth is not in this prototype and varies widely; SWIM data estimates it.
17. **Google Mars cannot be used as a source.** Google Maps Mars imagery has no public tile API and its terms do not allow using it in another app. What it shows comes from the same NASA data (MOLA, Viking, THEMIS), so Mars Trek or USGS provide the same thing.
18. **A drawn route is not a traversable route.** The analysis says where the line goes, not whether it can be walked. Valley walls have steep slopes. For the app to suggest routes, the elevation model and a pathfinding algorithm with costs for slope and proximity to water are needed (done in a first version; see 19–23).

### Suggested route (global map)

19. **The elevation is coarse and quantized.** The only global elevation the browser can read directly from Mars Trek tiles is an 8-bit image: 256 levels for about 30 km of relief, i.e. **steps of ~124 m**, with a maximum resolution of ~1.3 km per pixel. The scale was calibrated by hand against known heights (error ~±500 m). Production needs the real elevation model (MOLA 463 m or HRSC+MOLA 200 m in 16-bit GeoTIFF) served as in-house tiles, for example in Terrain-RGB format. (The mission pages already read real heights; see 24.)
20. **Slopes are underestimated.** On long routes the grid gets coarser (Hellas: 7.2 km cells) and a 30° crater wall is averaged down to 3–4°. The "max slope" limit only compares routes against each other; it is not a safety criterion. Vehicle-scale slopes need HiRISE elevation models (~1 m), which only cover specific areas.
21. **Grid size is limited** to ~260 cells per side so the calculation runs in the browser in under a second. Long routes with fine detail require running the calculation on a server or with several resolutions.
22. **The cost is a toy model.** The weights (slope penalty, water discount) are arbitrary. Real planning would add rock abundance, thermal inertia (soil type), lighting and communications.
23. **It does not cross the antimeridian or go beyond ±85° latitude.**

## EVA missions (`mission.html`)

A tool for an astronaut to plan a walk (EVA) in an exploration zone. Each mission is defined in [`missions.js`](missions.js) and is chosen from the selector in the header or with the address:

- `mission.html?m=gale`: **Mount Sharp EVA**, the boxwork region Curiosity studied in 2025 (4.80°S, 137.39°E).
- `mission.html?m=jezero`: **Jezero Delta EVA**, the delta front and upper fan Perseverance explored in 2022–2023 (18.46°N, 77.40°E).

### NASA data used

| Type | Gale | Jezero | What it is for during the EVA |
|---|---|---|---|
| Optical | HiRISE (~25 cm/px) and CTX, Mars Trek | Controlled HiRISE (25 cm/px) and controlled CTX, Mars Trek | See the terrain and choose stops |
| Topographic | Gale HiRISE DTM (1 m), Trek image server | Global HRSC + MOLA (200 m), Trek image server | Slope, elevation profile and route cost |
| Thermal | THEMIS nighttime infrared (100 m) | THEMIS nighttime infrared (100 m) | Firm rock (bright) versus dust or loose sand (dark) |
| Geology | — | Mapped unit NHjf₂ (Jezero fan 2) | Geologic context for each stop |
| In situ | 1389 Curiosity stops with measured tilt (MMGIS) | 708 Perseverance stops with measured tilt (MMGIS) | Place science stops and validate the slope |
| Radiation | Curiosity RAD: 0.64 mSv/day | The same reference (Perseverance carries no radiation detector) | Dose for each EVA |
| Space weather | DONKI, live | DONKI, live | Solar particle alerts and ejections toward Mars |
| Atmospheric | Curiosity REMS | Perseverance MEDA | Temperatures, pressure and daylight hours |

### What it does

- 6 science stops per mission, placed where the rover went, each with a proposed objective. They can be toggled, moved, added with a click or imported by coordinates.
- Draggable base with a walk-back radius.
- EVA route (base → stops → base) computed with A* over a 10 m grid. The cost is suited walking time (Tobler's function, adjusted for load). Slopes above the limit and marked obstacles are forbidden.
- Schedule per leg, elevation profile, radiation dose and a verdict of CLEARED, WITH CAUTION, NOT CLEARED or PRELIMINARY ROUTE based on suit endurance, distance from base, slope, daylight and space weather.
- Estimated consumables per EVA (oxygen, drinking and cooling water, food budget) with selectable ventilation scenarios.
- "Data quality" panel that compares the computed elevation and slope with what the rover measured.
- Exports the plan as GeoJSON.

### Test results (default plan, 4 stops)

| | Gale | Jezero |
|---|---|---|
| Distance and duration | 3.42 km in 4 h 07 | 2.42 km in 3 h 18 |
| Reserve (7 h suit) | 2 h 53 | 3 h 42 |
| Farthest from base | 1.66 km | 0.60 km |
| Dose | 0.110 mSv | 0.088 mSv |
| Height versus the rover | 2.3 m error (+17 m fixed offset from the height reference) | 12.6 m error (+28 m fixed offset) |
| Slope versus the rover | 2.4° mean difference, correlation 0.67 | 3.9° mean difference, correlation 0.0 |
| Verdict | With caution (DONKI mentions Mars; segments close to 15°) | Preliminary route (low-resolution elevation) |

### How to add a new mission

1. **Choose the area** on Mars Trek (trek.nasa.gov/mars): search for the site and note the names of the HiRISE and CTX layers (`productLabel`), their max zoom and the area they cover.
2. **Choose the elevation**: if the site has a DTM published on the Trek image server (`trek.nasa.gov/mars/trekarcgis/rest/services`), use it. Otherwise use `Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw` (global, 200 m) and mark it as `coarse: true`.
3. **Rover data** (optional but recommended for validation): download the traverse and stops from MMGIS and generate a file in `data/` with the same format as `data/curiosity.js`. Without a rover, the base and stops can be given by coordinates instead of by sol.
4. **Copy a profile** in `missions.js` and change the name, zone (`bbox`, under ~5 × 5 km), layers, elevation, weather, intro text and stops with their science objective.
5. Open `mission.html?m=<id>` and review the "Data quality" panel.

### Mission blockers

24. **Elevation available per site.** Gale uses the 1 m HiRISE DTM from the Trek image server, which returns real 32-bit heights (8-bit PNG tiles with 18.6 m steps were used before, which gave a slope correlation of only 0.40). **Jezero does not have its HiRISE DTM published as a service** (only as a 1.8 GB download), so it uses the global 200 m model: local slopes are not visible and the route depends on obstacles marked by hand. To fix it, the Jezero DTM must be cropped to the zone and served with the app.
25. **There is no rock map at astronaut scale.** Large obstacles are covered by slope and manual marks. A rock abundance map derived from HiRISE would be the next step.
26. **CRISM mineral maps are not available as a tile layer** on Mars Trek: only the observation footprints are. Adding spectral data would require processing the CRISM products from the PDS.
27. **DONKI is designed for Earth.** Alerts for Mars are inferred from notifications that mention it. A real mission would use real-time RAD monitoring and Mars-specific forecasts.
28. **Weather feeds publish with a delay.** REMS goes up to sol 4995 (2026-08-25) and MEDA up to sol 1133 (2024-04-27). It is not today's weather.
29. **Rover data cannot be read live from the browser** (the server does not allow it), so it is bundled in `data/` with its download date. It must be updated by hand.
30. **Radiation at Jezero.** Perseverance carries no radiation detector; Curiosity's rate is used. Jezero is about 1.9 km higher than Gale and the real dose may be somewhat higher.
31. **The walking model is simple.** Flat-ground speed, load effect, max slope in a suit, radiation rate and consumable rates are reference values the team must review. The science objectives of each stop are proposals to be validated.
