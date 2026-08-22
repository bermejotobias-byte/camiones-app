# Arquitectura

```
┌──────────────────────────────────────────────┐
│  TruckNavigator.Mobile  (.NET MAUI, Android) │
│  WebView + MapLibre GL JS  ·  GPS nativo     │
└───────────────────┬──────────────────────────┘
                    │  HTTP/REST  (LAN)
                    ▼
┌──────────────────────────────────────────────┐
│  TruckNavigator.Api  (ASP.NET Core, .NET 10) │
│  Minimal API · Swagger · ProblemDetails      │
└───────────────────┬──────────────────────────┘
                    │
      ┌─────────────┴─────────────┐
      ▼                           ▼
┌──────────────┐   ┌──────────────────────────────┐
│ SQLite       │   │ TruckNavigator.Domain        │
│ EF Core      │   │ motor de restricciones       │
│ perfiles     │   │ (sin dependencias externas)  │
└──────────────┘   └──────────────┬───────────────┘
                                  │ custom model
                                  ▼
                   ┌──────────────────────────────┐
                   │ GraphHopper 11.0 (Java)      │
                   │ localhost:8989               │
                   └──────────────┬───────────────┘
                                  ▼
                   ┌──────────────────────────────┐
                   │ argentina-latest.osm.pbf     │
                   │ Geofabrik · ODbL             │
                   └──────────────────────────────┘
```

## Proyectos

| Proyecto | Rol |
|---|---|
| `TruckNavigator.Domain` | Entidades, motor de restricciones, política de ruteo y aptitud de puntos de interés. **Sin dependencias externas**, lo que permite testearlo en milisegundos. |
| `TruckNavigator.Infrastructure` | EF Core sobre SQLite, cliente HTTP de GraphHopper, parseo de `path_details`, datasets de puntos de interés embebidos, registro de DI. |
| `TruckNavigator.Api` | Minimal API, DTOs, validación, Swagger. |
| `TruckNavigator.Mobile` | App MAUI Android. |
| `TruckNavigator.UnitTests` | 65 tests de dominio: restricciones, política de ruteo, aptitud de puntos, reglas del alias y acreditación de viajes. |
| `TruckNavigator.IntegrationTests` | 38 tests: 6 rutean contra GraphHopper con datos reales, 32 verifican los datasets, el perfil, los camiones, el historial de viajes y su persistencia en SQLite. |

La dependencia apunta siempre hacia adentro: `Api → Infrastructure → Domain`.
El motor de restricciones no conoce ni HTTP ni base de datos ni GraphHopper.

## Decisión estructural clave

El motor de restricciones **no está acoplado al frontend ni al motor de ruteo**.
Produce un custom model que GraphHopper consume, y evalúa los tramos que
GraphHopper devuelve. Si mañana se cambia a Valhalla, hay que reescribir
`CabaTruckRoutingPolicy.BuildCustomModel` y el cliente HTTP; las reglas de
negocio y sus tests quedan intactos.

## Preparado para lo que viene

- **iOS**: la app no tiene código específico de plataforma más allá del manifest
  de Android y la ruta `file:///android_asset/`. Agregar `net10.0-ios` al
  `TargetFrameworks` y resolver esa ruta es todo lo que hace falta.
- **Frontend Angular de administración**: la API ya es REST con Swagger y DTOs
  propios. Los endpoints de camiones son un CRUD completo; falta agregar los de
  restricciones y fuentes.
- **PostGIS**: ver AD-06 en [decisions.md](decisions.md). El cambio se limita a
  `DependencyInjection.cs` y una migration.
- **AMBA**: el grafo ya cubre Argentina entera, no sólo CABA. Lo que está acotado
  a CABA es la regla de la Red de Tránsito Pesado, que es normativa municipal.

## Configuración

Todo por `appsettings.json`:

```json
{
  "ConnectionStrings": { "Default": "Data Source=trucknavigator.db" },
  "GraphHopper": { "BaseUrl": "http://localhost:8989", "Profile": "truck", "TimeoutSeconds": 60 },
  "Kestrel": { "Endpoints": { "Http": { "Url": "http://0.0.0.0:5080" } } }
}
```

Kestrel escucha en `0.0.0.0` para que el teléfono llegue por la red local. En la
app, la URL del backend se configura desde la pantalla de camiones ("Configurar
servidor") y se guarda en `Preferences`, así que cambiar de red no obliga a
recompilar.
