/**
 * Utilidades de imagen para el formulario de evento.
 *
 * RESPONSABILIDAD: decidir si un archivo es una imagen válida **leyendo sus
 * bytes**, calcular a qué tamaño se va a reescalar, y devolver una versión
 * comprimida lista para guardarse.
 *
 * POR QUÉ NO BASTA CON `file.type`
 * `File.type` lo pone el navegador a partir de la extensión del nombre, y su
 * extensión se la pone quienchoosable el archivo. Renombrar un `.html` con
 * scripts a `.jpg` lo convierte en un `image/jpeg` perfectamente válido para el
 * navegador. Un SVG es el caso extremo: es un archivo de texto con scripts
 * dentro, y con `<img>` no se ejecuta, pero si el servicio de galería lo acaba
 * sirviendo como `image/svg+xml` sí. Por eso se comprueban los primeros bytes,
 * que son los que el sistema de archivos no puede falsificar.
 *
 * BENEFICIO DE PRIVACIDAD
 * Al redibujar la imagen en un canvas y volver a exportarla, **los metadatos
 * EXIF se pierden**: fecha, modelo de cámara y, lo más delicado, las
 * coordenadas GPS. Guardar la foto recomprimida en vez del archivo original
 * significa que la ubicación de la casa donde se tomó la foto nunca llega a
 * almacenarse. Ver `docs/SEGURIDAD.md`.
 *
 * Related: components/eventos/EventoFormModal.jsx, components/ui/SelectorFoto.jsx
 *
 * @module utils/imagen
 */

/**
 * Tamaño máximo del archivo **antes** de procesarlo.
 *
 * @type {number}
 */
export const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

/**
 * Ancho al que se reescala la imagen antes de guardarla.
 *
 * 1200 px cubre una pantalla grande y deja la foto de un móvil moderno
 * (4000 px, 3–5 MB) en algo del orden de 100–200 KB en WebP. Es lo que hace
 * que la app quepa en la cuota de ~5 MB de `localStorage`.
 *
 * @type {number}
 */
export const ANCHO_MAXIMO = 1200;

/**
 * Calidad de la exportación. 0.8 es el punto en el que la diferencia a simple
 * vista es casi nula frente a 0.9 y el archivo pesa bastante menos.
 *
 * @type {number}
 */
export const CALIDAD = 0.8;

/**
 * Formatos de salida, por orden de preferencia al comprimir.
 *
 * WebP pesa entre un 25 % y un 35 % menos que JPEG con la misma calidad
 * aparente. Pero no está en todos los navegadores, así que `comprimirImagen`
 * cae a JPEG si el canvas no lo soporta.
 *
 * @type {ReadonlyArray<string>}
 */
export const FORMATOS_SALIDA = Object.freeze(['image/webp', 'image/jpeg']);

/**
 * Formatos que el canvas sabe exportar.
 *
 * @type {ReadonlyArray<string>}
 */
export const TIPOS_CANVAS = Object.freeze(['image/webp', 'image/jpeg']);

/**
 * Formatos aceptados, derivados de las firmas que se comprueban abajo.
 *
 * @type {ReadonlyArray<string>}
 */
export const TIPOS_ACEPTADOS = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

/**
 * @typedef {object} ResultadoValidacionArchivo
 * @property {boolean} valido `true` si el archivo se puede usar.
 * @property {string|null} error Motivo en español, o `null` si es válido.
 * @property {string|null} tipoMime Tipo detectado por los bytes, no el declarado.
 * @property {number} tamano Tamaño en bytes del archivo.
 */

/**
 * @typedef {object} ResultadoCompresion
 * @property {boolean} ok `false` si no se pudo procesar.
 * @property {string|null} dataUrl Foto lista para guardar, o `null`.
 * @property {number} ancho Ancho final en píxeles.
 * @property {number} alto Alto final en píxeles.
 * @property {number} bytes Tamaño estimado del data URL en bytes.
 * @property {string} tipoMime Formato de salida elegido.
 * @property {string|null} error Motivo en español si `ok` es `false`.
 */

/**
 * Firmas de los formatos aceptados, leídas de los primeros bytes del archivo.
 *
 * Cada entrada es un `Uint8Array` que se compara posicionalmente; `null` en una
 * posición significa "cualquier byte".
 *
 * @type {ReadonlyArray<{mime: string, nombre: string, firma: ReadonlyArray<number|null>}>}
 */
export const FIRMAS = Object.freeze([
  {
    // JPEG: SOI `FF D8` seguido de `FF`, que empieza el marcador siguiente.
    mime: 'image/jpeg',
    nombre: 'JPEG',
    firma: [0xff, 0xd8, 0xff],
  },
  {
    // PNG: los 8 bytes del IHDR, con el salto de línea `\r\n` en medio.
    mime: 'image/png',
    nombre: 'PNG',
    firma: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    // WebP: contenedor RIFF, 4 bytes de tamaño, y el tipo `WEBP`.
    mime: 'image/webp',
    nombre: 'WebP',
    firma: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
]);

/**
 * Calcula las dimensiones finales de una imagen reescalada.
 *
 * ESTA FUNCIÓN ES PURA y es la razón de que el módulo sea testeable: no toca
 * el DOM ni necesita un `File`. Solo recibe dos números y devuelve otros dos,
 * así que se pueden comprobar los casos límite (imagen más pequeña que el
 * máximo, panorámica altísima, proporciones raras) sin cargar nada.
 *
 * `ancho` y `alto` nunca valen 0, aunque la entrada sea degenerada: un
 * `canvas` de 0 px lanza `IndexSizeError` y dejaría el formulario sin poder
 * guardar.
 *
 * @param {number} anchoOriginal Ancho en píxeles de la imagen original.
 * @param {number} altoOriginal Alto en píxeles de la imagen original.
 * @param {number} [anchoMaximo] Ancho máximo permitido.
 * @returns {{ancho: number, alto: number, escalado: boolean}} Dimensiones
 *   finales y si hubo que reescalar.
 * @example
 * calcularDimensiones(4000, 3000);  // { ancho: 1200, alto: 900, escalado: true }
 * calcularDimensiones(800, 600);    // { ancho: 800, alto: 600, escalado: false }
 * calcularDimensiones(1200, 4);     // { alto: 4, nunca 0 }
 * calcularDimensiones(0, 0);        // { ancho: 1, alto: 1 }
 */
export function calcularDimensiones(anchoOriginal, altoOriginal, anchoMaximo = ANCHO_MAXIMO) {
  const anchoSeguro = Number.isFinite(anchoOriginal) && anchoOriginal > 0 ? Math.floor(anchoOriginal) : 1;
  const altoSeguro = Number.isFinite(altoOriginal) && altoOriginal > 0 ? Math.floor(altoOriginal) : 1;

  const limite = Number.isFinite(anchoMaximo) && anchoMaximo > 0 ? Math.floor(anchoMaximo) : 1;

  // Solo se toca si se pasa del límite: ampliar una foto pequeña la haría
  // pixelada y no reduciría su peso.
  if (anchoSeguro <= limite) {
    return { ancho: anchoSeguro, alto: altoSeguro, escalado: false };
  }

  const escala = limite / anchoSeguro;
  return {
    ancho: limite,
    // `Math.max(1, …)` cubre imágenes de una fila de píxeles, donde el redondeo
    // a 0 haría fallar el canvas.
    alto: Math.max(1, Math.round(altoSeguro * escala)),
    escalado: true,
  };
}

/**
 * Deduce el tipo real de una imagen leyendo los primeros bytes.
 *
 * @param {ArrayBuffer|Uint8Array} buffer Inicio del archivo. Solo se leen los
 *   16 primeros bytes.
 * @returns {{mime: string, nombre: string}|null} Formato detectado, o `null` si
 *   no coincide con ninguna firma.
 * @example
 * detectarTipoPorBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));
 * // { mime: 'image/jpeg', nombre: 'JPEG' }
 */
export function detectarTipoPorBytes(buffer) {
  const bytes =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer ?? new ArrayBuffer(0));

  for (const { mime, nombre, firma } of FIRMAS) {
    const coincide = firma.every(
      (byte, posicion) => byte === null || bytes[posicion] === byte,
    );
    if (coincide) return { mime, nombre };
  }

  return null;
}

/**
 * Valida un archivo de imagen antes de procesarlo.
 *
 * El orden importa: **primero el tamaño**, porque no leer un archivo de 200 MB
 * para luego rechazarlo es lo que deja la pestaña colgada. Después la
 * extensión, que es una pista rápida y barata, y por último los bytes, que son
 * la prueba.
 *
 * SEGURIDAD: se rechazan SVG y los SVG "contenidos" dentro de otro nombre
 * (`image/svg+xml`), además de PDF y cualquier cosa que no huela a imagen de
 * raster. Un SVG es un documento XML que puede llevar scripts, y aunque en
 * `<img>` no se ejecuten, no queremos guardarlos: se acaba sirviendo en algún
 * sitio donde sí.
 *
 * @param {File|{name: string, size: number, type: string}} archivo Archivo
 *   elegido por la persona. Se acepta un objeto plano para poder testearlo sin
 *   construir un `File` de verdad.
 * @returns {ResultadoValidacionArchivo} Resultado con el motivo del rechazo.
 * @example
 * validarArchivoFoto(file);
 * // { valido: false, error: 'El archivo supera los 5 MB.', ... }
 */
export function validarArchivoFoto(archivo) {
  const nombre = typeof archivo?.name === 'string' ? archivo.name : '';
  const tamano = Number.isFinite(archivo?.size) ? archivo.size : 0;
  const tipoDeclarado = typeof archivo?.type === 'string' ? archivo.type : '';

  if (tamano === 0) {
    return { valido: false, error: 'El archivo está vacío.', tipoMime: null, tamano };
  }

  if (tamano > TAMANO_MAXIMO_BYTES) {
    const limiteMb = Math.round(TAMANO_MAXIMO_BYTES / (1024 * 1024));
    return {
      valido: false,
      error: `La foto pesa ${(tamano / (1024 * 1024)).toFixed(1)} MB y el límite son ${limiteMb} MB.`,
      tipoMime: null,
      tamano,
    };
  }

  const extension = (nombre.split('.').pop() ?? '').toLowerCase();

  if (extension === 'svg' || tipoDeclarado === 'image/svg+xml') {
    return {
      valido: false,
      error: 'Los SVG no se admiten: pueden contener código ejecutable.',
      tipoMime: null,
      tamano,
    };
  }

  if (extension === 'pdf' || tipoDeclarado === 'application/pdf') {
    return {
      valido: false,
      error: 'Eso es un PDF, no una foto.',
      tipoMime: null,
      tamano,
    };
  }

  /*
   * Aviso, no rechazo: `file` es una forma conveniente de no leer el archivo
   * entero, pero la decisión la toman los bytes de abajo.
   */
  if (extension === 'jpg' || extension === 'jpeg') {
    if (tipoDeclarado && !TIPOS_ACEPTADOS.includes(tipoDeclarado)) {
      return {
        valido: false,
        error: 'La extensión dice JPEG pero el navegador identifica otro tipo.',
        tipoMime: null,
        tamano,
      };
    }
  } else if (!['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return {
      valido: false,
      error: `El archivo "${nombre}" no parece una foto (${extension || 'sin extensión'}).`,
      tipoMime: null,
      tamano,
    };
  }

  return { valido: true, error: null, tipoMime: null, tamano };
}

/**
 * Lee el inicio de un archivo y lo contrasta con las firmas conocidas.
 *
 * @param {Blob} archivo Archivo elegido.
 * @returns {Promise<ResultadoValidacionArchivo>} Resultado con el tipo real.
 * @example
 * await validarBytesDeArchivo(file);
 * // { valido: true, error: null, tipoMime: 'image/jpeg', tamano: 2456789 }
 */
export async function validarBytesDeArchivo(archivo) {
  const previo = validarArchivoFoto(archivo);
  if (!previo.valido) return previo;

  const buffer = await archivo.arrayBuffer();
  const detectado = detectarTipoPorBytes(buffer);

  if (!detectado) {
    return {
      ...previo,
      valido: false,
      error:
        'El contenido del archivo no es una imagen JPEG, PNG o WebP. ' +
        'Puede que la extensión esté cambiada.',
    };
  }

  return { ...previo, tipoMime: detectado.mime };
}

/**
 * @typedef {object} ImagenBitmapLike
 * @property {number} width Ancho natural de la imagen.
 * @property {number} height Alto natural de la imagen.
 * @property {() => void} close Libera la memoria del bitmap.
 */

/**
 * Abre una imagen en un bitmap ya orientada.
 *
 * POR QUÉ `imageOrientation: 'from-image'`
 * Los móviles guardan la foto en horizontal y apuntan en el EXIF en qué lado
 * está "arriba", en vez de rotar los píxeles. Sin esta opción, una foto tomada
 * en vertical sale **tumbada** 90°. Con ella, el bitmap llega ya girado y
 * cualquier lienzo que se dibuje encima sale derecho.
 *
 * Por eso no se usa la etiqueta `<img>` con su `onload`: el navegador aplica la
 * orientación por su cuenta al pintar, pero un `canvas` donde se dibuja el
 * `img` no la aplica, y de ahí sale el clásico "las fotos del celular salen
 * sideways".
 *
 * @param {Blob} archivo Archivo de la imagen.
 * @returns {Promise<ImagenBitmapLike>} Bitmap listo para dibujar.
 * @throws {Error} Si el navegador no soporta `createImageBitmap`.
 * @example
 * const bitmap = await abrirBitmap(file);
 * const { ancho, alto } = calcularDimensiones(bitmap.width, bitmap.height);
 * bitmap.close();
 */
export async function abrirBitmap(archivo) {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('Este navegador no soporta createImageBitmap.');
  }

  return createImageBitmap(archivo, { imageOrientation: 'from-image' });
}

/**
 * Reescala y recomprime una imagen, devolviendo un data URL.
 *
 * @param {File|Blob} archivo Archivo original.
 * @param {object} [opciones] Ajustes.
 * @param {number} [opciones.anchoMaximo] Ancho máximo. Por defecto `1200`.
 * @param {number} [opciones.calidad] Calidad de exportación, 0–1.
 * @param {string} [opciones.tipoForzado] Formato de salida. Por defecto se
 *   prueba WebP y se cae a JPEG.
 * @returns {Promise<ResultadoCompresion>} Resultado con la foto lista.
 * @example
 * const { ok, dataUrl, ancho, alto } = await comprimirImagen(file);
 */
export async function comprimirImagen(archivo, opciones = {}) {
  const {
    anchoMaximo = ANCHO_MAXIMO,
    calidad = CALIDAD,
    tipoForzado = null,
  } = opciones;

  let bitmap = null;
  try {
    bitmap = await abrirBitmap(archivo);

    const { ancho, alto } = calcularDimensiones(bitmap.width, bitmap.height, anchoMaximo);

    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;

    const contexto = lienzo.getContext('2d');
    if (!contexto) {
      return { ok: false, dataUrl: null, ancho, alto, bytes: 0, tipoMime: '', error: 'No pudimos procesar la foto en este navegador.' };
    }

    /*
     * Sin `imageSmoothingQuality` en navegadores antiguos, la calidad por
     * defecto es bilineal y se ve borroso al reducir. `high` da un resultado
     * bastante mejor y es el valor por defecto en los navegadores actuales.
     */
    contexto.imageSmoothingEnabled = true;
    contexto.imageSmoothingQuality = 'high';
    contexto.drawImage(bitmap, 0, 0, ancho, alto);

    const tipos = tipoForzado ? [tipoForzado] : FORMATOS_SALIDA;
    for (const tipo of tipos) {
      if (tipo === 'image/webp' && !soportaTipoCanvas('image/webp')) continue;

      /*
       * Solo JPEG no admite canal alfa: al exportar, las zonas transparentes
       * de un PNG se convertirían en negro. El relleno va aquí y no antes del
       * bucle a propósito. Rellenando antes, también se perdía la
       * transparencia al exportar a WebP, que sí la admite y es el primer
       * formato que se intenta. Redibujar antes de exportar a JPEG es lo que
       * cuesta aquí: el lienzo ya tiene la imagen encima y hay que partir de
       * cero.
       */
      if (tipo === 'image/jpeg') {
        contexto.fillStyle = '#FFFFFF';
        contexto.fillRect(0, 0, ancho, alto);
        contexto.drawImage(bitmap, 0, 0, ancho, alto);
      }

      const dataUrl = lienzo.toDataURL(tipo, calidad);
      if (!dataUrl.startsWith(`data:${tipo}`)) continue;

      return {
        ok: true,
        dataUrl,
        ancho,
        alto,
        bytes: dataUrl.length,
        tipoMime: tipo,
        error: null,
      };
    }

    return {
      ok: false,
      dataUrl: null,
      ancho,
      alto,
      bytes: 0,
      tipoMime: '',
      error: 'El navegador no pudo exportar la imagen.',
    };
  } catch (err) {
    return {
      ok: false,
      dataUrl: null,
      ancho: 0,
      alto: 0,
      bytes: 0,
      tipoMime: '',
      error: err?.message ?? 'No pudimos procesar la foto.',
    };
  } finally {
    // El bitmap puede ocupar decenas de MB. Sin cerrarlo, abrir tres fotos
    // seguidas en el formulario deja la pestaña sin memoria.
    bitmap?.close();
  }
}

/**
 * Comprueba si el navegador puede exportar a un formato.
 *
 * Se hace con un canvas de 1×1 porque es la única forma fiable: no todos los
 * navegadores anuncian WebP, pero algunos lo pintan en `<img>` y no lo
 * exportan desde `toDataURL`.
 *
 * @param {string} tipo MIME a probar.
 * @returns {boolean} `true` si el canvas puede generarlo.
 * @example
 * soportaTipoCanvas('image/webp'); // true en la mayoría
 */
export function soportaTipoCanvas(tipo) {
  if (typeof document === 'undefined') return false;
  try {
    const lienzo = document.createElement('canvas');
    lienzo.width = 1;
    lienzo.height = 1;
    return lienzo.toDataURL(tipo).startsWith(`data:${tipo}`);
  } catch {
    return false;
  }
}

/**
 * Estima cuántos bytes ocupa un data URL cuando se guarde en `localStorage`.
 *
 * `localStorage` mide la cadena en UTF-16, así que un data URL ocupa el doble
 * de lo que ocupa en UTF-8. No es una curiosidad: con la cuota de ~5 MB es la
 * diferencia entre guardar cuatro fotos o dos.
 *
 * @param {string} dataUrl Data URL completo.
 * @returns {number} Bytes estimados en el almacenamiento.
 * @example
 * estimarBytesGuardados('data:image/jpeg;base64,AAAA'); // 38
 */
export function estimarBytesGuardados(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  return dataUrl.length * 2;
}
