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
 * v3: `IdeaCita` tiene el campo `origen`, que distingue las ideas del seed de
 * las que crea la pareja. Sin él no hay forma de saber si una idea se puede
 * editar o borrar, y la única manera sería reconocerlas por sus ids o por su
 * contenido, que se rompe en cuanto cambia el seed. Se sube la versión porque
 * las ideas ya guardadas no tienen el campo: tratar las de v2 como "usuario"
 * sería una interpretación, y preferimos que el seed se vuelva a sembrar y
 * quede un dato que sí dice la verdad. Las ideas creadas por la pareja se
 * pierden al subir; en un prototipo de fase 1 es un coste aceptable, y en fase
 * 2 no aplica porque allí cada idea es una fila con su propio registro.
 *
 * @type {number}
 */
export const VERSION_DATOS = 3;

/**
 * Versión del esquema de la sesión, separada a propósito de
 * {@link VERSION_DATOS}.
 *
 * Son dos cosas distintas y no deben compartir número. `VERSION_DATOS` sube
 * cuando cambia la FORMA de un modelo: al subirla, las claves antiguas dejan de
 * leerse y la app vuelve a sembrar. Ese coste es aceptable para datos de
 * ejemplo, y no lo es para la sesión: cerrar la sesión de todo el mundo porque
 * se añadió el campo `origen` a las ideas no tiene ningún sentido. Quien
 * estuviera usando la app se encontraría sin sesión y tendría que empezar de
 * cero, sin haber hecho nada que lo justifique.
 *
 * Por eso la sesión lleva su propio número, que solo se mueve cuando cambie lo
 * que la sesión guarda o su forma, no cuando cambien los datos que hay al
 *rededor.
 *
 * En esta fase no se guarda ninguna sesión: `Bienvenida` navega sin más y no
 * escribe nada. La constante existe ya para que, cuando se implemente la
 * sesión, la clave sea `juntos:v1:sesion` y no herede la versión de los datos
 * por accidente. Ver docs/SEGURIDAD.md.
 *
 * @type {number}
 */
export const VERSION_SESION = 1;

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
 * Construye la clave de la sesión, con su propia versión.
 *
 * No reutiliza {@link claveDe} a propósito: la sesión no es una colección de
 * datos y no debe arrastrar la versión del esquema. Pasarla por aquí deja
 * explícito el desacople, en vez de confiar en que quien llame se acuerde de
 * pasar la versión buena.
 *
 * @returns {string} Clave de la sesión, por ejemplo `juntos:v1:sesion`.
 * @example
 * claveDeSesion(); // 'juntos:v1:sesion'
 */
export function claveDeSesion(version = VERSION_SESION) {
  return `${PREFIJO}:v${version}:sesion`;
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
 * Borra los datos de la app, pero no su sesión.
 *
 * Útil para desarrollo y para el botón "Restablecer datos" de
 * Configuración. Tras llamarla, el siguiente `getEventos()` vuelve a sembrar
 * los datos de ejemplo.
 *
 * POR QUÉ SE CONSERVA LA SESIÓN
 * Restablecer los datos y perder la sesión son dos cosas distintas, y esta
 * función solo hace la primera. La sesión es el único dato que la app no puede
 * volver a crear: si se borrara, quien está dentro se encontraría fuera de su
 * propio calendario sin haber hecho nada, y además no tendría forma de volver a
 * entrar porque todavía no hay recuperación de sesión (ver
 * `TODO-FASE2 (SEGURIDAD)` y docs/SEGURIDAD.md). Un botón de "¿quieres volver a
 * empezar?" que además cierra la puerta no es restablecer datos, es desinstalar
 * la app. Cuando exista la recuperación, la interfaz lo advertirá aparte.
 *
 * `limpiarVersionesAnteriores()` aplica la misma excepción, y por el mismo
 * motivo.
 *
 * SEGURIDAD: borra también las fotos que la pareja haya subido. La interfaz
 * debe advertirlo antes de llamar a esta función, porque no es reversible.
 *
 * @returns {boolean} `true` si se borraron los datos.
 * @example
 * resetDatos(); // vuelve al estado recién instalado, con la sesión intacta
 */
export function resetDatos() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;

    /*
     * No podemos usar `localStorage.clear()` porque borraría también las
     * claves de otras apps que compartan origen. Enumeramos solo las que
     * empiezan por nuestro prefijo, y de entre ellas descartamos la sesión.
     */
    const claveSesion = claveDeSesion();
    const clavesABorrar = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const clave = window.localStorage.key(i);
      if (!clave || !clave.startsWith(`${PREFIJO}:`)) continue;
      if (clave === claveSesion) continue;

      clavesABorrar.push(clave);
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

      /*
       * Se conservan las claves de la versión actual. La sesión se conserva
       * siempre y con su propia versión: es el único dato que no se puede
       * regenerar, y borrarla aquí dejaría a cualquiera sin sesión por haber
       * subido la versión de los datos.
       */
      const esVersionActual =
        clave === claveDe(COLECCIONES.EVENTOS) ||
        clave === claveDe(COLECCIONES.CITAS) ||
        clave === claveDeSesion() ||
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
 * tamanoAproximado(); // 24000
 */
export function tamanoAproximado() {
  return listarClaves().reduce((total, clave) => {
    /*
     * `getItem` puede lanzar si el almacén deja de estar disponible a mitad de
     * la cuenta: una pestaña de Firefox en «cookies y datos de sitios» borrados,
     * el modo privado de Safari cerrando la ventana, o una extensión de
     * privacidad. Esta función se llama desde Configuración, al abrir la
* pantalla, y su única utilidad es una estimación, que es estética. Que falle
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
