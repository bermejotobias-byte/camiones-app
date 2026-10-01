# Relevamiento de puntos de interés aptos para camiones — diseño

**Fecha:** 15/09/2026 · **Estado:** aprobado en conversación, pendiente de revisión escrita
**Alcance:** la base de datos de POIs. La interfaz que los muestra queda para después.

## 1. Por qué

La app calcula *cómo llegar*; los POIs responden *dónde parar*. El subsistema existe
desde el MVP —modelo, dataset embebido, seed, `GET /api/pois`, 24 tests— pero los
datos no sirven para lo que importa: de 78 puntos, **75 no declaran si reciben
camiones** (L-6), sólo hay 25 estaciones y 25 gomerías (el script de OSM corta ahí),
no existe la categoría de lugares para comer, y **la app web no los muestra**: el
botón *Lugares* era de la interfaz MAUI vieja y no sobrevivió a la mudanza.

Pedido del usuario (15/09/2026): ampliar la base con **gomerías, estaciones de
servicio y lugares para comer donde se pueda estacionar el camión**, con búsqueda
extensiva y **evidencia de que son aptos**, no por el mero hecho de existir.

## 2. Decisiones tomadas con el usuario

| Decisión | Qué se decidió | Fecha |
|---|---|---|
| Fuentes | **Cambia la regla del proyecto.** Google Maps se usa como referencia para descubrir y verificar POIs — nunca como base que se copia, nunca para el mapa ni el ruteo. Se usan todas las vías de acceso a información disponibles | 15/09/2026 |
| Alcance | **CABA más el anillo de acceso** (opción b): la Ciudad y una franja de ~2 km sobre la General Paz, el Riachuelo y los accesos. Los puntos de afuera se marcan como tales | 15/09/2026 |
| Evidencia | Se busca por **las tres vías** —operador, señales, reseñas— y **una reseña de conductores alcanza para dar el punto por aprobado**: se marca apto para el tipo de camión que la reseña menciona, con la condición de que la ficha diga *"según reseñas de conductores, consultadas el <fecha>"* | 15/09/2026 |
| Método | Híbrido (opción C): candidatos por script, evidencia a mano | 15/09/2026 |

## 3. Alcance geográfico

Rectángulo **`-34.725, -58.555` / `-34.505, -58.315`** (lat/lon). Cubre CABA
entera, las colectoras de la General Paz, el Mercado Central (La Matanza), Dock
Sud, Lomas del Mirador y los accesos Riccheri, Dellepiane y Cámpora.

Un punto fuera del límite de la Ciudad lleva `Neighbourhood` vacío y la localidad
en `Address` — el patrón que ya usa *Auxilio Full Truck*. El criterio no es el
límite político sino *"sirve para un viaje que empieza o termina en CABA"*.

**No es la L-11.** La cobertura del AMBA sigue congelada; esto es un anillo de
servicios alrededor de la Ciudad, no ampliar el mapa.

## 4. La regla de fuentes, reescrita

Queda en `CLAUDE.md` y en `docs/data-sources.md`:

> **Mapa base y ruteo: OpenStreetMap, nunca Google Maps ni Waze.** Para los
> **puntos de interés**, desde el 15/09/2026 Google Maps se usa como **referencia
> de descubrimiento y verificación**: para encontrar candidatos, leer la ficha
> pública del comercio y las reseñas de conductores. **No se copia su base**: cada
> dato del registro cita de dónde salió, las coordenadas se toman de OSM o de un
> registro oficial cuando existen, y lo que sale de una ficha o de reseñas se
> guarda como **resumen propio con fecha de consulta**, nunca como texto copiado.

## 5. Cambios en el modelo

### 5.1 Categoría nueva

`PoiCategory.TruckFriendlyEatery = 5` — *comida con lugar para el camión*.
Sumar el valor es seguro: `Category` se guarda como texto (`HasConversion<string>`)
y el endpoint valida por nombre; una categoría desconocida sigue dando 400.

### 5.2 La evidencia

`PointOfInterest.SuitabilityEvidence` — `string?`, hasta 600 caracteres. Dice
**por qué** creemos que es apto y **desde cuándo**:

- *"El operador publica playa para camiones y gasoil grado 3 (web, 15/09/2026)."*
- *"Según reseñas de conductores consultadas el 15/09/2026: entran semis, playa amplia, atención de noche."*
- *"Nombre y etiqueta `hgv=yes` en OSM (15/09/2026)."*

Va en la ficha del punto. Migración `AddPoiSuitabilityEvidence`.

### 5.3 Niveles de verificación, con el significado actualizado

| Nivel | Significa desde el 15/09/2026 |
|---|---|
| `Confirmed` | Lo dice el **operador**, una **fuente oficial**, o **reseñas de conductores** que cuentan haber entrado con el camión. Decisión del usuario: con reseña, el punto está aprobado |
| `Probable` | Señales indirectas sin declaración ni testimonio: el nombre (*"Gomería del Camionero"*), una etiqueta de OSM, fotos de la ficha con camiones |
| `NotConfirmed` | Existe, pero nadie dice si recibe camiones |

Se actualizan los comentarios del enum y `docs/pois.md`. El test *"un Confirmed no
se apoya sólo en OSM"* sigue valiendo: OSM solo es señal, no testimonio.

### 5.4 La aptitud, por tipo de camión

Los cuatro `bool?` se marcan **sólo para los tipos que la evidencia menciona**. Una
reseña que dice "entré con el semi" marca `SuitableForSemiTrailer = true` y deja
los otros tres en `null`; el operador que dice "camiones" sin más marca liviano y
pesado. Nunca `false` por ausencia: `null` sigue siendo "no consta".

### 5.5 El seed y los datos de muestra

Hoy `PointOfInterestSeed` sólo hace upsert sobre filas con `IsSampleData = true`.
Un archivo con `isSampleData: false` —que es lo que `docs/pois.md` promete para un
relevamiento de producción— se volvería a insertar en cada arranque y chocaría por
clave en el segundo. Además `PoiDatasetTests` afirma que *todos* los puntos son
sample.

Arreglo: `PointOfInterest.ManagedByDataset` (`bool`), **true para toda fila que
venga de los archivos embebidos**. El seed hace upsert sobre esas filas y borra
las que salieron del archivo; lo que cargue un usuario algún día (`false`) no se
toca. `IsSampleData` conserva su significado —dato inicial del MVP contra
relevamiento curado— y el archivo nuevo va con `isSampleData: false`. Misma
migración que 5.2.

Se escribe primero el test que hoy falla (dos archivos, dos arranques), después el
arreglo. El test de "todo es sample" pasa a *"los archivos de agosto son sample; el
relevamiento no"*.

## 6. Fuentes y proceso

### 6.1 Candidatos por script

`data/fetch-poi-candidatos.ps1` escribe en `data/relevamiento/`:

- **`candidatos-osm.json`** — Overpass sobre el rectángulo, **sin corte** por
  categoría: `amenity=fuel`, `shop=tyres`, `shop=truck_repair|truck`,
  `amenity=truck_stop`, `amenity=parking` con `hgv`, y comida
  (`restaurant|fast_food|cafe|food_court`) con `hgv`. Medido el 15/09/2026:
  **435 estaciones, 174 gomerías, 0 `truck_stop`, 0 comedores con `hgv`**, 9
  playas `hgv` sin nombre.
- **`candidatos-energia.json`** — el registro oficial de estaciones de la
  Secretaría de Energía (*Precios en surtidor, Res. 314/2016*, datos.energia.gob.ar,
  **CC-BY-4.0**): cada estación con coordenadas, bandera, dirección, localidad y
  productos (gasoil grado 2 y 3, GNC). 1.630 filas para Capital Federal más las
  localidades del anillo. Es la lista completa con licencia clara; se cruza con OSM
  por cercanía (≤ 80 m) para heredar nombre, horario y teléfono cuando OSM los tiene.

Los dos archivos son intermedios pero **se versionan**: el próximo relevamiento
parte de ahí y puede diferenciar qué cambió.

### 6.2 Evidencia a mano, por las tres vías

Para cada candidato, en este orden y hasta encontrar evidencia:

1. **Operador** — el sitio de la marca o del comercio. Las redes de estaciones para
   camiones de YPF, Axion, Shell y Puma se verifican en sus páginas oficiales, no
   de memoria. Una gomería cuya web dice "camiones y semis". Un parador que publica
   "playa para camiones".
2. **Señales** — el nombre, las etiquetas de OSM (`hgv`, `fuel:HGV_diesel`), las
   fotos y la descripción de la ficha pública en Google Maps.
3. **Reseñas** — qué cuentan los conductores en la ficha pública. Se leen, se
   resumen en nuestras palabras con la fecha, y se anota qué tipo de camión
   mencionan.

Más búsqueda web y directorios del sector: el sitio del Mercado Central (servicios
del predio), cámaras del transporte, guías del transportista.

**Google Maps se consulta desde el navegador**, ficha por ficha. Es lento y es el
grueso del trabajo; por eso va por etapas y por categoría.

### 6.3 Regla de entrada

| Categoría | Entra si… |
|---|---|
| Gomerías | **Sólo con evidencia** de que atienden camiones (`Confirmed` o `Probable`). Una gomería de autos no le sirve a nadie en esta app |
| Comer | **Sólo con evidencia** de lugar para el camión. Es la definición de la categoría |
| Estaciones | Con evidencia, como las otras. **Y también sin evidencia** (`NotConfirmed`) si está sobre la Red de Tránsito Pesado o un acceso: una estación es útil igual, y el registro oficial la respalda |

### 6.4 Zonas prioritarias

Los corredores de la Red de Tránsito Pesado; los accesos Riccheri, Dellepiane,
Cámpora y Perito Moreno; Puerto, Barracas, Pompeya, Mataderos, Villa Soldati y
Lugano; las colectoras de la General Paz; el Mercado Central.

## 7. El archivo

`src/TruckNavigator.Infrastructure/Data/pois-caba-relevamiento-2026-09.json`.
Mismo esquema que los archivos de agosto más `suitabilityEvidence`; `isSampleData:
false`. `PoiDataset` lo levanta solo porque toma todo `pois-*.json`.

Por punto: `name`, `category`, `address`, `neighbourhood` (null fuera de CABA),
`latitude`/`longitude` (de OSM o del registro oficial; Google sólo para confirmar),
`phone`, `website`, `openingHours`, `description`, `services`, los cuatro
`suitableFor…`, `source` (las URLs consultadas, con fecha), `sourceRetrievedOn`,
`verificationLevel`, `suitabilityEvidence`.

Un punto que ya existe en `pois-caba-osm.json` y gana evidencia **se mueve** al
archivo nuevo (mismo `source` de OSM → mismo id), no se duplica: el test de ids
únicos lo garantiza.

`data/relevamiento/README.md` documenta el método para que se pueda repetir.

## 8. Tests

Nuevos o modificados, todos rojos antes de verdes:

- Dataset: todo `Confirmed`/`Probable` tiene `suitabilityEvidence` no vacía **con
  una fecha**; un `Confirmed` no se apoya sólo en OSM; ninguna gomería ni comedor
  entra `NotConfirmed`; todo punto cae en el rectángulo del §3; ids únicos entre
  todos los archivos; los archivos de agosto son sample y el relevamiento no.
- Persistencia: el seed con un archivo no-sample arrancado dos veces no duplica;
  un punto no-sample que sale del archivo desaparece; una fila con
  `ManagedByDataset = false` no se toca; `SuitabilityEvidence` sobrevive el viaje.
- API: `categories=TruckFriendlyEatery` es válida; la respuesta incluye
  `suitabilityEvidence`.
- Dominio: `PoiSuitability` no cambia; un test fija que la categoría nueva no
  altera la regla de aptitud.

## 9. Etapas de ejecución

Cada etapa termina verificada antes de empezar la siguiente, y con su commit.

| # | Etapa | Verificación |
|---|---|---|
| 1 | Regla en `CLAUDE.md` y `data-sources.md`; categoría; `SuitabilityEvidence`; `ManagedByDataset`; migración; seed; DTO | Tests rojo → verde; `dotnet test` completo; backend arriba; `GET /api/pois?categories=TruckFriendlyEatery` → 200 `[]`; `GET /api/pois` sigue devolviendo los 78 |
| 2 | `fetch-poi-candidatos.ps1` y los dos archivos de candidatos | Conteos impresos por categoría y por zona; muestra de 10 revisada a mano; cruce OSM–Energía con tasa de coincidencia |
| 3 | Gomerías: pasada de evidencia, entradas al archivo | Tests del dataset verdes; `GET /api/pois?categories=TyreShop` con el conteo nuevo; cada entrada con evidencia legible |
| 4 | Estaciones: igual | Igual, más cuántas quedaron `NotConfirmed` y por qué |
| 5 | Comer: igual | Igual; el número final, aunque sea chico, queda escrito |
| 6 | Cierre: L-5 y L-6 con los números nuevos, `docs/pois.md`, skills de estado y producto | Docs coherentes con el dataset; conteos que cita el doc = conteos del test |

## 10. Fuera de alcance

- **La interfaz**: la capa del mapa, el botón de lugares, la ficha, "usar como
  destino". Se construye después, sobre esta base y con el prototipo de diseño.
- **Aptitud aportada por usuarios** (Fase 5/6): sigue siendo conversación pendiente.
- **Playas y auxilio pesado**: no están en el pedido; L-5 sigue como está.
- **Cambiar coordenadas del mapa o del ruteo por Google**: no; la regla nueva es
  sólo para POIs.

## 11. Lo que hay que decir aunque duela

- **Comer con estacionamiento adentro de CABA va a ser una lista corta.** OSM no
  tiene ni un caso; la Ciudad desalienta el camión pesado (es de lo que trata la
  Ley 2148). El número real queda escrito como limitación, no rellenado.
- **Las reseñas envejecen.** Por eso la evidencia lleva fecha y el registro lleva
  `sourceRetrievedOn`: un relevamiento es una foto, no una verdad.
- **Google no se cita como fuente de coordenadas.** Si un lugar no está en OSM ni
  en el registro oficial, la coordenada se toma de la dirección geocodificada con
  Photon (que ya usa el proyecto) y se dice.
