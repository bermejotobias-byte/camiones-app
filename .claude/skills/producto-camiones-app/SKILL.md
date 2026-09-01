---
name: producto-camiones-app
description: Qué se va a construir en el GPS para camiones de CABA y por qué — los requisitos de los dos brainstorms del usuario, unificados, asignados a fase y con lo que falta verificar antes de construirlo. Invocar al planificar qué sigue, al estimar alcance, o cuando aparezca un requisito que no se sabe de dónde salió.
---

# Producto — Navegador de Tránsito Pesado (CABA)

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

Los dos viven en el escritorio del usuario. **Se suman, no se reemplazan**: el v2
dice explícitamente que va sobre lo anterior.

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

## 3. El backlog por fase

Marcas: ✅ hecho · 🔨 en curso · ⬜ pendiente · 🔍 **necesita verificar la fuente
antes de construirse** · 💬 **necesita una conversación: la idea no alcanza**

### Fase 1 · Navegación — 🔨 abierta

Lo que falta para cerrarla, y lo que el v2 le agrega:

| | Ítem | Origen |
|---|---|---|
| 🔨 | **Probar manejando.** Nunca se hizo. Es la tesis del producto | — |
| ⬜ | **El nombre de la calle por la que vas, legible durante el viaje.** Hoy lo tapa la línea de la ruta. Debe verse **3× más grande** que las calles que no se toman, y en verde | v2 · estética |
| ⬜ | **Vibrar ante cada eventualidad**: doblar, gálibo, accidente, radar | v2 |
| ⬜ | **Alternativas de ruta** cuando la recomendada está deshabilitada | v2 |
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
| ⬜ | **3 llamadas de emergencia** a contactos que elige el usuario | v1 |
| ⬜ | **Compartir el viaje en tiempo real** por WhatsApp | v1 |
| ⬜ | **S.O.S. rápido dentro del reporte de siniestro**: al marcar un accidente grave, un aviso emergente para llegar al 911 en un toque | v2 |
| ✅ 🔎 | **Zonas peligrosas de CABA** — resuelto con el **Mapa del Delito del GCBA** (CC-BY, un archivo por año, 133.203 hechos de 2025). Cuenta **robos a mano armada**, no cantidad de robos: contar cantidad mide cuánta gente circula y ponía a Palermo primero y a Villa Soldati como la más segura. Mapa de calor sobre los hechos crudos (AD-36). **Falta verlo en el APK** | v1 + v2 · 01/09/2026 |

### Fase 4 · Información para camiones — 🔨 **reabierta por el v2**

| | Ítem | Origen |
|---|---|---|
| ✅ | Red de Tránsito Pesado, gálibos y pasos a nivel | v1 · AD-25 |
| ✅ | Mapa base propio, minimalista, día y noche | v1 · AD-26 |
| ✅ | **Avenidas aptas para tránsito pesado con el nombre destacado**, aunque no sean parte de la ruta | v1 · capa `red-nombre` |
| ✅ | **Radares de control de velocidad** — resuelto con dato oficial: 129 cinemómetros del GCBA (CC-BY). Las otras 95 cámaras del dataset son de analítica de video y quedaron afuera | v2 · 01/09/2026 |
| ❌ 💬 | **Radares de control de peso.** Investigado sin resultado: **no existe fuente** — cero balanzas en CABA, ni dataset oficial ni OSM (L-9). Sólo queda como reporte comunitario | v2 · cerrado 31/08/2026 |
| ⬜ 💬 | **Lugares de interés valorados por usuarios**, que además confirmen si son aptos para tránsito pesado (y eso da puntos). Se cruza con los 78 POIs que ya existen, donde la aptitud está indeclarada en 75 (L-6) | v2 |
| ⬜ | **Modo reparto**: hasta 10 direcciones con la ruta óptima desde el origen | v1 |

### Fase 5 · Reportes de la comunidad — ⬜ **nueva, sale del v2**

Fase propia porque es un sistema, no una función.

| | Ítem |
|---|---|
| ⬜ | Reportar durante el viaje **con un gesto**: mantener el dedo abre un menú con siniestro vial, control de velocidad y retén policial |
| ⬜ | **Confirmación cruzada**: otros usuarios validan el reporte |
| ⬜ | Los reportes confirmados aparecen en **"reportes del usuario"** |
| ⬜ | Mostrar en el mapa el tramo con accidente **en rojo** |
| ⬜ | Reportar **da bonos** — es el enganche con la Fase 6 |
| 💬 | Cuánto dura un reporte, cuántas confirmaciones lo validan, qué pasa con los falsos. **Sin esto definido no se puede construir bien** |

### Fase 6 · Experiencia y gamificación — ⬜ pendiente

| | Ítem | Origen |
|---|---|---|
| ⬜ | Avatares predeterminados: distintos tonos de piel, uno con gorrita, uno con pelo degradé, uno formal | v1 |
| ⬜ | Ediciones especiales de avatares (días festivos, eventos), por suscripción o bonos | v1 |
| ⬜ | Cofres cada tantos días de uso o por suma de puntos | v1 |
| ⬜ | Los kilómetros desbloquean cosas | v1 |
| ⬜ | Chats individuales y grupos, con palabras baneadas y baneo automático por repetición | v1 |
| ⬜ | **Bonos** por reportar y por las trivias | v2 |
| ⬜ | **Premiar el tiempo de interacción** en cualquier sección, no sólo el GPS | v2 |
| ⬜ 💬 | **Cinco juegos con estética arcade**: trivia tipo Preguntados con ranking diario y semanal, viborita-camión que suma acoplados, esquivar autos, tipo Grand Prix, y tipo dinosaurio de Google saltando miguelitos, baches y lomas de burro | v2 |

> **Los juegos son un proyecto aparte.** Cinco juegos con gráficos de arcade y
> ranking no entran en "una fase más". Conviene elegir uno, hacerlo bien y ver qué
> pasa, antes de comprometerse con los cinco.

### Transversal

| | Ítem |
|---|---|
| ⬜ | i18n: español, portugués, guaraní e inglés |
| ⬜ | Clave de firma de distribución, con copia de respaldo (AD-35) |

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
| Zonas peligrosas | ✅ **Mapa del Delito del GCBA**, CC-BY, un archivo por año, con coordenadas. `mapa.seguridadciudad.gob.ar` no hizo falta |
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

Dos criterios propios que conviene sostener:

1. **La Fase 1 no se cierra sin manejar.** Todo lo demás se apoya ahí.
2. **Un defecto conocido va antes que una función nueva.** No por prolijidad: si
   la app no abre confiable, ninguna función se usa.
