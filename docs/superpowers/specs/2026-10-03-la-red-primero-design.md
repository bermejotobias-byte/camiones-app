# La Red primero — la cartografía del viaje

**Fecha:** 03/10/2026 · **Rama:** `la-red-primero` · **Estado:** diseño aprobado por el
usuario el 03/10/2026, con una corrección: *"agregale un poco más de cromo, ese brillo
buscamos, no tanto ese halo azul difuminado"*.

Parte **B** de los doce puntos que dejó la prueba en la calle del 02/10/2026 (la A es
AD-52; la C, el mapa que no se rompe, va aparte). Cubre seis puntos:

| # | Lo que pidió el usuario | Sección |
|---|---|---|
| 7 | La Red visible siempre, como capa permanente de referencia — **"uno de los puntos MÁS IMPORTANTES"** | §3.1, §3.2 |
| 8 | Las calles fuera de la Red, en una variante apagada del color principal | §3.1 |
| 9 | Los nombres que respondan al zoom, con la Red más legible | §3.4 |
| 10 | Un brillo de cromo que recorra la Red | §3.3 |
| 11 | Sacar la línea punteada de la autopista | §3.6 |
| 4 | La ruta encima de la calle con mucho zoom | §3.5 |

---

## 1. Lo que se midió antes de diseñar

Nada de esto se supuso; está medido sobre el código, los datos y el mapa real.

**La Red no encabeza la jerarquía.** Nada en el código la apaga ni la ata a la ruta: el
problema es de contraste. Contra el fondo de noche (`#272d39`):

| | calle | avenida | autopista | **Red** | Red / avenida |
|---|---|---|---|---|---|
| hoy | 1,78 | 2,17 | **4,36** | 3,81 | 1,75 |

La autopista le gana a la Red, y entre la Red y una avenida hay 1,75. En ancho, la Red
mide 14 px en zoom 17, lo mismo que las vías principales que tiene abajo. Fuera de la
ruta casi no se distingue: lo único que se lee como "Red" es el trayecto, y de ahí la
impresión de que la Red está atada a la ruta.

**Los nombres de la Red son más chicos que los de cualquier calle.** En zoom 16, 10,5 px
contra 12; los dos se congelan en 12 a partir de zoom 16–18, así que acercar no los agranda.

**La ruta no se separa de la calle: es un problema de ancho.** La hipótesis era que el mapa
base, generado hasta zoom 15 y estirado al navegar en 16,5, tuviera la geometría
simplificada. Se midió y es falsa: en 116 vértices de la ruta Liniers → La Boca contra los
tiles de zoom 15, la distancia a la calle tiene mediana 0,1 m y máximo **0,3 m**. Lo que se
lee mal es el ancho: la ruta mide **8 px fijos**. En zoom 13 es varias veces más ancha que
las calles y tapa a las vecinas; en zoom 19 es un hilo en el medio de una calzada de 30 px,
con los nombres pasándole por encima.

**La Red son 2.426 tramos, de 94 m de mediana** (p10 17 m, p90 276 m; 343 km contando cada
mano). Un efecto que recorra cada tramo por separado avanzaría desfasado: chispas sueltas,
no un brillo que corre por la avenida.

**MapLibre 5.6** permite líneas superpuestas con `line-offset`, `line-blur`,
`line-gradient` (con `lineMetrics`) y cambiar la pintura en vivo con `setPaintProperty`.

---

## 2. Las decisiones del usuario

1. **La Red siempre visible, en todos lados** — no sólo en el viaje. Sale su cuadro de la
   hoja de capas.
2. **El efecto, cromo y no halo.** Primero se eligió un halo que respira; al verlo, el
   usuario pidió cromo: *"ese brillo buscamos"*. El movimiento queda en el brillo, que
   destella despacio.
3. **La intensidad, "entre las dos"**: los colores de la variante suave con el ancho de la
   marcada. Se eligió sobre una comparación de cuatro fotos de la misma esquina.

---

## 3. Diseño

### 3.1 La jerarquía: la Red arriba de todo, el resto un escalón abajo

Todo en el estilo del cliente, sin regenerar tiles (se descartó hornear la pertenencia a la
Red en el mapa base: rehace el armado de 55 MB y el workflow sin dar nada que se vea).

Las calles del mapa base bajan a una variante apagada del mismo azul; la Red pasa a ser la
vía más clara y la más ancha. Tokens de `app.css`:

| Token | Noche hoy | **Noche** | **Día** |
|---|---|---|---|
| `--map-calle` | `#40546c` | `#354558` | `#ffffff` (igual) |
| `--map-avenida` | `#4d6179` | `#3d4d61` | `#ffffff` (igual) |
| `--map-autopista` | `#7494b4` | `#4a5f7a` | `#f1ead6` (era `#ffe6a3`) |
| `--map-red` (cuerpo) | `#6d89a8` | `#8fb6de` | `#5b8cc4` |
| `--map-red-canto` (nuevo) | — | `#3d5f85` | `#2f5a88` |
| `--map-red-reflejo` (nuevo) | — | `#cfe4f8` | `#9fc3e8` |
| `--map-red-brillo` (nuevo) | — | `#ffffff` | `#e8f3ff` |

Las vías principales usan el color de avenida, como hoy. De día las calles siguen blancas
—es el lenguaje del mapa de día— y la jerarquía la da la Red, que es la única vía
saturada.

Contraste contra el fondo, medido:

| | calle | avenida | autopista | cuerpo de la Red | canto |
|---|---|---|---|---|---|
| noche | 1,41 | 1,60 | 2,11 | **6,52** | 2,09 |
| día | 1,13 | 1,13 | 1,06 | **3,09** | 6,30 |

De noche el brillo blanco del centro duplica el contraste del cuerpo (2,12 entre brillo y
cuerpo).

**El ancho de la Red** (el cuerpo), por zoom, con la curva exponencial de 1,4 de las demás
vías: **5 px en 13, 10 en 15, 22 en 17, 48 en 19**. Es la vía más ancha del mapa en todo
zoom (la autopista llega a 38 en 19).

### 3.2 La Red siempre visible

- `red` sale de `GRUPOS` en `layers.js` como grupo apagable y su cuadro sale de la hoja de
  capas (`mapa/capas.js`).
- `installTruckLayers` la deja siempre visible. Una preferencia guardada con la Red apagada
  —`prefs.capas` o el botón viejo `truckLayers`— **se ignora para la Red** y se sigue
  respetando para las demás capas.
- **Las capas de la Red van siempre DEBAJO de la ruta.** Hoy el orden sale bien de
  casualidad: la Red se instala con el estilo y la ruta después, las dos antes de
  `calles-nombre`. Pero `createMap` reinstala las capas en cada `style.load` (cambio de día
  a noche), y una Red reinstalada con la ruta ya dibujada quedaría encima. Se instalan
  antes de `route-casing` si existe, y si no antes de `calles-nombre`.

### 3.3 El cromo

El metal se lee por la curva del brillo, no por el color (skill de diseño §10): bordes
oscuros, cuerpo en tono medio, una línea angosta muy clara en el centro. Sobre una línea de
mapa eso son **cuatro capas de la misma fuente**, todas como fracción del ancho del cuerpo:

| Capa | Qué es | Color | Ancho |
|---|---|---|---|
| `red-canto` | el borde de acero | `--map-red-canto` | cuerpo + 3 px |
| `red-linea` | el cuerpo | `--map-red` | §3.1 |
| `red-reflejo` | la banda clara | `--map-red-reflejo`, opacidad 0,55 | 0,55 × cuerpo |
| `red-brillo` | el especular, que destella | `--map-red-brillo` | 0,18 × cuerpo |

**El brillo va centrado, sin `line-offset`.** Con desplazamiento el especular quedaría del
lado izquierdo del sentido de cada tramo, y como los tramos de OSM y las dos manos de una
avenida van en sentidos distintos, saltaría de un borde al otro. Centrado se lee como un
tubo pulido en cualquier sentido.

**El destello.** La opacidad de `red-brillo` va y viene entre 0,55 y 0,95 en un ciclo de
2,5 s (curva coseno). Se actualiza con un temporizador **a 10 Hz**, no en cada cuadro de
animación, y **se detiene** cuando la página queda en segundo plano (`visibilitychange`) o
el mapa se destruye. Es un solo valor uniforme por capa: lo más barato que permite MapLibre.

Lo de "recorrer" la Red no se hace con un reflejo que avanza (`line-gradient` animado):
habría que unir antes los 2.426 tramos por calle, y cuesta un degradado por cuadro. El
destello sincronizado en toda la Red da el movimiento sin ese costo.

**Medición en el teléfono, obligatoria.** Antes de dar el destello por bueno se mide en el
APK, con el viaje en curso, el tiempo de cada actualización y si el mapa se traba. Si
cuesta, se baja a 5 Hz; si aun así cuesta, el cromo queda fijo. La forma del tubo no
depende de la animación.

### 3.4 Los nombres

**Crecen con el zoom, y los de la Red van siempre un escalón arriba:**

| zoom | 13 | 14 | 15 | 16 | 18 | 19 |
|---|---|---|---|---|---|---|
| calles (`calles-nombre`) | — | 10 | — | 12 | 14 | 15 |
| la Red (`red-nombre`) | 10 | — | 11,5 | 13 | 16 | 18 |

Con interpolación lineal entre paradas. Un test fija que en **ningún** zoom el nombre de la
Red quede más chico que el de una calle común.

**La saturación la controla la colisión de MapLibre**, no un tope de tamaño:
`text-padding` y `symbol-spacing` se mantienen y los nombres que no entran se descartan,
como hoy.

**El nombre de la Red se lee sobre el tubo**: blanco, en mayúsculas y negrita, con halo
oscuro más ancho que el de hoy (`text-halo-width` 2, color `--map-halo`). Verificado en
la foto de zoom 18.

**Un nombre por calle.** Hoy la avenida de la Red sale dos veces —en mayúsculas desde la
capa de la Red y en minúsculas desde el mapa base—. `calles-nombre` se filtra para no
dibujar los nombres que están en la Red: la lista se arma con los nombres del dataset de la
Red al cargarlo, y el filtro se aplica en ese momento. El nombre del mapa base y el de la
Red vienen del mismo `name` de OSM.

### 3.5 La ruta pinta la calle

El ancho de la ruta sigue al zoom, con la misma curva que las calles: **4 px en 13, 7 en 15,
14 en 17, 30 en 19**, con su canto blanco 3 px más ancho al 35 %. El tramo fuera de la Red
(amarillo) usa el mismo ancho.

- De lejos deja de tapar a las calles vecinas.
- De cerca llena la calzada en vez de flotar como un hilo.
- **La ruta sigue mandando**: va por encima de toda la Red (§3.2) y por debajo de los
  nombres, como hoy (CLAUDE.md, "La ruta se dibuja DEBAJO de `calles-nombre`").

**La flecha blanca de la maniobra escala igual**, en proporción a la ruta, para no quedar
más angosta que la línea que marca.

### 3.6 La autopista sin punteado

Sale la capa `autopista-centro` (`line-dasharray [4, 5]`). Se quedan la banda y las dos
líneas de carril, que son las que la hacen leer como autopista. Nada más se toca.

---

## 4. Cómo se verifica

**Tests** (`tests/web/`), cada uno visto en rojo primero:

- el estilo no tiene ninguna capa con `line-dasharray` sobre `highway`;
- el nombre de la Red es mayor o igual al de una calle en cada zoom de 13 a 19;
- el ancho de la ruta y el de la Red crecen con el zoom, y la Red es la vía más ancha;
- con los tokens de noche y de día, la Red tiene más contraste que la autopista, y la
  autopista más que la avenida;
- `red` no es un grupo apagable y la hoja de capas no tiene su cuadro; una preferencia
  vieja con la Red apagada no la apaga;
- el destello: la curva de opacidad va de 0,55 a 0,95 y vuelve en 2,5 s (función pura).

**Fotos de antes y después** a 375 × 812, de noche y de día, en zoom 13, 15, 17 y 19, en dos
lugares: la transversal llegando a Av. Juan B. Justo, y Barragán llegando a la Autopista
Perito Moreno (el caso que describió el usuario: ir por una calle que no es de la Red y
llegar a una que sí).

**El teléfono**: el destello con un viaje en curso (§3.3).

---

## 5. Fuera de alcance

- **Parte C**: el cuadrado que no carga y las manchas azules que desaparecen al acercarse.
  Las manchas se vieron en la verificación de la parte A (al oeste de Villa Fiorito y cerca
  de Glew) y se investigan ahí.
- Regenerar el mapa base a un zoom mayor: medido, no hace falta (§1).
- Un reflejo que avance por la Red (§3.3).
- Los colores de los demás elementos del mapa (manzanas, agua, parques, rótulos de barrio).

## 6. Riesgos

| Riesgo | Qué se hace |
|---|---|
| El destello cuesta batería o traba el mapa en el teléfono | Se mide antes de darlo por bueno; 5 Hz o fijo (§3.3) |
| Cuatro capas de líneas sobre 2.426 tramos pesan más que una | Son la misma fuente y el mismo teselado; se mide el tiempo de dibujo en el teléfono junto con el destello |
| Un nombre de la Red escrito distinto que en el mapa base sigue saliendo dos veces | El filtro es por igualdad exacta del `name` de OSM; si aparece algún caso, se agrega la normalización |
| El día derivado no se lee igual de bien | Se fotografía de día igual que de noche, con números |
