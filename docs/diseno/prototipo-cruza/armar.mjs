// Arma el prototipo de CRUZÁ, MONO en un solo HTML (unos 520 KB, no se versiona).
// Uso: node docs/diseno/prototipo-cruza/armar.mjs salida.html
import { readFileSync, writeFileSync } from 'node:fs';
const aqui = new URL('./', import.meta.url);
const leer = (n) => readFileSync(new URL(n, aqui), 'utf8');
const mascota = new URL('../../../src/TruckNavigator.Api/wwwroot/img/mascota/', aqui);
const b64 = (n) => 'data:image/png;base64,' + readFileSync(new URL(n + '.png', mascota)).toString('base64');
const js = leer('sprites.js') + '\n' + leer('escena.js');
new Function(js);
let s = leer('pagina.html').replace('/*ESTILO*/', leer('estilo.css')) + '\n<script>' + js + '</script>\n';
s = s.replaceAll('__JOYSTICK__', b64('joystick')).replaceAll('__RUEDA__', b64('rueda')).replaceAll('__FESTEJO__', b64('festejo'));
writeFileSync(process.argv[2] ?? 'cruza-mono.html', s);
console.log('escrito', (s.length / 1024).toFixed(0) + ' KB');
