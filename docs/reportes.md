# Reportes de la comunidad

Lo que un camionero ve en la calle —un accidente, un control, una obra, un
puente bajo— reportado en un toque desde su posición, confirmado o rechazado
por los que pasan después, vivo mientras siga siendo relevante y muerto solo
al vencer. Es la Fase 5 del roadmap; el porqué de cada decisión está en AD-49
y en la spec `docs/superpowers/specs/2026-09-19-reportes-comunidad-design.md`.

La lógica entera cabe en una línea:

> usuario reporta → aparece → otros lo confirman o rechazan → cambia su
> confiabilidad → permanece mientras sirva → expira.

Y las dos reglas de la casa rigen acá también: **un dato de la comunidad no se
muestra igual que uno oficial** (los radares del GCBA y los gálibos de OSM
siguen siendo lo que son; un reporte es un reporte, con su pin propio), y
**donde falta el dato se dice que falta** (un reporte sin calle dice "cerca de
acá", no inventa una).

---

## El catálogo

Los tipos viven en el dominio (`ReportCatalog`), no en la base: agregar uno es
una fila ahí y un valor en el enum, sin migración. Cada número es una constante
con nombre, fijada por test, para que cambiarla sea una decisión y no un
accidente.

| Tipo | Clase | Vida útil | Se vuelve fijo |
|---|---|---|---|
| Tránsito | información | 45 min | — |
| Policía | información | 1 h | — |
| Accidente · Control · Peligro | información | 2 h | — |
| Cámara | información | 6 h | **sí, con 5 confirmaciones** |
| Calle cerrada | **restricción** | 12 h | — |
| Bache · Obra | información | 7 días | — |
| Gálibo bajo (con los metros, 2,0–6,0) | **restricción** | 30 días | — |

El usuario sacó del catálogo inicial *vehículo detenido* y *límite de peso*
(19/09/2026). **Información** avisa; **restricción** además puede cambiar la
ruta, y sólo validada.

## Qué guarda un reporte

Se reporta **sólo en la posición GPS** de quien reporta (decisión del usuario:
nunca en un punto elegido a mano; es lo que hace creíble el dato y lo que
permite exigir cercanía para votar). Con el fix del teléfono viaja lo que
traía:

- **El rumbo**, sólo si iba a 2 m/s o más (`Report.MovingSpeedMps`): el rumbo
  de un vehículo parado no significa nada. Sirve para avisar sólo a quien va
  en el mismo sentido (±90°) y para orientar el bloqueo a lo largo de la calle.
- **La calle**: en viaje, la del paso actual (la de la píldora negra); si el
  cliente no la sabe, el servidor se la pide a Photon con **1,5 s de tope**
  (`ReportWriter.StreetLookupTimeout`) y si no llega queda `null`. Un reporte
  nunca se demora ni se rechaza por la calle.
- **El valor**: los metros del gálibo. Los demás tipos lo ignoran aunque llegue.

Los contadores de confirmaciones y rechazos son una copia de las filas de
votos para leer barato; la verdad son las filas y quien vota los recuenta.

## Confiabilidad, validación y vencimiento

Todo se **calcula al leer**, con funciones puras del dominio y el reloj como
parámetro. No hay tareas de fondo: vencido es que `ExpiresAt` ya pasó y la
consulta lo filtra; lo rechazado y lo cerrado por su autor vencen en el acto.

**Confiabilidad** (`ReportStanding`, 0–100):

```
base      = 35 + 0,30 × reputación del creador
apoyo     = 12 × min(confirmaciones, 4)
castigo   = 18 × rechazos
frescura  = 1 − 0,40 × (edad / vida útil), acotada; lo fijo no envejece
score     = clamp((base + apoyo − castigo) × frescura, 0, 100)
```

Recién creado por alguien promedio: 50. Con dos confirmaciones: 74. Con dos y
un rechazo: 56. De alguien con reputación 10: 38, y con dos confirmaciones 62
—**no llega a validarse: le hace falta una tercera**—. A mitad de vida un 50
vale 40; al vencer, 30.

**Etiqueta** (lo que la ficha muestra, porque un número no se lee manejando):
*en duda* si hay al menos un rechazo y los rechazos igualan o superan a las
confirmaciones; *confirmado* con al menos una confirmación ajena y score ≥ 60;
*nuevo* el resto — una reputación alta sola no lo vuelve "confirmado".

**Validado** es lo único que habilita a tocar la ruta: **≥ 2 confirmaciones
de personas distintas del creador y score ≥ 70**. Es un estado escrito al
votar (`Status = Validated`), no un recálculo, y es lo que lee el ruteo.

**Vencimiento** (`ReportExpiry`): nace en `CreatedAt + vida útil`; un *sigue
ahí* nuevo lo estira a `max(ExpiresAt, ahora + vida/2)` con tope de **3 vidas**
(una obra confirmada cada día vive hasta 21 días; un aviso de tránsito no pasa
de dos horas y cuarto); con **2 rechazos que superan** a las confirmaciones
vence ahora (`Rejected`); el creador cierra el suyo cuando quiere
(`ClosedByAuthor`). Cambiar el voto reescribe la fila y recuenta, pero **no
vuelve a estirar ni a pagar**.

## Lo que la comunidad vuelve fijo

Decisión del usuario del 19/09/2026: *"una cámara muy marcada es porque es
fija, no tiene sentido que sólo dure 6 hs (…) +5 es un principio"*. El umbral es
`ReportCatalog.FixedThreshold = 5`.

- **Cámara** (`ReportPromotion`): con 5 confirmaciones ajenas pasa a `Fixed`,
  `ExpiresAt = null`, no vence nunca y es un dato de la app. Se sirve por el
  mismo `GET`, se dibuja como cámara de la comunidad (pin celeste, distinto
  del radar oficial) y avisa en la ruta. Sigue aceptando votos: con 5 rechazos
  que superen a las confirmaciones deja de ser fija y vence.
- **Lugar aportado** (`PoiPromotion`, sobre `PoiVoting`): con 5 votos de
  *apto* de un mismo tipo de camión —y más que los del otro lado— el lugar
  queda `Probable`, con `SuitabilityEvidenceKind.Community`, la evidencia
  *"Confirmado apto para camión pesado por 5 camioneros de la comunidad
  (19/09/2026)"* y ese campo de aptitud en `true` (con 5 de *no apto*, en
  `false`). **Los lugares del dataset no se tocan**: AD-46 sigue valiendo para
  lo verificado y se enmienda sólo para lo aportado. `Confirmed` sigue siendo
  exclusivo de una fuente. Ver `docs/pois.md`.

Nada de esto paga EXP aparte.

## Información y ruteo

Los diez tipos **avisan** en el viaje (tarjeta, voz, vibración) cuando están
sobre la ruta —corredor de 30 m, como los radares— y en el sentido de marcha.
Sólo dos pueden **cambiar la ruta**, y sólo validados:

| Tipo | Bloquea para… |
|---|---|
| Calle cerrada | todos los camiones |
| Gálibo bajo | los camiones con `HeightMeters > valor` |

**Cómo**: `RouteBlockades` (infraestructura) lee los reportes restrictivos
validados o fijos y vigentes que le tocan a ese camión y los convierte en
`RouteBlockade` (dominio). Cada uno es un polígono en `CustomModel.Areas` del
pedido a GraphHopper —rectángulo de **40 × 16 m** a lo largo del rumbo si lo
hay, cuadrado de 24 m si no; menos que los ~100 m entre calles paralelas, así
que bloquea esa cuadra y no la de al lado— con una sentencia `in_r1` de
prioridad cero, después de las reglas físicas. Sin bloqueos el custom model
es byte a byte el de siempre. El calculador los pide una vez por pedido: ruta,
alternativas y la matriz del reparto, y `/api/trips/active`, que recalcula,
también los esquiva. `RouteOffer` y AD-47 no cambian.

Medido el 19/09/2026 contra GraphHopper 11 vivo: un bloqueo validado en el
medio de una cuadra saca la ruta a más de 15 m; sin validar la ruta es la
misma. Y de punta a punta con tres cuentas: un gálibo de 3,80 m sobre Av.
Dorrego, sin validar, no cambia nada (11.524 m, pasa a 0 m); con dos
confirmaciones queda validado y la ruta del camión de 4,2 m pasa a 1.771 m
del puente; el de 3,8 m lo ve `compatible` y su ruta no cambia.

**El gálibo con el camión** (`ReportRelevance.ForTruck`): 3,80 reportado es
incompatible para 4,10 y compatible para 3,60 y para 3,80 justo. Incompatible
pinta el pin en **rojo**, la voz dice "tu camión no pasa", vibra como peligro
y, validado, la ruta lo esquiva.

**Lo que esta versión no hace**: si un cierre se valida mientras estás en
viaje sobre esa calle, la app avisa ("Calle cerrada confirmada adelante") pero
no recalcula sola. El aviso de un cierre sin validar dice "sin confirmar".

## EXP y reputación, separadas

La **EXP** es de la gamificación y mide esfuerzo; la **reputación** mide
credibilidad como fuente. Son dos cosas y no se mezclan.

| Hecho | EXP | Clave del libro | Condición |
|---|---|---|---|
| Un reporte tuyo queda validado | **15** al creador | `report-validated:{id}` | lo validan otros; una sola vez por reporte |
| Votar un reporte ajeno | **2** | `report-vote:{id}` | una vez por reporte y **hasta 10 votos pagos por día** de Buenos Aires |
| Crear un reporte | **0** | — | reportar solo no paga |

Entra por `ProgressionRecorder` como los aportes a los lugares, con el mismo
índice único. La pista **`reportes`** cuenta reportes validados con la
escalera de viajes (1 · 3 · 7 · 15 · 30 · 60 · 120 · 250 · 500 · 1.000) y
recompensas `reportes-01…10`. Cambiar el voto, retirarlo o que el reporte
muera después no devuelve ni resta.

Por qué así: pagar al crear invita a reportar cualquier cosa; pagar al votar
sin exigir cercanía invita a votar desde el sillón; sin tope diario dos
cuentas se turnan. Farmear necesita cómplices presentes en el lugar, y a esos
los frena la reputación.

**Reputación** (`ReputationScale`): arranca en **50**, vive entre 0 y 100, y se
mueve sólo por lo que la comunidad dice de tus reportes: `+3` la primera vez
que uno queda validado, `−5` cuando uno queda rechazado. No se toca por votar,
no se muestra como número, y sin fila vale 50.

## Contra el abuso

`ReportAbuseGuard` (dominio, puro) y las consultas que lo alimentan:

| Regla | Valor | Respuesta |
|---|---|---|
| Espera entre reportes de la misma cuenta | 45 s (el doble con reputación < 25) | **429** con `retryAfterSeconds` y `Retry-After` |
| Tope por hora | 20 | 429 |
| Duplicado: mismo tipo, activo, a ≤ 150 m y ≤ 15 min | — | **409** con `existingId`; la app ofrece *Sigue ahí* |
| Votar lo propio | — | 403 |
| Votar lejos | > 500 m del reporte | 400 "Tenés que estar cerca para confirmarlo" |
| Fuera del área (el rectángulo de `PoiContribution`) | — | 400 |
| Gálibo fuera de rango | 2,0–6,0 m | 400 |

La posición que acompaña un voto es la del GPS del cliente y el servidor la
confía: la app es el único cliente. Es un límite conocido, no disimulado.

## La API

```
GET /api/reports?bbox=minLon,minLat,maxLon,maxLat&truckId={guid?}
  anónimo; con sesión dice cuál es tuyo y qué votaste. bbox de hasta 0,25° por
  lado (más grande, se recorta al centro). 200 → ReportDto[]

POST /api/reports                              (sesión)
  { type, latitude, longitude, headingDegrees?, speedMps?, street?, value? }
  201 → ReportDto    400 motivo    409 { existingId }    429 { retryAfterSeconds }

PUT /api/reports/{id}/vote?truckId=            (sesión)
  { verdict: "StillThere" | "Gone", latitude, longitude }
  200 → { report, earned }    400 lejos    403 propio    404    410 vencido

DELETE /api/reports/{id}                       (sesión, sólo el creador)
  204
```

`ReportDto`: `id, type, kind ("info" | "restriction"), latitude, longitude,
street, headingDegrees, value, createdAt, expiresAt (null si es fijo), status,
fixed, reliability { score, label: "new" | "confirmed" | "disputed" },
confirmations, rejections, validated, reportedBy { alias }, mine, yourVote,
forYourTruck ("compatible" | "incompatible" | null)`.

## En la app

- **Reportar** (`mapa/reportes.js`, `mapa/aportar.js`): el botón amarillo, en
  reposo y en viaje, abre "¿Qué ves?": los diez tipos arriba (un toque crea el
  reporte en tu posición y cierra la hoja; el toast ofrece *Deshacer* cinco
  segundos), las seis categorías de lugar abajo. El gálibo pide los metros en
  un segundo toque (3,5 · 3,8 · 4,0 · 4,3 · 4,5 u *otro*). Sin GPS no se
  puede reportar y el botón lo dice.
- **Ver**: pines por tipo y estado (gris *nuevo*, blanco *confirmado*,
  punteado *en duda*, **rojo** lo que a tu camión no le sirve, celeste la
  cámara fija), desde el zoom 12, con su cuadro en la hoja de capas (prendido
  por defecto). Tocarlo abre la ficha: tipo, calle o "cerca de acá", edad y
  conteos, quién, si está sin confirmar o si tu camión no pasa, y *Sigue ahí*
  / *Ya no está* — o *Cerrar reporte* si es tuyo.
- **Cuándo se piden**: en reposo, al quedar quieto el mapa (`idle`, un segundo
  de espera) para el recuadro visible; en viaje, el recuadro de la ruta más
  500 m al preparar la ruta y **cada 60 s**, y cada refresco rehace los avisos
  sin perder los ya dados.
- **Cuando no hay red**: tras un pedido que no llegó al servidor se espera cada
  vez más antes de volver a intentar —2 s, 5 s, 15 s, 60 s, y ahí se queda—, y
  la escalera se borra en cuanto uno vuelve bien. Sólo frena eso: un 4xx no
  cuenta, porque ahí el servidor sí contestó. Sin el freno, con el backend
  caído el mapa pedía **una vez por segundo para siempre**: MapLibre reintenta
  los tiles sin parar y cada reintento vuelve a disparar `idle` (medido en el
  navegador el 29/09/2026).
- **En viaje**: los reportes entran a `alertsAlongRoute` como un dataset más;
  la voz dice "Accidente adelante", "Calle cerrada reportada adelante, sin
  confirmar", "Gálibo reportado de 3,80 metros adelante. Tu camión no pasa";
  la tarjeta lo mismo con la calle; y vibra con `VIBRACION.reporte`
  (información) o `VIBRACION.peligro` (lo que a este camión no le sirve).
- **"¿Sigue ahí?"**: al pasar a menos de 60 m de un reporte ajeno que no
  votaste, y una vez que te alejás, dos botones grandes diez segundos, una vez
  por reporte y viaje. Un toque o nada.

## Cómo se configuran los números

Ninguno vive en un endpoint. Cada tema tiene su lugar, y su test los fija:

| Qué | Dónde |
|---|---|
| Tipos, vidas útiles, clase, umbral de lo fijo | `Domain/Reports/ReportCatalog.cs` |
| La fórmula de confiabilidad y los umbrales de etiqueta y validación | `Domain/Reports/ReportStanding.cs` |
| Estirar, tope de vidas, rechazos que matan | `Domain/Reports/ReportExpiry.cs` |
| Reputación: arranque, pasos, tope | `Domain/Reports/DriverReputation.cs` |
| Espera, tope por hora, duplicado | `Domain/Reports/ReportAbuseGuard.cs` |
| Cercanía para votar, tope de Photon | `Infrastructure/Reports/ReportWriter.cs` |
| Tamaño del bloqueo | `Domain/Routing/RouteBlockade.cs` |
| EXP y tope diario de votos | `Domain/Progression/ExperienceScale.cs` |
| Escalera de la pista `reportes` | `Domain/Progression/TrackCatalog.cs` |
| Umbral de graduación de un lugar | `Domain/Pois/PoiPromotion.cs` |
| Corredor de aviso, cercanía del "¿sigue ahí?", refresco | `navigation.js`, `mapa/reportes.js`, `views/navigate.js` |
| La escalera de espera cuando se cae la red | `mapa/reportes.js` (`ESPERAS_DE_RED_MS`) |

## Fuera de esta versión

Recalcular la ruta sola cuando un cierre se valida en viaje; reputación de
los votantes; reportar desde un punto arbitrario del mapa; moderación, fotos,
comentarios y notificaciones; que un gálibo o una calle cerrada muy
confirmados pasen al dataset verificado (la cámara y los lugares sí se
gradúan); volcar las cámaras fijas al archivo de radares con un script de
`data/` cuando haya cámaras fijas que volcar.
