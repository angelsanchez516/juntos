/**
 * Componente `EventosDelDia`.
 *
 * RESPONSABILIDAD: listar todos los eventos de un día concreto. En móvil es
 * la única forma de verlos, porque la celda es demasiado pequeña para el
 * texto; en escritorio aparece al elegir un día, y es a donde va el "+N más".
 *
 * Related: components/calendar/CeldaDia.jsx, components/eventos/ProximosEventos.jsx
 *
 * @module components/calendar/EventosDelDia
 */

import { Link } from 'react-router-dom';
import { CalendarPlus, Clock, MapPin } from 'lucide-react';
import Boton from '../ui/Boton';
import { obtenerCategoria } from '../../utils/categorias';
import { formatearFecha, formatearHora } from '../../utils/fechas';

/**
 * @typedef {object} EventosDelDiaProps
 * @property {Array<import('../../types/models.js').Evento>} eventos Eventos de
 *   ese día, ya ordenados.
 * @property {string} fechaISO Fecha `YYYY-MM-DD` del día, para el encabezado.
 * @property {() => void} [onAgregar] Gestor de "Agregar evento" en ese día.
 * @property {boolean} [compacto] Variante de móvil, con el texto más grande.
 *   Por defecto `false`.
 */

/**
 * Renderiza la lista de eventos de un día.
 *
 * @param {EventosDelDiaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Panel del día.
 * @example
 * <EventosDelDia eventos={eventos} fechaISO="2026-10-14" onAgregar={abrirModal} />
 */
export default function EventosDelDia({
  eventos,
  fechaISO,
  onAgregar,
  compacto = false,
}) {
  return (
    <section
      className="rounded-card bg-surface p-5 shadow-card"
      aria-label={`Eventos del ${formatearFecha(fechaISO)}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base capitalize text-slate-900">
          {formatearFecha(fechaISO)}
        </h2>

        {/*
          Crear desde el día es el atajo que hace útil la selección: la fecha
          ya viene puesta, así que en el paso d solo habrá que abrir el modal
          con ella precargada.
        */}
        {onAgregar && (
          <Boton variante="fantasma" tamano="sm" onClick={onAgregar}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            <span className={compacto ? '' : 'hidden sm:inline'}>Agregar</span>
          </Boton>
        )}
      </div>

      {eventos.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Este día está libre. ¿Lo usamos para algo?
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {eventos.map((evento) => {
            const categoria = obtenerCategoria(evento.categoria);

            return (
              <li key={evento.id}>
                <Link
                  to={`/evento/${evento.id}`}
                  className="-mx-2 flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-100"
                >
                  <span
                    className="mt-0.5 h-10 w-1 shrink-0 rounded-pill"
                    style={{ backgroundColor: categoria.hex }}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {evento.titulo}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      {evento.hora && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          {formatearHora(evento.hora)}
                        </span>
                      )}
                      {evento.lugar && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="size-3" aria-hidden="true" />
                          {evento.lugar}
                        </span>
                      )}
                      <span>{categoria.label}</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
