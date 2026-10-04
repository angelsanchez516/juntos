/**
 * Servicio de sesión.
 *
 * RESPONSABILIDAD: decidir si hay sesión, crearla y cerrarla. Es la única puerta
 * por la que se lee y escribe `juntos:v1:sesion`.
 *
 * ------------------------------------------------------------------
 * ESTO NO ES AUTENTICACIÓN. LÉELO ANTES DE USAR ESTE MÓDULO.
 * ------------------------------------------------------------------
 * La sesión que guarda este módulo es un objeto en `localStorage` que dice
 * "esta persona ya pasó por la pantalla de bienvenida". No hay correo, ni
 * contraseña, ni token, ni nada que el servidor pueda verificar: quien quiera
 * puede escribir esa clave a mano desde la consola del navegador y entrar. No
 * protege nada, no separa parejas y no debe usarse para decidir si alguien puede
 * leer o escribir unos datos. Solo evita el primer pantallazo de bienvenida a
 * quien ya lo vio, en este navegador.
 *
 * Que sea explícito aquí y no en un documento aparte es a propósito: la tentación
 * de tratar "hay sesión" como "está autorizado" aparece justo cuando alguien
 * empieza a usar este módulo para algo más que la bienvenida.
 *
 * TODO-FASE2 (SEGURIDAD): sustituir por Supabase Auth. La sesión pasa a vivir en
 * una cookie `httpOnly` del servidor, y la autorización se decide allí con las
 * políticas RLS, no con una bandera en el navegador. Ver `docs/SEGURIDAD.md`
 * ("Autenticación y sesión") y `docs/MIGRACION_SUPABASE.md`.
 *
 * Related: src/services/storage.js (leerClave, escribirClave, borrarClave),
 *   src/hooks/useSesion.js, src/App.jsx (guardia de rutas)
 *
 * @module services/sesion
 */

import { nuevoId } from '../utils/ids';
import { ahora } from '../utils/reloj';
import { esIdValido } from '../utils/validaciones';
import { borrarClave, claveDeSesion, escribirClave, leerClave } from './storage';

/**
 * @typedef {object} Sesion
 * @property {string} id Identificador de la sesión, con formato UUID v4.
 * @property {string} creadaEn Marca ISO del momento de crearla, del reloj de la
 *   app y no del ordenador, para que con la fecha simulada de la suite no quede
 *   una marca de un año que no es el que se está probando.
 */

/**
 * Comprueba que lo guardado tiene forma de sesión.
 *
 * POR QUÉ SE VALIDA EN LUGAR DE CONFIAR
 * `localStorage` es editable a mano y lo comparten el resto de pestañas y de
 * versiones de la app. Un valor corrupto, un objeto a medias de una escritura
 * interrumpida o una clave puesta a propósito no pueden contarse como "hay
 * sesión": si lo fueran, alguien que no ha pasado por la bienvenida entraría sin
 * pasar por ella, y en Fase 2 ese mismo camino sería un salto de autorización.
 *
 * @param {unknown} valor Valor deserializado de la clave.
 * @returns {Sesion|null} La sesión si es válida, o `null`.
 */
function esSesionValida(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null;
  if (!esIdValido(valor.id)) return null;
  if (typeof valor.creadaEn !== 'string' || Number.isNaN(Date.parse(valor.creadaEn))) return null;

  return { id: valor.id, creadaEn: valor.creadaEn };
}

/**
 * Lee la sesión guardada.
 *
 * Tolerant: si no hay nada, si el JSON está corrupto o si el valor no tiene
 * forma de sesión, devuelve `null`. Que se degrade a `null` y no lance importa:
 * esta función la llama la guardia de rutas, en el primer render, y una
 * excepción ahí deja la app en blanco.
 *
 * @returns {Sesion|null} La sesión activa, o `null` si no la hay.
 * @example
 * leerSesion(); // { id: '1b9d…', creadaEn: '2026-10-02T15:00:00.000Z' }
 */
export function leerSesion() {
  return esSesionValida(leerClave(claveDeSesion()));
}

/**
 * Indica si hay sesión.
 *
 * Es un atajo de `leerSesion() !== null` para las dos preguntas binarias que
 * hace la app: la guardia de rutas y el indicador de Configuración.
 *
 * @returns {boolean} `true` si hay una sesión válida.
 * @example
 * haySesion(); // false en la primera visita
 */
export function haySesion() {
  return leerSesion() !== null;
}

/**
 * Crea la sesión y la guarda.
 *
 * Sustituye a la anterior si ya había una: volver a pulsar "Comenzar" no deja
 * dos sesiones, ni una lista de ellas. No pide nada al servidor porque no hay
 * servidor (ver la nota de seguridad de este módulo).
 *
 * @returns {Sesion|null} La sesión creada, o `null` si no se pudo guardar.
 * @example
 * crearSesion(); // { id: '8c1f…', creadaEn: '2026-10-02T15:00:00.000Z' }
 */
export function crearSesion() {
  const sesion = { id: nuevoId(), creadaEn: ahora().toISOString() };

  try {
    escribirClave(claveDeSesion(), sesion);
    return sesion;
  } catch (error) {
    /*
     * Devolver `null` en lugar de propagar deja la app en un estado que se
     * explica solo: sin sesión, la guardia manda a `/bienvenida`, que es donde
     * se vuelve a pulsar "Comenzar". Si `escribirClave()` falla por cuota,
     * `ErrorCuotaAlmacenamiento` llega hasta aquí con su mensaje, y el registro
     * deja la causa.
     */
    console.error('[sesion] No se pudo crear la sesión.', error);
    return null;
  }
}

/**
 * Cierra la sesión.
 *
 * Borra solo la clave de sesión. Los datos y las fotos se quedan: cerrar sesión
 * no es borrar nada, y en esta fase ni siquiera es salir de la pareja, porque no
 * hay pareja a la que salir. Es exactamente el revés de `resetDatos()`, que
 * borra los datos y conserva la sesión.
 *
 * SEGURIDAD: como no hay autenticación, esto no expulsa a nadie. Solo olvida que
 * se pasó por la bienvenida.
 *
 * @returns {boolean} `true` si se cerró.
 * @example
 * cerrarSesion(); // true
 */
export function cerrarSesion() {
  return borrarClave(claveDeSesion());
}

/**
 * Datos de la sesión para enseñarlos en Configuración.
 *
 * Va aparte de `leerSesion()` porque la interfaz necesita cosas que la sesión no
 * guarda: la clave completa con su versión y si hay sesión o no. Así el
 * componente no tiene que componer ese texto ni repetir el `leerClave()`.
 *
 * @returns {{activa: boolean, clave: string, id: string|null, creadaEn: string|null}}
 *   Lo que se muestra en el indicador de sesión.
 * @example
 * informacionSesion();
 * // { activa: true, clave: 'juntos:v1:sesion', id: '8c1f…', creadaEn: '2026-10-02T…' }
 */
export function informacionSesion() {
  const sesion = leerSesion();

  return {
    activa: sesion !== null,
    clave: claveDeSesion(),
    id: sesion?.id ?? null,
    creadaEn: sesion?.creadaEn ?? null,
  };
}
