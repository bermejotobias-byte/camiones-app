# Fuentes de datos

El proyecto separa deliberadamente dos capas: **la red vial y sus atributos
físicos** vienen de OpenStreetMap; **la normativa** viene del Gobierno de la
Ciudad de Buenos Aires. Cada restricción que el sistema aplica registra ambos
orígenes por separado (ver AD-05 en [decisions.md](decisions.md)).

---

## 1. OpenStreetMap — red vial y atributos físicos

**Descarga:** extract de Argentina de Geofabrik.

```
https://download.geofabrik.de/south-america/argentina-latest.osm.pbf   (407 MB)
```

**Importación:** la hace GraphHopper directamente desde el `.pbf`; no hace falta
osm2pgsql ni imposm. El script `routing/run-graphhopper.ps1` descarga el archivo
si falta y construye el grafo en `routing/graph-cache`. El import completo de
Argentina tarda menos de un minuto.

**Actualización:** Geofabrik republica el extract a diario. Para actualizar:
borrar `argentina-latest.osm.pbf` y `graph-cache`, y volver a correr el script
(`run-graphhopper.ps1 -Rebuild`).

**Recorte al AMBA:** el grafo que se usa sale de `amba-latest.osm.pbf`, que
produce `routing/crop-amba.ps1` cortando el extract del país al rectángulo
`-59.30, -35.20` / `-57.90, -34.00`. Son 44 MB contra 408 MB, y el grafo baja de
337 MB a 42 MB con la memoria de GraphHopper de 1.073 MB a 533 MB —sin cambiar
ninguna ruta— para que entre en un servidor chico. Ver [deploy.md](deploy.md).

> Ese rectángulo es **el mismo** con el que se recortan los resultados del
> geocoder (sección 3). La coincidencia es intencional: garantiza que todo lo que
> el buscador encuentra se puede rutear. Al ampliar uno hay que ampliar el otro.

**No se depende de Overpass en tiempo real.** Overpass se usó sólo durante la
investigación para medir la cobertura de tags; el ruteo trabaja siempre contra
el grafo local.

**Licencia:** ODbL. La atribución **"© colaboradores de OpenStreetMap"** es
obligatoria y aparece en el mapa de la app y en el campo `attribution` de la
respuesta de `POST /api/routes`.

### Cobertura de tags relevantes en CABA

Medido con Overpass sobre el bbox `-34.706, -58.532, -34.526, -58.335`
(consulta ejecutada el 13/08/2026):

| Tag | Ways |
|---|---|
| `hgv=designated` | 2.539 |
| `hgv=no` | 658 |
| `maxheight` | 796 |
| `maxweight` | 307 |

La cobertura de dimensiones físicas es parcial: 307 vías con límite de peso
declarado sobre una ciudad entera es poco. En la práctica, para vehículos de más
de 12 t la regla que hace el trabajo pesado es la de la Red de Tránsito Pesado,
no los límites individuales. **Es una limitación de los datos disponibles, no del
motor**: cuando aparezcan más tags, el motor los usa sin cambios.

---

## 2. Red de Tránsito Pesado — normativa de CABA

**Norma:** Ley 2148, Código de Tránsito y Transporte de la Ciudad Autónoma de
Buenos Aires, artículos **9.10.1** y **9.10.5** (Anexo I), modificados por la
**Ley 6.401/2020**.

**Regla:** está prohibida la circulación de vehículos de más de **12 toneladas**
de peso total bruto por fuera de la Red. Esos vehículos pueden circular por
tramos no incluidos **únicamente para llegar a su destino y regresar, usando el
recorrido más corto desde y hacia la Red**.

**Alcance de la Red:** 205 km sobre 95 calles y avenidas, en 39 de los 48
barrios.

**Excepciones previstas por la norma** (no implementadas en el MVP): vehículos de
emergencia, servicios públicos, medios de comunicación y camiones hormigoneros.

**Fuentes:**

- <https://buenosaires.gob.ar/movilidad/gerencia-operativa-de-logistica-urbana/normativa-general/red-de-transito-pesado>
- <https://juristeca.jusbaires.gob.ar/compilacion-normativa-juristeca/ley-2148/tit-9/>

---

## 3. Photon — búsqueda de direcciones

Geocoder construido sobre datos de OpenStreetMap, pensado para autocompletado.
Se usa a través de la instancia pública `photon.komoot.io`, expuesta detrás de
nuestros endpoints `GET /api/places` y `GET /api/places/reverse`.

**Licencia:** los datos son ODbL, igual que el resto. La atribución ya cubierta
por el mapa aplica también acá.

**Cuidado con la carga:** es un servicio gratuito. La app espera 350 ms sin
tecleo antes de consultar, exige al menos tres caracteres y cancela la consulta
previa en cada tecla. Para producción corresponde
[autohospedar Photon](https://github.com/komoot/photon) — se puede alimentar con
el mismo extract de Geofabrik que ya usamos.

**Área de servicio:** los resultados se **priorizan** por cercanía al centro de
CABA (`BiasLatitude`/`BiasLongitude` + `BiasScale`) y se **recortan** a
`-59.30, -35.20` / `-57.90, -34.00`, que cubre el AMBA con holgura. Todo es
configurable en la sección `Geocoding` de `appsettings.json`.

> No usar el parámetro `bbox` de Photon para esto: **filtra en vez de
> priorizar**, y con una caja de CABA el buscador no encuentra destinos
> legítimos del conurbano como Unicenter. Ver AD-11 en [decisions.md](decisions.md).

---

## 4. Puntos de interés para camiones

El detalle del modelo y de la carga está en [pois.md](pois.md). Acá quedan las
fuentes y lo que se midió antes de elegirlas.

### Qué hay en OpenStreetMap para CABA

Medido con Overpass el 14/08/2026:

| Consulta | Objetos |
|---|---|
| `amenity=fuel` | 232 (195 con nombre, 100 con dirección, 68 con horario) |
| `shop` ∈ {`car_repair`, `tyres`, `truck`, `truck_repair`} | 654 (96 gomerías con nombre) |
| `amenity=parking` + `access=hgv` | **0** |
| `amenity=truck_stop` | **0** |
| `shop=truck_repair` | **0** |
| cualquier `amenity` con etiqueta `hgv` | 8 |

Estaciones, talleres y gomerías reales sobran; **playas de camiones no existen
como dato en OSM para CABA**, y casi ningún establecimiento declara aptitud para
camión. Por eso los cuatro campos de aptitud son `bool?` y el dataset inicial
tiene 75 de 78 puntos en `NotConfirmed`.

### Fuentes del relevamiento manual

- **CTC — Centro de Transferencia de Cargas**: página oficial del GCBA
  (<https://www.buenosaires.gob.ar/corporacionsur/obras/iniciativa-publico-privada/centro-de-transferencia-de-cargas-ctc>)
  más los datos de contacto del operador
  (<https://www.ctcadministradora.com.ar/contacto>). La página oficial **no
  publica** teléfono ni horario: esos campos se tomaron del operador, y lo que
  ninguna de las dos dice quedó vacío.
- **Auxilio Full Truck** (<https://auxiliosfulltruck.com.ar/>) y **Grúas El
  Enganche** (<https://gruaselenganche.com.ar/>): datos declarados por el propio
  prestador, sin verificación independiente → `Probable`.

**No hay dataset abierto de playas de camiones.** Se consultó el portal del GCBA
(`data.buenosaires.gob.ar`, CKAN, consulta *playas estacionamiento*): el único
resultado es "Estacionamientos concesionados de movilidad sustentable", que no
tiene que ver con transporte de carga.

---

## Limitaciones abiertas

### L-1 · La pertenencia a la Red se toma de OSM, no de la capa oficial

Hoy el sistema identifica la Red por la etiqueta `hgv=designated` de
OpenStreetMap, que la comunidad mantiene siguiendo el criterio documentado en la
[wiki de OSM Argentina](https://wiki.openstreetmap.org/wiki/ES:Argentina/Tr%C3%A1nsito_pesado).
Es una **transcripción comunitaria** de la Red oficial, no la fuente legal.

Se buscó la capa oficial en el portal de datos abiertos del GCBA
(<https://data.buenosaires.gob.ar>) consultando la API de CKAN por *pesado* y
recorriendo el listado completo de datasets: **no está publicada** en GeoJSON,
shapefile, CSV ni WFS. El GCBA sólo ofrece un visor de mapa.

Por eso todo hallazgo de tipo `OutsideHeavyTrafficNetwork` se emite con
`RuleSource = CabaOfficial` (la regla es la ley) y `DataSource = Osm` (el dato de
pertenencia es comunitario). **No se inventaron datos para tapar este hueco.**

*Próximo paso:* pedir la capa por la vía de datos abiertos, o digitalizar el
anexo de la norma y cargarla como fuente `CabaOfficial`, comparándola contra OSM.

### L-2 · No se modelan restricciones horarias

No se encontró en las fuentes consultadas una restricción horaria general
confirmada para la circulación de camiones en CABA. El motor **soporta**
ventanas horarias estructuralmente (`Evaluate` recibe un `DateTimeOffset`), pero
**no se cargó ninguna regla horaria**, porque hacerlo sin respaldo normativo
sería inventar una restricción legal.

### L-3 · Las excepciones por tipo de vehículo no están implementadas

Emergencias, servicios públicos y hormigoneras están exceptuadas por la norma.
El modelo tiene `VehicleType`, así que la extensión es directa, pero el MVP no
las contempla.

### L-4 · Tiles de OpenStreetMap

La app usa `tile.openstreetmap.org`, cuya
[política de uso](https://operations.osmfoundation.org/policies/tiles/)
desaconseja el consumo desde aplicaciones. Alcanza para el MVP en un dispositivo,
pero **antes de cualquier distribución** hay que pasar a un proveedor propio o
con API key. La URL es reemplazable en caliente con `setTileUrl()` en
`Resources/Raw/map.html`.

### L-5 · Playas de camiones y auxilio pesado casi no tienen fuente en CABA

Las tres categorías que OSM cubre bien (estaciones, talleres, gomerías) traen 25
puntos cada una. Las otras dos traen **una** y **dos**.

No es un recorte del MVP, es lo que hay. CABA no publica un registro de playas de
camiones; la única instalación con respaldo oficial es el CTC, que además **no es
un estacionamiento de uso público** sino un centro de transferencia que opera con
las empresas radicadas en el predio. Tiene sentido: la Ciudad desalienta la
presencia de camiones pesados, que es de lo que trata la Ley 2148.

El auxilio mecánico pesado tiene otro problema: **el dato útil es el teléfono, no
la ubicación**. Varios prestadores cubren CABA sin publicar domicilio, y los que
lo publican suelen tener la base en el conurbano. Se cargaron los que declaran una
ubicación; los que no, se dejaron afuera y están listados en
[pois.md](pois.md#lo-que-se-dejó-afuera-a-propósito).

**No se completó el hueco con establecimientos inventados.** El modelo, los
filtros y los íconos de las cinco categorías están; los datos entrarán cuando haya
fuente.

*Próximo paso:* pedir al GCBA el registro de playas habilitadas para carga, o
modelar el auxilio como servicio con área de cobertura en lugar de como punto.

### L-6 · La aptitud para camión casi nunca está declarada

75 de los 78 puntos del dataset inicial tienen los cuatro campos de aptitud en
`null`. Con el filtro "solo aptos para mi camión" activado, un semirremolque hoy
no ve ningún punto.

Es el resultado correcto —lo que falta es el dato, no el motor— pero conviene
saberlo antes de interpretar un mapa vacío. La app lo dice explícitamente con el
contador de puntos ocultos.

---

## Datos de prueba

Los tres perfiles que siembra la API (`Camión liviano` 7.500 kg, `Camión pesado`
18.000 kg, `Semirremolque` 40.000 kg) son **valores de prueba** y no representan
límites legales. Quedan marcados con `IsSampleData = true` y la app los muestra
con la leyenda "Datos de prueba".

---

## 5. Capas de camión del mapa

Las genera `data/fetch-caba-map-layers.ps1` desde Overpass y quedan versionadas
en `src/TruckNavigator.Api/wwwroot/data/`. Se sirven a la web y viajan dentro del
APK, así que en el teléfono no se descargan.

**Ningún proveedor de tiles incluye estos datos.** OpenMapTiles, Protomaps y los
comerciales son basemaps de propósito general: no traen `hgv`, `maxheight` ni
`railway=level_crossing` como atributos consultables. Por eso la capa es nuestra.

| Archivo | Objetos | Consulta |
|---|---|---|
| `red-transito-pesado.geojson` | 2.426 tramos | `way[hgv=designated]` |
| `alturas.geojson` | 577 puntos | `way[maxheight]` con altura numérica |
| `pasos-a-nivel.geojson` | 312 puntos | `node[railway=level_crossing]` |

Medido dentro del límite administrativo de CABA el 24/08/2026.

### L-7 · Un sexto de los gálibos no declara una altura

`maxheight=default` significa "rige el límite legal", no una medida: son **108 de
685** tramos con la etiqueta. Quedan fuera del dataset porque mostrar un número
inventado sobre un puente es peor que no mostrar nada — pero eso significa que
**hay pasos bajo nivel reales que la app no marca**.

*Próximo paso:* si aparece la altura publicada por el GCBA o por el operador
ferroviario, se cargan como fuente propia y se distinguen de las de OSM.

### L-8 · Un tercio de los pasos a nivel no declara su barrera

117 de 312 no dicen qué protección tienen. Se pintan en gris: **no declarado no
es lo mismo que sin barrera**, y tratarlo como tal sería inventar una advertencia.

De los que sí declaran: 82 media barrera, 40 completa, 27 doble media y **36 sin
barrera**. Esos 36 son los que importan.

*Próximo paso:* el GCBA no publica el registro —se consultó el portal de datos
abiertos por *paso a nivel*, *ferroviario*, *barrera* y *tren*, sin resultados—.
Confirmarlos pide relevamiento o pedido de información pública.
