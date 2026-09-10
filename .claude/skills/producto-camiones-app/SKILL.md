---
name: producto-camiones-app
description: Qué se va a construir en el GPS para camiones de CABA y por qué — los requisitos de los tres brainstorms del usuario, unificados, asignados a fase y con lo que falta verificar antes de construirlo. Incluye la gamificación estilo Duolingo del v3 y sus conflictos con lo ya decidido. Invocar al planificar qué sigue, al estimar alcance, o cuando aparezca un requisito que no se sabe de dónde salió.
---

# Producto — Navegador de Tránsito Pesado (CABA)

> **El lenguaje visual vive aparte**, en la skill `diseno-camiones-app`: Duolingo +
> camioneros + arcade, extraído de catorce capturas reales el 09/09/2026. Invocarla
> antes de diseñar o maquetar cualquier pantalla que no sea el mapa.

Este archivo es **el qué y el porqué**. La skill hermana `estado-camiones-app` es
**el dónde estamos**: qué está hecho, qué está verificado y qué trampas tiene el
entorno. Si buscás el estado del código, andá allá.

Acá está el alcance completo, unificado de las dos fuentes que escribió el
usuario, y **traducido a fases**. Nada de esto es invención: cada ítem sale de uno
de los dos documentos, y lo que agrego como criterio propio está marcado como tal.

---

## 1. Las fuentes

| Documento | Fecha | Qué es |
|---|---|---|
| `PUNTOS A TRABAJAR EN LA APLICACIÓN GPS CAMIONES.docx` | 22/08/2026 | Los 33 requisitos originales. Fundó las fases 0 a 5 |
| `ideas camionero app v2.docx` — *"IDEAS PARA TBF 2.0"* | 31/08/2026 | Segunda ronda. **Agranda el proyecto**: abre un pilar nuevo y reabre la Fase 4 |
| **`references/brainstorm-v3.md`** — *"BRAINSTORM 3"* | 08/09/2026 | Tercera ronda. **Rediseña la app entera alrededor de la gamificación** y define la arquitectura de pantallas |
| **`references/brainstorm-v3.md`** — *"EXTENSIÓN"*, al final del mismo archivo | 09/09/2026 | Amplía el v3: los reportes entran al ciclo de progresión, y aparecen **recompensas coleccionables, inventario y equipamiento** |

Los dos primeros viven en el escritorio del usuario. **El v3 está guardado textual
en esta misma skill**, en `references/brainstorm-v3.md`: ante cualquier duda de
qué se pidió, se lee ahí y no en este resumen.

**Se suman, no se reemplazan**: cada uno dice explícitamente que va sobre lo
anterior.

> Ojo al leerlos: están escritos en mayúsculas y en lenguaje de idea suelta. No
> son especificaciones. Varias líneas necesitan una conversación antes de
> convertirse en tarea — están marcadas abajo.

---

## 2. Lo que cambia el v2

Tres cosas que no estaban y que reordenan el plan.

### a) Aparece un pilar nuevo: los reportes de la comunidad

El v2 introduce **reportar y confirmar eventos en la ruta** —siniestro vial,
control de velocidad máxima, retén policial— con confirmación de otros usuarios.

Eso no es una función más: es un **sistema** que cruza tres fases. Necesita modelo
de datos y endpoints, consultas geográficas, vencimiento de los reportes,
confirmación cruzada, un gesto en el mapa durante el viaje, y engancha con los
bonos. Conviene tratarlo como su propia fase.

**Y resuelve una limitación documentada.** `estado-camiones-app` decía: *"las zonas
peligrosas no tienen dato oficial publicable; la única vía honesta es construirlas
con reportes de la comunidad, siempre etiquetadas como tales"*. El v2 propone
exactamente ese mecanismo, **y además aporta una fuente para investigar**:
`https://mapa.seguridadciudad.gob.ar/`.

### b) La Fase 4 se reabre

Estaba cerrada con las capas de camión y el mapa base propio. El v2 le suma
radares, lugares de interés valorados por usuarios, alternativas de ruta y la
legibilidad de las calles. El encabezado del documento dice literalmente
*"GPS Y FASE 4"*: es el propio usuario asignándolos ahí.

### c) La Fase 5 pasa de vaga a concreta

Antes era "avatares, cofres, reportes, chat". Ahora hay **cinco juegos definidos**
con estética arcade y un sistema de ranking. Eso es mucho más trabajo del que la
fase parecía tener, y conviene decirlo antes de comprometerse.

---

## 2 bis. Lo que cambia el v3 — y con qué choca

### Decisiones del usuario, 08/09/2026

Los conflictos que abrió el v3 se resolvieron el mismo día. **Estas cinco ya no se
discuten**, y dos de ellas achican el alcance de forma importante:

| # | Decisión | Consecuencia |
|---|---|---|
| 1 | **El zócalo se ve en todas las pantallas menos en el GPS.** Tiene que haber forma de volver o cambiar de pantalla sin que el zócalo estorbe. *"El GPS es lo más serio y sobrio de la aplicación"* | Confirma la separación de dos intensidades: lo gamificado no entra al mapa |
| 2 | **Los niveles conservan nombres del oficio**, y la escala tiene que reflejar los km reales de un camionero — *"hacen 1.000 km fácil"* | La escala del v3 (pasos de 1.000 km) es **demasiado chica**. Escala elegida abajo |
| 3 | **La batería funciona sólo en trivias y juegos** | Queda cerrado: nunca toca GPS, navegación ni S.O.S. |
| 4 | **La pantalla de idioma se presenta, pero la única opción por ahora es Español** | **El i18n deja de ser bloqueante.** Se construye la pantalla y la estructura; los otros tres idiomas quedan para después |
| 5 | **El invitado sólo usa el GPS y NO se registra nada en el servidor.** Sólo se le pregunta el camión para encasillarlo en la mejor ruta | **Desaparece la pregunta de migrar kilómetros.** No hay sesión anónima, ni viajes, ni datos del invitado: es local y efímero |

Las decisiones 4 y 5 son las que más trabajo sacan de encima: entre las dos
eliminan el i18n completo y todo el modelo de datos del invitado.

### La escala de niveles, elegida el 08/09/2026

**Siete niveles, con los nombres del oficio que ya estaban en `store.js`.** Cada
nivel tiene **10 metas**, como pide el v3, pero **la meta crece con el nivel**:

| Nivel | Nombre | km por meta | Acumulado al terminarlo |
|---|---|---|---|
| 1 | Novato | 250 | 2.500 |
| 2 | Repartidor | 600 | 8.500 |
| 3 | Fletero | 1.200 | 20.500 |
| 4 | Transportista | 2.500 | 45.500 |
| 5 | Rutero | 4.000 | 85.500 |
| 6 | Veterano | 6.500 | 150.500 |
| 7 | Leyenda del asfalto | 10.000 | 250.500 |

**Por qué la meta crece:** con metas parejas de 1.000 km —lo que decía el v3
literal— un camionero de larga distancia completa una meta cada dos días y llega
al techo en meses. Creciendo, la **primera meta se completa en uno o dos días de
trabajo** (engancha enseguida) y la última cuesta años (llegar significa algo).

**Los umbrales viejos quedan obsoletos.** `LEVELS` en `store.js` tenía 0, 500,
2.000, 6.000, 15.000, 40.000 y 100.000: se reemplazan por la columna *Acumulado*.
Los **nombres no cambian**.

**Supuestos con los que se calculó, sin medir — corregir si son falsos:** reparto
urbano ~130 km/día, mixto ~250, larga distancia ~500, sobre 22 días al mes. Con
eso, llegar al último nivel toma ~7,5 años en urbano, ~3,8 en mixto y ~1,9 en
larga distancia. Si se quiere más lento, se multiplica toda la columna por 1,5 sin
cambiar la forma.

El v3 no es otra lista de funciones: **rediseña la app alrededor de la
gamificación** y define por primera vez la arquitectura de pantallas. Siete cosas
cambian el plan, y varias chocan con decisiones ya tomadas.

### a) La app deja de ser "un GPS con perfil"

Aparece un **zócalo inferior permanente** de cuatro accesos: GPS · JUEGOS · S.O.S.
· MÁS. Hoy la app es mapa-primero con un cajón lateral. Esto es una reestructura
de la cáscara, no una pantalla más.

**Conflicto:** un zócalo permanente sobre el mapa **come alto en la pantalla que
se mira manejando**, y ya costó trabajo que la hoja y los controles del mapa
entraran (AD-34, AD-44). Criterio propio: **el zócalo se esconde durante el
viaje**. Manejando no hay nada más importante que el mapa. 💬 Confirmar.

### b) El nivel queda definido — y confirma lo que ya decía el código

El v3 §1 dice que el nivel depende **exclusivamente del kilometraje**. Eso ratifica
el comentario que ya está en `store.js` —*"Los niveles se ganan solo con
kilometros, asi que no se pueden comprar"*— y **cierra una pregunta que había
quedado abierta** el 04/09/2026.

**Pero la escala cambia.** Hoy `LEVELS` son 7 umbrales irregulares (0, 500, 2.000,
6.000, 15.000, 40.000, 100.000) con nombres del oficio. El v3 propone niveles de
**10 pasos de 1.000 km**, o sea 10.000 km por nivel. Son dos modelos distintos y
hay que elegir uno: los nombres del oficio son buenos y se perderían con la escala
pareja. 💬

### c) Aparecen cuatro recursos donde antes había uno

| Recurso | Qué mide | De dónde sale |
|---|---|---|
| **Kilometraje** | El **nivel**. No se compra ni se juega | Viajes acreditados por el servidor |
| **XP** | Actividad general | Viajes, trivias, juegos, metas, logros |
| **Moneda / recompensas** | Saldo gastable | Logros, metas, cofres |
| **Batería** | Recurso limitado para jugar | Se consume jugando, se recupera |

Esto **reemplaza el vocabulario "puntos y bonos"** que se conversó el 04/09/2026:
lo que ahí se llamó *puntos* es la **XP**, y lo que se llamó *bonos* es la
**moneda**. Usar los nombres del v3.

### La regla dura de la batería, y hay que escribirla antes de construirla

**La batería NUNCA toca el GPS, la navegación ni el S.O.S.** El v3 la limita a
trivias, juegos y desafíos. Que un camionero no pueda navegar —o peor, no pueda
pedir auxilio— porque gastó energía en un juego sería un defecto grave, y una
mecánica de energía es exactamente el tipo de cosa que se filtra si no está
prohibida por escrito. Es la misma lógica de las dos intensidades: lo gamificado
no entra a la pantalla que se mira manejando.

### d) El i18n deja de ser transversal y pasa a ser bloqueante

La pantalla de **idioma es la número 2** del arranque, antes de las condiciones y
del acceso. Los cuatro idiomas —español, guaraní, inglés, portugués— dejan de ser
deuda a futuro: sin ellos no existe el flujo de entrada que pide el v3.

### e) El modo invitado choca con el modelo de cuentas

Hoy hay cuenta con verificación por mail, los camiones pertenecen a una cuenta
(AD-19) y los viajes tienen dueño para que **los kilómetros no se puedan
falsificar**. Un invitado de 1 día necesita sesión anónima, elegir camión sin
cuenta y un vencimiento.

💬 **Qué pasa con los kilómetros y los viajes del invitado cuando se registra**
—¿se migran o se pierden?— no está definido, y hay que decidirlo **antes** de
construirlo: define si el invitado escribe en las mismas tablas o en otras.

### f) El avatar queda especificado, y lo de hoy es un placeholder

El v3 §8 pide avatar **combinable** (tonos de piel, barba, bigote, peinados,
lentes) y ampliable. Los ocho emoji que hay en `profile.js` **son un placeholder
que puso Claude, no el requisito cumplido** — confirmado por el usuario el
08/09/2026. **No contarlo como hecho.**

### g) Datos personales nuevos

El v3 §9 pide **edad y nacionalidad** del usuario y **patente** del camión. La
patente identifica un vehículo y a su titular: suma a la conversación de
residencia de datos que el usuario decidió resolver con el host pago.

### h) La extensión del 09/09 cierra el ciclo y agrega tres conceptos nuevos

Hasta acá las metas y los logros eran, en la práctica, estadísticas con nombre. La
extensión los convierte en el motor de una **colección**:

**META 10/10 → LOGRO → EXP → RECOMPENSA → INVENTARIO → EQUIPAR → PERFIL**

Tres conceptos que no existían en ninguna fuente anterior:

| Concepto | Qué es |
|---|---|
| **Recompensa** | Objeto cosmético que se desbloquea: skin, ropa, accesorio, peinado, barba, lentes, o un **camión coleccionable** |
| **Inventario** | Dónde quedan guardadas todas las recompensas obtenidas |
| **Equipamiento** | Cuál de ellas se exhibe en el perfil |

**Los reportes pasan a ser fuente de EXP, metas y logros.** Eso entrelaza la Fase 5
con la Fase 6: dejan de ser sólo una función comunitaria y pasan a ser una pata del
ciclo. El nivel sigue sin tocarse — lo determina el kilometraje y nada más.

**El vocabulario de los reportes quedó fijado el 09/09/2026: `radar`, `control`,
`siniestro`.** Gana el del v3 §12 sobre el de la extensión (*cámaras, controles,
accidentes*), que decía lo mismo con otras palabras. Son los códigos que van a la
base y a las metas — *"reportar 25 controles"*.

**Los cofres y las suscripciones quedan guardados como concepto, y nada más.**
Decisión del usuario, 09/09/2026, textual: *"todavía no trabajamos lo de los cofres
y las suscripciones, guardalo como concepto pero no gires en torno a esa idea,
queda para mucho más adelante."*

En consecuencia, **la moneda no se construye**: las recompensas se desbloquean
directo al completar metas y logros, sin comprarse. El libro de movimientos deja la
puerta abierta —sumar una denominación es un valor de enum— pero **no se le diseña
fuente ni destino**. No razonar sobre economía de compra hasta que el usuario la
reabra.

### Instrucción dura sobre lo visual

La extensión §7 dice explícitamente: **no implementar aproximaciones visuales antes
de contar con las referencias** que el usuario va a mandar. Eso **congela el trabajo
de pantalla** del perfil, el carnet, las skins, los camiones y los logros hasta que
lleguen las capturas.

No es una sugerencia, es una instrucción. Lo que sí se puede avanzar mientras tanto
es todo lo que no se ve: modelo, reglas del dominio, endpoints y tests.

### La investigación de Duolingo es obligatoria, y tiene un obstáculo medido

El v3 §14 exige no trabajar sólo con conocimiento general, y **pedir screenshots
antes de aproximar** cualquier cosa que no se pueda determinar con precisión.

Obstáculo medido el 02/09/2026: **Mobbin requiere plan pago** —las pantallas de
Duolingo salen desenfocadas con cuenta gratuita— y el navegador de la sesión
recibe 403. Las capturas de la App Store son públicas y sirven para el lenguaje
visual, pero **no muestran perfil, logros, energía ni fin de lección**. El camino
realista es **pedirle las capturas al usuario**.

Restricción propia que conviene sostener, y que el propio v3 pide: se reproducen
**mecánicas, jerarquías y estructura de experiencia**, nunca la identidad visual
distintiva de Duolingo.

---

## 3. El backlog por fase

Marcas: ✅ hecho · 🔨 en curso · ⬜ pendiente · 🔍 **necesita verificar la fuente
antes de construirse** · 💬 **necesita una conversación: la idea no alcanza**

### Fase 1 · Navegación — 🔨 abierta

Lo que falta para cerrarla, y lo que el v2 le agrega:

| | Ítem | Origen |
|---|---|---|
| 🔨 | **Probar manejando.** Nunca se hizo. Es la tesis del producto | — |
| ✅ | **El nombre de la calle por la que vas, legible durante el viaje.** La ruta pasó a dibujarse **debajo** de los rótulos, y la calle que se recorre se rotula en verde a 15–19 px contra los 11 px del mapa base. Va **1,5×** y no 3×: los tiles parten las avenidas en tramos de una cuadra y cuanto más grande el texto, en menos entra — en 33 px no se dibuja nada. Se rotula sobre el mapa base, no sobre el tramo de la ruta, porque los tramos entre maniobras miden 29–90 m. **Falta verlo manejando** (AD-37) | v2 · estética · 01/09/2026 |
| ✅ | **Vibrar ante cada eventualidad**: doblar, gálibo, paso a nivel y radar, **cada uno con su patrón** — si todos vibraran igual habría que mirar la pantalla, que es lo que la vibración evita. Los gálibos sólo si este camión no pasa. Accidentes quedan para la Fase 5. **Falta sentirlo manejando** (AD-39) | v2 · 01/09/2026 |
| ✅ | **Alternativas de ruta.** Hasta 3, **ordenadas por restricciones y no por tiempo**: bloqueos → accesos → duración (con 60 s de tolerancia) → cuánto va por la Red. Medido: la más rápida puede quedar última si no usa nada de la Red. En tramos cortos y directos no hay alternativas y el selector no aparece (AD-40) | v2 · 01/09/2026 |
| ✅ | **Reintento al conectar.** 3 intentos con espera creciente, y sólo se reintenta lo que puede resolverse solo — una dirección mal escrita falla igual las tres veces. Peor caso ~22 s, con el cartel diciendo en qué intento va. Apéndice de AD-33 | defecto medido · 01/09/2026 |
| ✅ | Perspectiva en primera persona al arrancar | v1 · AD-34 |
| ✅ | Notificación con la pantalla bloqueada y el GPS en uso | v1 · AD-24 |

### Fase 2 · Usabilidad — ✅ completa

Cerrada dentro de la mudanza del frontend: menú lateral, origen automático,
pantalla de fuentes, leyenda achicada, iconos, mobile-first, modo día y noche.

### Fase 3 · Seguridad — ⬜ pendiente

| | Ítem | Origen |
|---|---|---|
| ✅ | Botón de pánico de acceso rápido → llama al 911 | v1 |
| ✅ | **3 llamadas de emergencia** a contactos que elige el usuario — elegidos de la agenda de Android (sin pedir permiso sobre la libreta) o escritos a mano, guardados en el **servidor** para que sobrevivan a reinstalar la app. La fila entera llama y abre el discador, no llama sola. Verificado en el teléfono. Ver AD-42 y AD-43 | v1 · 02/09/2026 |
| ⬜ | **Compartir el viaje en tiempo real** por WhatsApp — lo último construible de esta fase. Necesita endpoint público de seguimiento, tokens que venzan y decisiones de privacidad: **es un trabajo grande disfrazado de botón** y conviene plantearlo así. El puente de la agenda ya sirve para elegir destinatario | v1 |
| ⬜ | **S.O.S. rápido dentro del reporte de siniestro**: al marcar un accidente grave, un aviso emergente para llegar al 911 en un toque | v2 |
| ✅ | **Zonas peligrosas de CABA** — resuelto con el **mapa colaborativo del AMBA**, no con el dato oficial: 19 zonas, 8,8 km², el 4,3% de la Ciudad. El Mapa del Delito del GCBA se probó y se descartó — contar hechos mide dónde hay gente, y como el dataset cubre exactamente CABA el mapa de calor dibujaba la silueta de la Ciudad. Botón propio, arranca apagado, y el toque no da números. Verificado en el APK. Ver AD-36 | v1 + v2 · 01/09/2026 |

### Fase 4 · Información para camiones — 🔨 **reabierta por el v2**

| | Ítem | Origen |
|---|---|---|
| ✅ | Red de Tránsito Pesado, gálibos y pasos a nivel | v1 · AD-25 |
| ✅ | Mapa base propio, minimalista, día y noche | v1 · AD-26 |
| ✅ | **Avenidas aptas para tránsito pesado con el nombre destacado**, aunque no sean parte de la ruta | v1 · capa `red-nombre` |
| ✅ | **Radares de control de velocidad** — resuelto con dato oficial: 129 cinemómetros del GCBA (CC-BY). Las otras 95 cámaras del dataset son de analítica de video y quedaron afuera | v2 · 01/09/2026 |
| ❌ 💬 | **Radares de control de peso.** Investigado sin resultado: **no existe fuente** — cero balanzas en CABA, ni dataset oficial ni OSM (L-9). Sólo queda como reporte comunitario | v2 · cerrado 31/08/2026 |
| ⬜ 💬 | **Lugares de interés valorados por usuarios**, que además confirmen si son aptos para tránsito pesado (y eso da puntos). Se cruza con los 78 POIs que ya existen, donde la aptitud está indeclarada en 75 (L-6) | v2 |
| ✅ | **Modo reparto**: hasta 10 paradas, ordenadas con distancias **reales** de ruta (no en línea recta: en CABA la ruta real llega a 1,67× la recta). Vecino más cercano + 2-opt en el dominio, 14 tests. 1,2 s para 9 paradas. Marcadores numerados en el mapa y en la lista con el mismo número. **Y se puede arrancar**: sus paradas viajan con el viaje, así que sobrevive a cerrar la app — hasta AD-45 calculaba pero no navegaba, o sea la mitad de la función. **Falta probarlo manejando** (AD-41, AD-45) | v1 · 02/09/2026 |

### Fase 5 · Reportes de la comunidad — ⬜ **nueva, sale del v2**

Fase propia porque es un sistema, no una función.

| | Ítem |
|---|---|
| ⬜ | Reportar durante el viaje **con un gesto**: mantener el dedo abre un menú con siniestro vial, control de velocidad y retén policial |
| ⬜ | **Confirmación cruzada**: otros usuarios validan el reporte |
| ⬜ | Los reportes confirmados aparecen en **"reportes del usuario"** |
| ⬜ | Mostrar en el mapa el tramo con accidente **en rojo** |
| ⬜ | **Reportar da EXP, y alimenta metas y logros** — ej.: *"reportar 10 accidentes"*, *"25 controles"*, *"50 cámaras"*, *"100 reportes"*, mantener actividad varios días. Es el enganche con la Fase 6, y la extensión del 09/09 lo vuelve central: un reporte es **a la vez** una herramienta para la comunidad y una pata del ciclo de progresión. **No toca el nivel** |
| 💬 | Cuánto dura un reporte, cuántas confirmaciones lo validan, qué pasa con los falsos. **Sin esto definido no se puede construir bien** |

### Fase 6 · Experiencia y gamificación — ⬜ pendiente, **rediseñada por el v3**

**El motor.** Nada de lo de abajo se construye sin esto, y todo se acredita en el
servidor: el cliente nunca dice cuánto ganó, sólo pregunta cuánto tiene.

| | Ítem | Origen |
|---|---|---|
| ⬜ | **Nivel por kilometraje**, única variable. Escala **decidida el 08/09/2026**: 7 niveles con los nombres del oficio, 10 metas por nivel, meta creciente. Techo en 250.500 km. Ver §2 bis | v3 §1 |
| ⬜ | **XP** por viaje, trivia, juego, meta y logro. Independiente del nivel | v3 §2 |
| ⬜ | **Metas**: objetivos progresivos (kilómetros, viajes, trivias, días de actividad, usar funciones) | v3 §3 |
| ⬜ | **Logros** con nombre, descripción, progreso, estado, recompensa y feedback. **Escalable sin tocar la arquitectura** | v3 §3 |
| ⬜ | **Recompensas, inventario y equipamiento.** Completar una meta desbloquea un objeto cosmético —skin, ropa, accesorio, peinado, barba, lentes, o un **camión coleccionable**— que entra al inventario y se puede equipar. **Ampliable sin tocar el sistema principal** | ext §2-3 |
| ⏸️ | **Moneda, cofres y suscripciones** — **guardados como concepto, no se trabajan.** Decisión del 09/09/2026. Las recompensas se desbloquean directo, sin compra | v1 · v2 (*bonos*) |
| ⬜ 💬 | **Batería**: se consume jugando, se recupera, bloquea al llegar a 0. **Nunca toca GPS, navegación ni S.O.S.** Preparada para monetización futura sin rehacerla | v3 §4 |

**Lo que se apoya en el motor:**

| | Ítem | Origen |
|---|---|---|
| ⬜ | **Perfil como carnet digital y vitrina.** *Frente*: skin equipado, nombre, nivel, EXP, camión activo. *Dorso*: estadísticas, kilómetros, viajes, **reportes**, metas, logros y **camiones desbloqueados**. El usuario tiene que poder exhibir lo que consiguió | v3 §10 · ext §4 |
| ⬜ | **Resumen**: el centro de progreso — nivel, XP, kilometraje, estadísticas, metas, logros, actividad | v3 §12 |
| ⬜ | **Avatar combinable y ampliable**: tonos de piel, barba, bigote, peinados, lentes. Lo que hay hoy en `profile.js` es un **placeholder**, no esto | v3 §8 · v1 |
| ⬜ | Ediciones especiales de avatares (festivos, eventos), por suscripción o moneda | v1 |
| ⬜ | Cofres cada tantos días de uso o por acumulación | v1 |
| ⬜ | **Premiar el tiempo de interacción** en cualquier sección, no sólo el GPS | v2 |
| ⬜ | Chat público, privado entre amigos, y grupos. Con palabras baneadas y baneo automático. Escalable a comunidades | v1 · v3 §12 |
| ⬜ | **La trivia — el primer juego, y el más definido.** Mecánica de Preguntados: pregunta, cuatro opciones apiladas, respuesta inmediata, la correcta en verde y la palabra del resultado estampada encima; temporizador y ritmo rápido. Lenguaje visual de Duolingo. **Contenido**: mundo camionero y conocimiento general argentino — distancias entre ciudades, rutas y geografía, marcas y modelos, mecánica, señalización, provincias por su silueta, fútbol. Accesible, nada rebuscado. **El banco de preguntas es dato, no código**: tiene que ampliarse y categorizarse sin tocar el sistema | v2 · v3 §5 · 09/09/2026 |
| ⬜ 💬 | **Los otros cuatro juegos**: viborita-camión que suma acoplados, esquivar autos, tipo Grand Prix, y tipo dinosaurio de Google saltando miguelitos, baches y lomas de burro | v2 · v3 §5 |

> **Los juegos son un proyecto aparte.** Cinco juegos con gráficos de arcade y
> ranking no entran en "una fase más". Conviene elegir uno, hacerlo bien y ver qué
> pasa, antes de comprometerse con los cinco. El v3 agrega que **no pueden ser una
> sección aislada**: tienen que dar XP, progreso, recompensas y consumir batería.

### Fase 7 · Cáscara, entrada e idiomas — ⬜ **nueva, sale del v3**

Separada de la Fase 6 porque **no es gamificación**: es la estructura de la
aplicación. Criterio propio, no del documento.

| | Ítem | Origen |
|---|---|---|
| ⬜ | **Sucesión de entrada**: Intro → Idioma → Condiciones → Acceso | v3 §6 |
| ⬜ | **Pantalla de idioma**, con **español como única opción por ahora** (decisión 08/09). El sistema queda preparado para internacionalizarse, pero **no se diseña alrededor del guaraní** (decisión 09/09): *"La localización en Guaraní no es prioridad actualmente."* Inglés y portugués, después | v3 §6 · v1 |
| ⬜ 💬 | **Zócalo inferior** de cuatro accesos: GPS · JUEGOS · S.O.S. · MÁS. Falta decidir si **se esconde durante el viaje** (criterio propio: sí) | v3 §11 |
| ⬜ 💬 | **Modo invitado de 1 día**, con acceso principalmente al GPS. Sin definir qué pasa con sus kilómetros y viajes al registrarse | v3 §7 |
| ⬜ | **Registro** con verificación por mail → personalización del avatar | v3 §8 |
| ⬜ | **Datos nuevos**: edad y nacionalidad del usuario; patente, marca/modelo y tipo del camión | v3 §9 |
| ⬜ | **Menú MÁS**: Perfil · Resumen · Reportes · Chat · Configuración | v3 §12 |
| ⬜ | **Reportes en vivo** con tipo, ubicación, horario, autor y estado. Es la cara visible de la Fase 5 | v3 §12 |

### Transversal

| | Ítem |
|---|---|
| ⬜ | Clave de firma de distribución, con copia de respaldo (AD-35) |
| ⬜ | Límite de tasa en la API — hoy no existe, y distribuir la app lo vuelve urgente |

---

## 4. Decisiones estéticas ya tomadas

Del v1 y el v2, más lo ya implementado:

- **Colores de semáforo** para confirmaciones y estados híbridos: **amarillo
  cuando no se tiene el dato**. Encaja con la regla de la casa —donde falta el
  dato, se dice— y con el `bool?` de tres estados que ya usa el dominio.
- **Verde** para el nombre de la calle por la que se circula. **Rojo** para un
  tramo con accidente o situación reportada.
- **Nada de naranja** para lo no confirmado por fuentes oficiales: se cambió por
  celeste (v1, ya hecho).
- **Dos intensidades**: el mapa sobrio, la progresión con color. Impide que lo
  gamificado se filtre a la pantalla que se mira manejando.
- Inspiración declarada: **Waze y Google Maps** para el GPS; **Duolingo** para lo
  ameno. Arcade para los juegos.

---

## 5. Lo que NO se construye hasta tener la fuente

La regla que gobierna el proyecto es **donde falta el dato, se dice que falta**.
Estos ítems del v2 la tocan de lleno:

**Tres de los cuatro se resolvieron el 31/08 y el 01/09/2026.** Quedan acá con su
resultado porque el que falta se decide igual que se decidieron éstos.

| Ítem | Resultado |
|---|---|
| Zonas peligrosas | ✅ **Mapa colaborativo del AMBA**, no oficial y sin grados: 19 zonas que tocan CABA. El **Mapa del Delito del GCBA** se probó y **se descartó** — contar hechos mide dónde hay gente, y como el dataset cubre exactamente CABA el mapa de calor dibujaba la silueta de la Ciudad. `mapa.seguridadciudad.gob.ar` no hizo falta |
| Radares de velocidad | ✅ **Dato oficial del GCBA**, CC-BY-2.5-AR: 129 cinemómetros. OSM tiene 176 y no se sabe cuál está más al día — se eligió el oficial por tener organismo, licencia y cadencia declarada |
| Radares de peso | ❌ **No existe fuente.** Cero balanzas en CABA, ni oficial ni en OSM; los puestos son de Vialidad sobre rutas. Sólo queda como reporte comunitario (L-9) |
| Aptitud de POIs | ⬜ **Pendiente.** Hoy indeclarada en 75 de 78 (L-6). El v2 propone que la completen los usuarios: eso es un dato de comunidad, **no oficial**, y tiene que verse distinto |

**Un dato aportado por usuarios nunca se muestra igual que uno oficial.** Es lo
que hace defendible al producto frente a Waze y Google Maps.

---

## 6. Cómo se decide qué sigue

La prioridad que declaró el usuario, actualizada con las fases nuevas:

**navegación → usabilidad → seguridad → información para camiones → reportes de
comunidad → experiencia y gamificación**

**El v3 no repite ese orden, y deja una pregunta abierta:** dónde entra la Fase 7.
La cáscara enmarca todo lo demás —el zócalo y el flujo de entrada cambian dónde
vive cada pantalla— así que construir gamificación antes de la cáscara significa
hacer pantallas que después hay que remontar. Pero la cáscara sola no se ve. 💬
**Sin decidir.**

Tres criterios propios que conviene sostener:

1. **La Fase 1 no se cierra sin manejar.** Todo lo demás se apoya ahí.
2. **Un defecto conocido va antes que una función nueva.** No por prolijidad: si
   la app no abre confiable, ninguna función se usa.
3. **El motor de la Fase 6 va antes que lo que se apoya en él.** Cofres, bonos y
   ediciones especiales son formas de **gastar**; si se construyen antes de que
   exista de dónde salen la XP y la moneda, es una billetera sin sueldo.
