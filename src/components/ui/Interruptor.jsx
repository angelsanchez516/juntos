/**
 * Componente `Interruptor`.
 *
 * RESPONSABILIDAD: el conmutador de "Solo favoritas" del planeador.
 *
 * Un `<input type="checkbox">` con estilos-appearance-none no es un interruptor
 * accesible: el papel que anuncia un lector de pantalla es "casilla", no
 * "interruptor", y el estado se anuncia como "marcada" en lugar de
 * "activado". Se implementa como `role="switch"` sobre un `button`, que es el
 * patrón que la especificación de ARIA define para esto.
 *
 * Related: src/pages/Planeador.jsx, src/utils/planeador.js
 *
 * @module components/ui/Interruptor
 */

/**
 * @typedef {object} InterruptorProps
 * @property {string} etiqueta Texto visible al lado del interruptor.
 * @property {boolean} [activado] Estado actual. Por defecto `false`.
 * @property {(valor: boolean) => void} onCambia Se llama con el valor nuevo.
 * @property {string} [id] Id del control, para poder etiquetarlo desde fuera.
 * @property {string} [className] Clases adicionales.
 */

/**
 * Renderiza un conmutador con etiqueta visible.
 *
 * @param {InterruptorProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Interruptor etiquetado.
 * @example
 * <Interruptor etiqueta="Solo favoritas" activado={false} onCambia={setSolo} />
 */
export default function Interruptor({
  etiqueta,
  activado = false,
  onCambia,
  id,
  className = '',
}) {
  /*
   * El texto de la etiqueta es hijo del propio `button` y no un `<label for>`.
   * Con un `<label>` exterior, un lector de pantalla anuncia la etiqueta y
   * además el estado del control, que es lo que se quiere; dentro del botón, el
   * nombre accesible incluye el estado y se anuncia una sola vez, sin el
   * "Interruptor, Solo favoritas, presionado" de tres golpes.
   */
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={activado}
      onClick={() => onCambia(!activado)}
      className={[
        'inline-flex items-center gap-2.5 rounded-pill text-sm text-slate-300',
        'transition-colors hover:text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/*
        La "pista" y el "botón" son dos `span` puramente decorativos: el estado
        real lo anuncia `aria-checked` del `button` que las envuelve. Si el
        botón interior fuera un elemento con estado propio, el lector de
        pantalla lo leería como un control anidado dentro de otro.
      */}
      <span
        aria-hidden="true"
        className={[
          'relative h-5 w-9 shrink-0 rounded-pill transition-colors',
          activado ? 'bg-accent' : 'bg-white/20',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-4 rounded-pill bg-white shadow-sm transition-transform',
            activado ? 'translate-x-4' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
      <span>{etiqueta}</span>
    </button>
  );
}
