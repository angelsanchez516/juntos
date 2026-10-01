/**
 * Componente `FiltrosIdeas`.
 *
 * RESPONSABILIDAD: la barra de filtros del planeador —categoría e interruptor
 * de "solo favoritas"— más el contador de lo que hay en pantalla.
 *
 * ESTE COMPONENTE NO GUARDA NADA. Avisa con `onCambio` y quien lo usa decide, en
 * este caso escribiendo en la URL. La razón es que el filtro vive en la URL:
 * un enlace a `?categoria=relax` tiene que abrir esa vista y el botón "Atrás"
 * tiene que deshacer el cambio. Si el chip guardara su propio estado, la URL
 * y la lista empezarían a discrepar en cuanto alguien pulsara atrás.
 *
 * Related: src/pages/Planeador.jsx, src/utils/planeador.js,
 * src/components/ui/Chip.jsx, src/components/ui/Interruptor.jsx
 *
 * @module components/citas/FiltrosIdeas
 */

import Chip from '../ui/Chip';
import Interruptor from '../ui/Interruptor';
import { obtenerCategoriaIdea, ORDEN_CATEGORIAS_IDEA } from '../../utils/categorias';
import { FILTRO_TODAS } from '../../utils/planeador';

/**
 * @typedef {object} FiltrosIdeasProps
 * @property {string} categoria Categoría activa, o {@link FILTRO_TODAS}.
 * @property {boolean} soloFavoritas Si solo se muestran las favoritas.
 * @property {number} countCuadra Cuántas ideas hay con los filtros activos.
 * @property {number} countTotal Cuántas hay sin filtrar.
 * @property {number} countFavoritas Cuántas son favoritas.
 * @property {(filtros: {categoria: string, soloFavoritas: boolean}) => void}
 *   onCambio Se llama con el filtro nuevo completo, no con la parte que cambió.
 *   Así quien lo usa no tiene que acordarse de conservar lo demás.
 * @property {() => void} onLimpiar Quita los dos filtros de golpe.
 * @property {boolean} [hayFiltros] `true` si hay algo que limpiar. Si no se
 *   pasa, se deduce de los propios valores.
 */

/**
 * Renderiza la barra de filtros de las ideas.
 *
 * @param {FiltrosIdeasProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Barra de filtros.
 * @example
 * <FiltrosIdeas
 *   categoria="relax"
 *   soloFavoritas={false}
 *   countCuadra={2}
 *   countTotal={5}
 *   countFavoritas={1}
 *   onCambio={aplicar}
 *   onLimpiar={limpiar}
 * />
 */
export default function FiltrosIdeas({
  categoria = FILTRO_TODAS,
  soloFavoritas = false,
  countCuadra,
  countTotal,
  countFavoritas,
  onCambio,
  onLimpiar,
  hayFiltros: hayFiltrosProp,
}) {
  const hayFiltros = hayFiltrosProp ?? (categoria !== FILTRO_TODAS || soloFavoritas);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/*
        El grupo de chips lleva `role="group"` y no un `role="tablist"`: no son
        pestañas y no cambian de panel, solo recortan la misma lista. Poner
        "tablist" haría que un lector de pantalla anunciara "pestaña" y prometiese
        un salto a otro panel que no existe.
      */}
      <div
        role="group"
        aria-label="Filtrar por categoría"
        className="flex flex-wrap items-center gap-2"
      >
        <Chip
          label="Todas"
          seleccionado={categoria === FILTRO_TODAS}
          onClick={() => onCambio({ categoria: FILTRO_TODAS, soloFavoritas })}
        />
        {ORDEN_CATEGORIAS_IDEA.map((clave) => {
          const info = obtenerCategoriaIdea(clave);
          return (
            <Chip
              key={clave}
              label={info.label}
              color={info.hex}
              fondo={info.bg}
              conMuestra
              seleccionado={categoria === clave}
              onClick={() => onCambio({ categoria: clave, soloFavoritas })}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Interruptor
          etiqueta="Solo favoritas"
          activado={soloFavoritas}
          onCambia={(valor) => onCambio({ categoria, soloFavoritas: valor })}
        />

        {hayFiltros && (
          <button
            type="button"
            onClick={onLimpiar}
            className="text-xs font-medium text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-800"
          >
            Quitar filtros
          </button>
        )}
      </div>

      {/*
        El contador se anuncia con `aria-live="polite"`: al cambiar un filtro,
        quien va con lector de pantalla oye cuántas ideas quedan sin tener que
        buscarlas. Con `assertive` se interrumpiría en cada pulsación de chip.
      */}
      <p aria-live="polite" className="sr-only">
        {`${countCuadra} de ${countTotal} ideas visibles. ${countFavoritas} favoritas.`}
      </p>
    </div>
  );
}
