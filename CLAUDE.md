# CLAUDE.md

Contexto del proyecto para Claude Code. El proyecto y su documentación están en
español: escribí código, comentarios, commits y respuestas en español.

## Qué es

Navegación para camiones en CABA que calcula rutas **según las características físicas y
regulatorias del vehículo**. La restricción forma parte del cálculo, no es una advertencia
posterior: los tramos por los que ese camión no puede circular reciben prioridad cero en el
custom model de GraphHopper antes de que el algoritmo elija por dónde ir.

Fuente regulatoria: Ley 2148 de CABA (Red de Tránsito Pesado, art. 9.10.1). Mapa base
OpenStreetMap — nunca Google Maps ni Waze, ni datos derivados de ellos.

## Estructura

| Proyecto | Rol |
|---|---|
| `src/TruckNavigator.Domain` | Motor de restricciones, ruteo, POIs y perfiles. **Sin dependencias externas** — mantenerlo así |
| `src/TruckNavigator.Infrastructure` | EF Core + SQLite, cliente GraphHopper, geocoding (Photon), datasets |
| `src/TruckNavigator.Api` | ASP.NET Core Minimal API en `:5080` **y la app web en `wwwroot`**. `/api/health`, `/api/auth`, `/api/profile`, `/api/trucks`, `/api/trips`, `/api/places`, `/api/pois`, `/api/routes`. Swagger en `/swagger` |
| `src/TruckNavigator.Mobile` | .NET MAUI Android. **Cáscara**: hospeda la app web de `Api/wwwroot` en un `HybridWebView` y le aporta URL del backend, GPS y discador |
| `tests/TruckNavigator.UnitTests` | 85 tests: 65 de dominio + 20 de la direccion del backend, que se enlaza desde Mobile |
| `tests/TruckNavigator.IntegrationTests` | 46 tests: 11 contra GraphHopper (se saltean solos si no está levantado) + 35 sobre datasets, perfiles, camiones, viajes y SQLite |

Solución: `TruckNavigator.slnx`.

## Requisitos

- .NET SDK 10
- Microsoft OpenJDK **21** — `winget install --id Microsoft.OpenJDK.21`.
  .NET Android soporta JDK 17–21; **con el 22 el build falla**.
- `dotnet workload restore` para los workloads de MAUI

## Comandos

```powershell
cd routing; .\run-graphhopper.ps1              # motor de ruteo en :8989 (1ª vez baja ~450 MB)
.\data\build-basemap.ps1                       # mapa base vectorial del AMBA (53 MB, no se versiona)
.\data\fetch-caba-map-layers.ps1               # Red, gálibos y pasos a nivel (sí se versionan)
dotnet run --project src/TruckNavigator.Api    # backend + web en :5080, migra y siembra al arrancar
dotnet test                                    # 131 tests (.NET)
node --test "tests/web/*.test.mjs"             # 28 tests del motor de guiado
.\build-apk.ps1 -Push                          # APK de Release + copia a Descargas por adb
.\demo-up.ps1                                  # GraphHopper + API + túnel Cloudflare (HTTPS público)
.\demo-down.ps1                                # baja todo lo anterior
```

## Trampas que ya costaron tiempo

- **APKs de Release: siempre con `build-apk.ps1`.** Una compilación incremental en Release
  produce un APK que aborta al arrancar con *"Compressed assembly is larger than when the
  application was built"*. El script limpia `obj/` y `bin/` antes de compilar, que es lo que
  lo evita. Usá `-ApiUrl` para fijar el backend en vez de editar
  `TruckNavigatorApi.DefaultBaseUrl` a mano.
- **Los artefactos pesados de `routing/` no están en el repo**: el JAR de GraphHopper (45 MB),
  `argentina-latest.osm.pbf` (407 MB) y `graph-cache/` los baja y construye
  `run-graphhopper.ps1` en el primer arranque. Tampoco está el APK compilado.
- **Un valor que el usuario escribe y la app guarda se valida AL ESCRIBIRLO, y tiene que
  poder deshacerse sin conocer el valor original.** Una dirección de servidor sin `http://`
  dejó la app muerta: se guardaba sin validar, `HttpClient` tiraba antes de salir a la red,
  el valor guardado le ganaba al compilado **y sobrevivía a reinstalar**. Hoy lo valida
  `BackendAddress.TryNormalize` (con 20 tests), el getter ignora lo guardado si es inválido,
  el arranque prueba la dirección de fábrica antes de rendirse, y hay un botón para volver a
  ella. Ver AD-33.
- **Nunca mostrar `ex.Message` de una excepción del framework**: el recorte de Release
  reemplaza esos textos por claves de recurso, así que al usuario le llega algo como
  `net_http_client_invalid_requesturi`. El csproj ahora trae
  `UseSystemResourceKeys=false` para que vuelvan a leerse, pero igual va una frase propia;
  el **nombre del tipo** de la excepción sí sobrevive al recorte y se puede mostrar.
- **La URL del backend no se edita a mano**: se cambia desde *Configurar servidor* en la
  pantalla de camiones, sin recompilar, o con `build-apk.ps1 -ApiUrl`. El valor de fábrica es
  `TruckNavigatorApi.DefaultBaseUrl` (`src/TruckNavigator.Mobile/Services/TruckNavigatorApi.cs`),
  hoy una URL de túnel Cloudflare de una demo vieja: los túneles cambian en cada arranque, así
  que ese default está muerto salvo que se regenere con `demo-up.ps1`.
- **HTTP plano desde el teléfono** está habilitado sólo para la IP de desarrollo, en
  `Platforms/Android/Resources/xml/network_security_config.xml`.
- **El mapa base es un archivo propio**: `routing/amba.pmtiles`, generado por
  `data/build-basemap.ps1` y servido bajo `/tiles`. **No se versiona ni entra en el APK**
  (53 MB). Si falta, el mapa cae al raster de OSM con un aviso en consola. Los valores de
  `kind` del esquema hay que verificarlos, no suponerlos: no existe `medium_road`. Ver AD-26.
- **Las capas de camión son dataset propio**: `data/fetch-caba-map-layers.ps1` las genera desde
  OSM a `wwwroot/data/*.geojson`. Ningún proveedor de tiles trae `hgv`, `maxheight` ni pasos a
  nivel. `maxheight=default` NO es una altura y queda afuera; barrera sin declarar NO es "sin
  barrera". Ver AD-25.
- **Sin `glyphs` MapLibre no dibuja texto**: las fuentes están vendorizadas en `wwwroot/fonts`.
  Y ASP.NET Core no sirve `.geojson` ni `.pbf` salvo que se declaren sus tipos MIME: dan 404
  con el archivo en su lugar.
- **El GPS en segundo plano es un `Service` de Android tipo `location`**, activo sólo mientras
  dura el viaje. Android **exige** notificación: no existe servicio en primer plano sin ella.
  Con `targetSdk 36` hacen falta `FOREGROUND_SERVICE_LOCATION`, el `foregroundServiceType` en
  el manifiesto **y** el tipo en `startForeground(...)`; si falta alguno compila igual y el
  sistema mata el servicio en el teléfono. Ver AD-24.
- **La ubicación sale del proveedor combinado de Google**, no del `LocationManager`: el GPS
  crudo tarda decenas de segundos bajo techo y el `NetworkProvider` **puede estar
  deshabilitado** en el teléfono (medido así en el equipo de prueba). El `LocationManager`
  queda de respaldo. La última posición conocida se empuja primero, con tope de 10 minutos
  medidos con el reloj monótono. Esto obliga a **`minSdk 23`**. Ver AD-29.
- **La pantalla de viaje no puede depender del primer fix**: la cámara se inclina al tocar
  *Arrancar*, y mientras no hay posición se dice "Buscando señal de GPS…". Antes no pasaba
  nada visible hasta que el GPS enganchara y la app parecía trabada. Ver AD-29.
- **La brújula no puede usar `Compass` de MAUI**: entrega el azimut del eje largo del
  teléfono, que **se degenera con el aparato parado en un soporte** —o sea, como se usa en
  un camión—. Se leen los sensores crudos y se elige el eje según la inclinación, con
  histeresis para que no alterne. El norte magnético **no** es el del mapa: la declinación
  la calcula `GeomagneticField` con la posición, no se fija como constante. Y el rumbo se
  filtra antes de cruzar el puente: el sensor da dieciséis lecturas por segundo y cada una
  es una evaluación de JavaScript. Ver AD-30.
- **Un marcador de MapLibre no tolera que le pisen el `position`**: la biblioteca le pone
  `absolute` y lo ubica por `transform`. Declarar `position: relative` en el elemento del
  marcador lo saca del mapa —queda apilado en el flujo del contenedor—, y **con un solo
  marcador en pantalla la posición coincide igual**, así que no se nota hasta que hay dos.
  Para apilar cosas adentro de un marcador va una grilla, no `position: absolute`.
- **Adentro del APK hay log: `adb logcat -s Web Cascara Brujula`.** `Web` es la consola
  del WebView —la interfaz entera—, `Cascara` es el puente nativo y `Brujula` cada rumbo
  calculado. Antes nada de eso se veía. Y **no usar `Debug.WriteLine` para diagnosticar**:
  lleva `[Conditional("DEBUG")]`, así que el compilador borra las llamadas en Release, o sea
  que los mensajes desaparecen justo en el APK que se instala en el teléfono. Va
  `Android.Util.Log`. Ver AD-31.
- **`confirm()` y `alert()` no existen adentro de la app Android**: el WebView no dibuja
  diálogos de JavaScript sin un `WebChromeClient` que los atienda, y MAUI no instala
  ninguno — `confirm()` devuelve `false` sin mostrar nada y el botón parece no responder.
  Para pedir una decisión va `askChoice`/`askConfirm` de `ui.js`. Ver AD-28.
- **El viaje en curso vive en el servidor, no en la pantalla**: sobrevive a cerrar la app.
  La app lo recupera con `GET /api/trips/active` al entrar; sin eso arranca creyendo que no
  hay viaje y el usuario se choca con un 409 al arrancar el siguiente, sin ningún viaje a la
  vista que cerrar. La ruta de esa respuesta puede venir nula —motor caído, camión borrado—
  y aun así hay que dejar cerrar el viaje. Salir del viaje tiene que apagar la navegación:
  si no, el servicio de GPS de Android sigue vivo con su notificación. Ver AD-27.
- **La navegación depende de `sign` e `interval`** de GraphHopper: el `Kind` de la maniobra y
  el punto donde ocurre. El parser los descartaba y no se notaba, porque la ruta se dibuja
  igual. Si se tocan las instrucciones, los tests de `NavigationInstructionsTests` lo cubren.
- **La ventana de búsqueda del motor va en metros, no en segmentos**: la ruta se cruza consigo
  misma —hay tramos a 19 m de distancia separados por 2,6 km de recorrido— y contada en
  segmentos el motor salta al tramo equivocado y no vuelve. Ver AD-23.
- **La app Android no tiene interfaz propia**: es una cáscara sobre `Api/wwwroot`, enlazado
  como `MauiAsset` (no copiado). Si la app queda en blanco en el teléfono, los sospechosos son
  CORS y contenido mixto: el WebView sirve desde un origen `https` virtual y el backend es
  `http` plano. Ver AD-22.
- **La interfaz no tiene paso de compilación**: `src/TruckNavigator.Api/wwwroot` son módulos ES
  nativos servidos tal cual. No agregar npm ni empaquetador sin motivo: el mismo bundle
  tiene que poder empaquetarse dentro de la app Android sin coordinar dos builds. Ver AD-21.
- **Los contenedores de la capa de botones del mapa van con `pointer-events: none`.** Son
  cajas invisibles que ocupan **todo el ancho** aunque adentro haya un botón de 48 px pegado
  a un borde: con `auto` se comen el arrastre y el pellizco en toda esa franja, y no hay nada
  visible que lo explique. `none` en los contenedores (`.map-overlay`, `.map-top`,
  `.map-side`, y el espaciador `.grow`), `auto` sólo en los controles concretos. **Cada
  control que se agregue a la columna agranda la zona muerta si esto se rompe.** Ver AD-34.
- **Fuera del viaje la cámara no se inclina ni gira, y el zoom es del usuario.** Los gestos
  de rotación e inclinación están apagados en `createMap`: en un teléfono salen sin querer y
  dejan el mapa torcido sin forma evidente de enderezarlo. `flyTo` **no cambia el zoom**
  salvo `minZoom`, que sólo acerca y usa únicamente *Mi ubicación*. La perspectiva se aplica
  con `easeTo` desde `enterNavigationMode`, que no pasa por esos manejadores, así que
  apagarlos no la rompe. Los botones + / − se esconden durante el viaje porque la cámara
  sigue al vehículo y deshace cualquier zoom manual. Ver AD-34.
- **El mapa se dibuja después de que el estilo cargue**: `drawRoute` reintenta con `once("idle")`
  si `isStyleLoaded()` es falso. Sin eso la ruta no aparece, de forma intermitente.
- **SQLite no ordena por `DateTimeOffset`**: los instantes se guardan como ticks UTC con un
  `ValueConverter` en `AppDbContext`. Sin eso, listar el historial tira `NotSupportedException`
  y el endpoint devuelve 500. Al agregar una fecha nueva, aplicarle el conversor. Ver AD-20.
- **Los camiones tienen dueño**: `OwnerId` nulo es una **plantilla del catálogo**, que ve
  todo el mundo y no edita nadie. Leer camiones es anónimo; crear, editar y borrar piden
  sesión, así que **la app Android da 401 al crear un camión** hasta que tenga login. El
  ruteo del demo no se rompe porque usa plantillas. Ver AD-19.
- **Sin SMTP configurado no se manda ningún mail**: el enlace de verificación va al log
  del backend, que es lo que permite probar el alta en desarrollo. En `Production` el
  arranque **corta con excepción** si la sección `Email` está vacía. Ver AD-17.
- **En desarrollo hay una cuenta de prueba sembrada**: `demo@camiones.test` / `camion2026`,
  con el mail ya confirmado y el perfil completo, así que entra directo al mapa. La siembra
  `DevUserSeed` y **sólo corre en `Development`** — ir a buscar el enlace de verificación al
  log de la consola no sirve cuando se prueba desde el teléfono. Es idempotente: no pisa la
  cuenta si ya está.
- **El alias es único y no distingue mayúsculas**: el formato lo valida `DriverAlias` en el
  dominio, la unicidad la garantiza un índice único sobre `NormalizedAlias`. La consulta
  previa del endpoint es sólo para dar un mensaje claro, no es la garantía. Ver AD-18.
- **No inventar datos ni normas.** Donde falta información se dejó explícito y documentado:
  la capa oficial del GCBA no está publicada (L-1), no se modelan restricciones horarias
  porque no se encontró norma general confirmada (L-2), playas de camiones y auxilio pesado
  casi no tienen fuente (L-5), la aptitud para camión está indeclarada en 75 de 78 POIs (L-6).
  Ver `docs/data-sources.md`. Si hace falta un dato que no existe, decilo — no lo rellenes.
- **`docker-compose.yml` de la raíz no se usa en el MVP**: es PostGIS preparado para la
  siguiente iteración. El MVP corre sobre SQLite (AD-06 en `docs/decisions.md`).

## Documentación

`PLAN.md` es la especificación original del MVP. Después:

| Documento | Contenido |
|---|---|
| `docs/architecture.md` | Estructura, proyectos, extensibilidad |
| `docs/decisions.md` | Decisiones arquitectónicas (AD-xx) y sus motivos |
| `docs/data-sources.md` | Fuentes, licencias y **limitaciones abiertas** (L-xx) |
| `docs/restrictions.md` | Motor de restricciones y cobertura de tests |
| `docs/routing.md` | Configuración de GraphHopper y contrato de la API |
| `docs/pois.md` | Puntos de interés: modelo, datos y cómo regenerarlos |
| `docs/deploy.md` | Sacar la app de la red local: túnel HTTPS y servidor propio |

Al cambiar comportamiento, actualizá el documento que corresponda en el mismo commit.
