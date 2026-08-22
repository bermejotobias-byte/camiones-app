# Navegador de tránsito pesado — CABA

Navegación para camiones que calcula rutas **según las características físicas y
regulatorias del vehículo**, evitando calles por las que ese camión no puede
circular.

La restricción forma parte del cálculo de la ruta, no es una advertencia
posterior: los tramos incompatibles reciben prioridad cero antes de que el
algoritmo elija por dónde ir.

## Qué demuestra el MVP

Retiro → Mataderos, mismo par origen/destino, tres vehículos:

| Perfil | Distancia | Tiempo | Sobre la Red de Tránsito Pesado |
|---|---|---|---|
| Camión liviano (7,5 t) | 16,3 km | 22,0 min | 0,6 % |
| Camión pesado (18 t) | 21,2 km | 24,2 min | 88,8 % |
| Semirremolque (40 t) | 28,2 km | 33,0 min | 91,8 % |

El liviano no está obligado a usar la Red y toma el camino corto. Los otros dos
la usan casi por completo, y salen de ella sólo para acceder a origen y destino
—la excepción que concede el art. 9.10.1 de la Ley 2148—. Sin esa regla, el
semirremolque tomaría un atajo de 16,3 km que sería ilegal.

## Stack

| Capa | Tecnología |
|---|---|
| Móvil | .NET MAUI (Android), WebView + MapLibre GL JS |
| Backend | ASP.NET Core 10, Minimal API, Swagger |
| Cuentas | ASP.NET Core Identity, tokens de portador |
| Datos | EF Core + SQLite |
| Ruteo | GraphHopper 11.0 |
| Mapa | OpenStreetMap (ODbL) |

## Puesta en marcha desde cero

### Requisitos

- .NET SDK 10
- Microsoft OpenJDK 21 — `winget install --id Microsoft.OpenJDK.21`
  (.NET Android soporta JDK 17–21; con el 22 el build falla)
- Workloads de MAUI — `dotnet workload restore`

### 1. Motor de ruteo

```powershell
cd routing
.\run-graphhopper.ps1
```

La primera vez descarga el JAR (45 MB) y el extract de Argentina (407 MB) y
construye el grafo. Tarda alrededor de un minuto. Queda escuchando en
`http://localhost:8989`.

### 2. Backend

```powershell
dotnet run --project src/TruckNavigator.Api
```

Escucha en `http://0.0.0.0:5080`. Aplica las migrations y siembra los tres
perfiles de prueba al arrancar. Swagger en <http://localhost:5080/swagger>.

### 3. App Android

Con el teléfono conectado por USB y la depuración USB activada:

```powershell
dotnet build src/TruckNavigator.Mobile -f net10.0-android -t:Run
```

Si el teléfono bloquea la instalación por adb (`INSTALL_FAILED_USER_RESTRICTED`,
habitual en Xiaomi cuando *Instalar vía USB* está deshabilitado), usá el script,
que deja el APK en Descargas para instalarlo tocándolo:

```powershell
.\build-apk.ps1 -Push
```

> **Usá siempre el script para armar APKs de Release.** Una compilación
> incremental en Release produce un APK que aborta al arrancar con
> *"Compressed assembly is larger than when the application was built"*. El
> script limpia `obj/` y `bin/` antes de compilar, que es lo que lo evita.

La app apunta por defecto a `http://192.168.1.60:5080`. Si tu IP es otra,
cambiala desde **Configurar servidor** en la pantalla de camiones —no hace falta
recompilar—. Para averiguarla:

```powershell
(Get-NetIPConfiguration | Where-Object IPv4DefaultGateway).IPv4Address.IPAddress
```

### 4. Tests

```powershell
dotnet test
```

65 tests unitarios de dominio (restricciones, aptitud de puntos de interés, reglas
del alias y acreditación de viajes, sin infraestructura) y 38 de integración: 6 contra
GraphHopper —que se saltean solos si el motor no está levantado— y 32 sobre los
datasets, el perfil, los camiones, el historial de viajes y su persistencia en SQLite.

## Uso

1. **Seleccionar camión** — elegí un perfil o creá uno nuevo con sus dimensiones.
2. **Navegación** — escribí la dirección de origen y destino: aparece un
   autocompletado a los tres caracteres. También podés **mantener apretado** el
   mapa para fijar un punto (se resuelve la dirección sola), o usar **GPS** para
   partir de tu posición. Después, **Calcular ruta**. Un toque simple sólo cierra
   los paneles abiertos: no mueve los puntos.
3. La ruta se dibuja en azul; los tramos fuera de la Red de Tránsito Pesado, en
   naranja punteado. Abajo aparece cada restricción con **la regla que la impone y
   el dato del que sale**.
4. **Lugares** (botón abajo a la derecha del mapa) muestra playas, estaciones de
   servicio, talleres, gomerías y auxilio pesado, filtrables por categoría.
   Tocando un marcador se abre la ficha con su fuente, y desde ahí se puede llamar,
   abrir la web o fijarlo como destino.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Estructura, proyectos, extensibilidad |
| [docs/decisions.md](docs/decisions.md) | Decisiones arquitectónicas y sus motivos |
| [docs/data-sources.md](docs/data-sources.md) | Fuentes, licencias y **limitaciones abiertas** |
| [docs/restrictions.md](docs/restrictions.md) | Motor de restricciones y cobertura de tests |
| [docs/routing.md](docs/routing.md) | Configuración de GraphHopper y contrato de la API |
| [docs/pois.md](docs/pois.md) | Puntos de interés: modelo, datos y cómo regenerarlos |
| [docs/deploy.md](docs/deploy.md) | Sacar la app de la red local: túnel HTTPS y servidor propio |

## Limitaciones que hay que conocer

- La pertenencia a la Red de Tránsito Pesado se toma de OpenStreetMap
  (`hgv=designated`), que es una transcripción comunitaria. **La capa oficial del
  GCBA no está publicada** como dato abierto. Ver L-1 en
  [data-sources.md](docs/data-sources.md).
- **No se modelan restricciones horarias**: no se encontró una norma horaria
  general confirmada y no se inventó ninguna. Ver L-2.
- Los tiles de `tile.openstreetmap.org` sirven para el MVP pero no para
  distribuir la app. Ver L-4.
- **Las playas de camiones y el auxilio pesado casi no tienen fuente en CABA**: el
  dataset trae 1 y 2 puntos contra 25 de cada una de las otras categorías. No se
  rellenó con establecimientos inventados. Ver L-5.
- **La aptitud para camión casi nunca está declarada**: 75 de 78 puntos la tienen
  como desconocida, así que el filtro "solo aptos para mi camión" esconde casi
  todo. Es dato faltante, no un error del filtro. Ver L-6.
- El acceso por HTTP plano desde el teléfono está habilitado sólo para la IP de
  desarrollo, en `Platforms/Android/Resources/xml/network_security_config.xml`.

## Atribución

Datos de mapa © colaboradores de OpenStreetMap, disponibles bajo
[ODbL](https://opendatacommons.org/licenses/odbl/). Restricciones regulatorias
según la Ley 2148 de la Ciudad Autónoma de Buenos Aires.


## Cuentas

El alta, la verificación por mail y el perfil del camionero ya están en la API.
**La app Android todavía no los usa**: se agregan cuando se rehaga el frontend.
Por ahora se prueban desde `/swagger` o por HTTP.

| Endpoint | Qué hace |
|---|---|
| `POST /api/auth/register` | Alta con mail y contraseña. Dispara el mail de verificación. |
| `GET /api/auth/confirmEmail` | Confirma la dirección. Sin esto **no se puede iniciar sesión**. |
| `POST /api/auth/login` | Devuelve `accessToken` y `refreshToken`. |
| `POST /api/auth/refresh` | Renueva el token. |
| `POST /api/auth/forgotPassword` · `/resetPassword` | Recuperación de contraseña. |
| `GET /api/profile` | Perfil del usuario autenticado. Lo crea en el primer acceso. |
| `PUT /api/profile` | Guarda nombre, apellido, alias y avatar. |
| `GET /api/profile/alias-available?alias=` | Avisa si el alias está libre mientras se escribe. |

El alias es **único e irrepetible** y no distingue mayúsculas: `ElGaucho` y
`elgaucho` son el mismo. Nombre, apellido y avatar son opcionales, porque el alta
permite saltear ese paso.

### Mail: qué pasa si no lo configurás

Sin la sección `Email` de `appsettings.json` completa, la aplicación **no manda
ningún mail** y escribe el enlace de verificación en el log del backend. Es lo que
permite probar el alta sin contratar un proveedor:

```
warn: SMTP sin configurar: no se envio ningun mail. confirmacion de cuenta para vos@ejemplo.com:
      http://localhost:5080/api/auth/confirmEmail?userId=...&code=...
```

**En producción eso es inseguro** —cualquiera con acceso al log podría verificar
cuentas ajenas— así que el arranque corta con una excepción si el entorno es
`Production` y no hay SMTP. Ver [docs/deploy.md](docs/deploy.md).

## Camiones

Un camión pertenece a una cuenta. Las tres del catálogo no son de nadie: sirven
para elegir el tipo de transporte la primera vez, con sus medidas a la vista.

| Endpoint | Sesión | Qué hace |
|---|---|---|
| `GET /api/trucks` | Opcional | Los camiones del usuario más las plantillas. Sin sesión, sólo las plantillas. |
| `GET /api/trucks/templates` | No | Los tipos de transporte con altura, peso, largo y ejes. |
| `GET /api/trucks/{id}` | Opcional | Uno propio o una plantilla. El de otra cuenta da 404. |
| `POST /api/trucks` | **Sí** | Carga un camión propio. |
| `PUT` · `DELETE /api/trucks/{id}` | **Sí** | Sólo sobre los propios. Las plantillas dan 403. |

> **Ojo con la app Android:** todavía no tiene login, así que **crear y editar
> camiones desde la app devuelve 401** hasta que se rehaga el frontend. Leer las
> plantillas y calcular rutas con ellas sigue andando sin sesión, así que la demo
> de ruteo no se rompe. Ver AD-19 en [docs/decisions.md](docs/decisions.md).

## Viajes

Un viaje es la unidad del historial y la fuente de los kilómetros. Arrancarlo
**rutea en el servidor**: el cliente nunca informa distancias.

| Endpoint | Qué hace |
|---|---|
| `POST /api/trips` | Arranca un viaje. Devuelve el viaje y la ruta para navegar. |
| `POST /api/trips/{id}/finish` | Llegaste. Acredita los kilómetros que correspondan. |
| `POST /api/trips/{id}/cancel` | Lo abandonaste. No acredita nada. |
| `GET /api/trips` | Historial, del más nuevo al más viejo. `limit` y `offset`. |
| `GET /api/trips/stats` | Kilómetros acumulados, viajes y tiempo al volante. |
| `GET /api/trips/{id}` | Un viaje propio. |

Todos piden sesión. Hay **un viaje abierto por vez**: arrancar otro devuelve 409
con el id del que quedó sin cerrar.

Los kilómetros se acreditan sólo si transcurrió al menos **la mitad de la
duración estimada**. Es una regla de plausibilidad —evita que abrir y cerrar un
viaje al instante regale la distancia—, **no una verificación de que el camión
recorrió la ruta**. Eso llega con la navegación paso a paso. Ver AD-20 en
[docs/decisions.md](docs/decisions.md).
