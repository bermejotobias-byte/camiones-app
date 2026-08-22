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

**El perfil se crea al primer acceso a `/api/perfil`, no durante el alta:**
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
