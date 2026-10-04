# Prototipo de CRUZÁ, MONO — aprobado el 04/10/2026

Es la referencia visual de `docs/superpowers/specs/2026-10-04-cruza-mono-design.md`, después
de cinco vueltas con el usuario (artifact privado *Cruzá, Mono*, versión 5). Es un prototipo,
no código de la app: lo que se construye se mide contra esto, y el pixel art se **porta** de
acá, no se vuelve a dibujar.

- `sprites.js` — la fuente 5 × 7 de la Viborita y los sprites por grilla: el mono de 24 × 24
  (de espaldas, de frente, de costado, el parpadeo y el golpe), la gorra que flota, la cabeza
  de 12 × 12 de las vidas y la caja TBF.
- `escena.js` — todo lo demás:
  - el rasterizador de siluetas (`construir`, `renderizar`);
  - los vehículos: Torino, Fiat Uno, Fitito, 504, el taxi, seis líneas de colectivo y la flota
    TBF en nueve pinturas;
  - el piso: asfalto, adoquín, vereda, plaza, playón y río;
  - el barrio: árbol, jacarandá, contenedor, banco con mate, bolardo, mástil, conventillo y el
    cartel de la app con sus cuatro avisos;
  - el mono animado, el HUD y las pantallas de inicio, game over y récord.
- `demo.js` — el mundo sin fin de la spec y un mono en piloto automático. Es la demostración
  arriba de todo de la página, y la que encontró la regla de los bolsillos.
- `pagina.html` y `estilo.css` — la página de la propuesta, con sus 17 secciones.
- `armar.mjs` — junta todo, con las tres poses de la mascota incrustadas, en un solo HTML.

Para verlo:

```bash
node docs/diseno/prototipo-cruza/armar.mjs cruza-mono.html
```

El HTML generado (unos 520 KB) no se versiona; se abre suelto en el navegador.

**Lo que el prototipo NO es:** el juego. La demostración tiene un motor y un generador escritos
para mirar, sin tests. **El juego está construido en `src/TruckNavigator.Api/wwwroot/js/juegos/cruza/`**
(AD-56): el mundo y el motor se escribieron con tests, y los dibujos se portaron de acá por
rangos de líneas del commit `39f4181`, sin redibujarlos.
