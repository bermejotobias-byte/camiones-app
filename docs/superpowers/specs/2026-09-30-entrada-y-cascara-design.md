# La entrada y la cáscara — diseño

Fecha: 30/09/2026. Es el primer subproyecto de las **fases 6 y 7** del roadmap
(`producto-camiones-app`), y cubre lo que el brainstorm v3 llama *arquitectura
de pantallas* (§6), *modo invitado* (§7), *navegación principal* (§11) y *menú
MÁS* (§12).

El pedido original, textual del v3 §6: la experiencia inicial debe seguir esta
sucesión — **INTRO → IDIOMA → CONDICIONES → ACCESO**. Y del §7: el usuario
puede acceder como invitado **durante 1 día**, con acceso principalmente al
GPS, eligiendo primero qué tipo de camión maneja.

## 0. Por qué esto es un subproyecto y no la fase entera

Las fases 6 y 7 juntas son cinco subsistemas independientes. Meterlos en una
sola spec haría un documento que nadie puede ejecutar ni revisar. Quedan así, y
cada uno tiene su propia spec, su plan y su ciclo:

| | Subproyecto | Estado |
|---|---|---|
| **A** | **La entrada y la cáscara** — esta spec | en curso |
| **B** | Las pantallas del progreso: Resumen, Metas, Logros, *Subiste de nivel*, *Racha*, y el perfil y el carnet con el vocabulario aprobado | siguiente |
| **C** | El avatar y la colección: editor combinable, inventario visible, equipar | bloqueado por los dibujos, que no existen |
| **D** | La batería y la trivia: el primer juego con su banco de preguntas como dato | pendiente |
| **E** | El chat: público, privado, grupos, moderación | proyecto aparte |

**Dos cosas que las fuentes suponen y el motor no tiene**, encontradas al
revisar el código el 30/09/2026, y que son de **B**, no de acá:

- **Los récords personales nunca se escriben.** La tabla existe,
  `GET /api/progress/records` los lee y `PersonalRecords.Improve` está probado,
  pero nada en `src/` lo llama: hoy esa lista está vacía para siempre.
- **La racha no existe.** El prototipo tiene su tablero, la mascota tiene su
  pose (el mate) y el v3 pide "mantener días de actividad" como meta, pero en
  el dominio no hay ningún contador de días.

## 1. Decisiones del usuario

Las de esta conversación, del 30/09/2026:

| Decisión | Elegido |
|---|---|
| Dónde queda la pantalla de fuentes ("Antes de arrancar") | **En Condiciones, con un enlace.** Condiciones queda como la dibujó el prototipo —texto y un botón— y menciona de dónde salen los datos con un enlace a la pantalla actual, que **deja de ser una puerta obligatoria** y pasa a vivir en Configuración |
| Hasta dónde llega el invitado | **Navega de verdad, y el viaje no se guarda.** Guiado completo —voz, gálibos, avisos, vibración— sin viaje en el servidor, o sea sin historial, sin kilómetros y sin EXP. Al cerrar el viaje, el mono le dice lo que no se guardó y le ofrece la cuenta |
| El día del invitado | **Se cuenta y se vence.** Un día desde el primer uso, guardado en el teléfono, con la duración como número configurable. Al vencer sigue viendo el mapa y las capas, pero *Arrancar* pide la cuenta. Queda documentado que el límite es local y se puede eludir |
| Qué entra al menú MÁS | **Reportes en vivo entra en este subproyecto.** El Resumen queda como *pronto* hasta B |

Y las del 08/09/2026, que siguen rigiendo y no se rediscuten:

| Decisión | Consecuencia acá |
|---|---|
| El zócalo se ve en todas las pantallas menos en el viaje | Ya está construido así (12/09). La entrada **no** lleva zócalo |
| La pantalla de idioma se presenta, pero la única opción es español | Se construye la pantalla y se guarda la elección; no se hace i18n |
| El invitado sólo usa el GPS y **no se registra nada en el servidor**; sólo se le pregunta el camión para encasillarlo en la mejor ruta | Es la base del §6 de esta spec: cero cambios en el servidor, y el día vive en el teléfono |

## 2. Qué se reutiliza y qué es nuevo

**En el servidor no se toca nada.** Ni dominio, ni endpoints, ni migraciones.
Lo verifiqué endpoint por endpoint el 30/09/2026 y es lo que hace posible al
invitado tal como se decidió:

| Lo que el invitado necesita | Ya existe, anónimo |
|---|---|
| Elegir qué camión maneja | `GET /api/trucks/templates` — las plantillas del catálogo, que son las que no tienen dueño (AD-19) |
| Calcular una ruta de camión | `POST /api/routes` **no pide sesión**, y resuelve el camión contra las plantillas cuando no hay usuario |
| Buscar una dirección | `GET /api/places` y `/api/places/reverse` |
| Ver lugares y reportes de otros | `GET /api/pois`, `GET /api/reports` |
| Las capas, el mapa base y los gálibos | Archivos estáticos y datasets propios |

Lo único que **no** puede un invitado contra el servidor es lo que pide sesión:
viajes (`POST /api/trips` → 401), perfil, lugares guardados, contactos de
emergencia, votar y reportar, progresión. Eso es exactamente lo que define su
alcance, y ninguna de esas puertas se toca.

**En el cliente**, lo que se reutiliza tal cual:

- El **zócalo** (`js/dock.js`), que ya se esconde en el viaje y ya tiene en su
  lista de cobertura una ruta `fuentes` que hoy no existe como pantalla.
- La **mascota** (`js/mascota.js`) y sus momentos: la pose **mate** en la
  Bienvenida y en Entrar, como la fijan los tableros, y **motivar** en las hojas
  de "necesito saber quién sos".
- La pantalla de **fuentes** (`js/views/onboarding.js`), entera, sin cambios de
  contenido: cambia de lugar, no de texto.
- El **fin de viaje** (`js/views/fin-viaje.js`), que gana una variante.
- **`js/mapa/reportes.js`**: `TIPOS`, `tipoDeReporte`, `etiquetaEdad`,
  `estadoDelPin` y `nombreDelPin` sirven igual para una lista que para el mapa.
- **`js/api.js`** completo, incluida la sesión y el refresco de token.

Lo nuevo, todo en el cliente:

```
wwwroot/js/sesion.js              el estado de sesion, puro y con tests
wwwroot/js/entrada/entrada.js     orquesta los cuatro pasos y el chip "Paso N de 4"
wwwroot/js/entrada/bienvenida.js  paso 1
wwwroot/js/entrada/idioma.js      paso 2
wwwroot/js/entrada/condiciones.js paso 3
wwwroot/js/entrada/acceso.js      paso 4 (entrar, crear cuenta, probar sin cuenta)
wwwroot/js/entrada/camion.js      el camion del invitado, de las plantillas
wwwroot/js/views/reportes.js      Reportes en vivo
wwwroot/js/views/fuentes.js       la de hoy, movida y renombrada
tests/web/sesion.test.mjs
tests/web/entrada.test.mjs
tests/web/reportes-lista.test.mjs
```

Y lo que se modifica: `app.js` (una sola puerta en vez de dos ifs),
`store.js` (las preferencias nuevas y la migración), `dock.js` (el menú MÁS y
su variante de invitado), `views/navigate.js` (arrancar sin viaje del servidor
y los frenos del invitado), `views/fin-viaje.js` (la variante), `app.css` (el
vocabulario del prototipo), y la pantalla de Configuración (dos filas nuevas).

## 3. La entrada, paso por paso

Las cuatro pantallas salen de los tableros aprobados el 14/09/2026
(`docs/diseno/prototipo/`, y el porqué en `diseno-camiones-app` §16). **No se
inventa nada en el medio**: donde el tablero decide, manda el tablero.

La entrada **no lleva zócalo** (`dock.setPermitido(false)`, que ya existe) y no
se puede saltear: es la puerta.

### Paso 1 · Bienvenida — `Bienvenida.dc.html`

Es uno de los dos tableros que el usuario eligió como orientación, así que va
tal cual: luz celeste de fondo, la silueta de la ruta en SVG, el globo del mono
*abajo* con la chip naranja *Bienvenido* y el texto **"Hola, compañero. / Yo te
acompaño. Vos manejás."**, el mono con mate a 224 px sobre su halo, el título
**"El GPS de los camioneros"** a 32 px peso 900, la bajada *"Rutas por donde tu
camión puede pasar. Y kilómetros que suman."*, y las tres fichas de beneficio
(ruta según tu camión · gálibos y Red pesada · cada viaje suma).

Dos acciones, en este orden: **Empezar** (celeste, la principal) y **Ya tengo
una cuenta** (contorno celeste). Al pie, *Ley 2148 de la Ciudad · Mapa de
OpenStreetMap*.

*Empezar* sigue al paso 2. *Ya tengo una cuenta* salta directo al paso 4 con el
formulario de entrar: alguien que ya tiene cuenta aceptó las condiciones la
primera vez, y volver a pedírselas es tratarlo como nuevo.

La **intro animada del v3 §6 no se construye**. La Bienvenida ya es la
identidad visual, y un splash en una app web es tiempo que el camionero espera
sin recibir nada.

### Paso 2 · Idioma — `Idioma.dc.html`

Cabecera compacta con el chip **Paso 2 de 4**. La frase del tablero: *"¿En qué
idioma te hablo? Por ahora, español. Los demás están en camino."* Cuatro filas
con el ícono de idioma: **Español · Argentina** con neón y chip *Elegido*, y
**Português · Brasil**, **English**, **Guaraní · Paraguay** con chip *Pronto*.
Botón **Continuar**.

Las tres filas que dicen *Pronto* **no se pueden elegir**, y tocarlas no hace
nada silenciosamente: el chip ya dice por qué. La elección se guarda en
`prefs.idioma` aunque hoy el único valor posible sea `es`, porque eso es lo que
permite sumar un idioma sin rehacer el flujo (v3 §7, *"modificar esta
restricción sin rehacer el flujo"*).

### Paso 3 · Condiciones

El prototipo no la bocetó a propósito (*"texto y un botón"*), así que se arma
con el vocabulario ya aprobado: cabecera compacta con **Paso 3 de 4**, el texto
de los términos en una tarjeta que scrollea, **la fila de Configuración** como
enlace —*"De dónde salen los datos · La Ley 2148, OpenStreetMap y lo que la app
no sabe"*, que abre la pantalla de fuentes y vuelve— y el botón **Acepto**.

Aceptar guarda **la fecha**, no un booleano: el día que cambien los términos,
la fecha dice quién aceptó cuáles. Es un campo más y evita una migración.

El texto de los términos es el que hoy no existe en ninguna parte del
repositorio. **Se escribe en esta tarea, corto y en castellano llano**, y cubre
sólo lo que esta app hace hoy: que el ruteo sale de datos abiertos y puede
tener errores, que la responsabilidad de circular es del conductor, que los
reportes los escribe la comunidad, qué datos personales se guardan (correo,
alias, fecha de nacimiento, nacionalidad, los camiones y los viajes) y que se
borran al borrar la cuenta. No se inventa una cláusula que la app no cumple.

### Paso 4 · Acceso — `Entrar.dc.html`

El tablero: la luz celeste, el rótulo de la app, el título **"Hola de nuevo,
compañero."**, el mono con mate a 150 px y su globo *lado* con la chip naranja
*Entrar* y el texto **"¿Salimos? / Entrá y te devuelvo tu camión y tus
kilómetros."**, y la tarjeta de **vidrio** con Correo (con neón al enfocar),
Contraseña y el botón **Entrar**. Abajo, *Crear una cuenta* y *¿Olvidaste la
contraseña?*.

Y la acción que el tablero no tiene, porque la decidimos después: **Probar sin
cuenta**, como botón de contorno debajo de la tarjeta, separado de las otras
dos para que no compita con la acción principal.

El formulario de **crear cuenta** es el que ya funciona hoy (`views/auth.js`):
se le aplica el vocabulario —vidrio y neón— y **no se rediseña**. La
personalización del avatar que el v3 §8 pide después de registrarse es del
subproyecto C.

## 4. El estado de sesión

Hoy `app.js` decide con dos `if` seguidos: `prefs.sourcesAccepted` y
`isSignedIn()`. Con cuatro pasos y un invitado eso serían cinco condiciones
cruzadas en una función que ya monta pantallas, y es exactamente el tipo de
escalera donde después se cuela un caso que nadie previó.

En su lugar, **una función pura** en `js/sesion.js`:

```js
estadoDeSesion(prefs, sesión, ahora) → {
  tipo,            // 'nueva' | 'invitado' | 'cuenta'
  pasoQueFalta,    // 'bienvenida' | 'idioma' | 'condiciones' | 'acceso' | 'camion' | null
  invitadoVencido  // bool
}
```

`app.js` la llama una vez por montaje y hace una sola pregunta: si
`pasoQueFalta` no es nulo, monta la entrada en ese paso; si no, monta la
pantalla que pide el hash. Nada más decide puertas.

Las preferencias nuevas, en `store.js`:

```js
idioma: 'es',                    // lo elegido en el paso 2
condicionesAceptadas: null,      // fecha ISO, no booleano
invitadoDesde: null              // fecha ISO del primer uso como invitado
invitadoCamionId: null           // la plantilla que eligió
```

**La migración de quien ya usa la app** es parte del diseño, no un detalle: hoy
hay gente con `sourcesAccepted: true` y sesión guardada. La regla es una sola y
se prueba: **quien ya tiene sesión nunca ve la entrada**; y quien ya había
aceptado las fuentes pero no tiene sesión entra directo al **paso 4**, porque
ya leyó lo que Condiciones enlaza y pedirle la vuelta entera sería castigarlo
por haber estado antes.

### Qué puede cada estado

Una segunda función pura, `permisos(estado)`, con una entrada por capacidad.
Es la tabla que el resto de la app consulta en vez de adivinar:

| Capacidad | nueva | invitado | invitado vencido | cuenta |
|---|---|---|---|---|
| Ver el mapa, las capas, los gálibos y la Red | — | sí | sí | sí |
| Buscar una dirección y calcular la ruta | — | sí | sí | sí |
| Ver lugares y reportes de otros | — | sí | sí | sí |
| **Arrancar el viaje (guiado)** | — | **sí** | **no** | sí |
| Que el viaje se guarde, sume kilómetros y pague EXP | — | no | no | sí |
| Reportar, votar *sigue ahí*, aportar un lugar | — | no | no | sí |
| Guardar Casa y Depósito, ver los recientes | — | no | no | sí |
| Contactos de emergencia | — | no | no | sí |
| Llamar al 911 | — | **sí** | **sí** | sí |
| Perfil, carnet, camiones propios, progreso | — | no | no | sí |
| Configuración (tema, vibración, dirección del servidor, idioma, fuentes) | — | sí | sí | sí |

El 911 es la única fila que no se discute: **nada de la gamificación ni de las
cuentas puede estorbar un pedido de auxilio**, que es la misma regla que ya rige
para la batería (v3 §4, y `producto-camiones-app`).

## 5. El invitado

### Cómo entra

Desde *Probar sin cuenta*, y lo primero que ve es **elegí tu camión**
(`entrada/camion.js`): las plantillas del catálogo en fichas, con sus medidas y
su peso, y el neón marcando la elegida. Es el paso que el v3 §7 pone primero, y
sin él el ruteo no puede hacer su trabajo. Se guarda en
`prefs.invitadoCamionId` y `prefs.invitadoDesde` queda sellado con ese momento.

**No lleva chip de paso.** El prototipo fija *"Paso 2 de 4"* y la entrada son
esos cuatro; esto ya pasó la puerta y es la primera pantalla del invitado, no un
quinto paso. Quien crea una cuenta nunca la ve.

### Navegar sin viaje en el servidor

Hoy `startTrip` (en `views/navigate.js`) hace dos cosas en una: arma el estado
del viaje y lo guarda con `POST /api/trips`. Se separan:

- **arrancar el viaje** toma la ruta ya calculada y monta la pantalla de viaje
  —la banda, la voz, los avisos, la vibración, los globos— sin hablar con el
  servidor;
- **guardar el viaje** es el paso que llama a la API, y **sólo corre si hay
  cuenta**.

Cerrar es simétrico: el invitado cierra local, la cuenta cierra en el servidor.
Con eso el invitado recibe el producto completo —incluido el aviso de gálibo,
que es lo único que ningún GPS de autos le da— y el servidor no aprende nada
de él.

Consecuencia honesta que hay que mirar de frente: el invitado **no aparece en
el historial ni suma kilómetros**, y su viaje no sobrevive a cerrar la app. El
viaje en curso vive en el servidor (AD-27) y el invitado no tiene servidor. Si
cierra la app en medio de un viaje, al volver está en el mapa sin viaje. **No
se guarda un viaje del invitado en el teléfono para recuperarlo**: sería la
misma puerta que la decisión del 08/09 cerró, con la mitad de las garantías.

### El final del viaje, que es el momento de conversión

`fin-viaje.js` gana su variante de invitado: el mono, los kilómetros que hizo
—medidos igual, sólo que nadie los acredita— y la frase que dice la verdad:

> **Hiciste 24 km. No se guardaron.**
> Con una cuenta, cada viaje suma kilómetros, sube tu nivel y te deja reportar.
> **[ Crear mi cuenta ]  [ Seguir sin cuenta ]**

Sin fichas de EXP, sin insignias y sin festejo: no hay nada que festejar y
fingirlo sería mentir. Es la pantalla donde alguien acaba de comprobar que la
app le sirve, y por eso es donde se le ofrece la cuenta — no con un cartel
antes de dejarlo probar.

### Todo lo que no puede, lo dice el mono antes de fallar

Ninguna acción bloqueada devuelve un 401 ni un cartel de error. Cada punto de
contacto —el botón amarillo de reportar, los dos botones de *sigue ahí*, guardar
Casa, los contactos de emergencia, el perfil— abre la misma hoja, con el mono en
el momento `motivar` y el motivo concreto de esa acción:

> **Para reportar necesito saber quién sos.**
> Tu reporte lleva tu alias y suma EXP, y para eso hace falta una cuenta.
> **[ Crear mi cuenta ]  [ Ahora no ]**

El texto cambia por acción —reportar, guardar un lugar, un contacto de
emergencia— y la hoja es una sola, con el motivo como parámetro. Un mensaje
genérico ("necesitás una cuenta") enseña a ignorarlo.

### El día, y su límite conocido

`DIAS_DE_PRUEBA = 1`, constante con nombre, fijada por test. El vencimiento se
calcula con una función pura sobre `prefs.invitadoDesde` y la fecha de hoy, con
el mismo criterio de día local que ya usa el tope de votos de reportes
(UTC−3), para que "un día" signifique lo mismo en los dos lados de la app.

Al vencer, el mapa y todo lo que se mira siguen funcionando; **Arrancar** abre
la hoja del mono:

> **Se terminó tu día de prueba.**
> Creá tu cuenta y seguí manejando conmigo: los kilómetros empiezan a sumar.
> **[ Crear mi cuenta ]**

**Límite conocido, y se escribe en el AD:** el día vive en el teléfono, así que
borrar los datos del navegador o reinstalar la app lo reinicia. No hay forma de
evitarlo sin darle al invitado una sesión en el servidor, y eso contradice la
decisión del 08/09. Se acepta a ojos abiertos: la puerta no está ahí para
frenar a quien quiere eludirla, sino para que el que probó y le gustó tenga un
motivo para dar el paso.

## 6. El vocabulario del prototipo, a `app.css`

**Esto va primero, porque todas las pantallas se apoyan en él** — y es lo que
el prototipo mismo pide: *"cuando se implemente, el vocabulario va a `app.css` y
las pantallas se hacen una por una contra estos tableros"*.

Entra como clases y tokens, no como estilos sueltos por pantalla. Los valores
exactos están en `docs/diseno/prototipo/final.mjs` (las constantes `METAL2`,
`RAMPA`, `ORO`, `PLATA` y el bloque `CSS`), que es la fuente:

| Pieza | Qué es |
|---|---|
| **Vidrio** | Panel translúcido con desenfoque, para lo que va sobre una luz |
| **Neón** | El borde de luz de lo activo: el camión en uso, el idioma elegido, el campo con foco. **Uno por pantalla** |
| **Cromo**, tres tonos | `frío` (celeste → violeta) para el progreso, `oro` para el nivel, `plata` para los totales. **Uno por pantalla** |
| **Satinado** | Un dato secundario, una fila de catálogo. De vez en cuando |
| **La chapa de nivel** | Pastilla de oro, número en disco oscuro, nombre en mayúsculas. Grande, normal y chica |
| **La fila de Configuración** | Ícono ilustrado, título, subtítulo gris, chip o botón, chevron. Es la caja de toda la app |
| **Las fichas** | Dato con su ícono, su color y su resplandor del mismo tono |
| **El globo del mono** | Dos formas: *vidrio* con chip, y *pleno* con reborde inferior. Cola al costado o abajo |
| **Las luces** | Manchas de color de fondo: celeste, festejo, tenue |

Las reglas que vienen con el vocabulario y que el CSS tiene que hacer fáciles
de respetar: **una sola pieza naranja por región** (el naranja es la voz del
mono, nunca el botón de un formulario), **un cromo por pantalla**, y **el mapa
en movimiento no lleva nada de esto**.

Lo que **no** entra: la banda celeste con trama del perfil, que no fue
aprobada. Queda en el código donde ya está, sin extenderse a nada nuevo.

## 7. El menú MÁS y Configuración

MÁS queda con las cinco entradas del v3 §12 más las dos propias del proyecto,
todas con la fila de Configuración como caja:

| Entrada | Estado |
|---|---|
| Mi perfil | ya existe |
| Resumen | **pronto** — es el subproyecto B |
| Reportes | **nueva, en esta spec** |
| Mis camiones | ya existe |
| Mi carnet | ya existe |
| Chat | **pronto** — es el subproyecto E |
| Configuración | ya existe, gana dos filas |

Para el **invitado**, MÁS muestra sólo *Configuración* y una fila de **Crear mi
cuenta** con el mono: un menú lleno de filas que no puede abrir es una lista de
frustraciones.

**Configuración** suma dos filas: **Idioma** (la misma pantalla del paso 2,
donde sólo se puede elegir español) y **De dónde salen los datos**, que es la
pantalla de fuentes entera, la misma que hasta hoy era obligatoria.

## 8. Reportes en vivo

Es la cara visible de la Fase 5 y la pide el v3 §12: *"cada reporte debe
mostrar tipo, ubicación/intersección, horario, usuario que lo realizó y
estado"*.

Una lista, no un sistema. Trae los reportes vigentes con el mismo
`GET /api/reports` que usa el mapa y los ordena por más nuevo primero. El
recuadro sale, en este orden: del **último fix del GPS**, con un cuadrado de
0,02° de lado (unos 2,2 km, la distancia que un camión recorre en minutos); si
no hay fix, del **último recuadro que se vio en el mapa**; y si no hay ninguno de
los dos, no se inventa una posición: la pantalla pide prender la ubicación.
Cada fila:

- el ícono del tipo, con su color, el mismo del pin;
- la calle que guardó el reporte, o *"cerca de tu posición"* si no la tiene —
  **no se inventa una calle**, que es la regla de la casa;
- hace cuánto (`etiquetaEdad`, que ya existe);
- el alias de quien lo reportó, o *"vos"* si es propio;
- su estado: sin confirmar / confirmado / en discusión / fijo, con la misma
  lectura que el pin del mapa.

Los propios van marcados y se pueden cerrar desde acá (`DELETE`, que ya
existe). Tocar una fila abre el mapa centrado en ese reporte con su ficha.
Sin reportes cerca, el vacío vende la próxima acción: el mono y *"Por acá no
hay nada reportado. Si ves algo, contámelo."*

El invitado ve la lista completa —es información útil de la comunidad— y al
tocar cerrar o votar recibe la hoja de la cuenta.

## 9. Verificación

Lo puro, con `node --test "tests/web/*.test.mjs"`, cada test visto en rojo
antes del código:

| Qué | Casos |
|---|---|
| `estadoDeSesion` | los cuatro estados; que quien ya tiene sesión nunca ve la entrada; que quien había aceptado las fuentes cae en el paso 4; que el invitado vencido sigue siendo invitado |
| El día del invitado | vence al día siguiente en hora local; no vence el mismo día; `DIAS_DE_PRUEBA` como constante con nombre |
| `permisos` | la tabla del §4 entera, fila por fila, **incluida la del 911 en los cuatro estados** |
| La entrada | qué paso sigue a cada paso; que *Ya tengo una cuenta* salta al 4; que las filas de idioma en *Pronto* no se pueden elegir |
| La lista de reportes | el orden por más nuevo; la calle ausente; el propio marcado; el vacío |

En el navegador a 375 × 812, contra los tableros: los cuatro pasos en orden,
la elección de camión, un viaje de invitado con GPS simulado hasta el fin de
viaje sin EXP, el vencimiento del día (moviendo `invitadoDesde` a ayer), cada
hoja de "necesito saber quién sos", el menú MÁS en sus dos variantes, y la
lista de reportes con uno propio.

Y al cierre, **el APK en el teléfono**: la entrada completa desde cero, el
invitado navegando de verdad, y la conversión a cuenta. Es la franja donde
este proyecto se equivocó once veces, y nada de esto cuenta como probado hasta
que el usuario lo toque.

## 10. Fuera de esta versión

- **Los otros tres idiomas.** Se guarda la elección y las filas dicen *Pronto*;
  no hay i18n.
- **La intro animada** del v3 §6: la Bienvenida cumple ese paso.
- **El editor de avatar** después del registro (v3 §8) — subproyecto C.
- **El Resumen** — subproyecto B, igual que los récords y la racha.
- **El chat** — subproyecto E.
- **Rediseñar el registro y el carnet.** Se les aplica el vocabulario; el
  carnet sigue congelado sin aprobar (§7bis del lenguaje visual).
- **Migrar los kilómetros del invitado** al registrarse. Hoy los acredita el
  servidor y el cliente no puede declararlos: es lo que evita que se
  falsifiquen. La única forma honesta sería darle sesión al invitado, y eso
  contradice la decisión del 08/09.
- **Recuperar el viaje del invitado** al reabrir la app, por lo mismo.
