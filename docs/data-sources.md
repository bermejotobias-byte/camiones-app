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

### L-4 · Tiles de OpenStreetMap — RESUELTO (24/08/2026)

> **Ya no aplica.** El mapa base pasó a ser un archivo PMTiles propio que genera
> `data/build-basemap.ps1` y sirve la API bajo `/tiles`. En tiempo de ejecución
> no se depende de ningún servicio de tiles. Ver AD-26.
>
> El raster de OpenStreetMap queda sólo como respaldo si el archivo no está
> generado, y **no sirve para distribuir**. El texto original se conserva abajo
> porque explica por qué se hizo el cambio.

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

---

## 6. Mapa base vectorial

Lo genera `data/build-basemap.ps1` y queda en `routing/amba.pmtiles` — no se
versiona, igual que el extract de OSM y el grafo de GraphHopper.

**Origen:** build diario del planeta que publica Protomaps, del que se extrae
sólo el AMBA. El rectángulo es **el mismo** con el que se recorta el grafo de
ruteo y se acotan los resultados del geocoder: que coincidan garantiza que todo
lo que el buscador encuentra se puede ver y rutear.

| | |
|---|---|
| Región | `-59.30, -35.20` / `-57.90, -34.00` |
| Zoom | 0–15 |
| Tamaño | 53 MB |
| Esquema | Protomaps basemap — `earth`, `landuse`, `water`, `roads`, `buildings`, `boundaries`, `places` |
| Licencia | OpenStreetMap (ODbL) |

**Tipografía:** Noto Sans, rangos 0–511, vendorizada en `wwwroot/fonts`. Cubre el
español completo incluidas las mayúsculas acentuadas. Va con la app y no se pide
a un servidor: adentro de un camión, una descarga más es una cosa más que puede
fallar — y sin glifos MapLibre no dibuja ni una letra.

**Para actualizar:** volver a correr el script. Protomaps republica a diario.

---

## Radares de velocidad — Buenos Aires Data

**Dataset:** [Cámaras fijas de control vehicular](https://data.buenosaires.gob.ar/dataset/camaras-fijas-control-vehicular)

| | |
|---|---|
| Organismo | Dirección General Cuerpo de Agentes de Control de Tránsito y Seguridad Vial |
| Licencia | **CC-BY-2.5-AR** (confirmada por la API del portal) |
| Actualización | cada seis meses · última publicación: 23/07/2025 |
| Formatos | CSV, XLSX, SHP |
| Registros | **224**, las 224 dentro de CABA |

El dataset trae **dos tipos** en el campo `tipo_de_fiscalizador`, y sólo uno es un
radar de velocidad:

| Tipo | Cantidad | Qué es |
|---|---|---|
| **Cinemómetro** | **129** | mide velocidad |
| Analítica de video | 95 | semáforo en rojo, celular, cinturón |

`data/fetch-radares-velocidad.ps1` se queda **sólo con los cinemómetros**. Marcar
los otros como radares sería decirle al camionero que hay un control de velocidad
donde no lo hay.

### Contraste con OpenStreetMap

Medido contra Overpass el 31/08/2026, dentro del límite administrativo de CABA:

| Fuente | Radares de velocidad |
|---|---|
| Dataset oficial | 129 cinemómetros |
| OSM `highway=speed_camera` | **176** |

**OSM tiene más que el listado oficial**, y no se sabe cuál está más al día. Se
eligió el oficial porque tiene organismo responsable, licencia y cadencia
declarada. OSM queda como control, no como fuente.

### Trampas del archivo

- Viene en **Latin-1**, no UTF-8. Decodificarlo con la página de códigos de la
  máquina convierte "MARÍA" en "MAR?A" y cambia de equipo en equipo: el script lo
  decodifica byte a byte, que es exacto para los acentos del castellano.
- Separador **punto y coma**, decimales con **coma**.
- El encabezado `ubicación` lleva tilde: el script declara los nombres de columna
  a mano en vez de depender de que ese carácter sobreviva.

---

## L-9 · No hay dato de balanzas de pesaje para CABA

**Investigado el 31/08/2026, sin resultado.** El brainstorm v2 pedía radares de
control de peso y el propio documento decía "investigar". Lo que se encontró:

- **Ningún dataset abierto con ubicaciones**, ni en Buenos Aires Data, ni en el
  portal nacional de transporte, ni en el de la Provincia.
- Los puestos de control de pesos y dimensiones son de **Vialidad Nacional y
  provincial, sobre rutas** — Santiago del Estero, Salta, Tucumán, Corrientes,
  Misiones, Chaco, Santa Fe, Córdoba, Buenos Aires y Mendoza. Ninguno en la
  Ciudad.
- **En OSM: cero balanzas dentro de CABA.** En todo el AMBA hay **dos**, ambas
  fuera de la Ciudad y sobre el corredor de Panamericana
  (`-34,2469 / -58,9661` y `-34,4211 / -58,5714`), sin nombre ni operador.

**Conclusión:** para una aplicación de CABA no hay dato que mostrar. La otra mitad
de la idea —que el usuario avise si están parando— es un reporte de comunidad, y
como tal tiene que verse distinto de un dato oficial.

---

## 7. Zonas peligrosas — mapa colaborativo del AMBA

**Fuente:** mapa ["Zonas Peligrosas"](https://www.google.com/maps/d/u/0/viewer?mid=1ZVh-1tRfDFTc4O1eITKjEkASCXFQExtL)
de Google My Maps, que circula entre repartidores del AMBA.

| | |
|---|---|
| Autoría | **anónima** |
| Licencia | **no declarada** |
| Metodología | **no publicada** |
| Fecha | **no declarada** |
| Polígonos | 403 en todo el país · **19 tocan CABA** |
| Superficie en CABA | **8,8 km², el 4,3% de la Ciudad** |

Lo genera `data/fetch-zonas-riesgo.ps1`, que baja el KML, se queda con los
polígonos que tocan CABA y los recorta al límite de la Ciudad.

**No es un dato oficial y la app lo dice cada vez que se toca una zona.** Se usa
como lo que es: el juicio de gente que trabaja en la calle todos los días.

### Por qué se descartó el Mapa del Delito del GCBA

Se construyó primero con el dataset oficial de delitos (CC-BY, 133.203 hechos de
2025 con coordenadas) y **hubo que descartarlo**. Los dos motivos valen la pena
porque son fáciles de repetir:

**1. Contar delitos denunciados mide dónde hay gente, no dónde hay peligro.**
Palermo encabezaba la Ciudad con 4.126 hechos. Filtrar a robos a mano armada
corregía buena parte del sesgo —Villa Soldati tiene 30,9% de robos con arma
contra 6,3% de Palermo— pero no el fondo: un conteo de hechos no es un mapa de
peligro.

**2. El dataset cubre exactamente CABA**, así que el mapa de calor terminaba
dibujando la silueta de la Ciudad. En pantalla era un manchón rojo con la forma
del límite administrativo, diciendo *"toda la Ciudad es peligrosa y el conurbano
es seguro"* — absurdo, y al revés de la realidad.

El análisis del dato oficial queda acá porque sigue siendo útil para contrastar,
y porque explica por qué la app **no** lo usa.

### Dónde caen las 19 zonas

| Barrio | km² |
|---|---:|
| Villa Soldati | 2,49 |
| Barracas (Villa 21-24) | 2,02 |
| Villa Lugano | 1,54 |
| Retiro (Villa 31) | 0,86 |
| Flores (Villa 1-11-14) | 0,78 |
| Recoleta | 0,30 |
| Parque Avellaneda | 0,19 |
| Nueva Pompeya | 0,18 |
| Puerto Madero | 0,12 |
| La Boca | 0,09 |
| Saavedra · Paternal · Parque Patricios · Chacarita · Villa Riachuelo · Parque Chacabuco | < 0,09 c/u |

Es un control de cordura por sí solo: caen donde cualquiera que maneje por la
Ciudad esperaría, y el dato oficial ponía a Palermo primero.

### Qué emite el archivo

Dos clases de objeto, distinguidas por la propiedad `t`:

| `t` | Qué es | Cuántos | Para qué |
|---|---|---:|---|
| `"h"` | puntos muestreados adentro de las zonas, cada 60 m, en un solo MultiPoint | 2.449 | alimentan el mapa de calor |
| `"f"` | los polígonos | 19 | contestan al tocar el mapa |

Los puntos existen porque una capa `heatmap` de MapLibre **sólo acepta puntos**, y
porque el difuminado evita prometer un borde exacto que este dato no tiene: el
límite de una zona marcada a mano no es una línea, es un degradado.

Tres puntos del muestreo caen fuera de CABA y **se recortan**: una zona a caballo
del Riachuelo no puede pintar conurbano, donde la app no tiene ningún otro dato
que mostrar.

### El interruptor

Las zonas se prenden y apagan con **su propio botón**, aparte de las capas de
camión, y **arrancan apagadas**. Son datos de naturaleza distinta: la Red y los
gálibos son oficiales y dicen por dónde puede pasar el vehículo; esto es un
juicio de la comunidad sobre dónde no conviene parar. Quien quiere una no
necesariamente quiere la otra, y el sombreado cubre área.

### L-10 · Lo que este dato no dice

- **No tiene grados.** Los polígonos son todos iguales y ninguno se superpone con
  otro dentro de CABA: hay **dos estados**, marcada y no marcada. La app no
  muestra una escala de gravedad porque la fuente no la tiene.
- **Que una zona no esté marcada NO significa que sea segura.** Significa que
  nadie la marcó. Por eso la app **nunca dice "zona segura"**.
- **No hay metodología ni fecha.** No se sabe cuándo se marcó cada zona, con qué
  criterio, ni cuántas personas lo hicieron.
- **Está pensado para repartidores en moto**, no para camiones. Buena parte de su
  valor está en el conurbano, donde esta app todavía no llega.
- **Sólo se muestran 8,8 km²** de los 204 de la Ciudad. El resto no está evaluado.


### L-11 · Fuera de CABA el mapa calla, y ese silencio se lee como seguridad

**Detectado el 01/09/2026, sin resolver.** Ninguna de las capas propias —zonas de
riesgo, Red de Tránsito Pesado, gálibos, pasos a nivel, radares— existe fuera del
límite de la Ciudad, y **la app no lo dice**. En pantalla, Dock Sud e Isla Maciel
se ven idénticos a un barrio sin registros: limpios.

Para un camionero eso es exactamente al revés de la verdad, y contradice la regla
del proyecto: donde falta el dato, se dice que falta. El arreglo es un aviso
cuando el mapa sale del área cubierta.

**Congelada por decisión, no por olvido (01/09/2026).** El objetivo declarado es
que la aplicación cubra el AMBA cuando salga al público, y la información está en
recopilación. Hasta tener esa base de datos **no se toca nada de este sector**:
el aviso de "saliste del área cubierta" y la ampliación al conurbano son el mismo
trabajo mirado desde dos lados, y hacer el aviso ahora significaría escribir el
límite de la cobertura en el código para tener que reescribirlo entero después.

Se retoma cuando estén los datos del AMBA, y ahí no es un aviso: es replicar para
el conurbano todo lo que hoy existe para CABA —Red, gálibos, pasos a nivel,
radares, zonas— más el aviso para lo que quede afuera de eso.
