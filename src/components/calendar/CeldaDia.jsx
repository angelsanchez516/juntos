/**
 * Componente `CeldaDia`.
 *
 * RESPONSABILIDAD: un único día de la cuadrícula del calendario. Es un
 * `button` completo, con el área táctil entera activable y una etiqueta
 * accesible que anuncia la fecha y cuántos eventos hay, para que la
 * cuadrícula se pueda recorrer solo con teclado y con lector de pantalla.
 *
 * Related: components/calendar/CalendarioMes.jsx, utils/calendario.js
 *
 * @module components/calendar/CeldaDia
 */

import { MAX_EVENTOS_CELDA, MAX_EVENTOS_MOVIL, etiquetaCelda } from '../../utils/calendario';
import { obtenerCategoria } from '../../utils/categorias';
import { formatearHora } from '../../utils/fechas';

/**
 * @typedef {object} CeldaDiaProps
 * @property {import('../../utils/calendario.js').Celda} celda Día a pintar,
 *   con sus eventos ya asignados por `asignarEventos`.
 * @property {boolean} [compacto] Variante de móvil: solo el número y puntos de
 *   color, sin franjas ni texto. Por defecto `false`.
 * @property {() => void} onSelect Gestor al seleccionar el día.
 * @property {() => void} [onVerResto] Gestor del "+N más" de ese día. Si no se
 *   pasa y hay más de `MAX_EVENTOS_CELDA` eventos, no se muestra el enlace.
 */

/**
 * Renderiza una celda del calendario.
 *
 * La celda es siempre un `button`: así hereda el foco, responde a Enter y
 * Espacio, y los lectores de pantalla la anuncian como activable sin necesidad
 * de `tabindex` ni manejadores de teclado a mano.
 *
 * @param {CeldaDiaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Celda del día.
 * @example
 * <CeldaDia celda={celda} onSelect={() => setElegido(celda.fechaISO)} />
 */
export default function CeldaDia({ celda, compacto = false, onSelect, onVerResto }) {
  const { eventos, enMes, esHoy, seleccionado } = celda;
  const ocultos = Math.max(0, eventos.length - MAX_EVENTOS_CELDA);
  /*
   * El "+N más" solo se ofrece si hay más eventos de los que caben y quien
   * llama sabe abrirlos. En la variante compacta no cabe ni el texto.
   */
  const muestraMas = !compacto && ocultos > 0 && typeof onVerResto === 'function';

  /*
   * Clases de la celda. Se acumulan en una sola cadena porque las condiciones
   * (hoy, seleccionado, fuera de mes) pueden darse a la vez: un día de hoy
   * seleccionado y fuera del mes debe ganar la selección.
   */
  const clases = [
    'relative flex w-full flex-col items-stretch rounded-xl text-left transition-colors',
    compacto ? 'h-11 gap-0.5 p-1' : 'min-h-[4.5rem] gap-1 p-1.5',
    // Fuera del mes visible se atenúa, pero sigue siendo navegable y legible.
    enMes ? 'text-slate-800' : 'text-slate-300',
    esHoy ? 'font-bold' : '',
    // Anillo de foco visible: sin esto no se sabría dónde está el teclado.
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1',
  ];

  /*
   * Estados visuales del día. El orden importa: si un día está seleccionado y
   * además es hoy, gana la selección, porque es la que la persona acaba de
   * pulsar. Los dos estados tienen que seguir siendo distinguibles de un
   * vistazo:
   *
   * - Hoy: círculo rosa detrás del número, y un fondo apenas teñido.
   * - Seleccionado: anillo rosa de 2 px alrededor de toda la celda y un fondo
   *   más cargado. El anillo va en la celda entera, no en el número, así que
   *   no se confunde con el círculo de "hoy".
   */
  if (seleccionado) {
    clases.push('bg-accent/15 ring-2 ring-accent');
  } else if (esHoy) {
    clases.push('bg-accent/5');
  } else if (!enMes) {
    clases.push('bg-slate-50/60');
  } else {
    clases.push('hover:bg-slate-100');
  }

  return (
    /*
     * Envoltorio `div` con `relative`: sostiene el botón del día y, superpuesto
     * en la parte baja, el botón de "+N más".
     *
     * POR QUÉ NO VA DENTRO DEL BOTÓN DEL DÍA
     * No se puede anidar un `button` dentro de otro `button`: es HTML
     * inválido, los lectores de pantalla lo announces mal y el botón interno
     * no es alcanzable con el teclado. Por eso el "+N más" es hermano y se
     * posiciona encima. El botón del día deja hueco abajo con `pb-5` para que
     * no queden solapados.
     */
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        aria-label={etiquetaCelda(celda)}
        aria-pressed={seleccionado}
        className={clases.join(' ')}
      >
        {/*
          El número del día va en un `span` con círculo en el día actual, como
          en el mockup. `aria-hidden` porque el `aria-label` del botón ya dice
          la fecha completa: repetirlo sería ruido en el lector de pantalla.
        */}
        <span
          className={[
            'flex size-6 shrink-0 items-center justify-center rounded-pill text-xs',
            compacto ? 'mx-auto' : '',
            esHoy ? 'bg-accent text-white' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-hidden="true"
        >
          {celda.dia}
        </span>

        {compacto ? (
          /* Móvil: solo puntos de color, caben más días en pantalla. */
          eventos.length > 0 && (
            <span
              className="flex flex-wrap justify-center gap-0.5"
              aria-hidden="true"
            >
              {eventos.slice(0, MAX_EVENTOS_MOVIL).map((evento) => (
                <span
                  key={evento.id}
                  className="size-1.5 rounded-pill"
                  style={{
                    backgroundColor: obtenerCategoria(evento.categoria).hex,
                  }}
                />
              ))}
              {eventos.length > MAX_EVENTOS_MOVIL && (
                <span className="text-[9px] leading-none text-slate-400">+</span>
              )}
            </span>
          )
        ) : (
          /* Escritorio: hasta 2 franjas con la hora. */
          eventos.length > 0 && (
            <span className="flex min-w-0 flex-col gap-0.5">
              {eventos.slice(0, MAX_EVENTOS_CELDA).map((evento) => (
                <span
                  key={evento.id}
                  className="truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight"
                  style={{
                    backgroundColor: obtenerCategoria(evento.categoria).bg,
                    color: obtenerCategoria(evento.categoria).fg,
                  }}
                >
                  {evento.hora ? formatearHora(evento.hora) : evento.titulo}
                </span>
              ))}
            </span>
          )
        )}
      </button>

      {muestraMas && (
        <button
          type="button"
          onClick={onVerResto}
          className="absolute inset-x-1.5 bottom-1 rounded-md bg-surface/90 px-1 text-left text-[11px] font-semibold text-accent hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {/*
            `aria-label` con el detalle: visible dice "+1 más", que no dice de
            qué día es ni cuántos son en total.
          */}
          <span className="sr-only">
            Ver los {eventos.length} eventos del {etiquetaCelda(celda).split(',')[0]}
          </span>
          <span aria-hidden="true">+{ocultos} más</span>
        </button>
      )}
    </div>
  );
}
