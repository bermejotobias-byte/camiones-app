# VIBORITA TBF — el Snake del 1100, con un camión

**Fecha:** 03/10/2026 · **Rama:** `viborita-tbf` · **Estado:** diseño visual y jugabilidad
aprobados por el usuario el 03/10/2026, después de cinco vueltas de prototipo.

El primero de los cinco juegos de la Fase 6 (skill `producto-camiones-app`: *"viborita-camión
que suma acoplados"*). Es un subproyecto dentro de **Juegos**: el Snake de los Nokia de los
2000, donde la serpiente es un camión que va enganchando acoplados.

---

## 1. Lo que pidió el usuario

> *"Replicar la esencia del Snake clásico, pero reemplazando la serpiente por un camión (…)
> el crecimiento del cuerpo tiene que sentirse como un camión que va incorporando
> carga/acople. Arcade, simple, inmediata, mobile-first, fácil de entender en segundos."*

Y en las vueltas de diseño, en orden:

1. Primera vuelta, tres estilos (LCD frío, arcade sobre vidrio, moderno liso): eligió la base
   arcade y mandó una **referencia del Nokia 1100** (`docs/referencias/viborita/`).
2. Segunda vuelta, la LCD dentro de la estética de la app: *"más afín a la estética del 1100
   y un guiño a los 2000 (Y2K). Los controles que simulen lo físico del celular de esa época.
   La pantalla tiene que ser verde (…) no te orientes tanto en la estética de la app."*
3. Tercera vuelta, el teléfono entero con teclado numérico: *"no me da una sensación
   agradable (…) andá a la foto de referencia y tomá de ahí los controles y la pantalla con
   su contorno de Nokia 1100 (…) VIBORITA TBF se llama el juego"*. **De esa vuelta quedó
   aprobada la pantalla LCD.**
4. Cuarta vuelta: *"está encaminado, dale ese contorno texturado azul que simula el plástico
   de los bordes"*.
5. Quinta vuelta, con la carcasa de plástico: **aprobado**.

**El prototipo aprobado** está en `docs/diseno/prototipo-viborita/` (`viborita.mjs` lo
genera; ver el README). Es la referencia visual de esta spec: lo que dice acá y lo que se ve
ahí tienen que coincidir.

**Alcance decidido con el usuario:** el juego completo y pulido, con **el récord propio
guardado en el servidor**. Sin EXP ni batería todavía: primero que el juego enganche. La EXP
entra en un paso siguiente, cuando se decida cuánto vale una partida (§8).

---

## 2. La pantalla

Todo el juego ocupa la pantalla entera y **no lleva nada de la estética de la app**: es un
1100 de la época.

### 2.1 El entorno

- Fondo **azul noche** (`#141d28 → #0c121a`), el de los paneles de la referencia.
- Arriba a la izquierda, **`< SALIR`** en la fuente de píxel, gris (`#9aa6b8`). Vuelve a
  Juegos; con una partida en curso, primero pausa.
- Abajo de la cruceta, **un epígrafe** en la fuente de píxel, claro (`#e6ead8`): *TOCÁ EL
  CENTRO* en el inicio, *RÉCORD 0031* jugando, *TE ENGANCHASTE LA COLA* al perder.
- **El zócalo de la app se esconde** mientras la Viborita está abierta, como en el viaje.

### 2.2 El contorno del 1100

De afuera hacia adentro:

1. **La carcasa de plástico azul texturado** (20 px): azul noche con caída de luz en diagonal
   (`#34507f → #22385e → #172848 → #0d1730`), **grano mate** de ruido fractal en tres escalas
   (fino, poro, nube), el **canto redondeado** —luz en el labio de arriba, sombra abajo, un
   brillo especular que corre por el lado izquierdo— y la **ranura** donde encaja el frente,
   con su filo de luz por fuera.
2. **El frente plateado** (`#e4e7ea → #8f959c`) con el **parlante** y **TBF** grabado, en el
   lugar del logo del teléfono. No va "NOKIA": es una marca ajena.
3. **El marco gris** de la pantalla, con el **filo oscuro** por dentro y el reflejo del
   cristal en diagonal.
4. **La LCD verde** (§2.3).

### 2.3 La LCD — aprobada en la segunda vuelta

- **Verde del 1100**: fondo `#b8d27a → #97b555`, tinta `#1b2412`. Cada píxel encendido deja
  **su sombra** corrida un píxel (al 20 %), la **rejilla fantasma** de la matriz se ve apenas
  (7 %) y las esquinas se oscurecen un poco.
- **102 × 128 píxeles de LCD**, cada uno de **3 px de pantalla** (más grande en pantallas
  anchas, siempre entero: un píxel de LCD nunca se dibuja borroso).
- **Fuente de píxel 5 × 7**, la misma adentro y afuera de la LCD. Cubre **las mayúsculas del
  castellano con tildes y Ñ**, los dígitos y `¡ ! : < X`: los textos se escriben bien, no
  sin tilde porque falte la letra.
- **Arriba**: la barrita de **señal** y la **pila** en el inicio y al perder; jugando, el
  **puntaje** de cuatro dígitos a la izquierda y los **acoplados** a la derecha (`X6`).
- **El campo**: 10 × 10 celdas de 10 píxeles, con su marco de un píxel.
- **Abajo**, separada por una línea, **una sola etiqueta centrada**: lo que hace el botón del
  medio (*JUGAR*, *PAUSA*, *SEGUIR*, *OTRA VEZ*). Así funcionaba la tecla central del 1100.

### 2.4 El camión

Diez por diez píxeles por celda, en dos tonos. Se lee como el de la referencia:

| Pieza | De costado (va a izquierda o derecha) | De arriba (va arriba o abajo) |
|---|---|---|
| **Cabina** | caño de escape pegado atrás, ventanilla, trompa, chasis y dos ruedas | enganche, techo, espejos, parabrisas y paragolpes |
| **Acoplado** | caja maciza con una línea clara, chasis que engancha y dos ruedas | caja con dos líneas, enganche hacia adelante |

- Las piezas se dibujan **según hacia dónde va la pieza de adelante**; la cabina, según el
  rumbo. Las de la izquierda y de arriba son las espejadas de las otras.
- **La caja** que se levanta lleva la **cinta en cruz**: el guiño a la "+" de la comida del
  Snake.
- Los dibujos son los del prototipo (`base-lcd.mjs`), píxel por píxel.

### 2.5 La cruceta

La de la referencia: **cinco teclas separadas** de 70 px con 10 de aire, cuadrados oscuros
redondeados (`#1f2732 → #151b23`) con **borde verde pálido** (`#93a874`) y un filo oscuro
por dentro; las **flechas rellenas** de verde pálido (`#a9c07c`) con contorno oscuro; la
del medio con un **círculo**. Al apretar, la tecla baja 2 px.

---

## 3. Las pantallas

| Pantalla | LCD | Botón del medio | Epígrafe |
|---|---|---|---|
| **Inicio** | VIBORITA / TBF en grande, el camión con la caja, *RÉCORD 0031* | JUGAR | TOCÁ EL CENTRO |
| **Jugando** | puntaje, acoplados y el campo | PAUSA | RÉCORD 0031 |
| **Pausa** | el campo quieto y *PAUSA* encima | SEGUIR | RÉCORD 0031 |
| **Game over** | *GAME OVER*, el camión contra la pared, puntos, récord y acoplados; *¡NUEVO RÉCORD!* si lo superó | OTRA VEZ | TE ENGANCHASTE LA COLA (o CHOCASTE, si fue contra el borde) |
| **Ganaste** | *¡GANASTE!*, puntos y récord: el campo quedó lleno | OTRA VEZ | LLENASTE EL CAMPO |

Sin récord todavía (nunca jugó) el inicio dice *RÉCORD 0000*.

---

## 4. La jugabilidad

| Regla | Valor |
|---|---|
| Campo | **10 × 10** celdas |
| Arranque | la cabina y **2 acoplados**, en la fila del medio, yendo a la derecha |
| Movimiento | continuo, una celda por paso, como el Snake |
| Giro en U | no se puede: se ignora |
| Giros rápidos | se **encolan hasta dos**: dos toques seguidos se respetan los dos, en orden |
| La caja | aparece en una celda libre al azar; levantarla suma **un acoplado** |
| Puntos | la caja vale **tantos puntos como acoplados llevás después de levantarla**: la primera 3, la segunda 4… *"cada comida vale más puntos"* |
| Velocidad | **un paso cada 260 ms**; cada 5 cajas, 20 ms menos, **hasta 140 ms** |
| Fin | chocar contra **el borde** o contra **un acoplado propio** |
| La cola | la celda que deja la cola en ese mismo paso **está libre**: perseguirse la cola no es choque |
| Campo lleno | si no queda celda libre para la caja, la partida termina **ganada** (*GANASTE!*) |

**Los puntos se derivan de las cajas**: con *n* cajas son `2n + n(n+1)/2`. Con el campo de
10 × 10 caben 97 cajas: 4.947 puntos como mucho, que entran en los cuatro dígitos.

### 4.1 Los controles

- **La cruceta**: arriba, abajo, izquierda, derecha; el centro hace lo que dice la LCD.
- **Deslizar el dedo** sobre la pantalla también gira: la cruceta es la cara, el deslizar es
  lo que se hace sin mirar.
- **Las flechas del teclado** en la computadora, para probar.
- **Se pausa sola** si la app pasa a segundo plano.

### 4.2 La vibración

Con el sistema de patrones que ya usa el GPS (`VIBRACION`, `platform.js`):
- **un toque corto** al levantar una caja;
- **un patrón propio de choque**, distinto de todos los del viaje.

**Sin sonido** en esta versión.

---

## 5. El récord

**Usa los récords personales que ya existen** en el motor de progresión: la tabla
`DriverRecord` (camionero, código, valor, fecha), la regla `PersonalRecords.Improve`
—**igualar no es superar**: el empate no mueve la fecha— y `GET /api/progress/records`, que
ya los devuelve. Hasta hoy nadie escribía en esa tabla: la Viborita es el primer récord. Su
código es **`viborita`**.

**Un endpoint nuevo**: `POST /api/juegos/viborita/partidas` con `{ cajas, duracionMs }`.

- **El servidor calcula los puntos** con la fórmula de §4; no los recibe. Así el número
  que se guarda no lo inventa el teléfono.
- **Rechaza lo imposible** (422): más cajas de las que entran en el campo, o más de las que se
  pueden levantar en ese tiempo a la velocidad máxima. No es una defensa contra un tramposo
  decidido —el teléfono igual informa las cajas—, pero descarta lo absurdo y deja el récord
  en números posibles.
- Devuelve `{ puntos, record: { valor, fecha }, nuevoRecord }`.
- Pide sesión (401 sin ella). Cae en la canasta de **escritura** del límite de tasa (40 por
  minuto) sin tocar nada: una partida dura más que eso.
- **Las reglas** —la fórmula de los puntos, el máximo de cajas, el paso más rápido— son
  **constantes con nombre en el dominio**, fijadas por test, y el cliente usa los mismos
  números.

**Sin conexión** el juego anda igual: los dibujos viajan en el APK. Si al perder no se puede
guardar, el epígrafe lo dice (*SIN SEÑAL: RÉCORD NO GUARDADO*) y la partida no se pierde de
vista; no se reintenta en segundo plano.

---

## 6. Cómo encaja en la app

- **Ruta nueva** `viborita` en `app.js`, en `NECESITAN_CUENTA` con el motivo `juegos`: el
  invitado ve el mismo aviso que hoy en Juegos (*"Los juegos van con tu cuenta"*).
- **Juegos** suma la fila de *Viborita TBF* con su acción de jugar; la trivia sigue *Pronto*.
- **El zócalo** se esconde con un evento propio (`pantalla-completa`), igual que hoy se
  esconde con `viaje`: la Viborita no tiene que conocer al zócalo.

### 6.1 Las piezas

Un módulo por responsabilidad, en `wwwroot/js/juegos/viborita/`:

| Módulo | Qué hace | Puro |
|---|---|---|
| `reglas.js` | las constantes de §4 y la fórmula de los puntos | sí |
| `motor.js` | el estado de la partida y el paso: mover, girar, encolar, crecer, chocar, la caja; el azar se inyecta | sí |
| `dibujos.js` | los sprites, la fuente 5 × 7 y qué sprite lleva cada pieza según su vecina | sí |
| `lcd.js` | dibuja la LCD en un `<canvas>`: fondo, rejilla, sombras, tinta | no (canvas) |
| `pantallas.js` | qué muestra la LCD en cada pantalla, como lista de órdenes de dibujo | sí |
| `views/viborita.js` | el anfitrión: el contorno, la cruceta, el deslizar, el reloj, la pausa, el servidor | no |

**La LCD va en `<canvas>`**, no en SVG: el prototipo dibuja un `<rect>` por píxel (miles), y
en el teléfono eso se redibuja varias veces por segundo. El canvas se pinta entero en cada
paso, a escala entera.

**El contorno y la cruceta son HTML y CSS**, tomados del prototipo; el grano del plástico es
el mismo SVG de ruido como fondo.

En el servidor: la regla de puntos y de plausibilidad en el **dominio**
(`Domain/Juegos/Viborita.cs`), el endpoint en `Program.cs`, y el guardado del récord con
`PersonalRecords.Improve` sobre `DriverRecord`. **Sin migración**: la tabla existe.

---

## 7. Cómo se verifica

**Tests** (cada uno visto en rojo primero):

- **Motor** (`tests/web/viborita.test.mjs`): avanza una celda por paso; gira; ignora el giro
  en U; encola dos giros y no tres; crece al levantar una caja; choca contra el borde y
  contra un acoplado; perseguirse la cola no es choque; la caja nunca cae sobre el camión;
  el campo lleno es victoria; la velocidad baja cada 5 cajas y se planta en 140 ms.
- **Puntos**: la fórmula de §4 para 0, 1, 2, 97 cajas.
- **Dibujos**: cada pieza toma el sprite correcto según su vecina, en las cuatro direcciones
  y en las curvas; **cada carácter que usa una pantalla existe en la fuente** (un carácter que
  falta no se dibuja y no avisa: pasó tres veces haciendo el prototipo).
- **Dominio .NET**: la fórmula, el máximo de cajas, la plausibilidad por tiempo.
- **Integración .NET**: 401 sin sesión; el servidor calcula los puntos; mejora el récord;
  igualar no mueve la fecha; lo imposible da 422.

**En el navegador**, a 375 × 812: las cuatro pantallas contra el prototipo, jugar una partida
con la cruceta y con el teclado, perder contra el borde y contra la cola, pausar, y el récord
que sobrevive a recargar.

**En el teléfono**: el deslizar, la vibración, que la LCD no se vea borrosa, y que el paso de
140 ms no se trabe.

---

## 8. Fuera de alcance

- **EXP, batería y ranking.** La EXP por partida necesita decidir cuánto vale y con qué tope
  —el puntaje lo informa el teléfono—; la batería y el ranking no existen todavía en la app.
- **Sonido** (los pitidos del 1100 serían el siguiente guiño).
- **Carcasas intercambiables** como premio (idea de la segunda vuelta).
- **Un festejo del mono**: el usuario pidió que el juego no lleve la estética de la app.
- Los otros cuatro juegos.

## 9. Riesgos

| Riesgo | Qué se hace |
|---|---|
| El paso de 140 ms se traba en el teléfono | El canvas se pinta entero sólo en cada paso; se mide en el APK |
| El deslizar choca con el gesto de volver de Android | El deslizar sólo cuenta adentro de la LCD |
| Un récord falso | El servidor calcula los puntos y descarta lo imposible (§5); no se promete más |
| La LCD se ve borrosa en pantallas con densidad rara | La escala del píxel es siempre entera y el canvas usa `devicePixelRatio` |
