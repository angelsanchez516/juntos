/**
 * Hook de sesión.
 *
 * RESPONSABILIDAD: decir si hay sesión y avisar cuando eso cambia, sin que cada
 * pantalla tenga que suscribirse a `localStorage` por su cuenta.
 *
 * POR QUÉ NO BASTA CON `leerSesion()` EN CADA RENDER
 * "Cerrar sesión" borra una clave de `localStorage`. Si Configuración solo
 * llamara a `leerSesion()` al montar, el indicador seguiría diciendo que hay
 * sesión después de cerrarla: el evento `storage` no lo dispara la propia
 * pestaña, así que nadie se enteraría. Con la suscripción, el estado cambia en
 * el sitio y la pantalla deja de ofrecer cerrar una sesión que ya no existe.
 *
 * Related: src/services/sesion.js, src/pages/Configuracion.jsx
 *
 * @module hooks/useSesion
 */

import { useCallback, useEffect, useState } from 'react';
import { leerSesion } from '../services/sesion';

/**
 * Estado de la sesión del dispositivo.
 *
 * El valor inicial se lee de forma síncrona en el primer render, no en un efecto:
 * la guardia de rutas ya lo ha consultado, y empezar en `false` haría que
 * Configuración pintara "sin sesión" durante un frame en quien sí la tiene.
 *
 * @returns {{sesion: object|null, haySesion: boolean, refrescar: () => void}} Estado
 *   y la función para releerlo a mano tras escribir.
 * @example
 * const { haySesion, refrescar } = useSesion();
 */
export default function useSesion() {
  const [sesion, setSesion] = useState(() => leerSesion());

  const refrescar = useCallback(() => {
    setSesion(leerSesion());
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    /*
     * `storage` cubre lo escrito en OTRA pestaña (dos ventanas abiertas, una
     * cierra sesión). La escritura de esta misma pestaña no genera ese evento,
     * de ahí `refrescar()`: quien cierra sesión ya sabe que tiene que avisar.
     */
    window.addEventListener('storage', refrescar);
    return () => {
      window.removeEventListener('storage', refrescar);
    };
  }, [refrescar]);

  return { sesion, haySesion: sesion !== null, refrescar };
}
