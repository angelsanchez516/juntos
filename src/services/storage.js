/**
 * Capa de persistencia sobre `localStorage`.
 *
 * RESPONSABILIDAD: leer y escribir datos de la app de forma tolerante a
 * fallos. Es la única capa que toca `localStorage`; los services de datos y las
 * páginas nunca lo usan directamente.
 *
 * LAS TRES DEFENSAS DE ESTE MÓDULO
 *
 * 1. CLAVES CON VERSIÓN — `juntos:v1:eventos`
 *    La versión va en la propia clave, no dentro del JSON. Así, si el modelo
 *    de datos cambia en v2, la app no intenta interpretar los datos viejos
 *    con el código nuevo: simplemente no los encuentra, vuelve a sembrar y
 *    escribe bajo `juntos:v2:...`. Los datos de la v1 quedan inertes y se
 *    pueden borrar con `limpiarVersionesAnteriores()`.
 *
 * 2. LECTURA TOLERANTE A FALLOS
 *    `localStorage` puede contener JSON corrupto (edición manual, un
 *    despliegue a medias, o un `setItem` interrumpido). Un `JSON.parse` sin
 *    protección lanzaría y rompería toda la app. Aquí se captura, se registra
 *    y se devuelve `null`, lo que hace que el service caiga al seed.
 *
 * 3. CUOTA DE ALMACENAMIENTO
 *    `localStorage` ronda los 5 MB por origen. Las fotos en base64 ocupan un
 *    33 % más que el binario original, así que una galería con muchas fotos lo
 *    llena enseguida. Cuando se supera, el navegador lanza
 *    `QuotaExceededError`.
 *    Lo detectamos para poder explicar qué ocurrió en lugar de mostrar un
 *    error genérico.
 *
 * SEGURIDAD: `localStorage` NO es un almacén seguro. No cifra nada, es
 * accesible desde la consola del navegador y persiste en el disco del
 * dispositivo. Cualquiera con acceso al navegador puede leer y modificar los
 * datos. Solo se usa en Fase 1 para datos de ejemplo.
 * TODO-FASE2 (SEGURIDAD): todo esto debe pasar a Supabase, con autorización
 * por pareja mediante Row Level Security. Ver docs/SEGURIDAD.md.
 *
 * Related: src/services/eventosService.js, src/services/citasService.js
 *
 * @module services/storage
 */

/**
 * Versión del esquema de datos. Se incrementa cuando cambie la forma de un
 * modelo. Al subirla, la app deja de leer las claves antiguas.
 *
 * v2: las claves de categoría pasaron a ser slugs ASCII. `cumpleaños` se
 * escribió con `ñ` mientras el orden y el seed usaban `cumpleanos`, así que
 * esos eventos se pintaban con el color de "Otro". Las ideas usaban
 * `en casa`, con un espacio, que no sobrevive a un filtro ni a una URL. Con
 * v1 guardado, esas ideas serían inválidas al editarlas.
 *
 * @type {number}
 */
export const VERSION_DATOS = 2;

/**
 * Prefijo de todas las claves, espacio de nombres de la app.
 * @type {string}
 */
const PREFIJO = 'juntos';

/**
 * Espacio de nombres lógico, para no repetir el prefijo en cada llamada.
 * @type {Readonly<Record<string, string>>}
 */
export const COLECCIONES = Object.freeze({
  EVENTOS: 'eventos',
  CITAS: 'citas',
});

/**
 * Construye la clave completa de una colección, con su versión.
 *
 * @param {string} coleccion Nombre de la colección, de {@link COLECCIONES}.
 * @param {number} [version] Versión del esquema. Por defecto la actual.
 * @returns {string} Clave completa, por ejemplo `juntos:v1:eventos`.
 * @example
 * claveDe(COLECCIONES.EVENTOS); // 'juntos:v1:eventos'
 */
export function claveDe(coleccion, version = VERSION_DATOS) {
  return `${PREFIJO}:v${version}:${coleccion}`;
}

/**
 * Error lanzado cuando `localStorage` no puede escribir por cuota agotada.
 *
 * Lo distingue del resto de fallos para que la UI pueda explicar el problema
 * ("no hay espacio, borra alguna foto") en lugar de un error genérico.
 *
 * @extends Error
 */
export class ErrorCuotaAlmacenamiento extends Error {
  /**
   * @param {string} mensaje Mensaje para la persona usuaria.
   */
  constructor(mensaje) {
    super(mensaje);
    this.name = 'ErrorCuotaAlmacenamiento';
  }
}

/**
 * Comprueba si `localStorage` está disponible y es escribible.
 *
 * Puede no estarlo por varias razones, todas relevantes en un navegador real:
 * modo privado de Safari, cookies de terceros bloqueadas, o iframe sin
 * `allow-same-origin`. Ojo: en modo privado Safari sí expone `localStorage`
 * pero falla al escribir, así que hay que probar una escritura de verdad.
 *
 * @returns {boolean} `true` si se puede leer y escribir.
 * @example
 * if (!storageDisponible()) mostrarAviso('Tu navegador no permite guardar datos.');
 */
export function storageDisponible() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    const clavePrueba = `${PREFIJO}:test`;
    window.localStorage.setItem(clavePrueba, '1');
    window.localStorage.removeItem(clavePrueba);
    return true;
  } catch {
    // Cualquier excepción (SecurityError en modo privado, cuota, etc.) se
    // interpreta como "no disponible".
    return false;
  }
}

/**
 * Detecta el error de cuota del navegador entre sus variantes.
 *
 * Firefox lanza `NS_ERROR_DOM_QUOTA_REACHED`, Chrome y Safari
 * `QuotaExceededError` con `code` 22 o 1014. Cubrimos todos los casos.
 *
 * @param {unknown} error Excepción capturada.
 * @returns {boolean} `true` si se debe a falta de espacio.
 * @example
 * try { localStorage.setItem(k, v); }
 * catch (e) { if (esCuotaAgotada(e)) avisar('sin espacio'); }
 */
export function esCuotaAgotada(error) {
  if (!error || typeof error !== 'object') return false;

  return (
    error.name === 'QuotaExceededError' ||
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    error.code === 22 ||
    error.code === 1014
  );
}

/**
 * Lee y deserializa una colección.
 *
 * Devuelve `null` si no hay nada guardado, si el JSON está corrupto o si
 * `localStorage` no está disponible. Los tres casos llevan a la misma
 * respuesta en el service: sembrar los datos de ejemplo.
 *
 * @template T
 * @param {string} coleccion Colección a leer, de {@link COLECCIONES}.
 * @returns {T[]|null} Los datos guardados, o `null` si no son utilizables.
 * @example
 * const eventos = leer(COLECCIONES.EVENTOS); // null la primera vez
 */
export function leer(coleccion) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;

    const clave = claveDe(coleccion);
    const texto = window.localStorage.getItem(clave);

    // Ausencia de datos no es un error: es el primer arranque.
    if (texto === null) return null;

    const datos = JSON.parse(texto);

    /*
     * Comprobamos que sea un array. El seed y los services solo escriben
     * arrays, así que cualquier otra forma indica corrupción o una versión
     * incompatible.
     */
    if (!Array.isArray(datos)) {
      console.warn(
        `[storage] "${clave}" no contiene un array. Se ignorará y se usará el seed.`,
      );
      return null;
    }

    return datos;
  } catch (error) {
    /*
     * Cualquier fallo (JSON corrupto, acceso denegado) se registra y se
     * degrada a `null`. El service caerá al seed, así que la app sigue
     * funcionando en lugar de romperse en blanco.
     */
    console.error(
      `[storage] Error al leer "${coleccion}". Se usarán los datos de ejemplo.`,
      error,
    );
    return null;
  }
}

/**
 * Serializa y guarda una colección completa.
 *
 * @param {string} coleccion Colección a escribir, de {@link COLECCIONES}.
 * @param {unknown[]} datos Array a guardar.
 * @returns {boolean} `true` si se guardó; `false` si la cuota estaba agotada.
 * @throws {ErrorCuotaAlmacenamiento} Si no se puede escribir y la causa no es
 *   cuota (por ejemplo, permisos revocados en modo privado).
 * @example
 * guardar(COLECCIONES.EVENTOS, [evento]);
 */
export function guardar(coleccion, datos) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage no está disponible en este entorno.');
    }

    window.localStorage.setItem(claveDe(coleccion), JSON.stringify(datos));
    return true;
  } catch (error) {
    if (esCuotaAgotada(error)) {
      /*
       * Traducimos el error del navegador a uno nuestro para que la UI pueda
       * mostrar un mensaje útil ("quedan pocas fotos por subir") en vez del
       * texto técnico de QuotaExceededError.
       */
      throw new ErrorCuotaAlmacenamiento(
        'No hay espacio suficiente para guardar. Prueba con una foto más pequeña o borra alguna.',
      );
    }

    // Otros fallos (permisos, cuota de IndexedDB) se propagan sin envolver.
    throw error;
  }
}

/**
 * Borra una colección.
 *
 * @param {string} coleccion Colección a eliminar, de {@link COLECCIONES}.
 * @returns {boolean} `true` si se borró.
 * @example
 * borrar(COLECCIONES.EVENTOS);
 */
export function borrar(coleccion) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    window.localStorage.removeItem(claveDe(coleccion));
    return true;
  } catch (error) {
    console.error(`[storage] No se pudo borrar "${coleccion}".`, error);
    return false;
  }
}

/**
 * Borra todas las claves de la app, incluida la versión antigua.
 *
 * Úsica para desarrollo y para el botón "Restablecer datos" de
 * Configuración. Tras llamarla, el siguiente `getEventos()` vuelve a sembrar
 * los datos de ejemplo.
 *
 * SEGURIDAD: borra también las fotos que la pareja haya subido. La interfaz
 * debe advertirlo antes de llamar a esta función, porque no es reversible.
 *
 * @returns {boolean} `true` si se borró todo.
 * @example
 * resetDatos(); // vuelve al estado recién instalado
 */
export function resetDatos() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    /*
     * No podemos usar `localStorage.clear()` porque borraría también las
     * claves de otras apps que compartan origen. Enumeramos solo las que
     * empiezan por nuestro prefijo.
     */
    const clavesABorrar = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const clave = window.localStorage.key(i);
      if (clave && clave.startsWith(`${PREFIJO}:`)) clavesABorrar.push(clave);
    }

    clavesABorrar.forEach((clave) => window.localStorage.removeItem(clave));
    return true;
  } catch (error) {
    console.error('[storage] No se pudieron restablecer los datos.', error);
    return false;
  }
}

/**
 * Elimina las claves de versiones anteriores del esquema.
 *
 * Pensado para ejecutarlo tras una migración: así los datos de la v1 no se
 * quedan ocupando cuota para siempre.
 *
 * @returns {string[]} Claves eliminadas.
 * @example
 * limpiarVersionesAnteriores(); // ['juntos:v1:eventos']
 */
export function limpiarVersionesAnteriores() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];

    const clavesViejas = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const clave = window.localStorage.key(i);
      if (!clave || !clave.startsWith(`${PREFIJO}:`)) continue;

      // Se conservan solo las claves de la versión actual.
      const esVersionActual =
        clave === claveDe(COLECCIONES.EVENTOS) ||
        clave === claveDe(COLECCIONES.CITAS) ||
        clave.startsWith(`${PREFIJO}:test`);

      if (!esVersionActual) clavesViejas.push(clave);
    }

    clavesViejas.forEach((clave) => window.localStorage.removeItem(clave));
    return clavesViejas;
  } catch (error) {
    console.error('[storage] No se pudieron limpiar versiones antiguas.', error);
    return [];
  }
}

/**
 * Lista las claves de la app. Útil para depurar en desarrollo.
 *
 * @returns {string[]} Claves que empiezan por el prefijo de Juntos.
 * @example
 * listarClaves(); // ['juntos:v1:eventos', 'juntos:v1:citas']
 */
export function listarClaves() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];

    const claves = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const clave = window.localStorage.key(i);
      if (clave && clave.startsWith(`${PREFIJO}:`)) claves.push(clave);
    }
    return claves;
  } catch {
    return [];
  }
}

/**
 * Estima el espacio que ocupa la app, en bytes.
 *
 * Se usa en Configuración para avisar de lo cerca que está el límite de los
 * ~5 MB, ya que el navegador no expone el consumo real.
 *
 * @returns {number} Estimación en bytes (2 bytes por carácter UTF-16).
 * @example
 *tamanoAproximado(); // 24000
 */
export function tamanoAproximado() {
  return listarClaves().reduce((total, clave) => {
    /*
     * `getItem` puede lanzar si el almacén deja de estar disponible a mitad de
     * la cuenta: una pestaña de Firefox en «cookies y datos de sitios» borrados,
     * el modo privado de Safari cerrando la ventana, o una extensión de
     * privacidad. Esta función se llama desde Configuración, al abrir la
     * pantalla, y su única utilidad es una estimación cosmeticamente. Que falle
     * al pintar ese número no puede tumbar la página entera, así que una clave
     * ilegible se cuenta como vacía y se sigue con la siguiente.
     */
    let valor = '';
    try {
      valor = window.localStorage.getItem(clave) ?? '';
    } catch {
      return total;
    }

    return total + clave.length + valor.length * 2;
  }, 0);
}
