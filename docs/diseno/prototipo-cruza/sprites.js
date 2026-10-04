
'use strict';
// ================================================================ la fuente 5 x 7 de la Viborita
const F = {
  0:['.###.','#...#','#..##','#.#.#','##..#','#...#','.###.'],1:['..#..','.##..','..#..','..#..','..#..','..#..','.###.'],
  2:['.###.','#...#','....#','...#.','..#..','.#...','#####'],3:['#####','...#.','..#..','...#.','....#','#...#','.###.'],
  4:['...#.','..##.','.#.#.','#..#.','#####','...#.','...#.'],5:['#####','#....','####.','....#','....#','#...#','.###.'],
  6:['..##.','.#...','#....','####.','#...#','#...#','.###.'],7:['#####','....#','...#.','..#..','.#...','.#...','.#...'],
  8:['.###.','#...#','#...#','.###.','#...#','#...#','.###.'],9:['.###.','#...#','#...#','.####','....#','...#.','.##..'],
  A:['.###.','#...#','#...#','#####','#...#','#...#','#...#'],B:['####.','#...#','#...#','####.','#...#','#...#','####.'],
  C:['.###.','#...#','#....','#....','#....','#...#','.###.'],D:['####.','#...#','#...#','#...#','#...#','#...#','####.'],
  E:['#####','#....','#....','####.','#....','#....','#####'],F:['#####','#....','#....','####.','#....','#....','#....'],
  G:['.###.','#...#','#....','#.###','#...#','#...#','.####'],H:['#...#','#...#','#...#','#####','#...#','#...#','#...#'],
  I:['.###.','..#..','..#..','..#..','..#..','..#..','.###.'],J:['..###','...#.','...#.','...#.','...#.','#..#.','.##..'],
  K:['#...#','#..#.','#.#..','##...','#.#..','#..#.','#...#'],L:['#....','#....','#....','#....','#....','#....','#####'],
  M:['#...#','##.##','#.#.#','#.#.#','#...#','#...#','#...#'],N:['#...#','##..#','#.#.#','#..##','#...#','#...#','#...#'],
  O:['.###.','#...#','#...#','#...#','#...#','#...#','.###.'],P:['####.','#...#','#...#','####.','#....','#....','#....'],
  Q:['.###.','#...#','#...#','#...#','#.#.#','#..#.','.##.#'],R:['####.','#...#','#...#','####.','#.#..','#..#.','#...#'],
  S:['.####','#....','#....','.###.','....#','....#','####.'],T:['#####','..#..','..#..','..#..','..#..','..#..','..#..'],
  U:['#...#','#...#','#...#','#...#','#...#','#...#','.###.'],V:['#...#','#...#','#...#','#...#','#...#','.#.#.','..#..'],
  W:['#...#','#...#','#...#','#.#.#','#.#.#','#.#.#','.#.#.'],X:['#...#','#...#','.#.#.','..#..','.#.#.','#...#','#...#'],
  Y:['#...#','#...#','.#.#.','..#..','..#..','..#..','..#..'],Z:['#####','....#','...#.','..#..','.#...','#....','#####'],
  'Á':['...#.','.###.','#...#','#...#','#####','#...#','#...#'],'É':['...#.','#####','#....','####.','#....','#....','#####'],
  'Í':['...#.','.###.','..#..','..#..','..#..','..#..','.###.'],'Ó':['...#.','.###.','#...#','#...#','#...#','#...#','.###.'],
  'Ú':['...#.','#...#','#...#','#...#','#...#','#...#','.###.'],
  '!':['..#..','..#..','..#..','..#..','..#..','.....','..#..'],'¡':['..#..','.....','..#..','..#..','..#..','..#..','..#..'],
  ':':['.....','..#..','.....','.....','.....','..#..','.....'],'.':['.....','.....','.....','.....','.....','.....','..#..'],
  '<':['...#.','..#..','.#...','#....','.#...','..#..','...#.'],' ':['.....','.....','.....','.....','.....','.....','.....'],
  '-':['.....','.....','.....','#####','.....','.....','.....'],
  '+':['.....','..#..','..#..','#####','..#..','..#..','.....'],
  ',':['.....','.....','.....','.....','.....','..#..','.#...']
};
const ancho = (s, k = 1) => ([...s].length * 6 - 1) * k;
function texto(c, s, x, y, color, k = 1) {
  let cx = x;
  for (const ch of s) {
    (F[ch] || F[' ']).forEach((fila, j) => {
      c.fillStyle = Array.isArray(color) ? color[j] : color;
      [...fila].forEach((p, i) => { if (p === '#') c.fillRect(cx + i * k, y + j * k, k, k); });
    });
    cx += 6 * k;
  }
}
const centro = (c, s, y, color, W, k = 1) => texto(c, s, Math.floor((W - ancho(s, k)) / 2), y, color, k);
const CROMO7 = ['#ffffff', '#d4f3ff', '#8fdcf7', '#35b8e8', '#2697c4', '#1f86ad', '#8fdcf7'];

// ================================================================ sprites por grilla
const PAL = {
  K:'#2a1206', R:'#ff3b30', r:'#c41a22', q:'#ff8f85', W:'#ffffff', w:'#c9d3e0',
  B:'#9a5526', b:'#66310f', n:'#c47c45', F:'#f7c793', f:'#d6935a', m:'#7a2412', E:'#120804', e:'#ffffff',
  G:'#35c75a', g:'#1f8a3c', h:'#0f5c26', O:'#2f6bff', o:'#1c44b0', u:'#7aa2ff', Y:'#ffd21f',
  T:'#f2bd78', C:'#35b8e8', c:'#d48a3a', s:'#9a5a22'
};
const GRIS = Object.fromEntries(Object.keys(PAL).map((k) => [k, '#2b313b']));
const sim = (filas) => filas.map((f) => f + [...f].reverse().join(''));
const MONO_ATRAS = sim([
  '........KKKK','......KKqqRR','.....KqqRRRR','....KqRRRRRR','....KRRRRRRR','....KRRRRRRR','....KrRRRRRK','....KrrrrrKW',
  '....KKKKKKKK','..KKKbBBnBBB','.KbBKbBBBBBB','.KbbKbBBBBBB','..KKKbBBBBBB','....KbbBBBBB','.....Kbbbbbb','...KKgGGOOGG',
  '..KbKgGhOOGh','.KbBKgGGOOGG','.KbBKoOOOOOO','.KnBKoOOuOOO','..KKKoOOOOOO','....KoOOOOoK','....KfFFfK..','.....KKKK...']);
const MONO_FRENTE = sim([
  '........KKKK','......KKqqRR','.....KqqRRRR','....KqRRWWWW','....KRRRWWWW','....KrRRRRRR','..KKrrrrrrrr','.KbKKKKKKKKK',
  'KbnBKfFFFFFF','KbFfKFFeEFFF','KbFfKFFEEFFF','.KbbKFFFFFFF','..KKfFFFmFFF','...KffFFFmmm','....KffFFFFF','...KKgGGOOGG',
  '..KbKgGhOOGh','.KbBKgGOOOOO','.KbBKgOOYOOO','.KfFKoOOOuOO','..KKKoOOOOOO','....KoOOOOoK','....KfFFfK..','.....KKKK...']);
const MONO_PARPADEO = MONO_FRENTE.map((f, j) => (j === 9 ? f.replace(/eE/g, 'FF').replace(/Ee/g, 'FF') : j === 10 ? f.replace(/EE/g, 'KK') : f));
const MONO_LADO = [
  '........KKKKKK..........','......KKqqRRRRK.........','.....KqRRRRRRRRK........','....KqRRRRRRWWRRK.......',
  '....KRRRRRRRWWRRRKK.....','....KrRRRRRRRRRRrrrrK...','....KrrrrrrrrrrrrrrrrK..','...KbKKKKKKKKKKKKKKKK...',
  '..KbnBBBBBKfFFFFK.......','.KbFfKBBBBKFFFeEFK......','.KbFfKBBBBKFFFEEFFK.....','..KbbKBBBBKfFFFFFFFK....',
  '...KKBBBBBKffFFFmFFK....','....KbBBBBBKffmmmFK.....','.....KbbbbbbKKKKKK......','.....KgGGOOGGGK.........',
  '..KbKKgGhOOGGBK.........','.KbK.KgGOOOOBFK.........','.KbK.KoOOOYOOK..........','..KbKKoOOOuOOK..........',
  '...KKKoOOOOOOK..........','.....KoOOKoOOK..........','.....KfFFKfFFFK.........','......KKK.KKKK..........'];
const MONO_GOLPE = [
  '........................','........................','........................','........................',
  '........................','........................','........................','........................',
  '........................','........................','........................','........................',
  '........................','........................','........................','......KKKKKKKKKKKK......',
  '.....KqRRRWWWWRRRrK.....','....KKKKKKKKKKKKKKKK....','...KbKFFeEFFFFEeFFKbK...','...KbKFFFFFmmFFFFFKbK...',
  '..KgGGOOOOYOOYOOOOGGgK..','.KfFKoOOOOOOOOOOOOoKFfK.','..KKK.KKKKKKKKKKKK.KKK..','........................'];
const GORRA = ['..KKKKKK..','.KqRRWWRK.','KrrrrrrrrK','.KKKKKKKK.'];
const CABEZA = ['...KKKKKK...','..KqRRRRRK..','.KqRRWWRRRK.','.KRRRWWRRRK.','KKrrrrrrrrKK','KbKFFFFFFKbK',
  'KfKFEFFEFKfK','.KKFFFFFFKK.','..KFfmmfFK..','...KFFFFK...','....KKKK....','............'];
const CABEZA_GUIÑO = CABEZA.map((f, j) => (j === 6 ? 'KfKFKFFKFKfK' : f));
const CAJA = ['..KKKKKKKKKKKK..','.KTTTTTCCTTTTTK.','KTTTTTTCCTTTTTTK','KTTTTTTCCTTTTTTK','KKKKKKKCCKKKKKKK',
  'KccccccCCccccccK','KccccccCCccccccK','KcWWWccCCccccccK','KcWWWccCCccccccK','KccccccCCccccccK','KccccccCCcccccsK',
  'KsccccsCCsccccsK','KssssssCCssssssK','.KKKKKKKKKKKKKK.'];

const cache = new Map();
function hoja(filas, pal = PAL) {
  const clave = filas.join('|') + (pal === GRIS ? 'g' : '');
  if (cache.has(clave)) return cache.get(clave);
  const cv = document.createElement('canvas'); cv.width = filas[0].length; cv.height = filas.length;
  const c = cv.getContext('2d');
  filas.forEach((f, j) => [...f].forEach((p, i) => { if (p !== '.' && pal[p]) { c.fillStyle = pal[p]; c.fillRect(i, j, 1, 1); } }));
  cache.set(clave, cv); return cv;
}
function pegar(c, filas, x, y, { pal = PAL, voltear = false, k = 1, alto } = {}) {
  const im = hoja(filas, pal), w = im.width * k, h = (alto ?? im.height) * k;
  c.save();
  if (voltear) { c.translate(Math.round(x) + w, Math.round(y)); c.scale(-1, 1); c.drawImage(im, 0, 0, w, h); }
  else c.drawImage(im, Math.round(x), Math.round(y) + (im.height * k - h), w, h);
  c.restore();
}

