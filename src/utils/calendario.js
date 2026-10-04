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
  addDays,
  addWeeks,
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
import { ahora } from './reloj';

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
 * Las vistas de semana y de día devuelven esta misma forma con una sola semana
 * (`totalSemanas: 1`), y en la de día con una sola celda. Es lo que permite que
 * `asignarEventos` y `eventosDe` sirvan para las tres sin duplicarse.
 *
 * @typedef {object} Cuadricula
 * @property {Date} mes Mes pedido, normalizado al día 1.
 * @property {string} titulo Encabezado, por ejemplo `"Octubre 2026"`. En la
 *   vista de día es el día completo, `"miércoles 14 de octubre"`.
 * @property {Semana[]} semanas De 4 a 6 semanas según el mes; exactamente una
 *   en las vistas de semana y de día.
 * @property {Celda[]} celdas Todas las celdas aplanadas, útil para contar.
 * @property {number} totalSemanas Número de filas de la cuadrícula.
 * @property {Date} [fecha] Día anclado a la vista. Solo lo rellenan las vistas de
 *   semana y de día, que son las que se navegan por `?fecha=`.
 * @property {string} [rango] Rango legible, por ejemplo `"12 – 18 oct"`. Solo lo
 *   rellenan las vistas de semana y de día.
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
 * parámetro `fechaHoy`, que por defecto es el reloj de `src/utils/reloj.js`, para
 * que en los tests se pueda fijar y comprobar el comportamiento en un día
 * concreto.
 *
 * @param {Date} mes Cualquier fecha dentro del mes a mostrar.
 * @param {Date} [fechaHoy] Fecha a considerar como "hoy". Por defecto, el reloj
 *   de la app. Se pasa explícitamente en los tests.
 * @returns {Cuadricula} La cuadrícula del mes.
 * @example
 * const { semanas, titulo } = construirCuadricula(new Date(2026, 9, 1));
 * titulo;                                  // 'Octubre 2026'
 * semanas.length;                         // 5
 * semanas[0].dias.length;                  // 7
 * semanas[0].dias[0].fechaISO;             // '2026-09-28'
 */
export function construirCuadricula(mes, fechaHoy = ahora()) {
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
 *   defecto, el del reloj de la app.
 * @returns {Date} Primer día del mes solicitado.
 * @example
 * mesDesdeParametro('2026-10');  // Date(2026, 9, 1)
 * mesDesdeParametro('basura');  // el mes del reloj
 * mesDesdeParametro(null);      // el mes del reloj
 */
export function mesDesdeParametro(valor, porDefecto = ahora()) {
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

/* ------------------------------------------------------------------ *
 * Vistas de semana y día.
 *
 * La URL es el estado de la vista, por el mismo motivo que en el Planeador: un
 * enlace con `?vista=semana` tiene que abrir esa vista, recargar tiene que
 * mantenerla y "Atrás" tiene que deshacer el cambio. Por eso hay un parámetro
 * `?vista=` con tres valores y no un `useState` en la página.
 *
 * Las dos vistas nuevas devuelven la MISMA forma que `construirCuadricula`, con
 * una sola semana y, en el día, una sola celda. Así `asignarEventos` y
 * `eventosDe` sirven igual para las tres vistas, sin un segundo asignador que
 * tendría que mantenerse en paralelo y acabaría divergiendo.
 * ------------------------------------------------------------------ */

/**
 * Vista mensual: la cuadrícula completa de un mes.
 *
 * @type {'mes'}
 */
export const VISTA_MES = 'mes';

/**
 * Vista semanal: una sola semana de lunes a domingo.
 *
 * @type {'semana'}
 */
export const VISTA_SEMANA = 'semana';

/**
 * Vista diaria: un solo día.
 *
 * @type {'dia'}
 */
export const VISTA_DIA = 'dia';

/**
 * Las tres vistas, en el orden en que se pintan.
 *
 * @type {ReadonlyArray<'mes'|'semana'|'dia'>}
 * @example
 * VISTAS; // ['mes', 'semana', 'dia']
 */
export const VISTAS = Object.freeze([VISTA_MES, VISTA_SEMANA, VISTA_DIA]);

/**
 * Etiqueta de cada vista, para el conmutador.
 *
 * @type {Readonly<Record<string, string>>}
 * @example
 * ETIQUETAS_VISTA[VISTA_SEMANA]; // 'Semana'
 */
export const ETIQUETAS_VISTA = Object.freeze({
  [VISTA_MES]: 'Mes',
  [VISTA_SEMANA]: 'Semana',
  [VISTA_DIA]: 'Día',
});

/**
 * Valida el valor de `?vista=`.
 *
 * Rechaza cualquier cosa que no sea una de las tres claves, en vez de dejar que
 * llegue a la página: un `?vista=semman` escrito a mano tiene que abrir el
 * calendario mensual, no una pantalla en blanco.
 *
 * @param {string|null} [valor] Valor leído de la URL.
 * @param {string} [porDefecto] Vista a usar si el valor no vale. Por defecto,
 *   `mes`.
 * @returns {string} Una de las tres claves de vista.
 * @example
 * vistaDesdeParametro('semana'); // 'semana'
 * vistaDesdeParametro('cualquier cosa'); // 'mes'
 */
export function vistaDesdeParametro(valor, porDefecto = VISTA_MES) {
  return VISTAS.includes(valor) ? valor : porDefecto;
}

/**
 * Traduce `?fecha=YYYY-MM-DD` a `Date` local.
 *
 * Se construye con números sueltos en lugar de `parseISO` para no arrastrar el
 * desfase de zona horaria que el módulo de fechas explica: la fecha es un día
 * del calendario, no un instante.
 *
 * Además valida que el día exista en ese mes. `new Date(2027, 1, 30)` daría 2
 * de marzo sin avisar, y una URL con `2027-02-30` abriría un día que nadie
 * escribió. Para eso se reconstruye la fecha con el resultado y se compara: si
 * no coincide, el día no existe.
 *
 * @param {string|null} [valor] Valor leído de la URL.
 * @param {Date} [porDefecto] Fecha a usar si el valor no vale. Por defecto, hoy.
 * @returns {Date} Fecha local a medianoche, o la fecha por defecto.
 * @example
 * fechaDesdeParametro('2026-10-14').getDate(); // 14
 * fechaDesdeParametro('2027-02-30'); // la fecha por defecto, no el 2 de marzo
 */
export function fechaDesdeParametro(valor, porDefecto = ahora()) {
  if (typeof valor !== 'string') return porDefecto;

  const coincidencia = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(valor.trim());
  if (!coincidencia) return porDefecto;

  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return porDefecto;
  if (anio < 1970 || anio > 3000) return porDefecto;

  const fecha = new Date(anio, mes - 1, dia);

  // El desbordamiento es la única forma de que el día no exista en ese mes.
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return porDefecto;
  }

  return fecha;
}

/**
 * Serializa una fecha al formato del parámetro de URL.
 *
 * @param {Date} fecha Fecha a serializar.
 * @returns {string} Texto `AAAA-MM-DD`, listo para `?fecha=`.
 * @example
 * fechaAParametro(new Date(2026, 9, 14)); // '2026-10-14'
 */
export function fechaAParametro(fecha) {
  return format(fecha, 'yyyy-MM-dd');
}

/**
 * Construye una celda de día con la forma que espera `asignarEventos`.
 *
 * @param {Date} fecha Día a describir.
 * @param {Date} fechaHoy Fecha a considerar como "hoy".
 * @param {number} indiceSemana Columna (0–6) dentro de la semana.
 * @returns {Celda} Celda sin eventos y sin seleccionar.
 */
function celdaDe(fecha, fechaHoy, indiceSemana) {
  return {
    fecha,
    fechaISO: format(fecha, 'yyyy-MM-dd'),
    dia: fecha.getDate(),
    // En la vista de semana y en la de día no hay relleno: todos los días
    // mostrados pertenecen al período visible, así que ninguno se atenúa.
    enMes: true,
    esHoy: isSameDay(fecha, fechaHoy),
    seleccionado: false,
    indiceSemana,
    indiceFila: 0,
    eventos: [],
  };
}

/**
 * Construye la semana que contiene una fecha.
 *
 * ESTA FUNCIÓN ES PURA, como {@link construirCuadricula}: no lee el reloj fuera
 * del parámetro `fechaHoy` y no muta lo que recibe. Devuelve la misma forma que
 * una cuadrícula con una sola fila, para que `asignarEventos` sirva igual.
 *
 * @param {Date} fecha Cualquier día de la semana a mostrar. No hace falta que
 *   sea lunes: se normaliza al lunes de esa semana.
 * @param {Date} [fechaHoy] Fecha a considerar como "hoy". Por defecto, el reloj
 *   de la app.
 * @returns {Cuadricula} Cuadrícula de una sola semana.
 * @example
 * const semana = construirSemana(new Date(2026, 9, 14));
 * semana.celdas.length;                  // 7
 * semana.celdas[0].fechaISO;             // '2026-10-12', el lunes
 * semana.celdas[6].fechaISO;             // '2026-10-18', el domingo
 * semana.titulo;                         // '12 – 18 oct'
 */
export function construirSemana(fecha, fechaHoy = ahora()) {
  const inicio = startOfWeek(fecha, { weekStartsOn: INICIO_SEMANA, locale: LOCALE });
  const fin = endOfWeek(fecha, { weekStartsOn: INICIO_SEMANA, locale: LOCALE });

  const celdas = eachDayOfInterval({ start: inicio, end: fin }).map((dia, indice) =>
    celdaDe(dia, fechaHoy, indice),
  );

  const rango = describirRango(celdas);

  return {
    mes: inicio,
    fecha: inicio,
    titulo: rango,
    rango,
    semanas: [
      {
        dias: celdas,
        contieneHoy: celdas.some((celda) => celda.esHoy),
        contieneMesVisible: true,
        rango,
      },
    ],
    celdas,
    totalSemanas: 1,
  };
}

/**
 * Construye la vista de un solo día.
 *
 * Igual que {@link construirSemana}, devuelve la forma de una cuadrícula con una
 * sola celda, para que el asignador de eventos y el resto del calendario no
 * tengan que distinguir entre las tres vistas.
 *
 * @param {Date} fecha Día a mostrar.
 * @param {Date} [fechaHoy] Fecha a considerar como "hoy". Por defecto, el reloj
 *   de la app.
 * @returns {Cuadricula} Cuadrícula de una sola celda.
 * @example
 * const dia = construirDia(new Date(2026, 9, 14));
 * dia.celdas.length;      // 1
 * dia.celdas[0].dia;      // 14
 * dia.titulo;             // 'miércoles 14 de octubre'
 */
export function construirDia(fecha, fechaHoy = ahora()) {
  const celdas = [celdaDe(fecha, fechaHoy, fecha.getDay() === 0 ? 6 : fecha.getDay() - 1)];
  const titulo = format(fecha, "EEEE d 'de' MMMM", { locale: LOCALE });

  return {
    mes: fecha,
    fecha,
    titulo,
    rango: titulo,
    semanas: [
      {
        dias: celdas,
        contieneHoy: celdas[0].esHoy,
        contieneMesVisible: true,
        rango: titulo,
      },
    ],
    celdas,
    totalSemanas: 1,
  };
}

/**
 * Mueve la fecha visible una cantidad de días.
 *
 * Sirve tanto para la vista de día (un paso de 1) como para la de semana (un
 * paso de 7).
 *
 * Usa `addDays` y no sumar al campo `getDate()`. Los dos resuelven el
 * desbordamiento de fin de mes, así que la diferencia no está en el
 * resultado: está en que `addDays` dice en una línea lo que hace, y no hay que
 * comprobar a mano que el 31 de enero con `setDate` acaba en febrero.
 *
 * @param {Date} fecha Fecha visible.
 * @param {number} delta Días a mover. Positivo avanza, negativo retrocede.
 * @returns {Date} La fecha desplazada.
 * @example
 * fechaAParametro(moverDiaCalendario(new Date(2026, 9, 14), 1)); // '2026-10-15'
 * fechaAParametro(moverDiaCalendario(new Date(2026, 9, 14), 7)); // '2026-10-21'
 */
export function moverDiaCalendario(fecha, delta) {
  return addDays(fecha, delta);
}

/**
 * Mueve la semana visible una cantidad de semanas.
 *
 * Se calcula sobre el lunes de la semana, no sobre el día que se tenía. Así da
 * igual pulsar "Semana siguiente" siete veces desde el miércoles que desde el
 * domingo: siempre se avanza de lunes a lunes.
 *
 * @param {Date} fecha Cualquier día de la semana visible.
 * @param {number} delta Semanas a mover. Positivo avanza, negativo retrocede.
 * @returns {Date} Lunes de la semana destino, a medianoche local.
 * @example
 * fechaAParametro(moverSemanaCalendario(new Date(2026, 9, 14), 1)); // '2026-10-19'
 * fechaAParametro(moverSemanaCalendario(new Date(2026, 9, 14), -1)); // '2026-10-05'
 */
export function moverSemanaCalendario(fecha, delta) {
  const inicio = startOfWeek(fecha, { weekStartsOn: INICIO_SEMANA, locale: LOCALE });
  return addWeeks(inicio, delta);
}

/**
 * Traduce una fecha `YYYY-MM-DD` a `Date` local usando `aFecha`.
 *
 * Reexportado aquí para que los componentes del calendario tengan un único
 * punto de entrada y no se confunda con `new Date(fechaISO)` por error.
 *
 * @param {string} fechaISO Fecha en `YYYY-MM-DD`.
 * @returns {Date|null} Fecha local, o `null` si no es válida.
 * @example
 * aFechaLocal('2026-10-14').getDate(); // 14
 */
export function aFechaLocal(fechaISO) {
  return aFecha(fechaISO);
}
