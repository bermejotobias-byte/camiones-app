// Presentación final: todas las pantallas en el camino elegido — el de
// Bienvenida y Subiste de nivel. Luz de color en vez de banda, vidrio y neón,
// cromo en tres tonos, el naranja como voz del mono, la chapa de nivel, las
// fichas con su luz, los íconos ilustrados y la fila como caja de todo.
import fs from 'node:fs';
import { ICONOS, dock, ico, file, MAPA } from './shared.mjs';
import { ilu, F, ICO, chip } from './iconos.mjs';

const METAL2 = `linear-gradient(180deg,rgba(255,255,255,.78) 0%,rgba(255,255,255,.28) 20%,rgba(0,0,0,.22) 46%,rgba(255,255,255,.42) 64%,rgba(255,255,255,.06) 82%,rgba(0,0,0,.34) 100%)`;
const RAMPA = `linear-gradient(90deg,#35b8e8,#8a86f2 55%,#a97bf0)`;
const ORO = `linear-gradient(90deg,#e8781f 0%,#f7a53c 32%,#ffe082 58%,#f2b93a 100%)`;
const PLATA = `linear-gradient(90deg,#8ea4b3 0%,#eef4f8 42%,#b5c6d1 68%,#e3ecf1 100%)`;

const CSS = `
.pantalla{width:390px;height:844px;position:relative;overflow:hidden;display:flex;flex-direction:column;background:#0d1418}
.luz{position:absolute;inset:0;pointer-events:none}
.luz-brand{background:radial-gradient(70% 45% at 50% 12%,rgba(53,184,232,.40),transparent 70%),radial-gradient(60% 40% at 50% 96%,rgba(138,134,242,.24),transparent 70%),linear-gradient(180deg,#0f1c26 0%,#0d1418 55%)}
.luz-reward{background:radial-gradient(80% 50% at 50% 0%,rgba(169,123,240,.42),transparent 65%),radial-gradient(50% 40% at 50% 100%,rgba(53,184,232,.16),transparent 70%),linear-gradient(180deg,#171a30 0%,#0d1418 60%)}
.luz-festejo{background:radial-gradient(70% 50% at 50% 30%,rgba(255,200,80,.18),transparent 70%),radial-gradient(80% 60% at 50% 0%,rgba(169,123,240,.40),transparent 65%),linear-gradient(180deg,#171a30 0%,#0d1418 60%)}
.luz-tenue{background:radial-gradient(70% 40% at 50% 20%,rgba(53,184,232,.16),transparent 70%),linear-gradient(180deg,#0f1a22 0%,#0d1418 60%)}
.z{position:relative;z-index:1}
.rayos{position:absolute;left:50%;top:0;width:640px;height:640px;margin-left:-320px;margin-top:-200px;background:repeating-conic-gradient(from 0deg,rgba(255,224,130,.07) 0 5deg,transparent 5deg 14deg);-webkit-mask-image:radial-gradient(closest-side,#000 20%,transparent 70%);mask-image:radial-gradient(closest-side,#000 20%,transparent 70%);animation:girar 40s linear infinite}
@keyframes girar{to{transform:rotate(360deg)}}
/* materiales */
.cromo-frio{position:relative;overflow:hidden;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.85),0 0 8px rgba(0,0,0,.55);background:${METAL2},${RAMPA};box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),inset 0 -2px 3px rgba(0,0,0,.25),0 0 0 1px rgba(0,0,0,.35),0 0 18px -2px rgba(91,156,242,.8)}
.cromo-oro{position:relative;overflow:hidden;color:#2b1405;text-shadow:0 1px 0 rgba(255,255,255,.5);background:${METAL2},${ORO};box-shadow:inset 0 0 0 1px rgba(255,255,255,.6),inset 0 -2px 3px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.4),0 0 26px -2px rgba(255,200,80,.9)}
.cromo-plata{position:relative;overflow:hidden;color:#0e161b;text-shadow:0 1px 0 rgba(255,255,255,.6);background:${METAL2},${PLATA};box-shadow:inset 0 0 0 1px rgba(255,255,255,.75),inset 0 -2px 3px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.4),0 0 18px -2px rgba(215,230,240,.7)}
.destello::after{content:"";position:absolute;inset:0;background:linear-gradient(105deg,transparent 36%,rgba(255,255,255,.9) 50%,transparent 64%);transform:translateX(-110%);animation:destello 3s ease-in-out infinite;pointer-events:none}
@keyframes destello{0%,62%{transform:translateX(-110%)}100%{transform:translateX(110%)}}
.placa{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:5px 14px;border-radius:13px;font-weight:900;font-size:15px;letter-spacing:-.01em;white-space:nowrap}
.vidrio{background:rgba(255,255,255,.08);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.18);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 8px 24px -12px rgba(0,0,0,.7)}
.neon{border-color:rgba(53,184,232,.9)!important;box-shadow:0 0 0 1px rgba(53,184,232,.55),0 0 22px -4px rgba(53,184,232,.75),inset 0 0 18px -12px rgba(53,184,232,.9)}
.satin{background:linear-gradient(180deg,#1b2830 0%,#151f26 100%);border:1px solid var(--rule);box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 1px 2px rgba(0,0,0,.35)}
.btn.brillo{box-shadow:inset 0 1px 0 rgba(255,255,255,.35),inset 0 -1px 0 rgba(0,0,0,.18)}
.btn-primary.brillo{box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 24px -4px rgba(53,184,232,.8)}
.btn-outline-brand{background:transparent;border:2px solid rgba(53,184,232,.55);color:var(--brand-ink)}
.btn-danger-duo{background:#f0736a;color:#2a0b08;font-weight:800;border-bottom:4px solid #b6362b;text-transform:uppercase;letter-spacing:.06em;font-size:16px;min-height:64px;border-radius:14px}
/* chapa de nivel */
.chapa{display:inline-flex;align-items:center;gap:8px;padding:5px 14px 5px 7px;border-radius:999px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;font-size:12.5px;white-space:nowrap}
.chapa .n{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:rgba(43,20,5,.55);color:#ffe082;font-size:13px;text-shadow:none;box-shadow:inset 0 1px 2px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.25)}
.chapa-grande{font-size:17px;padding:9px 22px 9px 10px;gap:12px} .chapa-grande .n{width:38px;height:38px;font-size:19px}
.chapa-plata .n{background:rgba(14,22,27,.55);color:#eef4f8}
/* el globo del mono: vidrio naranja, con cola abajo o al costado; o pleno */
.globo{position:relative;flex:none;border-radius:14px;padding:11px 16px 12px;display:flex;flex-direction:column;gap:5px;background:rgba(245,132,58,.16);border:1px solid rgba(245,132,58,.5);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 8px 24px -12px rgba(0,0,0,.7)}
.globo b{font-size:18px;font-weight:800;line-height:1.25;color:var(--accent-ink)} .globo p{font-size:13.5px;line-height:1.4;color:var(--ink-2)} .globo em{font-style:normal;color:var(--accent-ink);font-weight:800}
.globo .chip{align-self:flex-start;margin-bottom:2px}
.globo-abajo{align-items:center;text-align:center} .globo-abajo .chip{align-self:center}
.globo-abajo::before,.globo-abajo::after{content:"";position:absolute;left:50%;bottom:-9px;margin-left:-8px;border:8px solid transparent;border-bottom:0;border-top-color:rgba(245,132,58,.5)}
.globo-abajo::after{bottom:-7px;border-top-color:rgba(245,132,58,.16)}
.globo-lado{flex:1;min-width:0}
.globo-lado::before,.globo-lado::after{content:"";position:absolute;left:-9px;bottom:22px;border:8px solid transparent;border-left:0;border-right-color:rgba(245,132,58,.5)}
.globo-lado::after{left:-7px;border-right-color:rgba(245,132,58,.16)}
.globo-pleno{background:var(--accent);border:0;border-bottom:4px solid var(--accent-deep);box-shadow:inset 0 1px 0 rgba(255,255,255,.35);backdrop-filter:none}
.globo-pleno b{color:var(--on-accent)} .globo-pleno p{color:rgba(43,20,5,.78)}
.globo-pleno.globo-lado::before{border-right-color:var(--accent)} .globo-pleno.globo-lado::after{display:none}
.globo-pleno.globo-abajo::before{border-top-color:var(--accent-deep)} .globo-pleno.globo-abajo::after{display:none}
.mono-globo{display:flex;align-items:flex-end;gap:10px}
.mono-suelto{width:96px;height:96px;flex:none;position:relative}
.mono-suelto::before{content:"";position:absolute;left:8px;right:8px;bottom:2px;height:14px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.6),transparent)}
.mono-suelto img{position:relative;width:96px;height:96px;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,.45))}
.mono-grande{position:relative;display:flex;justify-content:center}
.mono-grande img{position:relative;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.6))}
.mono-grande::after{content:"";position:absolute;left:50%;bottom:6px;width:150px;height:18px;margin-left:-75px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.65),transparent)}
/* chips */
.chip{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.10);color:var(--ink);border-radius:6px;padding:4px 8px;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;line-height:1.3}
.chip span{color:var(--ink-3)}
.chip-accent{background:var(--accent-soft);color:var(--accent-ink)} .chip-reward{background:var(--reward-soft);color:var(--reward)} .chip-brand{background:var(--brand-soft);color:var(--brand-ink)} .chip-ok{background:#0f2a1f;color:#43c98b} .chip-danger{background:#2f1614;color:#f0736a}
.chip-mono{font-family:ui-monospace,'Cascadia Mono',Consolas,monospace;letter-spacing:.12em;text-transform:none}
/* fichas */
.ficha{border:2px solid var(--f);border-radius:14px;padding:10px 6px 12px;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(21,31,38,.85);box-shadow:0 0 18px -6px var(--f),inset 0 1px 0 rgba(255,255,255,.06)}
.ficha span{font-size:9.5px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;color:var(--f);white-space:nowrap}
.ficha b{font-size:19px;font-weight:800;letter-spacing:-.02em;white-space:nowrap}
/* fila */
.fila{display:flex;align-items:center;gap:12px;min-height:56px;padding:10px 14px;background:rgba(21,31,38,.85);border:1px solid var(--rule);border-radius:14px;text-align:left}
.fila > .grow{display:flex;flex-direction:column;gap:3px} .fila b{font-size:15px;line-height:1.25} .fila .sub{font-size:12.5px;color:var(--ink-3);line-height:1.3}
.fila > .grow > .chip{align-self:flex-start}
.chev{flex:none;color:#6f8794}
/* barras */
.bar{position:relative;height:20px;border-radius:10px;background:var(--surface-3);overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.bar-fill{height:100%;border-radius:10px;background:var(--brand)}
.bar-value{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;font-weight:800;letter-spacing:.02em;color:var(--ink);text-shadow:0 1px 2px rgba(0,0,0,.55)}
.bar-chrome{height:28px;border-radius:14px;box-shadow:inset 0 2px 4px rgba(0,0,0,.5),inset 0 -1px 0 rgba(255,255,255,.07),0 0 0 1px rgba(0,0,0,.3)}
.bar-chrome .bar-value{font-size:13.5px;font-weight:900;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.85),0 0 8px rgba(0,0,0,.55)}
.bar-chrome .bar-fill{position:relative;overflow:hidden;border-radius:14px;background:${METAL2},${RAMPA};box-shadow:inset 0 0 0 1px rgba(255,255,255,.4),0 0 14px -2px rgba(91,156,242,.8)}
/* cabeceras */
.topbar{position:relative;z-index:1}
.topbar .fab{box-shadow:none;background:var(--surface-2);border-color:transparent}
.topbar h2{flex:1;min-width:0}
.hero{position:relative;overflow:hidden;flex:none;display:flex;flex-direction:column}
.hero-top{display:flex;align-items:center;gap:10px;padding:10px 12px;position:relative;z-index:1}
.hero-top h2{flex:1;color:var(--ink)}
.sos-bar{position:relative;height:48px;background:#f0736a;color:#2a0b08;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:900;letter-spacing:.12em;flex:none}
.sos-bar .fab{position:absolute;left:12px;top:6px;width:36px;height:36px;background:rgba(0,0,0,.14);border-color:transparent;color:#2a0b08;box-shadow:none}
/* escalera de niveles */
.escalera{display:flex;align-items:center;justify-content:center}
.peldano{width:14px;height:14px;border-radius:50%;background:var(--surface-3);box-shadow:inset 0 1px 2px rgba(0,0,0,.6);flex:none}
.peldano.hecho{background:${ORO};box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 0 0 1px rgba(0,0,0,.4)}
.peldano.actual{width:20px;height:20px;background:${ORO};box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 0 0 2px #0d1418,0 0 0 4px rgba(255,200,80,.85),0 0 16px 2px rgba(255,200,80,.55)}
.tramo{width:22px;height:3px;background:var(--surface-3);flex:none} .tramo.hecho{background:linear-gradient(90deg,#f7a53c,#ffe082)}
/* formulario */
.input{min-height:48px;padding:0 14px;border-radius:9px;border:1px solid var(--rule);background:var(--surface);color:var(--ink-3);display:flex;align-items:center;font-size:15px}
.input.neon{color:var(--ink)}
.field{display:flex;flex-direction:column;gap:6px} .field label{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3)}
.beneficio{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;flex:1}
.beneficio span{font-size:11.5px;color:var(--ink-2);line-height:1.3}
.ico{display:block;filter:drop-shadow(0 1px 0 rgba(0,0,0,.25));flex:none}
/* semana de la racha */
.dia{display:flex;flex-direction:column;align-items:center;gap:6px}
.dia i{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:var(--surface-2);box-shadow:inset 0 1px 3px rgba(0,0,0,.5)}
.dia i.hecho{background:var(--accent);color:var(--on-accent);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 0 14px -3px rgba(245,132,58,.8)}
.dia i.hoy{background:transparent;border:3px solid var(--accent);color:var(--accent-ink)}
.dia span{font-size:11px;font-weight:800;color:var(--ink-3)} .dia.hoy span{color:var(--accent-ink)}
/* logros */
.record{flex:none;width:150px;border-radius:16px;padding:14px 12px 12px;display:flex;flex-direction:column;gap:2px;position:relative;overflow:hidden;background:linear-gradient(160deg,var(--r1),var(--r2));box-shadow:0 0 22px -8px var(--r1),inset 0 1px 0 rgba(255,255,255,.25)}
.record .num{font-size:40px;font-weight:900;letter-spacing:-.04em;line-height:1;color:#fff;text-shadow:0 2px 0 rgba(0,0,0,.35)}
.record .nom{font-size:13px;font-weight:800;color:#fff} .record .fecha{font-size:11px;color:rgba(255,255,255,.75)}
.insignia{position:relative;display:grid;place-items:center;flex:none}
.insignia b{position:absolute;bottom:-2px;left:0;right:0;text-align:center;font-weight:800;color:#fff;text-shadow:0 2px 0 #0d1418,0 -2px 0 #0d1418,2px 0 0 #0d1418,-2px 0 0 #0d1418}
`;

/* ---- piezas -------------------------------------------------------------- */
const ff = (body) => file(body, CSS);
const chev = `<svg class="chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>`;
const share = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M7 9l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"/></svg>`;
const check = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const chapa = (n, nombre, extra = '') => `<span class="chapa cromo-oro destello ${extra}"><span class="n">${n}</span>${nombre}</span>`;
const chapaPlata = (n, nombre) => `<span class="chapa chapa-plata cromo-plata" style="opacity:.75;transform:scale(.9)"><span class="n">${n}</span>${nombre}</span>`;
const fila = (icono, titulo, sub, derecha = '', extra = '') => `<div class="fila ${extra}">${icono}<div class="grow"><b>${titulo}</b>${sub ? `<span class="sub">${sub}</span>` : ''}</div>${derecha}${chev}</div>`;
const topbar = (titulo, derecha = '', icono = ico.atras) => `<div class="topbar"><div class="fab">${icono}</div><h2>${titulo}</h2>${derecha}</div>`;
const ficha = (icono, etiqueta, valor, color) => `<div class="ficha" style="--f:${color}">${icono}<span>${etiqueta}</span><b>${valor}</b></div>`;
const monoGrande = (pose, px) => `<div class="mono-grande"><img src="${pose}.png" alt="" style="width:${px}px;height:${px}px"></div>`;
const globoLado = (pose, titulo, texto, chipHtml = '', pleno = false) => `<div class="mono-globo"><div class="mono-suelto"><img src="${pose}.png" alt=""></div><div class="globo globo-lado ${pleno ? 'globo-pleno' : ''}">${chipHtml}<b>${titulo}</b><p>${texto}</p></div></div>`;
const confeti = (n, alto) => [...Array(n)].map((_, i) => {
  const c = ['#a97bf0', '#f5843a', '#8a86f2', '#eaf1f5', '#35b8e8', '#ffe082', '#ffe082'][i % 7];
  const forma = i % 3 === 0 ? 'width:8px;height:8px;border-radius:50%' : i % 3 === 1 ? 'width:7px;height:12px;border-radius:2px' : 'width:12px;height:5px;border-radius:2px';
  return `<i style="position:absolute;left:${4 + (i * 31) % 92}%;top:${Math.round(6 + ((i * 37) % 100) / 100 * alto)}px;${forma};background:${c};transform:rotate(${(i * 53) % 180}deg);opacity:.92"></i>`;
}).join('');
const SIM = {
  viajes: `<rect x="8" y="6" width="2" height="12"/><rect x="10" y="6" width="6" height="2"/><rect x="10" y="8" width="7" height="3"/><rect x="10" y="11" width="6" height="2"/>`,
  km: `<rect x="6" y="9" width="8" height="6"/><rect x="14" y="11" width="4" height="4"/><rect x="7" y="15" width="2" height="2"/><rect x="15" y="15" width="2" height="2"/>`,
  repartos: `<rect x="7" y="8" width="10" height="9"/><rect x="11" y="8" width="2" height="9" class="h"/><rect x="7" y="11" width="10" height="1" class="h"/>`,
  nocturnos: `<rect x="9" y="6" width="5" height="1"/><rect x="8" y="7" width="2" height="1"/><rect x="7" y="8" width="2" height="3"/><rect x="7" y="11" width="2" height="3"/><rect x="8" y="14" width="2" height="2"/><rect x="10" y="16" width="5" height="1"/><rect x="14" y="15" width="3" height="1"/><rect x="15" y="14" width="2" height="1"/>`
};
const insignia = (color, simbolo, n, t = 56, bloqueada = false) => `
<div class="insignia" style="width:${t}px;height:${t}px;${bloqueada ? 'opacity:.45' : ''}">
  <svg viewBox="0 0 24 24" width="${Math.round(t * .82)}" height="${Math.round(t * .82)}" shape-rendering="crispEdges"><path d="M3 3h18v11l-9 8-9-8z" fill="#0d1418"/><path d="M4 4h16v9.5l-8 7-8-7z" fill="${color}"/><rect x="5" y="5" width="2" height="8" fill="rgba(255,255,255,.35)"/><rect x="5" y="5" width="6" height="2" fill="rgba(255,255,255,.35)"/><g fill="#fff">${simbolo.replace(/class="h"/g, `fill="${color}"`)}</g></svg>
  <b style="font-size:${Math.round(t * .3)}px">${n}</b>
</div>`;
const SHEET = (adentro) => `<div style="flex:none;background:var(--surface);border-radius:14px 14px 0 0;padding:10px 16px 16px;box-shadow:0 -4px 24px -8px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:12px;position:relative;z-index:1"><div style="width:44px;height:4px;border-radius:2px;background:var(--rule);margin:0 auto 2px"></div>${adentro}</div>`;

const out = {};

/* ===========================================================================
   Portada — el camino elegido
=========================================================================== */
const sw = (c, n) => `<div style="display:flex;flex-direction:column;gap:4px;align-items:center"><div style="width:34px;height:34px;border-radius:10px;background:${c};box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 0 0 1px rgba(0,0,0,.4)"></div><span class="hint" style="font-size:9.5px">${n}</span></div>`;
out['Main.dc.html'] = ff(`
<div style="width:1200px;height:800px;padding:40px 48px;display:flex;flex-direction:column;gap:24px;position:relative;overflow:hidden;background:#0d1418">
  <div class="luz luz-brand" style="opacity:.8"></div>
  <div class="z" style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
    <div style="display:flex;flex-direction:column;gap:6px">
      <span class="section-caps" style="color:var(--brand-ink);letter-spacing:.14em">Navegador de tránsito pesado · El GPS de los camioneros</span>
      <h1 style="font-size:36px;font-weight:900;letter-spacing:-.03em">El camino elegido</h1>
      <p style="font-size:15px;color:var(--ink-2);max-width:640px;line-height:1.45">Estructura de Duolingo, tema del camión. Luz de color en vez de bandas, vidrio y neón, cromo en tres tonos, el naranja como la voz del mono, y la chapa de nivel que acompaña al usuario a todos lados. El GPS en movimiento queda afuera de todo esto.</p>
    </div>
    ${chapa(2, 'Repartidor', 'chapa-grande')}
  </div>

  <div class="z" style="display:grid;grid-template-columns:1.15fr 1fr 1fr 1fr;gap:16px;flex:1">
    <div class="vidrio" style="border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px">
      <span class="section-caps" style="color:var(--accent-ink)">El mono habla en naranja</span>
      ${globoLado('mate', 'Un mate y salimos.', 'Doce días seguidos al volante.', chip('Racha', 'Día 12', 'chip-reward'))}
      ${globoLado('rueda', 'Se arregla.', 'Probá de nuevo en un momento.', '', true)}
      <p class="hint" style="margin-top:auto">Vidrio donde hay más texto o luz detrás; pleno para una frase. Donde él habla, el botón es celeste.</p>
    </div>
    <div class="vidrio" style="border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px">
      <span class="section-caps" style="color:var(--brand-ink)">Cromo en tres tonos</span>
      <div class="bar bar-chrome"><div class="bar-fill destello" style="width:62%"></div><div class="bar-value">6 / 10</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${chapa(3, 'Fletero')}<span class="placa cromo-plata destello">3.995 km</span></div>
      <div class="fila neon" style="min-height:44px;padding:6px 10px">${ICO.camion(26)}<div class="grow"><b style="font-size:13.5px">El Rayo</b></div>${chip('', 'En uso', 'chip-brand')}</div>
      <p class="hint" style="margin-top:auto">Frío para el progreso, oro para el nivel, plata para los totales. El neón enciende lo activo.</p>
    </div>
    <div class="vidrio" style="border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px">
      <span class="section-caps" style="color:var(--brand-ink)">Fichas, filas, íconos</span>
      <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:8px">${ficha(ICO.km(22), 'Kilómetros', '23,4', '#35b8e8')}${ficha(ICO.exp(22), 'EXP', '+212', '#a97bf0')}</div>
      <div class="fila" style="min-height:44px;padding:6px 10px">${ICO.noche(26)}<div class="grow"><b style="font-size:13.5px">Apariencia</b></div>${chip('', 'Noche')}${chev}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${ICO.viaje(26)}${ICO.historial(26)}${ICO.logros(26)}${ICO.nivel(26)}${ICO.telefono(26)}${ICO.trivia(26)}${ICO.idioma(26)}${ICO.salir(26)}</div>
      <p class="hint" style="margin-top:auto">La ficha lleva su color y su luz; la fila de Configuración es la caja de todo; los íconos, ilustrados como los del zócalo.</p>
    </div>
    <div class="vidrio" style="border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:10px">
      <span class="section-caps" style="color:var(--brand-ink)">Color y tipografía</span>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${sw('#0d1418', 'Asfalto')}${sw('#151f26', 'Superficie')}${sw('#35b8e8', 'Marca')}${sw('#5b9cf2', 'Cool 2')}${sw('#8a86f2', 'Cool 3')}${sw('#a97bf0', 'Recompensa')}${sw('#f5843a', 'Acento')}${sw(ORO, 'Oro')}</div>
      <div style="display:flex;flex-direction:column;gap:2px;margin-top:4px"><span style="font-size:26px;font-weight:900;letter-spacing:-.03em;line-height:1">Nunito 900</span><span style="font-size:15px;font-weight:800">Nunito 800 para lo que se lee</span><span class="section-caps">Caps 800 · espaciadas</span></div>
      <p class="hint" style="margin-top:auto">Paleta fría; el naranja corta y por eso se usa poco; el oro sólo en el nivel; rojo y verde, semánticos.</p>
    </div>
  </div>

  <div class="z" style="display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));gap:16px">
    <p style="font-size:12.5px;color:var(--ink-2);line-height:1.35"><b style="color:var(--ink)">Un foco por pantalla.</b> Y una sola acción principal.</p>
    <p style="font-size:12.5px;color:var(--ink-2);line-height:1.35"><b style="color:var(--ink)">Celeste si es formulario, naranja si es festejo.</b></p>
    <p style="font-size:12.5px;color:var(--ink-2);line-height:1.35"><b style="color:var(--ink)">Un cromo por pantalla.</b> Si todo brilla, nada brilla.</p>
    <p style="font-size:12.5px;color:var(--ink-2);line-height:1.35"><b style="color:var(--ink)">El mono habla, no decora.</b> Una pose por momento, siempre la misma.</p>
    <p style="font-size:12.5px;color:var(--ink-2);line-height:1.35"><b style="color:var(--ink)">El mapa en movimiento no lleva nada de esto.</b></p>
  </div>
</div>`);

/* ===========================================================================
   Bienvenida y Subiste de nivel — las dos aprobadas, sin cambios
=========================================================================== */
out['Bienvenida.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-brand"></div>
  <svg class="luz" viewBox="0 0 390 844" width="390" height="844" fill="none" style="opacity:.55"><path d="M60 844 L178 520 L212 520 L330 844" stroke="rgba(53,184,232,.22)" stroke-width="2"/><path d="M195 530 v40 M195 600 v52 M195 685 v64 M195 785 v60" stroke="rgba(53,184,232,.30)" stroke-width="3" stroke-linecap="round"/></svg>
  <div class="z" style="padding:22px 20px 0;display:flex;flex-direction:column;align-items:center;flex:1;min-height:0">
    <span class="section-caps" style="color:var(--brand-ink);letter-spacing:.14em">Navegador de tránsito pesado · CABA</span>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%">
      <div class="globo globo-abajo" style="max-width:270px">${chip('', 'Bienvenido', 'chip-accent')}<b>Hola, compañero.</b><p>Yo te acompaño. Vos manejás.</p></div>
      <div style="position:relative;margin-top:16px"><div style="position:absolute;left:50%;top:50%;width:260px;height:260px;margin:-130px 0 0 -130px;border-radius:50%;background:radial-gradient(closest-side,rgba(53,184,232,.22),transparent)"></div>${monoGrande('mate', 224)}</div>
      <h1 style="font-size:32px;font-weight:900;letter-spacing:-.03em;line-height:1.05;text-align:center;margin-top:18px">El GPS de los<br><span style="color:var(--brand-ink)">camioneros</span></h1>
      <p style="text-align:center;font-size:14.5px;color:var(--ink-2);line-height:1.4;margin-top:10px;max-width:300px">Rutas por donde tu camión puede pasar. Y kilómetros que suman.</p>
    </div>
    <div style="display:flex;gap:8px;width:100%;padding:0 4px 18px">
      <div class="beneficio">${ICO.viaje(30)}<span>Ruta según tu camión</span></div>
      <div class="beneficio">${ICO.logros(30)}<span>Gálibos y Red pesada</span></div>
      <div class="beneficio">${ICO.exp(30)}<span>Cada viaje suma</span></div>
    </div>
  </div>
  <div class="z" style="padding:0 16px 22px;display:flex;flex-direction:column;gap:10px">
    <div class="btn btn-primary btn-duo btn-block brillo">Empezar</div>
    <div class="btn btn-outline-brand btn-duo btn-block">Ya tengo una cuenta</div>
    <p class="hint" style="text-align:center;margin-top:2px">Ley 2148 de la Ciudad · Mapa de OpenStreetMap</p>
  </div>
</div>`);

out['SubisteDeNivel.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-festejo"></div>
  <div class="rayos"></div>
  <div class="luz" style="height:420px">${confeti(26, 380)}</div>
  <div class="z" style="display:flex;align-items:center;justify-content:space-between;padding:14px 12px 0">
    <span class="section-caps" style="color:var(--accent-ink);letter-spacing:.14em;padding-left:6px">Subiste de nivel</span>
    <div class="fab vidrio" style="box-shadow:none">${ico.mas}</div>
  </div>
  <div class="z" style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;padding:0 16px 16px;gap:12px">
    <div style="margin-top:-6px">${monoGrande('festejo', 222)}</div>
    <h1 style="font-size:30px;font-weight:900;letter-spacing:-.03em;line-height:1.05;text-align:center;color:var(--accent-ink);margin-top:-8px">¡Ahora sos Repartidor!</h1>
    <div style="display:flex;align-items:center;gap:10px;margin-top:2px">${chapaPlata(1, 'Novato')}<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ffe082" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>${chapa(2, 'Repartidor', 'chapa-grande')}</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:2px">
      <div class="escalera"><div class="peldano hecho"></div><div class="tramo hecho"></div><div class="peldano actual"></div><div class="tramo"></div><div class="peldano"></div><div class="tramo"></div><div class="peldano"></div><div class="tramo"></div><div class="peldano"></div><div class="tramo"></div><div class="peldano"></div><div class="tramo"></div><div class="peldano"></div></div>
      <div style="display:flex;justify-content:space-between;width:250px"><span class="hint" style="font-size:10.5px">Novato</span><span class="section-caps" style="font-size:10.5px;color:var(--accent-ink)">Repartidor</span><span class="hint" style="font-size:10.5px">Leyenda</span></div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;width:100%;margin-top:4px">${ficha(ICO.km(24), 'Kilómetros', '3.995', '#35b8e8')}${ficha(ICO.viaje(24), 'Viajes', '39', '#8a86f2')}${ficha(ICO.nivel(24), 'Hacia Fletero', '4.505 km', '#a97bf0')}</div>
    <div style="width:100%;display:flex;flex-direction:column;gap:8px;margin-top:2px">
      <p class="section-caps" style="text-align:left">Se abre</p>
      ${fila(ICO.logros(32), 'Diez metas nuevas', 'Hacia Fletero, de 2.500 a 8.500 km.', chip('', 'Metas', 'chip-brand'))}
      ${fila(ICO.carnet(32), 'La chapa de Repartidor', 'En tu perfil y en tu carnet, desde hoy.', chip('', 'Nuevo', 'chip-reward'))}
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;gap:10px;width:100%"><div class="fab vidrio" style="width:52px;height:52px;border-radius:14px;box-shadow:none;flex:none">${share}</div><div class="btn btn-accent btn-duo btn-block brillo" style="flex:1">Continuar</div></div>
  </div>
</div>`);

/* ===========================================================================
   Idioma — paso 2 de la entrada
=========================================================================== */
out['Idioma.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-tenue"></div>
  ${topbar('Idioma', chip('Paso', '2 de 4'))}
  <div class="z" style="flex:1;padding:16px;display:flex;flex-direction:column;gap:10px">
    <p style="font-size:14px;color:var(--ink-2);line-height:1.4;margin-bottom:6px">¿En qué idioma te hablo? Por ahora, español. Los demás están en camino.</p>
    ${fila(ICO.idioma(32), 'Español', 'Argentina', chip('', 'Elegido', 'chip-brand'), 'neon')}
    ${fila(ICO.idioma(32), 'Português', 'Brasil', chip('', 'Pronto', 'chip-reward'))}
    ${fila(ICO.idioma(32), 'English', '', chip('', 'Pronto', 'chip-reward'))}
    ${fila(ICO.idioma(32), 'Guaraní', 'Paraguay', chip('', 'Pronto', 'chip-reward'))}
    <div style="flex:1"></div>
    <div class="btn btn-primary btn-duo btn-block brillo">Continuar</div>
  </div>
</div>`);

/* ===========================================================================
   Entrar
=========================================================================== */
out['Entrar.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-brand"></div>
  <div class="z" style="padding:20px 16px 0;display:flex;flex-direction:column;gap:14px">
    <span class="section-caps" style="color:var(--brand-ink);letter-spacing:.14em">Navegador de tránsito pesado · CABA</span>
    <h1 style="font-size:30px;font-weight:900;letter-spacing:-.03em;line-height:1.05">Hola de nuevo,<br><span style="color:var(--brand-ink)">compañero.</span></h1>
    <div style="display:flex;align-items:flex-end;gap:6px;margin-top:6px"><div class="mono-suelto" style="width:150px;height:150px"><img src="mate.png" alt="" style="width:150px;height:150px"></div><div class="globo globo-lado" style="margin-bottom:26px">${chip('', 'Entrar', 'chip-accent')}<b>¿Salimos?</b><p>Entrá y te devuelvo tu camión y tus kilómetros.</p></div></div>
  </div>
  <div class="z" style="flex:1;min-height:0;padding:14px 16px 20px;display:flex;flex-direction:column;gap:12px">
    <div class="vidrio" style="border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px;background:rgba(21,31,38,.72)">
      <div class="field"><label>Correo</label><div class="input neon">tu@correo.com</div></div>
      <div class="field"><label>Contraseña</label><div class="input">••••••••</div></div>
      <div class="btn btn-primary btn-duo btn-block brillo">Entrar</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0 4px"><span style="font-size:13.5px;color:var(--brand-ink);font-weight:800">Crear una cuenta</span><span class="hint">¿Olvidaste la contraseña?</span></div>
    <p class="hint" style="text-align:center;margin-top:auto">Ley 2148 de la Ciudad · Mapa de OpenStreetMap</p>
  </div>
</div>`);

/* ===========================================================================
   Mapa — antes de arrancar. Sobrio; el mono sólo acá, nunca en movimiento.
=========================================================================== */
out['Mapa.dc.html'] = ff(`
<div class="pantalla">
  ${MAPA(true)}
  ${SHEET(`
    <div class="row">${ICO.camion(28)}<b class="grow" style="font-size:15px">El Rayo</b><span class="muted">40 t · 4,20 m</span></div>
    <div class="row" style="justify-content:space-between"><b style="font-size:20px;letter-spacing:-.02em">9,8 km · 24 min</b>${chip('', 'Por la Red', 'chip-brand')}</div>
    ${globoLado('binoculares', 'Ojo con Av. Sáenz.', 'Gálibo de 3,9 m; tu camión mide 4,20. La ruta ya lo esquiva.', '', true)}
    <div class="btn btn-primary btn-block brillo" style="min-height:52px;font-weight:700">Arrancar</div>
  `)}
  ${dock('mapa')}
</div>`);

/* ===========================================================================
   Perfil — estructura de la captura, sin la banda: luz, avatar, chapa
=========================================================================== */
const resumen = (icono, valor) => `<div style="display:flex;align-items:center;gap:10px">${icono}<b style="font-size:17px">${valor}</b></div>`;
const meta = (nombre, progreso, titulo, pct, color, simbolo, n) => `
<div style="display:flex;align-items:center;gap:12px">
  <div style="flex:1;display:flex;flex-direction:column;gap:6px">
    <div style="display:flex;justify-content:space-between"><span class="section-caps">${nombre}</span><span class="section-caps" style="color:var(--brand-ink)">${progreso}</span></div>
    <b style="font-size:15px">${titulo}</b>
    <div class="bar"><div class="bar-fill" style="width:${pct}%"></div><div class="bar-value">${progreso}</div></div>
  </div>
  ${insignia(color, simbolo, n, 52)}
</div>`;

out['Perfil.dc.html'] = ff(`
<div class="pantalla" style="height:1240px">
  <div class="luz luz-brand" style="height:520px"></div>
  <div class="z" style="display:flex;align-items:center;justify-content:space-between;padding:14px 12px 0">
    <h2 style="padding-left:6px">Demo Camionero</h2>
    <div style="display:flex;gap:8px"><div class="fab vidrio" style="box-shadow:none">${share}</div><div class="fab vidrio" style="box-shadow:none">${ICO.config(24)}</div></div>
  </div>
  <div class="z" style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 16px 0">
    <div style="width:128px;height:128px;border-radius:24px;background:linear-gradient(160deg,#8a86f2,#a97bf0);border:3px solid rgba(255,255,255,.75);display:grid;place-items:center;box-shadow:0 0 34px -6px rgba(138,134,242,.9)"><span style="font-size:48px;font-weight:900;color:#fff;letter-spacing:-.04em">DC</span></div>
    ${chapa(2, 'Repartidor')}
    <span class="section-caps" style="font-size:11px">@demo · Argentina · desde 2026</span>
  </div>
  <div class="z" style="padding:16px 16px 0;display:flex;flex-direction:column;gap:14px">
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px">${ficha(ICO.km(22), 'Kilómetros', '3.995', '#35b8e8')}${ficha(ICO.viaje(22), 'Viajes', '39', '#8a86f2')}${ficha(ICO.logros(22), 'Logros', '24', '#a97bf0')}</div>
    <div class="btn btn-accent btn-duo btn-block brillo">${ICO.historial(20)} Ver mis viajes</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between"><span class="section-caps">Nivel 2 · Repartidor</span><span class="section-caps" style="color:var(--brand-ink)">2 / 10</span></div>
      <b style="font-size:15px">Te faltan <span style="color:var(--accent-ink)">4.505 km</span> para Fletero</b>
      <div class="bar bar-chrome"><div class="bar-fill destello" style="width:20%"></div><div class="bar-value">2 / 10</div></div>
    </div>
    <div class="vidrio" style="border-radius:16px;padding:14px;display:flex;align-items:center;gap:12px">
      <div class="grow" style="display:flex;flex-direction:column;gap:6px"><b style="font-size:17px">¡Completá tu perfil!</b><span class="section-caps" style="font-size:11px">Quedan 2 pasos</span><div class="btn btn-primary brillo" style="min-height:40px;font-size:14px;font-weight:800;align-self:flex-start;padding:0 16px;margin-top:4px">Continuar</div></div>
      <div class="mono-suelto" style="width:88px;height:88px"><img src="mapa.png" alt="" style="width:88px;height:88px"></div>
    </div>
    <p class="section-caps">Resumen</p>
    <div style="display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));gap:12px">${resumen(ICO.exp(26), '3.077 EXP')}${resumen(ICO.km(26), '3.995 km')}${resumen(ICO.viaje(26), '39 viajes')}${resumen(ICO.volante(26), '89 h 23')}</div>
    <p class="section-caps">Metas</p>
    ${meta('Kilómetros', '12 / 70', 'Llegá a 4.300 km', 93, '#e8705f', SIM.km, '4.300')}
    ${meta('Viajes', '5 / 10', 'Hacé 60 viajes', 65, '#8a86f2', SIM.viajes, '60')}
    <div style="display:flex;justify-content:space-between;align-items:center"><span class="section-caps">Logros</span>${chev}</div>
    <div style="display:flex;justify-content:space-between;padding:0 4px">${insignia('#b56ad6', SIM.viajes, '7', 62)}${insignia('#e8705f', SIM.km, '2.750', 62)}${insignia('#6f8794', SIM.repartos, '5', 62, true)}${insignia('#e0554b', SIM.nocturnos, '2', 62)}</div>
    <div style="height:8px"></div>
  </div>
  ${dock('mas')}
</div>`);

/* ===========================================================================
   Racha
=========================================================================== */
const dia = (l, estado) => `<div class="dia ${estado}"><span>${l}</span><i class="${estado}">${estado ? check : ''}</i></div>`;
out['Racha.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-festejo"></div>
  <div class="z" style="display:flex;align-items:center;justify-content:space-between;padding:14px 12px 0"><div class="fab vidrio" style="box-shadow:none">${ico.cerrar}</div><div class="fab vidrio" style="box-shadow:none">${share}</div></div>
  <div class="z" style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;padding:6px 16px 16px;gap:10px">
    <div class="globo globo-abajo" style="max-width:290px">${chip('Racha', 'Día 12', 'chip-reward')}<b>Un mate y salimos.</b><p>Doce días seguidos al volante. Hoy también cuenta.</p></div>
    <div style="margin-top:12px">${monoGrande('mate', 200)}</div>
    <div style="display:flex;flex-direction:column;align-items:center;margin-top:-4px"><span style="font-size:104px;line-height:.95;font-weight:900;letter-spacing:-.05em;color:var(--accent);text-shadow:0 0 34px rgba(245,132,58,.45)">12</span><span class="section-caps" style="color:var(--accent-ink);font-size:13px;margin-top:6px">días de racha</span></div>
    <div style="display:flex;justify-content:space-between;width:100%;padding:0 4px;margin-top:8px">${dia('Lu', 'hecho')}${dia('Ma', 'hecho')}${dia('Mi', 'hecho')}${dia('Ju', 'hecho')}${dia('Vi', 'hoy')}${dia('Sa', '')}${dia('Do', '')}</div>
    <div style="flex:1"></div>
    <div class="btn btn-accent btn-duo btn-block brillo">Seguir</div>
  </div>
</div>`);

/* ===========================================================================
   Metas — estructura de Desafíos
=========================================================================== */
out['Metas.dc.html'] = ff(`
<div class="pantalla">
  <div class="hero" style="height:190px;background:radial-gradient(70% 80% at 80% 20%,rgba(169,123,240,.55),transparent 65%),linear-gradient(180deg,#1a1c3a,#0d1418)">
    <div class="hero-top"><div class="fab vidrio" style="box-shadow:none">${ico.menu}</div><h2>Metas</h2></div>
    <div style="flex:1;display:flex;align-items:flex-end;justify-content:space-between;padding:0 16px;position:relative;z-index:1">
      <p style="font-size:15px;color:var(--ink-2);line-height:1.4;max-width:210px;padding-bottom:20px">Completá metas y ganá recompensas. Cada escalón sube el color del logro.</p>
      <img src="binoculares.png" alt="" style="width:120px;height:120px;object-fit:contain;filter:drop-shadow(0 8px 12px rgba(0,0,0,.55));transform:translateY(6px)">
    </div>
  </div>
  <div style="flex:1;min-height:0;padding:16px;display:flex;flex-direction:column;gap:18px">
    ${meta('Kilómetros', '12 / 70', 'Llegá a 4.300 km', 93, '#e8705f', SIM.km, '4.300')}
    <div style="height:1px;background:var(--rule)"></div>
    ${meta('Viajes', '5 / 10', 'Hacé 60 viajes', 65, '#8a86f2', SIM.viajes, '60')}
    <div style="height:1px;background:var(--rule)"></div>
    ${meta('Nocturnos', '1 / 10', 'Dos viajes de noche', 50, '#e0554b', SIM.nocturnos, '2')}
    <div style="flex:1"></div>
    <div class="btn btn-outline-brand btn-duo btn-block">Ver mis logros</div>
  </div>
  ${dock('mas')}
</div>`);

/* ===========================================================================
   Logros — récords y colección
=========================================================================== */
const record = (r1, r2, num, nom, fecha) => `<div class="record" style="--r1:${r1};--r2:${r2}"><span class="num">${num}</span><span class="nom">${nom}</span><span class="fecha">${fecha}</span></div>`;
const logro = (color, simbolo, n, nombre, de, bloq = false) => `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center">${insignia(color, simbolo, n, 72, bloq)}<b style="font-size:13px">${nombre}</b><span class="hint" style="font-size:11px">${de}</span></div>`;
out['Logros.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-tenue"></div>
  ${topbar('Logros', chip('', '24', 'chip-reward'))}
  <div class="z" style="flex:1;min-height:0;padding:16px 0 16px;display:flex;flex-direction:column;gap:14px">
    <p class="section-caps" style="padding:0 16px">Récords</p>
    <div style="display:flex;gap:10px;padding:0 16px;overflow:hidden">${record('#35b8e8', '#1a6f9a', '87', 'Viaje más largo, km', '3 de septiembre')}${record('#f5843a', '#a8501c', '12', 'Racha más larga, días', 'Hoy')}${record('#a97bf0', '#6d46c4', '340', 'Más EXP en un día', '12 de septiembre')}</div>
    <p class="section-caps" style="padding:0 16px;margin-top:4px">Colección</p>
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:12px;padding:0 16px">
      ${logro('#b56ad6', SIM.viajes, '7', 'Viajes', '3 de 10')}${logro('#e8705f', SIM.km, '2.750', 'Kilómetros', '12 de 70')}${logro('#e0554b', SIM.nocturnos, '2', 'Nocturnos', '1 de 10')}
      ${logro('#6f8794', SIM.repartos, '5', 'Repartos', '0 de 10', true)}${logro('#35b8e8', SIM.viajes, '10', 'Racha', '4 de 10')}${logro('#6f8794', SIM.km, '?', 'Secreto', '—', true)}
    </div>
  </div>
  ${dock('mas')}
</div>`);

/* ===========================================================================
   Fin de viaje
=========================================================================== */
out['FinViaje.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-festejo"></div>
  <div class="luz" style="height:300px">${confeti(20, 260)}</div>
  <div class="z" style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;padding:16px 16px 16px;gap:12px">
    <span class="section-caps" style="color:var(--accent-ink);letter-spacing:.14em;align-self:flex-start">Viaje completado</span>
    <div style="margin-top:-6px">${monoGrande('festejo', 200)}</div>
    <h1 style="font-size:28px;font-weight:900;letter-spacing:-.03em;line-height:1.05;text-align:center;color:var(--accent-ink);margin-top:-8px">¡Llegaste, compañero!</h1>
    <p class="muted" style="font-size:14px;margin-top:-6px">Depósito Barracas → Mercado Central</p>
    <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:10px;width:100%">${ficha(ICO.km(24), 'Kilómetros', '23,4 km', '#35b8e8')}${ficha(ICO.volante(24), 'Al volante', '49 min', '#8a86f2')}${ficha(ICO.exp(24), 'EXP ganada', '+212', '#a97bf0')}</div>
    <div style="width:100%;display:flex;flex-direction:column;gap:6px;margin-top:2px">
      <div style="display:flex;justify-content:space-between;align-items:center">${chapa(2, 'Repartidor')}<span class="section-caps" style="color:var(--brand-ink)">Hacia Fletero · 4.505 km</span></div>
      <div class="bar bar-chrome"><div class="bar-fill destello" style="width:20%"></div><div class="bar-value">2 / 10</div></div>
    </div>
    <div style="width:100%;display:flex;flex-direction:column;gap:8px">
      <p class="section-caps" style="text-align:left">Desbloqueaste</p>
      ${fila(insignia('#b56ad6', SIM.viajes, 7, 48), 'Viajes', 'Escalón 3 · 7 viajes', chip('', '+100 EXP', 'chip-reward'))}
    </div>
    <div style="flex:1"></div>
    <div style="display:flex;gap:10px;width:100%"><div class="fab vidrio" style="width:52px;height:52px;border-radius:14px;box-shadow:none;flex:none">${share}</div><div class="btn btn-accent btn-duo btn-block brillo" style="flex:1">Continuar</div></div>
  </div>
  ${dock('mapa')}
</div>`);

/* ===========================================================================
   Historial, Historial vacío, Sin señal
=========================================================================== */
const viaje = (ruta, km, min, exp) => fila(ICO.viaje(32), ruta, `${km} · ${min}`, chip('', exp, 'chip-reward'));
out['Historial.dc.html'] = ff(`
<div class="pantalla">
  ${topbar('Mis viajes', `<span class="placa cromo-plata destello">3.995 km</span>`)}
  <div style="flex:1;min-height:0;padding:16px;display:flex;flex-direction:column;gap:10px">
    <p class="section-caps">Hoy</p>
    ${viaje('Depósito Barracas → Mercado Central', '23,4 km', '49 min', '+212 EXP')}
    ${viaje('Mercado Central → Puerto', '18,1 km', '41 min', '+11 EXP')}
    <p class="section-caps" style="margin-top:8px">Ayer</p>
    ${viaje('Reparto · 5 paradas · Flores', '31,6 km', '1 h 35', '+13 EXP')}
    ${viaje('Puerto → Depósito Barracas', '9,8 km', '24 min', '+10 EXP')}
    <p class="hint" style="text-align:center;margin-top:6px">Los kilómetros se acreditan al llegar, si pasó al menos la mitad del tiempo estimado.</p>
  </div>
  ${dock('mas')}
</div>`);

out['HistorialVacio.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-tenue"></div>
  ${topbar('Mis viajes')}
  <div class="z" style="flex:1;min-height:0;padding:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
    <div class="globo globo-abajo globo-pleno" style="max-width:280px"><b>¿Salimos?</b><p>Tu primer viaje se guarda acá, con sus kilómetros y lo que ganaste.</p></div>
    <div style="margin-top:8px">${monoGrande('mapa', 190)}</div>
    <div style="flex:1"></div>
    <div class="btn btn-primary btn-duo btn-block brillo">Ir al mapa</div>
  </div>
  ${dock('mas')}
</div>`);

out['SinSenal.dc.html'] = ff(`
<div class="pantalla">
  <div class="luz luz-tenue"></div>
  <div class="z" style="flex:1;min-height:0;padding:24px 16px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
    <div class="globo globo-abajo globo-pleno" style="max-width:280px"><b>Sin señal por acá.</b><p>Cuando vuelva la conexión, sigo buscando la ruta.</p></div>
    <div style="margin-top:8px">${monoGrande('binoculares', 190)}</div>
    <div class="bar bar-chrome" style="width:200px;margin-top:6px"><div class="bar-fill destello" style="width:100%;opacity:.55"></div><div class="bar-value">Buscando…</div></div>
    <div style="flex:1"></div>
    <div class="btn btn-primary btn-duo btn-block brillo">Reintentar</div>
    <div class="btn btn-outline-brand btn-duo btn-block">Seguir sin mapa base</div>
  </div>
  ${dock('mapa')}
</div>`);

/* ===========================================================================
   Camiones, Juegos, S.O.S., Configuración — como quedaron
=========================================================================== */
const spec = (icono, etiqueta, valor) => `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1;padding:8px 4px;border-radius:10px;background:rgba(255,255,255,.05)">${icono}<span class="section-caps" style="font-size:9px;letter-spacing:.08em">${etiqueta}</span><b style="font-size:14px">${valor}</b></div>`;
const tipo = (nombre, datos) => `<div class="satin" style="flex:none;width:132px;border-radius:14px;padding:12px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center">${ICO.camion(34)}<b style="font-size:13px;line-height:1.2">${nombre}</b><span class="hint" style="font-size:11.5px">${datos}</span></div>`;
out['Camiones.dc.html'] = ff(`
<div class="pantalla">
  ${topbar('Mis camiones', chip('', '2', 'chip-brand'), ico.menu)}
  <div style="flex:1;min-height:0;padding:16px;display:flex;flex-direction:column;gap:12px">
    <div class="card neon" style="padding:0;gap:0;overflow:hidden;background:var(--surface)">
      <div class="hero" style="padding:14px 14px 0;flex-direction:row;align-items:flex-end;gap:10px;min-height:118px;background:radial-gradient(70% 70% at 30% 10%,rgba(53,184,232,.46),transparent 65%),linear-gradient(180deg,#0f1c26,#151f26)">
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;padding-bottom:14px;position:relative;z-index:1">${chip('', 'En uso', 'chip-brand')}<b style="font-size:24px;font-weight:900;letter-spacing:-.02em;line-height:1">El Rayo</b><span class="placa cromo-plata destello chip-mono" style="align-self:flex-start;font-size:13px;padding:3px 12px;letter-spacing:.14em">AB 123 CD</span></div>
        <div style="position:relative;z-index:1;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5))">${ICO.camion(96)}</div>
      </div>
      <div style="padding:12px 14px 14px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:6px">${spec(ICO.km(22), 'Peso', '40 t')}${spec(ICO.nivel(22), 'Alto', '4,20 m')}${spec(ICO.volante(22), 'Ejes', '5')}${spec(ICO.viaje(22), 'Largo', '18 m')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center"><span class="section-caps">Juntos</span>${chip('', '3.995 km · 39 viajes', 'chip-reward')}</div>
      </div>
    </div>
    ${fila(ICO.camion(34), 'La Chata', 'Camión liviano · 7,5 t · 3,20 m', '<span class="btn btn-outline-brand" style="min-height:34px;padding:0 12px;font-size:13px;font-weight:800">Usar</span>')}
    <div class="btn btn-primary btn-block brillo">${ico.mas} Cargar un camión</div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:6px"><p class="section-caps">Tipos de transporte</p><span class="hint">Tocá uno para partir de él</span></div>
    <div style="display:flex;gap:10px;margin:0 -16px;padding:0 16px 4px;overflow:hidden">${tipo('Camión liviano', '7,5 t · 3,20 m')}${tipo('Camión pesado', '18 t · 3,80 m')}${tipo('Semirremolque', '40 t · 4,20 m')}</div>
  </div>
  ${dock('mas')}
</div>`);

out['Juegos.dc.html'] = ff(`
<div class="pantalla">
  <div class="hero" style="height:250px;background:radial-gradient(70% 70% at 70% 15%,rgba(169,123,240,.52),transparent 65%),radial-gradient(50% 60% at 10% 90%,rgba(53,184,232,.16),transparent 70%),linear-gradient(180deg,#171a30,#0d1418)">
    <div class="hero-top"><div class="fab vidrio" style="box-shadow:none">${ico.menu}</div><h2>Juegos</h2></div>
    <div style="flex:1;display:flex;align-items:flex-end;padding:0 16px;gap:4px;position:relative;z-index:1"><img src="joystick.png" alt="" style="width:150px;height:150px;object-fit:contain;flex:none;transform:translateY(6px);filter:drop-shadow(0 8px 12px rgba(0,0,0,.55))"><div class="globo globo-lado" style="margin-bottom:22px">${chip('', 'Pronto', 'chip-reward')}<b>La trivia va primera.</b><p>Cuando esté, te aviso yo.</p></div></div>
  </div>
  <div style="flex:1;min-height:0;padding:16px;display:flex;flex-direction:column;gap:10px">
    ${fila(ICO.trivia(34), 'Trivia del camionero', 'Rutas, marcas, señales, fútbol. Ranking diario.', chip('', 'Pronto', 'chip-reward'), 'vidrio')}
    ${fila(ICO.viborita(34), 'Viborita con acoplados', 'Cada bulto es un acoplado más. No te enganches la cola.', chip('', 'Pronto', 'chip-reward'))}
    ${fila(ICO.ranking(34), 'Ranking semanal', 'Los que más EXP juntaron. Se reinicia el lunes.', chip('', 'Pronto', 'chip-reward'))}
    <div style="flex:1"></div>
    <div class="btn btn-primary btn-duo btn-block brillo">Avisame cuando esté</div>
  </div>
  ${dock('juegos')}
</div>`);

const contacto = (nombre, tel) => `<div class="fila">${ICO.persona(32)}<div class="grow"><b>${nombre}</b>${chip('', tel, 'chip-mono')}</div>${ICO.telefono(28)}</div>`;
out['Emergencia.dc.html'] = ff(`
<div class="pantalla">
  <div class="sos-bar"><div class="fab">${ico.atras}</div>S.O.S.</div>
  <div style="flex:1;min-height:0;padding:16px;display:flex;flex-direction:column;gap:12px">
    <div class="btn btn-danger-duo btn-block brillo">${ICO.sos(28)} Llamar al 911</div>
    <p class="hint" style="text-align:center;margin-top:-4px">Abre el discador con el número. Vos decidís llamar.</p>
    <p class="section-caps" style="margin-top:6px">Mis contactos · 2 de 3</p>
    ${contacto('Mi vieja', '11 5555 0101')}
    ${contacto('Lautaro', '11 5555 0202')}
    <div class="btn btn-outline-brand btn-block">${ico.mas} Agregar un contacto</div>
    <p class="hint" style="text-align:center">Tres como máximo: en el peor momento, una lista larga obliga a elegir.</p>
  </div>
  ${dock('emergencia')}
</div>`);

const ajuste = (icono, titulo, valor, clase = '') => fila(icono, titulo, '', valor ? chip('', valor, clase) : '');
out['Configuracion.dc.html'] = ff(`
<div class="pantalla">
  ${topbar('Configuración')}
  <div style="flex:1;min-height:0;padding:16px;display:flex;flex-direction:column;gap:10px">
    <div class="fila satin">${ICO.persona(36)}<div class="grow"><b>Demo Camionero</b><span class="sub">@demo · desde 2026</span></div>${chapa(2, 'Repartidor')}</div>
    <p class="section-caps" style="margin-top:6px">Pantalla</p>
    ${ajuste(ICO.noche(32), 'Apariencia', 'Noche')}
    ${ajuste(ICO.idioma(32), 'Idioma', 'Español')}
    <p class="section-caps" style="margin-top:6px">Datos</p>
    ${ajuste(ICO.fuentes(32), 'Fuentes de los datos', 'OSM · Ley 2148')}
    ${ajuste(ICO.config(32), 'Servidor', 'De fábrica', 'chip-brand')}
    <p class="section-caps" style="margin-top:6px">Cuenta</p>
    ${ajuste(ICO.salir(32), 'Cerrar sesión', '')}
  </div>
  ${dock('mas')}
</div>`);

/* ===========================================================================
   Sello — la cabeza es la marca (de la ronda 1)
=========================================================================== */
out['Sello.dc.html'] = ff(`
<div style="width:900px;height:560px;padding:36px 44px;display:flex;flex-direction:column;gap:24px;background:var(--ground)">
  <div style="display:flex;flex-direction:column;gap:6px">
    <p class="section-caps">El sello</p>
    <h1 style="font-size:28px">La cabeza es la marca</h1>
    <p style="font-size:15px;color:var(--ink-2)">Lo que se ve todos los días sin abrir nada. Hoy ninguno de los tres existe.</p>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:24px;flex:1">
    <div class="card" style="padding:20px;gap:14px">
      <p class="section-caps">Ícono de la app</p>
      <div style="display:flex;align-items:flex-end;gap:16px">
        <div style="width:96px;height:96px;border-radius:22px;background:var(--brand);display:grid;place-items:center"><img src="cabeza.png" alt="" style="width:78px;height:78px"></div>
        <div style="width:64px;height:64px;border-radius:15px;background:var(--brand);display:grid;place-items:center"><img src="cabeza.png" alt="" style="width:52px;height:52px"></div>
        <div style="width:48px;height:48px;border-radius:11px;background:var(--brand);display:grid;place-items:center"><img src="cabeza.png" alt="" style="width:39px;height:39px"></div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:16px">
        <div style="width:96px;height:96px;border-radius:22px;background:var(--ground);border:1px solid var(--rule);display:grid;place-items:center"><img src="cabeza.png" alt="" style="width:78px;height:78px"></div>
        <div style="width:64px;height:64px;border-radius:15px;background:var(--ground);border:1px solid var(--rule);display:grid;place-items:center"><img src="cabeza.png" alt="" style="width:52px;height:52px"></div>
        <div style="width:48px;height:48px;border-radius:11px;background:var(--ground);border:1px solid var(--rule);display:grid;place-items:center"><img src="cabeza.png" alt="" style="width:39px;height:39px"></div>
      </div>
      <p class="hint">Sobre celeste, la marca. Sobre asfalto, la variante para el modo noche del launcher.</p>
    </div>

    <div class="card" style="padding:20px;gap:14px">
      <p class="section-caps">Notificación del viaje</p>
      <div style="background:var(--surface-2);border:1px solid var(--rule);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <img src="cabeza-silueta.png" alt="" style="width:18px;height:18px">
          <span style="font-size:12px;color:var(--ink-3)">Navegador de Tránsito Pesado · ahora</span>
        </div>
        <b style="font-size:15px">Viaje en curso</b>
        <p style="font-size:13.5px;color:var(--ink-2)">12 min · 8,4 km al destino. Tocá para volver al mapa.</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:32px;height:32px;border-radius:8px;background:var(--surface-3);display:grid;place-items:center"><img src="cabeza-silueta.png" alt="" style="width:16px;height:16px"></div>
        <p class="hint">Ícono de estado, 16 px, monocromo: Android lo exige así. Es la silueta de la cabeza.</p>
      </div>
    </div>

    <div class="card" style="padding:20px;gap:14px">
      <p class="section-caps">Cabecera del mail</p>
      <div style="background:#ffffff;color:#0e161b;border-radius:14px;padding:18px 16px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <img src="cabeza.png" alt="" style="width:44px;height:44px">
          <b style="font-size:17px;letter-spacing:-0.02em">Confirmá tu correo</b>
        </div>
        <p style="font-size:13.5px;color:#465964;line-height:1.4">Hola, compañero. Tocá el botón y arrancamos.</p>
        <div style="display:inline-flex;align-self:flex-start;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:9px;background:#0e87b8;color:#fff;font-weight:700;font-size:14px">${ico.mail} Confirmar</div>
      </div>
      <p class="hint">El mail de verificación es el primer mono que ve un usuario nuevo. Hoy es texto plano.</p>
    </div>
  </div>
</div>`);

/* ===========================================================================
   Íconos y Globos — hojas
=========================================================================== */
ICO.viborita = (t) => ilu(F.serpiente, '#5b9cf2', '#2a5fb0', `<circle cx="7" cy="25" r="2.2" fill="#fff"/>`, t);
const tile = (nombre, svg) => `<div class="satin" style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 6px;border-radius:14px">${svg}<span class="section-caps" style="font-size:10px;letter-spacing:.08em;color:var(--ink-2)">${nombre}</span></div>`;
out['Iconos.dc.html'] = ff(`
<div style="width:900px;height:720px;padding:36px 44px;display:flex;flex-direction:column;gap:22px;background:var(--ground)">
  <div style="display:flex;flex-direction:column;gap:6px"><p class="section-caps">Íconos ilustrados <span class="chip chip-ok" style="margin-left:6px">Aprobado</span></p><h1 style="font-size:28px">El lenguaje del zócalo, en toda la app</h1><p style="font-size:15px;color:var(--ink-2)">Dos tonos, sombra corrida 2 px, detalle en blanco.</p></div>
  <div style="display:grid;grid-template-columns:repeat(7, minmax(0, 1fr));gap:12px">
    ${tile('GPS', `<svg viewBox="0 0 32 32" width="36" height="36" class="ico">${ICONOS.mapa}</svg>`)}${tile('Juegos', `<svg viewBox="0 0 32 32" width="36" height="36" class="ico">${ICONOS.juegos}</svg>`)}${tile('S.O.S.', `<svg viewBox="0 0 32 32" width="36" height="36" class="ico">${ICONOS.emergencia}</svg>`)}${tile('Más', `<svg viewBox="0 0 32 32" width="36" height="36" class="ico">${ICONOS.mas}</svg>`)}${tile('Perfil', ICO.persona(36))}${tile('Carnet', ICO.carnet(36))}${tile('Camiones', ICO.camion(36))}
    ${tile('Chat', ICO.chat(36))}${tile('Configuración', ICO.config(36))}${tile('Contacto', ICO.persona(36))}${tile('Llamar', ICO.telefono(36))}${tile('Historial', ICO.historial(36))}${tile('Viaje', ICO.viaje(36))}${tile('Kilómetros', ICO.km(36))}
    ${tile('Al volante', ICO.volante(36))}${tile('EXP', ICO.exp(36))}${tile('Logros', ICO.logros(36))}${tile('Nivel', ICO.nivel(36))}${tile('Modo día', ICO.dia(36))}${tile('Modo noche', ICO.noche(36))}${tile('Idioma', ICO.idioma(36))}
    ${tile('Fuentes', ICO.fuentes(36))}${tile('Salir', ICO.salir(36))}${tile('Trivia', ICO.trivia(36))}${tile('Viborita', ICO.viborita(36))}${tile('Ranking', ICO.ranking(36))}${tile('Agregar', ICO.agregar(36))}
  </div>
</div>`);

out['Globos.dc.html'] = ff(`
<div style="width:390px;height:900px;padding:24px 16px;display:flex;flex-direction:column;gap:16px;background:var(--ground)">
  <div style="display:flex;flex-direction:column;gap:6px"><p class="section-caps">Componente <span class="chip chip-ok" style="margin-left:6px">Aprobado</span></p><h1>El globo del mono</h1><p style="font-size:14px;color:var(--ink-2)">Vidrio con la chip del momento donde hay luz o más texto; pleno para una frase. Cola al costado junto al mono, o abajo cuando el mono está debajo.</p></div>
  <p class="section-caps" style="color:var(--accent-ink)">Vidrio · al costado</p>
  ${globoLado('mate', 'Un mate y salimos.', 'Doce días seguidos al volante.', chip('Racha', 'Día 12', 'chip-reward'))}
  ${globoLado('binoculares', 'Ojo con Av. Sáenz.', 'Gálibo de 3,9 m; tu camión mide 4,20.', chip('Antes de arrancar', 'Gálibo'))}
  <p class="section-caps" style="color:var(--accent-ink);margin-top:4px">Pleno · una frase</p>
  ${globoLado('rueda', 'Se arregla.', 'Probá de nuevo en un momento.', '', true)}
  ${globoLado('combustible', 'Sin camión no hay ruta.', 'Cargá el tuyo con sus medidas reales.', '', true)}
  <p class="section-caps" style="color:var(--accent-ink);margin-top:4px">Con el mono abajo</p>
  <div class="luz-brand" style="margin:0 -16px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:8px;position:relative"><div class="globo globo-abajo" style="max-width:260px">${chip('', 'Bienvenido', 'chip-accent')}<b>Hola, compañero.</b><p>Yo te acompaño. Vos manejás.</p></div>${monoGrande('mate', 120)}</div>
</div>`);

for (const [nombre, html] of Object.entries(out)) fs.writeFileSync(nombre, html);

/* ===========================================================================
   canvas.json — una sola página: la presentación
=========================================================================== */
const fila1 = ['Bienvenida', 'Idioma', 'Entrar', 'Mapa', 'Perfil', 'Racha', 'Metas', 'Logros'];
const fila2 = ['SubisteDeNivel', 'FinViaje', 'Historial', 'HistorialVacio', 'SinSenal', 'Camiones', 'Juegos', 'Emergencia', 'Configuracion'];
const titulos = { Bienvenida: 'Bienvenida', Idioma: 'Idioma', Entrar: 'Entrar', Mapa: 'Mapa · antes de arrancar', Perfil: 'Perfil', Racha: 'Racha', Metas: 'Metas', Logros: 'Logros', SubisteDeNivel: 'Subiste de nivel', FinViaje: 'Fin de viaje', Historial: 'Historial', HistorialVacio: 'Historial vacío', SinSenal: 'Sin señal', Camiones: 'Mis camiones', Juegos: 'Juegos', Emergencia: 'S.O.S.', Configuracion: 'Configuración' };
const canvas = {
  artboards: [
    { file: 'Main.dc.html', x: 0, y: 0, w: 1200, h: 800, title: 'El camino elegido' },
    { file: 'Iconos.dc.html', x: 1280, y: 0, w: 900, h: 720, title: 'Íconos ilustrados' },
    { file: 'Globos.dc.html', x: 2260, y: 0, w: 390, h: 900, title: 'Globos del mono' },
    { file: 'Sello.dc.html', x: 2730, y: 0, w: 900, h: 560, title: 'Sello — la marca' },
    ...fila1.map((n, i) => ({ file: `${n}.dc.html`, x: i * 470, y: 1020, w: 390, h: n === 'Perfil' ? 1240 : 844, title: titulos[n] })),
    ...fila2.map((n, i) => ({ file: `${n}.dc.html`, x: i * 470, y: 2420, w: 390, h: 844, title: titulos[n] }))
  ],
  annotations: [
    { id: 'entrada', x: 0, y: 940, w: 420, text: 'Entrada: Bienvenida → Idioma → (Condiciones) → Entrar. Condiciones es texto y un botón; no se boceta.' },
    { id: 'mapa-nota', x: 1410, y: 1900, w: 400, text: 'El mapa es la única pantalla sobria. El mono aparece en la hoja SÓLO antes de arrancar; en movimiento no hay mono, ni cromo, ni naranja.' },
    { id: 'perfil-nota', x: 1880, y: 2290, w: 400, text: 'Perfil sin la banda con trama: luz celeste, avatar (el editor llega en la Fase 6; acá un placeholder), la chapa de oro, fichas, el nivel en cromo frío, la tarjeta de completar con el mono, resumen, metas y logros. Scrollea.' },
    { id: 'festejo-nota', x: 470, y: 3300, w: 400, text: 'Fin de viaje y Subiste de nivel comparten la luz de festejo, el confeti y la chapa. Sólo el nivel lleva los rayos.' },
    { id: 'carnet-nota', x: 3170, y: 940, w: 420, text: 'El carnet no está en esta presentación: quedó congelado sin aprobar. Cuando se retome, entra con este mismo vocabulario.' }
  ],
  launch: { view: 'canvas' }
};
fs.writeFileSync('canvas.json', JSON.stringify(canvas, null, 2));
console.log(Object.keys(out).length + ' artboards de la presentación');
