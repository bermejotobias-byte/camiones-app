# Proyecto: Navegador de tránsito pesado para CABA

Quiero desarrollar un MVP de una aplicación móvil de navegación especializada para camiones que circulan por CABA (Ciudad Autónoma de Buenos Aires, Argentina).

La idea general es similar a Waze/Google Maps, pero con una diferencia fundamental:

> La aplicación debe calcular rutas teniendo en cuenta las características físicas y regulatorias del camión utilizado, evitando automáticamente calles, segmentos y rutas que el vehículo no pueda utilizar.

## Contexto del proyecto

El primer alcance geográfico será exclusivamente CABA.

Existe información oficial de la Ciudad de Buenos Aires relacionada con la Red de Tránsito Pesado que debemos utilizar como fuente para construir nuestra capa de restricciones.

El mapa base no debe depender de Google Maps ni Waze.

La opción inicial a evaluar es OpenStreetMap como fuente de datos geográficos, complementada con datos oficiales de CABA y una base de datos propia de restricciones para vehículos pesados.

No quiero copiar ni extraer datos propietarios de Google Maps o Waze.

## Mi experiencia

Mi experiencia de desarrollo es principalmente:

* Angular
* C#
* .NET
* APIs REST
* SQL

Por lo tanto, priorizá tecnologías que me resulten familiares y que permitan mantener una arquitectura razonablemente simple.

No quiero introducir tecnologías innecesariamente complejas solamente porque sean populares.

---

# Objetivo del MVP

Construir una primera versión funcional que permita:

1. Crear/configurar un camión.
2. Especificar sus dimensiones y características.
3. Seleccionar un origen.
4. Seleccionar un destino.
5. Calcular una ruta.
6. Evitar automáticamente calles incompatibles con ese camión.
7. Mostrar la ruta sobre un mapa.
8. Mostrar al usuario por qué una determinada restricción aplica cuando sea relevante.
9. Obtener la posición GPS actual del dispositivo.
10. Mostrar la posición del camión durante el recorrido.

El MVP puede comenzar exclusivamente con Android.

Sin embargo, la arquitectura debe quedar preparada para soportar iOS posteriormente sin tener que reescribir toda la aplicación.

---

# Stack tecnológico preferido

Evaluá inicialmente esta propuesta:

## Mobile

.NET MAUI

Target inicial:

* Android

Target futuro:

* iOS

Quiero aprovechar C#/.NET y evitar desarrollar inicialmente dos aplicaciones completamente separadas.

Para mapas, evaluá alternativas compatibles con .NET MAUI.

No asumas que una determinada librería es la mejor: investigá y justificá la elección.

## Backend

ASP.NET Core Web API utilizando C#.

Preferentemente:

* .NET LTS actual disponible
* REST API
* Dependency Injection
* Entity Framework Core cuando tenga sentido
* Swagger/OpenAPI

## Base de datos

PostgreSQL + PostGIS.

La información geográfica es un componente central del proyecto, por lo que PostGIS debe ser considerada como requisito importante.

## Frontend administrativo

No es necesario desarrollar inicialmente un panel administrativo completo.

Sin embargo, diseñá el backend de forma que posteriormente pueda existir un frontend Angular para administrar:

* calles
* restricciones
* vehículos
* fuentes de datos
* cambios de normativa
* restricciones temporales

---

# Arquitectura deseada

Quiero una arquitectura sencilla pero correctamente separada.

Como punto de partida evaluá:

```text
Mobile App (.NET MAUI)
        |
        | HTTPS / REST
        |
ASP.NET Core API
        |
        +----------------------+
        |                      |
        v                      v
 PostgreSQL/PostGIS       Routing Engine
                              |
                              v
                         OpenStreetMap
```

Pero no tomes este diagrama como una decisión definitiva.

Analizá si el motor de ruteo debería ser:

* GraphHopper
* Valhalla
* OSRM
* otro motor open source

y elegí uno justificando la decisión.

La prioridad es que permita implementar correctamente restricciones para vehículos pesados, especialmente:

* maxweight
* maxheight
* maxwidth
* maxlength
* access restrictions
* turn restrictions
* vehicle-specific restrictions

y que permita agregar posteriormente reglas propias de CABA.

---

# Concepto fundamental: Truck Profile

La aplicación debe tener un modelo de vehículo.

Por ejemplo:

```text
TruckProfile

Id
Name
GrossWeightKg
HeightMeters
WidthMeters
LengthMeters
NumberOfAxles
VehicleType
HasTrailer
TrailerLengthMeters
```

Los campos exactos pueden modificarse si encontrás una mejor modelización.

No quiero que el sistema dependa exclusivamente de "peso".

Debe estar preparado para restricciones por:

* peso
* altura
* ancho
* longitud
* tipo de vehículo
* configuración del vehículo
* cantidad de ejes
* horarios
* restricciones específicas
* calles pertenecientes a la Red de Tránsito Pesado

---

# Motor de restricciones

Este es el componente más importante del proyecto.

Quiero que exista una abstracción clara para determinar si un segmento de calle es compatible con un vehículo.

Conceptualmente:

```csharp
bool IsAllowed(
    RoadSegment segment,
    TruckProfile truck,
    DateTime dateTime
);
```

Pero diseñalo correctamente según lo que encuentres.

La evaluación debería poder considerar:

```text
Truck
   |
   +-- Weight
   +-- Height
   +-- Width
   +-- Length
   +-- Vehicle Type
   |
   v
Restriction Engine
   |
   +-- OSM restrictions
   +-- CABA heavy traffic network
   +-- Maximum dimensions
   +-- Time restrictions
   +-- Access restrictions
   +-- Custom rules
   |
   v
Allowed / Forbidden
```

Es importante que este componente no esté acoplado directamente al frontend.

Debe estar en backend o en el motor de ruteo correspondiente.

---

# Red de Tránsito Pesado de CABA

Investigar y utilizar las fuentes oficiales disponibles del Gobierno de la Ciudad de Buenos Aires.

No inventar los datos.

Necesito que investigues:

1. Qué información oficial existe actualmente.
2. En qué formato está disponible.
3. Si existe API.
4. Si existe GeoJSON.
5. Si existe shapefile.
6. Si existe CSV.
7. Si existe WMS/WFS.
8. Si existe información descargable.
9. Qué normativa regula la circulación de tránsito pesado.
10. Qué restricciones son aplicables a camiones de diferentes características.

Documentá las fuentes utilizadas.

IMPORTANTE:

La información legal/regulatoria debe estar separada de los datos provenientes de OpenStreetMap.

OpenStreetMap será principalmente la fuente de la red vial/geometría.

La normativa oficial de CABA será la fuente de las restricciones regulatorias.

---

# Modelo de datos geográfico

Diseñá las entidades necesarias.

Como mínimo probablemente tendremos algo conceptualmente similar a:

```text
RoadSegment
    Id
    Geometry
    Name
    RoadType
    Direction
    MaxWeight
    MaxHeight
    MaxWidth
    MaxLength
    AccessRestrictions
```

Pero no copies este modelo literalmente.

Diseñá uno apropiado para PostGIS y para el motor de ruteo elegido.

Debe ser posible almacenar restricciones independientes de la geometría cuando sea necesario.

Por ejemplo:

```text
Restriction
    Id
    RoadSegmentId
    RestrictionType
    Value
    Unit
    VehicleType
    ValidFrom
    ValidTo
    StartTime
    EndTime
    Source
    SourceReference
```

También debe poder registrarse el origen de cada restricción.

Ejemplo:

```text
SourceType:
- OSM
- CABA_OFFICIAL
- MANUAL
- TEMPORARY
```

Esto es importante porque posteriormente necesitamos poder auditar de dónde salió una determinada restricción.

---

# Ruteo

El usuario debe poder seleccionar:

```text
Origen
Destino
Camión
```

y obtener:

```text
Ruta compatible
Distancia
Tiempo estimado
```

La ruta NO debe simplemente calcularse primero y luego mostrar advertencias.

La restricción debe formar parte del cálculo de la ruta.

Ejemplo:

```text
Ruta A
----------------
Calle X
✓ 18.000 kg permitido
✓ 3.80 m altura
✓ 2.50 m ancho
✓ 12 m largo

Calle Y
✕ altura máxima 3.50 m

=> Ruta descartada
```

El motor debe buscar una alternativa válida.

---

# Caso especial: acceso a destinos

Tené en cuenta que la regulación de CABA puede permitir que determinados vehículos accedan a destinos fuera de la Red de Tránsito Pesado cuando necesitan realizar una operación de carga/descarga.

Por lo tanto, NO implementes simplemente:

```text
"Si la calle no pertenece a la Red de Tránsito Pesado => prohibida"
```

La lógica debe permitir modelar correctamente:

```text
Red de Tránsito Pesado
        |
        |
        +------ acceso autorizado ------> destino
        |
        +------ acceso autorizado ------> origen
```

La normativa debe investigarse antes de implementar esta lógica.

Si la normativa no puede ser modelada con seguridad, documentá la limitación en lugar de inventar una regla.

---

# Datos de OpenStreetMap

Investigar la mejor forma de obtener los datos de OpenStreetMap para CABA.

Evaluar:

* descarga regional
* extract de OSM
* Overpass
* Geofabrik
* planet/extracts
* importación directa a PostGIS
* osm2pgsql
* imposm
* otra alternativa

Quiero evitar depender de consultas públicas de Overpass en tiempo real para cada navegación.

Preferentemente los datos deberían estar almacenados/controlados por nosotros.

Documentá:

* cómo importar los datos
* cómo actualizar los datos
* cómo mantenerlos sincronizados
* qué licencia/apertura debemos respetar
* atribución requerida

---

# Navegación

Para el MVP Android:

Necesito:

* GPS
* posición actual
* mapa
* ruta
* seguimiento de posición
* distancia restante
* destino
* instrucciones básicas de navegación

No es necesario implementar inicialmente todas las funcionalidades de Waze.

NO implementar todavía:

* chat
* red social
* cuentas complejas
* publicidad
* pagos
* reportes de usuarios
* tráfico colaborativo
* integración con empresas
* telemetría avanzada

Primero quiero validar el concepto fundamental:

> "¿Podemos calcular y mostrar correctamente una ruta válida para un camión específico en CABA?"

---

# UX mínima

La aplicación debe tener como mínimo:

## Pantalla 1 — Selección de camión

Mostrar los perfiles disponibles.

Ejemplo:

```text
Camión Mercedes
18.000 kg
3,80 m
2,50 m
12,00 m
```

Botón:

```text
Seleccionar
```

y opción:

```text
Nuevo camión
```

## Pantalla 2 — Navegación

Mostrar:

* mapa
* posición actual
* ruta
* origen
* destino
* camión seleccionado

## Pantalla 3 — Configuración del camión

Formulario:

```text
Nombre
Peso máximo
Altura
Ancho
Longitud
Cantidad de ejes
Tipo de vehículo
Tiene acoplado
```

Utilizar unidades métricas.

---

# Datos de prueba

Necesito que construyas datos de prueba para demostrar el concepto.

Crear algunos perfiles:

### Camión liviano

```text
Peso: 7.500 kg
Altura: 3.20 m
Ancho: 2.40 m
Largo: 8 m
```

### Camión pesado

```text
Peso: 18.000 kg
Altura: 3.80 m
Ancho: 2.50 m
Largo: 12 m
```

### Semirremolque

```text
Peso: 40.000 kg
Altura: 4.20 m
Ancho: 2.55 m
Largo: 18 m
```

Estos valores son únicamente para testing y NO deben interpretarse como límites legales.

---

# Testing

Quiero tests automatizados.

Especialmente para el motor de restricciones.

Ejemplos:

```text
Camión 18t
Calle maxweight 10t
=> forbidden
```

```text
Camión altura 3.80m
Calle maxheight 3.50m
=> forbidden
```

```text
Camión altura 3.80m
Calle maxheight 4.00m
=> allowed
```

```text
Camión 18t
Calle perteneciente a Red Tránsito Pesado
=> allowed, siempre que no existan otras restricciones
```

También tests de:

* rutas
* restricciones por horario
* restricciones combinadas
* acceso a destino
* datos geográficos

---

# Requisitos de calidad

Quiero:

* código limpio
* nombres claros
* SOLID donde realmente aporte valor
* Dependency Injection
* configuración mediante appsettings
* logging
* manejo de errores
* validación de inputs
* DTOs
* migrations
* documentación

No quiero sobreingeniería.

No crear 25 proyectos .NET si no son necesarios.

Prefiero una solución que pueda entender y mantener fácilmente.

---

# Docker

Preparar Docker Compose para desarrollo.

Como mínimo:

```text
PostgreSQL + PostGIS
```

Si el motor de ruteo seleccionado puede ejecutarse mediante Docker, evaluar incluirlo también.

Idealmente:

```text
docker compose up
```

debería permitir levantar la infraestructura necesaria para desarrollo.

---

# API

Diseñar endpoints REST claros.

Por ejemplo:

```http
GET /api/trucks
POST /api/trucks
GET /api/trucks/{id}
PUT /api/trucks/{id}
DELETE /api/trucks/{id}
```

Y:

```http
POST /api/routes
```

Request conceptualmente:

```json
{
  "truckId": "...",
  "origin": {
    "latitude": -34.60,
    "longitude": -58.38
  },
  "destination": {
    "latitude": -34.62,
    "longitude": -58.42
  }
}
```

Response conceptualmente:

```json
{
  "distanceMeters": 12345,
  "durationSeconds": 2400,
  "geometry": "...",
  "instructions": []
}
```

Diseñá el contrato definitivo de acuerdo con la solución implementada.

---

# Importante: investigación antes de implementación

Antes de empezar a escribir código, investigá la viabilidad actual de:

1. OpenStreetMap
2. GraphHopper
3. Valhalla
4. OSRM
5. .NET MAUI
6. librerías de mapas compatibles con .NET MAUI
7. datos oficiales de tránsito pesado de CABA
8. normativa de tránsito pesado de CABA
9. PostGIS

Usá documentación oficial siempre que sea posible.

No asumas que una API o librería mencionada en este prompt sigue disponible o funciona exactamente como se describe.

---

# Entregables

Quiero que trabajes en estas etapas.

## Etapa 1 — Análisis

Antes de modificar código:

* inspeccioná el repositorio
* detectá si existe código previo
* analizá estructura
* proponé arquitectura
* investigá las tecnologías
* investigá las fuentes de datos
* identificá riesgos

Crear:

```text
/docs/architecture.md
/docs/data-sources.md
/docs/routing.md
/docs/restrictions.md
/docs/decisions.md
```

En `decisions.md` registrar las decisiones arquitectónicas importantes y sus motivos.

## Etapa 2 — Skeleton

Crear la solución base:

```text
/src
  /TruckNavigator.Api
  /TruckNavigator.Domain
  /TruckNavigator.Infrastructure
  /TruckNavigator.Mobile

/tests
  /TruckNavigator.UnitTests
  /TruckNavigator.IntegrationTests
```

Si después del análisis considerás que otra estructura es mejor, explicá por qué y aplicala.

## Etapa 3 — Persistencia

Implementar:

* PostgreSQL
* PostGIS
* EF Core
* migrations
* entidades
* seed inicial

## Etapa 4 — Importación de datos

Implementar el mecanismo necesario para importar:

* OpenStreetMap
* datos oficiales de CABA

No introducir datos inventados como si fueran datos oficiales.

Si alguna fuente no puede automatizarse todavía, crear un mecanismo de importación manual reproducible.

## Etapa 5 — Restriction Engine

Implementar el motor de restricciones.

Este es el componente prioritario.

## Etapa 6 — Routing

Integrar el motor de ruteo elegido.

Implementar:

```text
origin + destination + truck
              ↓
        valid route
```

## Etapa 7 — API

Implementar la API REST.

## Etapa 8 — Android

Implementar la aplicación .NET MAUI Android.

Primero funcional, no visualmente perfecta.

## Etapa 9 — Testing

Agregar tests y escenarios reales.

## Etapa 10 — Documentación

Documentar cómo ejecutar todo desde cero.

---

# Criterio de éxito del MVP

Consideraré que el MVP es exitoso si puedo:

1. Levantar la infraestructura con Docker.
2. Ejecutar el backend .NET.
3. Ejecutar la aplicación Android.
4. Crear un camión.
5. Definir sus dimensiones.
6. Seleccionar origen/destino.
7. Solicitar una ruta.
8. Obtener una ruta calculada específicamente para ese camión.
9. Ver la ruta sobre un mapa.
10. Comprobar mediante tests que una calle incompatible no forma parte de la ruta.
11. Verificar que las restricciones utilizadas tienen una fuente identificable.

---

# Principios importantes

1. No utilizar Google Maps/Waze como fuente de datos.
2. No copiar datos propietarios.
3. Preferir OpenStreetMap para la red geográfica.
4. Utilizar fuentes oficiales para normativa CABA.
5. Separar datos geográficos de reglas regulatorias.
6. Mantener trazabilidad de las fuentes.
7. El camión es parte del cálculo de ruta, no simplemente un filtro visual.
8. Las restricciones deben evaluarse antes/durante el cálculo de ruta.
9. No inventar restricciones legales.
10. Diseñar para CABA primero, pero sin bloquear una futura expansión a AMBA.
11. Android primero, iOS después.
12. Mantener el stack lo más cercano posible a C#/.NET.
13. Evitar sobreingeniería.
14. Todo lo que sea una decisión importante debe quedar documentado.

---

# Forma de trabajar

No implementes todo de una sola vez.

Trabajá incrementalmente.

Después de cada etapa:

1. ejecutá los tests
2. verificá que compile
3. documentá lo realizado
4. indicá los problemas encontrados
5. continuá con la siguiente etapa

Si encontrás una decisión que puede cambiar significativamente la arquitectura, detenete y explicala antes de continuar.

Si una fuente oficial de datos no puede ser obtenida automáticamente, NO reemplazarla silenciosamente por datos ficticios.

El objetivo principal no es producir muchas líneas de código.

El objetivo es construir una prueba técnica sólida de que podemos hacer:

> "Dado un camión con dimensiones X/Y/Z y peso W, encontrar una ruta válida para ese vehículo dentro de CABA."

Comenzá por inspeccionar el repositorio actual y realizar la Etapa 1.
