# Prueba técnica: mapa interactivo de Marte

## Qué se probó

| Requisito | Cómo | Resultado |
|---|---|---|
| Mostrar una región de Marte | Leaflet 1.9.4 + teselas NASA Mars Trek (WMTS, equirectangular), vista inicial en el cráter Jezero | OK: 15/15 teselas cargadas, 0 errores |
| Agregar capas | 2 mapas base (MOLA relieve, Viking color), 1 superposición raster con opacidad, retícula, capa GeoJSON de sitios de aterrizaje | OK |
| Marcar puntos | Modo "Punto": clic agrega un marcador arrastrable con coordenadas | OK |
| Dibujar una ruta | Modo "Ruta": clics agregan vértices, doble clic termina, longitud calculada con el radio de Marte | OK (ruta de ejemplo: 6,92 km) |
| Intercambio de datos | Exportar e importar GeoJSON | OK |
| Ruta sugerida automáticamente | Modo "Sugerir": clic en inicio y destino. Búsqueda A* sobre una grilla de elevación MOLA (Mars Trek, PNG de 8 bits leído en el navegador). Costo por distancia, castigo por pendiente, tramos prohibidos sobre la pendiente máxima y descuento por pasar por hielo, paleolagos o valles. Muestra perfil de elevación, subida, bajada y pendiente máxima | OK. Hellas (883 km): 1 s la primera vez, 0,2 s con caché. Jezero (57 km): 55 ms. Con preferencia por agua 0,8 la ruta se desvía y pasa el 40 % cerca de valles (2 % con preferencia 0) |
| Rutas por valles y zonas con hielo o agua | Capa "Agua y hielo" (12 valles, 11 zonas, 5 indicios). La ruta se colorea por tramo y se resume cuántos km pasan por hielo, paleolagos o cerca de valles (distancia ajustable) | OK con datos aproximados (ejemplo Hellas: 59 % por glaciares con hielo probable, 39 % cerca de valles) |

Cómo correrlo: `powershell -ExecutionPolicy Bypass -File serve.ps1` y abrir http://localhost:8765 (no hace falta Node ni Python).

## Misiones EVA (`mision.html`)

Herramienta para que un astronauta planifique una caminata (EVA) en una zona de exploración. Cada misión se define en [`misiones.js`](misiones.js) y se elige desde el selector del encabezado o con la dirección:

- `mision.html?m=gale`: **EVA Monte Sharp**, región de retículas (boxwork) que Curiosity estudió en 2025 (4,80°S, 137,39°E).
- `mision.html?m=jezero`: **EVA Delta de Jezero**, frente y delta superior que Perseverance exploró en 2022–2023 (18,46°N, 77,40°E).

### Datos de NASA que usa

| Tipo | Gale | Jezero | Para qué sirve en la EVA |
|---|---|---|---|
| Óptico | HiRISE (~25 cm/px) y CTX, Mars Trek | HiRISE controlado (25 cm/px) y CTX controlado, Mars Trek | Ver el terreno y elegir paradas |
| Topográfico | HiRISE DTM de Gale (1 m), servidor de imágenes de Trek | HRSC + MOLA global (200 m), servidor de imágenes de Trek | Pendiente, perfil de elevación y costo de la ruta |
| Térmico | THEMIS infrarrojo nocturno (100 m) | THEMIS infrarrojo nocturno (100 m) | Roca firme (clara) frente a polvo o arena suelta (oscura) |
| In situ | 1389 paradas de Curiosity con inclinación medida (MMGIS) | 708 paradas de Perseverance con inclinación medida (MMGIS) | Ubicar paradas científicas y validar la pendiente |
| Radiación | RAD de Curiosity: 0,64 mSv/día | La misma referencia (Perseverance no lleva detector de radiación) | Dosis de cada EVA |
| Clima espacial | DONKI, en vivo | DONKI, en vivo | Alertas de partículas solares y eyecciones hacia Marte |
| Atmosférico | REMS de Curiosity | MEDA de Perseverance | Temperaturas, presión y horario de luz |

### Qué hace

- 6 paradas científicas por misión, ubicadas en lugares que el rover visitó, con un objetivo propuesto. Se pueden activar, mover, agregar con un clic o importar por coordenadas.
- Base arrastrable con un radio de regreso a pie.
- Ruta de la EVA (base → paradas → base) calculada con A* sobre una grilla de 10 m. El costo es el tiempo de caminata con traje (función de Tobler, ajustada por la carga). Se prohíben las pendientes mayores al límite y los obstáculos marcados.
- Cronograma por tramo, perfil de elevación, dosis de radiación y un veredicto APTA, CON PRECAUCIÓN o NO APTA según autonomía del traje, distancia a la base, pendiente, luz solar y clima espacial.
- Panel "Calidad de los datos" que compara la elevación y la pendiente calculadas con lo que midió el rover.
- Exporta el plan como GeoJSON.

### Resultado de la prueba (plan por defecto, 4 paradas)

| | Gale | Jezero |
|---|---|---|
| Distancia y duración | 3,42 km en 4 h 07 | 2,42 km en 3 h 18 |
| Reserva (traje de 7 h) | 2 h 53 | 3 h 42 |
| Máximo alejamiento de la base | 1,66 km | 0,60 km |
| Dosis | 0,110 mSv | 0,088 mSv |
| Altura frente al rover | 2,3 m de error (+17 m de desvío fijo por referencia de altura) | 12,6 m de error (+28 m de desvío fijo) |
| Pendiente frente al rover | 2,4° de diferencia media, correlación 0,67 | 3,9° de diferencia media, correlación 0,0 |
| Veredicto | Con precaución (DONKI menciona Marte; tramos cerca de 15°) | Con precaución (DONKI menciona Marte; elevación de baja resolución) |

### Cómo agregar una misión nueva

1. **Elegir la zona** en Mars Trek (trek.nasa.gov/mars): buscar el sitio y anotar los nombres de las capas HiRISE y CTX (`productLabel`), su zoom máximo y el área que cubren.
2. **Elegir la elevación**: si el sitio tiene un DTM publicado en el servidor de imágenes de Trek (`trek.nasa.gov/mars/trekarcgis/rest/services`), usarlo. Si no, usar `Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw` (global, 200 m) y marcarlo como `coarse: true`.
3. **Datos del rover** (opcional pero recomendado para validar): descargar recorrido y paradas de MMGIS y generar un archivo en `data/` con el mismo formato que `data/curiosity.js`. Sin rover, la base y las paradas se pueden dar por coordenadas en lugar de por sol.
4. **Copiar una ficha** en `misiones.js` y cambiar nombre, zona (`bbox`, menos de ~5 × 5 km), capas, elevación, clima, texto de introducción y paradas con su objetivo científico.
5. Abrir `mision.html?m=<id>` y revisar el panel "Calidad de los datos".

### Bloqueos de las misiones

24. **Elevación disponible por sitio.** Gale usa el DTM HiRISE de 1 m del servidor de imágenes de Trek, que entrega alturas reales en 32 bits (antes se usaban teselas PNG de 8 bits con escalones de 18,6 m, lo que daba una correlación de pendiente de apenas 0,40). **Jezero no tiene su DTM HiRISE publicado como servicio** (solo como descarga de 1,8 GB), así que usa el modelo global de 200 m: las pendientes locales no se ven y la ruta depende de los obstáculos marcados a mano. Para corregirlo hay que recortar el DTM de Jezero a la zona y servirlo junto a la app.
25. **No hay mapa de rocas a escala de astronauta.** Los obstáculos grandes se cubren con pendiente y marcas manuales. Un mapa de abundancia de rocas a partir de HiRISE sería el próximo paso.
26. **Los mapas minerales CRISM no están como capa de teselas** en Mars Trek: solo hay huellas de las observaciones. Para sumar datos espectrales habría que procesar los productos CRISM del PDS.
27. **DONKI está pensado para la Tierra.** Las alertas para Marte se infieren de avisos que lo mencionan. Una misión real usaría el monitoreo de RAD en tiempo real y pronósticos específicos para Marte.
28. **Los feeds de clima publican con atraso.** REMS llega hasta el sol 4995 (25-08-2026) y MEDA hasta el sol 1133 (27-04-2024). No es el clima de hoy.
29. **Los datos de los rovers no se pueden leer en vivo desde el navegador** (el servidor no lo permite), así que van incluidos en `data/` con fecha de descarga. Hay que actualizarlos a mano.
30. **Radiación en Jezero.** Perseverance no lleva detector de radiación; se usa la tasa de Curiosity. Jezero está unos 1,9 km más alto que Gale y la dosis real puede ser algo mayor.
31. **El modelo de caminata es simple.** Velocidad en llano, efecto de la carga, pendiente máxima con traje y tasa de radiación son valores de referencia que el equipo debe revisar. Los objetivos científicos de cada parada son propuestas a validar.
