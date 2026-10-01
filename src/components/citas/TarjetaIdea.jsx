/**
 * Componente `TarjetaIdea`.
 *
 * RESPONSABILIDAD: una idea de cita con su foto, su categoría, su descripción y
 * las tres acciones disponibles: marcar como favorita, editar y convertir en
 * evento.
 *
 * LAS ACCIONES DE EDITAR Y BORRAR SOLO APARECEN EN LAS IDEAS PROPIAS. Lo decide
 * `esIdeaEditable`, que mira el `origen`. Las del seed no se pueden tocar
 * porque borrarlas dejaría el planeador más vacío de lo que empezó y no hay
 * forma de recuperarlas. Se pueden marcar como favoritas, que es reversible.
 *
 * Related: src/pages/Planeador.jsx, src/utils/planeador.js, ImagenIdea.jsx
 *
 * @module components/citas/TarjetaIdea
 */

import { CalendarPlus, Heart, Pencil, Trash2 } from 'lucide-react';
import Chip from '../ui/Chip';
import ImagenIdea from './ImagenIdea';
import { obtenerCategoriaIdea } from '../../utils/categorias';
import { esIdeaEditable, etiquetaFavorita, recortarTitulo } from '../../utils/planeador';

/**
 * @typedef {object} TarjetaIdeaProps
 * @property {import('../../types/models.js').IdeaCita} idea Idea a pintar.
 * @property {() => void} onFavorita Alterna el corazón. Se llama sin argumentos:
 *   la tarjeta ya sabe qué idea es.
 * @property {() => void} [onEditar] Abre el formulario con esta idea. Solo se
 *   pinta si la idea es editable.
 * @property {() => void} [onBorrar] Pide confirmación para borrarla. Solo se
 *   pinta si la idea es editable.
 * @property {() => void} onConvertir Abre el formulario de evento con esta idea.
 * @property {boolean} [guardando] Si hay una escritura en curso. Deshabilita las
 *   acciones para impedir el doble clic.
 */

/**
 * Renderiza la tarjeta de una idea de cita.
 *
 * @param {TarjetaIdeaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Tarjeta de la idea.
 * @example
 * <TarjetaIdea idea={idea} onFavorita={marcar} onConvertir={convertir} />
 */
export default function TarjetaIdea({
  idea,
  onFavorita,
  onEditar,
  onBorrar,
  onConvertir,
  guardando = false,
}) {
  const editable = esIdeaEditable(idea);
  const categoria = obtenerCategoriaIdea(idea.categoria);

  return (
    <article
      className="flex flex-col overflow-hidden rounded-card bg-surface shadow-card"
      /*
       * `data-id` permite que las pruebas apunten a una tarjeta concreta sin
       * depender del texto, que cambia con el idioma o con el contenido.
       */
      data-id={idea.id}
    >
      <ImagenIdea
        imagen={idea.imagen}
        categoria={idea.categoria}
        alt={idea.titulo}
        className="h-36 w-full shrink-0"
      />

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-base font-semibold text-slate-900">
            {recortarTitulo(idea.titulo, 60)}
          </h3>

          {/*
            El corazón va primero en el orden de tabulación porque es la acción
            más usada y la única que no destruye nada: se pulsa mucho más que
            editar o borrar.
          */}
          <button
            type="button"
            onClick={onFavorita}
            disabled={guardando}
            aria-pressed={idea.favorita}
            aria-label={etiquetaFavorita(idea)}
            className="-mr-1 shrink-0 rounded-pill p-1.5 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {/*
              Relleno y `currentColor` en vez de un color fijo: el icono hereda
              el tono del botón, así que el corazón marcado se ve distinto sin
              una clase por estado.
            */}
            <HeartIcon marcada={idea.favorita} />
          </button>
        </div>

        {idea.descripcion && (
          <p className="line-clamp-3 text-sm text-slate-600">
            {idea.descripcion}
          </p>
        )}

        <Chip
          label={categoria.label}
          color={categoria.hex}
          fondo={categoria.bg}
          className="self-start"
        />

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {/*
            "Convertir" es la acción principal de una idea: es lo que hace útil
            el planeador. Va a la izquierda y es la más ancha.
          */}
          <button
            type="button"
            onClick={onConvertir}
            disabled={guardando}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-pill bg-accent px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
          >
            <CalendarPlus className="size-3.5" aria-hidden="true" />
            Convertir en evento
          </button>

          {editable && (
            <>
              <BotonIcono etiqueta={`Editar ${idea.titulo}`} onClick={onEditar} disabled={guardando}>
                <Pencil className="size-4" aria-hidden="true" />
              </BotonIcono>

              <BotonIcono
                etiqueta={`Borrar ${idea.titulo}`}
                onClick={onBorrar}
                disabled={guardando}
                peligro
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </BotonIcono>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * @typedef {object} BotonIconoProps
 * @property {import('react').ReactNode} children Icono del botón.
 * @property {string} etiqueta Texto accesible. El botón no tiene texto visible,
 *   así que sin esto un lector de pantalla anunciaría solo "botón".
 * @property {() => void} onClick Gestor del clic.
 * @property {boolean} [disabled] Desactiva el botón.
 * @property {boolean} [peligro] Tono rojo, para las acciones destructivas.
 */

/**
 * Botón cuadrado de solo icono, para acciones secundarias de la tarjeta.
 *
 * @param {BotonIconoProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Botón con icono.
 */
function BotonIcono({ children, etiqueta, onClick, disabled = false, peligro = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      className={[
        'shrink-0 rounded-pill p-2 transition-colors disabled:opacity-50',
        peligro
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * Corazón de la tarjeta, relleno si la idea es favorita.
 *
 * @param {{marcada: boolean}} props Propiedad `marcada`.
 * @returns {import('react').ReactElement} Icono del corazón.
 */
function HeartIcon({ marcada }) {
  const clase = [
    'size-5 transition-colors',
    marcada ? 'text-accent' : 'text-slate-400',
  ].join(' ');

  /*
   * `fill` va en el atributo y no en una clase aparte porque el color sale de
   * `currentColor`: así el relleno hereda el mismo color que el borde y solo hay
   * una fuente de verdad. Tailwind no tiene que generar nada para esto, así que
   * tampoco hay problema de clases purgadas.
   */
  return (
    <Heart
      className={clase}
      aria-hidden="true"
      fill={marcada ? 'currentColor' : 'none'}
    />
  );
}
