# Decisiones de arquitectura

Cada decisión registra el problema, la opción elegida y por qué se descartaron
las alternativas.

---

## AD-01 · Motor de ruteo: GraphHopper

**Alternativas evaluadas:** GraphHopper, Valhalla, OSRM.

**Elegida:** GraphHopper 11.0, ejecutado como servidor HTTP independiente.

**Por qué:**

- Soporta las restricciones de vehículo pesado de forma nativa mediante
  *encoded values* (`max_weight`, `max_height`, `max_width`, `max_length`,
  `max_axle_load`, `hgv`) usables en *custom models* por request. Eso permite que
  la restricción forme parte del cálculo y no de un filtro posterior, que es el
  requisito central del proyecto.
- Es un único JAR de 45 MB. Corre sobre el JDK que ya hace falta para compilar
  MAUI Android, sin Docker ni toolchain de C++.
- El import de Argentina entero tarda menos de un minuto en una notebook común.

**Por qué no Valhalla:** tiene el mejor *costing* de camiones del ecosistema
(incluye carga por eje y materiales peligrosos), pero en Windows sin Docker no es
viable. Es el candidato natural para una segunda iteración si hacen falta reglas
que GraphHopper no exprese.

**Por qué no OSRM:** no tiene perfil de camión. Habría que escribir perfiles Lua
y recompilar el grafo por cada combinación de dimensiones, lo que rompe el
requisito de ruteo por vehículo.

---

## AD-02 · La Red de Tránsito Pesado se modela como penalización, no como bloqueo

**Problema:** el art. 9.10.1 de la Ley 2148 prohíbe circular fuera de la Red a los
vehículos de más de 12 t, *pero* habilita salir de ella para llegar al destino y
regresar por el recorrido más corto.

**Decisión:** en el custom model, los tramos que no pertenecen a la Red reciben
`multiply_by: 0.03` en lugar de `0`.

**Por qué:** con una penalización fuerte el optimizador usa la Red para el grueso
del viaje y sólo la abandona en las primeras y últimas cuadras — que es
exactamente la excepción que la norma concede. Bloquear esos tramos dejaría
inalcanzable a casi cualquier destino real, y la regla ingenua
"fuera de la Red ⇒ prohibido" sería incorrecta desde el punto de vista legal.

**Medición sobre una ruta real** (Retiro → Mataderos, semirremolque de 40 t):

| | Distancia | Tiempo | Sobre la Red |
|---|---|---|---|
| Sin la regla | 16,3 km | 22 min | 0,7 % |
| Con la regla | 28,2 km | 33 min | 91,8 % |

El 8,2 % restante son los accesos a origen y destino. La API los devuelve
separados en `accessLegs` y la app los dibuja punteados en naranja.

---

## AD-03 · El umbral de 12 t condiciona la aplicación de la regla

La obligación de usar la Red sólo se agrega al custom model cuando
`GrossWeightKg > 12000`. Un camión liviano rutea por el camino más corto sin
condicionamientos. La constante vive en `CabaHeavyTrafficRules` con su cita.

---

## AD-04 · Las reglas se escriben una vez y se usan de dos maneras

`CabaTruckRoutingPolicy` traduce las reglas al custom model del motor de ruteo;
`CabaRestrictionEvaluator` evalúa las mismas reglas sobre los tramos que
GraphHopper devuelve.

La segunda no duplica a la primera: sirve para explicarle al usuario por qué la
ruta va por donde va, y para que los tests verifiquen que el resultado respeta
las restricciones. Si ambas divergieran, el `GraphHopperRouteCalculator` lo
registra como warning al detectar un tramo prohibido dentro de una ruta.

---

## AD-05 · El origen de la regla y el origen del dato se registran por separado

`RestrictionFinding` tiene `RuleSource`/`RuleReference` y
`DataSource`/`DataReference`.

**Por qué:** la obligación de circular por la Red es normativa oficial de CABA,
pero saber si un tramo pertenece a la Red hoy sale de OpenStreetMap. Un solo
campo `Source` obligaría a mentir en uno de los dos sentidos y haría imposible
auditar el sistema. Ver la limitación en [data-sources.md](data-sources.md).

---

## AD-06 · SQLite en lugar de PostgreSQL + PostGIS para el MVP

**Decisión:** EF Core sobre SQLite, con `docker-compose.yml` de PostGIS listo
para la siguiente iteración.

**Por qué:** en el MVP la geometría vive en el grafo de GraphHopper, que es quien
la necesita. La base sólo guarda perfiles de camión y metadatos de trazabilidad,
para lo que PostGIS no aporta nada. La máquina de desarrollo no tenía Docker ni
la extensión PostGIS instalada, y resolver eso habría consumido el tiempo del
MVP sin mejorar el resultado.

**Cuándo cambiar:** cuando haga falta persistir restricciones propias con
geometría (obras, cortes, restricciones temporales) o la capa oficial del GCBA.
El cambio se limita al `UseSqlite` de `DependencyInjection.cs` más una migration.

---

## AD-07 · Mapa en WebView con MapLibre GL JS

**Alternativas:** Mapsui nativo, Microsoft.Maui.Controls.Maps, WebView + JS.

**Descartado Microsoft.Maui.Controls.Maps:** en Android usa Google Maps, que el
proyecto excluye explícitamente como fuente.

**Descartado Mapsui:** la versión 5.1.0 sólo publica assets para
`net9.0-android35.0` y arrastra `Microsoft.Maui.Controls 9.0.50`, lo que choca
con .NET 10 / API 36. El riesgo de resolución de dependencias no se justificaba.

**Elegida:** `WebView` con `map.html`, MapLibre GL JS y su CSS empaquetados como
`MauiAsset` (sin CDN). El GPS lo aporta MAUI nativo (`Geolocation`) y se inyecta
al mapa por JavaScript. La comunicación JS → C# usa el esquema `appaction://`
interceptado en el evento `Navigating`.

---

## AD-09 · El puente JS ↔ C# usa HybridWebView, no un esquema de URL propio

**Problema:** la primera versión avisaba a C# navegando a `appaction://…` e
interceptando el evento `Navigating` del `WebView`. **No funcionaba en el
dispositivo**: los taps sobre el mapa no fijaban origen ni destino. Los WebView
modernos de Android no entregan de forma confiable las navegaciones a esquemas
propios disparadas desde JavaScript.

**Decisión:** usar `HybridWebView`, el control de MAUI pensado para hospedar
contenido web con un canal de mensajería bidireccional oficial.

- JS → C#: `window.HybridWebView.SendRawMessage(JSON.stringify({...}))`, recibido
  en el evento `RawMessageReceived`.
- C# → JS: `EvaluateJavaScriptAsync`.

El contenido web pasa a `Resources/Raw/wwwroot/` con `index.html` como archivo
principal. En .NET 10 la librería del puente la sirve el propio control desde
`_framework/hybridwebview.js`; no hay que empaquetarla.

---

## AD-10 · Geocodificación con Photon, detrás de nuestra API

**Problema:** fijar origen y destino tocando el mapa es incómodo. Hace falta
escribir una dirección con autocompletado.

**Descartado Nominatim:** su
[política de uso](https://operations.osmfoundation.org/policies/nominatim/)
desaconseja explícitamente el autocompletado a medida que se escribe.

**Descartado Google Places:** el proyecto excluye a Google como fuente.

**Elegido Photon** (`photon.komoot.io`): geocoder construido sobre datos de
OpenStreetMap y diseñado específicamente para búsqueda tipo *type-ahead*. Mismo
origen de datos que el grafo de ruteo, así que lo que se encuentra es
consistente con lo que se puede rutear.

**Se expone detrás de nuestra propia API** (`GET /api/places`,
`GET /api/places/reverse`) en lugar de llamarlo desde la app. Así el cliente
móvil no conoce al proveedor, controlamos el `User-Agent`, y autohospedar Photon
más adelante no obliga a tocar la app.

Mitigaciones de carga: la app espera 350 ms sin tecleo antes de consultar,
exige tres caracteres como mínimo y cancela la consulta anterior en cada tecla.
Los resultados se sesgan a CABA con `bbox` y se recortan a un área que cubre la
Ciudad y el primer cordón, porque el grafo cubre el país entero y hay destinos
legítimos fuera de la Ciudad.

---

## AD-11 · El geocoder se sesga por coordenada, no se filtra por `bbox`

**Problema:** con `bbox` puesto en la caja de CABA, el buscador no encontraba
"Unicenter" (está en Martínez) ni las calles de San Martín.

**Causa:** el parámetro `bbox` de Photon **filtra**, no prioriza. Todo lo que
cae fuera del rectángulo simplemente no se devuelve.

**Decisión:** usar `lat`/`lon` + `location_bias_scale` para *priorizar* lo
cercano a CABA, y hacer el recorte efectivo en nuestro código con una caja que
cubre el AMBA con holgura (`MinLongitude`…`MaxLatitude` en `GeocodingOptions`).

Sigue teniendo sentido recortar: el grafo de ruteo cubre el país entero y no
queremos sugerir Bariloche. Pero el recorte es nuestro y está en `appsettings`,
así que ampliarlo es cambiar cuatro números.

---

## AD-12 · La validez de origen y destino se decide al calcular, no en `TextChanged`

**Problema:** con ambos campos completos, "Calcular ruta" decía que faltaba el
origen o el destino.

**Causa:** el handler de `TextChanged` invalidaba la coordenada asumiendo que un
cambio de texto significaba que el usuario había editado el campo. Pero la app
también escribe en esos campos —al elegir una sugerencia y al resolver la
dirección de un tap—, y el `EditText` de Android emite el evento de forma
asincrónica y a veces en varios pasos (vacía el campo antes de escribir el texto
nuevo). Cualquier bandera o comparación evaluada dentro del handler se
desincroniza. Se intentó primero con una bandera y después comparando contra la
etiqueta dentro del handler; ambas fallaron por lo mismo.

**Decisión:** `TextChanged` no toca las coordenadas. Un punto se considera
válido si tiene coordenada **y** el texto del campo sigue siendo exactamente la
etiqueta del lugar que se eligió (`ResolvedPoint`). Esa comparación se hace al
calcular, cuando el estado ya está quieto, así que no depende del orden en que
lleguen los eventos.

La pantalla muestra una línea de diagnóstico con el estado real de cada punto
(`A OK -34.6042,-58.3878   B --`), que distingue "nunca se eligió" de "se eligió
pero después se editó el texto".

---

## AD-13 · Los puntos de interés van a la base, y el dataset a archivos versionados

**Problema:** hacía falta una capa de playas, estaciones, talleres, gomerías y
auxilio pesado, sin cablearla dentro del mapa.

**Decisión:** entidad en `Domain`, tabla propia vía EF Core, endpoint
`GET /api/pois`, y los datos en archivos JSON embebidos que el seed carga al
arrancar. El mapa recibe una lista y no sabe de dónde salió.

**Por qué no un JSON adentro de la app:** habría funcionado sin API, pero el
proyecto ya tiene backend y base, y duplicar el origen de datos deja dos verdades.
Con la tabla, sumar restricciones propias sobre los puntos (habilitaciones,
horarios de carga y descarga) es una columna, no una arquitectura nueva.

**Por qué no una tabla poblada por migration:** los datos se regeneran corriendo
`data/fetch-caba-pois.ps1`. Un `InsertData` en la migration obligaría a una
migration nueva por cada actualización del relevamiento.

`PointOfInterestSeed` hace **upsert por id derivado de la fuente**, no el
`if (Any()) return` que usa `TruckProfileSeed`. Con ese guard, regenerar el dataset
no se reflejaría nunca en una base ya creada. Sólo toca filas con
`IsSampleData = true`.

---

## AD-14 · La aptitud desconocida no se convierte en "no apto"

**Problema:** los cuatro campos `apto_*` tienen que representar tres estados, no
dos. De los 78 puntos del dataset inicial, **75 no declaran nada**: OSM ubica la
estación de servicio pero no dice si recibe un semirremolque.

**Decisión:** `bool?` en las cuatro propiedades, y `PoiSuitability.Accepts`
devuelve `bool?`. `null` = "la fuente no lo dice".

**Por qué:** es la misma regla que gobierna la normativa en este proyecto. Si no
se puede afirmar una restricción con respaldo, se documenta la limitación en lugar
de inventarla. Un `bool` obligaría a que la falta de dato se lea como una
prohibición, y el usuario vería "no apto" donde en realidad no sabemos.

Es el mismo criterio con el que `PathDetails.ReadDouble` trata un límite ausente
como "sin límite" y no como "límite cero".

**Consecuencia asumida:** con el filtro *solo aptos para mi camión* encendido, un
semirremolque hoy no ve ningún punto. Por eso el filtro **arranca apagado** y la
pantalla informa cuántos escondió: un mapa vacío sin explicación se lee como una
pantalla rota, no como un filtro estricto.

---

## AD-15 · La ficha del punto se dibuja en MAUI, no en un popup del mapa

**Alternativas:** `maplibregl.Popup` dentro del WebView, o un panel nativo
alimentado por el puente que ya existe.

**Elegida:** el marcador avisa a C# con `poiTapped` por el mismo canal
`HybridWebView` que ya usa `mapTapped` (AD-09), y la ficha es un `Border` de MAUI
superpuesto al mapa, con la misma receta visual que el panel de sugerencias.

**Por qué:** el teléfono y la web tienen que ser accionables — `PhoneDialer` y
`Browser` son API nativas, y dentro del WebView un `tel:` no abre el discador sin
trabajo extra. Además permite el botón **Usar como destino**, que conecta la capa
de puntos con el ruteo en lugar de dejarla como una capa decorativa.

**El detalle que importa:** el listener del marcador hace `stopPropagation()` antes
de avisar. Sin eso, tocar un punto contaría además como un toque sobre el mapa y
movería el pin de destino.

Los puntos se dibujan como `maplibregl.Marker` y no como capa GeoJSON, así
`clearRoute()` —que quita capas— no puede borrarlos al recalcular una ruta.

**Dos trampas que costaron un crash y un bug, anotadas para el próximo:**

1. **El WebView de Android aborta el proceso si se lo toca fuera del hilo de UI**, y
   `RawMessageReceived` no siempre llega en ese hilo. Por eso `RunScriptAsync`
   marshalea con `MainThread.InvokeOnMainThreadAsync` adentro, en lugar de confiar
   en que cada llamador se acuerde. La excepción que tira MAUI en ese caso viaja
   por un camino interno que ni siquiera entra al `catch`, así que aparece como
   crash nativo y no como error manejado.

2. **El elemento que se le entrega a `maplibregl.Marker` no puede declarar
   `position`.** MapLibre le pone `position: absolute` desde su hoja y encima
   aplica el `transform` que lo mantiene pegado a su coordenada; como el `<style>`
   propio va después del `<link>`, cualquier `position` con la misma especificidad
   gana y el marcador deja de seguir al mapa al hacer zoom. El pin visible
   —que sí necesita `position: relative` para colgarle el badge de aptitud— va
   dentro de un envoltorio que no toca el posicionamiento. La clase `.pin` de
   origen/destino/GPS nunca tuvo el problema porque nunca declaró `position`.

---

## AD-16 · Fijar puntos pide mantener apretado, no un toque

**Problema:** con un toque simple, origen y destino se cambiaban sin querer.
Navegar el mapa es una actividad táctil constante —arrastrar, acercar, mirar— y
cualquiera de esos gestos termina en un toque que el mapa interpretaba como
"quiero fijar el punto acá". Perder el destino después de haberlo buscado es
molesto y no tiene deshacer.

**Decisión:** el toque simple pasa a cerrar los paneles abiertos y nada más.
Fijar un punto pide mantener apretado 500 ms.

**Por qué no un modo "elegir en el mapa":** ya existe el botón *Mapa*, pero
obligar a entrar en un modo antes de cada marcación es más ceremonia que la que
el gesto necesita. Mantener apretado es lo que hacen Google Maps y Waze para lo
mismo, así que no hay que enseñarlo.

**Cómo se detecta:** MapLibre no trae el gesto, así que se arma sobre los eventos
táctiles del contenedor del canvas. Se cancela si el dedo se corre más de 12 px
(está arrastrando el mapa), si aparece un segundo dedo (está haciendo zoom), o si
suelta antes de tiempo. Los 12 px de tolerancia importan: sin ellos el pulso
normal cancela el gesto y parece que no funciona.

Mantener apretado **sobre un marcador** no marca el mapa debajo: el handler
descarta el evento si el objetivo está dentro de un `.maplibregl-marker`. Eso
cubre tanto los puntos de interés como los pines de origen, destino y GPS.

El WebView puede emitir además su propio `contextmenu` por el mismo gesto, así
que el aviso a C# pasa por un guard temporal que evita marcar dos veces. Ese
`contextmenu` nativo también se cancela con `preventDefault`, porque aparece justo
encima del mapa.

---

## AD-08 · Seis proyectos, no veinticinco

`Domain` (sin dependencias externas), `Infrastructure`, `Api`, `Mobile` y dos
proyectos de test. El motor de restricciones queda aislado en `Domain` para que
se pueda testear sin infraestructura — de ahí que los 19 tests unitarios corran
en 200 ms.

---

## AD-17 · La identidad la resuelve ASP.NET Core Identity, no código propio

**Problema:** el documento de requisitos pide alta con mail y contraseña
verificada por mail, y todo el eje de perfil, comunidad y gamificación cuelga de
saber quién es el usuario.

**Alternativas:** implementación propia sobre la tabla de usuarios, un proveedor
externo (Auth0, Firebase Auth), o ASP.NET Core Identity.

**Elegida:** ASP.NET Core Identity con `AddIdentityApiEndpoints<AppUser>()` y
`MapIdentityApi`, montado en `/api/auth`.

**Por qué:**

- El hasheo de contraseñas, los tokens de verificación de mail, el bloqueo por
  intentos fallidos y la rotación de tokens son **código de seguridad**. Este
  proyecto no tiene ninguna razón para reescribirlos, y hacerlo mal no se nota
  hasta que es tarde.
- `MapIdentityApi` entrega en un renglón todo el ciclo de vida que pide el
  documento: registro, confirmación de mail, login, refresh, logout y
  recuperación de contraseña.
- Los tokens de portador funcionan igual desde la app Android y desde un
  navegador, lo que no ata la decisión de frontend.

**Por qué no un proveedor externo:** agrega una dependencia de red en el camino
crítico del alta, un costo por usuario activo y datos de los camioneros en un
tercero. Para un padrón que se espera chico y local, no se justifica.

**Configuración deliberada** (en `Program.cs`, con su motivo al lado):

| Opción | Valor | Motivo |
|---|---|---|
| `RequireConfirmedEmail` | `true` | Lo pide el documento; además hace que detrás de cada alias haya alguien. |
| `RequiredLength` | 8 | Se privilegia longitud sobre composición. |
| `RequireUppercase` / `RequireNonAlphanumeric` | `false` | Exigir mayúsculas y símbolos en el teclado de un teléfono, dentro de un camión, produce contraseñas anotadas en un papel: es **peor** seguridad, no mejor. |
| `MaxFailedAccessAttempts` | 5, 15 min | Corta la prueba de contraseñas por fuerza bruta. |

**Limitación asumida — el envío de mail.** Sin SMTP configurado la aplicación
**no manda ningún mail**: escribe el enlace de verificación en el log con nivel
`Warning`. Es lo que permite desarrollar y probar el alta sin contratar un
proveedor, y es explícitamente **inseguro en producción**, porque cualquiera con
acceso al log podría verificar cuentas ajenas. Por eso el arranque **corta con
excepción** si el entorno es `Production` y la sección `Email` está vacía. Ver
[deploy.md](deploy.md).

**Trampa que costó una vuelta:** `MapIdentityApi` arma el enlace de confirmación
**codificado para HTML**, porque su mail por defecto tiene formato. Estos mensajes
son de texto plano, así que el separador de parámetros llegaba como `&amp;`
literal y la URL no funcionaba al pegarla en el navegador. El adaptador
`IdentityEmailSender` lo decodifica con `WebUtility.HtmlDecode`. Si algún día los
mails pasan a HTML, hay que sacar esa decodificación.

---

## AD-18 · La cuenta y el perfil del camionero son dos entidades

**Decisión:** `AppUser : IdentityUser<Guid>` en `Infrastructure` guarda **sólo**
credenciales. `DriverProfile` en `Domain` guarda alias, nombre, apellido y avatar.
Comparten identificador y la relación es uno a uno, con borrado en cascada.

**Por qué:** mantiene a `Domain` sin dependencias externas, que es la regla
estructural del proyecto (AD-08). Si el perfil colgara de `IdentityUser`, el
dominio pasaría a depender de ASP.NET Core y dejaría de poder testearse en
milisegundos. Con la división, las reglas del alias se prueban sin base de datos
—igual que el motor de restricciones— y cambiar de proveedor de identidad no
tocaría ni el perfil ni sus tests.

**El alias es único e irrepetible, y eso se garantiza en dos lugares distintos:**

- **El formato** es regla de dominio y vive en `DriverAlias.Validate`.
- **La unicidad** es un índice único en la base, sobre una columna
  `NormalizedAlias` en minúsculas. El endpoint consulta antes de guardar sólo
  para poder dar un mensaje claro; entre esa consulta y el `SaveChanges` otra alta
  puede quedarse con el alias, así que la garantía real es el índice. Hay tests de
  integración que lo verifican contra SQLite, incluido el caso
  `ElGaucho` / `elgaucho`.

**Por qué la columna normalizada y no una comparación sin distinguir mayúsculas:**
para SQLite `"ElGaucho"` y `"elgaucho"` son distintos, así que un índice sobre la
columna visible no frenaría el choque —que es justamente el parecido que permite
suplantar a otro en el chat—.

**El perfil se crea al primer acceso a `/api/profile`, no durante el alta:**
`/api/auth/register` lo sirve Identity y no ofrece un gancho donde colgarlo.
Crearlo en el primer acceso deja un solo camino posible y evita cuentas sin perfil
si el alta se corta por la mitad. Nombre, apellido y avatar quedan opcionales
porque el documento pide poder **saltear** ese paso.

---

## AD-19 · Un camión pertenece a una cuenta; las plantillas no son de nadie

**Problema:** el documento pide *"que puedas cargar más de un camión y quede
registrado para cuando quieras o tengas que usar otro"* y, aparte, *"la primera
vez que el usuario elija el tipo de transporte, que muestre las características
principales de cada opción"*. Hasta acá los perfiles vivían sueltos en la base,
sin dueño y visibles para cualquiera.

**Decisión:** `TruckProfile.OwnerId` nulable.

| `OwnerId` | Qué es | Quién lo ve | Quién lo edita |
|---|---|---|---|
| Una cuenta | El camión de esa persona | Sólo su dueño | Sólo su dueño |
| `null` | **Plantilla del catálogo** | Todos | Nadie |

**Por qué las tres sembradas pasan a ser plantillas y no se borran:** ya traen
altura, peso, largo y ejes de cada tipo de vehículo, que es exactamente lo que el
documento pide mostrar antes de elegir. Convertirlas en catálogo resuelve ese
requisito sin cargar ningún dato nuevo. Siguen marcadas con `IsSampleData`, que
es una cosa distinta y sigue significando *"estos números son de ejemplo y no
representan límites legales"*.

**Leer está abierto, escribir exige sesión.** `GET` responde a cualquiera —
anónimo ve sólo las plantillas, autenticado ve las suyas más las plantillas—.
`POST`, `PUT` y `DELETE` piden token, porque un camión sin dueño no se puede
guardar en este modelo.

**Consecuencia asumida:** la app Android todavía no tiene login, así que **crear y
editar camiones desde la app devuelve 401 hasta que se rehaga el frontend**. Se
eligió esto antes que dejar la escritura abierta, que habría significado camiones
huérfanos visibles para todos. El ruteo del demo **no se rompe**, porque usa las
plantillas y leerlas sigue siendo anónimo.

**El camión ajeno responde 404, no 403.** Un 403 confirmaría que ese id existe, y
las medidas de un camión son dato de su dueño. La plantilla, en cambio, sí
responde **403 con explicación**, porque su id es público y el usuario merece
entender por qué no puede editarla.

**El control no vive sólo en `/api/trucks`.** `POST /api/routes` y
`GET /api/pois?truckId=` reciben un id de camión y lo resuelven por el mismo
helper `FindUsableTruckAsync`. Es donde más importa: el camión es **la entrada del
motor de restricciones**, así que rutear con el equivocado no es una fuga de
datos menor —devuelve una ruta que no sirve para el vehículo que está manejando—.

**Borrar la cuenta borra sus camiones**, que son datos de esa persona. Las
plantillas quedan, porque no cuelgan de ninguna cuenta. Hay tests de integración
para ambos casos.

---

## AD-20 · El viaje lo abre el servidor ruteando, no el cliente informando

**Problema:** el documento pide que *"los kilómetros que hagas sumen para
desbloquear cosas"*. Eso convierte al kilómetro en moneda, y a una moneda hay que
poder defenderla.

**Decisión:** `POST /api/trips` recibe camión, origen y destino —**nunca una
distancia**—, llama al motor de ruteo, guarda lo que el motor devolvió y responde
con el viaje **y** la ruta para navegarlo.

**Por qué junto y no en dos llamadas:** además de ahorrar un viaje de red,
garantiza que la ruta que se navega sea exactamente la que quedó registrada. Si
el cliente ruteara por un lado y abriera el viaje por otro, podría mandar una
distancia que no corresponde a ningún recorrido.

**Los kilómetros acreditados están separados de los planeados.**
`PlannedDistanceMeters` es lo que dijo el motor; `CreditedDistanceMeters` es lo
que efectivamente suma. Un viaje cancelado tiene lo primero y no lo segundo.

**La regla de acreditación es de plausibilidad, no de verificación.** Sin ninguna
condición, abrir un viaje y cerrarlo en el acto regalaría la distancia entera. Se
exige que haya transcurrido **al menos la mitad de la duración estimada**: deja
margen para tránsito más suelto que el previsto y descarta lo imposible —cerrar
en 14 minutos un viaje estimado en 30 implica el doble de la velocidad prevista,
que dentro de la Ciudad no pasa—.

> **Esto no prueba que el camión haya recorrido la ruta.** Prueba que pasó tiempo
> suficiente como para que fuera posible. La verificación real necesita el trazado
> del GPS comparado contra la ruta, y llega con la navegación paso a paso. Cuando
> llegue se reemplaza el contenido de `TripCrediting` y **no** el esquema: los dos
> campos ya están separados justamente para eso.

**Un viaje abierto por vez.** Nadie maneja dos camiones a la vez, y dos viajes
abiertos dejarían sin respuesta a cuál acreditarle el recorrido. Abrir otro
devuelve **409 con el id del que quedó abierto**, para que la app pueda ofrecer
cerrarlo en lugar de dejar al usuario trabado.

**El historial es de la persona, no del camión.** Borrar la cuenta borra sus
viajes; **borrar un camión no**. La referencia queda en `null` y el nombre del
camión, copiado al crear el viaje, mantiene el historial legible. El caso es
corriente en el oficio: se cambia de vehículo o de empresa, y perder el historial
sería perder también los kilómetros acumulados.

**Las estadísticas se agregan, no se guardan en contadores.** Con estos volúmenes
el agregado es correcto por construcción y no puede desincronizarse. Si algún día
pesa, se agrega un contador sin cambiar la forma de la respuesta.

### La trampa que costó dos endpoints en 500

**SQLite no sabe ordenar por `DateTimeOffset`.** EF lo persiste como texto con el
offset adelante, así que un `ORDER BY` sería alfabético sobre eso; el proveedor
directamente lo rechaza con `NotSupportedException`. El historial —que se lee del
más nuevo al más viejo— y las estadísticas devolvían **500**.

Se guardan los instantes como **ticks UTC** (`long`) con un `ValueConverter`. El
orden pasa a ser numérico y correcto, el índice sirve y no se pierde precisión.
Todas las fechas del sistema se escriben con `UtcNow`, así que no hay offset
propio que preservar. Se aplicó también a `DriverProfile.CreatedAt`, que tenía la
misma bomba puesta aunque todavía nadie ordenara por él.

**Ninguno de los tests lo agarró** porque ninguno ordenaba por fecha: se probaba
que el viaje se guardaba y se leía, no que el historial se pudiera listar. Se
agregó `The_history_can_be_ordered_by_date_newest_first`, que falla sin el
conversor.

---

## AD-21 · Toda la interfaz pasa a una aplicación web, sin paso de compilación

**Problema:** el prototipo era mitad y mitad —pantallas en XAML nativo, mapa
dentro de un `WebView`—. Construir perfil, historial, chat y gamificación en XAML
iba a ser lento, no servía para la versión web, y obligaba a mantener dos
interfaces para lo mismo.

**Decisión:** una sola aplicación web en `src/TruckNavigator.Api/wwwroot`, servida
por la API y empaquetada tal cual dentro de la app Android. MAUI queda como
**cáscara nativa**: GPS, notificaciones, servicio en segundo plano, discador,
compartir.

**Por qué ahí y no en un proyecto aparte:** poniéndola en `wwwroot` funciona igual
en desarrollo y publicada, sin trucos de MSBuild ni copias en el build. El día que
la empaquete la app Android, es una línea de copia en `build-apk.ps1`, no un
sistema de compilación.

### Sin paso de compilación

Módulos ES nativos, sin npm ni empaquetador.

- La web se despliega como archivos estáticos en cualquier lado.
- La app Android empaqueta los mismos archivos sin coordinar dos builds.
- El repositorio ya tenía esa forma: MapLibre viaja versionado, no instalado.

Agregar un empaquetador más adelante es fácil; sacarlo, no. Si algún día hace
falta, las vistas ya están separadas por archivo.

### Ruteo por hash

`#mapa`, `#camiones`, `#perfil`. Así la misma app funciona servida por HTTP y
cargada desde `file:///android_asset/`, sin fallback en el servidor ni un caso
especial en la cáscara nativa.

### Tipografía del sistema, sin fuentes web

En Android resuelve a Roboto, que ya está en el teléfono: cero descarga, cero
dependencia de red **adentro del camión** y render nativo. Una fuente de Google
sería una petición más que puede fallar justo cuando no hay señal.

### Las dos intensidades

El sistema de diseño declara dos registros y el CSS los separa:

| | Dónde | Qué usa |
|---|---|---|
| **Sobrio** | Mapa y navegación | Alto contraste, tipografía grande, blancos de toque de 48 px |
| **Expresivo** | Perfil y progresión | Color de recompensa, barra de nivel, medallas, movimiento |

**No es sólo estético.** Tener los dos registros declarados es lo que hace que
nada gamificado se filtre a la pantalla que se mira manejando. Un GPS que
distrae a alguien que lleva treinta toneladas es un producto peligroso.

El color de recompensa (violeta) está **fuera** de la escala semántica: verde,
ámbar y rojo quedan reservados para estado y peligro, y no se usan para adornar.

### Naranja → celeste

Los tramos fuera de la Red se dibujan en **celeste** y no en naranja ni rojo. La
norma admite salir de la Red para llegar al destino: pintarlo como infracción
sería mentir sobre lo que dice la ley.

### Tres errores que sólo aparecieron probando la interfaz

1. **`Container 'map' not found`.** La vista se armaba antes de insertarse en el
   documento, y MapLibre busca y mide su contenedor al construirse. Se monta el
   nodo primero y además se le pasa el elemento en lugar del id.

2. **`POST /api/routes` devolvía 404 sobre el camión propio.** El cliente lo
   llamaba sin token, así que el servidor sólo veía las plantillas. El endpoint
   ya soportaba los dos casos; el error estaba en el cliente. Es la contracara de
   la decisión de AD-19 de dejar ese endpoint abierto.

3. **`Style is not done loading`.** Si la ruta llegaba antes de que el mapa
   terminara de cargar el estilo, agregar la capa tiraba excepción y la ruta no
   se dibujaba nunca. Es **intermitente por naturaleza** —depende de si contesta
   antes el servidor o los tiles—, así que se espera a que el mapa quede quieto y
   se reintenta.

Ninguno de los tres los agarra un test de API: los tres viven en el navegador.

---

## AD-22 · La app Android pasa a ser una cáscara: hospeda la web y nada más

**Decisión:** el proyecto MAUI queda reducido a una pantalla —`AppPage`— que
hospeda un `HybridWebView` a pantalla completa con la aplicación web dentro.
Desaparecen `MapPage` (922 líneas), `TruckListPage` y `TruckEditPage`.

**Los archivos no se copian, se enlazan.** El `csproj` incluye
`..\TruckNavigator.Api\wwwroot\**\*` como `MauiAsset`. Dos copias del frontend
divergen, y esa es justo la clase de diferencia que se descubre tarde y en el
teléfono.

### Lo que la cáscara sí tiene que resolver

Tres cosas que el WebView no hace solo. Van por el mismo canal de mensajes de
`HybridWebView` que ya estaba probado (AD-09), y del lado web quedan detrás de
`js/platform.js`, para que ninguna vista tenga que preguntarse dónde corre:

| | Por qué |
|---|---|
| **URL del backend** | Servida por HTTP la web usa el mismo origen. Dentro del WebView no hay origen al que pegarle, así que la aporta la cáscara. |
| **Ubicación** | El WebView de Android no entrega `navigator.geolocation` sin que la cáscara resuelva el permiso. La posición la lee el GPS nativo y se empuja a la página. |
| **Discador** | Un `tel:` dentro del WebView no abre el discador solo. |

### Dos bloqueos del navegador que dejarían la app en blanco

Ambos son invisibles desde el servidor —el pedido nunca llega a salir— y por eso
quedan anotados:

1. **CORS.** `HybridWebView` sirve la interfaz desde un origen virtual propio, así
   que todo pedido al backend es *cross-origin*. Se agregó una política que
   **permite cualquier origen**. Es deliberado y acotado: la API se autentica con
   tokens de portador y no con cookies, de modo que un origen ajeno no consigue
   nada que no consiga un cliente HTTP cualquiera — no hay sesión implícita que
   robar. *Si algún día se agregan cookies, esto tiene que volverse una lista
   blanca.*

2. **Contenido mixto.** Ese origen virtual es `https` y el backend en la red local
   es `http` plano. Chromium bloquea la combinación por defecto. Se habilita
   `MixedContentHandling.AlwaysAllow` en el handler del WebView. Android **además**
   exige que la IP esté declarada en `network_security_config.xml`, así que el
   tráfico en claro sigue restringido a las direcciones listadas ahí. Cuando el
   backend se publique por HTTPS, la excepción se puede sacar.

### El panel de conexión

La cáscara comprueba `/api/health` **antes** de entregarle la URL a la web. Si no
responde, muestra un panel nativo para corregir la dirección. Si responde, el
panel no se ve nunca.

Se verifica antes en lugar de dejar arrancar la web con una URL muerta: así el
error se explica una vez y con la dirección a la vista, en lugar de fallar pedido
por pedido desde adentro, que es mucho más difícil de diagnosticar.

### Lo que no se pudo verificar acá

El APK compila, pero **no se probó en un teléfono**. Lo que hay que mirar la
primera vez que se instale, en este orden:

1. que la interfaz cargue —si queda en blanco, el sospechoso es el par CORS /
   contenido mixto de arriba—;
2. que el botón de GPS traiga la ubicación (permiso nativo);
3. que el 911 abra el discador.

---

## AD-23 · Navegación paso a paso: el motor vive en el cliente

**El hallazgo que abrió la fase.** El parser de GraphHopper guardaba de cada
instrucción sólo el texto, la distancia y la calle, y **descartaba `sign` e
`interval`**. Sin `interval` no se puede saber *dónde* ocurre la maniobra, así
que la API no podía sostener navegación paso a paso — y no se notaba, porque la
ruta se dibujaba perfecta igual.

Ahora `RouteInstruction` lleva `Kind`, `FromPointIndex`, `ToPointIndex` y
`ExitNumber`. El entero con signo del motor se traduce **una sola vez**, en la
capa que habla con GraphHopper: el dominio y la app trabajan con nombres. Un
código desconocido cae en `Unknown` a propósito — mejor una flecha genérica que
adivinar un lado y mandar a doblar mal.

> **La maniobra ocurre en `FromPointIndex`, y `DistanceMeters` es lo que se
> recorre _después_ de hacerla.** Leerlo al revés adelanta cada aviso una cuadra
> entera.

### El motor corre en el cliente, no en el servidor

A una posición por segundo, consultar al servidor sería absurdo y dejaría la
navegación inservible sin señal — que en un camión pasa. `js/navigation.js` es
código puro: entran números, salen números. No toca el mapa, ni el DOM, ni la red.

### Tres decisiones que se probaron y una que estaba mal

**Proyección sobre el segmento, no al vértice más cercano.** En una avenida los
vértices están a cien metros; quedarse con el más cercano mete medio segmento de
error en la distancia al próximo giro.

**Se trabaja en metros sobre un plano local, no en grados.** Un grado de longitud
no mide lo mismo que uno de latitud, así que la perpendicular sale torcida.
Medido contra GraphHopper: **26.260 m calculados contra 26.256 m informados en un
recorrido de 26 km**.

**La ventana de búsqueda se mide en metros de avance plausible, no en cantidad de
segmentos.** Ésta es la que estaba mal y costó encontrar. Con la ventana contada
en segmentos, un recorrido de camión falla: la Red de Tránsito Pesado obliga a
rodeos y la ruta vuelve sobre calles paralelas. En la ruta de prueba hay **66
tramos que pasan a menos de 40 m de otro tramo**, y uno de ellos —el punto 112—
está **a 19 metros del punto 187, separados por 2,6 km de recorrido**. Con quince
metros de ruido de GPS alcanzaba para que el motor saltara al tramo equivocado; y
como la ventana sólo miraba hacia adelante, no volvía nunca. Acotando por lo que
el camión pudo haber avanzado, ese tramo queda fuera de la búsqueda.

*Medido después del arreglo, 20 corridas atravesando esa zona con ±25 m de ruido:
cero saltos, error máximo 2 metros.*

### Salirse de la ruta

Dos condiciones, y hacen falta las dos: **varios fixes seguidos afuera** —un solo
rebote contra un edificio no puede disparar un recálculo— y **un tiempo mínimo
desde el último**, porque sin esa espera un destino inalcanzable produce una
tormenta de pedidos. El umbral depende de la precisión que informe el GPS: entre
edificios altos un fix trae cincuenta metros de error, y un umbral fijo mandaría
a recalcular en cada cuadra del centro.

**Recalcular no abre un viaje nuevo.** El viaje registrado sigue siendo el mismo:
convertir cada desvío en un viaje partiría el historial en pedazos.

### Los avisos se dan al CRUZAR el umbral

No por estar debajo de él. La diferencia se nota apenas se maneja: con el
criterio de "estar debajo", una maniobra que aparece a 150 m dispara el aviso de
800 y enseguida el de 300, y el conductor escucha *"en 150 metros"* seguido de
*"en 100 metros"* para el mismo giro. **Medido: 35 avisos apelotonados contra 26
con 220 m de separación mínima.**

La primera instrucción del viaje es el caso que la regla deja afuera —se arranca
ya encima de ella—, y se anuncia al iniciar.

### El rumbo de la cámara sale de la ruta, no del GPS

El rumbo del GPS es ruido puro con el camión detenido: da vueltas sobre sí mismo
en un semáforo y el mapa giraría solo. Mientras se sigue la ruta, el rumbo del
segmento es correcto y además estable.

### Cacheo de los estáticos

Al probar esto apareció un problema que **también rompe en producción**: sin
nombres versionados, el navegador se queda con la versión vieja de un módulo y la
sigue ejecutando. En desarrollo se edita un archivo y no cambia nada; publicada,
una corrección no le llega al usuario. Los estáticos se sirven con
`Cache-Control: no-cache, must-revalidate` — que no significa "no guardar" sino
"preguntar antes de reusar", y el servidor contesta 304 sin cuerpo.

---

## AD-24 · El GPS sigue vivo con un servicio en primer plano, sólo durante el viaje

**Problema:** `Geolocation.StartListeningForegroundAsync` de MAUI escucha
únicamente mientras la app está a la vista. Apenas el conductor cambia de app o
apaga la pantalla, Android deja de entregar posiciones y **la navegación se
congela**: la flecha queda clavada en la última cuadra conocida y no vuelve a
avisar ningún giro. Es la diferencia entre un mapa y un navegador.

**Decisión:** un `Service` de Android de tipo `location`, que arranca cuando el
usuario toca *Arrancar viaje* y se apaga al llegar o abandonar.

### La notificación no es opcional

**Android no permite un servicio en primer plano sin notificación.** No es una
decisión de producto: el sistema mata el servicio si no la presenta. Lo que sí se
puede posponer es su contenido — hoy dice *"Viaje en curso · Hacia X"* en un canal
de baja importancia, para que no suene ni vibre. Mostrar ahí la próxima maniobra y
la distancia se resuelve **actualizando esta notificación**, no agregando otra.

### Vive sólo mientras dura el viaje

Un servicio de ubicación permanente sería un abuso de la batería y del permiso, y
la razón por la que a una app la sacan de la tienda. El ciclo es exactamente el
del viaje.

**Es además la única fuente de posiciones durante la navegación.** Tener dos —el
servicio y el de la app en primer plano— significaría dos trenes de *fixes* con
ritmos distintos alimentando el mismo motor de guiado.

### Lo que exige `targetSdk 36`

Tres cosas que, si faltan, no dan error de compilación y rompen en el teléfono:

| Requisito | Desde | Si falta |
|---|---|---|
| `FOREGROUND_SERVICE_LOCATION` y `android:foregroundServiceType="location"` | Android 14 | El sistema mata el servicio apenas arranca |
| Declarar el tipo también en `startForeground(...)` | Android 14 | `SecurityException` |
| `POST_NOTIFICATIONS` en tiempo de ejecución | Android 13 | El servicio corre pero la notificación no se ve |
| `StartForegroundService` en vez de `StartService` | Android 8 | El sistema rechaza el arranque |

**No hace falta `ACCESS_BACKGROUND_LOCATION`**: un servicio de tipo `location`
iniciado con la app a la vista puede seguir leyendo el GPS después. Es como
funcionan todos los navegadores, y pedir el permiso de fondo sin necesitarlo
complica la revisión en la tienda.

**El permiso de notificaciones se pide pero no se exige.** Si el usuario lo niega,
el servicio corre igual y la navegación funciona: lo único que se pierde es ver el
aviso en la barra. Cortar el viaje por eso sería desproporcionado. La ubicación sí
es excluyente, y si falta se le dice — quedarse callado deja una pantalla que no se
actualiza sin ningún motivo visible.

### Dos parámetros elegidos, no heredados

**Un segundo entre posiciones.** Más espaciado y la flecha se mueve a los saltos
justo cuando más importa, en el giro; más seguido no aporta, porque el GPS no
produce *fixes* más rápido.

**Cero metros de distancia mínima.** Filtrar por distancia parece un ahorro y no lo
es: con el camión detenido en un semáforo dejarían de llegar posiciones, y el motor
no podría distinguir *"parado"* de *"el GPS se perdió"*.

**`NotSticky`:** si el sistema mata el proceso, Android no revive el servicio solo.
Un viaje que se reanuda sin que nadie lo pidiera dejaría el GPS prendido sin que el
conductor lo sepa.

### La abstracción

`ITripTracker` existe para que la página que hospeda la web no tenga que saber nada
de servicios, tipos declarados ni permisos. Cuando se agregue iOS, se implementa la
misma interfaz y no se toca nada de arriba.

---

## AD-25 · Las capas de camión son un dataset propio, no un mapa que se compra

**El hallazgo que define la fase.** El pedido de "mapa minimalista con la Red
destacada, los puentes con su altura y los sapitos" son en realidad **dos cosas
distintas**:

- El **fondo** minimalista se resuelve cambiando de proveedor de tiles.
- Las **capas de camión no vienen en ningún mapa del mundo.** Ningún proveedor
  —ni OpenMapTiles, ni Protomaps, ni los comerciales— incluye `hgv`, `maxheight`
  o `railway=level_crossing` como datos consultables. Son basemaps de propósito
  general.

Esa capa hay que construirla, y **es exactamente lo que nadie más tiene**.

### El dataset

`data/fetch-caba-map-layers.ps1` lo genera desde OpenStreetMap, con el mismo
criterio que el dataset de puntos de interés (AD-13): se corre en tiempo de
autoría, el resultado va versionado, y la app trabaja contra el archivo.

| Capa | Objetos | Peso |
|---|---|---|
| Red de Tránsito Pesado | 2.426 tramos (2.112 con nombre) | 619 KB |
| Gálibos declarados | 577 puntos | 95 KB |
| Pasos a nivel | 312 puntos | 47 KB |

761 KB en total, contra 2,58 MB en crudo: las coordenadas se redondean a seis
decimales —unos 11 cm, más precisión de la que tiene el dato— y el archivo pesa
la mitad. Viajan dentro del APK, así que en el teléfono no se descargan.

### Dos reglas del generador que no hay que relajar

**`maxheight=default` no es una altura.** Significa "rige el límite legal", no un
gálibo medido, y son **108 de 685 tramos**. Quedan afuera: mostrar un número
inventado sobre un puente es peor que no mostrar nada.

**Lo que la fuente no declara queda en `null`.** Un paso a nivel sin tipo de
barrera declarado —hay 117— **no es** un paso a nivel sin barrera. Se pinta gris,
no rojo. Es la misma regla que gobierna la aptitud de los puntos de interés
(AD-14).

### El gálibo se pinta según el camión, no en abstracto

Un puente de 4,10 no significa lo mismo para un chasis de 3,20 que para un
semirremolque de 4,20: al primero no le importa y al segundo no le da. El color
se recalcula al cambiar de vehículo — rojo si no pasa, ámbar si le saca menos de
30 cm, neutro si sobra.

*El margen existe porque la altura declarada no siempre contempla el
repavimentado, y un camión cargado se asienta distinto que uno vacío.*

**Para un semirremolque de 4,20 m hay 354 gálibos que no le pasan y 18 que quedan
justos.** Ése es el número que un GPS de autos nunca da.

### La Red se muestra por el nombre, no por el color

El pedido es literal: *"que no se marque con color pero que sea bien visible el
nombre de esta avenida de forma destacada de las demás, para referencia del
camionero"*. Así que el protagonista es el nombre —mayúsculas, espaciado, con
halo, repetido a lo largo del corredor— y la línea va en un gris apenas
perceptible, lo justo para que el nombre no flote sobre la nada.

### Las fuentes tipográficas viajan con la app

**Sin glifos, MapLibre no dibuja ni una letra** — y los nombres de las avenidas
son el punto de esa capa. El estilo raster no declaraba `glyphs`, así que ninguna
etiqueta habría aparecido.

Se vendorizaron los rangos 0–511 de Noto Sans (regular y bold, 419 KB): cubren el
español completo, incluidas las mayúsculas acentuadas. Van en `wwwroot/fonts` en
lugar de pedirse a un servidor: adentro de un camión, una descarga más es una
cosa más que puede fallar.

### Dos trampas del servidor que dan 404 con el archivo en su lugar

**ASP.NET Core no sirve extensiones que no conoce.** `.geojson` y `.pbf` daban 404
con el archivo en disco y la ruta correcta. Se declaran los dos tipos MIME en una
lista blanca, no habilitando cualquier extensión.

**El `catch` que envuelve la descarga no puede envolver también el alta en el
mapa.** Son dos fallas distintas —una del servidor, otra del mapa— y confundirlas
hacía que un "estilo todavía no cargado" se reportara como fallo de red y las
capas no aparecieran nunca sin explicación. Es el mismo error que ya había
costado la ruta invisible (AD-23).

### Lo que falta de esta fase

El **fondo minimalista** sigue pendiente: hoy son los tiles raster de
OpenStreetMap, que además no se pueden distribuir (L-4). El camino es generar
PMTiles del AMBA con Planetiler —que corre sobre el mismo JDK que ya hace falta—
y servirlos como un archivo estático. Resuelve el minimalismo, el modo día y
noche del fondo, y L-4 de una sola vez.
