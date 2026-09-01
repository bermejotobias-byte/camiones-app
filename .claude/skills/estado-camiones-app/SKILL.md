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

**Rama de trabajo:** `cuentas-de-usuario` (12 commits sobre `main`). **El último
commit todavía no está empujado.**

---

## 2. Dónde está la verdad

**Leer siempre antes de decidir algo.** No duplicar su contenido acá.

| Documento | Qué tiene |
|---|---|
| `CLAUDE.md` | Convenciones, comandos, **trampas que ya costaron tiempo** |
| `docs/decisions.md` | **34 decisiones arquitectónicas (AD-01…AD-34)** con su porqué |
| `docs/data-sources.md` | Fuentes, licencias y limitaciones **L-1…L-8** (L-4 ya resuelta) |
| `docs/architecture.md` | Estructura y proyectos |
| `docs/routing.md`, `docs/restrictions.md`, `docs/pois.md`, `docs/deploy.md` | Por tema |
| `PLAN.md` | Especificación original del MVP |
| **skill `producto-camiones-app`** | **El alcance completo**: los dos brainstorms unificados y asignados a fase |
| Escritorio del usuario | `PUNTOS A TRABAJAR…docx` (33 requisitos, 22/08) y `ideas camionero app v2.docx` (31/08). Están **abiertos en Word**: para leerlos hay que copiarlos antes, si no el archivo está bloqueado |

**Las AD-17 a AD-34 son del trabajo reciente.** Las cinco últimas, del 25–26/08/2026:

| AD | Qué resuelve | Por qué importa releerla |
|---|---|---|
| **AD-30** | Brújula del magnetómetro | Por qué NO se usa `Compass` de MAUI: se degenera con el teléfono en un soporte |
| **AD-31** | Consola del WebView y diagnósticos a logcat | `Debug.WriteLine` se **borra en Release**: los diagnósticos no existían en el APK |
| **AD-32** | 28 tests de JS con el runner de Node | Cero dependencias; no contradice AD-21 |
| **AD-33** | Una dirección mal escrita dejaba la app **inutilizable** | Cuatro fallas encadenadas; la lección se generaliza a cualquier valor persistido |
| **AD-34** | Cámara cenital fija fuera del viaje, zoom con botones | Incluye la capa de botones comiéndose los toques del mapa |

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
| **1 · Navegación** | 🔨 Probada en el teléfono parado; **sin probar manejando**. El v2 le suma legibilidad de calles, vibración y rutas alternativas |
| **2 · Usabilidad** | ✅ Completa — salió adelantada dentro de la mudanza del frontend |
| **3 · Seguridad** | ⬜ Sólo está el 911. Faltan 3 contactos, compartir viaje, S.O.S. en el reporte y las zonas peligrosas |
| **4 · Info para camiones** | 🔨 **Reabierta por el v2** — estaban las capas y el mapa base; ahora suma radares, POIs valorados, avenidas destacadas y modo reparto |
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
a587041  Actualiza la skill: el checkpoint y que config-truck.yml no se commitea
1b5cd5a  Zonas de riesgo y radares en el mapa, simbolos que se entienden, y un APK que se puede actualizar
```

**`1b5cd5a` es el checkpoint del 01/09/2026.** Cubre:

- **Zonas de riesgo** desde el Mapa del Delito del GCBA (AD-36, `data-sources.md` §7).
  Cuentan **robos a mano armada**, no cantidad de robos: contar cantidad mide cuánta
  gente circula y daba vuelta el resultado —Palermo primero, Villa Soldati como "la
  más segura"—. Mapa de calor sobre los 5.551 hechos crudos.
- **Radares de velocidad**, dato oficial, sólo los 129 cinemómetros.
- **Rediseño de los símbolos del mapa**: chapas con señales reconocibles, y de un
  racimo sobrevive el peor gálibo, no uno cualquiera.
- **Firma estable del APK** (AD-35): se puede actualizar sin desinstalar.
- **Encoding de Overpass** arreglado: se acabó el `RAÚL R. A` con basura.
- L-9, L-10 y L-11 documentadas.

**`5fb0ef3` es el checkpoint anterior, del 26/08/2026** —la skill lo llamaba
`029794e`, hash que ya no existe— y junta dos bloques: el trabajo que había
quedado sin commitear (AD-27 a AD-29 — viaje abierto en el servidor, proveedor
combinado de ubicación, cuenta de prueba sembrada) y el de esa sesión (AD-30 a
AD-34). Comparten archivos, así que separarlos no habría dado un corte honesto.

**`routing/config-truck.yml` quedó deliberadamente fuera del commit**: el árbol de
trabajo apunta a `argentina-latest.osm.pbf` porque el recorte del AMBA no está en
disco, y sin ese cambio local GraphHopper no arranca. Va a seguir apareciendo como
modificado en cada `git status`; **no commitearlo**.

---

## 4. Qué está verificado — y qué NO

**Distinción crítica.** Mucho está probado a fondo; una franja específica no se
pudo probar y hay que decirlo cada vez.

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
- **Backend completo**: 85 tests de dominio y utilidades + 46 de integración (11 contra
  GraphHopper real). Flujos end-to-end por HTTP: alta, verificación, login,
  perfil, alias único, camiones, propiedad, viajes, acreditación de km.
- **Datos del mapa**: medidos contra Overpass el 24/08/2026, dentro del límite
  administrativo de CABA.

### NO verificado

- **Navegación manejando.** Nunca se probó en movimiento. Pendiente para cerrar
  Fase 1: que la flecha siga al camión, que hable en los giros, que el servicio
  sobreviva a apagar la pantalla.
- **La brújula en el soporte del camión.** El usuario la probó en el teléfono el
  26/08/2026 y reportó que **funciona** —dial, cardinal y cono—, pero con el
  aparato en la mano. Falta el caso que motivó no usar `Compass` de MAUI: el
  teléfono **parado en un soporte de parabrisas** (AD-30). Ahí es donde el eje
  cambia, y ahí es donde se sabrá si el trabajo extra valió la pena.
- **La app en el teléfono, salvo lo que reportó el usuario.**
- **Las zonas de riesgo, los radares y el rediseño de los símbolos del mapa** se
  verificaron **en el navegador, no en el APK** — el teléfono no estaba conectado
  el 01/09/2026. **Es lo primero a chequear la próxima vez que se enchufe**, y no
  es trámite: en el WebView de Android el mapa de calor pasa por la GPU del
  teléfono, no por la de la máquina de desarrollo.
- **El pedido de las zonas era estético y se resolvió por el lado del dato.** El
  usuario pidió inspirarse en el mapa de Google Maps que compartió, y el trabajo
  se fue a la metodología —qué contar, cómo normalizar— antes que al aspecto. El
  resultado quedó aprobado, pero la lección aplica a lo que venga: **cuando el
  pedido es visual, la referencia visual manda.**

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
- **Identidad de git del repo:** `bermejolautaro <tarolau97@hotmail.com>`.
- **Convención de código:** nombres de tipo **en inglés**, comentarios y docs en
  español, **sin acentos dentro de los `.cs`**. Rutas de API en inglés.

---

## 6. Trampas del entorno — releer antes de perder tiempo

### La máquina

- **Node 24.19 y npm 11.17 SÍ están instalados** (verificado el 26/08/2026; la
  nota anterior decía lo contrario y estaba vieja, y esa creencia costó no tener
  tests sobre el motor de guiado). No hay Python. **Ya hay 28 tests de JS**:
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
- **Archivos con CRLF.** Los regex de perl con `$` al final o `\n` multilínea
  **no matchean**. Usar `\r?$`, o reconstruir el archivo con `head`/`sed`.
- **perl con acentos** rompe: `ó` son dos bytes y `(.)` matchea uno solo. Para
  texto acentuado usar `printf` con bytes explícitos o la herramienta de edición.
- **Heredocs de bash** pueden fallar con ciertos contenidos JS/C#. Ante un
  `unexpected EOF`, usar la herramienta de escritura directa.

### El navegador de la sesión

- **No compone frames** → `map.on('load')` nunca dispara, no hay screenshots, los
  clicks son poco confiables. Manejar la app por `javascript_tool`.
- **Cachea módulos ES agresivamente**, incluso con `no-cache`. Para probar un
  módulo recién editado, importarlo con `?f=<timestamp>`.
- **Límite de 30 s por ejecución.** Partir los flujos largos.

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
dotnet test                              # 131 tests (.NET) + 28 de JS
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

**Inmediato:** cerrar Fase 1 probando en movimiento. Orden que más rápido
descarta problemas: ¿carga la interfaz? → ¿el GPS ubica? → **¿el dial de la
brújula marca bien con el teléfono en el soporte?** → ¿aparece la notificación al
arrancar el viaje? → **¿avanza la flecha tras apagar la pantalla un minuto?** →
¿habla en los giros?

**Fase 4 está cerrada.** El mapa base propio en PMTiles resolvió el minimalismo,
el día/noche del fondo y **L-4** — ya no se depende de `tile.openstreetmap.org`
(AD-26).

**Después:** Fase 3 (seguridad: pánico con 3 contactos, compartir viaje), modo
reparto, Fase 5 (comunidad y gamificación), i18n.

**Las zonas peligrosas YA tienen fuente oficial y están hechas** (01/09/2026).
Esta skill decía que no la había: era falso. El **Mapa del Delito del GCBA** es
CC-BY, trae 133.203 hechos de 2025 con coordenadas y se publica por año. Ver
AD-36 y `data-sources.md` §7.

**Lo que sí falta es cobertura fuera de CABA (L-11).** Ninguna capa propia existe
pasando la General Paz o el Riachuelo, y la app **no lo dice**: Dock Sud se ve
igual que un barrio sin registros. Es la regla del proyecto incumplida por
omisión, y sube de prioridad cuando se sume el AMBA — que el usuario confirmó
como objetivo, con la información en recopilación y **explícitamente para más
adelante**.

---

## 9. La regla que gobierna todo

**Donde falta el dato, se dice que falta.** No se rellena.

Está en el código (`bool?` de tres estados para aptitud), en el generador de
capas (`maxheight=default` no es una altura; barrera sin declarar no es barrera
ausente), y en la documentación (L-1 a L-8). Es lo que hace auditable al sistema
y defendible al producto frente a Waze y Google Maps.

Si hace falta un dato que no existe: **decirlo, no rellenarlo.**

---

## 10. Comandos de datos y mapa

```powershell
.\data\build-basemap.ps1             # mapa base del AMBA (53 MB) -> routing/amba.pmtiles
.\data\fetch-caba-map-layers.ps1     # Red, gálibos y sapitos -> wwwroot/data/*.geojson
.\data\fetch-radares-velocidad.ps1   # 129 cinemómetros, dato oficial del GCBA
.\data\fetch-zonas-riesgo.ps1        # zonas de riesgo, del Mapa del Delito del GCBA
```

Los dos últimos salen de **Buenos Aires Data**, no de OSM: otras licencias, otras
cadencias, y por eso viven en scripts propios. `fetch-zonas-riesgo.ps1` acepta
`-Anio` y `-LadoMetros`, y reusa la descarga si ya está en el temporal.

**El encoding cambia según el portal y hay que verificarlo, no suponerlo.** El CSV
de cámaras viene en **Latin-1**; el de delitos, en **UTF-8**; Overpass no declara
charset y PowerShell 5.1 lo asume ISO-8859-1. Cada uno costó su tanda de mojibake.

El **mapa base no se versiona ni entra en el APK** y se sirve bajo `/tiles`; si
falta, el mapa cae al raster de OSM con un aviso en consola. Las **capas de
camión sí se versionan** (761 KB) y viajan dentro del APK.

**Al estilar el mapa, verificar los valores de `kind`, no suponerlos.** El
esquema de Protomaps usa `highway`, `major_road`, `minor_road`, `other`, `path`:
no existe `medium_road`. Una rama con un valor inexistente no da error, sólo no
coincide nunca.
