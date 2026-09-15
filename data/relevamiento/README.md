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

(Se completa en cada etapa: texto, zona, fecha.)

## Descartados por falta de evidencia

(Se completa en cada etapa.)
