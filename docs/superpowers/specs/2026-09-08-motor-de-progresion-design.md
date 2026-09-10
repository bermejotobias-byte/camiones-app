# Motor de progresión

**Fecha:** 2026-09-08
**Alcance:** bloque **A** de la descomposición del BRAINSTORM 3. Nivel, metas,
logros, XP y moneda, **en el servidor**. Sin pantallas.

---

## 1. Qué resuelve, y por qué va primero

Hoy todo lo que parece progresión **se calcula en el cliente y no se guarda**:
`levelFor()` en `store.js` deriva el nivel de los kilómetros, y `profile.js`
computa las medallas de las estadísticas. No hay nada en el backend: se buscó
puntos, logros y recompensas y los únicos aciertos eran `PointOfInterest` y puntos
geométricos de rutas.

Eso tiene dos consecuencias:

1. **No hay evento que celebrar.** Sin registro de que este camionero llegó al
   nivel 5 en tal momento, una pantalla de festejo o se dispara cada vez que se
   abre el perfil, o no se dispara nunca.
2. **La mitad de la Fase 6 son formas de gastar** —cofres, moneda, ediciones
   especiales— y no existe de dónde sale nada. Construir eso primero es una
   billetera sin sueldo.

Por eso este bloque va antes que todo lo demás de la Fase 6.

## 2. Los cuatro recursos, y qué los distingue

| Recurso | Qué mide | Se gana con | ¿Se gasta? |
|---|---|---|---|
| **Kilometraje** | El **nivel**. Única variable | Viajes acreditados | No |
| **XP** | Actividad general | Viajes, metas, logros, y más adelante trivias y juegos | No |
| **Recompensas** | Colección: skins, accesorios, camiones | Completar metas y logros | Se equipan, no se gastan |
| **Batería** | — | — | **Fuera de alcance de este bloque** |

**No hay moneda.** Decisión del usuario del 09/09/2026: los cofres y las
suscripciones quedan guardados como concepto y no se trabajan. Las recompensas se
desbloquean **directo** al completar metas y logros, sin comprarse.

El libro de movimientos conserva igual el campo `Denomination`, con un solo valor
hoy. Es una columna, no una función: si algún día se reabre la economía de compra,
sumar una denominación es un valor de enum en vez de una migración. **No se diseña
ninguna fuente ni ningún destino de moneda.**

**La XP por viaje es fija, no proporcional a los kilómetros.** Si la XP creciera
con la distancia sería una segunda forma de medir lo mismo que el nivel, y el v3
§2 pide explícitamente que no se confundan.

**La moneda se construye aunque nada la gaste todavía.** Es deliberado: el usuario
pidió el sistema primero y las fuentes después. El saldo va a estar cuando exista
la tienda, y el libro permite recalcular si las reglas cambian.

## 3. La escala de niveles

Decidida el 08/09/2026. Siete niveles con los nombres que ya están en `store.js`,
**10 metas por nivel**, meta creciente:

| Nivel | Nombre | km por meta | Acumulado al terminarlo |
|---|---|---|---|
| 1 | Novato | 250 | 2.500 |
| 2 | Repartidor | 600 | 8.500 |
| 3 | Fletero | 1.200 | 20.500 |
| 4 | Transportista | 2.500 | 45.500 |
| 5 | Rutero | 4.000 | 85.500 |
| 6 | Veterano | 6.500 | 150.500 |
| 7 | Leyenda del asfalto | 10.000 | 250.500 |

Los umbrales viejos (0, 500, 2.000, 6.000, 15.000, 40.000, 100.000) **se
reemplazan**. Los nombres no cambian.

**Una meta es un décimo de nivel.** El nivel 3 se recorre en 10 metas de 1.200 km:
al completar la décima, sube a Transportista.

## 4. Arquitectura

### 4.1 El libro de movimientos

El corazón es un **libro append-only**, no un contador:

```
LedgerEntry
  Id            Guid
  DriverId      Guid
  OccurredAt    DateTimeOffset
  Denomination  Xp | Moneda
  Amount        int            (siempre positivo en este bloque)
  Reason        ViajeCompletado | EscalonCompletado
  SourceKey     string         (identifica el hecho que lo origina)
```

**Índice único sobre `(DriverId, Denomination, Reason, SourceKey)`.** Eso es lo que
hace que un mismo viaje no acredite dos veces, y es la razón principal de que sea
un libro y no un número. Además permite responder *"¿por qué tengo 1.200 de XP?"* y
recalcular si una regla cambia.

`SourceKey` según el motivo:

| Reason | SourceKey |
|---|---|
| `ViajeCompletado` | el `Guid` del viaje |
| `EscalonCompletado` | pista y escalón: `"viajes:4"`, `"kilometraje:23"` |

Con las pistas de §4.2, **dos motivos alcanzan**: todo lo que no sea cerrar un
viaje es completar un escalón, y el escalón ya identifica su pista.

### 4.2 Pistas: meta y logro son la misma cosa vista de dos maneras

**Reescrito el 09/09/2026** tras leer las capturas de la pantalla de logros de
Duolingo, y aprobado por el usuario.

Los logros de la referencia **no son sueltos: son escalones de una familia**. No
hay tres logros de viajes; hay **uno** que sube de nivel, con un objetivo más alto
en cada escalón y la insignia cambiando de color.

Eso encaja con lo que el usuario escribió en la extensión —*"cuando una Meta
alcanza 10/10, desbloquea el Logro correspondiente"*— y permite colapsar dos
conceptos en uno:

| Palabra | Qué es, en el modelo |
|---|---|
| **Pista** | Una familia: `kilometraje`, `viajes`, `reportes-siniestro`, `trivias`… |
| **Escalón** | Un objetivo dentro de la pista, con su recompensa |
| **Meta** | El escalón en curso. *"Reportes de siniestros — 7/10"* |
| **Logro** | La pista entera, mostrada como *"4 de 10 escalones"* |
| **Nivel** | Una lectura derivada de **una** pista: `kilometraje` |

O sea: **una sola estructura sirve para metas y logros**, y el nivel es una vista
de la pista de kilometraje. Eso es lo que hace que agregar *"reportar 25
controles"* sea una entrada en el catálogo y nada más.

**El catálogo de pistas vive en el dominio, no en la base.** Cada pista declara su
código, qué la incrementa, y la lista ordenada de escalones con su objetivo y su
recompensa. Agregar una pista o un escalón no requiere migración — es el pedido del
v3 §3.

Lo único que se guarda por camionero es el progreso:

```
DriverTrackProgress
  DriverId      Guid
  TrackCode     string
  Count         long              (progreso acumulado en la pista)
  TierReached   int               (cuántos escalones completó)
  PK (DriverId, TrackCode)
```

`TierReached` evita recorrer el catálogo entero para saber por dónde va, y hace que
"subió de escalón" sea una comparación y no una búsqueda.

### 4.2 bis Récords personales

La otra sección de la pantalla de logros, aprobada el 09/09/2026. **No es
progresión: es la mejor marca histórica, con su fecha.**

```
DriverRecord
  DriverId      Guid
  RecordCode    string            (km-en-un-dia, viaje-mas-largo, racha…)
  Value         long
  AchievedAt    DateTimeOffset
  PK (DriverId, RecordCode)
```

La regla es de una línea: si el valor nuevo supera al guardado, se reemplaza junto
con la fecha. No entra al libro de movimientos —no otorga nada— y por eso vive
aparte.

Marcas del oficio para arrancar: **más kilómetros en un día**, **el viaje más
largo**, **la racha más larga** y, cuando existan, **más reportes en un día**.

### 4.3 La marca de "hasta acá ya vio"

Un tercer dato guardado, y el único que existe para servir a la interfaz:

```
DriverProgress
  DriverId          Guid
  CelebratedUpTo    DateTimeOffset
```

Es la frontera entre lo que el camionero ya festejó y lo que todavía no. Todo
asiento y todo logro posterior a esa marca es "nuevo".

**Por qué en el servidor y no en el cliente:** el festejo tiene que ocurrir una
sola vez aunque cambie de teléfono, reinstale la app o entre desde otro lado. Si la
marca viviera en el cliente, reinstalar volvería a disparar todos los festejos
viejos de golpe.

Avanzar la marca es la **única escritura que el cliente puede pedir**, y no otorga
nada: sólo dice "ya lo vi".

### 4.4 El nivel es una lectura de la pista de kilometraje

**El nivel no se guarda.** Sale del `Count` de la pista `kilometraje`, cruzado con
la escala de §3. Guardarlo sería un segundo lugar donde la verdad puede
desincronizarse.

Y esa pista tiene una propiedad que ninguna otra necesita: **su contador tiene que
poder reconstruirse** sumando `Trip.CreditedDistanceMeters` de los viajes
completados. Es la garantía de que los kilómetros del nivel siguen siendo los que
el servidor acreditó, y no un número que quedó suelto por un error.

**Por qué todas las pistas llevan contador, incluso las derivables.** Los
kilómetros y la cantidad de viajes salen de totales que ya existen, pero
*"reportar 10 siniestros"*, *"mantener actividad N días"* y *"completar los tres
tipos de reporte"* **no salen de ningún número existente**. Tenerlas todas en una
sola forma es lo que hace que agregar una pista no requiera decidir de qué tipo es
—y evita que, cuando lleguen los reportes, haya que agregar el sistema de
contadores y migrar lo viejo.

### 4.5 Dónde se acredita

El único momento donde se otorga algo es cuando el servidor cierra un viaje:
`Trip.Finish(when)`, que ya calcula `CreditedDistanceMeters` con
`TripCrediting.CreditFor`.

El motor es una **función pura del dominio**:

```
entrada:  km acreditados totales, cantidad de viajes, logros ya desbloqueados,
          asientos ya existentes
salida:   los asientos y logros NUEVOS que corresponden
```

Sin base de datos y sin reloj adentro, así que se testea como `DeliveryOrder` y
`TruckRouteComparer`: con casos, en el dominio, sin levantar nada.

**El cliente nunca acredita.** No hay ningún endpoint que reciba "gané 20 XP". Es
la misma regla que ya rige los kilómetros, y por el mismo motivo.

### 4.6 La escala se muda al servidor

`levelFor()` sale de `store.js` y pasa al dominio. El cliente **recibe el nivel ya
calculado** en vez de derivarlo.

Motivo: hoy la regla vive en el cliente, o sea en un lugar donde el usuario puede
cambiarla. Además, teniéndola en dos lados, tarde o temprano divergen.

### 4.7 Recompensas, inventario y equipamiento

**Agregado el 09/09/2026** por la extensión del BRAINSTORM 3.

La extensión convierte la meta en el disparador de una colección: al llegar a 10/10
se desbloquea un objeto cosmético, entra al inventario y se puede equipar.

**Esto va en este bloque y no en uno posterior.** Podría parecer trabajo de
pantalla, pero el vínculo **meta → recompensa tiene que ser atómico**: si el motor
otorga la meta y el objeto se agrega en otro lado, quedan dos verdades que pueden
divergir. Y la extensión §3 pide explícitamente que sumar skins y camiones **no
toque el sistema principal** — que es exactamente lo que pasa si se retrofitea.

```
DriverReward                        (el inventario)
  DriverId     Guid
  RewardCode   string
  UnlockedAt   DateTimeOffset
  PK (DriverId, RewardCode)

DriverLoadout                       (el equipamiento)
  DriverId     Guid
  Slot         Avatar | Camion | …
  RewardCode   string
  PK (DriverId, Slot)
```

La clave compuesta del inventario hace que desbloquear dos veces sea imposible por
construcción. La del equipamiento garantiza **un objeto por ranura**.

**El avatar es de piezas combinables, no de skins enteras** — decidido el
09/09/2026. O sea que `Slot` no es *"avatar"* sino una ranura por pieza: peinado,
barba, lentes, ropa, y así.

**Las ranuras quedaron definidas el 09/09/2026**, leídas del editor de avatar de
Duolingo que mandó el usuario:

`Cara` · `Cuerpo` · `Ojos` · `Pelo` · `Barba` · `Lentes` · `Sombrero` · `Ropa` ·
`Fondo` · **`Camion`**

Las nueve primeras salen de la referencia. **La décima no está en Duolingo y es la
propia**: el camión coleccionable que se exhibe en el perfil.

**Cada pieza lleva además su color**, como en la referencia. Eso multiplica las
combinaciones sin multiplicar los dibujos, y es lo que hace viable un sistema
combinable sin una biblioteca de arte enorme. En el modelo, el color es parte del
código de la recompensa equipada — no una columna aparte.

`Slot` es un enum del dominio: sumar una ranura no cambia la forma de la tabla. El
detalle visual completo está en la skill `diseno-camiones-app`.

Consecuencia de las piezas combinables, y conviene tenerla presente antes de dibujar
nada: **cada pieza tiene que combinar con todas las demás**. Doce peinados y ocho
barbas no son veinte dibujos, son veinte dibujos que tienen que calzar entre sí.

**El catálogo de recompensas vive en el dominio**, como el de logros: cada entrada
declara su código, su ranura y de qué meta o logro sale. Agregar una skin nueva es
agregar una entrada, sin migración.

**Regla de integridad:** no se puede equipar lo que no está en el inventario. Va en
el dominio, con test.

**Lo que este bloque NO define: cómo se ven.** La extensión §7 prohíbe aproximar
visualmente antes de recibir las referencias del usuario. Acá se modela el objeto y
su desbloqueo; el dibujo se le agrega al catálogo después, sin tocar nada más.

## 5. Endpoints

| Método | Ruta | Qué devuelve |
|---|---|---|
| `GET` | `/api/progress` | Nivel, nombre, meta actual (n/10), km, XP, moneda, y **lo pendiente de festejar** |
| `GET` | `/api/progress/tracks` | Las pistas con su escalón actual, su objetivo y su progreso |
| `GET` | `/api/progress/records` | Récords personales con su valor y su fecha |
| `GET` | `/api/progress/inventory` | Recompensas desbloqueadas y qué está equipado en cada ranura |
| `POST` | `/api/progress/seen` | Avanza la marca de §4.3: "ya vi el festejo" |
| `POST` | `/api/progress/equip` | Equipa una recompensa **que ya esté en el inventario** |

**Ningún endpoint otorga nada.** Todo lo que se gana ocurre como efecto de que el
servidor cierre un viaje. Las dos escrituras que el cliente puede pedir no crean
nada:

- `seen` sólo corre la marca **hacia adelante** — nunca hacia atrás, para que no se
  pueda pedir el mismo festejo dos veces.
- `equip` sólo elige entre lo que **ya está en el inventario**. Pedir equipar algo
  no desbloqueado se rechaza; es la misma regla de siempre, el cliente no se
  autoconcede nada.

## 6. Catálogo inicial de pistas

Sólo las que se pueden calcular con datos que el servidor **ya tiene**. Nada que
dependa de trivias, reportes o batería — ésas se agregan como entradas nuevas
cuando existan.

| Pista | Qué la incrementa | Escalones |
|---|---|---|
| `kilometraje` | Kilómetros acreditados al cerrar un viaje | **70** — los 10 de cada uno de los 7 niveles de §3 |
| `viajes` | Un viaje completado | 10 |
| `repartos` | Un viaje cerrado con paradas (`Trip.Stops` no vacío) | 10 |
| `nocturnos` | Un viaje empezado entre las 22 y las 6 | 10 |

**Los objetivos de cada escalón son una propuesta, no una decisión** — igual que
los valores de §7. Para `kilometraje` salen de la escala ya aprobada; para las
otras tres hay que elegir una progresión, y prefiero traerla como opciones que
inventarla ahora. La forma no cambia según los números.

`kilometraje` es la única pista con un rol especial: **de ella se lee el nivel**.
Las demás sólo dan escalones, EXP y recompensas.

**Cada escalón lleva una recompensa asociada**, como pide la extensión §2. Pero
**qué objeto entrega cada uno no se define acá**: la extensión §7 prohíbe aproximar
visualmente antes de las referencias. El modelo y el enganche quedan listos; el
catálogo de objetos se completa después y agregarlos no toca la arquitectura.

## 7. Valores propuestos, para ajustar

Estos números **son una propuesta, no una decisión**. Están puestos para poder
construir y medir; se cambian sin tocar la arquitectura porque el libro permite
recalcular.

| Hecho | XP |
|---|---|
| Viaje completado | 20 |
| Escalón completado | 50 |

Queda una pregunta de balance para más adelante: **si un escalón alto tiene que dar
más EXP que uno bajo.** Llegar al escalón 9 de una pista cuesta mucho más que al 2,
y pagar lo mismo achata la curva justo donde debería tirar. Es un número, no una
decisión de arquitectura, así que se resuelve midiendo.

## 8. Retroactividad

**Decisión: sí se acredita lo ya recorrido, en el primer arranque.** Tomada el
09/09/2026; el usuario no tenía preferencia.

Hay viajes cerrados desde antes de que esto exista, y el perfil **ya muestra hoy un
nivel derivado de los kilómetros**. Arrancar todo en cero sería una regresión
visible: un camionero con 9.480 km pasaría a Novato.

La siembra genera los asientos con la fecha del viaje original. Los índices únicos
garantizan que correrla dos veces no duplique nada.

**Y la marca de §4.3 se pone en "ahora" durante la siembra.** Eso resuelve la única
objeción real de acreditar hacia atrás: sin esto, el camionero abre la app y le
caen encima veinte festejos de logros que nunca vio desbloquearse. Con la marca
adelantada, **el pasado se acredita pero no se festeja**: aparece ya conseguido en
el perfil, como corresponde a algo que efectivamente hizo, y los festejos quedan
para lo que gane de ahí en adelante.

## 9. Lo que este bloque NO hace

- **Batería** — bloque D, y sólo tiene sentido junto con las trivias.
- **Gastar la moneda** — no hay tienda, cofres ni ediciones especiales todavía.
- **Trivias y juegos** — bloque E. El motor queda preparado: sumar una fuente de XP
  es agregar un `Reason` y su regla.
- **Reportes como fuente de EXP** — necesitan que exista la Fase 5. El motor queda
  listo: cuando existan, es un `Reason` nuevo y sus metas. Vocabulario **fijado el
  09/09/2026**: `radar`, `control`, `siniestro`. Son los códigos que van a la base
  y a las metas — *"reportar 25 controles"*.
- **El dibujo de skins, camiones y logros** — congelado por la extensión §7 hasta
  que lleguen las referencias visuales. Acá se modela **qué** se desbloquea, nunca
  **cómo se ve**.
- **Pantallas** — ni perfil-carnet, ni resumen, ni festejo. Bloque C.
- **El zócalo y el flujo de entrada** — bloque B.

## 10. Criterio de terminado

1. El dominio calcula nivel, escalones y récords con tests, **sin base de datos**.
2. Cerrar un viaje acredita XP, y **cerrarlo dos veces no acredita dos veces**
   (test de integración).
3. `GET /api/progress` devuelve lo mismo que muestra hoy el perfil para un
   camionero con viajes previos — o sea, la retroactividad no perdió nada.
4. Una **pista nueva** se agrega tocando **sólo el catálogo del dominio**, sin
   migración. La prueba concreta: agregar `reportes-siniestro` con sus diez
   escalones no debe requerir ni una línea fuera del catálogo.
5. El contador de `kilometraje` **se puede reconstruir** sumando los viajes
   completados, y el resultado coincide con el guardado.
6. `levelFor()` ya no existe en `store.js`: el cliente muestra lo que el servidor
   le manda.
7. **Completar un escalón desbloquea su recompensa y la deja en el inventario en la
   misma operación** — no en dos pasos que puedan quedar a medias.
8. **Equipar algo que no está en el inventario se rechaza**, con test.
9. Agregar una recompensa nueva es agregar una entrada al catálogo del dominio, sin
   migración — igual que una pista.
10. Un récord se actualiza sólo cuando se supera, y guarda **la fecha** en que
    ocurrió.
