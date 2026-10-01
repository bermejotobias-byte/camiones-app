---
name: diseno-camiones-app
description: El lenguaje visual de la app de camiones — Duolingo + camioneros + arcade, extraído de capturas reales — y la mascota, el mono camionero, con su brief textual y sus poses. Componentes, jerarquías, estructuras de pantalla, y el GPS aparte: sobrio, con la piel de Waze medida sobre capturas (§17). Invocar antes de diseñar, maquetar, animar o dibujar cualquier pantalla, el mapa incluido.
---

# Diseño — Navegador de Tránsito Pesado

## 1. La regla principal

**DUOLINGO + CAMIONEROS + ARCADE.**

Textual del usuario, 09/09/2026:

> *"Cuanto más fiel sea la estructura y lenguaje visual de Duolingo, mejor; la
> adaptación debe ocurrir principalmente en la temática y estética camionera."*

O sea: **la estructura se copia, el tema se cambia.** Jerarquía, navegación,
componentes, ritmo y sensación vienen de Duolingo. Los íconos, ilustraciones,
metáforas y paleta vienen del mundo del camión.

## 2. Dónde aplica y dónde NO

**Aplica a toda la app EXCEPTO el GPS.** Textual del 08/09/2026: *"El GPS es lo más
serio y sobrio de la aplicación."*

Eso no es una excepción estética, es una regla de seguridad: la pantalla que se
mira manejando no lleva color de recompensa, ni ilustraciones, ni celebraciones.
Está escrito desde el principio en `app.css` como **dos intensidades**, y esto lo
ratifica. **El zócalo inferior tampoco se muestra en el GPS.**

## 3. Las fuentes

Catorce capturas que mandó el usuario el 09/09/2026, analizadas ese día:

| Qué | Cuántas |
|---|---|
| Editor de avatar de Duolingo (fondo, sombrero, cuerpo) | 3 |
| Perfil (arriba, con resumen, con menú abierto) | 3 |
| Desafíos / metas | 1 |
| Home con el camino y los contadores | 1 |
| Onboarding: nombre, racha, splash | 3 |
| Fin de desafío con EXP | 1 |
| Carnet de conducir, frente y dorso | 2 |
| Camión en pixel art | 1 |

**Los archivos están en `docs/referencias/duolingo/`** desde el 09/09/2026: 15
imágenes. Son la **referencia visual principal para toda la interfaz salvo el
GPS**. Mirarlas antes de maquetar; lo que sigue es el análisis, no un reemplazo.

Si hace falta una pantalla, componente o interacción que no está entre ellas, el
usuario pidió que **se le indique exactamente cuál** y la agrega.

## 4. Vocabulario de componentes

Leído de las capturas, no inventado.

### El botón con reborde inferior

**Es la firma de la interfaz.** Todo lo tocable tiene un borde inferior sólido y
más oscuro, de 3 a 4 px, que lo hace ver hundible. Al presionar, el botón baja y el
reborde desaparece.

- Primario: relleno saturado, texto en mayúsculas, ancho completo, ~50 px de alto
- Secundario: transparente, borde de 2 px, mismo alto
- El reborde es **el mismo color más oscuro**, no una sombra

### Barras de progreso

Completamente redondeadas, gruesas (~20 px), **con el valor escrito adentro**:
`10 / 10`. Vacía es gris oscuro; llena es de color saturado. A la derecha de la
barra va **la recompensa dibujada** — en Duolingo un cofre; acá, carga o encomienda.

### Fichas de estadística

Rectángulos con **borde de color**, etiqueta arriba en mayúsculas chicas y
espaciadas, y abajo ícono + valor grande. **Cada ficha con su color**: en la
pantalla de fin de desafío hay tres, amarilla, verde y celeste.

### Etiquetas de sección

Mayúsculas, chicas, muy espaciadas, gris medio: `RESUMEN`, `LOGROS`, `DESAFÍO DEL
DÍA`. Cuando la sección lleva a otro lado, un chevron `>` a la derecha.

### Contadores de la barra superior

Fila de ícono + número, **cada uno de un color distinto**. En el home de Duolingo
son cuatro: idioma, racha, gemas y **batería**. Acá serían: nivel, racha, EXP y
batería.

### Zócalo inferior — construido el 12/09/2026

Íconos ilustrados a color, sin texto. **El activo lleva un recuadro redondeado**
alrededor. Duolingo usa seis; acá son cuatro: GPS · JUEGOS · S.O.S. · MÁS.

**Está hecho** (`js/dock.js`), leído de la captura del perfil con el menú "…"
abierto — la única que muestra el activo y cómo se abre "más":

- Barra de **64 px + área segura**, mismo fondo que la página, filo claro arriba.
- Cuatro dibujos de **30 px, rellenos y a dos tonos** (el color y su sombra corrida
  2 px), que es lo que los hace ilustración y no trazo: flecha de navegación
  celeste, mando violeta, **salvavidas rojo** (semántico: es emergencia), tres
  puntos índigo. Colores **fijos**: un dibujo no cambia con el tema.
- Activo: caja de 52 px con **borde de 2,5 px en la marca al 55%** y fondo
  `--brand-soft`, radio 14. El dibujo no cambia; cambia su marco.
- **"Más" no navega: abre una hoja desde el zócalo** que atenúa lo de atrás, con
  filas de 60 px —dibujo chico + texto en negrita— separadas por un filo: Perfil ·
  Carnet · Mis camiones · Chat (con chapa *Pronto*, apagado) · Configuración.
  Tocar afuera la cierra. **"Más" queda marcado mientras se está en cualquiera de
  sus pantallas**, como en la referencia.
- Es **pieza persistente de la cáscara**: vive fuera del contenedor de la vista
  (`#view`) y no se redibuja al navegar.

**Dos decisiones del usuario, 12/09/2026:**

1. **Se ve también en el mapa en reposo** y **se esconde sólo durante el viaje**;
   vuelve al salir. Lo avisa `navigate.js` con un evento `viaje` —no una
   llamada, para que el mapa no conozca al zócalo— y el mapa se redimensiona al
   frame siguiente, cuando el zócalo ya salió del layout y le devolvió sus 64 px.
2. **JUEGOS existe antes que los juegos**: abre una pantalla "pronto" con el lugar
   de la mascota reservado y la trivia anunciada. Una pestaña apagada se lee como
   rota, y una que falta cambia la forma del zócalo cuando aparece.

**Resuelto el 16/09/2026 con el GPS de Waze:** el menú hamburguesa del mapa se
sacó (decisión del usuario, con "sin velocímetro ni micrófono"); la salida del
mapa es "Más" del zócalo, y durante el viaje el S.O.S. y "Salir" están en la
pantalla del viaje misma (§17).

### Logros

Insignias redondeadas o tipo escudo. **Bloqueado = silueta gris**, con el número
del objetivo encima (10, 5, 100). Se muestran en fila de cuatro con chevron a
"ver todos".

### Tarjetas

Esquinas redondeadas generosas (~16 px), superficie apenas más clara que el fondo,
**sin sombras marcadas**. La jerarquía la da el color, no la profundidad.

## 5. Estructuras de pantalla

### Perfil

De arriba abajo, leído de las capturas:

1. Nombre grande + acciones (compartir, configuración) arriba a la derecha
2. **Banda de color** con el avatar de busto, ocupando bastante alto
3. Identificador y fecha de alta, en mayúsculas grises
4. Fila de tres cifras sociales
5. Botón secundario de ancho completo
6. Tarjeta de "completá tu perfil" con ilustración y botón primario
7. `RESUMEN` — **grilla de 2×2** con ícono + valor + etiqueta
8. `LOGROS` con chevron — fila de cuatro insignias

### Metas y desafíos

1. Cabecera de color con título, bajada e ilustración
2. Por cada meta: etiqueta de sección + **temporizador a la derecha** (`4D`, `6H`)
3. Título de la meta
4. Barra de progreso con `n / n` adentro
5. **Recompensa dibujada** a la derecha
6. Botón de acción cuando corresponde

### Fin de actividad

1. Ilustración celebrando, grande y centrada
2. Título en color cálido
3. **Tres fichas** en fila, cada una con su color
4. Botón primario ancho + botón de compartir al costado

> **De esta pantalla se toma la composición y las tres fichas, no lo que Duolingo
> festeja en ella.** Decisión del usuario, 10/09/2026: al cerrar un viaje se
> muestran **las estadísticas del viaje, la EXP ganada y lo desbloqueado** — y
> **no** la progresión de escalones. Los escalones se ven en el perfil y en logros,
> que es donde viven.
>
> El motor sí avanza los escalones al cerrar el viaje; lo que cambia es qué se
> muestra, no qué se calcula.

**Construida el 12/09/2026** (`views/fin-viaje.js`, ruta `fin`). Llega al cerrar
un viaje con *Llegué* o al llegar a destino; abandonar no festeja nada. Muestra:
la mascota en el momento `festejo` (o `nivel` si subió, o `error` si no
acreditó: la pose de la rueda, el 😅 del brief), el título en el **acento** —el
único título naranja de la app, porque es festejo—, origen → destino, **tres
fichas** con su color (km celeste, tiempo índigo, EXP violeta) cuyos números
**cuentan desde cero**, la sección *Desbloqueaste* con las insignias de los
escalones que ese viaje completó, y la tarjeta *Nivel 2 → 3* si subió. Secuencia
con retardos: mascota con rebote, confeti, título, fichas de a una. Con
`prefers-reduced-motion` todo quieto y sin confeti. Si no acreditó kilómetros lo
dice, sin confeti.

Para eso el servidor **devuelve lo que ganó el viaje** en el cierre (`earned`,
campo opcional de `TripDto`): EXP del viaje y de escalones, escalones
completados con su objetivo, nivel antes y después.

### Racha

Globo de diálogo con el mensaje, ilustración, **número gigante** en naranja, la
palabra abajo, y una **fila de siete días** con marca en los cumplidos.

### Editor de avatar

**Esta captura responde la pregunta de las ranuras.**

1. Barra superior: cerrar a la izquierda, título al centro, **OK a la derecha**
2. Vista previa del avatar sobre fondo claro, ocupando la mitad de arriba
3. **Tira horizontal de categorías**, con scroll: se vieron cara, cuerpo, ojos,
   pelo, lentes, bigote, sombrero, ropa y fondo. La activa se subraya
4. **Tira de colores** de la pieza elegida, también horizontal
5. Grilla de **3 columnas** con las opciones, dibujadas sobre la silueta
6. **"Ninguno" siempre es una opción**, y va primera

## 6. Las ranuras del avatar

Derivadas de lo anterior, adaptadas al camionero:

| Ranura | Notas |
|---|---|
| Cara | Forma y tono de piel |
| Cuerpo | Contextura |
| Ojos | |
| Pelo | Con "ninguno" |
| Barba / bigote | Con "ninguno" |
| Lentes | Con "ninguno" |
| Gorra / sombrero | Muy del oficio |
| Ropa | Camisa, campera, chaleco reflectivo |
| Fondo | Color liso, como en la referencia |
| **Camión** | **No está en Duolingo.** Es la ranura propia: el camión coleccionable que se exhibe |

**Cada pieza lleva además su color.** Eso multiplica las combinaciones sin
multiplicar los dibujos, y es lo que hace viable el sistema combinable.

## 7. El carnet

Las dos referencias de licencia de conducir dan la estructura del perfil:

**Frente:** banda de encabezado con el título, **foto a la izquierda o derecha**,
campos etiquetados en columna (número, nombre, fecha, clase, vencimiento), firma, y
una banda inferior con el número y la clase.

**Dorso:** campos en cajas separadas, código de barras, y la línea de caracteres
tipo MRZ que le da el aire de documento real.

### El carnet NO es la pantalla de perfil

**Corrección del usuario, 10/09/2026, y esta skill lo tenía mal.** El v3 §10 dice
que *"la pantalla principal del perfil debe funcionar visualmente como un carnet"*,
y de ahí salió la confusión: se venían tratando como la misma pantalla.

Son **dos pantallas distintas**, aunque compartan algún dato:

| | Qué lleva |
|---|---|
| **Perfil** | Logros, metas, avatares, y **editar el skin** |
| **Carnet** | Nada de eso. **Lo que lleva lo decidió el usuario el 11/09/2026** — ver "§7bis. El carnet, construido" |

Textual: *"Perfil no es la misma pantalla que la del carnet, por más que muestren
algún dato similar. (…) En el perfil se ven los logros, metas, avatares, se edita
el skin. Esas cosas no se muestran en carnet."*

**No inferir el contenido del carnet de las referencias de licencia de conducir.**
Esas referencias dan la **estructura visual** —bandas, campos etiquetados, foto,
tipografía de datos—, no la lista de campos.

La gracia es que **se sienta un documento**: bandas, campos etiquetados,
tipografía de datos monoespaciada. Pero con el color y el peso de Duolingo, no con
la sobriedad de un carnet real.

## 7bis. El carnet — cuatro vueltas en dos días, y lo que quedó

> **NO ESTÁ APROBADO.** Textual del usuario, 12/09/2026, después de la cuarta
> vuelta: *"no me gusta pero por el momento vamos a dejarlo así"*. Se
> congeló para avanzar con otras cosas, no porque esté bien. Cuando se
> retome, **no partir de lo que hay**: preguntarle qué es lo que no le gusta
> —no se dijo— antes de tocar una línea. Cuatro vueltas sin esa pregunta es
> justamente lo que pasó.

Está hecho: pantalla `carnet`, entrada *Mi carnet* en el menú, una tarjeta que
**se da vuelta al tocarla** (giro 3D). Llegó a su forma final el 12/09/2026
después de **cuatro vueltas**, y conviene conocerlas porque cada una enseñó algo:

| Vuelta | Qué se hizo | Qué dijo el usuario |
|---|---|---|
| 1 | Grillas y flex con tamaños "razonables" sobre tres referencias | *"No respetaste los parámetros (…) el avatar está muy chico (…) las fuentes, sus tamaños, los zócalos, nada"* |
| 2 | Proporciones parecidas, una mono, bloques | *"No me está convenciendo"* |
| 3 | **Copia exacta** de una nueva referencia única, medida en píxeles y puesta en porcentajes | (aceptada como método, pero…) |
| 4 | Los mismos elementos con **ejecución profesional** | *"Que se vea más profesional (…) orientate en los diseños de las grandes empresas"* |

**La lección de las cuatro:** primero se copia la referencia *exactamente* para
fijar qué elementos hay y dónde van; **después** se eleva la ejecución con los
criterios de producto. Hacer las dos cosas a la vez es lo que falló en 1 y 2.

### Los elementos — de la referencia del 12/09/2026

> La referencia llegó pegada en el chat, no como archivo. Es una licencia azul,
> frente y dorso, sobre fondo amarillo. Si hace falta de nuevo, pedírsela.

**Frente:** título del documento, chapa de nivel, foto en retrato, campos (nombre,
alias, nacimiento, nacionalidad, experiencia), firma, chip, número, emisor.
**Dorso:** banda magnética, nombre del camión y clase, campos (marca, modelo,
patente, ejes), silueta, huella, código de barras, chip, línea MRZ.

### La ejecución — de Apple Wallet y las credenciales bancarias

- **Jerarquía tipográfica.** Etiqueta chica (6,5 px) en mayúsculas espaciadas
  (`.14em`) al 62% de blanco; valor grande (11 px, Nunito 800) en **caja mixta**.
  Nunca `ETIQUETA:VALOR` todo en mayúsculas: es convención de ilustración de
  stock, no de producto.
- **Dos tipografías con roles.** Nunito para todo lo que se lee. **Space Mono
  sólo para lo que se copia**: el número del carnet (espaciado `.16em`, como el
  número de una tarjeta), la patente y el MRZ. Vendorizada en 400 y 700, 16 KB
  cada una.
- **Cada dato en su celda**, dentro de un **panel translúcido** (`backdrop-filter:
  blur`, blanco al 13%, borde al 24%). Separa el aire y un hairline entre filas,
  **no una caja de color por dato**.
- **Un matiz dominante en tres pasos** (`#163f7c → #2364b3 → #3f8fdc`, dentro de
  la paleta fría) y **UN acento**: la chapa de nivel, en el naranja de la app.
  **Oro sólo en el chip**, porque es metal. El fondo de la foto es frío y claro,
  no amarillo: en una credencial profesional el fondo de la foto es neutro.
- **Profundidad real**, en capas: degradado en diagonal, luz radial arriba a la
  izquierda, textura ondulada al 9%, brillo diagonal al 14%, sombra en dos capas
  (ambiente lejana + contacto cercana), **filo claro de 1 px arriba** —lo que
  hace que la tarjeta parezca tener canto—, y sombra propia en la foto, el chip
  y la chapa.
- **La silueta y las ruedas cambian con el camión**: tres cuerpos, ruedas por
  importancia (dirección, tracción, acoplado). Las ruedas son los ejes.
- **Colores fijos.** El carnet es un objeto, no interfaz.

### Lo que sigue siendo cierto

- **Perfil ≠ Carnet** (§7). Nada de logros, metas ni avatares en el carnet.
- **Fecha de nacimiento sólo al dueño**; la vista pública, cuando exista, la omite.
- Todo lo dibujado es SVG en línea. `prefers-reduced-motion` apaga el giro.
- Los textos se verifican **por el DOM** (`scrollWidth > clientWidth`), no por la
  captura: la captura del panel toca la página y da vuelta la tarjeta.

## 8. El arcade

La referencia de pixel art del camión marca por dónde va: **el arcade entra por los
objetos coleccionables y los juegos**, no por la interfaz entera.

Los camiones desbloqueables en pixel art funcionan como cromos, y contrastan bien
con la interfaz limpia y redondeada de alrededor. Es la misma lógica de las dos
intensidades: cada registro en su lugar.

## 9. Lo que NO se copia

El propio usuario lo pidió en el v3: *"No copies contenido propietario."*

- **El búho.** La mascota es de Duolingo. Si la app quiere una, tiene que ser
  propia — un camión, un personaje del oficio
- **La tipografía** de Duolingo, que es un tipo encargado
- **El logotipo, los colores de marca y las ilustraciones**

Lo que sí se toma es lo que no es de nadie: cómo se ordena la información, cómo se
comporta un botón, dónde va el progreso, qué se celebra y cómo.

## 10. Paleta — decidida el 09/09/2026

**Fría, agradable y moderna: celestes, azules, azules oscuros, violetas** y
variaciones dentro de ese espectro. **Se permiten degradados** entre esos tonos
para reforzar lo arcade.

Y dos colores con uso **exclusivo**, que no se usan para nada decorativo:

| Color | Sólo para |
|---|---|
| **Rojo** | Errores, negar, peligro, estados negativos |
| **Verde** | Confirmar, éxito, respuestas correctas, estados positivos |

### La buena noticia: `app.css` ya casi cumple

| Token | Valor | ¿Entra? |
|---|---|---|
| `--brand` | `#35b8e8` celeste | ✅ |
| `--reward` | `#a97bf0` violeta | ✅ |
| `--ok` | `#43c98b` verde | ✅ y ya es de uso semántico |
| `--danger` | `#f0736a` rojo | ✅ y ya es de uso semántico |
| `--ground`/`--surface` | azules oscuros desaturados | ✅ |
| **`--warn`** | **`#e8b13c` ámbar** | ⚠️ **el único cálido que queda** |

**El ámbar de advertencia queda como la única excepción a la paleta fría, y
conviene que así sea.** Una advertencia que está fuera del espectro se ve más;
meterla adentro la volvería un celeste más. Se mantiene, con uso semántico
estricto — nunca decorativo.

**Consecuencia:** el **oro** queda descartado. Era cálido y esta decisión lo deja
afuera.

### El cromo volvió, pero frío — 10/09/2026

Esta sección decía que el cromo quedaba descartado junto con el oro. **El usuario
lo recuperó** para la barra de nivel: *"la barra de progreso de nivel que se barajó
en un diseño, que tenía el cromado brillante. Es más agradable y gratificante a la
vista."*

No hay contradicción con la paleta, y vale entender por qué: **lo que hace que algo
se lea como metal no es el matiz, es el degradado vertical.** Un brillo alto arriba,
una caída rápida a sombra, un especular secundario más abajo y sombra al pie — esa
curva asimétrica es lo que el ojo lee como superficie curva y pulida. El color puede
ser cualquiera. Así que el mismo efecto se consigue **dentro del celeste y el
violeta**, sin tocar la decisión de paleta fría.

Lo descartado en su momento era el cromo **cálido** —plateado con reflejos dorados—,
no el recurso.

### Los degradados son nuevos

Hasta ahora el único gradiente del sistema era el relleno de la barra de nivel
(celeste → violeta). La decisión los habilita más ampliamente **dentro del espectro
frío**, para lo arcade. Siguen sin entrar al GPS.

## 11. Tipografía — dirección decidida, fuente por elegir

**Redondeada, amigable, moderna y muy legible**, siguiendo el lenguaje de Duolingo
**sin usar su tipografía**, que es un tipo encargado y propietario.

**Restricción dura del proyecto: hay que vendorizarla** en `wwwroot/fonts`. La app
no baja nada de la red — adentro de un camión puede no haber señal, y la interfaz
entera viaja dentro del APK.

Candidatas, todas libres:

| Fuente | Para qué | Notas |
|---|---|---|
| **Nunito** | Interfaz y cuerpo | Terminaciones redondeadas, pesos 200–1000, muy legible. La más cercana en espíritu |
| **Fredoka** | Títulos y cifras | Redondeada geométrica, más contundente. Menos pesos |
| **Baloo 2** | Títulos y cifras | La más gruesa y arcade de las tres |

Recomendación: **dos fuentes como máximo** — una de interfaz y una de despliegue
para números grandes y títulos.

**El guaraní dejó de condicionar la elección.** Decisión del usuario del
09/09/2026: *"No diseñes la arquitectura alrededor de Guaraní en esta etapa."* El
sistema queda preparado para internacionalizarse, pero **la fuente se elige por
legibilidad y carácter, no por cubrir el `g̃`**. Cuando el guaraní entre, se
verifica ahí — y si la fuente no lo compone bien, se cambia o se le agrega una
fuente de respaldo para ese idioma.

Presupuesto: un subconjunto latino en `woff2` ronda los 30–60 KB por fuente.

## 12. La mascota — el mono camionero. Pilar del diseño y la gamificación

**El brief del usuario está textual en `references/mascota.md`** (12/09/2026) y
es un pilar: leerlo entero antes de dibujar, animar o diseñar un logro. Las seis
imágenes están en `docs/referencias/mascota/`. Lo que sigue es el análisis.

### Quién es

Un **mono camionero** en pixel art de 16 bits, con proporciones de arcade —cabeza
y manos grandes—. Es **el compañero de ruta**: acompaña, motiva, felicita y
reacciona. Divertido pero no infantil; con humor de camionero; orgulloso cuando
el usuario avanza y **empático cuando se equivoca** — nunca castiga.

Tres fuentes de personalidad, ninguna para copiar: BJ (espíritu de camionero),
los arcades clásicos tipo Donkey Kong (energía, formas simples, videojuego) y
Duolingo (omnipresente, expresiva, recurso de gamificación).

### El diseño base — leído de las hojas de poses

| Pieza | Como está en las referencias |
|---|---|
| Gorra | **Roja, con "TBF"** al frente. (Una hoja dice "MACK": es la marca de camiones; **confirmar que la definitiva es TBF**) |
| Camisa | A cuadros, **verde** con líneas más oscuras |
| Overol | **Azul** de jean, con tiradores y botones amarillos |
| Pelaje | Marrón oscuro; cara, orejas, manos y pies canela |
| Cara | Ojos redondos marrones, nariz chata, **sonrisa grande con dientes** |
| Pies | **Descalzo** en cuatro hojas; **con botas marrones** en una. **Confirmar** |

**La regla fundamental, textual:** *"La mascota debe ser siempre reconocible como
el mismo personaje. No crear monos diferentes para cada pantalla."* Las
variaciones salen de **pose + expresión + accesorios + situación + acción**, nunca
de cambiar el diseño base.

**La sexta imagen NO es el personaje.** Es una pantalla de arcade estilo Donkey
Kong donde el mono lleva **otro traje** (campera azul, pantalón rojo, gorro gris).
Sirve como referencia del **juego y del HUD** —vigas rojas, escaleras azules,
barriles, bananas, el camión TBF, surtidores, y **las vidas como cabezas del mono**
arriba a la derecha—, no del diseño base. Si el juego se hace, el mono adentro
tiene que ser **el mismo** de las hojas.

### Las poses que ya existen, y a qué momento van

Diecisiete poses en cinco hojas. Casi todas tienen un lugar en la app:

| Pose | Momento de la app | Emoción del brief |
|---|---|---|
| **Brazos arriba, gorro de fiesta, confeti** | Fin de viaje · subir de nivel · logro | 🎉 😎 |
| Con mate · con café | Inicio de jornada · racha del día | 🔥 |
| Con el mapa · con binoculares | Buscando ruta · alertando | 👀 |
| **Con el radar en la mano, cara seria** | Radar o control adelante | 👀 |
| **Cambiando la rueda con la llave** | Error, reintento, "lo arreglamos" | 😅 |
| Cargando combustible · comiendo | Paradas, POIs | — |
| Con el joystick · con las cartas (truco) | Juegos, trivia | 💪 |
| **Durmiendo en pijama y gorro** | Viaje nocturno · descanso | — |
| **Con la torta de cumpleaños** | Cumpleaños — la fecha ya está en el carnet | 🎉 |
| Parado, neutro (la hoja individual) | Tarjeta de "completá tu perfil" · vacío | 💪 |

Los momentos que el brief pide y **no tienen pose todavía**: *motivando a
continuar* (💪 sin objeto), y una **expresión de preocupación** para la racha en
riesgo. Pedírselas al diseñador, no inventarlas.

### Lo técnico, que condiciona todo

- **Tiene aire de pixel art, pero no es pixel art nativo.** Las hojas son
  renders de 300 a 500 px por pose con "píxeles" de 8 px y ruido de JPEG. Se
  muestran con el **suavizado normal** del navegador, al tamaño que pide cada
  pantalla; `image-rendering: pixelated` al achicarlos los llena de escalones.
  (Esta sección decía lo contrario cuando se esperaba pixel art a resolución
  nativa del diseñador.)
- **Las imágenes de WhatsApp eran referencias; ahora son la fuente de los
  assets.** El usuario les sacó el fondo con una herramienta en línea el
  12/09/2026 y `data/cortar-mascota.ps1` las corta en un PNG por pose. Ver
  abajo, "Los PNG".
- **No dibujarlo nosotros.** Ni como provisorio: la regla de consistencia lo
  prohíbe, y un mono aproximado en el código termina siendo el mono. Una pose
  que falta muestra **el hueco del mismo tamaño**, no un dibujo.
- **Las animaciones son de la pose, no del dibujo**: entrada con rebote, confeti,
  salto — cosas que se hacen con `transform` sobre el sprite entero. Animar
  partes del cuerpo exige sprites por cuadro, y eso es del diseñador.

### El sistema de momentos — construido el 12/09/2026

`js/mascota.js`. Traduce **momentos** de la app a **poses**: `festejo`, `nivel`,
`racha`, `alerta`, `radar`, `error`, `motivar`, `perfil`, `juegos`,
`nocturno`, `cumple`. Cada momento tiene su pose de las hojas y el texto
alternativo. `DISPONIBLES` lista las poses con PNG en `wwwroot/img/mascota/`;
sin PNG, el hueco del mismo tamaño. **Un test cruza esa lista con la carpeta en
los dos sentidos** (`tests/web/mascota.test.mjs`): un PNG que no está en la
lista no se muestra nunca, y una pose listada sin PNG es una imagen rota en la
pantalla de festejo — ninguna de las dos falla en consola. `NATIVO` es el lado
base en px CSS (64) y cada pantalla lo multiplica por su escala.

Dos momentos comparten pose a propósito hasta que existan las propias: `nivel`
usa el festejo y `motivar` el neutro. **Pedírselas al diseñador**, no inventarlas.

**Decisiones del usuario, 12/09/2026:** el diseño base canónico es **gorra TBF y
descalzo**. Los assets iban a llegar del diseñador; el mismo día el usuario
convirtió las hojas él mismo (abajo).

### Los PNG — 12/09/2026, trece poses en la app. **Aprobado el 14/09.**

El usuario pasó cuatro de las seis hojas por una herramienta de quitar fondo y
las dejó en Descargas. `data/cortar-mascota.ps1` las corta por los huecos de
alfa, normaliza el alto del mono **parado** entre hojas, lo pone con los pies al
piso en un lienzo cuadrado y posteriza el color a 5 bits (el ruido del JPEG
duplicaba el peso). Trece PNG, **964 KB en total**, y el script los regenera
idénticos desde `docs/referencias/mascota/`.

Lo que hubo que decidir, y conviene saber:

- **Sólo entran las hojas con gorra TBF.** Dos de las cuatro convertidas llevan
  gorra **MACK** —la marca de camiones— y quedaron afuera: es una marca ajena.
  Consecuencia: **no hay pose `neutro`** (parado sin hacer nada), porque la única
  hoja que la tiene es MACK. Los momentos `motivar` y `perfil` muestran el hueco.
- **Las hojas TBF no cumplen el canon.** El canon es TBF **y descalzo**; las dos
  hojas TBF convertidas van **con botas**, y la del festejo (TBF, descalza, la
  canónica) no venía convertida: **la convertí yo** desde el JPEG, sacando el
  damero por inundación desde el borde y comiendo dos píxeles de halo gris. Si
  el usuario la pasa por su herramienta, se reemplaza el archivo y se vuelve a
  correr el script. El mono con botas y el descalzo conviven en la app hoy;
  cuando el diseñador entregue las definitivas, se unifica.
- **Los estilos no son uno.** La hoja de cinco poses (comiendo, mate, cartas,
  mapa, binoculares) es de perfil y con contorno blanco de calcomanía; la del
  festejo es de frente y sin contorno. Es lo que hay en las referencias, no una
  elección nuestra; el brief pide un solo personaje y esto se le señala al
  diseñador, no se corrige en código.
- **La pose `combustible` se achica** para que la manguera entre en el lienzo:
  es 1,3 veces más ancha que alta. Ningún momento la usa hoy.

Dónde se ve: **fin de viaje** (`festejo`, o `rueda` si no acreditó), **juegos**
(`joystick`, que reemplazó al hueco suelto `.mascota-slot`). Verificado en el
navegador a 375 px; falta el teléfono.

### Los logros — construidos, con la escala de Duolingo

Decisión del usuario (12/09/2026): *"El logro cambia de color al subir, como el
Duolingo"*, y de las tres escalas ofrecidas eligió **la de Duolingo: rojo →
violeta → dorado → celeste**. `js/logros.js` tiene los diez colores.

**Es una excepción deliberada a la paleta**, y hay que decirlo cada vez: el rojo
está reservado para errores y el oro estaba descartado por cálido. Acá los dos
son **colores de escalón**, y lo son porque el usuario eligió la escala con esa
consecuencia a la vista. **No extender la excepción** a nada que no sea la
insignia de un logro.

**El color va por fracción del recorrido, no por índice**: la escala tiene diez
colores y kilometraje tiene setenta escalones. Por índice, el escalón 13 de 70
salía celeste brillante —el color de "completo"— con menos de un quinto hecho.
Lo encontró la prueba, no el diseño.

**Las insignias están dibujadas en pixel art** (SVG en grilla de 24, contorno
oscuro, luz arriba a la izquierda, `shape-rendering: crispEdges`): un escudo
común y un símbolo por pista. Son provisorias en un sentido preciso: **el
diseñador puede reemplazar los trazos por los suyos, en el mismo lenguaje del
mono, sin tocar nada más.** Se usan en el perfil y en el fin de viaje.

## 13. La pantalla de logros

Leída de dos capturas del 09/09/2026. **Tiene dos secciones distintas y no hay que
confundirlas.**

### Personal Records — lo mejor que hiciste alguna vez

Tarjetas en **fila horizontal con scroll**. Cada una:

- Fondo con **degradado del color del récord** y un resplandor detrás
- Ilustración del personaje
- **El número, enorme**, con contorno grueso, en el color del récord
- Nombre en blanco
- **La fecha en que se logró**, en gris

Son marcas únicas —*racha más larga: 195*, *más XP: 703*—, no progresiones. Se
guarda el valor y **cuándo** ocurrió.

### Awards — la colección, en escalones

Grilla de **3 columnas**. Cada logro:

- Insignia ilustrada, tipo escudo o rombo redondeado, con un personaje adentro
- **El objetivo del escalón actual en números grandes**, pisando la insignia
- Nombre en negrita
- **`10 of 10`, `6 of 10`, `5 of 5`** en gris — el escalón, no una barra

**El hallazgo que importa: los logros son por escalones, no sueltos.** No hay
cuatro logros separados de viajes. Hay **un** logro que sube de nivel: cada escalón
tiene un objetivo más alto y **la insignia cambia de color** al subir. Comparando
las dos capturas, el mismo logro aparece rojo en un escalón bajo y celeste al
completarse — la escala parece ir de rojo a violeta a dorado a celeste, aunque eso
último es inferencia, no lectura segura.

## 14. La pantalla de Perfil — construida el 10/09/2026

> **La banda celeste con trama de esta pantalla NO está aprobada** (usuario,
> 13/09/2026: *"todavía no fue aprobado"*). El prototipo del §16 la reemplaza
> por luz celeste, avatar con resplandor y la chapa de nivel. Lo que sigue
> describe lo que hay **en código**, no la dirección.

Está hecha y andando. **Estructura leída de la captura del perfil**, de arriba
abajo, y lo que se decidió al adaptarla:

| Pieza de la referencia | Cómo quedó acá |
|---|---|
| Banda de **color plano** que arranca arriba de todo | `--band` (celeste). **La barra superior toma el mismo color**: en la referencia no hay costura entre las dos, son un bloque. El título de la barra es el nombre del camionero |
| Busto del avatar **cortado por el borde**, sin círculo ni aro | `.avatar-bust`, 92 px, `margin-bottom: -14px` y `overflow: hidden` en la banda. La ausencia de marco es lo que hace que el personaje se asome en vez de estar en una foto de perfil |
| `@ALIAS · SE UNIÓ EN 2026`, gris y en mayúsculas | `@DEMO · 🇦🇷 ARGENTINA · DESDE 2026`, más una segunda línea con el camión que se exhibe |
| Fila de **tres cifras sociales** | **KILÓMETROS · VIAJES · LOGROS**. No hay social todavía |
| **Botón secundario** ancho, transparente, borde de 2 px | `.btn-outline.btn-duo` — *Ver mis viajes* |
| Tarjeta **"¡Completá tu perfil!"** con "QUEDAN N PASOS" y botón primario | Igual, y **desaparece al completarse**. Los pasos son nombre, nacionalidad y camión. Acá va el **acento naranja** |
| `RESUMEN` en grilla 2×2 | **Sin tarjetas y sin bordes**: dibujo + valor sobre el fondo, y la **unidad adentro del valor** (`120 EXP`, `2 h 07`), que es lo que hace que no haga falta etiqueta |
| `LOGROS` con chevron, fila de cuatro | Fila de cuatro insignias. **El chevron no está** porque todavía no existe la pantalla de logros: un chevron que no lleva a ningún lado es peor que no tenerlo |

### Lo que hubo que corregir y por qué

- **Las fichas de estadística con borde de color estaban de más.** Se habían
  construido así leyendo §4, pero §4 describe las fichas de *fin de actividad*;
  el resumen del perfil es lo más liviano de la pantalla. Ahora son renglones.
- **La barra de progreso es PLANA, no un degradado.** El degradado era nuestro.
  Además miente un poco: sugiere que el avance cambia de naturaleza a mitad de
  camino. Y el valor va **gris con la barra vacía, blanco con relleno**.
- **El botón va en MAYÚSCULAS** (`.btn-duo`), con reborde inferior. Es un
  modificador, no un botón nuevo: se le suma a `.btn-accent`, `.btn-primary` o
  `.btn-outline`. **No entra al mapa**: ahí una mayúscula se lee como un grito.
- **Lo ELEGIDO se marca en celeste, no en violeta.** El violeta significa
  recompensa en todo el sistema; elegir un avatar no es ganarlo. La referencia
  marca la opción activa del editor de avatar con el celeste de la marca.

### Los logros bloqueados — decisión del usuario, 10/09/2026

**Silueta gris con el objetivo encima, sin recuadro, sin borde y sin color.**
El número pisa el dibujo, no va debajo: apagada, es el dato que importa, porque
dice cuánto hay que hacer para prenderla. Antes era la insignia a color con
opacidad baja, y así un logro bloqueado y uno recién empezado se parecían
demasiado.

### La banda del avatar, con el lenguaje del carnet — 10/09/2026

Pedido del usuario: *"revisá los carnets que te pasé y armemos algo así en la parte
donde va el avatar."*

**Esto es el lenguaje visual del carnet, NO la pantalla del carnet.** Siguen siendo
dos pantallas distintas (§7): lo que se toma de la referencia es **cómo se ve un
documento**, no qué datos lleva. La estructura sigue siendo la de Duolingo —banda de
color arriba con la identidad adentro—, que es la regla de la casa: la estructura se
copia, el tema se cambia.

Cinco recursos, todos leídos de la segunda referencia de licencia (frente y dorso):

| Recurso | Cómo quedó |
|---|---|
| **Trama diagonal de seguridad** | Dos `repeating-linear-gradient` en ángulos distintos sobre el color plano. **Sin imagen**: son dos declaraciones de CSS contra un archivo que habría que versionar, meter en el APK y servir |
| **Foto enmarcada** con fondo propio | `.carnet-photo`, 84 px, borde claro de 2 px y fondo violeta. En la referencia la foto siempre tiene un color distinto al de la credencial |
| **Chapita al pie de la foto** | En la referencia dice "HOLDER'S PHOTO"; acá dice la nacionalidad, que es el dato que una credencial pone al lado de la cara |
| **Campos en pastillas** `ETIQUETA: valor` | `.carnet-field`. La etiqueta va más apagada que el valor: en la referencia son del mismo color, pero ahí el fondo es claro |
| **Banda inferior segmentada** y **línea tipo MRZ** | `.carnet-strip` con tres segmentos, y `.carnet-mrz` en monoespaciada |

**La línea MRZ es DECORATIVA y hay que decirlo.** No codifica nada, nadie la lee y
no sigue ninguna norma. Está porque en la referencia es el recurso que más hace que
algo se sienta un documento — lo único del dorso que no es un campo ni un código.
Se arma con datos reales igual (nacionalidad, apellido, nombre) y no con relleno
inventado: si el dibujo dice "documento", los caracteres tienen que ser los del
titular. **El alias no va**: ya es un campo, y cuando coincide con el nombre la
línea repite la misma palabra y se nota que es de adorno.

**Un campo vacío se muestra, no se esconde.** "CAMIÓN: Ninguno" es información
—*esto todavía no lo cargaste*— y además mantiene la altura estable, así que la foto
no se mueve al completar el perfil.

**Costo:** se perdió el busto que sangraba por el borde de la banda, que era lo más
Duolingo de la pantalla. Es la única pieza donde el tema le ganó a la estructura, y
fue una decisión explícita del usuario.

### La barra de nivel cromada — 10/09/2026

`.bar-chrome`, y **es la única barra cromada de la app**. Las metas siguen planas:
si todas brillaran, el nivel dejaría de ser el momento especial, que es justamente
lo que el brillo vino a marcar.

- **26 px de alto**, contra los 20 de las demás. No es capricho: a 20 px el
  degradado vertical se aplasta y el metal se ve plano
- El riel se ve **hundido** (sombra interna arriba, filo claro abajo); el relleno
  lleva **filo claro por dentro** —el canto pulido— y **resplandor por fuera**, que
  es lo que hace que se vea encendida y no pintada
- **El destello** recorre sólo lo lleno: vive adentro de `.bar-fill`, porque una
  barra vacía no tiene nada que brillar. Se anima `transform` y nada más, que es lo
  único que el navegador mueve sin repintar
- La **pausa larga** entre pasadas es a propósito: un destello continuo deja de ser
  un destello y pasa a ser un parpadeo
- `prefers-reduced-motion` apaga el destello. **La barra se sigue viendo cromada**:
  el metal está en el degradado, no en la animación
- El valor va **blanco en los dos modos**: el relleno es saturado siempre, así que
  la regla general de tinta oscura en claro no aplica acá

### El acento complementario

Naranja `--accent` (~24°), el complementario del celeste de la marca (~197°).
Dos reglas para que no se desparrame, escritas también en `app.css`:

1. **Una sola acción con acento por región** de la pantalla.
2. **Nunca en el botón de un formulario.** Guardar, Crear y Confirmar siguen
   siendo celestes en toda la app: si el acento entra a un formulario, entra a
   todos, y ahí se acabó.

En los mensajes se pinta **sólo la cifra** —*"Te faltan **2.500 km** para
Repartidor"*— y no la frase entera: pintada entera se vuelve un cartel y compite
con el botón, que es la única acción.

### La rampa fría

Cuatro escalones de un mismo recorrido: `--cool-1` a `--cool-4`, de 197° a 265°.
Los extremos **no son colores nuevos**: son `--brand` y `--reward`. Sirven para
distinguir piezas de la misma familia y **no codifican nada** — los que codifican
son `--ok`, `--warn` y `--danger`. Se asignan **en orden de lectura** para que una
grilla se lea como un degradado y no como colores sueltos.

### Lo que le falta a esta pantalla

- La **recompensa dibujada a la derecha de cada barra de meta** (§4). No hay arte.
- La **pantalla de Logros** completa, con Personal Records y la grilla de 3 (§13).
  Cuando exista, la fila del perfil recupera su chevron.
- La **mascota**: la tarjeta de "completá tu perfil" tiene el lugar reservado a la
  derecha, como en la referencia.

---

## 15. La trivia

**La mecánica se toma de Preguntados; el lenguaje visual, de Duolingo.** Es una
mezcla deliberada, pedida por el usuario el 09/09/2026.

De la captura de Preguntados:

- Barra superior con **categoría al centro** y **temporizador a la derecha**
- **Tarjeta de la pregunta**, blanca, arriba
- **Cuatro opciones apiladas**, de ancho completo, todas del mismo alto
- Al responder: **la opción correcta se pinta de verde**
- Y encima de la tarjeta **se estampa la palabra del resultado, enorme**, con
  contorno — el "CORRECTO" grande es toda la celebración

Lo que hay que reproducir es el **ritmo**: pregunta, toque, respuesta inmediata,
siguiente. Sensación de juego rápido y arcade, sin pantallas intermedias.

Encaja perfecto con la regla de color ya decidida: **verde para correcto, rojo para
incorrecto**, y en ningún otro lado.

**No se copia de Preguntados** su identidad visual, sus personajes, su rueda de
categorías ni su contenido. Sólo el patrón funcional del múltiple choice con
respuesta inmediata.

### El banco de preguntas

Temática: **mundo camionero y conocimiento general argentino**. Distancias entre
ciudades, rutas y geografía, modelos y marcas de camiones, mecánica y
mantenimiento, señalización y tránsito, identificar provincias por su silueta,
cultura general, fútbol.

**Nivel entretenido y accesible**, nada rebuscado.

Requisito de arquitectura: el banco tiene que **poder ampliarse y categorizarse
después sin tocar el sistema de trivia**. O sea, las preguntas son datos, no
código.

---

## 16. El camino elegido — prototipo aprobado como dirección, 14/09/2026

**Es un prototipo, no código.** Textual del usuario: *"Lo del diseño es prototipo
y todavía no se va a trabajar en el código."* Lo que sí quedó **aprobado y en
código** es la mascota aplicada en la app (§12, "Los PNG").

**Dónde está:** el lienzo https://claude.ai/code/artifact/c7849797-3e2a-4d9d-83bf-2ac08fdfd44f
y sus fuentes en `docs/diseno/prototipo/` (21 tableros, `final.mjs` los
regenera). Cuando se implemente, **el vocabulario va primero a `app.css`** y las
pantallas se hacen una por una contra esos tableros, sin inventar nada en el
medio.

### Cómo se llegó — seis vueltas en dos días, y qué enseñó cada una

| Vuelta | Qué se propuso | Qué dijo el usuario |
|---|---|---|
| 1 | Dónde va el mono: tres tamaños, globo, seis pantallas | Pidió la estética del perfil y el zócalo en todas |
| 2 | La banda celeste con trama en todas las cabeceras, cromo en todas las tiras | *"Fuiste muy literal (…) la banda todavía no fue aprobada (…) no era usar la misma barra en todas"*. Pidió más naranja para los globos y releer la regla del complementario |
| 3 | Cuatro materiales, tres cabeceras, tres globos, la fila de Configuración | Aprobó vidrio, neón, naranja como voz, íconos, Configuración; cromo en más tonos; Entrar mal ejecutada; S.O.S. sin cabecera grande |
| 4 | Cromo en tres tonos, globo pleno + vidrio con chip, Entrar rehecha | Pidió más gamificación sin exagerar, oro y plata más encendidos, Camiones con onda |
| 5 | La chapa de nivel, oro y plata fuertes, Camiones hero | Pidió **dos pantallas con esfuerzo extra**: Bienvenida y Subiste de nivel |
| 6 | Esas dos, desde las capturas de Duolingo | ***"Es la orientación que estaba buscando"*** → todo lo demás se derivó de ellas |

**Las dos lecciones:**

1. **La banda del perfil no estaba aprobada y yo la repliqué como si lo
   estuviera.** Un recurso que el usuario dejó *"por ahora"* no es un recurso del
   sistema. Antes de extender algo a toda la app, verificar que esté aprobado.
2. **Dos pantallas con esfuerzo extra valieron más que seis rondas de dieciséis.**
   Cuando el usuario no encuentra la dirección, reducir el alcance y subir la
   calidad. Lo pidió él (*"solo esas dos"*), y funcionó al primer intento.

### Las decisiones, en orden de peso

- **El naranja es la voz del mono.** Aprobado. Es el complementario del celeste
  (§14, "El acento complementario") y por eso se usa poco: **una sola pieza
  naranja por región**, nunca en el botón de un formulario. El globo del mono es
  esa pieza; donde él habla, el botón de al lado es celeste. El título de un
  festejo también es naranja — es la otra excepción, y ya existía (§5).
- **El globo del mono**, dos formas que se alternan: **vidrio** naranja con la
  chip del momento (violeta si es racha, celeste si es sección, gris si es aviso)
  donde hay luz detrás o más texto; **pleno**, con el reborde inferior de los
  botones, para una sola frase. Cola al costado junto al mono o abajo cuando el
  mono está debajo. El mono va **suelto con sombra en el piso**; el marco de
  carnet quedó descartado con la banda.
- **Materiales**, cada uno con su lugar:
  - **Vidrio**: paneles y globos translúcidos sobre los heros con luz.
  - **Neón**: lo activo se enciende con un borde de luz — el camión en uso, el
    idioma elegido, el campo con foco. Uno por pantalla.
  - **Cromo en tres tonos**, uno por pantalla: **frío** (celeste → violeta) para
    el progreso, **oro** (naranja → dorado) para el nivel, **plata** para los
    totales. Texto en tinta oscura sobre oro y plata, blanco con sombra doble
    sobre frío. **El oro vuelve a la paleta sólo acá**: §10 lo había descartado
    por cálido, y el usuario lo recuperó para el nivel, *"medio naranja/dorado"*.
  - **Satinado**: de vez en cuando — la fila de la cuenta, un catálogo, un dato
    secundario. Lo demás plano, para que los otros tres se noten.
- **La chapa de nivel**: pastilla de oro con el número en un disco oscuro y el
  nombre en mayúsculas — *2 · REPARTIDOR*. Es el elemento gamificado del usuario
  y va con él: grande en Subiste de nivel, chica junto al nombre en Perfil y en
  Configuración. **Subir de nivel es recibir la chapa**: es lo que se desbloquea,
  no hay que inventar recompensas que el motor no da.
- **Cabeceras, tres y ninguna repetida**: compacta con un dato en placa
  (Historial, Camiones, Configuración), hero con luz de color y el mono parado
  (Juegos, Metas), hero con el mono hablando (Bienvenida, Entrar). **La banda
  celeste con trama del perfil NO fue aprobada**; el prototipo la reemplaza por
  luz celeste, y §14 queda como registro de lo que hay en código.
- **Fichas con su color y su luz** (borde de 2 px + resplandor del mismo tono):
  es la pieza de Fin de viaje que el usuario señaló como referencia de color.
- **La fila de Configuración es la caja de toda la app**: ícono ilustrado, título,
  subtítulo gris, chip o botón a la derecha, chevron. Fue lo que más le gustó.
- **Íconos ilustrados** de dos tonos como los del zócalo, aprobados: 27, en
  `docs/diseno/prototipo/iconos.mjs`. La viborita en azul: el verde es semántico.
- **S.O.S.**: cabecera de 48 px, plana, roja, con *S.O.S.* centrado; el 911 como
  botón rojo con reborde; contactos como filas. Sin mono.
- **El mapa en movimiento no lleva nada de esto**, y el mono aparece en la hoja
  del mapa **sólo antes de arrancar**. Es la única pantalla sobria.
- **Festejos** (Fin de viaje, Subiste de nivel, Racha): luz cálida abajo, confeti
  con papelitos de oro, título naranja, la chapa, acción naranja y compartir.
  **Sólo Subiste de nivel lleva los rayos** que giran detrás del mono.
- **Perfil** en el prototipo: la estructura de la captura punto por punto, sin la
  banda; el avatar es un placeholder hasta el editor de la Fase 6.
- **Carnet**: sigue congelado sin aprobar (§7bis); entra con este vocabulario.
- **Condiciones** no se bocetó: texto y un botón.

### Principios que el usuario pidió explícitamente

*"Usá los mejores conceptos de marketing digital y diseño gráfico de
aplicaciones."* Los que quedaron aplicados y escritos en la portada del lienzo:
**un foco por pantalla** y una sola acción principal; **celeste si es
formulario, naranja si es festejo**; **un cromo por pantalla** — si todo brilla,
nada brilla; **el mono habla, no decora** — una pose por momento, siempre la
misma; **el vacío vende la próxima acción** — el mono pregunta, el botón
responde; **los números cuentan la historia** — grandes, tabulares, con unidad.

## 17. El GPS, medido sobre Waze — 16/09/2026, construido el 17–18/09

**Es la excepción de §2 hecha sistema.** El usuario aprobó el prototipo del
mapa (`docs/diseno/prototipo-gps/`, generado por `gps.mjs`; lienzo
https://claude.ai/artifact/42KH4a8piCQSCb5xez2K4H) con *"ahora sí, aprobado,
vamos a implementarlo"*, después de descartar cuatro versiones anteriores por
*"pobres"* y *"baratas"*. La diferencia entre las descartadas y la aprobada fue
una sola: **medir en píxeles sus capturas de Waze** (`docs/referencias/waze/`,
720 × 1600, ÷2 = dp) y copiar las medidas textuales, sin redondear a "razonable".
Es la misma lección de §7bis: primero se copia exacto, después se eleva.

**Qué se copia y qué no.** Patrones, jerarquía, tamaños y colores de Waze; el
lenguaje visual del tráfico. **No** la marca, los Wazers, las ilustraciones ni
la tipografía de marca: las calcomanías son dibujos propios (`piezas.js`). De
Google Maps **sólo** la hoja de capas (cuadros para activar y desactivar
lugares y datos). Todo lo demás de la app sigue en §1–§16.

**Los tokens** (en `app.css`, `--gps-*` y `--map-*`, noche medida y día
derivado — falta la captura de día): banda `#000`; hoja y tarjetas `#202125`;
píldoras y círculos `#3c4043`; ruta `#2ddcff` de 8 dp con canto blanco al
35 %; acción `#32ccfe` con texto `#0a1f2a`; celeste de texto `#32c8fb`;
chevrón `#00b5d0`; globo `#1d7699`; aportar `#4e411e` con calcomanía
`#f9c531` (**el amarillo significa "fuera de la Red"** y es el único color de
advertencia sobre una ruta; **el rojo nunca va sobre una ruta**, AD-47).
Mapa: tierra `#272d39`, manzanas `#252e3d`/`#233041`, predios `#2e3d50`, agua
`#22467a`, parque `#216a4f`, calle `#40546c` (10 dp de cerca, 2,5 de lejos),
avenida `#4d6179`, **la Red `#6d89a8` es la vía más clara y ancha, con el
nombre en mayúsculas espaciadas**, autopista `#7494b4` con carriles y centro
punteado, ferrocarril a rayas; rótulos de calle 12 sp, barrios 17 sp gris.

**Las medidas** (spec `docs/superpowers/specs/2026-09-16-gps-waze-design.md`
§2, y las correcciones medidas al construir): banda 95 + barra de estado
(57 compacta), flecha 40 × 46 de trazo 5,5, distancia 27 sp / 400, calle
24 sp / 500; hoja del viaje 137 con la hora 25 sp / 700 y "39 min • 32 km" en
20; **píldora de la calle actual 18 sp / 700** (la spec decía 20; medido, 18),
negra, a 155 del borde; aportar 63; círculos 52 (hoja: 45); globos 30 / 48 en
18 sp / 700 con radio 7; chevrón 40 × 39 sobre disco de 82 al 6 %; "Volver a
centrar" **18 sp** (a 20 no entra: 131 dp de texto, píldora a 212) con
píldora 132 × 37; conmutador 155 × 40; tarjetas de ruta radio 16, tiempo
27 / 700, píldora 44; reposo 150 (píldora 50, atajos 45); búsqueda píldora
52, chips 82 × 65, filas 65 con 18 / 700. Roboto (`system-ui`) sólo dentro de
`.map-screen`.

**Las reglas del prototipo**, que gobiernan lo que falta construir: una cifra
manda por pantalla; el celeste es acción y ruta, el amarillo salir de la Red;
la Red se lee sola; lo de la comunidad no se ve igual que lo verificado; nada
del registro expresivo en movimiento —**el mono habla una vez, en los
detalles de la ruta, antes de arrancar**—; donde falta el dato, se dice.

**Dónde está cada cosa**: un módulo por superficie en `wwwroot/js/mapa/`
(`estilo-mapa`, `piezas`, `viaje`, `rutas`, `reposo`, `buscar`, `lugares`,
`capas`, `aportar`) con `navigate.js` de anfitrión (AD-48). El estado de
avance, tarea por tarea, está en `docs/superpowers/plans/2026-09-16-gps-waze.md`
y en `estado-camiones-app` §8, punto 0.

### Construido el 17–18/09/2026: lo que cambió al pasar del prototipo al código

Las etapas 6 a 9 se construyeron y verificaron a 360 × 800 contra los
tableros. Medidas que rigen (las de la spec, no las del CSS del prototipo,
que en la lista de rutas usaba 32 donde la captura dice 27):

- **Lista de rutas**: cabecera negra de 55 con "Mi ubicación → destino" en 18
  (el origen del GPS se llama "Mi ubicación" aunque ya tenga dirección; el
  destino, lo que va antes de la primera coma, abreviado); tira de mapa de
  117 con la píldora del camión de 42 (`El Rayo · 40 t`, 18 / 500); filas de
  145 con el tiempo en 27 / 700 —celeste, borde celeste de 4 y fondo
  `--gps-elegida` en la elegida: negro de noche, `#eef1f4` de día—, km 18
  gris, "Por…" 18, estado 16 gris, chips de 25 con punto y 14; píldoras de 48.
- **Detalles**: cifras 27 / 700 con hora y Red en 16 gris; la tarjeta del mono
  (64 px, `mascota()`; momentos `alerta`, `radar` y el nuevo `ruta` = "lee el
  mapa" para cuando no hay nada que avisar) con lo único que importa —salir
  de la Red antes que nada, después el gálibo más bajo, los radares, los
  pasos a nivel—; filas de 60 mínimo con calcomanía de 30, título 18 / 500 y
  sub 15 con la calle y el km de cada cosa; las fuentes tal como las declara
  cada hallazgo del servidor.
- **Pines de lugar**: 32 × 38 con la cola, disco `#2b3035`, anillo de 3
  (blanco confirmado / celeste comunidad con contador de 17 / gris y al 72 %
  sin confirmar) **más un halo oscuro de 1 px** para que el blanco se lea de
  día; calcomanía de 18 adentro; desde el zoom 13. Dibujados a pedido
  (`styleimagemissing`) como SVG al doble.
- **Ficha**: caja de 48 con calcomanía de 32, nombre 22 / 700 en dos líneas
  como mucho, sub 14 gris; bloques de radio 14: verde `#0f2a1f` un sí
  verificado, **rojo `#2e1416` cuando la fuente dice que NO recibe tu camión**,
  gris `#2b3035` lo probable, celeste `#0f2f3f` la comunidad; votos en
  píldoras de 40 / 17; Llamar sólo con teléfono.
- **Capas**: cuadros de **52** (no 73: la spec manda) con radio 12 y borde
  celeste de 3 al estar prendidos, rótulo 12,5; interruptor de 46 × 26.
- **Aportar**: título 21 / 700, círculos de 75 con calcomanía de 40 y rótulo
  14; marcar con el pin `lugarMas` de 44 con la punta en el centro exacto,
  chip de categoría en línea de 44, campo con etiqueta 12 en mayúsculas y
  valor 20.
- **Reanudar**: tarjeta `#2b3035` radio 16 a 12 de la hoja de reposo, pin de
  30, pregunta 22 / 700, píldoras de 42 / 15.
- **Día**: sigue derivado (sin captura); verificado que funciona en reposo,
  rutas y viaje. El usuario lo aprobó así el 18/09/2026: "el tema claro está bien así, no hace falta la captura de Waze".

Tres reglas de construcción que salieron de verificar: **las hojas más altas
que la de reposo van clavadas abajo** (`position: absolute`, con scroll), no
en el flujo de la capa del mapa; **los nombres de clase `gps-*` se buscan
antes de crearlos** (`gps-aportar` ya era el botón amarillo); y las
capturas del panel del navegador se leen con el DOM al lado (rects), porque
salen recortadas o en mosaico.
