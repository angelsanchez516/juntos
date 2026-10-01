/**
 * Componente `Modal`.
 *
 * RESPONSABILIDAD: diálogo superpuesto con fondo oscurecido, cierre con
 * Escape o clic en el velo, bloqueo del scroll del fondo, foco atrapado dentro
 * y devuelto al elemento que lo abrió. Lo usan el formulario de evento
 * (paso d) y el de idea de cita.
 *
 * Related: src/components/ui/Boton.jsx, components/eventos/EventoFormModal.jsx
 *
 * @module components/ui/Modal
 */

import { useCallback, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * @typedef {object} ModalProps
 * @property {boolean} abierto Controla la visibilidad desde el padre.
 * @property {() => void} onCerrar Se invoca al pulsar Escape, el velo o la
 *   "X". Obligatorio. Quien lo use decide si hay cambios sin guardar y
 *   pregunta antes de cerrar.
 * @property {string} titulo Título del diálogo, mostrado en la cabecera.
 * @property {import('react').ReactNode} children Contenido del modal.
 * @property {string} [descripcion] Texto secundario bajo el título.
 * @property {string[]} [descripcionAdicional] Identificadores de nodos fuera del
 *   modal que también forman parte de su descripción, por ejemplo el párrafo que
 *   explica qué va a pasar. Se añaden al final del `aria-describedby` y en el
 *   orden en que se pasan. Por defecto, ninguno.
 * @property {'sm'|'md'|'lg'} [ancho] Ancho máximo del panel. Por defecto `'md'`.
 * @property {import('react').ReactNode} [pie] Contenido de la barra inferior de
 *   acciones, normalmente botones.
 * @property {string} [className] Clases extra para el panel.
 * @property {() => void} [onCerrarRechazado] Se llama cuando se intenta cerrar
 *   y `onCerrar` no cambia `abierto`. Sirve para que el padre avise de que hay
 *   cambios sin guardar.
 * @property {'dialog'|'alertdialog'} [rol] Rol del panel. Por defecto
 *   `'dialog'`. Las confirmaciones de algo destructivo —borrar, descartar lo
 *   escrito— pasan `'alertdialog'`: según la especificación, es el rol que
 *   indica que el contenido es urgente y que el lector tiene que interrumpir lo
 *   que estuviera haciendo para atenderlo. Un `dialog` normal se trataría como
 *   una ventana más, y quien fuera con lector de pantalla podría no enterarse
 *   de que hay una pregunta esperándole.
 */

/** Anchos máximos del panel. */
const ANCHOS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * Selector de los elementos que pueden recibir foco dentro del modal.
 *
 * Se recalcula en cada pulsación de Tab en lugar de cachearse: el contenido
 * cambia (aparece un error, un chip, un previsualizador) y una lista congelada
 * dejaría fuera elementos nuevos, o mantendría dentro los que ya no existen.
 *
 * @param {HTMLElement|null} contenedor Elemento raíz del modal.
 * @returns {HTMLElement[]} Elementos focusables, en orden de tabulación.
 */
function elementosFocusables(contenedor) {
  if (!contenedor) return [];
  return [
    ...contenedor.querySelectorAll(
      [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(','),
    ),
  ].filter(
    (el) =>
      !el.hasAttribute('aria-hidden') &&
      // Solo se descarta lo que está dentro de un `[hidden]` explícito. No se
      // usa `offsetParent`, que además de no estar disponible en un DOM sin
      // layout descartaría de paso los controles `sr-only` (los radios de las
      // categorías), que sí tienen que ser alcanzables con el teclado.
      el.closest('[hidden]') === null,
  );
}

/**
 * Contador de modales abiertos.
 *
 * Bloquear el scroll con `overflow: hidden` en `<body>` y restaurarlo al
 * cerrar es correcto con un modal, pero se rompe con dos: el primero guarda
 * `'auto'` y el segundo guarda `'hidden'`, así que al cerrar el primero
 * desbloquea la página mientras el segundo sigue abierto. Con un contador, solo
 * el último cierre devuelve el valor original.
 *
 * @type {number}
 */
let modalesAbiertos = 0;

/**
 * Estilo del `<body>` anterior al primer modal, guardado a nivel de módulo.
 *
 * Va fuera del componente a propósito. El contador de arriba también es global,
 * y guardar el valor solo en la primera instancia que se monta significaba que,
 * si esa instancia se cerraba antes que las demás, era la única que podía
 * restaurar el estilo: las demás nunca lo habían guardado y, al ser las últimas
 * en cerrarse, el `<body>` se quedaba con `overflow: hidden` para siempre.
 *
 * @type {{overflow: string, paddingDerecha: string}|null}
 */
let scrollPrevio = null;

/**
 * Renderiza un modal accesible.
 *
 * ACCESIBILIDAD, en cuatro partes:
 *
 * 1. **Anuncio.** El panel se nombra con `aria-labelledby` apuntando al `h2`, no
 *    con `aria-label`. Con `aria-label` el lector anuncia el texto del
 *    atributo y el `h2` real se lee como contenido suelto, o se pierde.
 * 2. **Foco atrapado.** Tab y Mayús+Tab circulan dentro del panel. Sin esto, el
 *    foco se va al fondo de la página, que en un lector de pantalla se traduce
 *    en que la persona sigue creyendo que el modal se ha cerrado.
 * 3. **Foco devuelto.** Al cerrar, el foco vuelve al elemento que abrió el
 *    modal. Sin esto, el foco se queda en un `<body>` y quien navega con teclado
 *    tiene que recorrer toda la página desde el principio para volver a donde
 *    estaba.
 * 4. **Scroll.** El fondo no se desplaza mientras el modal está abierto.
 *
 * @param {ModalProps} props Propiedades del componente.
 * @returns {import('react').ReactElement|null} `null` si está cerrado.
 * @example
 * <Modal abierto={visible} onCerrar={cerrar} titulo="Agregar evento">
 *   <form>...</form>
 * </Modal>
 */
export default function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  descripcionAdicional = [],
  children,
  pie,
  ancho = 'md',
  className = '',
  rol = 'dialog',
}) {
  const panelRef = useRef(null);
  const disparadorRef = useRef(null);
  const onCerrarRef = useRef(onCerrar);

  /*
   * Guardamos el callback en una ref y lo actualizamos en cada render, para que
   * los efectos puedan depender solo de `abierto`.
   *
   * Esto no es un detalle menor. Si el efecto de bloqueo y foco dependiera de
   * `onCerrar` y el padre pasara una flecha inline (`onCerrar={() => setAbierto(false)}`),
   * esa flecha sería una función nueva en cada render, el efecto se reejecutaría
   * en cada render, y `panelRef.current.focus()` le robaría el foco al campo
   * que la persona estuviera escribiendo. El formulario sería inutilizable con
   * el teclado: se perdería el foco en cada tecla.
   */
  useEffect(() => {
    onCerrarRef.current = onCerrar;
  }, [onCerrar]);

  // `useId` genera un id único por instancia, así que dos modales abiertos a la
  // vez no colisionan en el `aria-labelledby`.
  const idTitulo = useId();
  const idDescripcion = useId();

  /*
   * `aria-describedby` acepta varios identificadores separados por espacio, y el
   * orden importa: es el orden en el que el lector leerá las descripciones. Se
   * empieza por la de la cabecera y se añaden al final las que pase quien use el
   * modal, de modo que el texto de la propia `descripcion` siga siendo la
   * primera frase que se oye al abrir.
   *
   * Los identificadores se limpian para quitar vacíos y repetidos: uno repetido
   * hace que el lector anuncie el mismo texto dos veces, que es peor que no
   * anunciarlo.
   */
  const descritosPor = [
    ...(descripcion ? [idDescripcion] : []),
    ...descripcionAdicional,
  ]
    .filter((id) => typeof id === 'string' && id.trim() !== '')
    .filter((id, i, todos) => todos.indexOf(id) === i)
    .join(' ');

  const manejarEscape = useCallback((evento) => {
    if (evento.key === 'Escape') {
      // `stopPropagation` evita que un modal padre también cierre: si hay un
      // confirm encima del formulario, Escape debe cerrar solo el de arriba.
      evento.stopPropagation();
      onCerrarRef.current();
    }
  }, []);

  const manejarTeclado = useCallback((evento) => {
    if (evento.key !== 'Tab') return;

    const focusables = elementosFocusables(panelRef.current);
    if (focusables.length === 0) {
      // Sin elementos focusables dentro, el foco no puede circular: se mantiene
      // en el panel para no escaparse al fondo.
      evento.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];
    const activo = document.activeElement;

    if (evento.shiftKey && (activo === primero || activo === panelRef.current)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }, []);

  /*
   * Foco inicial: en el panel, para que el lector de pantalla anuncie el título
   * antes de que la persona empiece a escribir.
   *
   * Es un `useLayoutEffect` y no un `useEffect` por dos motivos concretos.
   *
   * El primero es recuperar el elemento que abrió el modal. React ejecuta los
   * efectos de abajo arriba, así que un contenido con foco propio (el formulario
   * pone el foco en su primer campo) lo enfoca ANTES de que llegue aquí. Guardar
   * en ese momento el elemento activo significaba guardar el propio input del
   * formulario, y al cerrar el foco se intentaba devolver a un nodo que ya no
   * estaba: el foco acababa en `body` y quien navegaba con teclado tenía que
   * recorrer la página entera desde el principio. Los efectos de diseño se
   * ejecutan antes que todos los efectos normales, así que aquí el elemento
   * activo sigue siendo el botón que abrió el modal.
   *
   * El segundo es que enfocar antes de pintar evita el parpadeo en el que se ve
   * la página de fondo y luego salta el foco al modal.
   */
  useLayoutEffect(() => {
    if (!abierto) return;
    disparadorRef.current = document.activeElement;

    const panel = panelRef.current;
    // Solo si el contenido no ha enfocado ya algo dentro, para no quitárselo.
    if (panel && !panel.contains(document.activeElement)) {
      panel.focus();
    }
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;

    if (modalesAbiertos === 0) {
      scrollPrevio = {
        overflow: document.body.style.overflow,
        paddingDerecha: document.body.style.paddingRight,
      };
    }
    modalesAbiertos += 1;

    /*
     * Compensamos el ancho de la barra de scroll que desaparece al bloquear el
     * scroll. Sin esto, el contenido salta unos píxeles a la derecha al abrir
     * cualquier modal, y en móvil el salto es muy visible.
     */
    const anchoBarra = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (anchoBarra > 0) {
      document.body.style.paddingRight = `${anchoBarra}px`;
    }

    document.addEventListener('keydown', manejarEscape);
    document.addEventListener('keydown', manejarTeclado);

    return () => {
      document.removeEventListener('keydown', manejarEscape);
      document.removeEventListener('keydown', manejarTeclado);

      modalesAbiertos = Math.max(0, modalesAbiertos - 1);
      if (modalesAbiertos === 0 && scrollPrevio) {
        document.body.style.overflow = scrollPrevio.overflow;
        document.body.style.paddingRight = scrollPrevio.paddingDerecha;
        scrollPrevio = null;
      }

      /*
       * Devolvemos el foco. Solo si el elemento sigue en el documento: si quien
       * abrió el modal era un botón de una lista que se ha borrado al guardar,
       * `.focus()` sobre un nodo huérfano no hace nada y, peor, en algunos
       * navegadores deja el foco en `body` sin avisar.
       */
      const disparador = disparadorRef.current;
      if (disparador instanceof HTMLElement && document.contains(disparador)) {
        disparador.focus();
      }
    };
  }, [abierto, manejarEscape, manejarTeclado]);

  if (!abierto) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/*
       * El velo es un `div`, no un botón. Un `<button>` con `aria-label="Cerrar"`
       * añade un elemento más al orden de tabulación y hace que el lector
       * anuncie dos "Cerrar" seguidos (el del velo y el de la "X"), sin
       * aportar nada: el cierre por teclado ya está cubierto por Escape y por el
       * botón de la cabecera, que sí es un control real.
       */}
      <div
        onClick={onCerrar}
        aria-hidden="true"
        className="absolute inset-0 bg-base/80 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role={rol}
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descritosPor === '' ? undefined : descritosPor}
        tabIndex={-1}
        className={[
          'relative flex w-full flex-col overflow-hidden outline-none',
          /*
           * `alto-modal` son las dos declaraciones, `92vh` y `92dvh`, en el
           * orden correcto. No se puede escribir como dos clases sueltas:
           * Tailwind las ordenaría él y emitiría el `vh` el último, que es
           * justo el que no se encoge con el teclado. Ver tailwind.config.js.
           */
          'alto-modal',
          'rounded-t-3xl shadow-pop sm:rounded-card',
          'bg-surface text-slate-800',
          ANCHOS[ancho] ?? ANCHOS.md,
          className,
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 id={idTitulo} className="text-lg font-semibold text-slate-900">
              {titulo}
            </h2>
            {descripcion && (
              <p id={idDescripcion} className="mt-0.5 text-sm text-slate-500">
                {descripcion}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mr-1 rounded-pill p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {pie && (
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">{pie}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
