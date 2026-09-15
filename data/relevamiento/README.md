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
