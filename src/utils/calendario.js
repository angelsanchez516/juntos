/**
 * Construcción de la cuadrícula del calendario.
 *
 * RESPONSABILIDAD: calcular, sin React y sin efectos secundarios, la disposición
 * de las celdas que forman un mes. Al ser una función pura se puede testear
 * directamente en Node, sin montar componentes ni usar un DOM.
 *
 * Related: src/utils/fechas.js (parseo y formateo), CalendarioMes.jsx, CeldaDia.jsx
 *
 * @module utils/calendario
 */

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import { DIAS_SEMANA_LARGOS, LOCALE, aFecha } from './fechas';

/**
 * Día de la semana en el que empieza la semana del calendario.
 *
 * `1` = lunes. Es lo que usa el mockup y el calendario habitual en Colombia.
 * Con `0` (domingo) las filas se desplazarían y la cabecera de días no
 * coincidiría con lo que la persona espera.
 *
 * @type {0|1|2|3|4|5|6}
 */
export const INICIO_SEMANA = 1;

/**
 * Máximo de eventos que se muestran dentro de una celda antes de colapsar el
 * resto en un "+N". Dos es lo que cabe en escritorio sin que el texto se
 * corte; en móvil se muestran solo puntos (ver {@link MAX_EVENTOS_MOVIL}).
 *
 * @type {number}
 */
export const MAX_EVENTOS_CELDA = 2;

/**
 * Máximo de puntos de color por celda en el calendario compacto de móvil.
 *
 * @type {number}
 */
export const MAX_EVENTOS_MOVIL = 4;

/**
 * Una celda del calendario.
 *
 * @typedef {object} Celda
 * @property {Date} fecha Objeto `Date` a medianoche local. Se usa para
 *   comparar por igualdad de día, nunca para parsear strings.
 * @property {string} fechaISO La misma fecha en `YYYY-MM-DD`, que es la clave
 *   con la que se buscan los eventos en el índice.
 * @property {number} dia Número de día del mes, para pintar.
 * @property {boolean} enMes `false` en los días de relleno del mes anterior y
 *   siguiente, que se muestran atenuados.
 * @property {boolean} esHoy Marca el día actual.
 * @property {boolean} seleccionado Marca el día que la persona ha elegido.
 * @property {number} indiceSemana Columna (0–6) dentro de la semana.
 * @property {number} indiceFila Fila (0–n) de la cuadrícula.
 * @property {import('../types/models.js').Evento[]} eventos Eventos de ese
 *   día, ya ordenados. Puede estar vacío.
 */

/**
 * Una semana de la cuadrícula.
 *
 * @typedef {object} Semana
 * @property {Celda[]} dias Siempre 7 celdas, de lunes a domingo.
 * @property {boolean} contieneHoy `true` si esa semana incluye el día actual.
 * @property {boolean} contieneMesVisible `true` si alguno de sus días pertenece
 *   al mes pedido. Sirve para atenuar las semanas enteramente de relleno.
 * @property {string} rango Rango legible para el encabezado, por ejemplo
 *   `"28 sep – 4 oct"`.
 */

/**
 * Cuadrícula completa de un mes.
 *
 * @typedef {object} Cuadricula
 * @property {Date} mes Mes pedido, normalizado al día 1.
 * @property {string} titulo Encabezado, por ejemplo `"Octubre 2026"`.
 * @property {Semana[]} semanas De 4 a 6 semanas, según el mes.
 * @property {Celda[]} celdas Todas las celdas aplanadas, útil para contar.
 * @property {number} totalSemanas Número de filas de la cuadrícula.
 */

/**
 * Normaliza cualquier fecha al día 1 del mes que la contiene.
 *
 * Quitar el día evita el desbordamiento al mover de mes: con el día 31, sumar
 * un mes a enero da el 3 de marzo en lugar del 1 de febrero.
 *
 * @param {Date} fecha Cualquier fecha del mes deseado.
 * @returns {Date} Primer día del mes a medianoche local.
 * @example
 * mesDesde(new Date(2026, 9, 17)); // Date(2026, 9, 1)
 */
export function mesDesde(fecha) {
  return startOfMonth(fecha);
}

/**
 * Construye la cuadrícula de celdas de un mes.
 *
 * POR QUÉ SEMIPRES 6 FILAS EN LA MAYORÍA DE MESES
 * La cuadrícula se extiende hasta completar la última semana, de modo que
 * October de 2026 (que empieza en jueves) necesita 5 filas, no 4. No fijamos 6
 * como en muchas librerías porque dejaría siempre dos semanas en blanco y
 * desperdiciaría espacio: el alto de la rejilla cambia al navegar, pero ese
 * salto ocurre por debajo del pliegue en móvil y es preferible a un hueco
 * permanente. Los meses que caben en 4 filas (como febrero de 2027) sí las
 * usan.
 *
 * ESTA FUNCIÓN ES PURA: mismos parámetros, mismo resultado. No lee el reloj, no
 * toca el DOM y no muta lo que recibe. La única lectura de "hoy" pasa por el
 * parámetro `fechaHoy`, para que en los tests se pueda fijar y comprobar el
 * comportamiento en un día concreto.
 *
 * @param {Date} mes Cualquier fecha dentro del mes a mostrar.
 * @param {Date} [fechaHoy] Fecha a considerar como "hoy". Por defecto, la
 *   fecha actual del sistema. Se pasa explícitamente en los tests.
 * @returns {Cuadricula} La cuadrícula del mes.
 * @example
 * const { semanas, titulo } = construirCuadricula(new Date(2026, 9, 1));
 * titulo;                                  // 'Octubre 2026'
 * semanas.length;                         // 5
 * semanas[0].dias.length;                  // 7
 * semanas[0].dias[0].fechaISO;             // '2026-09-28'
 */
export function construirCuadricula(mes, fechaHoy = new Date()) {
  const inicioMes = mesDesde(mes);
  const finMes = endOfMonth(inicioMes);

  /*
   * Recortamos la rejilla a las semanas completas que tocan el mes: la primera
   * empieza el lunes anterior al día 1 (o ese mismo día, si ya es lunes) y la
   * última termina el domingo posterior al último día.
   */
  const inicioRejilla = startOfWeek(inicioMes, {
    weekStartsOn: INICIO_SEMANA,
    locale: LOCALE,
  });
  const finRejilla = endOfWeek(finMes, {
    weekStartsOn: INICIO_SEMANA,
    locale: LOCALE,
  });

  const dias = eachDayOfInterval({ start: inicioRejilla, end: finRejilla });

  const celdas = dias.map((fecha, indice) => ({
    fecha,
    fechaISO: format(fecha, 'yyyy-MM-dd'),
    dia: fecha.getDate(),
    enMes: isSameMonth(fecha, inicioMes),
    esHoy: isSameDay(fecha, fechaHoy),
    seleccionado: false, // lo fija la UI, que es quien tiene el estado
    indiceSemana: indice % 7,
    indiceFila: Math.floor(indice / 7),
    eventos: [],
  }));

  const semanas = [];
  for (let f = 0; f < celdas.length; f += 7) {
    const diasSemana = celdas.slice(f, f + 7);
    semanas.push({
      dias: diasSemana,
      contieneHoy: diasSemana.some((celda) => celda.esHoy),
      contieneMesVisible: diasSemana.some((celda) => celda.enMes),
      rango: describirRango(diasSemana),
    });
  }

  return {
    mes: inicioMes,
    titulo: format(inicioMes, 'MMMM yyyy', { locale: LOCALE }),
    semanas,
    celdas,
    totalSemanas: semanas.length,
  };
}

/**
 * Describe el rango de fechas que cubre una semana, para el encabezado.
 *
 * Cuando la semana cae dentro de un solo mes ("29 – 5 oct" no aplica) se
 * muestra solo el mes del final, para no repetir texto innecesariamente.
 *
 * @param {Celda[]} dias Las 7 celdas de la semana.
 * @returns {string} Rango legible, por ejemplo `"28 sep – 4 oct"`.
 * @example
 * describirRango(semana); // '28 sep – 4 oct'
 */
function describirRango(dias) {
  const primero = dias[0].fecha;
  const ultimo = dias[dias.length - 1].fecha;

  if (primero.getMonth() === ultimo.getMonth()) {
    return `${primero.getDate()} – ${ultimo.getDate()} ${format(ultimo, 'MMM', { locale: LOCALE })}`;
  }

  return (
    `${format(primero, 'd MMM', { locale: LOCALE })} – ` +
    `${format(ultimo, 'd MMM', { locale: LOCALE })}`
  );
}

/**
 * Asigna los eventos a sus celdas y marca el día seleccionado.
 *
 * Se mantiene aparte de {@link construirCuadricula} para que esa función siga
 * siendo pura respecto a los datos: aquí es donde entran el índice de eventos
 * y el día elegido por la persona.
 *
 * @param {Cuadricula} cuadricula Cuadrícula sin eventos.
 * @param {Map<string, import('../types/models.js').Evento[]>} eventosPorFecha
 *   Índice fecha `YYYY-MM-DD` → eventos. Ver `useEventos().eventosPorFecha`.
 * @param {string} [fechaSeleccionada] Fecha `YYYY-MM-DD` del día elegido.
 * @returns {Cuadricula} Una cuadrícula nueva, con los eventos asignados.
 * @example
 * const conDatos = asignarEventos(cuadricula, eventosPorFecha, '2026-10-14');
 * conDatos.semanas[2].dias[2].eventos.length; // 1
 */
export function asignarEventos(cuadricula, eventosPorFecha, fechaSeleccionada = null) {
  const celdas = cuadricula.celdas.map((celda) => ({
    ...celda,
    eventos: eventosPorFecha.get(celda.fechaISO) ?? [],
    seleccionado: fechaSeleccionada === celda.fechaISO,
  }));

  // Índice fecha → celda, para reconstruir las semanas sin tener que buscarlas
  // una a una por posición.
  const porFecha = new Map(celdas.map((celda) => [celda.fechaISO, celda]));

  return {
    ...cuadricula,
    celdas,
    semanas: cuadricula.semanas.map((semana) => ({
      ...semana,
      dias: semana.dias.map((celda) => porFecha.get(celda.fechaISO) ?? celda),
    })),
  };
}

/**
 * Cuenta los eventos de un día y redacta su etiqueta accesible.
 *
 * El singular y el plural importan en un lector de pantalla: "1 evento" frente
 * a "3 eventos".
 *
 * @param {Celda} celda Celda con sus eventos ya asignados.
 * @returns {string} Etiqueta, por ejemplo `"12 de octubre, 1 evento"`.
 * @example
 * etiquetaCelda(celda); // '14 de octubre, 2 eventos'
 */
export function etiquetaCelda(celda) {
  const fecha = format(celda.fecha, "d 'de' MMMM", { locale: LOCALE });
  const total = celda.eventos.length;

  if (total === 0) return `${fecha}, sin eventos`;

  const detalle = total === 1 ? '1 evento' : `${total} eventos`;
  return `${fecha}, ${detalle}`;
}

/**
 * Devuelve los eventos de un día concreto de la cuadrícula.
 *
 * Se usa en móvil, donde la celda es demasiado pequeña para mostrar texto y los
 * eventos del día se listan debajo.
 *
 * @param {Cuadricula} cuadricula Cuadrícula con eventos asignados.
 * @param {string} fechaISO Fecha buscada en `YYYY-MM-DD`.
 * @returns {import('../types/models.js').Evento[]} Eventos de ese día, o `[]`.
 * @example
 * eventosDe(cuadricula, '2026-10-14'); // [evento, evento]
 */
export function eventosDe(cuadricula, fechaISO) {
  const celda = cuadricula.celdas.find((otra) => otra.fechaISO === fechaISO);
  return celda ? celda.eventos : [];
}

/**
 * Nombres de los días para la cabecera de columnas, empezando en lunes.
 *
 * @type {ReadonlyArray<string>}
 * @example
 * DIAS_ENCABEZADO; // ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
 */
export const DIAS_ENCABEZADO = Object.freeze([
  DIAS_SEMANA_LARGOS[1],
  DIAS_SEMANA_LARGOS[2],
  DIAS_SEMANA_LARGOS[3],
  DIAS_SEMANA_LARGOS[4],
  DIAS_SEMANA_LARGOS[5],
  DIAS_SEMANA_LARGOS[6],
  DIAS_SEMANA_LARGOS[0],
]);

/**
 * Nombres de los días abreviados para la cabecera, con la inicial en mayúscula.
 *
 * @type {ReadonlyArray<string>}
 * @example
 * DIAS_ENCABEZADO_CORTOS; // ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
 */
export const DIAS_ENCABEZADO_CORTOS = Object.freeze(
  DIAS_ENCABEZADO.map((dia) => dia.charAt(0).toUpperCase() + dia.slice(1, 3)),
);

/**
 * Suma o resta un mes a la fecha visible.
 *
 * @param {Date} mesActual Mes visible.
 * @param {number} delta Meses a mover. Positivo avanza, negativo retrocede.
 * @returns {Date} Nuevo mes, normalizado al día 1.
 * @example
 * moverMesCalendario(new Date(2026, 9, 1), -1); // Date(2026, 8, 1)
 */
export function moverMesCalendario(mesActual, delta) {
  // Se reconstruye con el día explícitamente en 1: con el día 31, sumar un mes
  // a enero desbordaría a marzo en vez de dar el 1 de febrero.
  return new Date(mesActual.getFullYear(), mesActual.getMonth() + delta, 1);
}

/**
 * Interpreta un parámetro de mes de la URL (`?mes=2026-10`).
 *
 * SEGURIDAD: el valor viene de la barra de direcciones, es decir, de la
 * persona usuaria. No se pasa nunca a `new Date(stringISO)`, que lo
 * interpretaría como UTC: en Bogotá (UTC-5) el 1 de octubre a las 00:00 UTC
 * es el 30 de septiembre a las 19:00 locales, y el calendario abriría en el
 * mes equivocado. Por eso se construye con números sueltos.
 *
 * @param {string|null} valor Texto del parámetro, con formato `AAAA-MM`.
 * @param {Date} [porDefecto] Mes a usar si el valor falta o es inválido. Por
 *   defecto, el mes actual.
 * @returns {Date} Primer día del mes solicitado.
 * @example
 * mesDesdeParametro('2026-10');  // Date(2026, 9, 1)
 * mesDesdeParametro('basura');  // el mes actual
 * mesDesdeParametro(null);      // el mes actual
 */
export function mesDesdeParametro(valor, porDefecto = new Date()) {
  if (typeof valor !== 'string') return mesDesde(porDefecto);

  const coincidencia = /^(\d{4})-(\d{1,2})$/.exec(valor.trim());
  if (!coincidencia) return mesDesde(porDefecto);

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);

  // El mes va de 1 a 12. Rechazamos antes de construir la fecha, porque
  // `new Date(2026, 13, 1)` daría enero del año siguiente sin avisar.
  if (mes < 1 || mes > 12) return mesDesde(porDefecto);
  if (anio < 1970 || anio > 3000) return mesDesde(porDefecto);

  return new Date(anio, mes - 1, 1);
}

/**
 * Serializa un mes al formato del parámetro de URL.
 *
 * @param {Date} mes Mes a serializar.
 * @returns {string} Texto `AAAA-MM`, listo para `?mes=`.
 * @example
 * mesAParametro(new Date(2026, 9, 1)); // '2026-10'
 */
export function mesAParametro(mes) {
  return format(mes, 'yyyy-MM');
}

/**
 * Traduce una fecha `YYYY-MM-DD` a `Date` local usando `aFecha`.
 *
 * Reexportado aquí para que los componentes del calendario tengan un único
 * punto de entrada y no unequeden a `new Date(fechaISO)` por error.
 *
 * @param {string} fechaISO Fecha en `YYYY-MM-DD`.
 * @returns {Date|null} Fecha local, o `null` si no es válida.
 * @example
 * aFechaLocal('2026-10-14').getDate(); // 14
 */
export function aFechaLocal(fechaISO) {
  return aFecha(fechaISO);
}
