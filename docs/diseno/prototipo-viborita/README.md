# Prototipo de VIBORITA TBF — aprobado el 03/10/2026

Es la referencia visual de `docs/superpowers/specs/2026-10-03-viborita-tbf-design.md`.
Prototipo, no código de la app: lo que se construye se mide contra esto.

- `base-lcd.mjs` — la LCD verde aprobada: los sprites del camión y la caja, la fuente de
  píxel 5 × 7 y el dibujo de la pantalla (fondo, rejilla, sombra de cada píxel).
- `viborita.mjs` — las pantallas: la carcasa de plástico azul texturado, el frente plateado
  con TBF, el marco de la pantalla y la cruceta de la referencia.

Para verlo:

```bash
node docs/diseno/prototipo-viborita/viborita.mjs docs/diseno/prototipo-viborita prototipo.html
```

El HTML generado (unos 700 KB, un `<rect>` por píxel) no se versiona. Es un fragmento para el
compañero visual de brainstorming; para abrirlo suelto en el navegador, envolverlo en
`<html><body style="background:#111">…</body></html>`.

La referencia del usuario está en `docs/referencias/viborita/referencia-nokia-1100.webp`.
