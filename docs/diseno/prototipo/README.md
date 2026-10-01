# Prototipo de diseño — el camino elegido

**Es un prototipo, no código.** Decisión del usuario del 14/09/2026: la
dirección visual queda aprobada como referencia y **todavía no se trabaja en el
código**. Cuando se implemente, el vocabulario va a `app.css` y las pantallas se
hacen una por una contra estos tableros.

**Se ve acá:** https://claude.ai/code/artifact/c7849797-3e2a-4d9d-83bf-2ac08fdfd44f
(lienzo de Claude Design; privado, del dueño del repositorio). Cada `.dc.html`
de esta carpeta es un tablero de ese lienzo; `canvas.json` los ubica.

## Qué hay

| Tablero | Qué es |
|---|---|
| `Main` | La portada: el sistema en una hoja — mono en naranja, cromo en tres tonos, fichas/filas/íconos, color y tipografía, cinco reglas |
| `Iconos` | Los 27 íconos ilustrados, dos tonos, en el lenguaje del zócalo |
| `Globos` | El globo del mono: vidrio con chip, pleno, y con el mono abajo |
| `Sello` | La cabeza como marca: ícono, notificación, mail |
| `Bienvenida`, `Idioma`, `Entrar` | La entrada |
| `Mapa` | El mapa **antes de arrancar**: la única pantalla sobria, y la frontera |
| `Perfil`, `Racha`, `Metas`, `Logros` | Lo personal y la progresión |
| `SubisteDeNivel`, `FinViaje` | Los festejos |
| `Historial`, `HistorialVacio`, `SinSenal` | Listas y estados |
| `Camiones`, `Juegos`, `Emergencia`, `Configuracion` | El uso diario |

Las dos que fijaron la dirección son **`Bienvenida` y `SubisteDeNivel`**: el
usuario las eligió como orientación y el resto se derivó de ellas.

## Cómo se regenera

```powershell
.\assets.ps1        # las poses a 320 px y la cabeza, desde wwwroot/img/mascota
node final.mjs      # escribe los .dc.html y canvas.json en esta carpeta
```

`shared.mjs` tiene los tokens y componentes copiados de `app.css` (valores
exactos, modo noche) más el zócalo; `iconos.mjs` el set de íconos ilustrados;
`final.mjs` el vocabulario del prototipo y las pantallas. Los `.dc.html` no se
abren solos en un navegador: son tableros del lienzo (necesitan su runtime).

## Lo que está decidido — resumen

Está desarrollado en la skill `diseno-camiones-app`, §16. En una línea cada uno:

- **El naranja es la voz del mono.** Una sola pieza naranja por región; nunca en
  el botón de un formulario; el globo del mono es esa pieza.
- **Materiales**: vidrio (paneles y globos sobre luz), neón (lo activo se
  enciende), cromo en tres tonos (**frío** progreso, **oro** nivel, **plata**
  totales; uno por pantalla), satinado de vez en cuando.
- **La chapa de nivel** —oro, número en disco oscuro, nombre en mayúsculas— va con
  el usuario a todos lados.
- **Cabeceras**: compacta con un dato, hero con luz de color, o hero con el mono
  hablando. **La banda celeste con trama del perfil no fue aprobada** y el
  prototipo no la usa.
- **La fila de Configuración** es la caja de toda la app. **Las fichas** llevan su
  color y su luz.
- **El GPS en movimiento no lleva nada de esto.** El mono aparece en la hoja del
  mapa sólo antes de arrancar.
- **El carnet** sigue congelado sin aprobar; entra con este vocabulario cuando se
  retome.
