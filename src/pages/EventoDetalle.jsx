/**
 * Página `EventoDetalle`.
 *
 * RESPONSABILIDAD: ficha completa de un evento, con foto, categoría, fecha,
 * hora, lugar y descripción, más las acciones de editar, eliminar y abrir en la
 * galería.
 *
 * VOLVER CONSERVA EL MES
 * El enlace "volver" lee `?mes=` de la URL, que es donde el calendario guarda el
 * mes visible. Sin esto, al abrir un evento de noviembre y volver, el calendario
 * aparecería en el mes actual y quien estaba mirando un mes concreto perdería
 * el sitio. Un enlace a `/calendario` a secas es un enlace a otro sitio distinto
 * al que se dejó.
 *
 * SEGURIDAD: el parámetro `:id` de la ruta llega de la persona usuaria y se usa
 * para buscar en el store local, así que se valida su formato antes de buscar.
 * Sin esa comprobación, un id manipulado se compararía contra cada evento sin
 * más consecuencias, pero en Fase 2 sería una petición a un registro arbitrario.
 * TODO-FASE2 (SEGURIDAD): con backend, la autorización por pareja debe
 * comprobarse en servidor; un id adivinado no puede devolver eventos ajenos.
 *
 * @module pages/EventoDetalle
 */

import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Images,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react';

import EventoFormModal from '../components/eventos/EventoFormModal';
import Boton from '../components/ui/Boton';
import Chip from '../components/ui/Chip';
import { useEventos } from '../hooks/useEventos';
import { RUTAS } from '../constants/nav';
import { obtenerCategoria } from '../utils/categorias';
import { esIdValido } from '../utils/validaciones';
import { formatearFecha, formatearHora } from '../utils/fechas';

/**
 * Estado de confirmación de borrado.
 *
 * No se usa `window.confirm()`: bloquea la vista, no se puede estilar y su
 * texto no se puede traducir con el resto de la interfaz. Además, en algunos
 * navegadores el evaluador automático de accesibilidad lo marca como error.
 *
 * @returns {import('react').ReactElement} Panel de confirmación.
 */
function ConfirmarBorrado({ evento, onCancelar, onConfirmar, guardando }) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="confirmar-borrado-titulo"
      aria-describedby="confirmar-borrado-texto"
      className="rounded-card border border-red-200 bg-red-50 p-4"
    >
      <h2 id="confirmar-borrado-titulo" className="text-sm font-semibold text-red-900">
        ¿Eliminar este evento?
      </h2>
      <p id="confirmar-borrado-texto" className="mt-1 text-sm text-red-800">
        Se va a borrar “{evento.titulo}”. Esto no se puede deshacer.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Boton variante="fantasma" tamano="sm" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton
          variante="primario"
          tamano="sm"
          cargando={guardando}
          onClick={onConfirmar}
          className="!bg-red-700 hover:!bg-red-800"
        >
          Sí, eliminar
        </Boton>
      </div>
    </div>
  );
}

/**
 * Renderiza el detalle de un evento.
 *
 * @returns {import('react').ReactElement} Página de detalle.
 * @example
 * <EventoDetalle />
 */
export default function EventoDetalle() {
  const { id } = useParams();
  const [parametros] = useSearchParams();
  const navegar = useNavigate();
  const { obtenerEvento, actualizar, eliminar, guardando, cargando } = useEventos();

  const [editando, setEditando] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  /** El id es válido como mucho si tiene forma de UUID. */
  const idValido = esIdValido(id);

  const evento = useMemo(() => (idValido ? obtenerEvento(id) : null), [id, idValido, obtenerEvento]);

  /**
   * Mes de vuelta, conservado desde la URL del calendario.
   *
   * @returns {string} Ruta del calendario con el mismo `?mes=`.
   */
  const volverA = useMemo(() => {
    const mes = parametros.get('mes');
    return mes ? `${RUTAS.CALENDARIO}?mes=${encodeURIComponent(mes)}` : RUTAS.CALENDARIO;
  }, [parametros]);

  /**
   * Guarda los cambios de la edición.
   *
   * @param {object} datos Evento validado.
   * @returns {Promise<void>} Termina cuando el evento está actualizado.
   */
  const guardarEdicion = useCallback(
    async (datos) => {
      await actualizar(id, datos);
      setEditando(false);
    },
    [actualizar, id],
  );

  /**
   * Borra el evento y vuelve al calendario.
   *
   * @returns {Promise<void>} Termina cuando el evento se ha borrado.
   */
  const confirmarBorrado = useCallback(async () => {
    await eliminar(id);
    navegar(volverA, { replace: true });
  }, [eliminar, id, navegar, volverA]);

  // Un id mal formado se trata igual que un id que no existe, y por el mismo
  // motivo: no se confirma nada sobre un registro que no se ha encontrado.
  if (!idValido || (!cargando && !evento)) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <h1 className="font-display text-2xl text-slate-900">No encontramos ese evento</h1>
        <p className="mt-2 text-sm text-slate-600">
          Puede que se haya borrado, o que el enlace no esté bien escrito.
        </p>
        <div className="mt-6 flex justify-center">
          <Link
            to={RUTAS.CALENDARIO}
            className="inline-flex items-center gap-2 rounded-pill bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver al calendario
          </Link>
        </div>
      </div>
    );
  }

  if (cargando) {
    return (
      <p className="rounded-card bg-surface p-8 text-center text-sm text-slate-500 shadow-card">
        Cargando el evento…
      </p>
    );
  }

  const categoria = obtenerCategoria(evento.categoria);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <nav aria-label="Ruta de navegación">
        <Link
          to={volverA}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al calendario
        </Link>
      </nav>

      <article className="overflow-hidden rounded-card bg-surface shadow-card">
        {evento.foto && (
          <img
            src={evento.foto}
            alt=""
            className="aspect-[16/9] w-full object-cover"
          />
        )}

        <div className="space-y-5 p-6">
          <header className="space-y-3">
            <div>
              <Chip label={categoria.label} color={categoria.hex} fondo={categoria.bg} />
            </div>
            <h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
              {evento.titulo}
            </h1>
          </header>

          {/*
            Los datos se agrupan en una lista de definición porque son pares de
            "etiqueta: valor" y no un flujo de texto suelto. Un lector de
            pantalla anuncia "Fecha, 14 de octubre" en lugar de leer la fecha
            sin contexto, que es como se pierde el sentido en un modal o en un
            formulario.
          */}
          <dl className="space-y-3 border-y border-slate-100 py-4">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Fecha
                </dt>
                <dd className="text-sm text-slate-900">
                  {formatearFecha(evento.fecha, "EEEE d 'de' MMMM")}
                  {evento.hora && ` · ${formatearHora(evento.hora)}`}
                </dd>
              </div>
            </div>

            {evento.lugar && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Lugar
                  </dt>
                  <dd className="text-sm text-slate-900">{evento.lugar}</dd>
                </div>
              </div>
            )}
          </dl>

          {evento.descripcion && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {evento.descripcion}
            </p>
          )}

          {confirmandoBorrado ? (
            <ConfirmarBorrado
              evento={evento}
              guardando={guardando}
              onCancelar={() => setConfirmandoBorrado(false)}
              onConfirmar={confirmarBorrado}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5">
              <Boton variante="primario" onClick={() => setEditando(true)}>
                <Pencil className="size-4" aria-hidden="true" />
                Editar
              </Boton>

              <Boton variante="fantasma" onClick={() => setConfirmandoBorrado(true)}>
                <Trash2 className="size-4" aria-hidden="true" />
                Eliminar
              </Boton>

              {/*
                Se lleva el id del evento en la URL de la galería para que la
                galería sepa a qué evento pertenece la foto y pueda mostrar su
                contexto, en vez de abrir en la galería a secas.
              */}
              <Link
                to={`${RUTAS.GALERIA}?evento=${encodeURIComponent(evento.id)}`}
                className="ml-auto inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Images className="size-4" aria-hidden="true" />
                Ver en la galería
              </Link>
            </div>
          )}
        </div>
      </article>

      {/*
        El formulario se reutiliza tal cual en modo edición. Es el mismo
        componente con los valores iniciales cargados, no una segunda versión
        del formulario: dos versiones acabarían divergiendo.
      */}
      <EventoFormModal
        abierto={editando}
        onCerrar={() => setEditando(false)}
        onGuardar={guardarEdicion}
        evento={evento}
        guardando={guardando}
      />
    </div>
  );
}
