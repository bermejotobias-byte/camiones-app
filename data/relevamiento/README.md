# Relevamiento de POIs para camiones — método

Es el registro de cómo se armó `pois-caba-relevamiento-2026-09.json`, para que
el próximo relevamiento parta de acá y no de cero. Spec:
`docs/superpowers/specs/2026-09-15-pois-camiones-relevamiento-design.md`.
Plan: `docs/superpowers/plans/2026-09-15-pois-camiones-relevamiento.md`.

## Candidatos

`../fetch-poi-candidatos.ps1` genera `candidatos-osm.json` (OSM completo en el
rectángulo, sin corte) y `candidatos-energia.json` (registro oficial de estaciones
de la Secretaría de Energía, Res. 314/2016, CC-BY-4.0, cruzado con OSM a ≤ 80 m).
Los dos marcan `enRedPesada` (a ≤ 40 m de un tramo de la Red de Tránsito Pesado)
y `calleRed`.

**Corrida del 15/09/2026** (Overpass `overpass-api.de`; la instancia de kumi
estaba saturada):

- OSM: **599 candidatos** — 419 estaciones, 168 gomerías, 9 playas `hgv`, 3
  talleres de camiones, **0 `truck_stop` y 0 comedores con `hgv`**. 516 con
  nombre; 121 sobre la Red.
- Energía: **389 estaciones** en el rectángulo (221 en Capital Federal), **380
  cruzadas con OSM** (97,7 %), 73 sobre la Red, 196 con GNC. Banderas: YPF 135,
  Shell 95, blanca 70, Axion 47, Puma 25, Dapsa 11, Gulf 4, Voy 2.

Muestra de 10 revisada con geocodificación inversa (Photon): las 5 gomerías
coinciden calle y altura; de las 5 estaciones, 2 coinciden exactas y 3 caen en la
esquina y Photon devolvió la calle transversal (Chiclana/Boedo, Amancio
Alcorta/Montesquieu, Montes de Oca/Río Cuarto) — coordenadas correctas.

## Evidencia, por las tres vías

Para cada candidato, en este orden y hasta encontrar evidencia:

1. **Operador** — el sitio de la marca o del comercio (`Operator` / `Official` → `Confirmed`).
2. **Señales** — nombre, etiquetas de OSM, fotos y descripción de la ficha pública (`Signals` → `Probable`).
3. **Reseñas** — lo que cuentan los conductores en la ficha pública, resumido con fecha (`Reviews` → `Confirmed`).

Google Maps se usa como referencia para 2 y 3. No se copia texto: la evidencia
es un resumen propio y dice la fecha. Las coordenadas salen de OSM o del registro
oficial; si un lugar no está en ninguno, se geocodifica la dirección con Photon y
se dice en `source`.

## Regla de entrada

- Gomerías y lugares para comer: sólo con evidencia (`Confirmed` o `Probable`).
- Estaciones: con evidencia, y también `NotConfirmed` si `enRedPesada` es true.

## Formato de cada entrada

La plantilla y sus reglas están en el plan (Task 8): `source` empieza por la
evidencia y termina con la coordenada de OSM; `suitableFor…` sólo `true` para los
tipos que la evidencia menciona; `suitabilityEvidence` lleva fecha `DD/MM/AAAA`.

## Búsquedas de descubrimiento hechas

### Gomerías — 15/09/2026

**Google Maps** (búsqueda `/maps/search/<texto>/@lat,lon,zoom`, panel de
resultados leído hasta el final; cada candidato con señal se abrió aparte para
leer las reseñas):

| Texto | Centro / zoom | Qué dejó |
|---|---|---|
| gomería para camiones | -34.65,-58.42 · 13 | genéricas, sin señal |
| gomeria camion 24 horas | -34.66,-58.45 · 12 | El Misionero (reseña: de pesados) |
| gomeria de pesados | -34.65,-58.44 · 12 | Marchionno, TAST, Ombú Gral. Paz, Truck Center LG, recapados.com |
| gomeria camiones | -34.63,-58.50 · 12 | Gomería de auto y camión (Cnel. Mom) |
| neumaticos camion semirremolque | -34.67,-58.40 · 12 | Calzetta Truck Center |
| gomeria pesados camiones | -34.69,-58.38 · 13 | TAST (reseña: trabajan con camiones) |
| neumaticos para camiones | -34.65,-58.43 · 12 | Calzetta Perón 3420 (reseña: camiones y autoelevadores) |
| gomería camiones Mataderos | -34.655,-58.505 · 14 | nada nuevo: 20 fichas, todas de autos |
| gomería de pesados Liniers | -34.645,-58.52 · 14 | nada nuevo |
| gomería camiones Dock Sud Avellaneda | -34.665,-58.35 · 14 | El Cordobés (reseña: camiones y máquinas viales) |
| gomería camiones Villa Soldati Lugano | -34.675,-58.46 · 14 | Auxilios Mecánicos Pesados 24hs; el resto sin señal |
| gomería de pesados | -34.615,-58.435 · 12 (toda la Ciudad) | repite lo ya encontrado |
| neumáticos para camiones | -34.615,-58.435 · 12 | repite lo ya encontrado |

**Sitios de operadores** leídos: ombuneumaticos.com.ar (3 sucursales),
calzetta.com.ar (Truck Center y sucursales), neumatex.com.ar (casa central y
planta Recamic), recapados.com (Distribuidora Martelli y Truck Center LG),
storinoneumaticos.com. La Unión Neumáticos (Córdoba y Olavarría) quedó fuera.

**Registro oficial**: listado REG-04 de plantas de reconstrucción de neumáticos
certificadas por INTI, publicado por ARAN (aranargentina.com). De sus 22
plantas, cinco caen en el rectángulo o cerca: Storino (Flores), Bandasur
(Barracas), Neumatex (La Matanza), Distribuidora Martelli (Vicente López) — las
cuatro entraron como `Official` — y Preking (Villa Bosch), que queda fuera.
Neumáticos Antártida (Lomas de Zamora) y Tast SA (Morón) están fuera del
rectángulo; la gomería TAST de Pompeya entró por reseñas, no por la planta.

**Resultado**: 16 gomerías con evidencia (14 `Confirmed`: 4 por registro
oficial, 5 por el operador, 5 por reseñas; 2 `Probable` por señales) y 1
auxilio mecánico pesado (`Probable`). Verificado por la API el 15/09/2026:
`GET /api/pois?categories=TyreShop` devuelve 41 puntos, 16 del relevamiento.

### Estaciones de servicio — 15/09/2026

**Las redes de las marcas, leídas en sus sitios** (lo que cada una declara por
estación, y si sirve como evidencia):

| Marca | Fuente oficial | Qué declara por estación | Sirve |
|---|---|---|---|
| YPF | `mapa.ypf.com` (JSON público `magui.ypf.com/boxes/eess/get/`, 1.740 bocas) | `AZUL32` (surtidor de urea para diésel pesado), `TIPO_DESPACHO` (GNC/dual/líquidos), `TIPO_UBICACION` (urbana/autopista), estado activa/inactiva. El campo `YER` (YPF Ruta) viene vacío | **Sí: Azul 32.** Dentro del rectángulo son 2 de 135 |
| Shell | `find.shell.com/ar` (directorio público; 93 estaciones en el rectángulo, leídas una por una) | amenities `truck_parking`, `hgv_lane`, `truckport`, `adblue_truck`, `high_speed_diesel_pump`; `truck_diesel` es el gasoil común | **Sí: `truck_parking`.** Una sola de 93 (Edison 1610, Dock Sud) |
| Axion | `axionenergy.com/wp-json/axion/v1/estaciones` (640 bocas) | GNC, diésel X10, tarjeta de flota `AXIONcard` (49 de 50 la aceptan), duchas, reparto capilar | **No**: nada específico de camiones en las 50 del rectángulo |
| Puma | `pumaenergy.com.ar` no respondió; `pumaenergy.com/es/country/argentina` no lista estaciones | — | No |
| YPF Ruta / Axion Card / Shell Card | páginas de las tarjetas de flota | aceptación de la tarjeta | **No cuenta como aptitud**: una estación urbana acepta la tarjeta y atiende utilitarios |

**El registro oficial como lista**: `candidatos-energia.json`, 389 estaciones en
el rectángulo, 73 a menos de 40 m de la Red de Tránsito Pesado. La regla de la
spec (§6.3) las hace entrar como `NotConfirmed` aunque no tengan evidencia.

**Depuración del registro**, porque conserva bocas que ya no existen: cada
estación se cruzó con el mapa oficial de su marca (YPF/Shell/Axion, a ≤ 100 m y
activa) y las 17 de otras banderas se buscaron una por una en la ficha pública.
Descartadas 5: YPF Antártida Argentina y Calle 10 (inactiva en el mapa de YPF y
cerrada según la ficha), Shell Juan B. Justo 8490 (no está en el directorio de
Shell y la ficha la marca cerrada), GNC San Cayetano en Juan B. Justo 5940
(cerrada según la ficha), y dos sin bandera —Av. Gral. Paz 7499 y Francisco
Beiró 2801— que ni OSM ni la ficha ubican en esa dirección. **La fecha del último
precio informado NO sirve como señal de cierre**: 20 estaciones abiertas dejaron
de informar en 2025-06 a la vez.

**Reseñas**: en las fichas de las estaciones de los corredores de camiones
(Coronel Roca ×2, Fernández de la Cruz, Escalada, Dellepiane, Antártida
Argentina) no aparece la palabra camión entre las palabras clave ni en las
reseñas visibles; ninguna estación entró por reseñas.

**Google Maps** (descubrimiento): "estación de servicio para camiones" @
-34.635,-58.45 z12 y "estación de servicio camiones Mercado Central Tapiales"
@ -34.705,-58.49 z14 — devuelven las YPF de siempre; las dos con Azul 32 ya
estaban por el mapa de YPF.

**Resultado**: 71 estaciones — **5 `Confirmed`** (operador: 2 YPF con Azul 32,
1 Shell con playa para camiones; oficial: las 2 YPF de la Riccheri que figuran
en el Acta Compromiso Transporte de 2020, ver "Lugares para comer"), **0
`Probable`**, **66 `NotConfirmed`** sobre 33 calles de la Red (Juan B. Justo 10,
Beiró 6, Dellepiane 5, San Martín 4, Eva Perón 4, …). Nueve de ellas estaban en
el dataset de OSM de agosto y se mudaron al relevamiento con la misma
referencia de OSM. Verificado por la API el 15/09/2026:
`GET /api/pois?categories=FuelStation` devuelve 87 puntos, 71 del
relevamiento.

### Lugares para comer con lugar para el camión — 15/09/2026

OSM no tiene ni un `amenity=restaurant` con `hgv` en el rectángulo, así que todo
fue descubrimiento.

**Google Maps** (mismo método que las gomerías):

| Texto | Centro / zoom | Qué dejó |
|---|---|---|
| comedor camioneros | -34.66,-58.43 · 12 | "Los Camioneros" (Luna 100, Parque Patricios) y comedores sociales; ningún parador |
| parador camiones | -34.66,-58.43 · 12 | paradores de ruta fuera del rectángulo (Campana, Pablo Podestá, RN 14, RN 9) y guarderías de camiones |
| parrilla camioneros estacionamiento camiones | -34.66,-58.43 · 12 | Parrilla El Camionero (Grand Bourg, fuera) y guarderías de camiones |
| estación de servicio camiones Mercado Central Tapiales | -34.705,-58.49 · 14 | las YPF de la Riccheri |
| comedor parrilla Mercado Central de Buenos Aires | -34.71,-58.495 · 15 | Comedor San Cayetano y Parador La Carpa (adentro del predio), 222 Tu Parada Central (colectora) |

**Web**: "parador para camioneros Capital Federal" llevó al Acta Compromiso
Transporte (Ministerio de Transporte, YPF y Camioneros, 24/03/2020) y su
Anexo I con 260 estaciones YPF comprometidas como punto de parada para
camioneros (descanso, comida las 24 h, baños). Dos caen en el rectángulo: las
YPF de la Riccheri lado Capital y lado Ezeiza, a la altura del Mercado Central.
**Entraron como estaciones (`Official` → `Confirmed`), no como lugar para
comer**: son estaciones con Full, y un mismo lugar no va dos veces. El Centro de
Transferencia de Cargas de Villa Soldati tiene comedores, estación y gomerías
adentro, pero con control de ingreso para operadores: no es un POI público.

**El Mercado Central** (mercadocentral.gob.ar, Wikipedia): 210 ha, unos 700
camiones por día, acceso norte mixto (autos y camiones) desde la salida 17 de
la Riccheri y acceso sur de carga; adentro hay comedores (OSM lista cuatro
restaurantes más: Las Chicas de las Tres, Tienda el Tano, Rosa de Saron, Lo de
Nico — no verificados).

**Resultado: 1 punto**, Comedor San Cayetano, `Probable` por señales (está
adentro del predio del Mercado Central; sin playa propia declarada). Verificado
por la API el 15/09/2026: `GET /api/pois?categories=TruckFriendlyEatery`
devuelve 1. **Dentro de la Ciudad no se encontró ningún lugar para comer con
evidencia de lugar para el camión**: lo que hay son las estaciones Full de la
autopista y los comedores del Mercado Central.

## Descartados por falta de evidencia

### Gomerías — 15/09/2026

Sin señal de camiones ni en el nombre, ni en la ficha, ni en las reseñas
(palabras clave de las reseñas leídas el 15/09/2026):

- Gomería El Patrón (Av. Eva Perón 4414), Gomería Espinosa (Av. Rabanal 2903),
  Gomería Poly (Av. Alberdi 7260, 24 h — reseñas de autos), "24hs" (Av. Fernández
  de la Cruz 6365 — reseñas de motos y parches), Gomería Tata Beraldi (Cnel.
  Suárez 1106), Kaucho's 24hs (Irigoyen 2579).
- Neumatex sucursal Mataderos (Av. Alberdi 5367): la cadena declara recapado de
  camión y alineación para transportes, pero no dice en qué sucursal y las
  reseñas de la sucursal son de autos. Entró sólo la casa central de Lomas del
  Mirador, donde está la planta.
- "Truck neumaticos" (Avellaneda, sin dirección ni reseñas): no se pudo ubicar.

Fuera del rectángulo: Grupo Portu (J. L. Suárez), Recapados Mufasa (San Justo),
Gomería Antonella (Villa Zapiola), Preking Recapados (Villa Bosch, lon -58,59).

Sin coordenada verificable: ninguna al cierre — Ombú Díaz Vélez 1034 (Ciudadela)
entró con la esquina de Díaz Vélez y Ombú, marcada como aproximada.

**Dos descartes que se revirtieron** al leer al operador: Truck Center LG se
había anotado como fuera del rectángulo ("Boulogne") y está en Villa Adelina, a
-34,511 / -58,533; recapados.com se había anotado "sin declaración de camiones" y
su sitio declara gomería y mecánica para transporte pesado, además de estar en
el listado INTI/ARAN.

### Estaciones de servicio — 15/09/2026

Cerradas o inexistentes (ver "Depuración del registro" arriba): YPF Antártida
Argentina y Calle 10 (idempresa 6852), Shell Juan B. Justo 8490 (640), GNC San
Cayetano Juan B. Justo 5940 (5270), sin bandera Av. Gral. Paz 7499 (158), sin
bandera Francisco Beiró 2801 (2126).

Fuera de la Red y sin evidencia: las otras 316 estaciones del registro no
entran, por la regla de la spec.

Una misma boca con dos `idempresa` (líquidos y GNC): Zelarrayán 5530 (1052 y
10264) se fusionó en una entrada; el candado
`No_two_points_of_the_same_category_share_the_same_spot` lo atrapa si vuelve a
pasar.

### Lugares para comer — 15/09/2026

- "Los Camioneros" (Luna 100, Parque Patricios, sobre Amancio Alcorta): el
  nombre es la única señal; 157 reseñas de comida económica sin mención de
  camiones ni de dónde dejarlos. No entra: un restaurante sin lugar para el
  camión no es de esta categoría.
- "222 Tu Parada Central" (Av. de Circunvalación 5150, Tapiales, 24 h): las
  reseñas mencionan estacionamiento con seguridad pero no camiones; el sitio del
  operador (panchos222.com) no dice nada de transportistas y da otra altura.
- "Parador La Carpa" (De la Tierra 2252, Mercado Central): está en el sector de
  compras minoristas, con playa de autos; sin señal de camiones.
- Fuera del rectángulo: Parador del Puerto (Campana), Parador "12" (Pablo
  Podestá), Parrilla El Camionero (Grand Bourg), Parador de camiones km 296
  (RN 14).
