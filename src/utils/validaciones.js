/**
 * Utilidades de validación y sanitización de "Juntos".
 *
 * RESPONSABILIDAD: única fuente de reglas de validación de entradas. La usan
 * los services (que rechazan datos inválidos) y los formularios (que muestran
 * los mensajes). Que ambos compartan este archivo evita que el formulario y la
 * capa de datos se desincronicen.
 *
 * TODO-FASE2 (SEGURIDAD): estas reglas deben replicarse OBLIGATORIAMENTE en el
 * servidor (Supabase / funciones edge con Zod). La validación del cliente es
 * solo para dar buena experiencia de usuario y NO es una frontera de
 * seguridad: cualquiera puede llamar al backend directamente saltándosela.
 *
 * Related: src/services/eventosService.js, src/services/citasService.js,
 * src/utils/categorias.js, src/types/models.js
 *
 * @module utils/validaciones
 */

import { esCategoriaIdeaValida, esCategoriaValida } from './categorias';
import { validarArchivoFoto as validarArchivoFotoInterna } from './imagen';

/** Longitudes máximas. Coinciden con los límites del contador del formulario. */
export const LIMITES = Object.freeze({
  TITULO: 120,
  DESCRIPCION: 500,
  LUGAR: 160,
});

/**
 * Expresiones regulares de validación.
 *
 * La de fecha valida estrictamente el formato `YYYY-MM-DD` y además que el día
 * exista en ese mes (rechaza "2026-02-31"). No comprobamos el calendario con
 * date-fns aquí para mantener este módulo sin dependencias de fecha.
 */
export const PATRONES = Object.freeze({
  // 4 dígitos, mes 01-12, día 01-31.
  FECHA: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
  // Hora en formato 24h, de "00:00" a "23:59".
  HORA: /^([01]\d|2[0-3]):[0-5]\d$/,
  // UUID v4 generado por crypto.randomUUID().
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  // URL http/https, para las fotos remotas.
  URL: /^https?:\/\/\S+$/i,
  // Marcador local de `public/img/`, para las fotos del seed. Deliberadamente
  // estrecha: prefijo `/img/`, un solo nombre de archivo y una extensión de la
  // lista. Con eso quedan fuera a propósito:
  // - `//sitio.com/foto.svg`: URL relativa al protocolo, carga de fuera.
  // - `javascript:...` y `data:text/html,...`: esquemas, no rutas.
  // - `..`: nadie sube por encima de `public/`, y el navegador lo normalizaría
  //   por su cuenta, pero aquí no se_normaliza nada.
  // - `/api/eventos.svg`: no está en `/img/`, así que no entra aunque la
  //   extensión parezca la de una imagen.
  // El SVG solo se pinta con `<img>`, donde el navegador no ejecuta su
  // contenido; aun así, la lista corta reduce la superficie a cero.
  RUTA_LOCAL_IMAGEN: /^\/img\/[a-z0-9-]+\.(?:svg|png|jpe?g|webp)$/i,
  // Data URL de imagen en base64, la que guardamos para las fotos subidas.
  DATA_URL_IMAGEN: /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/,
});

/**
 * Tipos MIME de imagen que aceptamos. Es una lista blanca: cualquier otro
 * tipo se rechaza, en lugar de intentar bloquear los peligrosos uno a uno.
 *
 * Se reexporta desde `utils/imagen.js` para no tener dos listas que se puedan
 * desincronizar. Si aquí se añadiera un formato, habría que añadirlo también
 * en las firmas de bytes, y ese desajuste es exactamente el tipo de fallo que
 * `categorias.js` ya sufrió una vez.
 *
 * @type {ReadonlyArray<string>}
 */
export { TIPOS_ACEPTADOS as TIPOS_IMAGEN_PERMITIDOS } from './imagen';

/**
 * Techo de tamaño de una foto. Reexportado desde `utils/imagen.js` por el
 * mismo motivo que la lista de tipos.
 *
 * @type {number}
 */
export { TAMANO_MAXIMO_BYTES as TAMANO_MAXIMO_IMAGEN_BYTES } from './imagen';

/**
 * Error de validación con detalle por campo.
 *
 * Lo lanza la función {@link validarEvento}. Los services la capturan y la
 * convierten en un mensaje para la UI.
 *
 * @extends Error
 */
export class ErrorValidacion extends Error {
  /**
   * @param {string} mensaje Mensaje general para la persona usuaria.
   * @param {Record<string, string>} [erroresPorCampo] Mapa campo → mensaje
   *   específico, para Pintar los inputs del formulario.
   */
  constructor(mensaje, erroresPorCampo = {}) {
    super(mensaje);
    this.name = 'ErrorValidacion';
    this.erroresPorCampo = erroresPorCampo;
  }
}

/**
 * Elimina caracteres de control y recorta los extremos de una cadena.
 *
 * SEGURIDAD: React escapa el contenido al renderizar, por lo que un `<script>`
 * en el título se mostraría como texto y no se ejecutaría. Este recorte es una
 * capa de limpieza adicional, no la defensa principal:
 *   - Nunca usamos `dangerouslySetInnerHTML` en la app (ver docs/SEGURIDAD.md).
 *   - La defensa real en Fase 2 es escapar en el servidor y sanitizar en origen.
 *
 * @param {unknown} valor Valor a limpiar. Solo se acepta una cadena.
 * @param {number} [maximo] Longitud máxima tras recortar.
 * @returns {string} Texto limpio, o cadena vacía si el valor no era texto.
 * @example
 * limpiarTexto('  Hola\u0000  ', 50); // 'Hola'
 * limpiarTexto(42);                   // ''
 */
export function limpiarTexto(valor, maximo = 500) {
  /*
   * Solo se acepta `string`. Con un `String(valor)` genérico, un objeto o un
   * número acabarían guardados como texto: `String({})` es "[object Object]", y
   * un campo que en la interfaz es un input de texto no debería poder
   * contener eso. Un valor que no sea texto se trata como campo vacío, que es
   * justo lo que acabaría haciendo la validación de Required más abajo.
   */
  if (typeof valor !== 'string') return '';

  return valor
    // Elimina caracteres de control ASCII, salvo el salto de línea y el
    // tabulador, que son válidos en una descripción.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    // El slice protege contra cadenas absurdamente largas aun cuando quien
    // llama se saltó la comprobación previa.
    .slice(0, maximo);
}

/**
 * Normaliza una fecha al formato `YYYY-MM-DD`.
 *
 * @param {Date|number|string} valor Fecha a formatear.
 * @returns {string} Fecha en `YYYY-MM-DD`, o `''` si la entrada es inválida.
 * @example
 * normalizarFecha(new Date(2026, 8, 12)); // '2026-09-12'
 */
export function normalizarFecha(valor) {
  const fecha = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return '';

  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Valida que una fecha exista de verdad en el calendario.
 *
 * `new Date('2026-02-31')` no da error: salta al 3 de marzo. Comparamos las
 * partes formateadas con la entrada para detectar ese desbordamiento.
 *
 * @param {string} fecha Fecha en `YYYY-MM-DD`.
 * @returns {boolean} `true` si la fecha es válida.
 * @example
 * esFechaValida('2026-02-31');  // false
 * esFechaValida('2026-02-28');  // true
 */
export function esFechaValida(fecha) {
  if (!PATRONES.FECHA.test(fecha)) return false;

  const [anio, mes, dia] = fecha.split('-').map(Number);
  const fechaReal = new Date(anio, mes - 1, dia);

  return (
    fechaReal.getFullYear() === anio &&
    fechaReal.getMonth() === mes - 1 &&
    fechaReal.getDate() === dia
  );
}

/**
 * Valida y limpia un evento recibido del formulario o del exterior.
 *
 * Comprueba campo a campo y lanza un único {@link ErrorValidacion} con todos
 * los errores detectados, para que el formulario pueda marcarlos a la vez en
 * lugar de corregir de uno en uno.
 *
 * SEGURIDAD: la longitud se recorta Y se valida. Recortar en silencio
 * aceptaría entradas abusivas; validar corta el dato y avisa a la UI. Se
 * eligió validar para que la persona usuaria sepa que su texto se truncó.
 *
 * @param {Partial<import('../types/models.js').Evento>} datos Evento a validar.
 * @returns {import('../types/models.js').Evento} Evento limpio y normalizado,
 *   listo para persistir.
 * @throws {ErrorValidacion} Si algún campo obligatorio falta o es inválido.
 * @example
 * try {
 *   const evento = validarEvento({ titulo: 'Cena', fecha: '2026-09-14' });
 * } catch (e) {
 *   console.error(e.erroresPorCampo); // { titulo: 'Es obligatorio' }
 * }
 */
export function validarEvento(datos) {
  const errores = {};
  const entrada = datos ?? {};

  // --- Título: obligatorio, 3 caracteres mínimos para que sea útil ---
  const titulo = limpiarTexto(entrada.titulo, LIMITES.TITULO + 1);
  if (!titulo) {
    errores.titulo = 'El título es obligatorio.';
  } else if (titulo.length > LIMITES.TITULO) {
    errores.titulo = `Máximo ${LIMITES.TITULO} caracteres.`;
  } else if (titulo.length < 3) {
    errores.titulo = 'Ponle al menos 3 caracteres.';
  }

  // --- Fecha: obligatoria y con formato ISOcalendar válido ---
  const fecha = typeof entrada.fecha === 'string' ? entrada.fecha.trim() : '';
  if (!fecha) {
    errores.fecha = 'La fecha es obligatoria.';
  } else if (!esFechaValida(fecha)) {
    errores.fecha = 'La fecha no es válida.';
  }

  // --- Hora: opcional, pero si viene debe tener formato 24h ---
  const horaCruda = entrada.hora ? String(entrada.hora).trim() : '';
  if (horaCruda && !PATRONES.HORA.test(horaCruda)) {
    errores.hora = 'La hora no es válida.';
  }

  // --- Descripción y lugar: opcionales, con largo acotado ---
  /*
   * Leemos UN carácter más del límite para poder distinguir "cabe
   * exactamente" de "se pasó". SiCalling a `limpiarTexto` con el límite
   * exacto, el recorte silencioso dejaría la cadena en 500 y la comparación
   * posterior nunca detectaría el exceso: la validación sería inútil.
   */
  const descripcion = limpiarTexto(entrada.descripcion, LIMITES.DESCRIPCION + 1);
  if (descripcion.length > LIMITES.DESCRIPCION) {
    errores.descripcion = `Máximo ${LIMITES.DESCRIPCION} caracteres.`;
  }

  const lugar = limpiarTexto(entrada.lugar, LIMITES.LUGAR + 1);
  if (lugar.length > LIMITES.LUGAR) {
    errores.lugar = `Máximo ${LIMITES.LUGAR} caracteres.`;
  }

  // --- Categoría: solo valores de la lista blanca ---
  const categoria = typeof entrada.categoria === 'string' ? entrada.categoria : '';
  if (!categoria) {
    errores.categoria = 'Elige una categoría.';
  } else if (!esCategoriaValida(categoria)) {
    errores.categoria = 'Categoría no válida.';
  }

  // --- Foto: opcional, URL http(s), ruta local o data URL de imagen permitida ---
  const fotoCruda = entrada.foto ? String(entrada.foto).trim() : '';
  if (
    fotoCruda &&
    !PATRONES.URL.test(fotoCruda) &&
    !PATRONES.RUTA_LOCAL_IMAGEN.test(fotoCruda) &&
    !PATRONES.DATA_URL_IMAGEN.test(fotoCruda)
  ) {
    errores.foto = 'La foto no es válida.';
  }

  if (Object.keys(errores).length > 0) {
    throw new ErrorValidacion('Revisa los campos del formulario.', errores);
  }

  return {
    titulo: titulo.slice(0, LIMITES.TITULO),
    fecha,
    hora: horaCruda || null,
    descripcion: descripcion.slice(0, LIMITES.DESCRIPCION),
    lugar: lugar.slice(0, LIMITES.LUGAR),
    categoria,
    foto: fotoCruda || null,
  };
}

/**
 * Valida y limpia una idea de cita.
 *
 * @param {Partial<import('../types/models.js').IdeaCita>} datos Idea a validar.
 * @returns {Omit<import('../types/models.js').IdeaCita, 'id'>} Idea limpia, sin
 *   `id` (lo asigna el service).
 * @throws {ErrorValidacion} Si algún campo obligatorio falta o es inválido.
 * @example
 * validarIdea({ titulo: 'Noche de cine', categoria: 'en-casa' });
 */
export function validarIdea(datos) {
  const errores = {};
  const entrada = datos ?? {};

  const titulo = limpiarTexto(entrada.titulo, LIMITES.TITULO + 1);
  if (!titulo) {
    errores.titulo = 'El título es obligatorio.';
  } else if (titulo.length > LIMITES.TITULO) {
    errores.titulo = `Máximo ${LIMITES.TITULO} caracteres.`;
  }

  // Igual que en `validarEvento`: leemos un carácter de más para poder
  // detectar el exceso en lugar de recortarlo en silencio.
  const descripcion = limpiarTexto(entrada.descripcion, LIMITES.DESCRIPCION + 1);
  if (descripcion.length > LIMITES.DESCRIPCION) {
    errores.descripcion = `Máximo ${LIMITES.DESCRIPCION} caracteres.`;
  }

  const categoria = typeof entrada.categoria === 'string' ? entrada.categoria : '';
  if (!categoria) {
    errores.categoria = 'Elige una categoría.';
  } else if (!esCategoriaIdeaValida(categoria)) {
    errores.categoria = 'Categoría no válida.';
  }

  const imagenCruda = entrada.imagen ? String(entrada.imagen).trim() : '';
  if (
    imagenCruda &&
    !PATRONES.URL.test(imagenCruda) &&
    !PATRONES.RUTA_LOCAL_IMAGEN.test(imagenCruda) &&
    !PATRONES.DATA_URL_IMAGEN.test(imagenCruda)
  ) {
    errores.imagen = 'La imagen no es válida.';
  }

  if (Object.keys(errores).length > 0) {
    throw new ErrorValidacion('Revisa los campos del formulario.', errores);
  }

  return {
    titulo: titulo.slice(0, LIMITES.TITULO),
    descripcion: descripcion.slice(0, LIMITES.DESCRIPCION),
    categoria,
    /*
     * `Boolean(...)` a secas es demasiado generoso: la cadena `"false"` es
     * truthy, así que un `favorita: "false"` tonto o un `favorita: "0"`
     * acababan marcados como favorita. Se acepta un booleano real o el valor
     * que devuelve un `<input type="checkbox">`.
     */
    favorita:
      entrada.favorita === true || entrada.favorita === 'true' || entrada.favorita === 1,
    imagen: imagenCruda || null,
  };
}

/**
 * Comprueba que un identificador tenga forma de UUID válido.
 *
 * SEGURIDAD: el `:id` de la ruta `/evento/:id` lo controla la persona usuaria.
 * Validarlo evita que un valor manipulado llegue a la capa de datos y, en
 * Fase 2, evita Attempts de acceso a registros ajenos.
 *
 * TODO-FASE2 (SEGURIDAD): la validación de forma NO sustituye la
 * autorización. El servidor debe comprobar que el evento pertenece a la pareja
 * de la sesión (RLS en Supabase) antes de devolverlo.
 *
 * @param {unknown} id Identificador a comprobar.
 * @returns {boolean} `true` si parece un UUID v4.
 * @example
 * esIdValido('9f1c...');  // true
 * esIdValido("1' OR 1=1"); // false
 */
export function esIdValido(id) {
  return typeof id === 'string' && PATRONES.UUID.test(id);
}

/**
 * Valida una foto antes de guardarla.
 *
 * DELEGACIÓN, NO COPIA. La implementación vive en `utils/imagen.js` y este
 * módulo la reexporta con el mismo nombre para no romper a quien ya la importa
 * desde aquí.
 *
 * Lo que se ganó al unificarlas: la versión que estaba en este archivo
 * comprobaba el tipo **declarado**, que es el campo que el navegador rellena a
 * partir de la extensión del nombre. Renombrar un `.html` con scripts a `.jpg`
 * lo convertía en un `image/jpeg` perfectamente válido y pasaba el filtro. La de
 * `utils/imagen.js` comprueba los bytes, que no se pueden falsificar, y además
 * comprueba el tamaño **antes** que nada, para no leer un archivo enorme solo
 * para rechazarlo.
 *
 * @param {File|{type: string, size: number, name?: string}} archivo Archivo
 *   seleccionado por la persona usuaria.
 * @returns {import('./imagen.js').ResultadoValidacionArchivo} Resultado con el
 *   motivo del rechazo y el tipo real detectado por los bytes.
 * @throws {never} No lanza: devuelve `{ valido: false, error }`.
 * @example
 * const { valido, error } = validarArchivoFoto(archivo);
 * if (!valido) mostrarError(error);
 */
export function validarArchivoFoto(archivo) {
  return validarArchivoFotoInterna(archivo);
}
