/**
 * La camara del viaje: cuando un gesto la suelta.
 *
 * Durante el viaje la camara sigue al camion y gira sola con el rumbo. Si el
 * usuario arrastra, pellizca o GIRA el mapa con dos dedos, esta mirando otra
 * cosa: la camara deja de seguir hasta que toque "Volver a centrar", que
 * devuelve la posicion y el rumbo automatico juntos (AD-52, como Google Maps).
 *
 * Tres orientaciones distintas, que no hay que confundir:
 *   inicial     la camara se inclina al tocar Arrancar y toma el rumbo con la
 *               primera posicion (enterNavigationMode);
 *   automatica  mientras sigue al camion, gira sola segun hacia donde va
 *               (followVehicle);
 *   manual      la del usuario con dos dedos, que suspende la automatica.
 *
 * Fuera del viaje el mapa no gira por ningun gesto (AD-34): la rotacion se
 * prende al entrar al viaje y se apaga al salir, en map.js.
 */

/** Los eventos de MapLibre que, si los provoca el usuario, sueltan la camara. */
export const GESTOS_QUE_SUELTAN = Object.freeze(['dragstart', 'zoomstart', 'rotatestart']);

/**
 * Si este evento suelta la camara.
 *
 * Solo cuenta lo que hace el usuario: los easeTo con que la app sigue al camion
 * —y que giran el mapa con el rumbo en cada latido— disparan los mismos eventos,
 * pero sin `originalEvent`. Si contaran, la camara se soltaria sola.
 */
export function sueltaLaCamara({ navegando, siguiendo, evento }) {
  return Boolean(navegando && siguiendo && evento?.originalEvent);
}
