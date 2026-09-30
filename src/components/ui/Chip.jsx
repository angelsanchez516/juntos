/**
 * Componente `Chip`.
 *
 * RESPONSABILIDAD: la etiqueta de categoría o el filtro seleccionable. El
 * color lo aporta `src/utils/categorias.js` y se aplica con estilos en línea
 * porque Tailwind no genera clases construidas en tiempo de ejecución.
 * Ver la cabecera de utils/categorias.js para el porqué completo.
 *
 * Related: src/utils/categorias.js, Calendario, EventoFormModal, Planeador
 *
 * @module components/ui/Chip
 */

/**
 * @typedef {object} ChipProps
 * @property {string} [label] Texto visible. Obligatorio si no se pasa children.
 * @property {string} [color] Color principal en hexadecimal. Se usa para el
 *   punto y para el texto cuando `seleccionado` es `true`.
 * @property {string} [fondo] Color de fondo en hexadecimal.
 * @property {import('react').ComponentType<{className?: string}>} [Icon] Icono
 *   opcional a la izquierda.
 * @property {boolean} [seleccionado] Estado activo del filtro. Por defecto
 *   `false`.
 * @property {boolean} [soloPunto] Muestra únicamente el punto de color, sin
 *   texto. Se usa en el calendario compacto de móvil.
 * @property {boolean} [conMuestra] Punto de color delante del texto. Por
 *   defecto `true`.
 * @property {() => void} [onClick] Convierte el chip en botón seleccionable.
 * @property {string} [className] Clases adicionales.
 * @property {import('react').ReactNode} [children] Contenido alternativo.
 */

/**
 * Renderiza una etiqueta o filtro de categoría.
 *
 * @param {ChipProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Elemento de la etiqueta.
 * @example
 * <Chip label="Cita" color="#7B22CA" fondo="#F1F0FC" />
 */
export default function Chip({
  label,
  color,
  fondo,
  Icon,
  seleccionado = false,
  soloPunto = false,
  conMuestra = true,
  onClick,
  className = '',
  children,
}) {
  /*
   * Cuando el chip está activo invertimos el fondo y el texto, siguiendo el
   * mockup donde el chip "Todas" activo es el acento fuerte.
   */
  const estilo = seleccionado
    ? { backgroundColor: color, color: '#FFFFFF', borderColor: color }
    : { backgroundColor: fondo ?? 'transparent', color, borderColor: 'transparent' };

  const clases = [
    'inline-flex items-center rounded-pill text-xs font-medium transition-colors duration-150',
    soloPunto ? 'size-2' : 'gap-1.5 px-3 py-1.5',
    onClick ? 'cursor-pointer hover:opacity-80' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const contenido = (
    <>
      {/*
        El punto mantiene su propio color aunque el chip esté seleccionado, en
        cuyo caso el color de texto se ha invertido a blanco.
      */}
      {conMuestra && color && !soloPunto && (
        <span
          className="size-2 shrink-0 rounded-pill border"
          style={{
            backgroundColor: seleccionado ? '#FFFFFF' : color,
            borderColor: seleccionado ? '#FFFFFF' : color,
          }}
          aria-hidden="true"
        />
      )}
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      {children ?? label}
    </>
  );

  if (!onClick) return <span className={clases} style={estilo}>{contenido}</span>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={clases}
      style={estilo}
      aria-pressed={seleccionado}
    >
      {contenido}
    </button>
  );
}
