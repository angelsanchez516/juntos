/**
 * Componente `Boton`.
 *
 * RESPONSABILIDAD: abstraer el botón de la aplicación en variantes
 * (primario, secundario, fantasma) y tamaños, para que el acento rosa del
 * mockup se aplique siempre igual y no se disperse por los componentes.
 *
 * Related: src/components/ui/Modal.jsx, formularios de eventos e ideas
 *
 * @module components/ui/Boton
 */

/**
 * @typedef {object} BotonProps
 * @property {import('react').ReactNode} children Contenido del botón.
 * @property {'primario'|'secundario'|'fantasma'} [variante] Estilo visual.
 *   Por defecto `'primario'` (rosa de acento del mockup).
 * @property {'sm'|'md'|'lg'} [tamano] Alto del botón. Por defecto `'md'`.
 * @property {boolean} [cargando] Muestra un spinner y desactiva el botón.
 * @property {boolean} [soloIcono] Cuadra el botón para mostrar un único icono.
 * @property {string} [className] Clases adicionales.
 * @property {string} [tipo] Atributo `type` del botón. Por defecto `'button'`
 *   para no enviar formularios por accidente.
 * @property {boolean} [disabled] Desactiva la interacción.
 * @property {() => void} [onClick] Gestor del clic.
 * @property {string} [ariaLabel] Texto accesible cuando el botón solo lleva
 *   icono, donde el icono por sí solo no describe la acción.
 */

/** Clases por variante. Literales completas para que Tailwind las vea. */
const VARIANTES = {
  // Rosa de acento del mockup. El hover usa el tono `strong`.
  primario: 'bg-accent text-white hover:bg-accent-strong active:bg-accent-strong',
  // Para acciones secundarias sobre superficie clara, con borde suave.
  secundario:
    'bg-surface text-slate-700 border border-slate-200 hover:bg-slate-100 active:bg-slate-200',
  // Sin fondo: para acciones terciarias o iconos.
  fantasma: 'bg-transparent text-slate-300 hover:bg-white/10 active:bg-white/15',
};

const TAMANOS = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2',
};

const TAMANOS_SOLO_ICONO = {
  sm: 'size-9',
  md: 'size-11',
  lg: 'size-12',
};

/**
 * Renderiza un botón con la estética de la aplicación.
 *
 * @param {BotonProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Elemento `button`.
 * @example
 * <Boton variante="primario" onClick={abrirModal}>
 *   Agregar evento
 * </Boton>
 */
export default function Boton({
  children,
  variante = 'primario',
  tamano = 'md',
  cargando = false,
  soloIcono = false,
  className = '',
  tipo = 'button',
  disabled = false,
  onClick,
  ariaLabel,
  ...resto
}) {
  const inactivo = disabled || cargando;

  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={inactivo}
      aria-label={ariaLabel}
      aria-busy={cargando || undefined}
      className={[
        'inline-flex items-center justify-center rounded-pill font-medium',
        'transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTES[variante] ?? VARIANTES.primario,
        soloIcono
          ? (TAMANOS_SOLO_ICONO[tamano] ?? TAMANOS_SOLO_ICONO.md)
          : (TAMANOS[tamano] ?? TAMANOS.md),
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...resto}
    >
      {cargando && (
        <span
          className="size-4 animate-spin rounded-pill border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
