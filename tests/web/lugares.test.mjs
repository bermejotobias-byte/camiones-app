/**
 * La capa de lugares (el prototipo, tableros "Capas" y "Lugar"): qué pin le
 * toca a cada lugar —verificado, de la comunidad, sin confirmar—, cómo viaja
 * al mapa y cómo se piden al servidor.
 *
 * Correr con:  node --test tests/web/
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  estadoDelPin, contadorDelPin, featuresDeLugares, pinSvg, categoriasParaPedir, calcomaniaDeCategoria,
  metrosEntre, fichaDeLugar, fichaLugar
} from '../../src/TruckNavigator.Api/wwwroot/js/mapa/lugares.js';

const sinVotos = { suitable: 0, notSuitable: 0, seal: 'NoVotesYet', forYourTruck: null, yourVote: null, contributed: null };

const lugar = (extra = {}) => ({
  id: 'a1', name: 'Gomería Los Amigos', category: 'TyreShop', latitude: -34.6, longitude: -58.4,
  verificationLevel: 'NotConfirmed', community: sinVotos, ...extra
});

/* ---------------------------------------------------------------------------
   El estado del pin
--------------------------------------------------------------------------- */

test('confirmado por la fuente, de la comunidad (aportado o con votos), o sin confirmar', () => {
  assert.equal(estadoDelPin(lugar({ verificationLevel: 'Confirmed' })), 'verificado');
  assert.equal(estadoDelPin(lugar({ community: { ...sinVotos, contributed: { at: '2026-09-12', byAlias: 'lauta' } } })), 'comunidad');
  assert.equal(estadoDelPin(lugar({ community: { ...sinVotos, suitable: 3, seal: 'Recommended' } })), 'comunidad');
  assert.equal(estadoDelPin(lugar()), 'sin');
  assert.equal(estadoDelPin(lugar({ verificationLevel: 'Probable' })), 'sin');
});

test('lo verificado sigue siendo verificado aunque la comunidad vote', () => {
  assert.equal(estadoDelPin(lugar({ verificationLevel: 'Confirmed', community: { ...sinVotos, suitable: 5 } })), 'verificado');
});

test('el contador es el total de votos, y sólo en los pines de la comunidad', () => {
  assert.equal(contadorDelPin(lugar({ community: { ...sinVotos, suitable: 2, notSuitable: 1, contributed: { at: '2026-09-12', byAlias: null } } })), 3);
  assert.equal(contadorDelPin(lugar({ community: { ...sinVotos, contributed: { at: '2026-09-12', byAlias: null } } })), null);
  assert.equal(contadorDelPin(lugar({ verificationLevel: 'Confirmed', community: { ...sinVotos, suitable: 5 } })), null);
  assert.equal(contadorDelPin(lugar()), null);
});

/* ---------------------------------------------------------------------------
   Al mapa
--------------------------------------------------------------------------- */

test('cada categoría del servidor tiene su calcomanía; una desconocida cae en el pin genérico', () => {
  assert.equal(calcomaniaDeCategoria('TyreShop'), 'gomeria');
  assert.equal(calcomaniaDeCategoria('TruckParking'), 'playa');
  assert.equal(calcomaniaDeCategoria('HeavyRoadsideAssistance'), 'auxilio');
  assert.equal(calcomaniaDeCategoria('Otra'), 'lugar');
});

test('los lugares viajan como GeoJSON: un punto por lugar con su icono y su contador', () => {
  const geojson = featuresDeLugares([
    lugar(),
    lugar({ id: 'b2', name: 'Taller El Tano', category: 'RepairShop', community: { ...sinVotos, suitable: 2, notSuitable: 1, contributed: { at: '2026-09-12', byAlias: 'lauta' } } })
  ]);

  assert.equal(geojson.type, 'FeatureCollection');
  assert.equal(geojson.features.length, 2);

  const [a, b] = geojson.features;
  assert.deepEqual(a.geometry, { type: 'Point', coordinates: [-58.4, -34.6] });
  assert.deepEqual(a.properties, { id: 'a1', nombre: 'Gomería Los Amigos', icono: 'pin-gomeria-sin', estado: 'sin', contador: '' });
  assert.deepEqual(b.properties, { id: 'b2', nombre: 'Taller El Tano', icono: 'pin-taller-comunidad', estado: 'comunidad', contador: '3' });
});

test('sin lugares, una colección vacía', () => {
  assert.deepEqual(featuresDeLugares([]), { type: 'FeatureCollection', features: [] });
  assert.deepEqual(featuresDeLugares(null), { type: 'FeatureCollection', features: [] });
});

test('el pin de 32: el anillo del estado y la calcomanía de la categoría adentro', () => {
  const verificado = pinSvg('gomeria', 'verificado');
  assert.ok(verificado.startsWith('<svg'));
  assert.ok(verificado.includes('stroke="#ffffff"'));
  assert.ok(verificado.includes('r="11.5"'), 'la calcomanía de la gomería');

  assert.ok(pinSvg('taller', 'comunidad').includes('stroke="#32ccfe"'));
  assert.ok(pinSvg('taller', 'sin').includes('stroke="#8b949e"'));
  assert.ok(pinSvg('inexistente', 'sin').includes('stroke="#8b949e"'), 'sin calcomanía sigue habiendo pin');
});

/* ---------------------------------------------------------------------------
   Al servidor
--------------------------------------------------------------------------- */

test('las categorías se piden con el nombre del servidor, en el orden de los chips', () => {
  assert.equal(categoriasParaPedir(['playa', 'gomeria']), 'TyreShop,TruckParking');
  assert.equal(categoriasParaPedir(['gomeria', 'inventada']), 'TyreShop');
  assert.equal(categoriasParaPedir([]), '');
});

/* ---------------------------------------------------------------------------
   La ficha (el prototipo, tableros "Lugar verificado" y "Lugar de la comunidad")
--------------------------------------------------------------------------- */

const camion = { id: 'c1', name: 'El Rayo', vehicleType: 'SemiTrailer', grossWeightKg: 40_000 };
const obelisco = { lat: -34.6037, lng: -58.3816 };

test('la distancia entre dos puntos, en metros', () => {
  // Del Obelisco a Plaza de Mayo hay poco mas de un kilometro.
  const m = metrosEntre(obelisco, { lat: -34.6083, lng: -58.3712 });
  assert.ok(m > 1000 && m < 1200, String(m));
  assert.equal(metrosEntre(obelisco, obelisco), 0);
});

test('un lugar verificado: la cabecera, el bloque verde con la evidencia y su fecha, la comunidad y el voto propio', () => {
  const ficha = fichaDeLugar(lugar({
    name: 'Gomería Los Amigos', address: 'Av. Vélez Sarsfield 1310',
    verificationLevel: 'Confirmed', suitabilityEvidenceKind: 'Operator', sourceRetrievedOn: '2026-09-15',
    suitableForLightTruck: true, suitableForHeavyTruck: true, suitableForSemiTrailer: true, suitableForTrailer: true,
    suitableForSelectedTruck: true, phone: '11 4444-5555',
    latitude: -34.6083, longitude: -58.3712,
    community: { suitable: 5, notSuitable: 0, seal: 'Recommended', forYourTruck: { truckClass: 'SemiTrailer', suitable: 3, notSuitable: 0, seal: 'Recommended' }, yourVote: 'Suitable', contributed: null }
  }), { camion, desde: obelisco });

  assert.equal(ficha.calcomania, 'gomeria');
  assert.equal(ficha.nombre, 'Gomería Los Amigos');
  assert.equal(ficha.sub, 'Gomería · a 1,1 km · Av. Vélez Sarsfield 1310');
  assert.equal(ficha.aportado, null);
  assert.deepEqual(ficha.verificado, { nivel: 'confirmado', titulo: 'Verificado · recibe todo tipo de camión', sub: 'Lo declara el comercio · 15/09/2026' });
  assert.deepEqual(ficha.comunidad, { titulo: '3 camioneros con un camión como el tuyo lo recomiendan', sub: '5 en total · nadie lo desaconseja' });
  assert.equal(ficha.voto, 'Suitable');
  assert.equal(ficha.telefono, '11 4444-5555');
  assert.equal(ficha.pregunta, '¿Es apto para El Rayo?');
});

test('lo que recibe se dice por tipo, y la evidencia por su clase', () => {
  const base = { verificationLevel: 'Confirmed', sourceRetrievedOn: '2026-09-01', suitableForSelectedTruck: true };

  const resenas = fichaDeLugar(lugar({ ...base, suitabilityEvidenceKind: 'Reviews', suitableForSemiTrailer: true, suitableForTrailer: true }), { camion });
  assert.equal(resenas.verificado.titulo, 'Verificado · recibe semis y acoplados');
  assert.equal(resenas.verificado.sub, 'Lo cuentan conductores en reseñas · 01/09/2026');

  const oficial = fichaDeLugar(lugar({ ...base, suitabilityEvidenceKind: 'Official', suitableForHeavyTruck: true }), { camion });
  assert.equal(oficial.verificado.titulo, 'Verificado · recibe camiones pesados');
  assert.equal(oficial.verificado.sub, 'Lo dice una fuente oficial · 01/09/2026');

  const dos = fichaDeLugar(lugar({ ...base, suitabilityEvidenceKind: 'Official', suitableForLightTruck: true, suitableForHeavyTruck: true }), { camion });
  assert.equal(dos.verificado.titulo, 'Verificado · recibe camiones livianos y pesados');
  const tres = fichaDeLugar(lugar({ ...base, suitabilityEvidenceKind: 'Official', suitableForHeavyTruck: true, suitableForSemiTrailer: true, suitableForTrailer: true }), { camion });
  assert.equal(tres.verificado.titulo, 'Verificado · recibe camiones pesados, semis y acoplados');
});

test('verificado pero NO apto para tu camión se dice en rojo, con lo que sí recibe', () => {
  const ficha = fichaDeLugar(lugar({
    verificationLevel: 'Confirmed', suitabilityEvidenceKind: 'Operator', sourceRetrievedOn: '2026-09-15',
    suitableForLightTruck: true, suitableForSemiTrailer: false, suitableForSelectedTruck: false
  }), { camion });

  assert.equal(ficha.verificado.nivel, 'no-apto');
  assert.equal(ficha.verificado.titulo, 'Verificado · no recibe tu camión');
  assert.equal(ficha.verificado.sub, 'Recibe camiones livianos · lo declara el comercio · 15/09/2026');
});

test('un lugar probable lleva su bloque, en gris, y dice de dónde salen las señales', () => {
  const ficha = fichaDeLugar(lugar({ verificationLevel: 'Probable', suitabilityEvidenceKind: 'Signals', sourceRetrievedOn: '2026-09-15' }), { camion });

  assert.deepEqual(ficha.verificado, { nivel: 'probable', titulo: 'Probable · hay señales de que recibe camiones', sub: 'Por el nombre, una etiqueta o fotos; nadie lo confirmó · 15/09/2026' });
});

test('un lugar de la comunidad: la etiqueta de quién lo aportó, sin bloque verde, y "sin verificar"', () => {
  const ficha = fichaDeLugar(lugar({
    name: 'Taller El Tano', category: 'RepairShop', address: 'Traful 3400',
    community: { suitable: 3, notSuitable: 0, seal: 'Recommended', forYourTruck: { truckClass: 'SemiTrailer', suitable: 1, notSuitable: 0, seal: 'NoVotesYet' }, yourVote: null, contributed: { at: '2026-09-12', byAlias: 'lauta' } }
  }), { camion });

  assert.equal(ficha.sub, 'Taller · Traful 3400');
  assert.equal(ficha.aportado, 'Aportado por la comunidad · @lauta · 12/09/2026');
  assert.equal(ficha.verificado, null);
  assert.deepEqual(ficha.comunidad, { titulo: '1 camionero con un camión como el tuyo lo recomienda', sub: '3 en total · sin verificar: nadie confirmó el dato todavía' });
  assert.equal(ficha.voto, null);
  assert.equal(ficha.telefono, null);
});

test('sin votos se invita a ser el primero; con votos en contra se dice cuántos', () => {
  assert.deepEqual(fichaDeLugar(lugar(), { camion }).comunidad, { titulo: 'Nadie votó todavía', sub: 'Sé el primero: ¿es apto para tu camión?' });

  const discutido = fichaDeLugar(lugar({
    community: { suitable: 2, notSuitable: 3, seal: 'Disputed', forYourTruck: { truckClass: 'SemiTrailer', suitable: 0, notSuitable: 2, seal: 'NoVotesYet' }, yourVote: 'NotSuitable', contributed: null }
  }), { camion });
  assert.equal(discutido.comunidad.titulo, '2 camioneros con un camión como el tuyo lo desaconsejan');
  assert.equal(discutido.comunidad.sub, '5 en total · 3 lo desaconsejan · sin verificar');

  const otros = fichaDeLugar(lugar({
    community: { suitable: 2, notSuitable: 0, seal: 'NoVotesYet', forYourTruck: { truckClass: 'SemiTrailer', suitable: 0, notSuitable: 0, seal: 'NoVotesYet' }, yourVote: null, contributed: null }
  }), { camion });
  assert.equal(otros.comunidad.titulo, 'Nadie con un camión como el tuyo votó todavía');
});

test('sin camión elegido la comunidad se cuenta entre todos y la pregunta es genérica', () => {
  const ficha = fichaDeLugar(lugar({ community: { suitable: 4, notSuitable: 1, seal: 'Recommended', forYourTruck: null, yourVote: null, contributed: null } }), {});

  assert.equal(ficha.comunidad.titulo, '4 camioneros lo recomiendan');
  assert.equal(ficha.pregunta, '¿Es apto para tu camión?');
  assert.equal(ficha.sub, 'Gomería');
});

test('la ficha dibujada: cerrar, los dos votos (el propio en celeste), Llamar sólo con teléfono, e Ir', () => {
  const con = fichaLugar(fichaDeLugar(lugar({ phone: '11 4444-5555', community: { ...sinVotos, yourVote: 'Suitable' } }), { camion }));

  assert.ok(con.includes('data-accion="cerrar"'));
  assert.ok(con.includes('data-accion="votar" data-veredicto="Suitable"'));
  assert.ok(con.includes('data-accion="votar" data-veredicto="NotSuitable"'));
  assert.ok(con.includes('data-accion="llamar"'));
  assert.ok(con.includes('data-accion="ir"'));

  const apto = con.match(/<button[^>]*data-veredicto="Suitable"[^>]*>/)[0];
  const noApto = con.match(/<button[^>]*data-veredicto="NotSuitable"[^>]*>/)[0];
  assert.ok(apto.includes('celeste'));
  assert.ok(!noApto.includes('celeste'));

  const sin = fichaLugar(fichaDeLugar(lugar(), { camion }));
  assert.ok(!sin.includes('data-accion="llamar"'));
});

test('lo que viene del servidor se escapa en la ficha', () => {
  const html = fichaLugar(fichaDeLugar(lugar({ name: 'Gomería <b>x</b>' }), { camion }));
  assert.ok(!html.includes('<b>x</b>'));
});
