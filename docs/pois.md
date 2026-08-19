# Puntos de interés para camiones

El ruteo resuelve *cómo llegar*. Esta capa responde *dónde parar*: playas,
estaciones de servicio, talleres, gomerías y auxilio mecánico pesado.

Se apoya en la misma disciplina que el resto del proyecto: cada punto declara de
dónde salió, y lo que la fuente no dice **queda como desconocido en lugar de
convertirse en una negativa**.

---

## Categorías

| Categoría | Enum | Ícono |
|---|---|---|
| Playas y estacionamientos | `TruckParking` | 🅿️ |
| Estaciones de servicio | `FuelStation` | ⛽ |
| Talleres | `RepairShop` | 🔧 |
| Gomerías | `TyreShop` | 🛞 |
| Auxilio mecánico pesado | `HeavyRoadsideAssistance` | 🚨 |

En el mapa se dibujan como cuadrados de 22 px, distintos de los círculos de 26 px
que usan origen, destino y GPS, para que no se confundan de un vistazo.

Los puntos cuya aptitud **está confirmada** para el camión elegido llevan un ✓
verde. El resto va a color pleno: que la fuente no diga nada no los vuelve
sospechosos, y la ficha lo aclara con todas las letras.

> La primera versión hacía lo contrario —atenuaba los de aptitud desconocida— y
> quedó mal: como son 75 de 78, el mapa entero se veía lavado y la señal no
> distinguía nada. Se marca lo excepcional, no lo habitual.

## Modelo

`TruckNavigator.Domain/Pois/PointOfInterest.cs`. Los identificadores están en
inglés como el resto del código; la correspondencia con los campos pedidos es:

| Campo | Propiedad | Tipo |
|---|---|---|
| id | `Id` | `Guid` |
| nombre | `Name` | `string` |
| categoría | `Category` | `PoiCategory` |
| dirección | `Address` | `string?` |
| barrio | `Neighbourhood` | `string?` |
| latitud / longitud | `Latitude` / `Longitude` | `double` |
| teléfono | `Phone` | `string?` |
| web | `Website` | `string?` |
| horario | `OpeningHours` | `string?` |
| descripción | `Description` | `string?` |
| servicios | `Services` | `IReadOnlyList<string>` |
| apto_camion_liviano | `SuitableForLightTruck` | `bool?` |
| apto_camion_pesado | `SuitableForHeavyTruck` | `bool?` |
| apto_semirremolque | `SuitableForSemiTrailer` | `bool?` |
| apto_acoplado | `SuitableForTrailer` | `bool?` |
| fuente | `Source` + `SourceRetrievedOn` | `string` + `DateOnly` |
| nivel_verificacion | `VerificationLevel` | enum |

### Por qué la aptitud es `bool?`

`null` significa "la fuente no lo dice". No es lo mismo que "no apto".

De los 78 puntos del dataset inicial, **75 no declaran aptitud para camión**:
OpenStreetMap ubica la estación o el taller pero no dice si recibe un
semirremolque. Colapsar eso en `false` sería inventar una restricción, que es
exactamente lo que el proyecto se prohíbe hacer con la normativa.

`PoiSuitability.Accepts` devuelve `bool?` por la misma razón: quien filtra decide
qué hacer con lo desconocido, en lugar de recibirlo ya convertido en negativa.

### Niveles de verificación

| Nivel | Qué significa |
|---|---|
| `Confirmed` | Fuente oficial o el propio operador |
| `Probable` | Lo declara la fuente, sin verificación independiente |
| `NotConfirmed` | La fuente ubica el lugar pero no dice nada sobre aptitud |

Aplica a **los datos del establecimiento, no a su existencia**: un punto de OSM
existe; que reciba camiones es otra pregunta.

Un punto tomado de OSM nunca puede marcarse `Confirmed`, y un `Confirmed` no puede
apoyarse sólo en OSM. Los dos tests de `PoiDatasetTests` lo verifican.

## Cómo se decide la aptitud para el camión elegido

`PoiSuitability.FieldFor` en `TruckNavigator.Domain/Pois/PoiSuitability.cs`:

| Vehículo | Campo consultado |
|---|---|
| `SemiTrailer` | `SuitableForSemiTrailer` |
| `TruckWithTrailer` | `SuitableForTrailer` |
| Rígido > 12 t | `SuitableForHeavyTruck` |
| Rígido ≤ 12 t | `SuitableForLightTruck` |

El umbral sale de `CabaHeavyTrafficRules.HeavyNetworkWeightThresholdKg`, con su
cita normativa; no se repite el número. **El tipo de vehículo manda sobre el
peso**: un semirremolque liviano sigue siendo un semirremolque, porque lo que
limita es la maniobra y no la balanza.

El cálculo lo hace el servidor y viaja en `suitableForSelectedTruck`, así que la
app no reimplementa la regla — mismo criterio que separa `CabaTruckRoutingPolicy`
de `CabaRestrictionEvaluator`.

## API

```
GET /api/pois?categories=FuelStation,TyreShop&truckId=<guid>&suitableOnly=true
```

| Parámetro | Efecto |
|---|---|
| `categories` | Lista separada por comas. Una categoría desconocida devuelve **400**, no se ignora. |
| `truckId` | Completa `suitableForSelectedTruck`. Si el camión no existe, 404. |
| `suitableOnly` | Deja sólo `suitableForSelectedTruck == true`. Requiere `truckId`. |

`suitableOnly` oculta **también lo desconocido**: es la lectura estricta del
filtro. Por eso la app lo trae apagado y avisa cuántos puntos escondió — hoy, para
un semirremolque, esconde los 78.

## Los datos

Archivos JSON versionados en `src/TruckNavigator.Infrastructure/Data/`, embebidos
en el ensamblado. `PoiDataset` levanta **todos** los `pois-*.json`, así que sumar
un relevamiento de producción es agregar un archivo con `isSampleData: false`, sin
tocar código.

| Archivo | Origen | Puntos |
|---|---|---|
| `pois-caba-osm.json` | Generado por `data/fetch-caba-pois.ps1` | 75 |
| `pois-caba-curados.json` | Relevamiento manual con URL por entrada | 3 |

El `Id` se deriva de `Source`, así que es estable entre corridas sin escribir
GUIDs a mano.

### Regenerar el dataset de OSM

```powershell
./data/fetch-caba-pois.ps1 -MaxPerCategory 25
```

Consulta Overpass **en tiempo de autoría**, nunca en tiempo de ejecución. El
script marca aptitud sólo cuando el objeto tiene una etiqueta `hgv` explícita, y
descarta lo que no tiene nombre. De los cientos de objetos disponibles conserva
los mejor documentados de cada categoría; el criterio de corte es la cantidad de
tags útiles (dirección, horario, teléfono, web, operador).

`PointOfInterestSeed` hace *upsert* por id en cada arranque, no "sembrar si está
vacío": regenerar el dataset tiene que reflejarse en una base ya creada. Sólo toca
filas con `IsSampleData = true`; lo que cargue el usuario no se pisa.

### Lo que se dejó afuera a propósito

**PinkGrúas** y **Remolques del Norte** ofrecen auxilio en CABA pero no publican
domicilio ni base. Sin ubicación no hay marcador posible, y ponerles una
coordenada inventada sería exactamente lo que este documento dice que no se hace.
Remolques del Norte, además, no confirma remolque de camiones de carga.

**Grúas El Enganche** sí entró, con una salvedad que viaja en su propia
descripción: la fuente declara base en Villa Lugano pero no publica domicilio, así
que el marcador está en el centro del barrio. La imprecisión está dicha en el
registro, no escondida.

**Auxilio Full Truck** tiene base en San Martín, fuera de CABA, y cobertura
declarada que la incluye. Se carga igual, con el marcador en la base: dejar la
categoría vacía escondería un dato que el camionero necesita. Ver L-5 en
[data-sources.md](data-sources.md).

## En la pantalla

- Botón **Lugares** abajo a la derecha del mapa: abre los filtros por categoría,
  más "Solo aptos para mi camión" y el contador de ocultos.
- Tocar un marcador abre la ficha con todo lo disponible, la fuente, y los botones
  **Usar como destino**, **Llamar** y **Web** (los dos últimos sólo si el dato
  existe).
- El estado de los filtros se guarda en `Preferences`, igual que la URL de la API.

**Usar como destino** pasa por `SetEntryText` y `SetPointAsync`. No es un detalle
de estilo: un punto sólo vale si el texto del campo sigue siendo exactamente la
etiqueta registrada al fijarlo (ver AD-12), así que escribir el `Entry` por fuera
rompería el cálculo de ruta.
