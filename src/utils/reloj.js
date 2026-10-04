/**
 * Reloj de la aplicación.
 *
 * RESPONSABILIDAD: ser el único punto por el que se pregunta "¿qué día es hoy?".
 * Todas las funciones que dependen del día en curso (el seed, `hoyISO`,
 * `esHoy`, `estaPasada`, `diasHasta`, la frase del día) leen de aquí en lugar
 * de llamar a `new Date()` por su cuenta.
 *
 * POR QUÉ UN MÓDULO ENTERO Y NO UN PARÁMETRO EN CADA FUNCIÓN
 * El día en curso se consulta desde el seed, desde tres utilidades y desde dos
 * páginas. Pasarlo como parámetro obligaría a arrastrarlo por toda la cadena
 * (`getEventos` → `crearEventosSeed` → `diaDelMes`) y a cambiar la firma de
 * hooks que solo necesitan la lista de eventos. Con una costura única, el
 * comportamiento por defecto sigue siendo "el reloj real" y las pruebas pueden
 * fijar el día sin tocar ninguna firma de producción.
 *
 * NO ES UN MÓDULO DE AUTENTICACIÓN NI DE AUTORIZACIÓN: solo decide qué fecha
 * considera la app que es "hoy".
 *
 * Related: src/utils/fechas.js, src/data/seed.js, test-datos.mjs
 *
 * @module utils/reloj
 */

/*
 * POR QUÉ NO SE IMPORTA `aFecha` DE `utils/fechas.js`
 * `fechas.js` pregunta por "hoy" a este módulo, así que importar su parser
 * aquí cerraría un ciclo: la evaluación de los dos módulos quedaría suspendida
 * entre sí y el orden en que Vite y el navegador resuelven el grafo decidiría si
 * `ahora()` existe cuando `fechas.js` la llama. El parser se repite aquí con las
 * mismas dos funciones de `date-fns` que usa `aFecha`, con lo que las dos siguen
 * entendiendo `YYYY-MM-DD` como medianoche local. Si algún día cambian, hay que
 * cambiar las dos.
 */

import { isValid, parseISO } from 'date-fns';

/*
 * Referencia fijada, o `null` si la app va con el reloj real. Es estado del
 * módulo a propósito: es la costura que las pruebas sustituyen, y ninguna
 * función de producción escribe aquí.
 */
let referenciaFijada = null;

/**
 * Devuelve el instante actual, o el instante fijado si lo hay.
 *
 * Devuelve una copia, no la referencia guardada: si quien la recibe la mutara
 * (por ejemplo con `setMonth`), no cambiaría lo que ve el resto de la app.
 *
 * @returns {Date} Fecha local de "ahora".
 * @example
 * ahora(); // new Date()
 */
export function ahora() {
  return referenciaFijada === null ? new Date() : new Date(referenciaFijada);
}

/**
 * Fija el día que la app va a tomar como "hoy".
 *
 * Pensada para las pruebas: permite sembrar el seed y comprobar la interfaz
 * como si fuera un día concreto, sin depender de cuándo se ejecuta la suite.
 * Con la referencia fijada, `hoyISO()` devuelve ese día y el seed ancla sus
 * fechas al mes correspondiente.
 *
 * Acepta tanto `YYYY-MM-DD` como un `Date`, porque desde una prueba lo natural
 * es escribir la fecha literal y en el resto del código se pasa un objeto.
 *
 * @param {string|Date} fecha Día a tomar como hoy.
 * @throws {TypeError} Si la fecha no es válida. Es preferible fallar aquí, al
 *   principio de la suite, que producir meses de seed equivocados sin avisar.
 * @returns {void}
 * @example
 * fijarAhora('2026-10-02');
 * fijarAhora(new Date(2027, 1, 28));
 */
export function fijarAhora(fecha) {
  const fechaValida = fecha instanceof Date ? fecha : aFechaLocal(fecha);

  if (!fechaValida || Number.isNaN(fechaValida.getTime())) {
    throw new TypeError('fijarAhora necesita una fecha válida en `YYYY-MM-DD`.');
  }

  referenciaFijada = fechaValida;
}

/**
 * Convierte `YYYY-MM-DD` en un `Date` a medianoche local.
 *
 * Réplica mínima de `aFecha` de `utils/fechas.js`, y por el mismo motivo que
 * está aquí en vez de importarse: ese módulo depende de este.
 *
 * @param {unknown} fechaISO Fecha en formato `YYYY-MM-DD`.
 * @returns {Date|null} Fecha local, o `null` si no es válida.
 */
function aFechaLocal(fechaISO) {
  if (!fechaISO || typeof fechaISO !== 'string') return null;

  const fecha = parseISO(fechaISO);
  return isValid(fecha) ? fecha : null;
}

/**
 * Devuelve el reloj al comportamiento normal, que es el del sistema.
 *
 * @returns {void}
 * @example
 * restablecerAhora();
 */
export function restablecerAhora() {
  referenciaFijada = null;
}

/**
 * Indica si el reloj está fijado a un día concreto.
 *
 * @returns {boolean} `true` si hay una referencia fijada.
 * @example
 * if (relojFijado()) console.info('Suite con fecha simulada.');
 */
export function relojFijado() {
  return referenciaFijada !== null;
}
