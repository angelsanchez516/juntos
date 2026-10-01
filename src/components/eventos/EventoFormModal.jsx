/**
 * Componente `EventoFormModal`.
 *
 * RESPONSABILIDAD: un único formulario para crear y para editar un evento. El
 * mismo componente sirve para los dos casos porque duplicarlos es la forma más
 * segura de que las reglas se separen: en seis meses la versión de edición
 * acabará sin la validación que tiene la de alta.
 *
 * Related: src/utils/validaciones.js, src/components/ui/Modal.jsx,
 * components/eventos/SelectorFoto.jsx, src/utils/fechas.js
 *
 * @module components/eventos/EventoFormModal
 */

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import ConfirmarSalida from '../ui/ConfirmarSalida';
import SelectorFoto from './SelectorFoto';
import { ORDEN_CATEGORIAS_EVENTO, obtenerCategoria } from '../../utils/categorias';
import { ErrorValidacion, LIMITES, validarEvento } from '../../utils/validaciones';
import { ErrorServicio } from '../../services/eventosService';
import { hoyISO } from '../../utils/fechas';

/**
 * Estado vacío del formulario.
 *
 * @type {Readonly<Record<string, any>>}
 */
const VACIO = Object.freeze({
  titulo: '',
  fecha: '',
  hora: '',
  descripcion: '',
  lugar: '',
  categoria: ORDEN_CATEGORIAS_EVENTO[0] ?? 'cita',
  foto: null,
});

/**
 * @typedef {object} EventoFormModalProps
 * @property {boolean} abierto Si el modal está visible.
 * @property {() => void} onCerrar Se llama al cerrar sin guardar.
 * @property {(datos: object) => Promise<void>} onGuardar Guarda el evento. La
 *   validation ya se hizo antes de llamar a esta función, así que solo puede
 *   fallar por cuota o por un error inesperado.
 * @property {import('../../types/models.js').Evento|null} [evento] Evento a
 *   editar. Si es `null` o se omite, el modal crea uno nuevo.
 * @property {string} [fechaInicial] Fecha a precargar en modo creación. Viene
 *   del día que la persona pulsó en el calendario, no de "hoy": si abre el
 *   formulario desde el 14 y el día 14 no se guarda, no tiene sentido que
 *   aparezca el 30.
 * @property {object} [valoresIniciales] Valores con los que se rellena el
 *   formulario, del tirón. Lo usa la conversión de una idea en evento: título,
 *   descripción, foto y categoría llegan puestos, y la fecha llega vacía
 *   porque una idea no tiene día. Cuando se pasa, el modal NO pone fecha por su
 *   cuenta, ni la de hoy ni la de `fechaInicial`. Tiene prioridad sobre
 *   `fechaInicial`, pero no sobre `evento`: si hay un evento que editar, sus
 *   datos mandan sobre cualquier precarga.
 * @property {boolean} [guardando] Si el guardado está en curso. Deshabilita el
 *   botón para impedir el doble envío.
 */

/**
 * @typedef {object} Campo
 * @property {string} nombre Clave dentro del estado del formulario.
 * @property {string} etiqueta Texto visible de la etiqueta.
 * @property {string} [ayuda] Texto de ayuda bajo el campo.
 * @property {'text'|'date'|'time'|'textarea'} tipo Tipo de control.
 * @property {boolean} [requerido] Añade el asterisco y `required`.
 * @property {number} [maximo] Límite para el contador de caracteres.
 * @property {string} [placeholder] Texto de ejemplo.
 * @property {boolean} [autoFoco] Recibe el foco al abrir el modal.
 */

/**
 * Definición de los campos del formulario.
 *
 * Se declara como dato y no dentro del JSX para que el orden de tabulación, el
 * foco automático y el foco en el primer error sean todos la misma lista. Si
 * el campo con error se definiera aparte, tarde o temprano dejarían de
 * coincidir y el foco acabaría en un campo que no es el que falla.
 *
 * @type {ReadonlyArray<Campo>}
 */
const CAMPOS = Object.freeze([
  {
    nombre: 'titulo',
    etiqueta: 'Título',
    tipo: 'text',
    requerido: true,
    maximo: LIMITES.TITULO,
    placeholder: 'Cena de aniversario',
    autoFoco: true,
  },
  { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'date', requerido: true },
  {
    nombre: 'hora',
    etiqueta: 'Hora',
    tipo: 'time',
    ayuda: 'Opcional. Déjalo vacío si es todo el día.',
  },
  {
    nombre: 'lugar',
    etiqueta: 'Lugar',
    tipo: 'text',
    maximo: LIMITES.LUGAR,
    placeholder: 'Casa, restaurante, la playa…',
  },
  {
    nombre: 'descripcion',
    etiqueta: 'Descripción',
    tipo: 'textarea',
    maximo: LIMITES.DESCRIPCION,
    ayuda: 'Lo que queréis recordar de este día.',
  },
]);

/**
 * Identificador DOM de cada campo, para enlazarlos con `aria-describedby` y
 * `aria-invalid`.
 *
 * Vive en el módulo y no en el componente porque no depende de la instancia:
 * sale de `CAMPOS`, que tampoco cambia. Solo hay un formulario de evento en
 * pantalla a la vez, así que no hace falta `useId` ni un contador.
 *
 * @type {Readonly<Record<string, string>>}
 */
const IDS_CAMPO = Object.freeze(
  Object.fromEntries(CAMPOS.map((campo) => [campo.nombre, `ev-${campo.nombre}`])),
);

/**
 * Modal de alta y edición de eventos.
 *
 * @param {EventoFormModalProps} props Propiedades del componente.
 * @returns {import('react').ReactElement|null} `null` si está cerrado.
 * @example
 * <EventoFormModal
 *   abierto={abierto}
 *   fechaInicial="2026-10-14"
 *   onCerrar={cerrar}
 *   onGuardar={crear}
 * />
 */
/**
 * Contenido del formulario: estado, validación y campos.
 *
 * Va en un componente aparte, y el contenedor lo monta con una `key` que cambia
 * al abrir. Eso hace que el estado se cree de cero en cada apertura, sin un
 * efecto que lo reinicie a mano.
 *
 * POR QUÉ NO UN `useEffect` QUE PONGA LOS VALORES INICIALES
 * Parecía equivalente, pero no lo es. Un efecto que rellena el estado después de
 * pintar provoca un segundo render: durante el primero, los campos aparecen
 * vacíos o con los datos del evento anterior, y en el caso de editar, el
 * formulario llega a validar el evento vacío si se pulsa guardar muy deprisa.
 * Montar de nuevo con otra `key` resuelve el estado antes del primer render, que
 * es lo único que garantiza que no haya un frame con los datos equivocados.
 *
 * @param {object} props Propiedades del formulario.
 * @returns {import('react').ReactElement} Formulario.
 */
function ContenidoFormulario({
  ref,
  evento,
  fechaInicial,
  valoresInicialesPadre,
  guardando,
  onCerrar,
  onGuardar,
  editando,
}) {
  /**
   * Estado inicial del formulario, calculado en el momento del montaje.
   *
   * Tres caminos, en este orden: editar un evento existente, recibir los
   * valores de quien llama —la conversión desde el planeador— o crear uno nuevo
   * con la fecha del día pulsado. Los valores de quien llama se respetan tal
   * cual, incluida una `fecha` vacía: quien los pasa ya ha decidido qué fecha
   * poner, y si no es ninguna, rellenarla sería tomar una decisión en nombre de
   * quien la tiene que tomar.
   *
   * @returns {object} Valores con los que arranca el formulario.
   */
  const valoresIniciales = () => {
    if (evento) {
      return {
        titulo: evento.titulo ?? '',
        fecha: evento.fecha ?? '',
        hora: evento.hora ?? '',
        descripcion: evento.descripcion ?? '',
        lugar: evento.lugar ?? '',
        categoria: evento.categoria ?? ORDEN_CATEGORIAS_EVENTO[0],
        foto: evento.foto ?? null,
      };
    }
    if (valoresInicialesPadre) {
      return { ...VACIO, ...valoresInicialesPadre };
    }
    return { ...VACIO, fecha: fechaInicial || hoyISO() };
  };

  const [valores, setValores] = useState(valoresIniciales);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviado, setEnviado] = useState(false);

  const formularioRef = useRef(null);
  const contenedorErroresRef = useRef(null);

  /*
   * Enfoca el primer campo que tenga error, o el primer campo del formulario.
   *
   * Recibe el mapa de errores como parámetro en lugar de leerlo del estado.
   * El estado del render actual todavía no contiene los errores que se acaban
   * de calcular: `setErrores` programa el re-render, y leer `errores` dentro de
   * esta función devolvería el objeto viejo, o el vacío. El foco acabaría
   * siempre en el primer campo del formulario, que es justo el fallo que este
   * código existe para evitar.
   *
   * @param {Record<string, string>} erroresPorCampo Errores ya calculados.
   * @returns {void}
   */
  function enfocarPrimerError(erroresPorCampo) {
    const primeroConError = CAMPOS.find((campo) => erroresPorCampo[campo.nombre]);
    const destino = primeroConError ? IDS_CAMPO[primeroConError.nombre] : IDS_CAMPO[CAMPOS[0].nombre];
    /*
     * Dos saltos: el primero deja que React pinte el mensaje de error y el
     * segundo da margen a que el navegador lo procese. Enfocar en el mismo
     * tick no movería el foco, porque el elemento con `aria-describedby`
     * todavía no apunta a ningún sitio.
     */
    setTimeout(() => {
      elementoPorId(formularioRef.current, destino)?.focus();
    }, 0);
  }

  /** Pone el foco en el aviso de error general, para que se lea entero. */
  function enfocarErrorGeneral() {
    setTimeout(() => {
      contenedorErroresRef.current?.focus();
    }, 0);
  }

  /*
   * El foco inicial va al primer campo, no al panel.
   *
   * No se usa `autoFocus` de React a propósito: el portal del modal se inserta
   * después, así que el `autoFocus` del input se aplica antes y luego se pierde.
   *
   * Tampoco hace falta retrasarlo con un temporizador. Los efectos se ejecutan
   * de abajo arriba, así que este se aplica antes que el del `Modal`, y ese
   * efecto respeta el foco que ya esté dentro del panel en lugar de quitárselo.
   */
  useEffect(() => {
    elementoPorId(formularioRef.current, 'ev-titulo')?.focus();
  }, []);

  /*
   * Publica hacia el contenedor si hay algo escrito, para que el aviso de "salir
   * sin guardar" tenga un dato fiable y no una estimación.
   *
   * Se compara el estado actual con los valores con los que arrancó. Un campo
   * que se escribe y se borra vuelve a estar igual, así que no cuenta como
   * cambio: preguntar "¿salir sin guardar?" cuando no hay nada escrito
   * enseñaría a la gente a confirmar sin leer.
   */
  const inicialesRef = useRef(null);
  if (inicialesRef.current === null) {
    inicialesRef.current = valoresIniciales();
  }

  useImperativeHandle(ref, () => ({
    get sucio() {
      return JSON.stringify(valores) !== JSON.stringify(inicialesRef.current);
    },
  }));

  /**
   * Actualiza un campo del formulario.
   *
   * Al escribir, el error de ese campo desaparece. Es lo que espera alguien
   * que ya está corrigiendo: un mensaje rojo sobre un campo que acaba de
   * arreglar se siente como que el formulario no le escucha.
   *
   * @param {string} nombre Clave del campo.
   * @param {string} valor Nuevo valor.
   * @returns {void}
   */
  function cambiar(nombre, valor) {
    setValores((previos) => ({ ...previos, [nombre]: valor }));
    setErrores((previos) => {
      if (!previos[nombre]) return previos;
      const { [nombre]: _retirado, ...resto } = previos;
      return resto;
    });
  }


  /**
   * Valida y guarda el evento.
   *
   * @param {import('react').FormEvent} eventoForm Evento del `submit`.
   * @returns {Promise<void>} Termina cuando el guardado acaba o falla.
   */
  async function manejarEnvio(eventoForm) {
    eventoForm.preventDefault();
    if (guardando) return;

    setEnviado(true);
    setErrorGeneral(null);

    let limpio;
    try {
      limpio = validarEvento(valores);
    } catch (err) {
      /*
       * La validación es la MISMA función que usa el service. Si aquí acepta un
       * dato, el service lo acepta; si el service lo rechaza, es por otra cosa.
       * Aquí no hay una segunda lista de reglas que se pueda desincronizar.
       */
      if (err instanceof ErrorValidacion) {
        const porCampo = err.erroresPorCampo ?? {};
        setErrores(porCampo);
        enfocarPrimerError(porCampo);
        return;
      }
      setErrorGeneral('No pudimos revisar el formulario. Inténtalo de nuevo.');
      return;
    }

    try {
      await onGuardar(limpio);
      // Solo se cierra si el guardado funcionó. `onCerrar` lo llama el padre
      // cuando el guardado termina bien.
    } catch (err) {
      if (err instanceof ErrorValidacion) {
        const porCampo = err.erroresPorCampo ?? {};
        setErrores(porCampo);
        enfocarPrimerError(porCampo);
        return;
      }
      if (err instanceof ErrorServicio) {
        // Cuota agotada o fallo de escritura: el error va arriba, no pegado a
        // un campo, porque no es culpa de ningún campo en concreto.
        setErrorGeneral(err.message);
        enfocarErrorGeneral();
        return;
      }
      setErrorGeneral('No pudimos guardar el evento. Inténtalo de nuevo.');
      enfocarErrorGeneral();
    }
  }

  return (
    <form ref={formularioRef} onSubmit={manejarEnvio} noValidate>
        {/*
         * `noValidate` desactiva la validación nativa del navegador a propósito.
         * Los mensajes nativos aparecen en el idioma del navegador, no en
         * español, y no se pueden estilizar ni asociar a los `role="alert"` del
         * formulario. La validación es la de `validarEvento()`, en español y
         * con los mensajes que ha pedido quien escribe.
         */}

        {errorGeneral && (
          <div
            ref={contenedorErroresRef}
            role="alert"
            tabIndex={-1}
            className="mb-5 flex gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-800 outline-none"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{errorGeneral}</span>
          </div>
        )}

        <div className="space-y-5">
          {CAMPOS.map((campo) => {
            const id = IDS_CAMPO[campo.nombre];
            const error = errores[campo.nombre];
            const idAyuda = `${id}-ayuda`;
            const idError = `${id}-error`;
            const valor = valores[campo.nombre] ?? '';
            const restante = campo.maximo ? campo.maximo - String(valor).length : null;

            return (
              <div key={campo.nombre}>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor={id} className="block text-sm font-medium text-slate-800">
                    {campo.etiqueta}
                    {campo.requerido && (
                      <span className="ml-0.5 text-accent" aria-hidden="true">
                        *
                      </span>
                    )}
                    {campo.requerido && <span className="sr-only">(obligatorio)</span>}
                  </label>

                  {/*
                   * El contador solo aparece al escribir. Poner "0/500" de
                   * entrada es ruido para quien no ha escrito nada todavía, y es
                   * justo en el móvil, donde el campo es estrecho, donde peor se
                   * ve.
                   */}
                  {restante !== null && enviado && (
                    <span
                      className={[
                        'text-xs tabular-nums',
                        restante < 0 ? 'font-semibold text-red-700' : 'text-slate-400',
                      ].join(' ')}
                    >
                      {String(valor).length}/{campo.maximo}
                    </span>
                  )}
                </div>

                {campo.tipo === 'textarea' ? (
                  <textarea
                    id={id}
                    value={valor}
                    onChange={(e) => cambiar(campo.nombre, e.target.value)}
                    rows={4}
                    placeholder={campo.placeholder}
                    maxLength={campo.maximo}
                    required={campo.requerido}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={
                      [campo.ayuda ? idAyuda : null, error ? idError : null]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    className={[
                      'mt-1.5 w-full rounded-card border px-3.5 py-2.5 text-sm text-slate-900',
                      'placeholder:text-slate-400 focus:outline-none focus:ring-2',
                      error
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        : 'border-slate-300 focus:border-accent focus:ring-accent/30',
                    ].join(' ')}
                  />
                ) : (
                  <input
                    id={id}
                    type={campo.tipo}
                    value={valor}
                    onChange={(e) => cambiar(campo.nombre, e.target.value)}
                    placeholder={campo.placeholder}
                    maxLength={campo.maximo}
                    required={campo.requerido}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={
                      [campo.ayuda ? idAyuda : null, error ? idError : null]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    className={[
                      'mt-1.5 w-full rounded-card border px-3.5 py-2.5 text-sm text-slate-900',
                      'placeholder:text-slate-400 focus:outline-none focus:ring-2',
                      error
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
                        : 'border-slate-300 focus:border-accent focus:ring-accent/30',
                    ].join(' ')}
                  />
                )}

                {campo.ayuda && (
                  <p id={idAyuda} className="mt-1.5 text-xs text-slate-500">
                    {campo.ayuda}
                  </p>
                )}

                {error && (
                  <p id={idError} className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700">
                    <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                    {error}
                  </p>
                )}
              </div>
            );
          })}

          {/* Categoría: los chips salen del catálogo, no de una lista local. */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-800">
              Categoría
              <span className="ml-0.5 text-accent" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(obligatorio)</span>
            </legend>

            <div className="mt-2 flex flex-wrap gap-2">
              {ORDEN_CATEGORIAS_EVENTO.map((clave) => {
                const info = obtenerCategoria(clave);
                const seleccionada = valores.categoria === clave;
                return (
                  <label
                    key={clave}
                    className={[
                      'cursor-pointer rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors',
                      'focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-1',
                      seleccionada
                        ? 'border-transparent ring-2'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                    style={
                      seleccionada
                        ? { backgroundColor: info.bg, color: info.fg, borderColor: info.hex }
                        : undefined
                    }
                  >
                    <input
                      type="radio"
                      name="categoria"
                      value={clave}
                      checked={seleccionada}
                      onChange={() => cambiar('categoria', clave)}
                      className="sr-only"
                    />
                    {info.label}
                  </label>
                );
              })}
            </div>

            {errores.categoria && (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700">
                <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                {errores.categoria}
              </p>
            )}
          </fieldset>

          <div>
            <span className="block text-sm font-medium text-slate-800">Foto</span>
            <div className="mt-1.5">
              <SelectorFoto
                valor={valores.foto}
                onChange={(dataUrl) => cambiar('foto', dataUrl)}
                idCampo="ev-foto-error"
              />
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-pill border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className={[
              'inline-flex items-center justify-center gap-2 rounded-pill px-5 py-2.5',
              'text-sm font-semibold text-white transition-colors',
              guardando ? 'cursor-not-allowed bg-slate-400' : 'bg-accent hover:bg-accent-dark',
            ].join(' ')}
          >
            {guardando && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {guardando
              ? 'Guardando…'
              : editando
                ? 'Guardar cambios'
                : 'Agregar evento'}
          </button>
        </div>
    </form>
  );
}

/**
 * Escapa un id para poder usarlo en un selector CSS.
 *
 * `CSS.escape` no está disponible en todas partes (Node no lo trae), y los ids
 * que genera `useId()` llevan dos puntos, que en un selector valen como
 * pseudoclase. Se usa un `querySelector` con el id entre comillas, que no
 * interpreta nada dentro de ellas, y un `getElementById` como reserva.
 *
 * @param {HTMLElement|null} contenedor Elemento donde buscar.
 * @param {string} id Identificador del elemento.
 * @returns {HTMLElement|null} Elemento buscado, o `null`.
 */
function elementoPorId(contenedor, id) {
  if (!contenedor || !id) return null;
  return (
    contenedor.querySelector(`[id="${id}"]`) ??
    (typeof document !== 'undefined' ? document.getElementById(id) : null)
  );
}

/**
 * Monta el modal y decide si un intento de cierre se atiende o se pregunta antes.
 *
 * @param {EventoFormModalProps} props Propiedades del componente.
 * @returns {import('react').ReactElement|null} Modal con el formulario dentro.
 * @example
 * <EventoFormModal abierto onCerrar={cerrar} onGuardar={guardar} />
 */
export default function EventoFormModal({
  abierto,
  onCerrar,
  onGuardar,
  evento = null,
  fechaInicial,
  valoresIniciales: valoresInicialesPadre,
  guardando = false,
}) {
  const editando = Boolean(evento?.id);
  /*
   * Si quien llama trae valores concretos, el modal deja de poner fecha por su
   * cuenta. Es el caso de "convertir una idea en evento": la idea no tiene
   * fecha, precisamente porque le falta, y rellenarla con la de hoy haría que
   * quien abriera el formulario creyera que el día ya estaba pensado. Aquí la
   * fecha llega vacía y la validación la marca como pendiente.
   */
  const hayValoresPadre = valoresInicialesPadre !== undefined && valoresInicialesPadre !== null;

  /*
   * El contenido vive detrás de un ref porque se remonta con cada apertura, así
   * que no hay forma de leer su estado desde aquí. El ref expone dos cosas: si
   * hay algo escrito y si hay errores.
   *
   * El diálogo de "¿salir sin guardar?" se pinta fuera del formulario a
   * propósito: vive en el contenedor, que no se remonta, para que escribir en
   * él no lo destruya.
   */
  const contenidoRef = useRef(null);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [abiertoAnterior, setAbiertoAnterior] = useState(abierto);

  /*
   * Al reabrir, el aviso de salida se limpia.
   *
   * Se ajusta durante el render en lugar de en un efecto a propósito. El
   * efecto llega tarde: habría un render en el que el modal aparece ya abierto
   * mostrando "¿salir sin guardar?" de la apertura anterior, y quien lo viera
   * pensaría que sus datos se habían perdido.
   *
   * Este es el patrón que recomienda React para ajustar estado cuando cambia una
   * prop: React vuelve a renderizar de inmediato, sin llegar a pintar.
   */
  if (abierto !== abiertoAnterior) {
    setAbiertoAnterior(abierto);
    if (abierto) setConfirmandoSalida(false);
  }

  /**
   * Cierra el formulario, o pregunta antes si hay algo escrito.
   *
   * @returns {void}
   */
  const pedirCierre = useCallback(() => {
    const sucio = contenidoRef.current?.sucio === true;
    if (sucio && !guardando) {
      setConfirmandoSalida(true);
      return;
    }
    onCerrar();
  }, [guardando, onCerrar]);

  return (
    <Modal abierto={abierto} onCerrar={pedirCierre} titulo={editando ? 'Editar evento' : 'Agregar evento'} descripcion={editando ? 'Los cambios se guardan al confirmar.' : 'Solo vosotros dos vais a ver esto.'} ancho="lg">
      {/*
        El formulario NO se desmonta cuando aparece el aviso de salida, solo se
        oculta. Si se sustituyera por el aviso, quien cancelara volvería a un
        formulario recién montado y perdería todo lo que había escrito: el
        aviso existiría para proteger ese trabajo y lo estaría destruyendo.
        Con `hidden` el estado vive, y además el formulario sale del árbol de
        accesibilidad y del orden de tabulación, que es lo que queremos.
      */}
      <div hidden={confirmandoSalida}>
        <ContenidoFormulario
          ref={contenidoRef}
          key={`${abierto ? 'abierto' : 'cerrado'}:${evento?.id ?? 'nuevo'}:${editando ? 'edicion' : 'alta'}`}
          evento={evento}
          fechaInicial={fechaInicial}
          valoresInicialesPadre={hayValoresPadre ? valoresInicialesPadre : null}
          guardando={guardando}
          onCerrar={pedirCierre}
          onGuardar={onGuardar}
          editando={editando}
        />
      </div>

      {confirmandoSalida && (
        <ConfirmarSalida
          onCancelar={() => setConfirmandoSalida(false)}
          onConfirmar={onCerrar}
        />
      )}
    </Modal>
  );
}
