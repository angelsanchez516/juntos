/**
 * Utilidades de fechas de "Juntos".
 *
 * RESPONSABILIDAD:(parseo, formateo y comparación) de fechas, siempre con
 * `date-fns` y el locale español. Ningún componente debe formatear fechas a
 * mano ni usar `new Date('2026-09-14')` directamente.
 *
 * POR QUÉ NUNCA `new Date('AAAA-MM-DD')`
 * Ese string se interpreta como UTC, así que en zonas con offset negativo
 * (Colombia, UTC-5) `new Date('2026-09-14')` corresponde al 13 de septiembre a
 * las 19:00 locales, y `getDate()` devuelve 13. Es el error clásico de un día
 * de desfase en el calendario. Por eso en fechas ISO usamos
 * `parseISO` + comparaciones por cadena, no por `Date`.
 *
 * Related: src/data/seed.js, src/services/eventosService.js, componentes de
 * calendario, src/types/models.js
 *
 * @module utils/fechas
 */

import {
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  isToday,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';

import { es } from 'date-fns/locale';

/** Locale único de la app. Toda la interfaz está en español. */
export const LOCALE = es;

/** Etiquetas de los días, empezando en domingo como en el calendario español. */
export const DIAS_SEMANA = Object.freeze([
  'dom',
  'lun',
  'mar',
  'mié',
  'jue',
  'vie',
  'sáb',
]);

/** Etiquetas de los días para las cabeceras de la vista semanal. */
export const DIAS_SEMANA_LARGOS = Object.freeze([
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
]);

/**
 * Convierte un string `YYYY-MM-DD` en un `Date` a medianoche local.
 *
 * @param {string} fechaISO Fecha en formato `YYYY-MM-DD`.
 * @returns {Date|null} Fecha local, o `null` si el string no es válido.
 * @example
 * aFecha('2026-09-14').getDate(); // 14
 */
export function aFecha(fechaISO) {
  if (!fechaISO || typeof fechaISO !== 'string') return null;

  /*
   * `parseISO` sí interpreta la parte de fecha en hora local cuando el string
   * no incluye zona horaria, a diferencia del constructor `Date`.
   */
  const fecha = parseISO(fechaISO);
  return isValid(fecha) ? fecha : null;
}

/**
 * Formatea una fecha `YYYY-MM-DD` como texto en español.
 *
 * @param {string} fechaISO Fecha en formato `YYYY-MM-DD`.
 * @param {string} [patron] Patrón de `date-fns`. Por defecto `"d 'de' MMMM"`.
 * @returns {string} Texto formateado, o `'—'` si la fecha no es válida.
 * @example
 * formatearFecha('2026-09-14');              // '14 de septiembre'
 * formatearFecha('2026-09-14', 'EEEE d');    // 'lunes 14'
 */
export function formatearFecha(fechaISO, patron = "d 'de' MMMM") {
  const fecha = aFecha(fechaISO);
  if (!fecha) return '—';
  return format(fecha, patron, { locale: LOCALE });
}

/**
 * Formatea una hora `HH:mm` para mostrarla como "7:00 p. m.".
 *
 * @param {string|null} hora Hora en formato 24h `HH:mm`.
 * @returns {string} Hora en formato de 12 h, o `''` si no hay hora.
 * @example
 * formatearHora('19:00'); // '7:00 p. m.'
 * formatearHora(null);    // ''
 */
export function formatearHora(hora) {
  if (!hora || typeof hora !== 'string') return '';

  const [horas, minutos] = hora.split(':');
  if (horas === undefined || minutos === undefined) return '';

  return format(
    new Date(2000, 0, 1, Number(horas), Number(minutos)),
    'h:mm a',
    { locale: LOCALE },
  );
}

/**
 * Devuelve la fecha de hoy en formato `YYYY-MM-DD` (hora local).
 *
 * @returns {string} Fecha de hoy como `YYYY-MM-DD`.
 * @example
 * const hoy = hoyISO(); // '2026-09-29'
 */
export function hoyISO() {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Construye la fecha de un día concreto del mes actual, o del mes indicado.
 *
 * ESTA FUNCIÓN ES LA RAZÓN DE QUE EL SEED NO USE FECHAS FIJAS. El mockup se
 * diseñó en septiembre de 2025, pero si el seed codificara esas fechas, al
 * abrir la app en 2026 el calendario del mes actual saldría vacío y el panel
 * "Próximos eventos" no tendría nada que mostrar. Generando los días respecto
 * al mes en curso, los datos de ejemplo siempre caen donde la persona está
 * mirando.
 *
 * Si un día no existe en el mes pedido (31 en febrero), `date-fns` desborda al
 * mes siguiente; por eso hay que pedir siempre el mes actual o uno posterior.
 *
 * @param {number} dia Día del mes, de 1 a 31.
 * @param {number} [mesRelativo] Meses a avanzar desde el actual. `0` = mes
 *   actual (por defecto), `1` = siguiente.
 * @returns {string} Fecha en `YYYY-MM-DD`.
 * @example
 * diaDelMes(12);     // '2026-09-12' si estamos en septiembre de 2026
 * diaDelMes(14, 1);  // '2026-10-14' (octubre, para eventos futuros)
 */
export function diaDelMes(dia, mesRelativo = 0) {
  // `setMonth` sobre el día 1 evita que el desbordamiento de meses cortos
  // arrastre el día antes de tiempo.
  const mesBase = startOfMonth(new Date());
  const mesObjetivo = new Date(mesBase);
  mesObjetivo.setMonth(mesObjetivo.getMonth() + mesRelativo);

  return format(
    new Date(mesObjetivo.getFullYear(), mesObjetivo.getMonth(), dia),
    'yyyy-MM-dd',
  );
}

/**
 * Indica si una fecha pertenece al mes visible en el calendario.
 *
 * Se usa para atenuar los días del mes anterior y siguiente que se ven en la
 * cuadrícula. La cuadrícula en sí se construye en `src/utils/calendario.js`.
 *
 * @param {Date} fecha Fecha de la celda.
 * @param {Date} mes Mes visible.
 * @returns {boolean} `true` si la fecha está en el mes visible.
 * @example
 * esDelMesVisible(new Date(2026, 8, 30), new Date(2026, 8, 1)); // true
 */
export function esDelMesVisible(fecha, mes) {
  return (
    fecha.getMonth() === mes.getMonth() &&
    fecha.getFullYear() === mes.getFullYear()
  );
}

/**
 * Ordena eventos por fecha, y dentro del mismo día por hora.
 *
 * @param {Array<import('../types/models.js').Evento>} eventos Eventos a ordenar.
 * @returns {Array<import('../types/models.js').Evento>} Nuevo array ordenado.
 *   No muta el original.
 * @example
 * eventosOrdenados(eventos); // primero el 14, después el 19
 */
export function eventosOrdenados(eventos) {
  return [...eventos].sort((a, b) => {
    if (a.fecha === b.fecha) {
      /*
       * Un evento sin hora (todo el día) va primero: `''` o `null` se
       * comparan como cadena vacía, que ordena antes que cualquier hora.
       */
      const horaA = a.hora ?? '';
      const horaB = b.hora ?? '';
      if (horaA !== horaB) return horaA.localeCompare(horaB);
    }
    return a.fecha.localeCompare(b.fecha);
  });
}

/**
 * Filtra los eventos que aún no han pasado, en orden creciente.
 *
 * Un evento es "próximo" si su fecha es hoy o posterior. Comparamos por
 * cadena `YYYY-MM-DD` porque el orden lexicográfico coincide con el
 * cronológico en ese formato, y así evitamos por completo el desfase de zona
 * horaria descrito en la cabecera del módulo.
 *
 * @param {Array<import('../types/models.js').Evento>} eventos Eventos a filtrar.
 * @param {string} [desdeISO] Fecha límite inclusive. Por defecto, hoy.
 * @param {number} [limite] Máximo de resultados. Por defecto, todos.
 * @returns {Array<import('../types/models.js').Evento>} Próximos eventos.
 * @example
 * eventosProximos(eventos, undefined, 5); // los 5 más cercanos
 */
export function eventosProximos(eventos, desdeISO = hoyISO(), limite = Infinity) {
  const ordenados = eventosOrdenados(eventos);
  const futuros = ordenados.filter((evento) => evento.fecha >= desdeISO);
  return Number.isFinite(limite) ? futuros.slice(0, limite) : futuros;
}

/**
 * Agrupa los eventos por fecha `YYYY-MM-DD`.
 *
 * Es lo que necesita el calendario para pintar varios puntos en un mismo día.
 *
 * @param {Array<import('../types/models.js').Evento>} eventos Eventos a agrupar.
 * @returns {Map<string, Array<import('../types/models.js').Evento>>} Mapa de
 *   fecha → eventos de ese día.
 * @example
 * const porDia = agruparPorFecha(eventos);
 * porDia.get('2026-09-14')?.length; // 1
 */
export function agruparPorFecha(eventos) {
  const mapa = new Map();
  for (const evento of eventos) {
    const lista = mapa.get(evento.fecha);
    if (lista) lista.push(evento);
    else mapa.set(evento.fecha, [evento]);
  }
  return mapa;
}

/**
 * Traduce un día a una etiqueta relativa ("Hoy", "Mañana", "Ayer").
 *
 * @param {string} fechaISO Fecha a describir.
 * @returns {string} Etiqueta relativa, o `null` si está a más de una semana.
 * @example
 * etiquetaRelativa('2026-09-29'); // 'Hoy'
 */
export function etiquetaRelativa(fechaISO) {
  const fecha = aFecha(fechaISO);
  if (!fecha) return null;

  const dias = differenceInCalendarDays(fecha, new Date());

  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  // Solo etiquetamos la semana próxima; más allá no aporta información.
  if (dias > 1 && dias < 7) return `En ${dias} días`;
  return null;
}

/**
 * Indica si la fecha es hoy.
 *
 * @param {string} fechaISO Fecha a comprobar.
 * @returns {boolean} `true` si es el día actual.
 * @example
 * esHoy('2026-09-29'); // true
 */
export function esHoy(fechaISO) {
  const fecha = aFecha(fechaISO);
  return fecha ? isToday(fecha) : false;
}

/**
 * Indica si una fecha ya pasó respecto a hoy.
 *
 * @param {string} fechaISO Fecha a comprobar.
 * @returns {boolean} `true` si la fecha es anterior a hoy.
 * @example
 * estaPasada('2026-09-01'); // true
 */
export function estaPasada(fechaISO) {
  const fecha = aFecha(fechaISO);
  return fecha ? isBefore(startOfDay(fecha), startOfDay(new Date())) : false;
}

/**
 * Número de días que faltan para una fecha.
 *
 * @param {string} fechaISO Fecha destino.
 * @returns {number} Días hasta la fecha. Negativo si ya pasó.
 * @example
 * diasHasta('2026-10-01'); // 2
 */
export function diasHasta(fechaISO) {
  const fecha = aFecha(fechaISO);
  return fecha ? differenceInCalendarDays(fecha, new Date()) : 0;
}

/**
 * Indica si una fecha cae dentro de un intervalo cerrado.
 *
 * @param {Date} fecha Fecha a comprobar.
 * @param {Date} inicio Inicio del intervalo.
 * @param {Date} fin Fin del intervalo.
 * @returns {boolean} `true` si la fecha está dentro.
 * @example
 * estaEnRango(new Date(2026, 8, 14), new Date(2026, 8, 1), new Date(2026, 8, 31)); // true
 */
export function estaEnRango(fecha, inicio, fin) {
  return !isBefore(fecha, inicio) && !isAfter(fecha, fin);
}

/**
 * Agrupa una lista por mes natural y devuelve los grupos en orden descendente.
 *
 * La galería y la línea de tiempo muestran las fotos y los recuerdos bajo un
 * encabezado de mes ("Octubre de 2026"). El agrupado va aquí y no en cada
 * página por dos motivos: la clave del mes se compara como cadena
 * (`YYYY-MM`), que ordena cronológicamente sin parsear fechas, y así las dos
 * pantallas no pueden desincronizarse en el formato del encabezado.
 *
 * ORDEN DESCENDENTE A PROPÓSITO. Se agrupa desde la lista ya ordenada, y el
 * primer mes que se ve es el del primer elemento. La galería y los momentos
 * ordenan de más reciente a más antiguo, así que el orden se invierte aquí una
 * sola vez en lugar de en cada pantalla.
 *
 * NO SE USA UN `Map` PARA ITERAR. Insertar en un `Map` no garantiza el orden
 * salvo que se lean las claves e inserten de nuevo, que es el rodeo que hace
 * innecesaria la función. Se construye un array de grupos a mano, que además
 * obliga a decidir el orden de salida.
 *
 * @template {{fecha: string}} T Elementos con fecha ISO `YYYY-MM-DD`.
 * @param {ReadonlyArray<T>} elementos Elementos a agrupar.
 * @returns {ReadonlyArray<{clave: string, etiqueta: string, items: T[]}>} Grupos
 *   ordenados de mes más reciente a más antiguo.
 * @example
 * agruparPorMes([
 *   { fecha: '2026-10-14', titulo: 'Cena' },
 *   { fecha: '2026-09-02', titulo: 'Paseo' },
 * ])[0].etiqueta; // 'Octubre de 2026'
 */
export function agruparPorMes(elementos) {
  /** @type {Map<string, any[]>} */
  const porClave = new Map();

  for (const elemento of elementos) {
    // Una fecha inválida o ausente no debe crear un grupo "undefined" que
    // reviente al formatear. Se descarta: es preferible no enseñar la foto que
    // colgar la página.
    const clave = String(elemento?.fecha ?? '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(clave)) continue;

    const grupo = porClave.get(clave);
    if (grupo) grupo.push(elemento);
    else porClave.set(clave, [elemento]);
  }

  // Orden descendente por clave: "2026-10" > "2026-09" como cadena.
  return [...porClave.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((clave) => ({
      clave,
      etiqueta: etiquetaDeMes(clave),
      items: porClave.get(clave),
    }));
}

/**
 * Convierte una clave de mes `YYYY-MM` en su encabezado visible.
 *
 * El mes se lee en UTC a propósito. `parseISO('2026-10-01')` da medianoche
 * UTC, que en Colombia es el 30 de septiembre a las 19:00, y `format` con el
 * locale español devolvería "septiembre" para una clave de octubre. El día 1
 * de un mes es el único momento donde ese error de un día se nota, y por eso
 * se construye la fecha con los números sueltos.
 *
 * @param {string} clave Clave `YYYY-MM`.
 * @returns {string} Encabezado, por ejemplo "Octubre de 2026".
 * @example
 * etiquetaDeMes('2026-10'); // 'Octubre de 2026'
 */
export function etiquetaDeMes(clave) {
  const [anio, mes] = String(clave).split('-');
  const numero = Number(mes);
  if (!Number.isInteger(numero) || numero < 1 || numero > 12) return '';

  // Mes 1 en `new Date` es febrero: la API de `Date` cuenta desde cero.
  return format(new Date(Number(anio), numero - 1, 1), 'MMMM yyyy', { locale: es });
}

/** Reexporta `getDay` (índice de columna del día en la cuadrícula). */
export { getDay } from 'date-fns';
