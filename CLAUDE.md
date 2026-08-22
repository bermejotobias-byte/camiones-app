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
| `tests/TruckNavigator.UnitTests` | 65 tests de dominio, sin infraestructura |
| `tests/TruckNavigator.IntegrationTests` | 43 tests: 11 contra GraphHopper (se saltean solos si no está levantado) + 32 sobre datasets, perfiles, camiones, viajes y SQLite |

Solución: `TruckNavigator.slnx`.

## Requisitos

- .NET SDK 10
- Microsoft OpenJDK **21** — `winget install --id Microsoft.OpenJDK.21`.
  .NET Android soporta JDK 17–21; **con el 22 el build falla**.
- `dotnet workload restore` para los workloads de MAUI

## Comandos

```powershell
cd routing; .\run-graphhopper.ps1              # motor de ruteo en :8989 (1ª vez baja ~450 MB)
dotnet run --project src/TruckNavigator.Api    # backend en :5080, migra y siembra al arrancar
dotnet test                                    # 108 tests
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
- **La URL del backend no se edita a mano**: se cambia desde *Configurar servidor* en la
  pantalla de camiones, sin recompilar, o con `build-apk.ps1 -ApiUrl`. El valor de fábrica es
  `TruckNavigatorApi.DefaultBaseUrl` (`src/TruckNavigator.Mobile/Services/TruckNavigatorApi.cs`),
  hoy una URL de túnel Cloudflare de una demo vieja: los túneles cambian en cada arranque, así
  que ese default está muerto salvo que se regenere con `demo-up.ps1`.
- **HTTP plano desde el teléfono** está habilitado sólo para la IP de desarrollo, en
  `Platforms/Android/Resources/xml/network_security_config.xml`.
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
