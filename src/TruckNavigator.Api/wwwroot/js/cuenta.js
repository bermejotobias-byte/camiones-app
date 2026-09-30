/**
 * "Necesito saber quien sos": lo que ve un invitado al tocar algo que pide
 * cuenta.
 *
 * Es UNA hoja con el motivo como parametro, y no un cartel generico: decirle
 * "necesitas una cuenta" cinco veces seguidas le enseña a ignorar el cartel, y
 * la sexta —la que importaba— tampoco la lee.
 *
 * Ninguna accion bloqueada devuelve un 401 ni un error: el mono lo dice ANTES.
 * Un 401 es la app fallando; esto es la app explicando.
 */

import { askChoice } from './ui.js';

export const MOTIVOS = {
  reportar: {
    titulo: 'Para reportar necesito saber quién sos',
    texto: 'Tu reporte lleva tu alias y suma EXP, y para eso hace falta una cuenta.'
  },

  votar: {
    titulo: 'Confirmar un reporte pide tu cuenta',
    texto: 'Decir si algo sigue ahí mueve la confiabilidad de lo que reportó otro, así que no puede ser anónimo.'
  },

  lugar: {
    titulo: 'Guardar Casa y Depósito pide cuenta',
    texto: 'Tus lugares viven en el servidor para que sigan ahí cuando cambies de teléfono.'
  },

  contacto: {
    titulo: 'Los contactos de emergencia van en tu cuenta',
    texto: 'Un contacto de emergencia que se pierde al reinstalar es un contacto que no está el día que hace falta.'
  },

  perfil: {
    titulo: 'Tu perfil arranca con la cuenta',
    texto: 'Ahí viven tu nivel, tus viajes y tus camiones.'
  },

  juegos: {
    titulo: 'Los juegos van con tu cuenta',
    texto: 'Lo que ganes ahí suma EXP y empuja tu nivel, así que necesita saber de quién es.'
  },

  vencido: {
    titulo: 'Se terminó tu día de prueba',
    texto: 'Creá tu cuenta y seguí manejando conmigo: desde ahí los kilómetros empiezan a sumar.',
    soloCuenta: true
  }
};

/** El texto de un motivo. Uno que no existe cae en el del perfil, no en nada. */
export function textoDeCuenta(motivo) {
  const elegido = MOTIVOS[motivo] ?? MOTIVOS.perfil;

  return { soloCuenta: false, ...elegido };
}

/**
 * Muestra la hoja y resuelve si hay que ir a crear la cuenta.
 *
 * Se apoya en askChoice y no en confirm(): adentro del WebView de Android los
 * dialogos del navegador NO se dibujan y el boton parece no responder (AD-28).
 */
export async function hojaDeCuenta(motivo) {
  const dice = textoDeCuenta(motivo);

  const opciones = [{ id: 'crear', label: 'Crear mi cuenta', kind: 'primary' }];

  if (!dice.soloCuenta) {
    opciones.push({ id: 'luego', label: 'Ahora no' });
  }

  const elegido = await askChoice({ title: dice.titulo, message: dice.texto, options: opciones });

  return elegido === 'crear';
}
