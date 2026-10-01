# BRAINSTORM 3 — Gamificación, progresión y arquitectura de la app

**Fecha:** 2026-09-08 · **Fuente:** escrito por el usuario, textual.

> Este archivo es la **fuente**, no la interpretación. Se guarda literal para que
> cualquier duda sobre qué se pidió se resuelva acá y no en un resumen. La lectura
> unificada con el v1 y el v2 vive en el `SKILL.md` de esta misma skill.

---

## OBJETIVO PRINCIPAL

Investiga e incorpora al proyecto un sistema de gamificación inspirado fuertemente
en Duolingo, tomando como referencia su funcionamiento de:

- Niveles
- Experiencia (XP)
- Metas
- Logros
- Moneda/recompensas
- Sistema de energía/vidas
- Perfil
- Estadísticas
- Trivias y minijuegos
- Navegación
- Distribución y sucesión de pantallas
- Feedback visual y sensación de progreso

La intención es replicar lo más fielmente posible el esqueleto UX y la lógica de
gamificación de Duolingo, adaptándolo al contexto de una aplicación para
camioneros.

**No copies contenido propietario.** Analiza y reproduce los patrones funcionales,
jerarquías, mecánicas y estructura de experiencia.

Si alguna parte de Duolingo no puede determinarse con suficiente precisión,
**solicítame screenshots antes de implementar una aproximación**. Es preferible
trabajar sobre referencias visuales reales que hacer suposiciones.

## 1. SISTEMA DE PROGRESIÓN — NIVEL

El nivel del usuario debe depender **exclusivamente del kilometraje acumulado**.

Ejemplo:

- 1.000 km → progreso 1/10
- 2.000 km → progreso 2/10
- 3.000 km → progreso 3/10
- ...
- 10.000 km → 10/10 → desbloquea el siguiente nivel

Al completar el objetivo de kilometraje:

1. Se completa la meta.
2. Se obtiene el logro correspondiente.
3. El usuario sube de nivel.
4. Se muestra feedback visual celebrando el progreso.
5. Se actualiza el perfil y las estadísticas.

El kilometraje es, por lo tanto, la única variable que determina el nivel.

## 2. EXPERIENCIA (XP)

La XP es **independiente del nivel**. Representa la actividad global del usuario
dentro de la aplicación. Debe otorgarse XP por acciones como:

- Completar un viaje.
- Completar correctamente una trivia.
- Completar juegos o desafíos.
- Conseguir una meta.
- Conseguir un logro.
- Otras acciones relevantes que posteriormente puedan incorporarse.

**IMPORTANTE:** XP ≠ kilometraje. El kilometraje determina el NIVEL. La XP mide la
ACTIVIDAD GENERAL del usuario. Ambos sistemas deben coexistir sin confundirse.

## 3. METAS Y LOGROS

Investiga cómo estructura Duolingo sus metas y logros y adapta esa lógica al
contexto de camioneros. Debe existir una separación clara entre:

**METAS** — objetivos progresivos que el usuario puede ir completando. Ejemplos:

- Recorrer determinada cantidad de kilómetros.
- Completar determinada cantidad de viajes.
- Completar determinada cantidad de trivias.
- Mantener determinada cantidad de días de actividad.
- Utilizar determinadas funciones.
- Participar en determinados desafíos.

**LOGROS** — recompensas obtenidas al completar determinados hitos. Deben tener:

- Nombre
- Descripción
- Progreso
- Estado bloqueado/desbloqueado
- Recompensa
- Feedback visual

El sistema debe ser escalable para poder agregar nuevos logros posteriormente sin
modificar la arquitectura principal.

## 4. BATERÍA / ENERGÍA

Investiga específicamente cómo funciona el sistema de energía/vidas de Duolingo y
utiliza esa lógica como referencia.

La aplicación tendrá una BATERÍA que se consume al realizar determinadas
actividades, especialmente: trivias, juegos, desafíos.

La batería debe poder:

- Disminuir al realizar determinadas acciones.
- Recuperarse mediante determinadas mecánicas.
- Llegar a 0.
- Impedir temporalmente determinadas actividades cuando está agotada.

Debe existir feedback visual claro sobre: nivel actual, consumo, recuperación y
batería agotada.

La monetización mediante anuncios o pagos podrá utilizarse posteriormente para
recuperar batería, pero **NO es prioridad en esta etapa**. Diseña el sistema desde
ahora de forma que posteriormente pueda incorporarse monetización sin tener que
rehacer la arquitectura.

## 5. TRIVIAS Y JUEGOS

Las trivias/juegos deben formar parte del sistema de gamificación y **no funcionar
como una sección aislada**. Deben poder generar: XP, progreso, recompensas,
consumo de batería, metas y logros.

Investiga la estructura de las trivias de Duolingo y adapta especialmente:
presentación de preguntas, progreso, feedback de respuestas, respuesta
correcta/incorrecta, recompensas, transiciones, finalización y sensación de
avance.

## 6. ARQUITECTURA DE PANTALLAS

La experiencia inicial debe seguir esta sucesión:

1. **INTRO** — logo, identidad visual, animación/transición si corresponde.
2. **IDIOMA** — Español, Guaraní, Inglés, Portugués.
3. **CONDICIONES** — aceptación de términos y condiciones.
4. **ACCESO** — registrarse o entrar como invitado.

## 7. MODO INVITADO

El usuario puede acceder como invitado **durante 1 día**. El modo invitado debe
tener acceso principalmente al GPS. No debe disponer de los beneficios completos
de la aplicación ni del sistema completo de gamificación.

Al ingresar como invitado:

1. Selecciona qué tipo de camión maneja.
2. Puede utilizar el GPS.
3. Se registra la duración del acceso.
4. Al finalizar el período permitido, debe crear una cuenta para continuar
   utilizando las funciones completas.

La arquitectura debe permitir posteriormente modificar esta restricción sin
rehacer el flujo.

## 8. REGISTRO

Si el usuario decide registrarse: email, contraseña, código de verificación
enviado al email.

Luego, **personalización del usuario**: crear avatar mediante opciones
combinables. Ejemplo: 3 tonos de piel, barba, bigote, 3 tipos de peinado, lentes y
otros elementos que puedan agregarse posteriormente. El sistema debe estar
diseñado para que estas opciones sean fácilmente ampliables.

## 9. DATOS DEL USUARIO Y DEL CAMIÓN

**Usuario:** nombre, edad, nacionalidad, avatar.

**Camión:** nombre del camión, tipo, marca/modelo, patente, características
exactas, otros datos necesarios para el funcionamiento del GPS.

La arquitectura debe permitir que un usuario tenga más de un camión y pueda
cargar, editar o seleccionar diferentes vehículos.

## 10. PERFIL PRINCIPAL

La pantalla principal del perfil debe funcionar visualmente como un **carnet de
camionero digital, con frente y dorso**.

Debe mostrar de manera jerárquica: avatar, camión, nombre, nivel, XP, kilometraje,
progreso hacia el próximo nivel e información relevante del usuario.

La presentación debe inspirarse en la claridad, jerarquía y sensación de progreso
del perfil de Duolingo.

## 11. NAVEGACIÓN PRINCIPAL

Mantener constantemente visible un **zócalo inferior con 4 accesos principales**,
inspirado en la navegación de Duolingo:

1. **GPS** — función principal de navegación.
2. **JUEGOS** — trivias, desafíos y demás mecánicas de gamificación.
3. **S.O.S.** — acceso rápido a funciones de emergencia.
4. **MÁS** — menú expandido con el resto de funcionalidades.

La navegación debe ser simple, intuitiva y mobile-first.

## 12. MENÚ "MÁS"

**PERFIL** — visualizar perfil, editar avatar, cargar camiones, editar camiones,
seleccionar camión activo.

**RESUMEN** — inspirarse en la estructura de estadísticas/perfil de Duolingo.
Mostrar nivel, XP, kilometraje, estadísticas de viajes, metas, logros, progreso,
actividad y otros indicadores relevantes. Debe funcionar como el centro de
progreso del usuario.

**REPORTES** — sistema de reportes en vivo. Cada reporte debe mostrar: tipo,
ubicación/intersección, horario, usuario que lo realizó y estado. Tipos iniciales:
control, radar, siniestro. La arquitectura debe permitir agregar nuevos tipos.

**CHAT** — chat público (al activarlo el usuario puede aparecer públicamente para
el resto), chat privado entre amigos, y grupos. Diseñar para que escale a
comunidades y grupos de camioneros.

**CONFIGURACIÓN** — modo día/noche, editar perfil, cargar/editar camiones, editar
avatar, activar/desactivar vibración, gestionar contactos de emergencia, invitar
amigos, añadir amigos.

## 13. PRINCIPIOS UX

**MOBILE FIRST** — la experiencia principal está pensada para celular.

**GAMIFICACIÓN CONSTANTE** — el usuario debe poder entender permanentemente: qué
nivel tiene, cuánto le falta para avanzar, cuánta XP tiene, qué metas está
completando, qué logros puede conseguir y qué recompensas puede obtener.

**FEEDBACK** — cada acción importante debe generar feedback claro: animaciones,
progreso, sonido/vibración cuando corresponda, recompensas, estados de
éxito/error, celebración de logros.

**PROGRESIÓN VISIBLE** — el usuario siempre debe sentir que está avanzando. El
kilometraje representa el progreso principal. La XP representa actividad. Las
metas y logros representan objetivos secundarios. La batería representa el recurso
limitado para actividades de gamificación.

## 14. INVESTIGACIÓN PREVIA OBLIGATORIA

Antes de implementar estas funcionalidades, analiza cómo resuelve Duolingo:
perfil, navegación inferior, XP, niveles, metas, logros, energía/vidas, trivias,
recompensas, estadísticas, feedback visual, sucesión entre pantallas, jerarquía de
información y microinteracciones.

**No quiero una implementación basada únicamente en conocimiento general.** Cuando
sea necesario, solicita screenshots para analizar visualmente las pantallas reales
y utilizarlas como referencia estructural.

## 15. INTEGRACIÓN CON EL PROYECTO EXISTENTE

Esta especificación es una tercera etapa de brainstorming y debe incorporarse al
núcleo conceptual del proyecto y a las skills correspondientes.

Antes de modificar código:

1. Analiza la arquitectura actual.
2. Identifica qué funcionalidades ya existen.
3. Identifica qué decisiones anteriores deben conservarse.
4. Detecta conflictos con esta nueva especificación.
5. Propón los cambios arquitectónicos necesarios.
6. Evita duplicar funcionalidades.
7. No rompas funcionalidades existentes.

La implementación debe ser modular y preparada para futuras extensiones. Prioriza
**arquitectura sólida**.

## RESULTADO ESPERADO

Una aplicación que combine: GPS profesional para camioneros + identidad de usuario
+ progresión + gamificación + comunidad + utilidad práctica.

La experiencia de uso debe transmitir una sensación similar a Duolingo en cuanto a
**claridad → progreso → recompensa → objetivos → repetición → engagement**, pero
completamente adaptada al universo del camionero.

---

# EXTENSIÓN — Reportes, recompensas y personalización

**Fecha:** 2026-09-09 · **Fuente:** escrito por el usuario, textual.

> Ampliación del v3 donde el usuario es más incisivo en tres temas: los reportes
> como mecánica, las recompensas coleccionables y el perfil como vitrina.

## 1. Reportes como mecánica de progresión

Los reportes realizados por el usuario también forman parte del sistema de
gamificación. El usuario podrá reportar: **accidentes, controles, cámaras**.

Cada reporte válido debe otorgar EXP. Los reportes también deben poder contribuir
al progreso de Metas y Logros. Ejemplos:

- Reportar 10 accidentes.
- Reportar 25 controles.
- Reportar 50 cámaras.
- Realizar 100 reportes.
- Mantener actividad de reportes durante determinados días.
- Completar diferentes tipos de reportes.

La EXP obtenida por reportar debe sumarse a la EXP general, manteniendo la regla
anterior: **EXP = actividad general dentro de la aplicación**.

**Los reportes NO determinan el nivel.** El nivel continúa dependiendo
exclusivamente del kilometraje acumulado.

## 2. Metas, logros y recompensas desbloqueables

Las Metas **no deben limitarse a mostrar estadísticas**. Deben funcionar como
objetivos que desbloquean **recompensas coleccionables**.

Cuando una Meta alcanza 10/10, debe:

1. Completar la Meta.
2. Desbloquear el Logro correspondiente.
3. Otorgar EXP.
4. Desbloquear una recompensa.
5. Mostrar una animación/feedback de desbloqueo.
6. Incorporar automáticamente la recompensa al **inventario** del usuario.
7. Permitir **equiparla o exhibirla** en el perfil.

## 3. Tipos de recompensas

Orientadas principalmente a la **personalización y colección**.

**Skins del avatar:** skins, ropa, accesorios, peinados, barbas, lentes, elementos
temáticos y otros elementos cosméticos. Utilizables para personalizar el avatar.

**Camiones coleccionables:** camiones especiales o skins de camiones. La recompensa
puede representar un camión similar al que usa el usuario, una versión especial,
una variante estética, un camión temático, o camiones especiales asociados a
determinados logros. El camión desbloqueado funciona como objeto coleccionable y
puede exhibirse en el perfil.

La arquitectura debe permitir **agregar nuevos skins, accesorios y camiones sin
modificar el sistema principal**.

## 4. Perfil como vitrina del progreso

El perfil no es sólo identificación: es **vitrina de logros y colección**. Sigue
usando el concepto de carnet digital frente/dorso.

**FRENTE:** skin/avatar equipado, nombre, nivel, EXP, información principal, camión
activo, identidad visual del usuario.

**DORSO:** resumen de estadísticas, kilómetros recorridos, viajes realizados,
reportes realizados, metas, logros, camiones desbloqueados.

El usuario debe poder exhibir aquello que consiguió. La colección debe generar una
sensación similar a un sistema de **logros + colección + personalización**.

## 5. Relación entre los sistemas

Mantener **estrictamente** la separación:

| Sistema | Qué es |
|---|---|
| **KILOMETRAJE** | Determina exclusivamente el NIVEL |
| **EXP** | Actividad general: viajes, trivias, juegos, metas, logros, reportes y actividades futuras |
| **METAS** | Objetivos progresivos. Ej.: *Reportes de accidentes — 7/10* |
| **LOGROS** | Se desbloquean al completar objetivos. Ej.: *Especialista en accidentes — DESBLOQUEADO* |
| **RECOMPENSAS** | Elementos que se obtienen al conseguir logros/metas. Ej.: *Skin "Camionero Nocturno" — DESBLOQUEADA* |
| **INVENTARIO** | Almacena todas las recompensas obtenidas |
| **EQUIPAMIENTO** | Determina qué skin/avatar/camión está exhibido en el perfil |

## 6. Principio de diseño

El sistema debe generar un ciclo constante:

**USAR LA APP → GANAR EXP → COMPLETAR METAS → DESBLOQUEAR LOGROS → OBTENER
RECOMPENSAS → PERSONALIZAR PERFIL → MOSTRAR PROGRESO → VOLVER A USAR LA APP**

La gamificación debe incentivar el uso real de las funcionalidades útiles de la
aplicación, **no convertirse en una capa independiente**.

Los reportes, por ejemplo, deben ser simultáneamente: una herramienta útil para la
comunidad + una fuente de EXP + una oportunidad de completar metas + una fuente de
logros y recompensas.

## 7. Referencias visuales

La estructura visual definitiva del perfil, carnet, skins, camiones, logros, metas,
recompensas y demás componentes **será definida posteriormente a partir de
screenshots/referencias visuales que proporcionaré**.

Cuando reciba dichas imágenes:

1. Analiza su estructura visual.
2. Identifica jerarquía, distribución, componentes y patrones.
3. Utilízalas como referencia para definir el sistema visual.
4. Mantén la lógica funcional definida en este documento.
5. **No implementes aproximaciones visuales innecesarias antes de contar con las
   referencias.**

Las imágenes deberán utilizarse como referencia de diseño y estructura,
adaptándolas a la identidad propia de esta aplicación.
