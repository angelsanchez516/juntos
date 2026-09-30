/**
 * Generador de identificadores.
 *
 * RESPONSABILIDAD: crear los `id` de las entidades nuevas de forma segura y
 * con el formato que usará Supabase en Fase 2.
 *
 * POR QUÉ `crypto.randomUUID()` Y NO UN CONTADOR
 * Un contador incremental (`1`, `2`, `3`...) es predecible: quien sepa
 * cuántos eventos hay puede deducir que existen y probar el siguiente id para
 * leerlos. Un UUID v4 tiene 122 bits de entropía, así que adivinarlo es
 * inviable. Y como Supabase usa UUID para sus claves primarias, generar UUID
 * ahora evita tener que migrar todos los registros más adelante.
 *
 * Related: src/services/eventosService.js, src/services/citasService.js
 *
 * @module utils/ids
 */

/**
 * Genera un identificador único.
 *
 * Usa el API síncrona `crypto.randomUUID()`, disponible en todos los navegadores
 * modernos y en Node 19+. No es criptográficamente fuerte por diseño (no
 * necesita serlo), pero sí aleatorio y no predecible.
 *
 * @returns {string} UUID v4 con formato `8-4-4-4-12`.
 * @example
 * const id = nuevoId(); // '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'
 */
export function nuevoId() {
  /*
   * `crypto` es global en el navegador. Solo recurrimos a import.meta.env para
   * cubrir SSR o entornos de test sin DOM, donde no estaría definido.
   */
  const origen =
    (typeof globalThis !== 'undefined' && globalThis.crypto) ||
    (typeof crypto !== 'undefined' ? crypto : undefined);

  if (origen && typeof origen.randomUUID === 'function') {
    return origen.randomUUID();
  }

  /*
   * Reserva para navegadores muy antiguos o entornos sin WebCrypto. No es
   * criptográficamente seguro, así que avisamos en consola: en Fase 2 esto
   * desaparece porque los id los genera la base de datos.
   */
  console.warn(
    '[ids] crypto.randomUUID() no disponible: se genera un id con Math.random(). ' +
      'Es suficiente para el prototipo, pero el id debe generarlo el servidor en Fase 2.',
  );

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (caracter) => {
    const aleatorio = (Math.random() * 16) | 0;
    const valor = caracter === 'x' ? aleatorio : (aleatorio & 0x3) | 0x8;
    return valor.toString(16);
  });
}
