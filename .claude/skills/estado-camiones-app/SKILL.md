---
name: estado-camiones-app
description: Estado vivo del proyecto GPS para camiones de CABA — dónde está el roadmap, qué está verificado y qué no, las decisiones tomadas con el usuario y las trampas del entorno de desarrollo. Invocar al retomar el trabajo en este repositorio, antes de planificar o escribir código.
---

# Estado del proyecto — Navegador de Tránsito Pesado (CABA)

Este archivo es **memoria de trabajo**, no documentación del producto. Lo que ya
está escrito en `docs/` no se repite acá: se indexa. Lo que hay acá es lo que no
vive en ningún otro lado — el estado del roadmap, qué se probó de verdad, y las
trampas del entorno que cuestan horas si se redescubren.

---

## 1. Qué es

GPS para camiones en CABA que **rutea según las medidas y el peso del vehículo**.
La restricción entra como *custom model* de GraphHopper **antes** de calcular la
ruta, no como advertencia posterior. Fuente regulatoria: Ley 2148, art. 9.10.1
(Red de Tránsito Pesado). Mapa: OpenStreetMap — **nunca Google Maps ni Waze**.

Objetivo declarado: *"El GPS de los camioneros de Buenos Aires"*. No sólo un
navegador: perfil, historial, gamificación, comunidad.

**Rama de trabajo:** `cuentas-de-usuario` (9 commits sobre `main`).

---

## 2. Dónde está la verdad

**Leer siempre antes de decidir algo.** No duplicar su contenido acá.

| Documento | Qué tiene |
|---|---|
| `CLAUDE.md` | Convenciones, comandos, **trampas que ya costaron tiempo** |
| `docs/decisions.md` | **25 decisiones arquitectónicas (AD-01…AD-25)** con su porqué |
| `docs/data-sources.md` | Fuentes, licencias y **8 limitaciones abiertas (L-1…L-8)** |
| `docs/architecture.md` | Estructura y proyectos |
| `docs/routing.md`, `docs/restrictions.md`, `docs/pois.md`, `docs/deploy.md` | Por tema |
| `PLAN.md` | Especificación original del MVP |
| Escritorio del usuario | `PUNTOS A TRABAJAR EN LA APLICACIÓN GPS CAMIONES.docx` — los 33 requisitos |

**Las AD-17 a AD-25 son de esta sesión** y cubren: identidad, perfil, propiedad
de camiones, viajes, mudanza del frontend, cáscara Android, motor de navegación,
servicio en segundo plano y capas de mapa.

---

## 3. Roadmap y estado

Prioridad declarada por el usuario:
**navegación → usabilidad → seguridad → información para camiones → experiencia → gamificación**

| Fase | Estado |
|---|---|
| **0 · Cimientos** | ✅ Completa — cuentas, camiones por usuario, viajes, mudanza del frontend |
| **1 · Navegación** | ⚠️ Código completo, **sin probar manejando** |
| **2 · Usabilidad** | ✅ Completa — salió adelantada dentro de la mudanza del frontend |
| **3 · Seguridad** | ❌ Pendiente — pánico con 3 contactos, compartir viaje por WhatsApp |
| **4 · Info para camiones** | 🔶 Mitad — capas listas; **falta el fondo minimalista** |
| **5 · Experiencia** | ❌ Pendiente — avatares, cofres, reportes, chat |
| **Transversal** | ❌ i18n (español, portugués, guaraní, inglés) |

### Commits de la rama, en orden

```
213041b  Cuentas de usuario con verificacion por mail y perfil de camionero
96c5e42  Los camiones pertenecen a una cuenta; las plantillas no son de nadie
774c99c  Viajes: historial y kilometros que el cliente no puede falsificar
7ce55f9  La interfaz pasa a una aplicacion web mobile first, sin paso de compilacion
728b840  La app Android pasa a ser una cascara sobre la aplicacion web
54d5291  Navegacion paso a paso: motor de guiado en el cliente
49e7d88  El GPS sigue vivo en segundo plano mientras dura el viaje
53f8914  Arreglos del puente entre la cascara y la web, encontrados probando en el telefono
1710102  Capas de camion en el mapa: la Red, los galibos y los sapitos
```

---

## 4. Qué está verificado — y qué NO

**Distinción crítica.** Mucho está probado a fondo; una franja específica no se
pudo probar y hay que decirlo cada vez.

### Verificado con rigor

- **Motor de navegación** (`wwwroot/js/navigation.js`): recorrido sintético de
  1051 posiciones sobre ruta real; distancia calculada 26.260 m contra 26.256 m
  de GraphHopper (**4 m de error en 26 km**); robusto a ±30 m de ruido; detección
  de desvío 0→1→2→3 strikes con enfriamiento; avisos de 35 apelotonados a 26 con
  220 m de separación mínima.
- **Backend completo**: 65 tests de dominio + 43 de integración (11 contra
  GraphHopper real). Flujos end-to-end por HTTP: alta, verificación, login,
  perfil, alias único, camiones, propiedad, viajes, acreditación de km.
- **Datos del mapa**: medidos contra Overpass el 24/08/2026, dentro del límite
  administrativo de CABA.

### NO verificado

- **Navegación manejando.** Nunca se probó en movimiento. Pendiente para cerrar
  Fase 1: que la flecha siga al camión, que hable en los giros, que el servicio
  sobreviva a apagar la pantalla.
- **El mapa renderizado.** El panel de navegador de las sesiones no compone
  frames → el mapa nunca carga tiles → nada que dependa de él se puede ver.
  Las capas de camión están servidas y empaquetadas pero **no vistas**.
- **La app en el teléfono, salvo lo que reportó el usuario.**

### Lección que se pagó tres veces

Las tres fallas encontradas en el teléfono estuvieron **todas en la costura entre
la cáscara nativa y la web** — justamente lo único que no se puede probar acá.
Cuando se toque esa costura, asumir que va a fallar y **pedirle al usuario el
mensaje de error textual**: cada uno descartó una capa.

---

## 5. Decisiones tomadas con el usuario

- **Móvil primero.** Se corrigió a mitad de camino: la versión web es el
  subproducto, no el objetivo. Diseño mobile-first, artefacto primario el APK.
- **Sin paso de compilación** en el frontend. Módulos ES nativos, sin npm ni
  empaquetador. No agregar uno sin motivo fuerte.
- **Dos registros de comunicación.** El usuario lleva producto y tiene
  conocimientos básicos; un programador lee el detalle. Toda devolución larga
  debe separar visiblemente ambos.
- **Verificar, no especular.** Textual: *"no quiero que especules, prefiero que
  busques y confirmes"*. Medir contra la fuente y decir la fecha.
- **Regla de acreditación de km aprobada.** Media duración estimada. Textual:
  *"preferible ese abuso antes que romper la app"*. Revisar en Fase 1 con el
  trazado del GPS.
- **Estética:** seria pero dopamínica. Resuelto como **dos intensidades**: el
  mapa es sobrio, la progresión trae el color. No es sólo estético — impide que
  lo gamificado se filtre a la pantalla que se mira manejando.
- **Identidad de git del repo:** `bermejolautaro <tarolau97@hotmail.com>`.
- **Convención de código:** nombres de tipo **en inglés**, comentarios y docs en
  español, **sin acentos dentro de los `.cs`**. Rutas de API en inglés.

---

## 6. Trampas del entorno — releer antes de perder tiempo

### La máquina

- **No hay Node ni Python.** Sin tests unitarios de JS. Se compensa con
  recorridos sintéticos ejecutados en el navegador.
- **PowerShell 5.1**, sin `&&` ni operadores modernos.
- **`$PSScriptRoot` viene vacío dentro del bloque `param()`** → una ruta relativa
  con `..` se ancla en la raíz del disco y el script escribe en `C:\src\...`
  informando éxito. Calcular la ruta en el cuerpo, con `$PSCommandPath`.
- **Archivos con CRLF.** Los regex de perl con `$` al final o `\n` multilínea
  **no matchean**. Usar `\r?$`, o reconstruir el archivo con `head`/`sed`.
- **perl con acentos** rompe: `ó` son dos bytes y `(.)` matchea uno solo. Para
  texto acentuado usar `printf` con bytes explícitos o la herramienta de edición.
- **Heredocs de bash** pueden fallar con ciertos contenidos JS/C#. Ante un
  `unexpected EOF`, usar la herramienta de escritura directa.

### El navegador de la sesión

- **No compone frames** → `map.on('load')` nunca dispara, no hay screenshots, los
  clicks son poco confiables. Manejar la app por `javascript_tool`.
- **Cachea módulos ES agresivamente**, incluso con `no-cache`. Para probar un
  módulo recién editado, importarlo con `?f=<timestamp>`.
- **Límite de 30 s por ejecución.** Partir los flujos largos.

### Overpass

- Rate limit frecuente (429). Reintentar con espera; `https://overpass-api.de/api/status`
  informa los slots.
- El query va como **campo `data` de un formulario**, no como cuerpo crudo (si no, 406).
- Consultar contra el **límite administrativo** (`admin_level=4`), no un
  rectángulo: el rectángulo mete conurbano (501 pasos a nivel contra 312 reales).

### ASP.NET Core y MapLibre

- **No sirve extensiones desconocidas**: `.geojson` y `.pbf` dan 404 con el
  archivo en su lugar. Declarar el tipo MIME.
- **Sin `glyphs` MapLibre no dibuja ni una letra.** Fuentes vendorizadas en
  `wwwroot/fonts`, carpetas **sin espacios**.
- **`Style is not done loading`**: agregar capas antes de que cargue el estilo
  falla. Esperar `once('idle')`. Y **no envolver el alta de capas en el mismo
  `catch` que la descarga** — confundirlas oculta el problema.

### Android

- `targetSdk 36`. Un servicio en primer plano necesita
  `FOREGROUND_SERVICE_LOCATION`, `foregroundServiceType="location"` en el
  manifiesto **y** el tipo en `startForeground(...)`. Falta alguno → compila
  igual y el sistema lo mata.
- **No existe servicio en primer plano sin notificación.** No es opcional.
- El WebView sirve desde un **origen virtual `https`** → todo pedido al backend
  es cross-origin (CORS) y contenido mixto. Ambos hay que habilitarlos.
- **`_framework/hybridwebview.js` tiene que estar en el `index.html`.** Sin él no
  existe `window.HybridWebView`, la app cree estar en un navegador y le pega al
  origen virtual: **404 en todo**. Servido por HTTP ese archivo da 404 y está bien.
- **La página pide la configuración con `ready`**; el nativo no la empuja. El
  chequeo de conexión tarda menos que la carga del WebView y el mensaje se pierde.

---

## 7. Cómo levantar todo

```powershell
cd routing; .\run-graphhopper.ps1        # motor de ruteo en :8989
dotnet run --project src/TruckNavigator.Api   # backend + web en :5080
dotnet test                              # 108 tests
.\build-apk.ps1 -Push                    # APK de Release al teléfono
.\data\fetch-caba-map-layers.ps1         # regenera las capas del mapa
```

**Para probar desde el teléfono el backend debe escuchar en `0.0.0.0`**, no en
`localhost`. Sin `ASPNETCORE_URLS` usa el `appsettings` (`0.0.0.0:5080`), que es
lo correcto.

- El mail **no se envía** (sin SMTP): el enlace de verificación aparece en el log
  del backend. En `Production` el arranque corta si falta SMTP.
- IP del usuario al 24/08/2026: `192.168.100.106`. La app deja corregirla desde
  el teléfono si cambia.

---

## 8. Lo que sigue

**Inmediato:** cerrar Fase 1 probando en movimiento. Orden que más rápido
descarta problemas: ¿carga la interfaz? → ¿el GPS ubica? → ¿aparece la
notificación al arrancar el viaje? → **¿avanza la flecha tras apagar la pantalla
un minuto?** → ¿habla en los giros?

**Fase 4, segunda mitad:** el fondo minimalista. Camino: generar PMTiles del AMBA
con **Planetiler** (corre sobre el mismo JDK 21 que ya hace falta) y servirlos
como archivo estático. Resuelve el minimalismo, el día/noche del fondo y **L-4**
—los tiles de OSM no se pueden distribuir— de una sola vez.

**Después:** Fase 3 (seguridad), modo reparto, Fase 5 (comunidad y gamificación),
i18n.

**Sin fuente y por lo tanto sin hacer:** las *zonas peligrosas* no tienen dato
oficial publicable. La única vía honesta es construirlas con reportes de la
comunidad, **siempre etiquetadas como tales**. No inventar.

---

## 9. La regla que gobierna todo

**Donde falta el dato, se dice que falta.** No se rellena.

Está en el código (`bool?` de tres estados para aptitud), en el generador de
capas (`maxheight=default` no es una altura; barrera sin declarar no es barrera
ausente), y en la documentación (L-1 a L-8). Es lo que hace auditable al sistema
y defendible al producto frente a Waze y Google Maps.

Si hace falta un dato que no existe: **decirlo, no rellenarlo.**
