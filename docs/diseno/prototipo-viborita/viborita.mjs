// VIBORITA TBF, v3: la pantalla aprobada de la v2, con el contorno del 1100 y la cruceta de la referencia.
import { writeFileSync } from 'node:fs';
import { lcd, F, CEL } from './base-lcd.mjs';

const DIR = process.argv[2];
const ARCHIVO = process.argv[3] || 'v3.html';

/* --------------------------------------------- la pantalla (aprobada en v2) */
const AN = 102, AL = 128, CAMPO_Y = 10;
const pieza = (d, n, c, f) => d.sprite(n, 1 + c * CEL, CAMPO_Y + 1 + f * CEL);
const etiqueta = (d, t) => { d.linea(0, AL - 11, AN - 1, AL - 11); d.centro(t, AL - 8); };

const inicio = () => lcd(AN, AL, (d) => {
  d.estado();
  d.centro('VIBORITA', 16, 2); d.centro('TBF', 34, 2);
  ['TRL_H', 'TRL_H', 'TRL_H', 'CAB_R'].forEach((n, i) => d.sprite(n, 14 + i * CEL, 58));
  d.sprite('CAJA', 76, 58);
  d.centro('RECORD 0031', 84);
  etiqueta(d, 'JUGAR');
});

const jugando = () => lcd(AN, AL, (d) => {
  d.texto('0012', 1, 1); d.texto('X6', AN - d.ancho('X6') - 1, 1);
  d.marco(0, CAMPO_Y - 1, AN - 1, CAMPO_Y + 10 * CEL + 1);
  [['TRL_H', 1, 3], ['TRL_H', 2, 3], ['TRL_H', 3, 3], ['TRL_H', 4, 3], ['TRL_H', 5, 3], ['TRL_V', 6, 3], ['CAB_D', 6, 4]].forEach(([n, c, f]) => pieza(d, n, c, f));
  pieza(d, 'CAJA', 3, 7);
  etiqueta(d, 'PAUSA');
});

const fin = () => lcd(AN, AL, (d) => {
  d.estado();
  d.centro('GAME OVER', 14);
  d.linea(10, 24, AN - 11, 24);
  ['TRL_H', 'TRL_H', 'TRL_H', 'TRL_H', 'CAB_R'].forEach((n, i) => d.sprite(n, 16 + i * CEL, 32));
  d.linea(68, 30, 68, 42);
  d.centro('PUNTOS 0026', 54);
  d.centro('RECORD 0031', 66);
  d.centro('X5 ACOPLADOS', 78);
  etiqueta(d, 'OTRA VEZ');
});

/* ------------------------------------------------- texto en fuente de pixel */
// Los textos de afuera de la pantalla van en la misma fuente, claros, como los
// epigrafes de la referencia.
function rotulo(t, { k = 2, color = '#e6ead8' } = {}) {
  const px = [];
  let cx = 0;
  for (const ch of t) {
    (F[ch] ?? F[' ']).forEach((f, j) => [...f].forEach((c, i) => { if (c === '#') px.push([cx + i, j]); }));
    cx += 6;
  }
  const W = (cx - 1) * k, H = 7 * k;
  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;shape-rendering:crispEdges">${px.map(([x, y]) => `<rect x="${x * k}" y="${y * k}" width="${k}" height="${k}" fill="${color}"/>`).join('')}</svg>`;
}

/* ------------------------------------------------------- el contorno del 1100 */
// El frente plateado con el parlante y la marca, y la pantalla hundida en su
// marco gris con el filo oscuro por dentro.
const contorno = (pantalla) => `
  <div class="carcasa"><span class="canto"></span><span class="veta"></span>
  <div class="frente">
    <div class="parlante"><i></i></div>
    <div class="marca">TBF</div>
    <div class="marco"><div class="hundido">${pantalla}</div></div>
  </div></div>`;

/* --------------------------------------------- la cruceta de la referencia */
const flecha = (dir) => {
  const rot = { arriba: 0, der: 90, abajo: 180, izq: 270 }[dir];
  return `<svg viewBox="0 0 40 40" width="38" height="38" style="transform:rotate(${rot}deg)"><path d="M20 6 L34 22 H25 V34 H15 V22 H6 Z" fill="#a9c07c" stroke="#1d2418" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
};
const cruceta = () => `
  <div class="cruceta">
    <div class="k arriba">${flecha('arriba')}</div>
    <div class="k izq">${flecha('izq')}</div>
    <div class="k centro"><span class="aro"></span></div>
    <div class="k der">${flecha('der')}</div>
    <div class="k abajo">${flecha('abajo')}</div>
  </div>`;

/* ----------------------------------------------------------- las pantallas */
const pantalla = (titulo, lcdSvg, pie) => `
  <figure class="tel">
    <div class="moderno">
      <div class="arriba-app">${rotulo('< SALIR', { k: 2, color: '#9aa6b8' })}</div>
      ${contorno(lcdSvg)}
      ${cruceta()}
      <div class="pie">${pie}</div>
    </div>
    <figcaption>${titulo}</figcaption>
  </figure>`;

const css = `<style>
  .fila{display:flex;gap:26px;flex-wrap:wrap;justify-content:center;margin:10px 0 24px}
  .tel{margin:0;display:flex;flex-direction:column;align-items:center;gap:10px}
  .tel figcaption{color:#8a97ab;font:700 12px system-ui;letter-spacing:.12em;text-transform:uppercase}
  .moderno{width:414px;height:820px;border-radius:42px;overflow:hidden;display:flex;flex-direction:column;align-items:center;gap:18px;padding:18px 0 0;
    background:linear-gradient(180deg,#141d28,#0c121a);box-shadow:0 0 0 9px #05070b,0 0 0 10px #2a2f38,0 20px 44px rgba(0,0,0,.6)}
  .arriba-app{align-self:stretch;padding:0 22px;display:flex}

  /* La carcasa de plastico azul del 1100: grano mate, canto redondeado y la ranura contra el frente. */
  .carcasa{position:relative;padding:20px;border-radius:62px 62px 44px 44px;
    background:url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'180'%20height%3D'180'%3E%3Cfilter%20id%3D'n'%3E%3CfeTurbulence%20type%3D'fractalNoise'%20baseFrequency%3D'.95'%20numOctaves%3D'3'%20stitchTiles%3D'stitch'%2F%3E%3CfeColorMatrix%20values%3D'0%200%200%200%201%20%200%200%200%200%201%20%200%200%200%200%201%20%200%200%200%20.55%200'%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D'100%25'%20height%3D'100%25'%20filter%3D'url(%23n)'%2F%3E%3C%2Fsvg%3E"),url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'180'%20height%3D'180'%3E%3Cfilter%20id%3D'n'%3E%3CfeTurbulence%20type%3D'fractalNoise'%20baseFrequency%3D'1.8'%20numOctaves%3D'3'%20stitchTiles%3D'stitch'%2F%3E%3CfeColorMatrix%20values%3D'0%200%200%200%200%20%200%200%200%200%200%20%200%200%200%200%200%20%200%200%200%20.65%200'%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D'100%25'%20height%3D'100%25'%20filter%3D'url(%23n)'%2F%3E%3C%2Fsvg%3E"),url("data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'180'%20height%3D'180'%3E%3Cfilter%20id%3D'n'%3E%3CfeTurbulence%20type%3D'fractalNoise'%20baseFrequency%3D'.35'%20numOctaves%3D'3'%20stitchTiles%3D'stitch'%2F%3E%3CfeColorMatrix%20values%3D'0%200%200%200%200%20%200%200%200%200%200%20%200%200%200%200%200%20%200%200%200%20.35%200'%2F%3E%3C%2Ffilter%3E%3Crect%20width%3D'100%25'%20height%3D'100%25'%20filter%3D'url(%23n)'%2F%3E%3C%2Fsvg%3E"),linear-gradient(158deg,#34507f 0%,#22385e 28%,#172848 58%,#0d1730 100%);
    background-blend-mode:soft-light,soft-light,multiply,normal;
    box-shadow:inset 0 2px 1px rgba(200,220,255,.45),inset 0 7px 10px rgba(150,180,240,.12),inset 0 -4px 6px rgba(0,0,0,.6),inset -5px 0 9px rgba(0,0,0,.35),inset 5px 0 9px rgba(120,160,230,.14),
      0 0 0 1px #050914,0 2px 0 1px rgba(110,140,200,.18),0 18px 34px rgba(0,0,0,.65),0 4px 8px rgba(0,0,0,.5)}
  /* El brillo especular que corre por el canto izquierdo, como en un plastico moldeado. */
  .carcasa .canto{position:absolute;left:6px;top:46px;bottom:60px;width:9px;border-radius:9px;pointer-events:none;
    background:linear-gradient(180deg,rgba(190,215,255,0),rgba(190,215,255,.42) 22%,rgba(190,215,255,.16) 60%,rgba(190,215,255,0));filter:blur(2px)}
  /* Una veta de luz suave en la curva de arriba. */
  .carcasa .veta{position:absolute;left:52px;right:52px;top:4px;height:6px;border-radius:6px;pointer-events:none;
    background:linear-gradient(90deg,rgba(220,235,255,0),rgba(220,235,255,.35),rgba(220,235,255,0));filter:blur(1.5px)}
  .carcasa .frente{position:relative;z-index:1}
  .carcasa::after{content:"";position:absolute;inset:11px;border-radius:52px 52px 34px 34px;pointer-events:none;
    box-shadow:0 0 0 1px rgba(150,180,235,.28),inset 0 0 0 1px rgba(0,0,0,.55),inset 0 2px 3px rgba(0,0,0,.45)}
  .cerca{width:380px;height:300px;overflow:hidden;border-radius:18px;background:#0c121a;box-shadow:0 0 0 1px #233042,0 12px 28px rgba(0,0,0,.5);position:relative}
  .cerca>div{transform:scale(3);transform-origin:0 0;position:absolute;left:-30px;top:-24px}
  .cerca-fila{display:flex;gap:22px;justify-content:center;align-items:flex-start;flex-wrap:wrap;margin:6px 0 30px}
  .cerca-nota{max-width:360px;color:#aeb9cc;font-size:14px;line-height:1.55}
  /* El frente plateado del 1100 */
  .frente{width:350px;box-sizing:border-box;border-radius:44px 44px 26px 26px;padding:12px 12px 16px;display:flex;flex-direction:column;align-items:center;gap:6px;
    background:linear-gradient(180deg,#e4e7ea 0%,#c3c8cd 30%,#a7adb3 70%,#8f959c 100%);
    box-shadow:inset 0 2px 0 rgba(255,255,255,.9),inset 0 -3px 6px rgba(0,0,0,.25),0 0 0 1.5px #070b14,0 0 0 2.5px rgba(160,190,240,.22),0 3px 6px rgba(0,0,0,.45)}
  .parlante{width:96px;height:9px;border-radius:5px;background:#2a2e34;box-shadow:inset 0 2px 2px rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.7);position:relative;overflow:hidden}
  .parlante i{position:absolute;right:8px;top:3px;width:26px;height:3px;border-radius:2px;background:#7c838c}
  .marca{font:900 23px "Arial Black",Arial,sans-serif;letter-spacing:.08em;color:#20252c;text-shadow:0 1px 0 rgba(255,255,255,.75)}
  /* El marco gris de la pantalla, con el filo oscuro por dentro */
  .marco{padding:9px;border-radius:20px;background:linear-gradient(180deg,#d2d6da,#a2a8ae);box-shadow:inset 0 1px 0 #f4f6f8,inset 0 -1px 0 rgba(0,0,0,.25),0 1px 0 rgba(255,255,255,.6)}
  .hundido{border-radius:12px;overflow:hidden;box-shadow:0 0 0 3px #2d3238,0 0 0 4px #1a1d21;position:relative}
  .hundido::after{content:"";position:absolute;inset:0;box-shadow:inset 0 3px 6px rgba(0,0,0,.35);background:linear-gradient(160deg,rgba(255,255,255,.18),rgba(255,255,255,0) 35%)}
  /* La cruceta: cinco teclas oscuras con borde verde palido */
  .cruceta{display:grid;grid-template-columns:repeat(3,70px);grid-template-rows:repeat(3,70px);gap:10px;margin-top:2px}
  .k{border-radius:14px;display:grid;place-items:center;background:linear-gradient(180deg,#1f2732,#151b23);
    box-shadow:inset 0 0 0 2.5px #93a874,inset 0 0 0 4.5px #1a2018,0 3px 0 #06090d}
  .k:active{transform:translateY(2px)}
  .aro{width:30px;height:30px;border-radius:50%;border:3px solid #93a874;background:#1a2018;box-shadow:inset 0 0 0 2px #a9c07c33}
  .arriba{grid-area:1/2}.izq{grid-area:2/1}.centro{grid-area:2/2}.der{grid-area:2/3}.abajo{grid-area:3/2}
  .pie{display:flex;justify-content:center;margin-top:-4px}
</style>`;

const html = `${css}
<h2>VIBORITA TBF — v5</h2>
<p class="subtitle">La v3, con la carcasa de plástico azul texturado alrededor del frente: grano mate, el canto redondeado con su brillo y la ranura donde encaja el frente plateado. Abajo, la cruceta de la referencia: cuatro flechas y el botón del medio, que hace lo que dice la pantalla (JUGAR, PAUSA, OTRA VEZ). Afuera, nada de la app: el azul noche de la referencia y los textos en la misma fuente de píxel.</p>
<div class="fila">
  ${pantalla('1 · Inicio', inicio(), rotulo('TOCA EL CENTRO', { k: 2 }))}
  ${pantalla('2 · Jugando', jugando(), rotulo('RECORD 0031', { k: 2, color: '#9aa6b8' }))}
  ${pantalla('3 · Game over', fin(), rotulo('TE ENGANCHASTE LA COLA', { k: 2 }))}
</div>
<h3>De cerca: el plástico</h3>
<div class="cerca-fila">
  <div class="cerca"><div>${contorno(inicio())}</div></div>
  <p class="cerca-nota"><b>Grano mate</b> con ruido fractal en tres escalas: fino, medio y una nube grande que le da irregularidad al color. <b>Canto redondeado</b>: luz en el labio de arriba, sombra abajo y un brillo especular que corre por el lado izquierdo. <b>Ranura</b>: el surco oscuro donde encaja el frente plateado, con su filo de luz por fuera.</p>
</div>`;

writeFileSync(`${DIR}/${ARCHIVO}`, html);
console.log('escrita', ARCHIVO);
