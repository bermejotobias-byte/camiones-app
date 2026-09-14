import fs from 'node:fs';
export const BASE = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
:root{--ground:#0d1418;--surface:#151f26;--surface-2:#1e2b33;--surface-3:#27373f;--ink:#eaf1f5;--ink-2:#a8bcc7;--ink-3:#6f8794;--rule:#24333c;--brand:#35b8e8;--brand-ink:#8fdcf7;--brand-soft:#0f2f3f;--on-brand:#04222f;--reward:#a97bf0;--reward-soft:#241a3a;--cool-1:#35b8e8;--cool-2:#5b9cf2;--cool-3:#8a86f2;--cool-4:#a97bf0;--accent:#f5843a;--accent-ink:#ffb078;--accent-soft:#3a2010;--accent-deep:#a8501c;--on-accent:#2b1405;--ok:#43c98b;--danger:#f0736a;--warn:#e8b13c;--ui:'Nunito',-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--ink);font-family:var(--ui);font-size:16px;line-height:1.45;-webkit-font-smoothing:antialiased}
a{color:var(--brand-ink)} a:hover{color:var(--brand)}
h1,h2,h3{margin:0;line-height:1.2;letter-spacing:-0.02em} h1{font-size:26px;font-weight:800} h2{font-size:20px;font-weight:700} h3{font-size:16px;font-weight:700} p{margin:0}
.phone{width:390px;height:844px;display:flex;flex-direction:column;background:var(--ground);overflow:hidden;position:relative}
.topbar{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border-bottom:1px solid var(--rule);flex:none}
.topbar h2{flex:1;min-width:0}
.fab{width:48px;height:48px;border-radius:50%;border:1px solid var(--rule);background:var(--surface);color:var(--ink);display:grid;place-items:center;box-shadow:0 2px 6px rgba(0,0,0,.35),0 12px 32px -14px rgba(0,0,0,.7);flex:none}
.fab-panic{background:var(--danger);color:#fff;border-color:transparent;font-weight:800;font-size:13px;letter-spacing:.04em}
.scroll{flex:1;min-height:0;padding:16px 16px 24px;display:flex;flex-direction:column;gap:16px}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px}
.btn{min-height:48px;padding:0 18px;border:1px solid transparent;border-radius:9px;background:var(--surface-2);color:var(--ink);font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:inherit;font-size:16px;line-height:1}
.btn-primary{background:var(--brand);color:var(--on-brand);font-weight:700}
.btn-accent{background:var(--accent);color:var(--on-accent);font-weight:800;letter-spacing:.01em;border-bottom:4px solid var(--accent-deep)}
.btn-duo{text-transform:uppercase;font-weight:800;letter-spacing:.06em;font-size:14px;min-height:52px;border-radius:14px}
.btn-outline{background:transparent;border:2px solid var(--rule);color:var(--ink-2)}
.btn-block{width:100%}
.section-caps{font-size:12px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;color:var(--ink-3)}
.pill{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.pill-brand{background:var(--brand-soft);color:var(--brand-ink)} .pill-reward{background:var(--reward-soft);color:var(--reward)}
.muted{color:var(--ink-3);font-size:13.5px} .hint{font-size:13px;color:var(--ink-3);line-height:1.4}
.row{display:flex;align-items:center;gap:12px} .grow{flex:1;min-width:0}
.dock-bar{height:64px;padding:0 6px;background:var(--ground);border-top:1px solid var(--rule);display:flex;align-items:center;justify-content:space-around;flex:none}
.dock-item{width:52px;height:52px;border-radius:14px;border:2.5px solid transparent;display:grid;place-items:center}
.dock-item.is-active{border-color:rgba(53,184,232,.55);background:var(--brand-soft)}
.dock-item svg{display:block;filter:drop-shadow(0 1px 0 rgba(0,0,0,.25))}
.mono{display:block;object-fit:contain}
.mono-protagonista{width:200px;height:200px;margin:0 auto}
.mono-acompanante{width:96px;height:96px;flex:none}
.mono-globo{display:flex;align-items:flex-end;gap:10px}
.globo{position:relative;flex:1;min-width:0;background:var(--surface-2);border:1px solid var(--rule);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.globo::before,.globo::after{content:"";position:absolute;left:-9px;bottom:22px;border:8px solid transparent;border-right-color:var(--rule);border-left:0}
.globo::after{left:-7px;border-right-color:var(--surface-2)}
.globo b{font-size:17px;font-weight:800;line-height:1.25}
.globo p{font-size:13.5px;color:var(--ink-2);line-height:1.4}
.globo-arriba{align-self:center;max-width:280px;text-align:center}
.globo-arriba::before,.globo-arriba::after{left:50%;bottom:-9px;margin-left:-8px;border:8px solid transparent;border-top-color:var(--rule);border-bottom:0}
.globo-arriba::after{bottom:-7px;border-top-color:var(--surface-2)}
`;

/* ---- dibujos ------------------------------------------------------------- */
export const ICONOS = {
  mapa: `<path d="M16 5 L26 27 L16 22 L6 27 Z" fill="#1a6f9a" transform="translate(0 2)"/><path d="M16 5 L26 27 L16 22 L6 27 Z" fill="#35b8e8"/><path d="M16 5 L26 27 L16 22 Z" fill="#8fdcf7" opacity=".55"/>`,
  juegos: `<path d="M9 10h14a6 6 0 0 1 6 6l-1 7a3.5 3.5 0 0 1-6 2l-2-3h-8l-2 3a3.5 3.5 0 0 1-6-2l-1-7a6 6 0 0 1 6-6z" fill="#6d46c4" transform="translate(0 2)"/><path d="M9 10h14a6 6 0 0 1 6 6l-1 7a3.5 3.5 0 0 1-6 2l-2-3h-8l-2 3a3.5 3.5 0 0 1-6-2l-1-7a6 6 0 0 1 6-6z" fill="#a97bf0"/><path d="M10.5 14v6M7.5 17h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><circle cx="22" cy="15.5" r="1.6" fill="#fff"/><circle cx="25" cy="18.5" r="1.6" fill="#fff"/>`,
  emergencia: `<circle cx="16" cy="18" r="11" fill="#b6362b"/><circle cx="16" cy="16" r="11" fill="#f0736a"/><circle cx="16" cy="16" r="5" fill="#fff"/><path d="M16 5v6M16 21v6M5 16h6M21 16h6" stroke="#fff" stroke-width="3.2"/><circle cx="16" cy="16" r="4" fill="#f0736a" opacity=".35"/>`,
  mas: `<circle cx="16" cy="18" r="12" fill="#3f3aa0"/><circle cx="16" cy="16" r="12" fill="#6b64d9"/><circle cx="10" cy="16" r="2.1" fill="#fff"/><circle cx="16" cy="16" r="2.1" fill="#fff"/><circle cx="22" cy="16" r="2.1" fill="#fff"/>`
};
export const dock = (activo) => `
<div class="dock-bar">
  ${['mapa', 'juegos', 'emergencia', 'mas'].map((id) => `<div class="dock-item ${id === activo ? 'is-active' : ''}"><svg viewBox="0 0 32 32" width="30" height="30">${ICONOS[id]}</svg></div>`).join('\n  ')}
</div>`;

export const ico = {
  atras: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  cerrar: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  mas: `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  camion: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/></svg>`,
  check: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 8l9 6 9-6"/></svg>`
};

/* ---- piezas ---------------------------------------------------------------- */
export const globo = (pose, titulo, texto) => `
<div class="mono-globo">
  <img class="mono mono-acompanante" src="${pose}.png" alt="">
  <div class="globo"><b>${titulo}</b><p>${texto}</p></div>
</div>`;

export const MAPA = (conRuta) => `
<div style="position:relative;flex:1;min-height:0;overflow:hidden;background-color:#0d1418;background-image:repeating-linear-gradient(0deg,transparent 0 40px,#18232a 40px 42px),repeating-linear-gradient(90deg,transparent 0 48px,#18232a 48px 50px)">
  <svg viewBox="0 0 390 560" width="390" height="560" style="position:absolute;inset:0" fill="none">
    <path d="M-10 120 L400 60" stroke="#24333c" stroke-width="7"/>
    <path d="M60 -10 L120 570" stroke="#24333c" stroke-width="7"/>
    <path d="M-10 380 L400 300" stroke="#24333c" stroke-width="7"/>
    <path d="M300 -10 L250 570" stroke="#24333c" stroke-width="7"/>
    ${conRuta ? `
    <path d="M78 470 L104 356 L262 332 L286 190 L312 96" stroke="#04222f" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M78 470 L104 356 L262 332 L286 190 L312 96" stroke="#35b8e8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="78" cy="470" r="8" fill="#43c98b" stroke="#0d1418" stroke-width="3"/>
    <circle cx="312" cy="96" r="8" fill="#f0736a" stroke="#0d1418" stroke-width="3"/>` : `
    <circle cx="78" cy="470" r="8" fill="#43c98b" stroke="#0d1418" stroke-width="3"/>`}
  </svg>
  <div style="position:absolute;left:12px;top:12px" class="fab">${ico.menu}</div>
  <div style="position:absolute;right:12px;top:12px" class="fab fab-panic">SOS</div>
</div>`;

export const SHEET = (adentro) => `
<div style="flex:none;background:var(--surface);border-radius:14px 14px 0 0;padding:10px 16px 16px;box-shadow:0 -4px 24px -8px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:12px">
  <div style="width:44px;height:4px;border-radius:2px;background:var(--rule);margin:0 auto 2px"></div>
  ${adentro}
</div>`;

export const file = (body, extra = '') => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>${BASE}${extra}</style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;

