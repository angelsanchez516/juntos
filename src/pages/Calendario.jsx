/**
 * Página `Calendario`.
 *
 * RESPONSABILIDAD: la vista mensual. Reúne la cuadrícula (pintada por
 * `CalendarioMes`), la leyenda de categorías, los eventos del día elegido y la
 * lista de próximos eventos.
 *
 * EL MES VIVE EN LA URL
 * El mes visible se guarda en `?mes=2026-10`. Sin esto, al abrir un evento y
 * volver con el navegador, el calendario aparecería siempre en el mes actual y
 * se perdería el contexto de dónde se estaba mirando. También hace que un mes
 * concreto se pueda compartir con un enlace.
 *
 * Related: components/calendar/CalendarioMes.jsx, utils/calendario.js
 *
 * @module pages/Calendario
 */

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarPlus } from 'lucide-react';

import CalendarioMes from '../components/calendar/CalendarioMes';
import EventosDelDia from '../components/calendar/EventosDelDia';
import ProximosEventos from '../components/eventos/ProximosEventos';
import EventoFormModal from '../components/eventos/EventoFormModal';
import Boton from '../components/ui/Boton';
import Chip from '../components/ui/Chip';
import { useEsEscritorio } from '../hooks/useMediaQuery';
import { useEventos } from '../hooks/useEventos';
import { CATEGORIAS_EVENTO, ORDEN_CATEGORIAS_EVENTO } from '../utils/categorias';
import {
  asignarEventos,
  construirCuadricula,
  eventosDe,
  mesAParametro,
  mesDesde,
  mesDesdeParametro,
  moverMesCalendario,
} from '../utils/calendario';
import { eventosProximos, hoyISO } from '../utils/fechas';

/**
 * Vistas disponibles. Solo "Mes" funciona en este paso.
 *
 * @type {ReadonlyArray<{clave: string, etiqueta: string, disponible: boolean}>}
 */
const VISTAS = Object.freeze([
  { clave: 'mes', etiqueta: 'Mes', disponible: true },
  { clave: 'semana', etiqueta: 'Semana', disponible: false },
  { clave: 'dia', etiqueta: 'Día', disponible: false },
]);

/**
 * Renderiza el calendario mensual.
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
   * El día seleccionado se guarda como texto `YYYY-MM-DD`. Se inicializa al
   * día de hoy para que la vista tenga contenido de entrada, pero solo cuando
   * ese día pertenece al mes visible: si se abre con `?mes=2026-10` estando en
   * septiembre, seleccionar el 30 de septiembre no diría nada en pantalla.
   */
  const [fechaSeleccionada, setFechaSeleccionada] = useState('');

  /** Estado del formulario: abierto, en edición y fecha de alta. */
  const [formulario, setFormulario] = useState({ abierto: false, evento: null, fecha: '' });

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
   * Cuadrícula del mes con los eventos ya asignados.
   *
   * Todo el cálculo está en `utils/calendario.js`; aquí solo se conecta con los
   * datos. Se memoriza porque `construirCuadricula` recorre hasta 42 fechas y
   * `asignarEventos` copia celdas: repetirlo en cada render se notaría al
   * navegar con el teclado.
   */
  const cuadricula = useMemo(
    () => asignarEventos(construirCuadricula(mes), eventosPorFecha, fechaSeleccionada || null),
    [mes, eventosPorFecha, fechaSeleccionada],
  );

  /**
   * Mes en curso, leído una sola vez al montar.
   *
   * Va en un `useState` con inicializador perezoso y no en un `useMemo` a
   * propósito: `new Date()` durante el render es una función impura, y el
   * resultado cambiaría a mitad de la vida del componente. La consecuencia
   * aceptable es que, si la página quedara abierta cruzando medianoche del día
   * 1, el botón "Hoy" no se reactivaría hasta recargar; se prefiere eso a un
   * valor que cambia bajo los pies del usuario.
   */
  const [mesEnCurso] = useState(() => mesAParametro(mesDesde(new Date())));

  /** `true` si el mes visible es el mes en curso, para desactivar "Hoy". */
  const esMesActual = mesAParametro(mes) === mesEnCurso;

  /**
   * Día resaltado: el seleccionado si pertenece al mes visible, si no el
   * primer día con eventos del mes, si no el día 1.
   */
  const diaResaltado = useMemo(() => {
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
  }, [fechaSeleccionada, cuadricula, mes]);

  const eventosDelDiaSeleccionado = useMemo(
    () => eventosDe(cuadricula, diaResaltado),
    [cuadricula, diaResaltado],
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
  const irAHoy = useCallback(() => {
    setParametros({});
  }, [setParametros]);

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
   * Al crear, el día Recién guardado pasa a quedar seleccionado: si alguien abre
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
            Selector de vista. "Semana" y "Día" quedan deshabilitados y
            aceptamos que así sea: una implementación a medias sería peor que
            un botón que explica que aún no existe. El `title` va en el
            envoltorio porque los botones deshabilitados no lanzan el tooltip
            en varios navegadores.
          */}
          <div className="flex rounded-pill bg-surface p-1 shadow-card">
            {VISTAS.map((vista) =>
              vista.disponible ? (
                <span
                  key={vista.clave}
                  className="rounded-pill bg-accent px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {vista.etiqueta}
                </span>
              ) : (
                <span key={vista.clave} title="Próximamente" className="contents">
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    disabled
                    ariaLabel={`${vista.etiqueta}, próximamente`}
                  >
                    {vista.etiqueta}
                  </Boton>
                </span>
              ),
            )}
          </div>

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
            <CalendarioMes
              cuadricula={cuadricula}
              compacto={!esEscritorio}
              onSelectDia={seleccionarDia}
              onVerRestoDelDia={seleccionarDia}
              onMoverMes={moverMes}
              onHoy={irAHoy}
              mesActual={esMesActual}
            />

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
