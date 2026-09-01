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
| `tests/TruckNavigator.UnitTests` | 113 tests: 65 de dominio + 20 de la direccion del backend + 17 de la politica de reintentos + 11 del orden de las rutas alternativas. Los dos ultimos grupos enlazan archivos de Mobile, que no depende de MAUI a proposito |
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
.\data\fetch-radares-velocidad.ps1             # Radares de velocidad, dato oficial del GCBA
.\data\fetch-zonas-riesgo.ps1                  # Zonas peligrosas, del mapa comunitario del AMBA
dotnet run --project src/TruckNavigator.Api    # backend + web en :5080, migra y siembra al arrancar
dotnet test                                    # 159 tests (.NET)
node --test "tests/web/*.test.mjs"             # 45 tests: guiado + avisos de ruta
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
- **El APK se firma con una clave estable que vive FUERA del repo**, en
  `%LOCALAPPDATA%\TruckNavigator\firma-desarrollo.keystore`. La crea `build-apk.ps1` la
  primera vez. Sin ella, .NET Android firma con una clave de depuración que **se regenera
  sola**, y entonces Android rechaza la actualización con
  `INSTALL_FAILED_UPDATE_INCOMPATIBLE`: hay que desinstalar y se pierden la sesión y los
  ajustes en cada versión. **Es una clave de desarrollo, no de distribución**: para publicar
  va una propia, pasada por parámetro y **con copia de respaldo** — si se pierde, esa app no
  se puede volver a actualizar nunca. El script imprime la huella SHA-256 al terminar. Ver AD-35.
- **Los artefactos pesados de `routing/` no están en el repo**: el JAR de GraphHopper (45 MB),
  `argentina-latest.osm.pbf` (407 MB) y `graph-cache/` los baja y construye
  `run-graphhopper.ps1` en el primer arranque. Tampoco está el APK compilado.
- **El arranque insiste 3 veces antes de rendirse, y no reintenta cualquier falla.** Con
  un solo intento la app fallaba al abrirla y andaba a la segunda: al abrir, la red del
  teléfono suele no estar lista y ese intento agarra el hueco. La política vive en
  `ConnectionRetry` —sin dependencias de MAUI, con 17 tests— y `HealthCheck.Retriable`
  decide qué se reintenta: una dirección mal escrita falla igual las tres veces y cortar
  ahí evita 20 segundos de espera inútil. Peor caso ~22 s, con el cartel diciendo en qué
  intento va. Ver el apéndice de AD-33.
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
- **El color de una señal codifica UNA sola dimensión: cuánto te afecta a vos y a tu
  camión.** Los pasos a nivel se pintaban rojo/ámbar/pizarra según el tipo de barrera, y
  eso choca con el rojo de los gálibos, que significa **"tu camión no pasa"**. El mismo
  color con dos significados, en la pantalla que se mira de reojo. Hoy hay una sola chapa
  en pizarra y el tipo de barrera se lee al tocarla. Ver AD-38.
- **Los pasos a nivel se muestran SÓLO durante el viaje**, y por eso `paso-senal` **no está
  en `LAYER_IDS`**: depende del botón de capas *y* de que haya viaje, y el bucle genérico lo
  prendía fuera del viaje. Son 312 y afuera del viaje sólo tapan el mapa donde se arma la
  ruta. **No se filtran por tamaño del camión porque el dato no existe**: OSM trae `barrier`,
  `name` y `osm`, ninguna dimensión.
- **El gálibo del mapa usa el mismo dibujo que el botón de capas** (`icon('bridge')`). Antes
  eran dos puentes distintos y no se entendía que ese botón controlara esas señales.
- **Un ícono del mapa no puede ser un emoji.** Los glifos vendorizados llegan hasta el
  carácter 511: cualquier cosa por encima —una cámara 📷 está en U+1F4F7— **no se dibuja, sin
  error**. Los íconos van como imagen (`map.addImage` sobre un canvas), y con colores
  **fijos**, porque una imagen se registra una vez y no se repinta al cambiar entre día y
  noche: tiene que leerse en los dos. Ver los radares en `layers.js`.
- **Una capa `circle` de MapLibre sólo dibuja puntos.** Con geometrías `Polygon` no
  dibuja nada y **no emite ningún error**. Una capa `symbol` sí las acepta y ubica el
  símbolo en el centroide, así que sobre la misma fuente el ícono aparecía y la mancha
  no. Por eso `zonas-riesgo.geojson` publica el **centro** de cada celda, no su cuadrado.
- **`['zoom']` va sólo en el nivel superior de un `step` o un `interpolate`.** Envuelto
  en una multiplicación, MapLibre **rechaza la capa entera** — y lo hace por el evento
  `error` del mapa, **no por excepción**, así que ningún `try/catch` lo ve y el síntoma
  es que la capa no aparece, sin una línea en la consola. Va el `interpolate` sobre
  `['zoom']` afuera y el `match` por propiedad adentro de cada parada. Por eso
  `installTruckLayers` instala **cada capa en su propio try/catch**: antes un error en la
  primera se llevaba puestas a las otras cuatro sin dejar rastro. Ver AD-36.
- **Mover bloques grandes de `layers.js` por rango de líneas se lleva puestas definiciones
  que siguen en uso, y `node --check` NO lo detecta**: un `RIESGO.extrema` sin
  `const RIESGO` es sintaxis válida y sólo revienta al ejecutar, adentro del teléfono,
  donde el único rastro es una capa que no aparece. Pasó dos veces en la misma sesión
  (`chapa`/`LADO`/`rectangulo`/`imagen`, y después `RIESGO`). Después de reorganizar un
  archivo de `wwwroot/js`, buscar identificadores usados y nunca declarados.
- **Al iterar el diseño del mapa en el navegador, el módulo ES queda cacheado**: se
  edita `layers.js`, se recarga, y sigue corriendo el código viejo — incluso con
  Ctrl+Shift+R. El síntoma es peor que molesto: **parece que el cambio no tuvo efecto**
  y uno calibra a ciegas contra una versión que ya no existe. Para verificar de verdad,
  `import('/js/layers.js?v=' + Date.now())` fuerza una instancia nueva.
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
- **Cada aviso vibra con SU patrón, y eso es lo que lo hace útil.** Si todo vibrara igual,
  lo único que se sabría es "algo pasa" y habría que mirar la pantalla — que es justo lo
  que la vibración vino a evitar. Están en `VIBRACION` (`platform.js`). **No se usa
  `Vibration.Default` de MAUI**: sólo acepta una duración suelta. Va contra el `Vibrator`
  de Android con `VibrationEffect.CreateWaveform`, y la onda **arranca vibrando**, así que
  el primer tramo debe ser una espera de cero o el patrón sale invertido. Ver AD-39.
- **Los avisos de ruta se calculan UNA vez, al preparar la ruta.** Cruzar cada posición
  contra 685 gálibos, 312 pasos a nivel y 129 radares una vez por segundo es trabajo de
  sobra para un teléfono que además dibuja el mapa. `alertsAlongRoute` deja una lista corta
  y ordenada; después avisar es comparar dos números. El corredor es de **30 m**: más ancho
  levanta la calle paralela, y avisar de un puente por el que no vas a pasar **enseña a
  desconfiar del aviso**.
- **`querySourceFeatures` NO sirve para los avisos**: devuelve lo que está dibujado en
  pantalla, o sea lo que ya estás viendo — no lo que viene más adelante, que es lo que hay
  que avisar. Por eso `layers.js` guarda los datasets al descargarlos (`truckDataset`).
- **`Number(null)` es 0, no `NaN`.** Un gálibo sin altura declarada pasaba el filtro de
  `Number.isFinite` y se habría avisado como *"puente de 0,00 m, no pasás"*, con vibración
  de peligro. Va `Number.parseFloat`. Lo encontró un test, no el teléfono.
- **Las rutas alternativas se ordenan por RESTRICCIONES, no por tiempo.** El motor las
  devuelve por peso —o sea duración—, y para un camión ese orden está al revés: una ruta
  dos minutos más larga que no obliga a salir de la Red es mejor que la más rápida que sí.
  El criterio vive en `TruckRouteComparer`, en el **dominio**, con 11 tests: bloqueos →
  accesos → duración (con **60 s de tolerancia**) → cuánto va por la Red. La tolerancia no
  es un detalle: sin ella la Red nunca desempata, y sin el orden (Red *después* de
  duración) la app mandaría a dar rodeos por ganar puntos de Red.
- **`alternatives` es un campo OPCIONAL de `RouteResponse`, no un envoltorio nuevo.** La
  raíz conserva la forma de siempre para que la app ya instalada en el teléfono siga
  funcionando. En tramos cortos y directos no hay alternativas y el selector no aparece:
  con `max_share_factor: 0.7`, dos rutas que comparten el 90% no son dos opciones.
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
- **La hoja inferior se referencia por `#sheet`, nunca por `.sheet`**: `sheetAs()` le
  **reemplaza la clase** según el estado (`sheet` para buscar, `nav-bar` durante el viaje).
  Un selector por clase deja de coincidir en modo viaje, la barra hereda
  `pointer-events: none` y **el botón "Salir" no responde: el viaje queda imposible de
  cerrar desde la app**. El id no cambia nunca. Ver AD-34.
- **Fuera del viaje la cámara no se inclina ni gira, y el zoom es del usuario.** Los gestos
  de rotación e inclinación están apagados en `createMap`: en un teléfono salen sin querer y
  dejan el mapa torcido sin forma evidente de enderezarlo. `flyTo` **no cambia el zoom**
  salvo `minZoom`, que sólo acerca y usa únicamente *Mi ubicación*. La perspectiva se aplica
  con `easeTo` desde `enterNavigationMode`, que no pasa por esos manejadores, así que
  apagarlos no la rompe. Los botones + / − se esconden durante el viaje porque la cámara
  sigue al vehículo y deshace cualquier zoom manual. Ver AD-34.
- **El nombre de la calle por la que vas se rotula sobre el MAPA BASE, no sobre el tramo
  de la ruta.** Los tramos entre maniobras son cortísimos —29 m, 69 m, 91 m en una ruta
  real del centro— y `symbol-placement: line` **no dibuja nada si el texto no entra a lo
  largo de la línea**: a zoom 16, 29 m son 15 px y el nombre necesita unos 300. La calle
  del mapa base viene entera en el tile, así que hay largo de sobra. La capa `calle-actual`
  filtra por nombre sobre `base`/`roads` y **no tiene fuente propia** — por eso está en
  `ROUTE_LAYERS` pero no en `ROUTE_SOURCES`: borrar esa fuente se lleva el mapa entero.
  Y por lo mismo el rótulo va en **1,5×** y no en los 3× que pedía el brainstorm: los tiles
  parten las avenidas en tramos de una cuadra, y cuanto más grande el texto en menos entra
  — en 33 px no se dibuja **nada**.
- **La colisión del rótulo verde va ACTIVADA.** Con `text-allow-overlap: true` MapLibre deja
  de comparar los símbolos **incluso dentro de la misma capa**, y como los tiles traen la
  avenida partida en varios tramos, el mismo nombre se encimaba consigo mismo sobre las
  cuadras cortas, distinto según el zoom. La prioridad sobre los nombres grises se consigue
  por el **orden de la capa** —`calle-actual` antes de `calles-nombre`—, no por
  allow-overlap. Ver AD-37.
- **La ruta se dibuja DEBAJO de `calles-nombre`.** Sin el `beforeId`, los 17 px del halo
  más la línea tapan justo el nombre de la calle por la que se va, que es el dato que más
  se necesita manejando.
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
- **Las zonas peligrosas salen de un mapa COMUNITARIO, no del dato oficial de delitos.**
  Se intentó con el Mapa del Delito del GCBA y hubo que descartarlo: contar hechos mide
  **dónde hay gente**, no dónde hay peligro (Palermo encabezaba la Ciudad), y como el
  dataset cubre exactamente CABA, el mapa de calor terminaba dibujando **la silueta de la
  Ciudad** — un manchón rojo con la forma del límite administrativo. **Cuando la cobertura
  de una fuente coincide con una frontera, el mapa dibuja la frontera**, y ningún ajuste
  de color lo arregla. Hoy son las 19 zonas del mapa colaborativo que tocan CABA: 8,8 km²,
  el 4,3% de la Ciudad. Ver AD-36 y `data-sources.md` §7.
- **Ese dato NO es oficial y NO tiene grados.** Autoría anónima, sin metodología ni fecha.
  Hay dos estados —marcada y no marcada—, y **la app nunca dice "zona segura"**: que un
  lugar no aparezca significa que nadie lo marcó. El toque lo aclara cada vez y no muestra
  números: no son accionables manejando e invitan a una precisión que la fuente no tiene.
- **Las zonas se prenden con su propio botón (`#risk`) y arrancan APAGADAS**, aparte de las
  capas de camión. Son datos de otra naturaleza: los gálibos dicen por dónde puede pasar
  el vehículo, esto es un juicio de la comunidad sobre dónde no conviene parar.
- **El heatmap se alimenta con PUNTOS, nunca con una grilla.** Normaliza por densidad de
  puntos: con una grilla regular la redibuja como lunares alineados, y agrandar el radio
  sólo da lunares más grandes. El script rellena cada zona con puntos cada 60 m y los
  publica en **un solo MultiPoint** — la envoltura de miles de features pesa más que las
  coordenadas. El difuminado además evita prometer un borde exacto que este dato no tiene.
- **Fuera de CABA el mapa calla y ese silencio miente (L-11).** Ninguna capa propia existe
  pasando la General Paz o el Riachuelo, y la app no lo dice: Dock Sud se ve igual que un
  barrio sin registros. Sube de prioridad cuando se sume el AMBA.
- **No inventar datos ni normas.** Donde falta información se dejó explícito y documentado:
  la capa oficial del GCBA no está publicada (L-1), no se modelan restricciones horarias
  porque no se encontró norma general confirmada (L-2), playas de camiones y auxilio pesado
  casi no tienen fuente (L-5), la aptitud para camión está indeclarada en 75 de 78 POIs (L-6),
  no hay dato de balanzas (L-9), y el mapa no avisa cuándo salió del área cubierta (L-11).
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
