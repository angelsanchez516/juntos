/**
 * Componente `ProximosEventos`.
 *
 * RESPONSABILIDAD: lista compacta de los próximos eventos, ordenada por
 * fecha. Se usa en Inicio y, más adelante, en el panel lateral del
 * calendario. Muestra la fecha, el título y el color de la categoría.
 *
 * Related: src/hooks/useEventos.js, src/utils/fechas.js
 *
 * @module components/eventos/ProximosEventos
 */

import { Link } from 'react-router-dom';
import { CalendarHeart, Clock } from 'lucide-react';
import Chip from '../ui/Chip';
import { obtenerCategoria } from '../../utils/categorias';
import { etiquetaRelativa, formatearFecha, formatearHora } from '../../utils/fechas';

/**
 * @typedef {object} ProximosEventosProps
 * @property {Array<import('../../types/models.js').Evento>} eventos Eventos ya
 *   filtrados y ordenados.
 * @property {string} [titulo] Encabezado de la lista. Por defecto
 *   `'Próximos eventos'`.
 * @property {number} [limite] Máximo de eventos a mostrar. Por defecto `5`.
 * @property {boolean} [mostrarVacio] Muestra un texto cuando no hay eventos.
 *   Por defecto `true`.
 */

/**
 * Renderiza la lista de próximos eventos.
 *
 * @param {ProximosEventosProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Lista de próximos eventos.
 * @example
 * <ProximosEventos eventos={eventos} limite={4} />
 */
export default function ProximosEventos({
  eventos,
  titulo = 'Próximos eventos',
  limite = 5,
  mostrarVacio = true,
}) {
  const visibles = eventos.slice(0, limite);

  return (
    <div className="rounded-card bg-surface p-5 text-slate-800 shadow-card">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <CalendarHeart className="size-4 text-accent" aria-hidden="true" />
        {titulo}
      </h2>

      {visibles.length === 0 ? (
        mostrarVacio && (
          <p className="mt-4 text-sm text-slate-500">
            No hay eventos programados. ¿Añadimos el primero?
          </p>
        )
      ) : (
        <ul className="mt-4 space-y-3">
          {visibles.map((evento) => {
            const categoria = obtenerCategoria(evento.categoria);
            const relativa = etiquetaRelativa(evento.fecha);

            return (
              <li key={evento.id}>
                {/*
                  El enlace completo es clicable para aprovechar toda el área
                  táctil, no solo el texto.
                */}
                <Link
                  to={`/evento/${evento.id}`}
                  className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-100"
                >
                  {/* Franja con el color de la categoría. */}
                  <span
                    className="mt-0.5 h-9 w-1 shrink-0 rounded-pill"
                    style={{ backgroundColor: categoria.hex }}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">
                        {evento.titulo}
                      </span>
                      {/*
                        La etiqueta relativa ("Hoy", "Mañana") solo aparece
                        cerca de la fecha actual; más allá es ruido.
                      */}
                      {relativa && (
                        <span className="shrink-0 text-[11px] font-semibold text-accent">
                          {relativa}
                        </span>
                      )}
                    </span>

                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{formatearFecha(evento.fecha)}</span>
                      {evento.hora && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          {formatearHora(evento.hora)}
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="hidden shrink-0 sm:block">
                    <Chip
                      label={categoria.label}
                      color={categoria.hex}
                      fondo={categoria.bg}
                    />
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
