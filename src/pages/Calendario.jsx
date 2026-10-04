/**
 * Página `Calendario`.
 *
 * RESPONSABILIDAD: las tres vistas del calendario —mes, semana y día—, la leyenda
 * de categorías, los eventos del día elegido y la lista de próximos eventos.
 *
 * LA VISTA Y LA FECHA VIVEN EN LA URL
 * El mes visible se guarda en `?mes=2026-10` y las otras dos vistas en
 * `?vista=semana&fecha=2026-10-14`. Sin esto, al abrir un evento y volver con el
 * navegador, el calendario aparecería siempre en el mes actual y se perdería el
 * contexto de dónde se estaba mirando. También hace que un mes, una semana o un
 * día concretos se puedan compartir con un enlace.
 *
 * POR QUÉ UN SOLO CONMUTADOR Y TRES PARÁMETROS
 * La vista semanal y la diaria se anclan a un día, no a un mes: una semana
 * atraviesa dos meses a menudo, así que `?mes=` no puede representar "la semana
 * del 14". El conmutador escribe `?vista=` y, al salir de la vista de mes, el
 * día que se estaba mirando pasa a ser el ancla, para que cambiar de mes a
 * semana no dé un salto de mes.
 *
 * Related: components/calendar/CalendarioMes.jsx, components/calendar/CalendarioSemana.jsx,
 * components/calendar/CalendarioDia.jsx, utils/calendario.js
 *
 * @module pages/Calendario
 */

import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';

import CalendarioMes from '../components/calendar/CalendarioMes';
import CalendarioSemana from '../components/calendar/CalendarioSemana';
import CalendarioDia from '../components/calendar/CalendarioDia';
import EventosDelDia from '../components/calendar/EventosDelDia';
import ProximosEventos from '../components/eventos/ProximosEventos';
import EventoFormModal from '../components/eventos/EventoFormModal';
import Boton from '../components/ui/Boton';
import Chip from '../components/ui/Chip';
import { useEsEscritorio } from '../hooks/useMediaQuery';
import { useEventos } from '../hooks/useEventos';
import { CATEGORIAS_EVENTO, ORDEN_CATEGORIAS_EVENTO } from '../utils/categorias';
import {
  ETIQUETAS_VISTA,
  VISTA_DIA,
  VISTA_MES,
  VISTA_SEMANA,
  VISTAS,
  asignarEventos,
  construirCuadricula,
  construirDia,
  construirSemana,
  eventosDe,
  fechaAParametro,
  fechaDesdeParametro,
  mesAParametro,
  mesDesde,
  mesDesdeParametro,
  moverDiaCalendario,
  moverMesCalendario,
  moverSemanaCalendario,
  vistaDesdeParametro,
} from '../utils/calendario';
import { eventosProximos, hoyISO } from '../utils/fechas';
import { ahora } from '../utils/reloj';

/**
 * Decide qué día se resalta, sin leer nada de la página.
 *
 * Vive fuera del componente a propósito: son reglas de la cuadrícula, no estado
 * de React. En el componente, un `useMemo` que leyera `cuadricula` y cuyo
 * resultado usara el `useMemo` siguiente no se puede conservar -cada uno
 * invalidaría al otro-, y la página acabaría con dos resaltes que pueden no
 * coincidir.
 *
 * @param {string} vista Vista visible.
 * @param {import('../utils/calendario.js').Cuadricula} cuadricula Cuadrícula ya
 *   con los eventos asignados.
 * @param {string} fechaSeleccionada Día pulsado, o cadena vacía.
 * @param {Date} ancla Día al que apunta la URL.
 * @param {Date} mes Primer día del mes visible.
 * @returns {string} Fecha `YYYY-MM-DD` resaltada.
 */
function elegirDiaResaltado(vista, cuadricula, fechaSeleccionada, ancla, mes) {
  /*
   * En la vista de día el ancla es el único día, y en la semanal lo decide quien
   * pulse una columna. Si no se ha pulsado ninguna -que es lo normal al abrir-,
   * se resalta el propio ancla, que es lo que espera alguien que acaba de llegar
   * a esa semana desde la URL.
   */
  if (vista !== VISTA_MES) {
    const enEstaSemana = cuadricula.celdas.some((celda) => celda.fechaISO === fechaSeleccionada);

    return enEstaSemana ? fechaSeleccionada : fechaAParametro(ancla);
  }

  if (fechaSeleccionada) {
    const dentroDelMes = cuadricula.celdas.some(
      (celda) => celda.fechaISO === fechaSeleccionada && celda.enMes,
    );
    if (dentroDelMes) return fechaSeleccionada;
  }

  const primerConEventos = cuadricula.celdas.find(
    (celda) => celda.enMes && celda.eventos.length > 0,
  );

  return primerConEventos?.fechaISO ?? `${mesAParametro(mes)}-01`;
}

/**
 * Devuelve la cuadrícula con la celda del día resaltado marcada.
 *
 * `asignarEventos` solo marca lo que se ha pulsado, que al abrir no es nada. El
 * resaltado visible es `diaResaltado`, que además existe sin pulsación. Si el
 * marcado no lo tuviera en cuenta, el título del panel y la columna pintada
 * serían cosas distintas, y en la semanal se vería resaltada una columna
 * mientras el panel lateral enseñara otro día.
 *
 * @param {import('../utils/calendario.js').Cuadricula} cuadricula Cuadrícula con
 *   los eventos ya asignados.
 * @param {string} diaResaltado Fecha `YYYY-MM-DD` a marcar.
 * @returns {import('../utils/calendario.js').Cuadricula} Cuadrícula con la celda
 *   correspondiente marcada como seleccionada.
 */
function resaltarCuadricula(cuadricula, diaResaltado) {
  const dia = diaResaltado ?? '';

  return {
    ...cuadricula,
    celdas: cuadricula.celdas.map((celda) =>
      celda.seleccionado ? celda : { ...celda, seleccionado: celda.fechaISO === dia },
    ),
  };
}

/**
 * Renderiza el calendario en la vista que marque la URL.
 *
 * @returns {import('react').ReactElement} Página del calendario.
 * @example
 * <Calendario />
 */
export default function Calendario() {
  const [parametros, setParametros] = useSearchParams();
  const esEscritorio = useEsEscritorio();
  const { eventos, eventosPorFecha, cargando, error, crear, guardando } = useEventos();

  /*
   * El día seleccionado se guarda como texto `YYYY-MM-DD`.
   *
   * Empieza vacío a propósito. Elegir el día al montar daría un resultado
   * distinto cada vez que se abre la página, y en un calendario no tiene
   * sentido señalar un día sin que nadie lo haya pedido: quien abre la pantalla
   * quiere ver el mes, no un detalle cualquiera. El día
   * resaltado sale de `diaResaltado`, que cae en el primer día con eventos del
   * mes, así que el panel lateral nunca sale vacío sin motivo.
   */
  const [fechaSeleccionada, setFechaSeleccionada] = useState('');

  /** Estado del formulario: abierto, en edición y fecha de alta. */
  const [formulario, setFormulario] = useState({ abierto: false, evento: null, fecha: '' });

  /**
   * Vista visible, leída y validada de la URL.
   *
   * `vistaDesdeParametro` cae en "mes" si el valor no es una de las tres claves,
   * así que un `?vista=inventada` escrito a mano abre el calendario mensual en
   * lugar de una pantalla vacía.
   */
  const vista = useMemo(
    () => vistaDesdeParametro(parametros.get('vista')),
    [parametros],
  );

  /**
   * Mes visible, leído de la URL.
   *
   * `mesDesdeParametro` valida el texto y cae al mes actual si no es válido,
   * así que aquí no hace falta comprobar nada. Como devuelve un `Date` nuevo
   * en cada llamada, se memoriza para no reconstruir la cuadrícula en cada
   * render.
   */
  const mes = useMemo(
    () => mesDesdeParametro(parametros.get('mes')),
    [parametros],
  );

  /**
   * Día al que se anclan las vistas de semana y de día.
   *
   * Sin `?fecha=` cae al día en curso, que es lo que espera alguien que abre el
   * calendario sin parámetros.
   */
  const ancla = useMemo(
    () => fechaDesdeParametro(parametros.get('fecha')),
    [parametros],
  );

  /**
   * Cuadrícula de la vista activa, con los eventos ya asignados.
   *
   * Las tres vistas devuelven la misma forma desde `utils/calendario.js`, así que
   * el mismo `asignarEventos` sirve para las tres. Se memoriza porque
   * `construirCuadricula` recorre hasta 42 fechas y `asignarEventos` copia
   * celdas: repetirlo en cada render se notaría al navegar con el teclado.
   */
  const cuadricula = useMemo(() => {
    const base =
      vista === VISTA_SEMANA
        ? construirSemana(ancla)
        : vista === VISTA_DIA
          ? construirDia(ancla)
          : construirCuadricula(mes);

    return asignarEventos(base, eventosPorFecha, fechaSeleccionada || null);
  }, [vista, ancla, mes, eventosPorFecha, fechaSeleccionada]);

  /*
   * `asignarEventos` marca como seleccionada la celda de `fechaSeleccionada`, que
   * al abrir está vacía. El resaltado que se ve, sin embargo, es `diaResaltado`:
   * en la vista semanal y en la de día es el ancla, y en la mensual el primer día
   * con eventos. Si el marcado no lo tuviera en cuenta, el título del panel y la
   * columna pintada serían cosas distintas, y en la semanal se vería resaltada
   * una columna mientras el panel lateral enseñara otro día.
   *
   * Por eso el resaltado se aplica después de asignar los eventos, y no dentro
   * de `asignarEventos`: así la función pura no necesita saber qué día está
   * mirando quien la llama. Va declarado después de `diaResaltado`, del que
   * depende.
   */

  /**
   * Mes en curso, leído una sola vez al montar.
   *
   * Va en un `useState` con inicializador perezoso y no en un `useMemo` a
   * propósito: `ahora()` durante el render es una función impura, y el
   * resultado cambiaría a mitad de la vida del componente. La consecuencia
   * aceptable es que, si la página quedara abierta cruzando medianoche del día
   * 1, el botón "Hoy" no se reactivaría hasta recargar; se prefiere eso a un
   * valor que cambia bajo los pies del usuario.
   */
  const [mesEnCurso] = useState(() => mesAParametro(mesDesde(ahora())));

  /** `true` si el mes visible es el mes en curso, para desactivar "Hoy". */
  const esMesActual = mesAParametro(mes) === mesEnCurso;

  /**
   * Mes al que lleva el enlace "Mes", en formato `YYYY-MM`.
   *
   * En la vista de mes manda el mes visible, para que elegir "Mes" no salte a
   * otro mes. En las de semana y día manda el mes del día anclado, que es lo
   * que alguien espera ver al volver a la cuadrícula.
   */
  const mesDelAncla = mesAParametro(vista === VISTA_MES ? mes : ancla);

  /**
   * Dirección a la que lleva el conmutador para una vista concreta.
   *
   * Vive fuera del JSX para que el `Link` se lea como lo que es -un destino- y
   * no como tres niveles de condicional anidados.
   *
   * @param {string} clave Vista a la que se quiere saltar.
   * @returns {string} Ruta con sus parámetros.
   */
  const destinoVista = (clave) => {
    if (clave !== VISTA_MES) return `/calendario?vista=${clave}&fecha=${fechaAParametro(ancla)}`;
    if (mesDelAncla === mesEnCurso) return '/calendario';

    return `/calendario?mes=${mesDelAncla}`;
  };

  /**
   * Día resaltado.
   *
   * En las vistas de semana y de día es el día al que está anclada la vista, o
   * el que se haya pulsado si ese día pertenece a la semana que se está
   * mirando. En la vista de mes es el seleccionado si pertenece al mes visible,
   * si no el primer día con eventos, si no el día 1.
   */
  const diaResaltado = useMemo(
    () => elegirDiaResaltado(vista, cuadricula, fechaSeleccionada, ancla, mes),
    [vista, cuadricula, fechaSeleccionada, ancla, mes],
  );

  /** Cuadrícula con la celda del día resaltado marcada como seleccionada. */
  const cuadriculaResaltada = useMemo(
    () => resaltarCuadricula(cuadricula, diaResaltado),
    [cuadricula, diaResaltado],
  );

  /**
   * En la vista de día los eventos ya están dentro de `CalendarioDia`, así que
   * el panel lateral no los repetiría.
   */
  const eventosDelDiaSeleccionado = useMemo(
    () => (vista === VISTA_DIA ? [] : eventosDe(cuadriculaResaltada, diaResaltado)),
    [vista, cuadriculaResaltada, diaResaltado],
  );

  const proximos = useMemo(() => eventosProximos(eventos, hoyISO(), 5), [eventos]);

  /**
   * Cambia el mes visible escribiendo en la URL en vez de en un estado local.
   *
   * @param {number} delta Meses a mover.
   * @returns {void}
   */
  const moverMes = useCallback(
    (delta) => {
      setParametros({ mes: mesAParametro(moverMesCalendario(mes, delta)) });
    },
    [mes, setParametros],
  );

  /** Vuelve al mes en curso, quitando el parámetro de la URL. */
  const irAHoyMes = useCallback(() => {
    setParametros({});
  }, [setParametros]);

  /**
   * Avanza o retrocede en la vista semanal o diaria.
   *
   * En la semana el paso es de 7 días, y se calcula sobre el lunes de la semana
   * visible, no sobre el día resaltado: si se pulsara dos veces desde el miércoles
   * y una desde el domingo, las dos tienen que llevar a la misma semana.
   *
   * @param {number} delta Semanas o días a mover, según la vista.
   * @returns {void}
   */
  const moverPeriodo = useCallback(
    (delta) => {
      const destino =
        vista === VISTA_SEMANA
          ? moverSemanaCalendario(ancla, delta)
          : moverDiaCalendario(ancla, delta);

      setParametros({ vista, fecha: fechaAParametro(destino) });
    },
    [vista, ancla, setParametros],
  );

  /**
   * Vuelve al día en curso.
   *
   * En la vista de mes se quitan los parámetros, como antes: sin `?mes=` la
   * página abre en el mes actual. En las otras dos hay que dejar `?vista=` y
   * cambiar solo la fecha, o la vista volvería al mes.
   *
   * @returns {void}
   */
  const irAHoy = useCallback(() => {
    if (vista === VISTA_MES) setParametros({});
    else setParametros({ vista, fecha: hoyISO() });
  }, [vista, setParametros]);

  /**
   * Selecciona un día.
   *
   * @param {string} fechaISO Día elegido en `YYYY-MM-DD`.
   * @returns {void}
   */
  const seleccionarDia = useCallback((fechaISO) => {
    setFechaSeleccionada(fechaISO);
  }, []);

  /**
   * Abre el formulario de alta con la fecha de un día ya metida.
   *
   * La fecha se pasa desde el calendario, no desde "hoy": si alguien navega
   * hasta noviembre y pulsa el día 12, quiere el 12, no el 30 de septiembre.
   *
   * @param {string} fechaISO Fecha desde la que se quiere crear.
   * @returns {void}
   */
  const agregar = useCallback((fechaISO) => {
    setFormulario({ abierto: true, evento: null, fecha: fechaISO || '' });
  }, []);

  /** Cierra el formulario. */
  const cerrarFormulario = useCallback(() => {
    setFormulario({ abierto: false, evento: null, fecha: '' });
  }, []);

  /**
   * Guarda el evento del formulario.
   *
   * Al crear, el día recién guardado pasa a quedar seleccionado: si alguien abre
   * el formulario desde el 14, lo guarda y no ve nada cambiar, no tiene forma
   * de saber si funcionó. Seleccionando el día, el evento nuevo aparece en el
   * panel de abajo.
   *
   * @param {object} datos Evento ya validado.
   * @returns {Promise<void>} Termina cuando el evento está guardado.
   */
  const guardarEvento = useCallback(
    async (datos) => {
      await crear(datos);
      setFechaSeleccionada(datos.fecha);
      cerrarFormulario();
    },
    [crear, cerrarFormulario],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
            Calendario
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Elige un día para ver sus eventos. Toca uno vacío para añadir algo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/*
            Conmutador de vista. Los tres son `Link`, no `button`: la vista vive
            en la URL, así que tienen que ser navegación de verdad para que el
            botón "Atrás" del navegador y un enlace recibido por WhatsApp
            funcionen sin código que los escuche. `aria-current` marca cuál está
            activa, que es lo que anuncia el lector de pantalla.

            Cada enlace conserva el día que se estaba mirando. Al volver al mes
            se escribe `?mes=` con el mes del ancla, no el mes actual: si alguien
            estaba viendo noviembre en la vista de día y vuelve al mes, espera
            ver noviembre, no el mes de hoy. La excepción es el mes en curso, que
            se deja sin parámetros para que la dirección sea la que se comparte.
          */}
          <nav
            aria-label="Elegir la vista del calendario"
            className="flex rounded-pill bg-surface p-1 shadow-card"
          >
            {VISTAS.map((clave) => (
              <Link
                key={clave}
                to={destinoVista(clave)}
                aria-current={vista === clave ? 'page' : undefined}
                className={[
                  'rounded-pill px-3 py-1.5 text-xs font-semibold transition-colors',
                  vista === clave
                    ? 'bg-accent text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                ].join(' ')}
              >
                {ETIQUETAS_VISTA[clave]}
              </Link>
            ))}
          </nav>

          <Boton onClick={() => agregar(diaResaltado)}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            Agregar evento
          </Boton>
        </div>
      </header>

      {error && (
        <p role="alert" className="rounded-card bg-accent/10 px-4 py-3 text-sm text-slate-700">
          {error}
        </p>
      )}

      {cargando ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-slate-500 shadow-card">
          Cargando el calendario…
        </p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="space-y-5">
            {vista === VISTA_SEMANA ? (
              <CalendarioSemana
                cuadricula={cuadriculaResaltada}
                onSelectDia={seleccionarDia}
                onMoverSemana={moverPeriodo}
                onHoy={irAHoy}
                hoyEnSemana={cuadriculaResaltada.semanas[0].contieneHoy}
              />
            ) : vista === VISTA_DIA ? (
              <CalendarioDia
                cuadricula={cuadriculaResaltada}
                onMoverDia={moverPeriodo}
                onHoy={irAHoy}
                esHoy={cuadriculaResaltada.celdas[0].esHoy}
              />
            ) : (
              <CalendarioMes
                cuadricula={cuadriculaResaltada}
                compacto={!esEscritorio}
                onSelectDia={seleccionarDia}
                onVerRestoDelDia={seleccionarDia}
                onMoverMes={moverMes}
                onHoy={irAHoyMes}
                mesActual={esMesActual}
              />
            )}

            {/* Leyenda de categorías, como en el mockup. */}
            <section className="rounded-card bg-surface p-5 shadow-card">
              <h2 className="text-sm font-semibold text-slate-900">Categorías</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {ORDEN_CATEGORIAS_EVENTO.map((clave) => {
                  const categoria = CATEGORIAS_EVENTO[clave];
                  return (
                    <li key={clave}>
                      <Chip
                        label={categoria.label}
                        color={categoria.hex}
                        fondo={categoria.bg}
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {vista !== VISTA_DIA && (
            <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
              {/*
                Los eventos del día seleccionado.

                En escritorio van en la columna lateral, no debajo del calendario.
                Con la cuadrícula de 6 filas, el calendario mide unos 700 px: un
                panel colocado debajo quedaba por debajo del borde inferior de la
                ventana y había que hacer scroll para ver qué había en el día que
                se acababa de pulsar. Arriba, junto a la rejilla, el día
                seleccionado y su contenido se ven en la misma pantalla, que es de
                lo que se trata al elegir un día.

                En móvil sigue debajo, porque en una sola columna no hay sitio al
                lado y las celdas compactas solo muestran puntos de color: el
                panel es la única forma de ver los eventos del día.

                En la vista de día no se pinta: `CalendarioDia` ya los lista, y
                repetirlo sería ver lo mismo dos veces en la misma pantalla.
              */}
              <EventosDelDia
                eventos={eventosDelDiaSeleccionado}
                fechaISO={diaResaltado}
                onAgregar={agregar}
                compacto={!esEscritorio}
              />

              {/*
                Se reutiliza el mismo componente que Inicio, con su lista e
                íconos: duplicarla garantiza que las dos vistas se desincronicen
                en cuanto cambie el formato de una fecha.
              */}
              <ProximosEventos eventos={proximos} limite={5} />
            </aside>
          )}
        </div>
      )}

      <EventoFormModal
        abierto={formulario.abierto}
        onCerrar={cerrarFormulario}
        onGuardar={guardarEvento}
        evento={formulario.evento}
        fechaInicial={formulario.fecha}
        guardando={guardando}
      />
    </div>
  );
}
