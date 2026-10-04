# CRUZÁ, MONO — spec

**Fecha:** 04/10/2026 · **Estado:** diseño aprobado por el usuario, plan por escribir.
**Prototipo:** `docs/diseno/prototipo-cruza/` (ver su README). **Antecedente:** la Viborita TBF
(`2026-10-03-viborita-tbf-design.md`, AD-55), de la que este juego toma el marco, el récord
en el servidor y la fuente de píxel.

---

## 1. Lo que pidió el usuario

Un minijuego dentro de **Juegos**, inspirado en **Crossy Road**: la jugabilidad viene de ahí,
pero lo que se ve tiene que ser propio. Textual del pedido del 04/10/2026:

> *"Quiero que el resultado sea reconociblemente Crossy Road + universo camionero + nuestra
> mascota + arcade retro."*

El protagonista es **el mono de la app** en pixel art. Avanza por un escenario sin fin, esquiva
el tránsito, cruza ríos sobre troncos y junta cajas: **+50 por caja**, y la distancia también suma.
Lleva **tres vidas**, y el HUD muestra **SCORE, HI-SCORE y VIDAS**. Cada golpe tiene un
**parpadeo rojo** fuerte, el control es **mobile-first** y la estética es **arcade de los 80,
cuidada**, sobre negro puro.

El diseño llevó **cinco vueltas**:

| Vuelta | Qué pidió el usuario |
|---|---|
| 1 | El concepto; *"me gusta"* |
| 2 | *"Más píxeles, más detallado y agradable. Jugá con los camiones de TBF y la identidad de la app. Más animado"* |
| 3 | *"Una estética más argentina, con elementos de la cultura y carteles de publicidad de nuestra app. Más detalle en camiones y autos (Torino, Fiat Uno). Colores más agradables y más vivos"* |
| 4 | *"Detallá más los carteles, sacá el kiosco y el puesto de choris. Más camiones de distintos colores y más líneas de colectivos"* |
| 5 | Aprobado: *"el mapa debe repetirse y seguir hasta que el personaje pierda… Apruebo el mono, va el nombre, el invitado no juega y el HiScore queda guardado en servidor como la Viborita. Usá más camiones TBF"* |

**Lo que quedó decidido el 04/10/2026:**

1. **El sprite del mono de 24 × 24** del prototipo es la versión oficial del mono en chico.
2. **El nombre es CRUZÁ, MONO.**
3. **El invitado no juega**: Juegos pide cuenta, como la Viborita.
4. **El HI-SCORE se guarda en el servidor**, como el récord de la Viborita.
5. **El mapa no se termina** hasta que el mono pierde las tres vidas.
6. **El reparto del tránsito tiene criterio** (§3.3). La primera versión llenaba la calle de
   camiones, y el usuario la corrigió: *"No tantos camiones, se complica mucho la jugabilidad…
   que lo que menos pasen sean colectivos"*. Lo que más pasa son autos, después camiones TBF y
   al final colectivos. Nunca hay dos carriles seguidos de vehículos largos.

## 2. La pantalla

### 2.1 El marco

- **Pantalla completa**, como la Viborita. El zócalo se esconde (evento `pantalla-completa`), el
  fondo es negro puro (`#000000`) y arriba va `< SALIR` en la fuente de píxel, con un área
  tocable de 48 px de alto.
- **El campo es un canvas de 216 × 340 px lógicos**:
  - HUD de 28 px;
  - 13 filas visibles de 24 px;
  - 9 columnas de 24 px.
- **Se dibuja a escala entera en píxeles físicos**, sin suavizado. Es la lección de la Viborita:
  la escala se mide por el lugar que ocupa el marco, no por un margen supuesto. Sin cruceta: el
  campo entero es el control (§5.1).
- **Fuera del juego vale la estética de la app**: la fila de Juegos va en Nunito, con la tarjeta y
  el botón JUGAR de siempre. **Dentro del juego, la de la propuesta**: es la excepción arcade que
  la skill de diseño reserva para los juegos (§8 de la skill).

### 2.2 El estilo

- **Pixel art de 24 px por celda.** Cada material lleva luz, base, sombra y contorno. El
  contorno es oscuro cálido (`#170C16`), no negro.
- **El universo es Buenos Aires:**
  - vereda de baldosas grises con vainillas y cordón pintado;
  - calles de asfalto y de adoquines, senda peatonal y avenidas de la Red de Tránsito Pesado
    con su línea de cromo celeste, el mismo dibujo que la Red en el mapa de la app;
  - plazas con jacarandá y banco con mate y termo;
  - el Riachuelo con troncos;
  - la orilla de La Boca con conventillos de chapa de colores;
  - el playón TBF con la bandera en el mástil.
- **La marca TBF va en primer plano:**
  - la flota de camiones trompudos fileteados;
  - los carteles de la app;
  - la caja con la cinta celeste;
  - el cromo celeste;
  - el violeta de recompensa en el HI-SCORE y en el "+50".
- **El rojo puro (`#FF2E3A`) es sólo para el golpe.** Los autos usan colores vivos, pero ninguno
  repite ese rojo.
- **La fuente es la 5 × 7 de la Viborita** (`js/juegos/viborita/dibujos.js`), con **tres glifos
  nuevos: `-`, `+` y `,`**. El test de `faltantes` recorre cada texto del juego.
- **Los vehículos evocan la silueta, no la marca**: ningún emblema ni logo ajeno, por la misma
  regla que dejó afuera la gorra MACK de la mascota. **Los colores de las líneas de colectivo son
  de fantasía**: no copian la pintura real de cada línea, y no se presentan como reales.

### 2.3 El HUD

Es una franja negra de 28 px, cerrada abajo por una línea de cromo celeste de 3 px que recorre
un destello cada 4 s.

| Lugar | Rótulo | Valor |
|---|---|---|
| Izquierda | `SCORE` en celeste `#35B8E8` | 6 dígitos blancos a escala 2; al subir, cuentan hacia arriba |
| Centro | `HI-SCORE` en violeta `#C9A8FF` | 6 dígitos blancos a escala 2; al superarlo en plena partida, sigue al SCORE y late en violeta |
| Derecha | — | Tres cabezas del mono de 12 × 12, que parpadean cada tanto. La vida perdida queda como silueta gris, y la última late en rojo |

## 3. El mundo

### 3.1 Filas y tipos

El mundo es una sucesión de **filas**, numeradas desde la largada (fila 0) hacia adelante.

| Tipo | Clase | Qué tiene |
|---|---|---|
| `vereda` | segura | Baldosas, cordón y, a veces, cordón amarillo. Obstáculos: plátano, jacarandá, contenedor verde y cartel de la app (4 celdas) |
| `plaza` | segura | Pasto con flores. Obstáculos: plátano, jacarandá y banco con mate |
| `boca` | segura | La orilla de La Boca: conventillos de 1 celda cada uno (son los obstáculos), con huecos |
| `playon` | segura | El hito cada 25 filas: logo TBF y número de fila pintados, bolardos y mástil |
| `calle` | peligro | Un carril con vehículos (§3.3) |
| `rio` | peligro | Un carril de agua con troncos (§3.4) |

### 3.2 Cómo se arma — sin fin

**El mundo se genera por bloques, de a pedazos, a medida que la cámara sube.** Las filas que
quedan más de 4 filas debajo de la cámara se olvidan. No hay un final: la partida sigue hasta
que el mono pierde las tres vidas.

- **Una semilla por partida.** Con la misma semilla sale el mismo mundo, y así se prueba.
- **Las filas 0 a 2** son la largada: vereda sin obstáculos en la columna 4 y sin cajas.
- **Después se alternan** una **franja segura** de 1 a 3 filas y un **bloque de peligro**.
  - El primer bloque de peligro es siempre **una calle de un carril**.
  - Después, es **río con probabilidad 0,3** y **calle** el resto. Nunca hay dos bloques de río
    seguidos.
  - La franja segura que viene **justo antes de un río** es de tipo `boca` en su última fila.
- **Cada fila múltiplo de 25** es un `playon`, con su número pintado. Si cae en medio de un bloque
  de peligro, el bloque se corta ahí y sigue después.
- **En la fila 100, el playón tiene el Obelisco**: un obstáculo de 1 celda que se dibuja alto.
- **Garantía de paso en lo seguro:**
  - cada franja segura tiene al menos **4 celdas libres por fila**;
  - **una misma columna libre en todas sus filas**: el pasillo;
  - el cartel (4 celdas) va sólo en una `vereda`, uno por fila como máximo, y nunca sobre el
    pasillo.

### 3.3 Las calles — el reparto del tránsito

Cada carril de calle tiene **un sentido, una velocidad constante y una clase de vehículo**. Los
vehículos se repiten en un lazo periódico (como en el prototipo), así el carril es determinista y
no hace falta crear ni borrar vehículos.

**Lo que más pasa son autos, después camiones TBF y lo que menos, colectivos.** Los vehículos
largos (4 celdas) son los que complican cruzar, así que se reparten con cuidado:

| Clase de carril | Vehículos | Filas 0–19 | Fila 20 en adelante |
|---|---|---|---|
| **Autos** | Torino, Fiat Uno, Fitito, 504 y taxi (2 celdas), mezclados | **0,80** | **0,55** |
| **De la Red** (con su línea de cromo) | Camiones TBF (4 celdas), de las 9 pinturas | 0,20 | 0,30 |
| **Colectivos** | Colectivos (4 celdas), de las 6 líneas | 0 | 0,15 |

- **Nunca hay dos carriles seguidos de vehículos largos** (Red o colectivos) en un mismo bloque. Si
  sale uno pegado a otro, se cambia por un carril de autos.
- **Un carril de vehículos largos lleva 2 como máximo**, y va a **0,75 × la velocidad máxima** de
  la banda: los camiones y los colectivos son más lentos que los autos.
- **Las 9 pinturas de la flota:** celeste y blanca, violeta, naranja, amarilla con azul, verde,
  roja, azul, jaula de hacienda y cisterna de cromo.
- **Las 6 líneas de colectivo:** 152, 60, 29, 39, 64 y 12.
- **El adoquín** es el 20 % de los carriles que no son de la Red.
- **La senda peatonal**: un bloque de 2 o más carriles lleva una senda de 2 columnas que lo cruza
  entero.
- **El sentido de cada carril es al azar**, y **la velocidad sale de la banda de dificultad**
  (§5.5).
- **El hueco mínimo entre dos vehículos de un mismo carril** es 2 celdas más lo que el carril
  recorre en 0,5 s. Así siempre hay un hueco por donde pasar.

### 3.4 El río

- **Cada carril de río** tiene un sentido, una velocidad y troncos de 2 a 4 celdas, según la banda.
  **Dos carriles de río seguidos van en sentidos opuestos.**
- **El agua libre entre dos troncos** de un mismo carril es de **3 celdas como máximo**.
- **El agua es azul vivo** con trama, crestas que corren y orillas oscuras. Los troncos tienen
  vetas, musgo, anillos en las puntas y espuma donde cortan el agua.

### 3.5 Las cajas

- **Una caja vale +50.** Hay **como máximo una por fila** y ninguna en las filas 0 a 2.
- **Dónde aparecen**, de menos a más riesgo:

  | Lugar | Probabilidad por fila |
  |---|---|
  | Fila segura | 0,15 |
  | Carril de calle, siempre sobre la senda si la hay | 0,10 |
  | Carril de río, arriba de un tronco | 0,10 |

- **La caja de la calle** queda quieta en su celda y los vehículos le pasan por encima: se dibuja
  debajo. **La del río** viaja con su tronco.

## 4. Lo que se ve

Todo esto ya está dibujado en el prototipo y **se porta tal cual**.

### 4.1 El mono

El sprite de 24 × 24 aprobado:

- **Vistas:** de espaldas (avanza), de frente (retrocede) y de costado, que a la izquierda se
  espeja.
- **Quieto:** de espaldas mueve la cola, de frente parpadea.
- **El salto:** arco de 6 px. Se estira al despegar y se aplasta al caer, la sombra se achica en
  el aire y levanta polvo al aterrizar.
- **El golpe en la calle:** queda aplastado, con tres estrellitas que giran.
- **El golpe en el río:** sólo flota la gorra entre ondas. No hay crueldad, como pide el brief de
  la mascota.

### 4.2 Los vehículos

Se dibujan con **el rasterizador de siluetas** del prototipo: cada vehículo es una grilla de
partes (pintura, techo, vidrio, cromo y faros) que recibe luz arriba, sombra abajo y contorno.

**Animación:** las llantas giran, los escapes echan humo y las luces de gálibo del techo de los
TBF titilan. La cisterna tiene un destello que cruza su cromo, el taxi la luz de LIBRE y el
colectivo su cartel de destino.

**Lo que se dibuja siempre derecho, nunca espejado:** el logo TBF fileteado, el sol de mayo, la
cara del mono y el número de línea.

### 4.3 El barrio y los carteles de la app

Plátano y jacarandá, que se mecen; el jacarandá además deja caer flores. Contenedor verde, banco
con mate y termo, bolardo celeste, mástil con la bandera que flamea y conventillos de colores.

**El cartel de la app** ocupa 4 celdas:

- **El armado:**
  - copete fileteado con el sol de mayo;
  - marco de cromo celeste en cuatro tonos y filete amarillo con volutas;
  - pasarela con baranda y tres lámparas que lo alumbran desde abajo;
  - dos columnas de hierro con cruces.
- **El cambio de aviso:** cada 4 s, con tablillas que giran una por una, como un tri-visión.
- **Los cuatro avisos:**
  - "TBF · TU GPS";
  - "¡BAJATELA GRATIS!";
  - "RUTA LIBRE CON TBF";
  - "SUMÁ EXP MANEJANDO".

## 5. La jugabilidad

### 5.1 Los controles

| Gesto | Efecto |
|---|---|
| **Tocar** en cualquier lugar del campo | Un paso adelante |
| Deslizar hacia arriba | Un paso adelante |
| **Deslizar** a la izquierda, a la derecha o hacia abajo | Un paso en esa dirección |
| Teclado (navegador) | Flechas o WASD; Enter o espacio para los botones de las pantallas |

- **El paso de un deslizamiento se decide al cruzar los 24 px**, sin esperar a que se levante el
  dedo, como en la Viborita.
- **Es un paso por gesto.** Si llega un gesto en medio de un salto, se guarda uno solo y sale al
  aterrizar. Los demás se descartan.
- **SALIR durante la partida la pausa**, con dos opciones: SEGUIR y SALIR. Si la app pasa a
  segundo plano (`visibilitychange`), también se pausa.

### 5.2 El movimiento

- **Un paso mueve una celda en 140 ms.**
- **Los obstáculos y los bordes del campo bloquean:** el paso no se da y no cuesta nada.
- **Sobre un tronco el mono viaja con él**, en píxeles. Al saltar desde un tronco cae en la
  columna más cercana a su posición.
- **La cámara:**
  - sube sola a la velocidad de la banda (§5.5);
  - además sigue al mono, que nunca queda a más de 8 filas del borde de abajo;
  - nunca baja.

### 5.3 Las colisiones

| Con qué | Cuándo | Resultado |
|---|---|---|
| Vehículo | En cada cuadro, también en medio del salto. Caja de golpe del mono: 16 × 18, centrada. Del vehículo: su largo menos 3 px en cada punta | Pierde una vida |
| Agua | Al aterrizar en un carril de río, si el centro del mono no queda sobre un tronco | Pierde una vida |
| Borde, sobre un tronco | Cuando el centro del mono sale del campo | Pierde una vida |
| La grúa | Cuando la fila del mono queda por debajo del borde inferior de la cámara | Pierde una vida |
| Caja | Al aterrizar en su celda, también arriba de un tronco | +50, y la caja desaparece |

### 5.4 Vidas y golpe

- **Hay 3 vidas.**
- **Un golpe:**
  - el mundo se congela 0,9 s;
  - el flash rojo cubre el campo tres veces, con 2 px de sacudida;
  - el mono queda aplastado, o flota la gorra;
  - la vida titila y queda gris;
  - el teléfono da la vibración `choque`.
- **Después, el mono reaparece** en **la última fila segura en la que estuvo**, en la columna libre
  más cercana a la 4. Durante 1,5 s es invulnerable, y titila.
- **Sin vidas, GAME OVER** (§6).

### 5.5 Puntuación y dificultad

- **SCORE = 10 × filas + 50 × cajas**, donde filas es la fila más lejana alcanzada: ir y volver
  no suma.
- **HI-SCORE** es el récord del servidor (§7), o el SCORE si lo supera durante la partida.

| Banda (filas) | Calle: carriles por bloque | Río: carriles por bloque y troncos | Velocidad máx. | La cámara sube |
|---|---|---|---|---|
| 0–19 | 1–2 | 1–2 · troncos de 3–4 | 1,5 celdas/s | 1 fila cada 4 s |
| 20–59 | 1–3 | 1–3 · troncos de 2–3 | 2,5 celdas/s | 1 fila cada 3 s |
| 60–119 | 2–4 | 2–3 · troncos de 2 | 3,5 celdas/s | 1 fila cada 2,5 s |
| 120 o más | 2–5 | 2–4 · troncos de 2 | 4,5 celdas/s | 1 fila cada 2 s |

La velocidad mínima de cada carril es 0,8 celdas/s. Todos los números son **constantes con
nombre**, en `reglas.js` y en el dominio, y quedan fijados por test: cambiarlos es una decisión,
no un accidente.

## 6. Las pantallas

| Pantalla | Qué tiene |
|---|---|
| **Inicio** | Atardecer porteño (cielo del violeta al naranja, sol de mayo, skyline, Obelisco y un cartel TBF en una terraza). Título CRUZÁ, MONO en cromo celeste con sombra violeta. El mono con el joystick (la pose PNG de `mascota.js`). HI-SCORE, "TOCÁ PARA JUGAR" titilando, un convoy por la 9 de Julio y la marquesina de lamparitas |
| **Jugando** | El campo y el HUD |
| **Pausa** | El campo quieto y oscurecido, "PAUSA" y dos botones: SEGUIR y SALIR |
| **Game over** | GAME OVER cae en rojo y rebota, debajo "¡QUÉ MACANA!". El mono de la rueda (la pose de error de la app). SCORE, HI-SCORE, filas y cajas. Botones OTRA VEZ y SALIR, con el reborde de la app |
| **Nuevo récord** | "¡SOS UN CRACK!" en cromo, confeti celeste, blanco y violeta, el mono festejando, "¡NUEVO HI-SCORE!" y los puntos contando hacia arriba |

- **Durante los primeros 600 ms del final, los toques se ignoran**, como en la Viborita.
- **Si el servidor no contesta**, el final dice **SIN SEÑAL: RÉCORD NO GUARDADO**. La partida no
  se pierde de vista.

## 7. El récord — en el servidor, como la Viborita

- **El pedido:** `POST /api/juegos/cruza/partidas`, con `{ filas, cajas, duracionMs }`.
  - Pide sesión (grupo `/api/juegos` con `RequireAuthorization`) y cae en la **canasta de
    escritura** del límite de tasa.
- **El servidor:**
  - **calcula los puntos**: `10 × filas + 50 × cajas`;
  - rechaza con **422 lo imposible**: filas o cajas negativas, **más cajas que filas**, o **filas
    × 140 ms más que la duración**;
  - guarda el récord en `DriverRecord` con el código **`cruza`**, por `PersonalRecords.Improve`.
    Igualar no es superar, y una partida de 0 puntos no es récord.
- **La respuesta:** `{ puntos, record: { valor, fecha } | null, nuevoRecord }`.
- **El inicio lee el récord** de `GET /api/progress/records`. El campo es **`code`**; por esperar
  `recordCode`, la Viborita no mostraba su récord.

## 8. Cómo encaja en la app

| Pieza | Dónde |
|---|---|
| Reglas del servidor | `src/TruckNavigator.Domain/Juegos/Cruza.cs`: `RecordCode`, `Puntos`, `EsPosible` |
| Registrar una partida | `src/TruckNavigator.Infrastructure/Juegos/CruzaPartidas.cs` (reusa `ResultadoDePartida`) |
| Endpoint y DTOs | `Program.cs` (grupo `juegos`), `Contracts/Dtos.cs` |
| Reglas del cliente | `wwwroot/js/juegos/cruza/reglas.js` |
| El mundo sin fin | `wwwroot/js/juegos/cruza/mundo.js` (puro, con semilla) |
| El motor | `wwwroot/js/juegos/cruza/motor.js` (puro: pasos, cámara, colisiones, vidas, puntos) |
| Sprites | `wwwroot/js/juegos/cruza/sprites.js` (portados del prototipo) |
| Vehículos | `wwwroot/js/juegos/cruza/vehiculos.js` (rasterizador y modelos, portados) |
| Escenario | `wwwroot/js/juegos/cruza/escenario.js` (piso, barrio, carteles, portados) |
| Pantallas | `wwwroot/js/juegos/cruza/pantallas.js` (dibujar el juego, HUD, inicio, final) |
| La vista | `wwwroot/js/views/cruza.js` (reloj, controles, pausa, servidor) |
| Fuente | `wwwroot/js/juegos/viborita/dibujos.js` suma `-`, `+`, `,` |
| Integración | `app.js` (ruta `cruza`, `NECESITAN_CUENTA`), `views/juegos.js` (la fila), `api.js` (`cruzaPartida`), `app.css` (la sección `.cruza`) |

- **Vibración:** usa `VIBRACION.caja` y `VIBRACION.choque`, que ya existen.
- **Sin EXP, sin batería y sin sonido** en esta etapa.
- **Rendimiento en el teléfono:** lo estático (el piso de cada fila y los obstáculos quietos) se
  dibuja **una vez por fila** en un lienzo aparte cuando la fila nace, y después se copia entero.
  Los árboles se guardan en sus dos posiciones de vaivén, y los vehículos en el lienzo que ya
  arma el rasterizador. Cada cuadro sólo dibuja lo que se mueve.

## 9. Cómo se verifica

- **Tests .NET:**
  - dominio: `Puntos` y `EsPosible`, con cada borde;
  - integración de `CruzaPartidas`: primer récord, no superarlo, igualar sin mover la fecha,
    mejorar, partida de 0 puntos e imposible.
- **Tests web:**
  - `reglas`: las constantes y las bandas;
  - `mundo`, con semilla fija:
    - las filas 0 a 2 sin obstáculos en la columna 4 y sin cajas;
    - el primer peligro, una calle de un carril;
    - nunca dos ríos seguidos, y ríos vecinos en sentidos opuestos;
    - el hueco mínimo entre vehículos y el agua libre de 3 celdas como máximo;
    - 4 celdas libres y el pasillo en cada franja segura;
    - una caja por fila como máximo;
    - el playón cada 25 filas;
    - el reparto sobre 3000 filas: autos alrededor del 55 %, Red del 30 % y colectivos del 15 %,
      con los colectivos siempre por debajo de la Red;
    - nunca dos carriles largos seguidos, a lo sumo 2 vehículos por carril largo y ningún
      colectivo antes de la fila 20;
  - `motor`:
    - el paso, el bloqueo y la cola de un solo paso;
    - el tronco que lleva;
    - el agua, el vehículo, el borde y la grúa;
    - las cajas;
    - puntuar sólo las filas nuevas;
    - el golpe, la reaparición y la invulnerabilidad;
    - el fin;
  - `vehiculos`: cada modelo se arma, sin partes sin color y con las ruedas dentro;
  - los textos: `faltantes` sobre cada texto del juego.
- **En el navegador** (a cargo del controlador):
  - 360 × 740, 375 × 812 y 412 × 915: escala entera y sin scroll;
  - jugar con toques y con teclado, la pausa, el golpe y el game over;
  - el `POST` en la red, el récord después de recargar y el invitado con el aviso de cuenta;
  - el zócalo, que vuelve al salir;
  - 60 cuadros por segundo sostenidos, medidos con `performance`.
- **En el teléfono:** el APK con el usuario. Fluidez, gestos, vibración, la pausa al salir de la
  app y el botón atrás.

## 10. Fuera de alcance

- EXP, batería, ranking y sonido.
- Personajes desbloqueables y skins del mono.
- Modo apaisado: el juego es vertical, como la Viborita.

## 11. Riesgos

| Riesgo | Qué se hace |
|---|---|
| **Que no ande fluido en el teléfono**: el prototipo redibuja todo en cada cuadro | El caché por fila de §8, y medir los cuadros por segundo en el navegador con la CPU limitada antes de armar el APK |
| **Un mundo sin paso** (calle sin hueco, río sin tronco al alcance) | Las garantías de §3, probadas sobre miles de filas con semilla fija |
| **Que el pixel art se degrade al portarlo** | Se copia del prototipo, no se redibuja. Cada pantalla se compara contra la del artifact |
| **El cartel (4 celdas) encerrando el paso** | Nunca sobre el pasillo, y uno por fila |
| **La rama**: este juego usa piezas de la Viborita (fuente, récord, `pantalla-completa`) que todavía no están en `main` | `cruza-mono` sale de `viborita-tbf`. Antes de escribir código, con la Viborita ya fusionada, se rebasa sobre `main` (`git rebase --onto main viborita-tbf cruza-mono`) |
