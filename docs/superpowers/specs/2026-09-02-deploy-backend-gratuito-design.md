# Backend público y gratuito, construido en GitHub Actions

**Fecha:** 2026-09-02
**Motivo:** poder instalar el APK en varios teléfonos distintos y que todos lleguen
al backend, sin depender de que la máquina de desarrollo esté prendida ni de estar
en la misma red WiFi.

---

## 1. Qué problema resuelve

Hoy el backend sólo existe en la máquina de desarrollo. Para probar en un teléfono
hay tres caminos y ninguno sirve para repartir la app:

| Camino | Por qué no alcanza |
|---|---|
| IP de la red local | Sólo funciona en esa WiFi, y la IP cambia de red en red |
| `adb reverse` por USB | Un teléfono por vez, y con el cable puesto |
| Túnel de `demo-up.ps1` | La máquina tiene que quedar prendida, y la URL cambia en cada arranque |

Con el backend desplegado, cualquier teléfono con datos móviles llega a una URL
fija con HTTPS, y el APK se compila una sola vez apuntando ahí.

---

## 2. Estado de partida (verificado el 2026-09-02)

**Lo que ya existe y está medido:**

- `deploy/` tiene `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.graphhopper`
  y `Caddyfile` con Let's Encrypt automático. Escritos el 2026-08-20 y **nunca
  ejecutados**: la máquina de desarrollo no tiene Docker.
- `docs/deploy.md` documenta el despliegue y ya nombra el *Always Free* de Oracle
  como opción sin costo.
- Consumo medido: GraphHopper con el grafo del AMBA usa **533 MB** de memoria;
  la API con SQLite, ~100 MB. El grafo pesa 42 MB y el jar 46 MB.
- El recorte al AMBA no cambió ninguna ruta: Retiro → Mataderos con semirremolque
  sigue dando 28.182 m, 33,0 min y 91,8 % sobre la Red.

**Lo que falta, y no está anotado en ningún lado:**

| # | Hallazgo | Consecuencia |
|---|---|---|
| 1 | El compose no define `ASPNETCORE_ENVIRONMENT`, así que la imagen corre en `Production` | `Program.cs:128` **tira excepción al arrancar** si falta SMTP: el primer `docker compose up` no levanta |
| 2 | `Dockerfile.api` no copia `amba.pmtiles`, y `Basemap:Directory` resuelve a `/routing` dentro del contenedor | `Directory.Exists` da false **en silencio** y el mapa cae al raster de `tile.openstreetmap.org`, que es justo lo que L-4 desaconseja |
| 3 | `routing/config-truck.yml` está modificado en el árbol de trabajo y apunta a `argentina-latest.osm.pbf`; el commiteado apunta a `amba-latest.osm.pbf` | Un build hecho desde el árbol local, o un `scp -r .` como dice `deploy.md`, **falla**: el Dockerfile sólo copia `amba-latest.osm.pbf` |
| 4 | `amba-latest.osm.pbf` no existe en disco, y Osmosis tampoco (`routing/tools/` está en `.gitignore`) | El recorte del AMBA nunca se corrió en esta máquina |

**Artefactos fuera del repo** (`.gitignore`): `routing/*.jar`, `routing/*.osm.pbf`,
`routing/*.pmtiles`, `routing/graph-cache/`, `routing/tools/`. El workflow tiene
que conseguirlos todos.

---

## 3. Topología

```
GitHub Actions ──build──> GHCR ──pull──> VM Oracle A1 (ARM64)
                                              │
                                    Caddy :443 ──> API :5080 ──> GraphHopper :8989
                                              │
                                        DuckDNS ──> IP pública
```

| Pieza | Dónde | Costo |
|---|---|---|
| Construir las dos imágenes | GitHub Actions, runner ARM | $0 (repo público) |
| Registro de imágenes | GHCR | $0 (paquetes públicos) |
| Correr GraphHopper + API + Caddy | Oracle Always Free, Ampere A1 (ARM) | $0 permanente |
| Nombre y certificado | DuckDNS + Let's Encrypt | $0 |

### Este host es transitorio, y el diseño lo asume

Decisión del usuario (2026-09-02): Oracle es **para poder probar la app en varios
teléfonos**. El alojamiento definitivo va a ser un host pago que cumpla los
requisitos legales — incluida la residencia de los datos, que acá queda fuera de
alcance a propósito.

Dos consecuencias de diseño:

- **Las imágenes se construyen multi-arquitectura** (`linux/arm64` **y**
  `linux/amd64`) desde el primer día. Cuesta unos minutos más de CI y evita
  rehacer el pipeline cuando el host definitivo sea x86, que es lo más probable.
- **No se usa ningún servicio administrado de Oracle.** Sólo Compute, Block Volume
  y la VCN. El TLS lo da Caddy, el nombre DuckDNS, el registro GHCR y la base es
  SQLite en un volumen. Mudarse es levantar la máquina, `docker compose pull` y
  apuntar el DNS.

### Qué consume del proveedor, y su disponibilidad

| Servicio | ¿Del proveedor? | Disponibilidad |
|---|---|---|
| Compute `VM.Standard.A1.Flex` | Sí | Todas las regiones **salvo** Corea del Sur Norte (Chuncheon) |
| Block Volume y VCN | Sí | Universales |
| Certificado y TLS | No — Caddy + Let's Encrypt | — |
| DNS | No — DuckDNS | — |
| Registro de imágenes | No — GHCR | — |
| Base de datos | No — SQLite en volumen | — |
| Geocoding | No — Photon público de Komoot | — |
| Tiles del mapa | No — los sirve la propia API | — |

### Allotment vigente del Always Free (verificado el 2026-09-02)

| Recurso | Cantidad |
|---|---|
| Ampere A1 | **1.500 OCPU-hora y 9.000 GB-hora por mes** = 2 OCPU y 12 GB corriendo 24/7 |
| Micro x86 `E2.1.Micro` | 2 instancias, **1/8 de OCPU** con ráfaga y 1 GB cada una |
| Block Volume | 200 GB totales; volumen de arranque mínimo 47 GB |
| Salida de datos | 10 TB/mes |

Está medido **en horas**: pedir una máquina más grande agota el presupuesto antes
de fin de mes. Hay que dimensionar para correr los 30 días seguidos. Con 633 MB de
necesidad real, **1 OCPU y 6 GB sobra** y además entra más fácil que el máximo.

El plan B de repartir la carga entre los dos micros x86 queda como salida de
emergencia y no como equivalente: **1/8 de OCPU es muy poco** para una JVM
sirviendo rutas.

**La VM no compila nada.** Baja dos imágenes y las levanta. Esa es la decisión que
sostiene todo lo demás: la importación del grafo pide `-Xmx3g` y el recorte pide
`-Xmx6g`, memoria que una VM gratuita chica no tiene. Además hace el host
intercambiable: mudarse de nube es levantar otra máquina y reapuntar el DuckDNS.

---

## 4. El workflow

Archivo nuevo: `.github/workflows/deploy-backend.yml`. Se dispara a mano
(`workflow_dispatch`) y en push a `main` que toque `routing/`, `deploy/` o `src/`.

Usa dos runners, ambos gratis para repositorios públicos: `ubuntu-24.04` para el
recorte del mapa y `ubuntu-24.04-arm` para construir las imágenes. El detalle está
más abajo.

1. **Java 21** (`actions/setup-java`). Lo necesitan Osmosis y la importación.
2. **Osmosis 0.49.2** desde su release de GitHub, usando `bin/osmosis` (el script
   de shell, no el `.bat`).
3. **Extract de Geofabrik** (`argentina-latest.osm.pbf`, 408 MB), cacheado con
   `actions/cache` por fecha. El límite de caché por repositorio son 10 GB.
4. **Recorte del AMBA** con el rectángulo exacto `-59.30 / -35.20 / -57.90 / -34.00`,
   `completeWays=yes` y `-Xmx6g`.
5. **`docker buildx`** de las dos imágenes y push a
   `ghcr.io/bermejotobias-byte/camiones-{api,graphhopper}`.

### Arquitectura: sólo `arm64` por ahora, con la puerta abierta

**Máquina elegida (2026-09-02): `VM.Standard.A1.Flex`, 1 OCPU y 6 GB, ARM64.**

Con el Always Free medido en horas, esa medida consume **730 de 1.500 OCPU-hora**
y **4.380 de 9.000 GB-hora** al mes corriendo 24/7 — la mitad del presupuesto.
Pedir 2 OCPU / 12 GB dejaría el consumo pegado al límite, donde cualquier desvío
factura.

El workflow construye **solamente `linux/arm64`**, que es lo único que se necesita
hoy. La matriz queda escrita con una sola entrada para que sumar `linux/amd64` el
día de la mudanza al host pago sea agregar una línea.

Esto revisa una decisión anterior de este mismo spec, que pedía multi-arquitectura
desde el arranque: con la máquina ARM ya confirmada, construir además una imagen
x86 para un host que todavía no existe es trabajo especulativo, y agrega un paso
de fusión de manifiestos que hoy no compra nada.

**El recorte del AMBA sí se hace una sola vez, en runner x86**, y viaja como
artefacto: el `.pbf` es un archivo de datos, no un binario, así que no depende de
la arquitectura. Lo que sí queda atado a cada arquitectura es la **importación del
grafo**, que ocurre dentro del `docker build` y por eso corre en runner ARM nativo
— sin emulación QEMU, que para una importación sería lentísima.
- **Se usa Osmosis y no `osmium`**, aunque `osmium` sea más rápido y venga en un
  paquete de apt. El recorte actual es el que validó Retiro → Mataderos en
  28.182 m; cambiar de herramienta cambia la semántica de `completeWays` y obliga
  a revalidar el ruteo. No se cambia una herramienta ya validada para ganar
  minutos de CI.
- **El rectángulo del recorte tiene que seguir siendo idéntico al de
  `GeocodingOptions`.** Si se amplía uno sin el otro, el buscador encuentra
  direcciones que el motor no puede rutear.
- **El workflow construye desde el árbol commiteado**, así que el hallazgo #3 se
  esquiva solo. Queda anotado igual porque un build local seguiría fallando.

---

## 5. Cambios en `deploy/`

### `docker-compose.yml`

- Reemplazar `build:` por `image: ghcr.io/...` en `graphhopper` y `api`.
- Agregar a `api`:
  - `ASPNETCORE_ENVIRONMENT: Production` (explícito, no heredado)
  - `Basemap__Directory: /tiles`
  - `Email__*` desde un archivo `.env` **fuera del control de versiones**
- El healthcheck de GraphHopper y el `depends_on` se quedan como están: ya
  resuelven que la API no atienda antes de que el motor esté listo.

### `Dockerfile.api`

- Copiar `amba.pmtiles` a `/tiles` y fijar `Basemap__Directory=/tiles`.
- El archivo no está versionado ni se genera en CI. **Se publica una vez como
  asset de un GitHub Release** (hasta 2 GB por archivo, gratis) y el workflow lo
  baja. Reproducir `data/build-basemap.ps1` en CI es bastante más trabajo para un
  artefacto que cambia una vez por año.

### `Dockerfile.graphhopper`

- Sin cambios. `-Xmx1g` se queda: está medido, y el Always Free de A1 da margen de
  sobra para 533 MB.

---

## 6. Lo que tiene que hacer el usuario (no lo puedo hacer yo)

Estos pasos tienen demora propia y conviene empezarlos en paralelo:

1. **Cuenta de Oracle Cloud** y una instancia **Ampere A1 (ARM)**. Pide tarjeta
   para verificar identidad, sin cobro.
2. **Subdominio en DuckDNS** apuntando a la IP pública de la VM.
3. **Credenciales SMTP** de algún proveedor con plan gratuito.
4. **Publicar `routing/amba.pmtiles` (54 MB) como asset de un GitHub Release con
   el tag exacto `mapa-base-amba`.** El workflow lo busca por ese nombre. El
   archivo está sólo en su disco: no está versionado y no se genera en CI, y la
   máquina de desarrollo no tiene el CLI `gh`, así que el paso es manual desde la
   web del repositorio.

### Sobre el SMTP: por qué no se esquiva

Existe un atajo: correr la API con `ASPNETCORE_ENVIRONMENT=Development`, que
saltea la validación de SMTP **y** siembra la cuenta `demo@camiones.test`. Con eso
se podría probar en varios teléfonos sin configurar mail.

**No se recomienda.** En un servidor público significa dos cosas a la vez: una
credencial conocida y publicada en el repositorio queda activa, y los enlaces de
verificación terminan en el log, con lo que cualquiera que lo lea puede activar
cuentas ajenas. Como la API además no tiene autenticación propia (§8), sumar una
cuenta de acceso conocida empeora bastante el cuadro. La validación de
`Program.cs:128` existe justamente para impedir este atajo, y saltearla es
desactivar un control a propósito.

Si aun así se decide usarlo por un rato, que sea **antes de compartir el dominio
con nadie**, y volver a `Production` antes de repartir el APK.

---

## 7. Riesgos, y qué hacer con cada uno

| Riesgo | Mitigación |
|---|---|
| **Capacidad de A1**: Oracle responde "out of capacity" seguido, y puede llevar días | El diseño no depende del proveedor: si no aparece, se levanta la VM en otro lado y se reapunta el DuckDNS |
| **iptables cerrado dentro de la instancia**: abrir 80 y 443 en la *security list* de la VCN no alcanza, la imagen de Ubuntu de Oracle bloquea todo menos el 22 | Abrir los puertos también en la instancia. Es la causa número uno de "abrí los puertos y no responde"; y sin el 80 Let's Encrypt no puede validar |
| **El compose nunca se ejecutó** | Esperar ajustes en el primer `docker compose up`. No dar por terminado hasta ver `/api/health` respondiendo por HTTPS |

---

## 8. Lo que este deploy NO resuelve

Heredado de `docs/deploy.md`, y conviene tenerlo escrito antes de repartir la app:

- **No hay autenticación de la API**: queda abierta a quien conozca la URL. Sin
  API key ni límite de tasa.
- **Photon sigue siendo la instancia pública de Komoot.** Con varios usuarios
  simultáneos conviene autohospedarlo.
- **Fuera del AMBA no hay ruteo**, por el recorte del grafo. Es deliberado.
- **`network_security_config.xml` sigue permitiendo HTTP en claro.** Con HTTPS no
  hace falta, pero para distribuir en serio hay que borrarlo junto con el atributo
  `android:networkSecurityConfig` del manifiesto. **Queda fuera del alcance de
  este spec**: acá el objetivo es probar en varios teléfonos, no publicar.
- **La clave de firma de distribución** sigue pendiente. Para probar alcanza la de
  desarrollo, que ya es estable y permite actualizar sin desinstalar.

---

## 9. Criterio de terminado

1. El workflow corre completo y publica las dos imágenes en GHCR.
2. En la VM, `docker compose pull && docker compose up -d` deja los tres
   contenedores arriba.
3. `curl https://<dominio>.duckdns.org/api/health` devuelve 200 **desde afuera de
   la red**, no sólo desde la VM.
4. Una ruta de camión real responde por HTTPS.
5. El mapa base se sirve desde `/tiles` y **no** cae al raster de OSM: verificar
   que la consola del WebView no emita el aviso de fallback.
6. Un alta de cuenta nueva **recibe el mail de verificación** en una casilla real.
7. El APK compilado con `-ApiUrl https://<dominio>.duckdns.org` entra desde un
   teléfono con datos móviles, sin WiFi ni cable.
