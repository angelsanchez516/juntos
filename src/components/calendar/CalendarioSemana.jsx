/**
 * Componente `CalendarioSemana`.
 *
 * RESPONSABILIDAD: pintar una semana en siete columnas, con los eventos de cada
 * día debajo de su fecha, y avisar de qué día se ha seleccionado. No sabe de
 * dónde vienen los eventos: recibe la semana ya construida con
 * `construirSemana` + `asignarEventos`, igual que `CalendarioMes`, de modo que
 * todo el cálculo queda en `src/utils/calendario.js`, fuera de React y testeable.
 *
 * POR QUÉ NO SE REUTILIZA `CeldaDia`
 * La celda del mes está optimizada para caber en una casilla pequeña: número
 * arriba y dos franjas con la hora. En la vista semanal cada día tiene una
 * columna entera, así que cabe el título del evento, y el texto es justo lo que
 * hace útil esta vista. Reutilizar la celda obligaría a recortar el contenido
 * para meterlo en una casilla que ya no es pequeña.
 *
 * Related: components/calendar/CalendarioDia.jsx, components/calendar/EventosDelDia.jsx,
 * utils/calendario.js
 *
 * @module components/calendar/CalendarioSemana
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import Boton from '../ui/Boton';
import { DIAS_ENCABEZADO, DIAS_ENCABEZADO_CORTOS, etiquetaCelda } from '../../utils/calendario';
import { obtenerCategoria } from '../../utils/categorias';
import { formatearHora } from '../../utils/fechas';

/**
 * @typedef {object} CalendarioSemanaProps
 * @property {import('../../utils/calendario.js').Cuadricula} cuadricula
 *   Semana, con los eventos ya asignados por `asignarEventos` y el día
 *   seleccionado marcado en la celda.
 * @property {() => void} onSelectDia Gestor al elegir un día.
 * @property {(delta: number) => void} onMoverSemana Gestor de las flechas.
 * @property {() => void} onHoy Gestor del botón "Hoy".
 * @property {boolean} [hoyEnSemana] `true` si la semana visible es la del día en
 *   curso, para desactivar "Hoy". Por defecto `false`.
 */

/**
 * Renderiza la semana con su navegación.
 *
 * @param {CalendarioSemanaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Semana del calendario.
 * @example
 * <CalendarioSemana
 *   cuadricula={semana}
 *   onSelectDia={elegirDia}
 *   onMoverSemana={mover}
 *   onHoy={irAHoy}
 * />
 */
export default function CalendarioSemana({
  cuadricula,
  onSelectDia,
  onMoverSemana,
  onHoy,
  hoyEnSemana = false,
}) {
  return (
    <section
      className="rounded-card bg-surface p-4 shadow-card sm:p-5"
      aria-label={`Calendario, semana del ${cuadricula.rango}`}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Boton
            variante="secundario"
            soloIcono
            tamano="sm"
            ariaLabel="Semana anterior"
            onClick={() => onMoverSemana(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Boton>

          <Boton
            variante="secundario"
            soloIcono
            tamano="sm"
            ariaLabel="Semana siguiente"
            onClick={() => onMoverSemana(1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Boton>
        </div>

        <h2 className="font-display text-lg capitalize text-slate-900 sm:text-xl">
          {cuadricula.titulo}
        </h2>

        <Boton
          variante={hoyEnSemana ? 'fantasma' : 'secundario'}
          tamano="sm"
          onClick={onHoy}
          disabled={hoyEnSemana}
        >
          Hoy
        </Boton>
      </div>

      {/*
        Las siete columnas se pintan siempre en el mismo orden, de lunes a
        domingo, y cada una busca su día por la fecha: si se confiara en el
        orden del array, un cambio en el orden de la cuadrícula mezclaría las
        columnas con las cabeceras.
      */}
      <div role="grid" className="grid grid-cols-7 gap-1 sm:gap-2">
        {cuadricula.celdas.map((celda) => (
          <ColumnaDia
            key={celda.fechaISO}
            celda={celda}
            nombre={DIAS_ENCABEZADO[celda.indiceSemana]}
            nombreCorto={DIAS_ENCABEZADO_CORTOS[celda.indiceSemana]}
            onSelect={onSelectDia}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * @typedef {object} ColumnaDiaProps
 * @property {import('../../utils/calendario.js').Celda} celda Día a pintar, con
 *   sus eventos ya asignados.
 * @property {string} nombre Nombre largo del día, para la cabecera.
 * @property {string} nombreCorto Abreviatura, para la cabecera en móvil.
 * @property {(fechaISO: string) => void} onSelect Gestor al elegir el día.
 */

/**
 * Una columna de la vista semanal: la cabecera del día y sus eventos.
 *
 * @param {ColumnaDiaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Columna del día.
 * @example
 * <ColumnaDia celda={celda} nombre="miércoles" nombreCorto="Mié" onSelect={elegir} />
 */
function ColumnaDia({ celda, nombre, nombreCorto, onSelect }) {
  const clases = [
    'flex min-w-0 flex-col gap-1 rounded-xl p-1.5 transition-colors sm:p-2',
    celda.seleccionado ? 'bg-accent/15 ring-2 ring-accent' : '',
    !celda.seleccionado && celda.esHoy ? 'bg-accent/5' : '',
    !celda.seleccionado && !celda.esHoy ? 'bg-slate-50' : '',
  ].join(' ');

  return (
    /*
     * `role="gridcell"` y no un `button`: la columna no es una acción, es un
     * grupo de enlaces. El botón va en la cabecera del día, que es lo que se
     * elige para ver ese día entero.
     */
    <div role="gridcell" className={clases}>
      <button
        type="button"
        onClick={() => onSelect(celda.fechaISO)}
        aria-pressed={celda.seleccionado}
        aria-label={etiquetaCelda(celda)}
        className="rounded-lg px-1 py-1 text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {/*
          El nombre del día va en `aria-hidden` porque el `aria-label` del botón
          ya dice la fecha completa y cuántos eventos hay: repetirlo haría que un
          lector de pantalla oyera "miércoles" y después "14 de octubre, 1
          evento". El nombre largo se queda en `title`, que aparece al pasar el
          ratón. En móvil no se ve: allí lo que cabe es la abreviatura corta, y
          la fecha completa la da el `aria-label`.
        */}
        <span
          aria-hidden="true"
          title={nombre}
          className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
        >
          <span className="sm:hidden">{nombreCorto.charAt(0)}</span>
          <span className="hidden sm:inline">{nombreCorto}</span>
        </span>
        <span
          aria-hidden="true"
          className={[
            'mx-auto mt-0.5 flex size-6 items-center justify-center rounded-pill text-xs',
            celda.esHoy ? 'bg-accent text-white' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {celda.dia}
        </span>
      </button>

      {celda.eventos.length === 0 ? (
        <span className="mt-1 text-[11px] text-slate-400 sm:text-xs">Libre</span>
      ) : (
        <ul className="mt-1 flex min-w-0 flex-col gap-1">
          {celda.eventos.map((evento) => {
            const categoria = obtenerCategoria(evento.categoria);

            return (
              <li key={evento.id} className="min-w-0">
                <Link
                  to={`/evento/${evento.id}`}
                  className="block min-w-0 rounded-lg px-1.5 py-1 transition-colors hover:brightness-95"
                  style={{ backgroundColor: categoria.bg, color: categoria.fg }}
                >
                  {evento.hora && (
                    <span className="block text-[10px] font-semibold leading-tight">
                      {formatearHora(evento.hora)}
                    </span>
                  )}
                  <span className="block text-[11px] font-medium leading-tight sm:text-xs">
                    {evento.titulo}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
