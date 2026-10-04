/**
 * Componente `CalendarioDia`.
 *
 * RESPONSABILIDAD: pintar un solo día con su navegación por días. Reutiliza
 * `EventosDelDia`, que es el panel que ya usaba el calendario mensual en móvil
 * para ver los eventos del día elegido: aquí deja de ser un recurso de móvil y
 * pasa a ser la vista entera, así que no se duplica la lista de eventos.
 *
 * Related: components/calendar/EventosDelDia.jsx, components/calendar/CalendarioSemana.jsx,
 * utils/calendario.js
 *
 * @module components/calendar/CalendarioDia
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Boton from '../ui/Boton';
import EventosDelDia from './EventosDelDia';

/**
 * @typedef {object} CalendarioDiaProps
 * @property {import('../../utils/calendario.js').Cuadricula} cuadricula Día, con
 *   los eventos ya asignados por `asignarEventos`.
 * @property {(delta: number) => void} onMoverDia Gestor de las flechas.
 * @property {() => void} onHoy Gestor del botón "Hoy".
 * @property {boolean} [esHoy] `true` si el día visible es el día en curso, para
 *   desactivar "Hoy". Por defecto `false`.
 */

/**
 * Renderiza un día con su navegación.
 *
 * @param {CalendarioDiaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Vista del día.
 * @example
 * <CalendarioDia cuadricula={dia} onMoverDia={mover} onHoy={irAHoy} />
 */
export default function CalendarioDia({ cuadricula, onMoverDia, onHoy, esHoy = false }) {
  const celda = cuadricula.celdas[0];

  return (
    <section
      className="rounded-card bg-surface p-4 shadow-card sm:p-5"
      aria-label={`Calendario, ${cuadricula.titulo}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Boton
            variante="secundario"
            soloIcono
            tamano="sm"
            ariaLabel="Día anterior"
            onClick={() => onMoverDia(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Boton>

          <Boton
            variante="secundario"
            soloIcono
            tamano="sm"
            ariaLabel="Día siguiente"
            onClick={() => onMoverDia(1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Boton>
        </div>

        {/*
          `capitalize` en la clase y no en el texto: la cadena que sale de
          `construirDia` es minúscula ("miércoles 14 de octubre"), como manda el
          español, y la mayúscula inicial la pone el estilo.
        */}
        <h2 className="font-display text-lg capitalize text-slate-900 sm:text-xl">
          {cuadricula.titulo}
        </h2>

        <Boton
          variante={esHoy ? 'fantasma' : 'secundario'}
          tamano="sm"
          onClick={onHoy}
          disabled={esHoy}
        >
          Hoy
        </Boton>
      </div>

      {/*
        `EventosDelDia` con `compacto` desactivado: en el calendario mensual se
        usaba la variante grande porque el panel aparecía bajo una rejilla ya
        apretada; aquí tiene todo el ancho y el texto se lee mejor con los
        tamaños normales.
      */}
      <EventosDelDia
        eventos={celda.eventos}
        fechaISO={celda.fechaISO}
        compacto={false}
      />
    </section>
  );
}
