# Prototipo del GPS — Waze como referencia, Maps para las capas

**Es un prototipo, no código.** Diecisiete tableros de la pantalla del mapa,
**medidos píxel por píxel** sobre las 16 capturas de Waze (Android, modo noche,
720 × 1600) de `docs/referencias/waze/` y 1 de Google Maps, y adaptados a lo
nuestro: la Red de Tránsito Pesado, los gálibos, los lugares para camiones, el
camión elegido. Un dp de Waze es un píxel de estos tableros; cada color está
sampleado de la captura y cada medida contada (los comentarios `waze-NN` de
`gps.mjs` dicen de cuál).

**Se ve acá:** https://claude.ai/artifact/42KH4a8piCQSCb5xez2K4H (lienzo de
diseño, privado, del dueño del repositorio). Cada `.dc.html` de esta carpeta es
un tablero de ese lienzo; `canvas.json` los ubica y lleva las notas.

## Qué hay

| Tablero | Qué es |
|---|---|
| `Sistema` | Las medidas contadas, la paleta sampleada, el lenguaje del tráfico aplicado a las restricciones, la escala tipográfica en Roboto, chapas y pines, calcomanías, seis reglas |
| `Main` (Viaje), `Aviso`, `Movido` | Navegando: banda negra de 127, globo clavado, chevrón, píldora de calle, botón de aportar, hoja de 137; el aviso de paso a nivel; "Volver a centrar" |
| `Reposo`, `Buscar` | El mapa en reposo con la búsqueda como píldora, y la hoja de búsqueda |
| `General`, `Lista` | Vista general con Mapa/Lista y las tarjetas con línea de tiempo; cambiar de ruta en viaje |
| `Rutas`, `Detalles` | Elegir ruta como lista de Waze y los detalles a un toque, con el mono sólo ahí |
| `Capas` | La hoja de Maps: datos para el camión y categorías de lugares |
| `Lugar`, `LugarComunidad` | La ficha: lo verificado separado de lo comunitario, el voto, "Ir" |
| `Aportar`, `Marcar` | "¿Qué hay acá?" y marcar el punto |
| `Dia` | El viaje de día, derivado: no hay captura de Waze de día |
| `Reanudar` | "¿Seguís yendo a…?" al abrir la app con un viaje abierto |

## Cómo se regenera

```powershell
node gps.mjs                     # escribe los .dc.html, canvas.json e index.html (vista previa)
```

Y el lienzo se vuelve a armar con la skill `/design` (`seed-canvas.mjs`) a
partir de esos archivos, con `binoculares.png` como imagen. `index.html` es sólo
una vista previa para un navegador común; el artefacto es el lienzo.

`gps.css` es la hoja de estilos; `gps.mjs` dibuja el mapa en SVG —trama de
calles de dos zooms, manzanas en dos tonos, predios, parques, agua, autopista
con carriles, ferrocarril, flechas de mano, semáforos, ruta, globos, chapas y
pines, con proyección para la vista inclinada— y arma cada tablero.

## Lo que decide este prototipo

- **Se copian patrones y medidas, nunca la marca**: ni el logo de Waze, ni los
  Wazers, ni sus ilustraciones, ni su tipografía de marca. Las calcomanías son
  dibujos propios; el mono es nuestro; la Red es nuestra.
- **Tráfico → restricciones.** Celeste por la Red, amarillo fuera de ella. Sin
  dato de tráfico no se inventa. **Ninguna ruta lleva rojo**: lo que el camión no
  puede transitar no entra al cálculo. Las rayas rojas quedan para la Fase 5.
- **La Red es la vía más clara y más ancha del mapa** —el lugar que en Waze ocupa
  la autopista—, con el nombre en mayúsculas; lo que no es Red, más fino y más
  oscuro. La autopista lleva carriles y centro punteado, como en waze-08.
- **Dos formas, dos orígenes**: chapa cuadrada blanca para el dato fijo (como las
  cámaras de Waze, con su semáforo chico); pin redondo de 32 para los lugares,
  con el anillo que dice de dónde sale el dato (blanco verificado, celeste
  comunidad con contador, gris sin confirmar).
- **Roboto sólo en el GPS**, en los tamaños medidos; Nunito en el zócalo y el
  resto de la app.
- **La calle actual va en la píldora negra de Waze, blanca**, sin la letra
  verde: se probó y no quedó bien (16/09/2026).
- **Sin velocímetro, sin micrófono, sin barra de estado dibujada**; el menú
  cuadrado de Waze no va porque el zócalo tiene "Más"; el S.O.S. es nuestro y
  va como segundo círculo negro en viaje.
- **Casa y Depósito**, lugares guardados en el servidor; el mono aparece una sola
  vez, en los detalles de la ruta; el botón amarillo abre "¿Qué hay acá?" con
  las seis categorías de lugar.
