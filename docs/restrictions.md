# Motor de restricciones

Es el componente prioritario del proyecto. Vive en `TruckNavigator.Domain`, que
no tiene dependencias externas, así que se testea sin infraestructura.

## Las dos mitades

El mismo conjunto de reglas se usa en dos direcciones:

```
                    TruckProfile
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
CabaTruckRoutingPolicy          CabaRestrictionEvaluator
        │                                 │
   custom model                  RestrictionVerdict
        │                                 │
        ▼                                 ▼
  entra al CÁLCULO                 EXPLICA y VERIFICA
  de la ruta                       la ruta devuelta
```

- **`ITruckRoutingPolicy.BuildCustomModel`** traduce el camión al custom model de
  GraphHopper. Los tramos incompatibles reciben prioridad `0` **antes** de que el
  algoritmo elija por dónde ir, así que nunca llegan a formar parte de una ruta
  candidata. Esto es lo que hace que la restricción sea parte del cálculo y no
  una advertencia posterior.
- **`IRestrictionEvaluator.Evaluate`** aplica las mismas reglas sobre los
  atributos de vía que GraphHopper devuelve en los `path_details`. Se usa para el
  panel "por qué" de la app y para que los tests comprueben el resultado.

`GraphHopperRouteCalculator` registra un warning si el evaluador encuentra un
tramo prohibido dentro de una ruta ya calculada: eso significaría que las dos
mitades divergieron.

## Modelo

```csharp
RestrictionVerdict Evaluate(RoadSegmentAttributes segment,
                            TruckProfile truck,
                            DateTimeOffset when);
```

`RestrictionVerdict` tiene tres partes:

| Campo | Significado |
|---|---|
| `IsAllowed` | `false` si el tramo es lisa y llanamente intransitable |
| `RequiresAccessException` | `true` si sólo puede usarse al amparo de la excepción de acceso a origen/destino. **No es una prohibición** |
| `Findings` | Todas las restricciones que aplican, cada una con su fuente |

La distinción entre `IsAllowed` y `RequiresAccessException` es la que evita la
regla incorrecta *"si la calle no pertenece a la Red ⇒ prohibida"*.

## Trazabilidad

Cada `RestrictionFinding` registra por separado el origen de la **regla** y el del
**dato**:

| Restricción | RuleSource | RuleReference | DataSource |
|---|---|---|---|
| Altura, ancho, largo, peso | `Osm` | `OpenStreetMap, etiqueta maxheight=3.5` | `Osm` |
| Camiones prohibidos | `Osm` | `OpenStreetMap, etiqueta hgv=no` | `Osm` |
| Fuera de la Red | `CabaOfficial` | `Ley 2148, arts. 9.10.1 y 9.10.5, mod. Ley 6.401/2020` | `Osm` |

El motivo de la separación está en AD-05 de [decisions.md](decisions.md) y la
limitación que la hace necesaria, en L-1 de [data-sources.md](data-sources.md).

## Reglas implementadas

1. **Límites físicos.** Si la vía declara un límite y el vehículo lo supera, el
   tramo queda prohibido. La longitud se compara contra el **conjunto completo**
   (`TotalLengthMeters` = tractor + acoplado), no contra el tractor solo.
2. **`hgv=no`.** Prohibición explícita, aplica a cualquier camión.
3. **Red de Tránsito Pesado.** Sólo para vehículos de **más de 12 t**. Si el
   tramo no es `hgv=designated`, se marca `RequiresAccessException`.

Una vía sin límite declarado no restringe: GraphHopper devuelve `null` en el
`path_detail` correspondiente y el evaluador lo interpreta como ausencia de
límite.

## Cobertura de tests

19 tests unitarios en `TruckNavigator.UnitTests`, incluyendo los escenarios
pedidos en el plan original:

| Escenario | Esperado |
|---|---|
| Camión 18 t · `maxweight=10` | prohibido |
| Camión 3,80 m · `maxheight=3.50` | prohibido |
| Camión 3,80 m · `maxheight=4.00` | permitido |
| Camión 18 t · `hgv=designated` | permitido sin condiciones |
| Camión 18 t · fuera de la Red | permitido **con** excepción de acceso |
| Camión 7,5 t · fuera de la Red | permitido, la regla no aplica |
| Exactamente 12 t · fuera de la Red | permitido: la norma dice "superior a 12 t" |
| Semirremolque · `maxlength=12` | prohibido (18 m de conjunto) |
| Restricciones combinadas | se reportan **todas**, no sólo la primera |
| Cualquier hallazgo | tiene regla y dato con fuente identificable |

Más 6 tests de integración en `TruckNavigator.IntegrationTests` que rutean contra
GraphHopper con datos reales de CABA y verifican, entre otras cosas, que ningún
tramo incompatible forme parte de la ruta devuelta.
