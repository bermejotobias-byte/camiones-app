# Ruteo

## Configuración del motor

GraphHopper 11.0 corre como servidor HTTP independiente en `localhost:8989`.
La configuración está en `routing/config-truck.yml`.

### Encoded values

Son los atributos de vía que el custom model puede consultar. Si se agrega uno,
hay que **reconstruir el grafo** (`run-graphhopper.ps1 -Rebuild`).

```yaml
graph.encoded_values: road_access, road_class, car_access, car_average_speed,
                      hgv, max_weight, max_weight_except, max_height,
                      max_width, max_length, max_axle_load
```

Unidades: `max_weight` en toneladas, el resto en metros.

### Perfil

```yaml
profiles:
  - name: truck
    turn_costs:
      vehicle_types: [hgv, motorcar, motor_vehicle]
    custom_model_files: [caba_truck.json]

profiles_ch: []
profiles_lm: []
```

`profiles_ch` y `profiles_lm` vacíos ponen al motor en **modo flexible puro**.
Es un requisito para poder mandar un custom model distinto por cada camión
(`ch.disable: true` en el request) y además evita una preparación larga al
arrancar. Las rutas dentro de CABA son cortas, así que el costo por consulta es
despreciable.

> El nombre del archivo de custom model **no puede ser `truck.json`**: GraphHopper
> reserva ese nombre para su modelo interno y falla al arrancar.

## Reparto de responsabilidades del custom model

El modelo base del servidor (`routing/custom_models/caba_truck.json`) contiene
sólo lo que no depende del vehículo: `hgv=no`, vías sin acceso vehicular y vías
privadas.

Lo que depende del camión lo genera `CabaTruckRoutingPolicy` y viaja en el
request. GraphHopper fusiona ambos.

Para un semirremolque de 40 t / 4,20 m / 2,55 m / 18 m:

```json
{
  "priority": [
    { "if": "max_height < 4.2",  "multiply_by": "0" },
    { "if": "max_width < 2.55",  "multiply_by": "0" },
    { "if": "max_length < 18",   "multiply_by": "0" },
    { "if": "max_weight < 40 && max_weight_except == MISSING", "multiply_by": "0" },
    { "if": "hgv != DESIGNATED", "multiply_by": "0.03" }
  ]
}
```

Notas de lectura:

- El encoded value contiene el límite **de la vía**, no la medida del vehículo:
  `max_height < 4.2` significa "el gálibo del tramo es menor que la altura del
  camión, por lo tanto no pasa".
- La última regla sólo se agrega si el vehículo supera las 12 t (ver AD-03).
- Los números se formatean con `CultureInfo.InvariantCulture`. En una máquina con
  locale es-AR una coma decimal partiría la expresión y GraphHopper la
  rechazaría.

## Contrato de la API

### `POST /api/routes`

```json
{
  "truckId": "6f0f1f9c-1a2b-4c3d-8e4f-000000000003",
  "origin":      { "latitude": -34.5900, "longitude": -58.3730 },
  "destination": { "latitude": -34.6580, "longitude": -58.5050 },
  "departureTime": null
}
```

Respuesta:

```json
{
  "distanceMeters": 28182,
  "durationSeconds": 1980,
  "geometry": { "type": "LineString", "coordinates": [[-58.373, -34.590], ...] },
  "instructions": [ { "text": "...", "distanceMeters": 120, "durationSeconds": 18, "streetName": "..." } ],
  "restrictionNotes": [ ... ],
  "accessLegs": [ ... ],
  "heavyNetworkSharePercent": 91.8,
  "truckName": "Semirremolque",
  "attribution": "Datos de mapa © colaboradores de OpenStreetMap (ODbL). ..."
}
```

- **`geometry`** es un GeoJSON LineString, con las coordenadas en orden
  `[longitud, latitud]`.
- **`restrictionNotes`** son los tramos con alguna restricción aplicable, cada uno
  con sus hallazgos y fuentes.
- **`accessLegs`** es el subconjunto que circula fuera de la Red al amparo de la
  excepción de acceso. La app los dibuja punteados en naranja.
- **`heavyNetworkSharePercent`** es la porción del trazado que va por la Red.

Errores: `404` si el camión no existe, `422` si no hay ruta posible para ese
vehículo, `503` si GraphHopper no responde. Todos como `ProblemDetails`.

## Cómo se anota la ruta

GraphHopper devuelve `path_details` como intervalos `[desde, hasta, valor]` sobre
la geometría, y **cada clave tiene sus propios cortes**. `PathDetails.ToSegments()`
recompone tramos homogéneos tomando la unión de todos los límites, y sobre cada
tramo se corre el evaluador de restricciones.

Es lo que permite responder "por qué" con precisión de cuadra en lugar de a nivel
de ruta completa.

## Resultados medidos

Retiro (`-34.5900, -58.3730`) → Mataderos (`-34.6580, -58.5050`):

| Perfil | Distancia | Tiempo | Sobre la Red | Tramos de acceso |
|---|---|---|---|---|
| Camión liviano (7,5 t) | 16,3 km | 22,0 min | 0,6 % | 0 |
| Camión pesado (18 t) | 21,2 km | 24,2 min | 88,8 % | 8 |
| Semirremolque (40 t) | 28,2 km | 33,0 min | 91,8 % | 10 |

Tres vehículos, un mismo par origen/destino, tres trazados distintos. El camión
liviano no tiene obligación de usar la Red y toma el camino corto; los otros dos
la usan casi por completo y difieren entre sí por sus dimensiones.
