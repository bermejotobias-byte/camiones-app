---
name: estado-camiones-app
description: Estado vivo del proyecto GPS para camiones de CABA — dónde está el roadmap, qué está verificado y qué no, las decisiones tomadas con el usuario y las trampas del entorno de desarrollo. Invocar al retomar el trabajo en este repositorio, antes de planificar o escribir código.
---

# Estado del proyecto — Navegador de Tránsito Pesado (CABA)

Este archivo es **memoria de trabajo**, no documentación del producto. Lo que ya
está escrito en `docs/` no se repite acá: se indexa. Lo que hay acá es lo que no
vive en ningún otro lado — el estado del roadmap, qué se probó de verdad, y las
trampas del entorno que cuestan horas si se redescubren.

---

## 1. Qué es

GPS para camiones en CABA que **rutea según las medidas y el peso del vehículo**.
La restricción entra como *custom model* de GraphHopper **antes** de calcular la
ruta, no como advertencia posterior. Fuente regulatoria: Ley 2148, art. 9.10.1
(Red de Tránsito Pesado). Mapa: OpenStreetMap — **nunca Google Maps ni Waze**.

Objetivo declarado: *"El GPS de los camioneros de Buenos Aires"*. No sólo un
navegador: perfil, historial, gamificación, comunidad.

**Rama de trabajo:** `cuentas-de-usuario`, al día con `origin` desde el
01/09/2026. **`main` quedó en `a587041`**: la rama está bastante adelante y
todavía no se fusionó.

**Hay dos remotos.** `origin` es `bermejotobias-byte/camiones-app` y es el que se
usa; `hermano` es `bermejolautaro/camiones-app`, con su propia rama
`cuentas-de-usuario` en otra punta. **No empujar a `hermano`** sin que el usuario
lo pida.

---

## 2. Dónde está la verdad

**Leer siempre antes de decidir algo.** No duplicar su contenido acá.

| Documento | Qué tiene |
|---|---|
| `CLAUDE.md` | Convenciones, comandos, **trampas que ya costaron tiempo** |
| `docs/decisions.md` | **41 decisiones arquitectónicas (AD-01…AD-41)** con su porqué |
| `docs/data-sources.md` | Fuentes, licencias y limitaciones **L-1…L-11** (L-4 ya resuelta) |
| `docs/architecture.md` | Estructura y proyectos |
| `docs/routing.md`, `docs/restrictions.md`, `docs/pois.md`, `docs/deploy.md` | Por tema |
| `PLAN.md` | Especificación original del MVP |
| **skill `producto-camiones-app`** | **El alcance completo**: los dos brainstorms unificados y asignados a fase |
| Escritorio del usuario | `PUNTOS A TRABAJAR…docx` (33 requisitos, 22/08) y `ideas camionero app v2.docx` (31/08). Están **abiertos en Word**: para leerlos hay que copiarlos antes, si no el archivo está bloqueado |

**Las AD-17 a AD-41 son del trabajo reciente.** Las seis últimas, del 01/09/2026:

| AD | Qué resuelve | Por qué importa releerla |
|---|---|---|
| **AD-36** | Zonas peligrosas del mapa **comunitario**, no del oficial | Cuando la cobertura de una fuente coincide con una frontera, el mapa dibuja la frontera |
| **AD-37** | El nombre de la calle se rotula sobre el **mapa base** | Los tramos entre maniobras miden 29–90 m: no entra el texto. Y la colisión va **activada** |
| **AD-38** | Pasos a nivel sólo durante el viaje y sin escala de color | El color codifica una sola dimensión: cuánto te afecta a vos y a tu camión |
| **AD-39** | Vibración con **un patrón por tipo de aviso** | Si todo vibrara igual habría que mirar la pantalla, que es lo que la vibración evita |
| **AD-40** | Alternativas ordenadas por restricciones, no por tiempo | La tolerancia de 60 s no es un detalle: sin ella la Red nunca desempata |
| **AD-41** | El orden del reparto con distancias **reales** | En CABA la ruta real llega a 1,67× la recta; un par sin ruta vale infinito y no tumba el reparto |

Las cinco anteriores, del 25–26/08/2026, siguen valiendo: **AD-30** (brújula del
magnetómetro — por qué NO se usa `Compass` de MAUI), **AD-31** (`Debug.WriteLine`
se borra en Release), **AD-32** (tests de JS sin dependencias), **AD-33** (una
dirección mal escrita dejaba la app inutilizable) y **AD-34** (cámara cenital fija
fuera del viaje).

---

## 3. Roadmap y estado

**El alcance completo vive en la skill `producto-camiones-app`**, que unifica los
dos brainstorms del usuario y asigna cada ítem a una fase. Acá va sólo el estado.

Prioridad declarada:
**navegación → usabilidad → seguridad → info para camiones → reportes de comunidad
→ experiencia y gamificación**

| Fase | Estado |
|---|---|
| **0 · Cimientos** | ✅ Completa — cuentas, camiones por usuario, viajes, mudanza del frontend |
| **1 · Navegación** | 🔨 **Todo lo construible está hecho** — guiado, voz, GPS en segundo plano, brújula, nombre verde de la calle, vibración por patrón, alternativas de ruta y reintento al conectar. Falta lo único que no se puede hacer acá: **manejar** |
| **2 · Usabilidad** | ✅ Completa — salió adelantada dentro de la mudanza del frontend |
| **3 · Seguridad** | 🔨 Están el 911 y las zonas peligrosas. Faltan **3 contactos**, **compartir viaje** y el S.O.S. dentro del reporte |
| **4 · Info para camiones** | 🔨 Capas, mapa base, avenidas destacadas, radares y **modo reparto** hechos. Queda sólo **POIs valorados por usuarios**, que necesita conversación |
| **5 · Reportes de comunidad** | ⬜ **Fase nueva del v2** — reportar y confirmar siniestros, radares y retenes. Es un sistema, no una función |
| **6 · Experiencia y gamificación** | ⬜ Avatares, cofres, chat, bonos y **cinco juegos arcade** |
| **Transversal** | ⬜ i18n (español, portugués, guaraní, inglés) · clave de firma de distribución |

**El 31/08/2026 el usuario sumó un segundo brainstorm** (*"IDEAS PARA TBF 2.0"*)
que agranda el proyecto: abre la fase de reportes de comunidad, reabre la 4 y
convierte la de experiencia en algo mucho más grande de lo que parecía. Antes de
planificar, leer `producto-camiones-app`.

### Commits de la rama, en orden

```
213041b  Cuentas de usuario con verificacion por mail y perfil de camionero
96c5e42  Los camiones pertenecen a una cuenta; las plantillas no son de nadie
774c99c  Viajes: historial y kilometros que el cliente no puede falsificar
7ce55f9  La interfaz pasa a una aplicacion web mobile first, sin paso de compilacion
728b840  La app Android pasa a ser una cascara sobre la aplicacion web
54d5291  Navegacion paso a paso: motor de guiado en el cliente
49e7d88  El GPS sigue vivo en segundo plano mientras dura el viaje
53f8914  Arreglos del puente entre la cascara y la web, encontrados probando en el telefono
1710102  Capas de camion en el mapa: la Red, los galibos y los sapitos
257600e  Mapa base propio en PMTiles: minimalista, con dia y noche
a4eda3d  Actualiza la skill: Fase 4 cerrada y comandos de datos
5fb0ef3  Brujula del magnetometro, camara cenital fija, y una app que ya no queda varada
a587041  Actualiza la skill: el checkpoint y que config-truck.yml no se commitea   <- main
1b5cd5a  Zonas de riesgo y radares en el mapa, simbolos que se entienden, y un APK que se puede actualizar
145caec  Actualiza la skill: checkpoint 1b5cd5a, y dos cosas que decia y ya son falsas
1b631dc  Las zonas de riesgo cuentan robos a mano armada, y vuelven a ser un mapa de calor
5b7d0d6  Actualiza el roadmap: la Fase 4 estaba mas cerrada de lo que decia
9363092  El arranque insiste tres veces antes de rendirse, no una
82fc732  Las zonas peligrosas salen del mapa comunitario, con boton propio y sin numeros
0dea657  El nombre de la calle por la que vas: en verde, y ya no lo tapa la ruta
d19d650  El nombre verde se achica y deja de encimarse consigo mismo
727912d  Los sapitos solo durante el viaje y sin escala de color; el galibo usa el puente del boton
17c8417  Vibracion: un patron distinto por aviso, y avisos de lo que hay sobre la ruta
954dd28  Alternativas de ruta, ordenadas por restricciones y no por tiempo
907d5ed  Modo reparto: el backend ordena hasta 10 paradas por distancia real
b5bacd4  Modo reparto: la interfaz, con paradas numeradas en la lista y en el mapa
```

**`b5bacd4` es la punta del 01/09/2026**, y con ella **cierra todo lo construible
de la Fase 1**. Los nueve commits desde `9363092` cubren:

- **Reintento al conectar** (apéndice de AD-33): 3 intentos, y sólo se reintenta
  lo que puede resolverse solo.
- **Zonas peligrosas rehechas desde el mapa comunitario** (AD-36). Ver abajo: el
  intento con el dato oficial **se descartó**.
- **Nombre de la calle en verde** sobre el mapa base, a 1,5× (AD-37).
- **Pasos a nivel sólo en viaje, sin escala de color**; gálibo con el puente del
  botón; radar como cámara de vigilancia (AD-38).
- **Vibración con un patrón por aviso** y avisos precalculados sobre la ruta (AD-39).
- **Alternativas de ruta** ordenadas por restricciones (AD-40).
- **Modo reparto**, backend e interfaz (AD-41).

**`1b5cd5a` fue el checkpoint anterior**: radares de velocidad (129 cinemómetros
oficiales), rediseño de los símbolos del mapa, **firma estable del APK** (AD-35) y
el encoding de Overpass. Trajo también una versión de las zonas de riesgo desde el
**Mapa del Delito del GCBA** que **ya no existe**: se descartó en `82fc732` y la
skill no debe volver a citarla como la fuente vigente.

**`5fb0ef3` es el checkpoint del 26/08/2026** —la skill lo llamaba `029794e`, hash
que ya no existe— y junta el trabajo que había quedado sin commitear (AD-27 a
AD-29) con el de esa sesión (AD-30 a AD-34).

**`routing/config-truck.yml` quedó deliberadamente fuera del commit**: el árbol de
trabajo apunta a `argentina-latest.osm.pbf` porque el recorte del AMBA no está en
disco, y sin ese cambio local GraphHopper no arranca. Va a seguir apareciendo como
modificado en cada `git status`; **no commitearlo**.

---

## 4. Qué está verificado — y qué NO

**Distinción crítica.** Mucho está probado a fondo; una franja específica no se
pudo probar y hay que decirlo cada vez.

### Verificado en el teléfono el 01/09/2026

APK de Release instalado con `adb install -r` (30,2 MB) sobre la versión anterior,
sin desinstalar:

| Qué | Evidencia |
|---|---|
| Arranque y conexión | `resultado: alcanzable=True motivo=ninguno` |
| Errores de JavaScript y crashes | **ninguno** |
| Zonas de riesgo, radares y símbolos rediseñados | vistos en el APK, no sólo en el navegador |

**Lo que quedó sin ver en el teléfono de esa tanda**: el modo reparto, el selector
de alternativas y los pasos a nivel entrando y saliendo del viaje. Se verificaron
end-to-end **en el navegador** — reparto con cuatro paradas reordenadas a
Caseros → Corrientes 5500 → Rivadavia 11000 → Cabildo 2000, con sus marcadores
numerados — pero no se tocaron en el APK.

### Verificado en el teléfono el 31/08/2026 — barrido completo

Con la app instalada de cero y el log limpio, sin un solo error:

| Qué | Evidencia |
|---|---|
| Conecta sin dirección escrita a mano | `fijada a mano: False`, 84 ms |
| Interfaz | `interfaz cargada`, **cero errores de JavaScript** |
| Crashes nativos | ninguno |
| Brújula | `rot_vec registrado=True`, `declinacion=-10.3` (correcta para CABA) |
| GPS | permiso OK, última conocida + alta precisión, un solo ciclo de registro |
| Actualizar sin desinstalar | `adb install -r` → `Success` (AD-35) |
| Viajes abiertos colgados | 0 de 28 |

Confirmado además por el usuario tocando: botón *Salir*, arrastre del mapa, zoom
con + y −, y las cruces de origen y destino.

**`Token expired` en el log del backend NO es un bug**: el cliente pide un
`refresh`, reintenta una vez y sólo cierra sesión si eso falla, con guarda contra
bucles. Los otros dos avisos del backend —SMTP sin configurar y el *override* del
bind a `0.0.0.0:5080`— también son esperados.

### Verificado en el teléfono el 26/08/2026

- **La app entra y conecta.** Costó una noche: ver AD-33, cuatro fallas
  encadenadas que la dejaban inutilizable con una dirección mal escrita.
- **El ruteo desde el teléfono funciona end-to-end**: GraphHopper sirvió cinco
  rutas de camión con el custom model completo, en 7–78 ms.

### Verificado con rigor

- **Motor de navegación** (`wwwroot/js/navigation.js`): recorrido sintético de
  1051 posiciones sobre ruta real; distancia calculada 26.260 m contra 26.256 m
  de GraphHopper (**4 m de error en 26 km**); robusto a ±30 m de ruido; detección
  de desvío 0→1→2→3 strikes con enfriamiento; avisos de 35 apelotonados a 26 con
  220 m de separación mínima.
- **Backend completo**: **127 tests unitarios + 46 de integración** (11 contra
  GraphHopper real). Flujos end-to-end por HTTP: alta, verificación, login,
  perfil, alias único, camiones, propiedad, viajes, acreditación de km. Los
  unitarios incluyen 17 de la política de reintentos, 11 del orden de rutas
  alternativas y 14 del orden del reparto; **los tres últimos grupos enlazan
  archivos de Mobile**, que a propósito no depende de MAUI.
- **45 tests de JS** (`node --test`), que cubren el motor de guiado y los avisos
  de ruta. Fue un test —y no el teléfono— el que encontró que `Number(null)` es 0
  y no `NaN`, con lo que un gálibo sin altura declarada se habría avisado como
  *"puente de 0,00 m, no pasás"*.
- **Datos del mapa**: medidos contra Overpass el 24/08/2026, dentro del límite
  administrativo de CABA.

### NO verificado

- **Navegación manejando.** Nunca se probó en movimiento, y a esta altura es
  **lo único que falta para cerrar la Fase 1**: que la flecha siga al camión, que
  hable en los giros, que el servicio sobreviva a apagar la pantalla, que el
  nombre verde se lea a velocidad, y que el **modo reparto** y el **selector de
  alternativas** se usen con las manos ocupadas.
- **La vibración nunca se sintió.** Compila, instala y no rompe nada, pero que el
  teléfono efectivamente vibre y que los cuatro patrones se distingan sólo se
  comprueba manejando (AD-39).
- **El APK instalado apunta a una IP de la red de casa.** En la calle no va a
  tener backend: hace falta `demo-up.ps1` y recompilar con esa URL de túnel, o
  quedarse en la red de casa para la primera vuelta.
- **La brújula en el soporte del camión.** El usuario la probó en el teléfono el
  26/08/2026 y reportó que **funciona** —dial, cardinal y cono—, pero con el
  aparato en la mano. Falta el caso que motivó no usar `Compass` de MAUI: el
  teléfono **parado en un soporte de parabrisas** (AD-30). Ahí es donde el eje
  cambia, y ahí es donde se sabrá si el trabajo extra valió la pena.
- **La app en el teléfono, salvo lo que reportó el usuario.**
- **El modo reparto, las alternativas y los pasos a nivel dentro y fuera del
  viaje**, que quedaron probados en el navegador y no en el APK.

**Cuando el pedido es visual, la referencia visual manda.** El usuario pidió dos
veces inspirarse en un mapa que compartió, y las dos veces el trabajo se fue a la
metodología del dato —qué contar, cómo normalizar— antes que al aspecto. Textual:
*"tenías que orientarte más en lo visual del mapa de maps que en los datos de
robo"*. Costó rehacer las zonas enteras. Es la lección más cara de la sesión del
01/09/2026 y no es sobre zonas de riesgo: es sobre cómo leer un pedido.

**Ya no es cierto que el mapa no se pueda ver.** Esta skill decía que el panel de
navegador no componía frames y que las capas estaban "servidas pero no vistas".
El 01/09/2026 el mapa renderizó, cargó tiles y se pudo iterar el diseño a fuerza
de capturas. **Dos cuidados** al hacerlo:

- El mapa tarda en componer: una captura tomada enseguida sale a medio dibujar y
  se lee como "el cambio no funcionó". Esperar y volver a capturar.
- El **módulo ES queda cacheado** aunque se edite el archivo y se haga
  Ctrl+Shift+R. Se calibra a ciegas contra código que ya no existe. Para
  verificar de verdad: `import('/js/layers.js?v=' + Date.now())`.

Para inspeccionar el estado real del mapa desde la consola, el objeto no está
expuesto; se captura parcheando el prototipo:

```js
const orig = maplibregl.Map.prototype.setPaintProperty;
maplibregl.Map.prototype.setPaintProperty = function (...a) { window.__map = this; return orig.apply(this, a); };
(await import('/js/map.js')).refreshColors();   // dispara la captura
maplibregl.Map.prototype.setPaintProperty = orig;
```

Con `window.__map` se puede leer `getStyle().layers`, escuchar `map.on('error')`
—que es por donde MapLibre reporta los estilos inválidos, **no por excepción**— y
probar valores en vivo con `setPaintProperty` sin recompilar nada.

### Lección que se pagó cinco veces

Las cinco fallas encontradas en el teléfono estuvieron **todas en la costura
entre la cáscara nativa y la web** — justamente lo único que no se puede probar
acá. Cuando se toque esa costura, asumir que va a fallar y **pedirle al usuario el
mensaje de error textual**: cada uno descartó una capa.

La cuarta (25/08/2026) fue `confirm()`: el WebView no lo dibuja y devuelve `false`
en silencio, así que *Terminar viaje*, *Cerrar sesión* y *Borrar camión* parecían
botones muertos. **Nada en el navegador de escritorio lo delata**: ahí funciona.
Al escribir código para la web que corre adentro del APK, preguntarse siempre qué
API del navegador se está dando por sentada. Ver AD-28.

La quinta (25/08/2026) fue el GPS: proveedor crudo en vez del combinado, sin usar
la última posición conocida, y una pantalla que no cambiaba nada hasta el primer
fix. Ver AD-29.

### `dumpsys location` es la herramienta de diagnóstico del GPS

Lo que cerró el caso del arranque lento, y sirve para cualquier duda de ubicación:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell "dumpsys location | grep -E 'provider|trucknavigator'"
```

Da, sin ambigüedad: **qué proveedores están habilitados** en ese teléfono
—`network provider: enabled=false` fue el hallazgo—, **cuántas posiciones recibió
cada cliente** (`locations = 0` contra `locations = 465`), la **última posición
conocida**, y un historial con marca de tiempo de cada alta y baja de registro.
Dos altas seguidas separadas por exactamente 15 s con cero posiciones es la firma
de un `GetLocationAsync` expirando.

Complementos: `dumpsys activity services <paquete>` para ver si el servicio en
primer plano está vivo y desde cuándo, y `ls -lt /data/anr/` para ANRs.

### "No se pudo conectar al servidor": probar desde el teléfono, no deducir

Confirmado el 26/08/2026. El síntoma casi siempre es la **IP vieja grabada en el
APK** tras un cambio de red, pero antes de recompilar conviene probar de verdad,
porque hay dos espejismos que llevan por el camino equivocado:

- **`ping` desde el teléfono a la máquina falla SIEMPRE**, aunque todo ande:
  Windows bloquea ICMP por defecto en todos los perfiles. Un 100% de pérdida
  **no prueba nada**.
- **El perfil de red suele ser "Public"** al entrar a una WiFi nueva, lo que
  asusta, pero la regla `TruckNavigator API 5080 (dev)` ya cubre ese perfil.
  Verificar con `Get-NetFirewallProfile` que `DefaultInboundAction` no esté en
  `Block` y con `Get-NetFirewallAddressFilter` que el `RemoteAddress` de la regla
  incluya la subred de hoy — está limitado a una subred, así que **cambiar de red
  puede dejarlo afuera**.

La prueba que sí sirve es TCP desde el propio teléfono, con `toybox nc`
(`curl` no existe en Android):

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell "toybox nc -w 5 192.168.100.106 5080 < /dev/null; echo `$?"
```

`0` es que llegó, distinto de `0` es que no. **Y validá el instrumento**: la misma
prueba contra un puerto cerrado (`9999`) y una IP inexistente tiene que dar `1`.
Sin ese control, un `nc` que siempre devuelve 0 lleva a una conclusión falsa.

No usar `echo -e 'GET ...'` para armar el pedido HTTP: el shell de Android no
interpreta esos escapes y `nc` conecta pero manda basura, con lo que parece que
el servidor no contesta. Va `printf`.

### Cuando la WiFi no sea opción: túnel por USB

```powershell
& $adb reverse tcp:5080 tcp:5080
& $adb reverse tcp:8989 tcp:8989
```

El `localhost` del teléfono pasa a ser el de la máquina. Se configura la app con
`http://127.0.0.1:5080` y anda sin depender de la red ni del firewall — sirve
para probar de escritorio, no para manejar.

### Adentro del APK ahora SÍ hay log — usalo antes que nada

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb logcat -c                          # limpiar antes de reproducir
& $adb logcat -s Web Cascara Brujula
```

| Etiqueta | Qué trae |
|---|---|
| `Web` | **la consola del WebView**, o sea la interfaz entera, con archivo y línea |
| `Cascara` | el puente nativo: configuración, posiciones, brújula, fallos al evaluar JS |
| `Brujula` | cada rumbo calculado, con inclinación y declinación |

Esto no existía hasta el 25/08/2026 y **es la causa de fondo de que las cinco
fallas de la costura nativa-web costaran tanto**: MAUI no instala
`WebChromeClient`, y sin uno Android descarta los mensajes de consola en
silencio. Ver AD-31.

**Verificado andando el 28/08/2026** en el Xiaomi de prueba. La sospecha de que
MIUI filtraba los logs de terceros —que quedó anotada un día en la
documentación— **era falsa**: el 26/08 la app no pasaba de la pantalla de
conexión, así que no llegaba a ejecutarse ninguna línea que logueara. Ausencia de
salida no era ausencia de puente. Lo que lo descartó fue reproducir con el log
limpio (`logcat -c`, `am force-stop`, `am start`), no razonar mejor.

**Y no diagnostiques con `Debug.WriteLine`**: lleva `[Conditional("DEBUG")]`, el
compilador borra las llamadas en Release y los mensajes desaparecen justo en el
APK que se instala en el teléfono. Va `Android.Util.Log`.

### `dumpsys sensorservice` es el equivalente para la brújula

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb shell "dumpsys sensorservice | grep -B1 -A1 trucknavigator"
```

Tres secciones sirven, y conviene mirarlas en este orden:

- **`Sensor List`** dice qué trae el equipo. En el teléfono de prueba (Xiaomi
  `24117RN76L`, medido el 25/08/2026) están los tres que importan: `mmc5603`
  (`magnetic_field`), `rot_vec` (`rotation_vector`, 5–200 Hz) y `geo_rotvec`
  (`geomagnetic_rotation_vector`, el respaldo). Con giróscopo, así que el vector
  de rotación es el fusionado.
- **`Active sensors` / `Connection Number`** dice si la app está enganchada
  **ahora**: tiene que aparecer una conexión de `ar.com.trucknavigator.caba` con
  `rot_vec`. Si no aparece con el mapa abierto, el sensor nunca arrancó.
- **`Previous Registrations`** es el historial con hora, en formato
  `(sensor, package)`. Altas y bajas sin lecturas en el medio son la firma de un
  registro que falla.

---

## 5. Decisiones tomadas con el usuario

- **Móvil primero.** Se corrigió a mitad de camino: la versión web es el
  subproducto, no el objetivo. Diseño mobile-first, artefacto primario el APK.
- **Sin paso de compilación** en el frontend. Módulos ES nativos, sin npm ni
  empaquetador. No agregar uno sin motivo fuerte.
- **Dos registros de comunicación.** El usuario lleva producto y tiene
  conocimientos básicos; un programador lee el detalle. Toda devolución larga
  debe separar visiblemente ambos.
- **Verificar, no especular.** Textual: *"no quiero que especules, prefiero que
  busques y confirmes"*. Medir contra la fuente y decir la fecha.
- **Regla de acreditación de km aprobada.** Media duración estimada. Textual:
  *"preferible ese abuso antes que romper la app"*. Revisar en Fase 1 con el
  trazado del GPS.
- **Estética:** seria pero dopamínica. Resuelto como **dos intensidades**: el
  mapa es sobrio, la progresión trae el color. No es sólo estético — impide que
  lo gamificado se filtre a la pantalla que se mira manejando.
- **Identidad de git del repo:** `Tobias Bermejo <bermejotobias@gmail.com>`
  (verificado el 01/09/2026 con `git config user.name`; esta skill decía
  `bermejolautaro <tarolau97@hotmail.com>`, que es el dueño del remoto `hermano`).
- **Convención de código:** nombres de tipo **en inglés**, comentarios y docs en
  español, **sin acentos dentro de los `.cs`**. Rutas de API en inglés.

---

## 6. Trampas del entorno — releer antes de perder tiempo

### La máquina

- **Node 24.19 y npm 11.17 SÍ están instalados** (verificado el 26/08/2026; la
  nota anterior decía lo contrario y estaba vieja, y esa creencia costó no tener
  tests sobre el motor de guiado). No hay Python. **Ya hay 45 tests de JS**:
  `node --test "tests/web/*.test.mjs"`, con el runner que trae Node, **sin una
  sola dependencia** — no hay `node_modules` ni `npm install`, y el `wwwroot` que
  se sirve y se empaqueta es idéntico con o sin ellos. Ver AD-32. Cubren
  `navigation.js`, que es puro; los módulos que tocan el DOM quedan afuera porque
  necesitarían un DOM simulado, o sea una dependencia.
- **El SDK de Android puede perder la plataforma que el proyecto necesita.** El
  28/08/2026 el build murió con `XA5207: no se encuentra android.jar para el nivel
  API 36`: en `%LOCALAPPDATA%\Android\Sdk\platforms` sólo quedaba `android-37.0`,
  porque una actualización del SDK Manager reemplazó la 36. **No retargetear el
  proyecto para esquivarlo** —`targetSdk` cambia el comportamiento del servicio en
  primer plano y sus permisos (AD-24), y el workload instalado es el de la 36—. Se
  reinstala la que falta:

  ```powershell
  dotnet build src/TruckNavigator.Mobile -t:InstallAndroidDependencies -f net10.0-android `
    -p:AndroidSdkDirectory="$env:LOCALAPPDATA\Android\Sdk" -p:AcceptAndroidSDKLicenses=True
  ```

  Tarda ~30 s. No hay `sdkmanager` en `cmdline-tools/latest/bin`, así que este es
  el camino.

- **PowerShell 5.1**, sin `&&` ni operadores modernos.
- **`$PSScriptRoot` viene vacío dentro del bloque `param()`** → una ruta relativa
  con `..` se ancla en la raíz del disco y el script escribe en `C:\src\...`
  informando éxito. Calcular la ruta en el cuerpo, con `$PSCommandPath`.
- **`Select-Object -First N` corta el pipeline y MATA el proceso de arriba.** Se
  usó para acortar la salida de `build-apk.ps1` y PowerShell abortó la compilación
  a mitad de camino **saliendo con código 0**: parecía que había compilado, y se
  instaló el APK viejo. Para recortar salida sin cortar el proceso va
  `Out-String -Stream | Where-Object`, o `| Select-Object -First N` **después** de
  que el comando terminó.
- **PowerShell desenrolla los arrays anidados de un nivel.** `, $geometry.coordinates`
  no preserva la anidación de un polígono, y el síntoma fue "ninguna zona toca
  CABA" con el dato perfectamente bien. Escribir los casos aparte, y **poner un
  control del instrumento**: `fetch-zonas-riesgo.ps1` prueba cuatro puntos de
  coordenadas conocidas —Obelisco y Villa Soldati adentro, Avellaneda y Vicente
  López afuera— y **tira excepción** si el límite no los clasifica bien. Sin ese
  control, un filtro geográfico roto se ve igual que un dataset vacío.
- **Archivos con CRLF.** Los regex de perl con `$` al final o `\n` multilínea
  **no matchean**. Usar `\r?$`, o reconstruir el archivo con `head`/`sed`.
- **perl con acentos** rompe: `ó` son dos bytes y `(.)` matchea uno solo. Para
  texto acentuado usar `printf` con bytes explícitos o la herramienta de edición.
- **Heredocs de bash** pueden fallar con ciertos contenidos JS/C#. Ante un
  `unexpected EOF`, usar la herramienta de escritura directa.

### El navegador de la sesión

- **Sí compone frames y sí hay capturas** — la nota anterior decía lo contrario y
  quedó vieja. Pero `map.on('load')` puede no disparar y los clicks son poco
  confiables: para flujos largos conviene manejar la app por `javascript_tool`.
  Y el mapa **tarda en componer**: una captura tomada enseguida sale a medio
  dibujar y se lee como "el cambio no funcionó". Esperar y volver a capturar.
- **Cachea módulos ES agresivamente**, incluso con `no-cache`. Para probar un
  módulo recién editado, importarlo con `?f=<timestamp>`.
- **Límite de 30 s por ejecución.** Partir los flujos largos.
- **No avanza las animaciones CSS con el panel oculto: quedan congeladas en su
  primer frame.** Costó perseguir un desfase de 14 px que no existía: la hoja
  tiene `animation: sheet-in`, que arranca en `translateY(14px)`, y al medir
  aparecía siempre corrida hacia abajo. Anulando la animación caía exactamente
  donde debía. **Antes de perseguir una diferencia de pocos píxeles, fijarse si el
  elemento tiene animación de entrada.**
- **Las coordenadas de un `screenshot` envejecen.** Un clic por coordenada tomada
  de una captura anterior puede caer en el botón de al lado —pasó: cayó en
  *Cancelar* en vez de *Guardar*, y pareció que el alta estaba rota—. Para
  interactuar, `find` / `read_page` y clic **por `ref`**, que no se desplaza.

### Overpass

- Rate limit frecuente (429). Reintentar con espera; `https://overpass-api.de/api/status`
  informa los slots.
- El query va como **campo `data` de un formulario**, no como cuerpo crudo (si no, 406).
- Consultar contra el **límite administrativo** (`admin_level=4`), no un
  rectángulo: el rectángulo mete conurbano (501 pasos a nivel contra 312 reales).

### ASP.NET Core y MapLibre

- **No sirve extensiones desconocidas**: `.geojson` y `.pbf` dan 404 con el
  archivo en su lugar. Declarar el tipo MIME.
- **Sin `glyphs` MapLibre no dibuja ni una letra.** Fuentes vendorizadas en
  `wwwroot/fonts`, carpetas **sin espacios**.
- **`Style is not done loading`**: agregar capas antes de que cargue el estilo
  falla. Esperar `once('idle')`. Y **no envolver el alta de capas en el mismo
  `catch` que la descarga** — confundirlas oculta el problema.

### MapLibre: los marcadores y su `position`

La biblioteca le pone `position: absolute` al elemento del marcador y lo ubica por
`transform`. **Declararle `position: relative` se lo pisa** y el marcador se cae
del mapa: queda apilado en el flujo del contenedor junto a los demás pines. Con un
solo marcador en pantalla la posición coincide igual, así que no se nota hasta que
hay dos. Para apilar cosas adentro de un marcador —un cono debajo de un punto— va
una grilla con `grid-area: 1 / 1`, no `position: absolute`.

### Android

- `targetSdk 36`. Un servicio en primer plano necesita
  `FOREGROUND_SERVICE_LOCATION`, `foregroundServiceType="location"` en el
  manifiesto **y** el tipo en `startForeground(...)`. Falta alguno → compila
  igual y el sistema lo mata.
- **No existe servicio en primer plano sin notificación.** No es opcional.
- El WebView sirve desde un **origen virtual `https`** → todo pedido al backend
  es cross-origin (CORS) y contenido mixto. Ambos hay que habilitarlos.
- **`_framework/hybridwebview.js` tiene que estar en el `index.html`.** Sin él no
  existe `window.HybridWebView`, la app cree estar en un navegador y le pega al
  origen virtual: **404 en todo**. Servido por HTTP ese archivo da 404 y está bien.
- **La página pide la configuración con `ready`**; el nativo no la empuja. El
  chequeo de conexión tarda menos que la carga del WebView y el mensaje se pierde.

---

## 7. Cómo levantar todo

```powershell
cd routing; .\run-graphhopper.ps1        # motor de ruteo en :8989
dotnet run --project src/TruckNavigator.Api   # backend + web en :5080
dotnet test                              # 173 tests (.NET)
node --test "tests/web/*.test.mjs"       # 45 tests de JS
.\build-apk.ps1 -Push                    # APK de Release al teléfono
.\data\fetch-caba-map-layers.ps1         # regenera las capas del mapa
```

**Para probar desde el teléfono el backend debe escuchar en `0.0.0.0`**, no en
`localhost`. Sin `ASPNETCORE_URLS` usa el `appsettings` (`0.0.0.0:5080`), que es
lo correcto.

- El mail **no se envía** (sin SMTP): el enlace de verificación aparece en el log
  del backend. En `Production` el arranque corta si falta SMTP.
- **Cuenta de prueba en desarrollo**: `demo@camiones.test` / `camion2026`, sembrada
  por `DevUserSeed` sólo en `Development`. Mail confirmado y perfil completo
  (alias `demo`): entra directo al mapa sin buscar el enlace en el log.
- **La IP de la máquina cambia todo el tiempo. Verificarla SIEMPRE**, es lo
  primero de cada sesión:

  ```powershell
  (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -eq 'Dhcp' }).IPAddress
  ```

  Historial medido: `192.168.100.106` (24/08) → `192.168.1.78` (25/08) →
  `192.168.100.106` (26/08, a mitad de una sesión de pruebas) → `192.168.1.52`
  (28/08). La app deja corregirla desde *Configurar servidor*, y
  `network_security_config.xml` permite HTTP en claro a cualquier dirección, así
  que **no obliga a recompilar** — pero recompilar con `-ApiUrl` es más cómodo y
  se instala solo.

- **La regla de firewall `TruckNavigator API 5080 (dev)` está limitada a una
  subred**, y el 28/08 seguía apuntando a `192.168.100.0/24` estando la máquina en
  `192.168.1.x`. **Aun así el teléfono llegaba**, así que no dar por hecho que
  bloquea: medirlo con `toybox nc` antes de perseguir ese fantasma.
  Cambiar la regla es configuración de seguridad del sistema: pedírselo al
  usuario, no hacerlo.

- **Con el teléfono por USB hay un camino que no depende de la red ni del
  firewall**: `adb reverse tcp:5080 tcp:5080` y configurar la app con
  `http://127.0.0.1:5080`. Sirve para probar de escritorio; para manejar hace
  falta la IP de red.
- **`adb` está en `%LOCALAPPDATA%\Android\Sdk\platform-tools`**, no en el SDK de
  Visual Studio. `build-apk.ps1 -Push` busca en ambos desde el 25/08/2026.
- **El túnel de `demo-up.ps1`: si el hostname no resuelve, reabrirlo.** Confirmado
  el 25/08/2026. El DNS del ISP (vía router `192.168.1.1`) devolvió **NXDOMAIN**
  para el hostname nuevo de `trycloudflare.com`, mientras 1.1.1.1 y 8.8.8.8 sí lo
  resolvían — y `ipconfig /flushdns` no lo arregló, porque el caché negativo está
  río arriba. **Matar `cloudflared` y relanzarlo dio otro nombre que resolvió al
  instante.** Para separar DNS de conectividad sin adivinar:
  `curl --resolve <host>:443:104.16.230.132 https://<host>/api/health` — si eso
  responde, el túnel está bien y el problema es sólo de nombres.
  `cloudflared` se instala con `winget install --id Cloudflare.cloudflared` y
  queda en `C:\Program Files (x86)\cloudflared\`, que es donde el script lo busca.
- **`routing/config-truck.yml` apunta en el árbol de trabajo a
  `argentina-latest.osm.pbf`** y no a `amba-latest.osm.pbf` como en el commit: el
  recorte del AMBA no está en disco. Sin ese cambio local GraphHopper no arranca.

---

## 8. Lo que sigue

**Ya no hay nada de la Fase 1 que se pueda construir acá.** Lo único que queda es
probarla en movimiento, y eso es del usuario. Orden que más rápido descarta
problemas: ¿carga la interfaz? → ¿el GPS ubica? → **¿el dial de la brújula marca
bien con el teléfono en el soporte?** → ¿aparece la notificación al arrancar el
viaje? → **¿avanza la flecha tras apagar la pantalla un minuto?** → ¿habla en los
giros? → **¿vibra, y se distingue el patrón del gálibo del de doblar?**

Y el log, que es lo que va a decir dónde atacar sin tener que reproducir:
`adb logcat -s Web Cascara Brujula`.

**Acordado con el usuario el 01/09/2026**, después de un repaso del proyecto:

1. **L-11 — el aviso de que saliste de CABA.** Ninguna capa propia existe pasando
   la General Paz o el Riachuelo y la app no lo dice: Dock Sud se ve igual que un
   barrio sin registros. Es la regla de la casa incumplida por omisión, y mejora
   la prueba en calle. ~30 min.
2. **Fase 3 · los 3 contactos de emergencia.** Es lo que sigue en la prioridad
   declarada y lo más limpio de arrancar: la pantalla de Emergencia **ya existe**
   con un cartel que dice *"todavía en camino"* (`app.js`, `emergencyView`), y el
   discador nativo ya funciona por el puente. Falta perfil + endpoint + pantalla.
   **Cero acoplamiento con la navegación**: se puede construir sin esperar la
   prueba en calle.

**Deliberadamente para después:**

- **Compartir viaje por WhatsApp** — misma fase, pero necesita endpoint público de
  seguimiento, tokens que venzan y decisiones de privacidad. Es un trabajo grande
  disfrazado de botón.
- **Fase 5 (reportes) y POIs valorados** — bloqueadas por decisiones del usuario,
  no por código: cuánto dura un reporte, cuántas confirmaciones lo validan, qué
  pasa con los falsos.
- **Los cinco juegos** — proyecto aparte. Elegir uno, hacerlo bien, y recién ahí
  ver.

**Las zonas peligrosas están hechas, y NO salen del dato oficial.** Esta skill
afirmó primero que no había fuente, después que era el Mapa del Delito del GCBA, y
las dos veces se equivocó. Lo vigente: el **mapa colaborativo del AMBA**, 19 zonas
que tocan CABA, 8,8 km², el 4,3% de la Ciudad. El dato oficial se probó y **se
descartó**: contar hechos mide dónde hay gente —Palermo encabezaba la Ciudad— y
como el dataset cubre exactamente CABA, el mapa de calor dibujaba la silueta del
límite administrativo. Ver AD-36 y `data-sources.md` §7.

---

## 9. La regla que gobierna todo

**Donde falta el dato, se dice que falta.** No se rellena.

Está en el código (`bool?` de tres estados para aptitud), en el generador de
capas (`maxheight=default` no es una altura; barrera sin declarar no es barrera
ausente), y en la documentación (L-1 a L-11). Es lo que hace auditable al sistema
y defendible al producto frente a Waze y Google Maps.

Si hace falta un dato que no existe: **decirlo, no rellenarlo.**

---

## 10. Comandos de datos y mapa

```powershell
.\data\build-basemap.ps1             # mapa base del AMBA (53 MB) -> routing/amba.pmtiles
.\data\fetch-caba-map-layers.ps1     # Red, gálibos y sapitos -> wwwroot/data/*.geojson
.\data\fetch-radares-velocidad.ps1   # 129 cinemómetros, dato oficial del GCBA
.\data\fetch-zonas-riesgo.ps1        # zonas peligrosas, del mapa comunitario del AMBA
```

**Los radares salen de Buenos Aires Data** (oficial, CC-BY), no de OSM: otra
licencia y otra cadencia, y por eso vive en un script propio. **Las zonas
peligrosas salen del KML de un mapa colaborativo**, que no es oficial y no tiene
grados: hay dos estados, marcada y no marcada, y **la app nunca dice "zona
segura"** — que un lugar no aparezca significa que nadie lo marcó.

**El heatmap se alimenta con PUNTOS, nunca con una grilla.** Normaliza por
densidad de puntos: con una grilla regular la redibuja como lunares alineados, y
agrandar el radio sólo da lunares más grandes. El script rellena cada zona con
puntos cada 60 m y los publica en **un solo MultiPoint** — la envoltura de miles
de features pesa más que las coordenadas.

**El encoding cambia según el portal y hay que verificarlo, no suponerlo.** El CSV
de cámaras viene en **Latin-1**; los datasets del portal de delitos, en **UTF-8**;
Overpass no declara charset y PowerShell 5.1 lo asume ISO-8859-1. Cada uno costó
su tanda de mojibake.

El **mapa base no se versiona ni entra en el APK** y se sirve bajo `/tiles`; si
falta, el mapa cae al raster de OSM con un aviso en consola. Las **capas de
camión sí se versionan** (761 KB) y viajan dentro del APK.

**Al estilar el mapa, verificar los valores de `kind`, no suponerlos.** El
esquema de Protomaps usa `highway`, `major_road`, `minor_road`, `other`, `path`:
no existe `medium_road`. Una rama con un valor inexistente no da error, sólo no
coincide nunca.
