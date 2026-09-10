---
name: diseno-camiones-app
description: El lenguaje visual de la app de camiones — Duolingo + camioneros + arcade, extraído de capturas reales. Componentes, jerarquías, estructuras de pantalla y la frontera con el GPS, que queda sobrio y afuera. Invocar antes de diseñar o maquetar cualquier pantalla que no sea el mapa.
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

### Zócalo inferior

Íconos ilustrados a color, sin texto. **El activo lleva un recuadro redondeado**
alrededor. Duolingo usa seis; acá son cuatro: GPS · JUEGOS · S.O.S. · MÁS.

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

**Cómo se traduce:** el frente lleva el avatar equipado, el nombre, el nivel, la
EXP y el camión activo. El dorso lleva las estadísticas, los kilómetros, los
viajes, los reportes, las metas, los logros y los camiones desbloqueados.

La gracia es que **se sienta un documento**: bandas, campos etiquetados,
tipografía de datos monoespaciada. Pero con el color y el peso de Duolingo, no con
la sobriedad de un carnet real.

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

**Consecuencia:** el oro y el cromo que aparecieron en la exploración del 02/09 del
canvas **quedan descartados**. Eran cálidos y esta decisión los deja afuera.

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

## 12. Mascota — va a haber, y es propia

**En desarrollo con un diseñador gráfico**, se incorpora más adelante.

Dos consecuencias para diseñar mientras tanto:

1. **Dejarle el lugar.** En las referencias, la mascota sostiene media interfaz:
   aparece en la tarjeta de completar perfil, en la cabecera de desafíos, en la
   racha y en el fin de actividad. Esas pantallas hay que componerlas **previendo
   dónde va**, no agregándola después a los apretones.
2. **Que nada dependa de ella.** Si la mascota se demora, las pantallas tienen que
   funcionar igual. Nada de layouts que se rompan sin el dibujo.

**No usar el búho de Duolingo ni un derivado como sustituto provisorio**, ni
siquiera para maquetar.

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

## 14. La trivia

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
