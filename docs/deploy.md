# Poner la app a andar fuera de la red local

El backend son dos piezas: **la API** (chica) y **GraphHopper** (el peso). El
geocoder y los tiles ya son servicios públicos, así que no hay nada que hostear
de ese lado.

| Pieza | Tamaño | Memoria |
|---|---|---|
| GraphHopper + grafo del AMBA | 46 MB (jar) + 42 MB (grafo) | 533 MB medidos |
| API + SQLite | pocos MB | ~100 MB |

Antes el grafo cubría Argentina entera: 337 MB y 1.073 MB de memoria. El recorte
al AMBA (`routing/crop-amba.ps1`) lo bajó a 42 MB y 533 MB **sin cambiar ninguna
ruta** — Retiro → Mataderos con semirremolque sigue dando 28.182 m, 33,0 min y
91,8 % sobre la Red. Con eso entra en la VM más barata que haya.

> El recorte usa el **mismo rectángulo** con el que el geocoder acota sus
> resultados. Mantener esa coincidencia garantiza que todo lo que el buscador
> encuentra se puede rutear. Si ampliás uno, ampliá el otro.

---

## Opción 1 · Túnel desde tu máquina (para demostrar ya)

```powershell
./demo-up.ps1                                    # imprime la URL pública
./build-apk.ps1 -ApiUrl <esa URL> -Push          # APK apuntando ahí, e instala
```

`demo-up.ps1` levanta GraphHopper, la API y un túnel de Cloudflare. El teléfono
llega desde cualquier red, con datos móviles o WiFi ajeno.

**Se expone sólo la API.** GraphHopper queda en `localhost`: la app nunca lo
consulta directo, así que no hay motivo para publicarlo.

Para bajar todo: `./demo-down.ps1`.

### Lo que hay que saber

- **Tu máquina tiene que quedar prendida** mientras dure la demo.
- **La URL cambia en cada arranque del túnel**, porque un túnel rápido de
  Cloudflare no pide cuenta ni dominio y a cambio da un nombre al azar. Por eso
  `build-apk.ps1` acepta `-ApiUrl`: reescribe `DefaultBaseUrl` y compila, sin
  editar código a mano. La alternativa sin recompilar es pegar la URL en
  *Configurar servidor* desde el teléfono, pero es larga y molesta de tipear.
- Para una URL fija hace falta un túnel con nombre, que sí pide cuenta de
  Cloudflare y dominio propio. Si vas a repetir la demo, conviene ir directo a la
  opción 2.

### Si la URL no responde desde tu máquina

Pasó durante la puesta a punto: el túnel estaba arriba y el teléfono contestaba
**HTTP 200**, pero desde la notebook el hostname daba "No such host is known".
Los subdominios de `trycloudflare.com` se crean recién al abrir el túnel, y
algunos resolvedores tardan en verlos o directamente no resuelven los nuevos.

`demo-up.ps1` distingue los dos casos: si el hostname resuelve por `1.1.1.1` pero
no por tu DNS, avisa que el túnel está bien y que el teléfono probablemente
llegue igual, en vez de reportar un fallo. Para confirmarlo:

```powershell
adb shell "curl -s -m 20 https://<tu-url>.trycloudflare.com/api/health"
```

**Lo que importa es lo que ve el teléfono, no lo que ve la notebook.**

### Por qué HTTPS no es opcional

Android bloquea el tráfico sin TLS. Hoy hay una excepción en
`Platforms/Android/Resources/xml/network_security_config.xml` para
`192.168.1.60`, que existe **sólo para desarrollo**. El túnel entrega HTTPS de
verdad, así que no hace falta tocar nada — y para distribuir la app en serio hay
que borrar ese archivo junto con el atributo `android:networkSecurityConfig` del
manifest.

---

## Opción 2 · Servidor propio (para que ande sin vos)

Todo lo necesario está en `deploy/`. Tres contenedores: GraphHopper, la API y
Caddy, que consigue y renueva el certificado de Let's Encrypt solo.

> **Sin probar todavía.** La máquina de desarrollo no tiene Docker, así que estos
> archivos se escribieron pero no se ejecutaron. Esperá algún ajuste en el primer
> `docker compose up`.

### 1. La VM

Alcanza con **1 vCPU y 2 GB de RAM**. Sirve el plan más barato de Hetzner
(~4 €/mes), DigitalOcean o Vultr; el *Always Free* de Oracle Cloud lo cubre sin
costo. Distribución: cualquier Debian o Ubuntu reciente.

Abrí los puertos **80 y 443**. El 80 no es opcional: por ahí pasa la validación
del certificado.

### 2. El nombre

Sin dominio propio, [DuckDNS](https://duckdns.org) alcanza y es gratis: entrás
con una cuenta de GitHub o Google, elegís un subdominio y lo apuntás a la IP de
la VM. Queda algo como `micamion.duckdns.org`, y Let's Encrypt emite
certificados para esos dominios sin problema.

### 3. Subir el proyecto

```bash
# Desde tu máquina
scp -r . usuario@IP:/opt/trucknavigator
```

El `.gitignore` excluye `routing/*.osm.pbf`, `routing/*.jar` y
`routing/graph-cache/`, así que si clonás desde git en vez de copiar, en el
servidor van a faltar. El build de la imagen necesita **dos** de esos archivos:

- `routing/graphhopper-web-11.0.jar` — lo baja `run-graphhopper.ps1`, o se
  descarga suelto desde el release 11.0 de GraphHopper.
- `routing/amba-latest.osm.pbf` — lo genera `crop-amba.ps1` (44 MB, se copia bien
  por scp).

El grafo **no** hace falta subirlo: la imagen lo construye durante el build.

### 4. Levantar

```bash
cd /opt/trucknavigator/deploy
DOMAIN=micamion.duckdns.org docker compose up -d --build
```

El primer build tarda unos minutos: compila la API e importa el grafo. Después
los contenedores arrancan en segundos, porque el grafo ya está adentro de la
imagen.

Comprobación:

```bash
curl https://micamion.duckdns.org/api/health
curl https://micamion.duckdns.org/api/pois | head -c 200
```

### 5. Apuntar la app

Cambiá `DefaultBaseUrl` en
`src/TruckNavigator.Mobile/Services/TruckNavigatorApi.cs` al dominio nuevo y
corré `./build-apk.ps1`.

### Qué persiste y qué no

`api-data` guarda la base SQLite, así que los camiones que cargue el usuario
sobreviven a un redeploy. Los puntos de interés **no** se guardan ahí en el
sentido de quedar congelados: el seed los vuelve a sembrar desde los datasets
embebidos en cada arranque, y respeta lo que haya cargado el usuario. Ver
[pois.md](pois.md).

---

## Actualizar los datos

| Qué | Cómo |
|---|---|
| Red vial (OSM) | Volver a bajar el extract, correr `crop-amba.ps1 -Rebuild` y reconstruir la imagen |
| Puntos de interés | `./data/fetch-caba-pois.ps1` y redeploy de la API |
| Perfiles de camión | Se cargan desde la app, no requieren deploy |

---

## Lo que este deploy no resuelve

- **No hay autenticación.** La API queda abierta a quien conozca la URL. Para una
  demo está bien; para algo público hace falta al menos una API key.
- **Los tiles siguen saliendo de `tile.openstreetmap.org`**, cuya política de uso
  desaconseja el consumo desde aplicaciones. Ver L-4 en
  [data-sources.md](data-sources.md).
- **Photon sigue siendo la instancia pública de Komoot.** Con varios usuarios
  simultáneos conviene autohospedarlo; se alimenta con el mismo extract que ya
  usamos.
- **Fuera del AMBA no hay ruteo**, por el recorte del grafo. Es deliberado y
  reversible: apuntar `datareader.file` de vuelta a `argentina-latest.osm.pbf`,
  borrar `graph-cache` y ampliar el recorte del geocoder.

## Mail: obligatorio en producción

Desde que existen las cuentas, el backend **no arranca en `Production` sin SMTP
configurado**. Es deliberado: sin envío de mail el enlace de verificación termina
en el log, y cualquiera que lo lea podría activar cuentas ajenas.

Completá la sección `Email` de `appsettings.json` —o, mejor, pasala por variables
de entorno para no versionar la contraseña—:

```json
"Email": {
  "Host": "smtp.tuproveedor.com",
  "Port": 587,
  "UseStartTls": true,
  "User": "no-responder@tudominio.com",
  "Password": "",
  "FromAddress": "no-responder@tudominio.com",
  "FromName": "Navegador de Transito Pesado"
}
```

Por variables de entorno, con el doble guion bajo como separador:

```bash
Email__Host=smtp.tuproveedor.com
Email__User=no-responder@tudominio.com
Email__Password=la-clave
```

**La contraseña no va al repositorio.** En el `docker-compose.yml` del deploy,
pasala por `environment` desde un archivo `.env` que quede fuera del control de
versiones.

El enlace de verificación se arma con el host desde el que llega el pedido, así
que detrás del túnel o del proxy tiene que llegar el `Host` original —el
`Caddyfile` del repositorio ya reenvía las cabeceras necesarias—. Si el mail llega
con un enlace a `localhost`, el problema está ahí.
