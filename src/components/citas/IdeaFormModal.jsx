/**
 * Componente `IdeaFormModal`.
 *
 * RESPONSABILIDAD: alta y edición de una idea de cita. Reutiliza `Modal` para
 * el diálogo, `ConfirmarSalida` para el aviso de cambios pendientes y
 * `SelectorFoto` para la imagen, de modo que la validación de la foto —las dos
 * fases y los mensajes de rechazo— no se escriba por segunda vez.
 *
 * ES MÁS CORTO QUE `EventoFormModal` POR UNA RAZÓN CONCRETA
 * Al evento no le hace falta `fecha`, `hora` ni `lugar`: una idea es una
 * propuesta sin día, y un formulario con un campo menos se recorre más rápido
 * en el móvil. El resto de la estructura es a propósito la misma —mismos
 * errores, mismo aviso de salida, mismo enfoque del primer campo— para que
 * quien use los dos no encuentre dos apps distintas.
 *
 * Related: src/pages/Planeador.jsx, src/utils/validaciones.js,
 * src/services/citasService.js, components/eventos/EventoFormModal.jsx
 *
 * @module components/citas/IdeaFormModal
 */

import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Modal from '../ui/Modal';
import Boton from '../ui/Boton';
import ConfirmarSalida from '../ui/ConfirmarSalida';
import SelectorFoto from '../eventos/SelectorFoto';
import { obtenerCategoriaIdea, ORDEN_CATEGORIAS_IDEA } from '../../utils/categorias';
import { ErrorValidacion, LIMITES, validarIdea } from '../../utils/validaciones';

/**
 * Estado vacío de una idea nueva.
 *
 * La categoría arranca en la primera del catálogo, leída de `ORDEN_CATEGORIAS_IDEA`
 * y no escrita a mano: si mañana se añade una categoría, esta sigue siendo
 * válida sin tocar una línea más.
 *
 * @type {Readonly<Record<string, any>>}
 */
const VACIO = Object.freeze({
  titulo: '',
  descripcion: '',
  categoria: ORDEN_CATEGORIAS_IDEA[0],
  imagen: null,
});

/**
 * @typedef {object} IdeaFormModalProps
 * @property {boolean} abierto Si el modal está visible.
 * @property {() => void} onCerrar Se llama al cerrar.
 * @property {(datos: object) => Promise<void>} onGuardar Guarda la idea. Recibe
 *   los datos ya validados, así que solo puede fallar por cuota o por un fallo
 *   inesperado.
 * @property {import('../../types/models.js').IdeaCita|null} [idea] Idea a
 *   editar. Si es `null` o se omite, se crea una nueva.
 * @property {boolean} [guardando] Si el guardado está en curso.
 */

/**
 * Modal de alta y edición de una idea de cita.
 *
 * @param {IdeaFormModalProps} props Propiedades del componente.
 * @returns {import('react').ReactElement|null} `null` si está cerrado.
 * @example
 * <IdeaFormModal abierto onCerrar={cerrar} onGuardar={crear} />
 */
export default function IdeaFormModal({
  abierto,
  onCerrar,
  onGuardar,
  idea = null,
  guardando = false,
}) {
  const contenidoRef = useRef(null);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [abiertoAnterior, setAbiertoAnterior] = useState(abierto);

  /*
   * Al reabrir se limpia el aviso de salida.
   *
   * Se ajusta durante el render y no en un efecto a propósito. El efecto llega
   * tarde: habría un render en el que el modal aparece ya abierto mostrando
   * "¿salir sin guardar?" de la apertura anterior, y quien lo viera pensaría que
   * sus datos se habían perdido. Este es el patrón que recomienda React para
   * corregir estado cuando cambia una prop: vuelve a renderizar de inmediato,
   * sin llegar a pintar.
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
    <Modal
      abierto={abierto}
      onCerrar={pedirCierre}
      titulo={idea?.id ? 'Editar idea' : 'Nueva idea'}
      descripcion={
        idea?.id
          ? 'Los cambios se guardan al confirmar.'
          : 'Una idea sin fecha. Le ponemos día cuando la hagáis.'
      }
      ancho="lg"
    >
      {/*
        El formulario NO se desmonta cuando aparece el aviso, solo se oculta. Si
        se sustituyera por el aviso, quien cancelara volvería a un formulario
        recién montado y perdería lo escrito: el aviso existiría para proteger
        ese trabajo y lo estaría destruyendo. Con `hidden` el estado vive, y
        además el formulario sale del orden de tabulación, que es lo que se
        quiere.
      */}
      <div hidden={confirmandoSalida}>
        <ContenidoFormulario
          ref={contenidoRef}
          // `key`: al cambiar la identidad del formulario, React lo monta de
          // cero. Sin esto, abrir el modal después de editar otra idea
          // conservaría el estado anterior y el formulario validaría datos
          // viejos durante un render.
          key={`${abierto ? 'abierto' : 'cerrado'}:${idea?.id ?? 'nueva'}`}
          idea={idea}
          guardando={guardando}
          onCerrar={pedirCierre}
          onGuardar={onGuardar}
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

/**
 * Contenido del formulario de idea: estado, validación y campos.
 *
 * Va en un componente aparte para que el contenedor pueda montarlo con una
 * `key` que cambia al abrir, y así el estado se cree de cero en cada apertura
 * sin un efecto que lo reinicie a mano.
 *
 * @param {object} props Propiedades del formulario.
 * @param {import('react').Ref<{sucio: boolean}>} props.ref Referencia imperative.
 * @param {import('../../types/models.js').IdeaCita|null} props.idea Idea a
 *   editar, o `null` para una nueva.
 * @param {boolean} props.guardando Si el guardado está en curso.
 * @param {() => void} props.onCerrar Pide el cierre, pasando por el aviso.
 * @param {(datos: object) => Promise<void>} props.onGuardar Guarda la idea.
 * @returns {import('react').ReactElement} Formulario.
 */
function ContenidoFormulario({ ref, idea, guardando, onCerrar, onGuardar }) {
  const editando = Boolean(idea?.id);
  const baseId = useId();

  /*
   * Los ids salen de `useId` y no de constantes del módulo. Dos modales pueden
   * convivir en el mismo documento —una idea abierto sobre un aviso, o dos
   * navegadores lado a lado en las pruebas— y un id fijo duplicaría el
   * `aria-describedby`, de modo que el mensaje de error se asociaría al campo
   * equivocado sin que nada fallara de forma visible.
   */
  const idTitulo = `${baseId}-titulo`;
  const idDescripcion = `${baseId}-descripcion`;
  const idErrorTitulo = `${baseId}-error-titulo`;
  const idAyudaDescripcion = `${baseId}-ayuda-descripcion`;

  const formularioRef = useRef(null);
  const contenedorErroresRef = useRef(null);

  /**
   * Valores con los que arranca el formulario, calculados en el montaje.
   *
   * @returns {object} Estado inicial.
   */
  const valoresIniciales = () =>
    idea
      ? {
          titulo: idea.titulo ?? '',
          descripcion: idea.descripcion ?? '',
          categoria: idea.categoria ?? ORDEN_CATEGORIAS_IDEA[0],
          imagen: idea.imagen ?? null,
        }
      : { ...VACIO };

  const [valores, setValores] = useState(valoresIniciales);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [enviado, setEnviado] = useState(false);

  /*
   * Publica hacia el contenedor si hay algo escrito, para que el aviso de salida
   * tenga un dato fiable y no una estimación.
   *
   * Se compara con los valores del montaje. Un campo que se escribe y se borra
   * vuelve a estar igual, así que no cuenta como cambio: preguntar al salir
   * cuando no hay nada escrito enseña a confirmar sin leer.
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

  /*
   * El foco inicial va al título, no al panel.
   *
   * Sin `autoFocus` de React a propósito: el portal del modal se inserta
   * después, así que el `autoFocus` se aplica antes y luego se pierde. Y sin
   * temporizador, porque los efectos se ejecutan de abajo arriba: este corre
   * antes que el del `Modal`, y ese respeta el foco que ya esté dentro.
   */
  useEffect(() => {
    formularioRef.current?.querySelector('input[type="text"]')?.focus();
  }, []);

  /**
   * Enfoca el primer campo con error; si no hay ninguno, el título.
   *
   * Recibe el mapa de errores como parámetro en lugar de leerlo del estado: el
   * estado del render actual todavía no contiene los errores recién calculados,
   * porque `setErrores` programa el siguiente render.
   *
   * @param {Record<string, string>} erroresPorCampo Errores ya calculados.
   * @returns {void}
   */
  function enfocarPrimerError(erroresPorCampo) {
    const destino = erroresPorCampo.titulo ? idTitulo : idDescripcion;
    setTimeout(() => {
      formularioRef.current?.querySelector(`#${escaparCss(destino)}`)?.focus();
    }, 0);
  }

  /**
   * Pone el foco en el aviso de error general, para que se lea entero.
   *
   * @returns {void}
   */
  function enfocarErrorGeneral() {
    setTimeout(() => {
      contenedorErroresRef.current?.focus();
    }, 0);
  }

  /**
   * Actualiza un campo y borra su error, para que el mensaje desaparezca al
   * corregir en lugar de esperar al siguiente envío.
   *
   * @param {string} nombre Clave del campo.
   * @param {unknown} valor Valor nuevo.
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
   * Valida con la misma función del service y guarda.
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
      limpio = validarIdea(valores);
    } catch (err) {
      if (err instanceof ErrorValidacion) {
        const porCampo = err.erroresPorCampo ?? {};
        setErrores(porCampo);
        enfocarPrimerError(porCampo);
        return;
      }
      setErrorGeneral('No pudimos revisar el formulario. Inténtalo de nuevo.');
      enfocarErrorGeneral();
      return;
    }

    try {
      await onGuardar(limpio);
    } catch (err) {
      if (err instanceof ErrorValidacion) {
        const porCampo = err.erroresPorCampo ?? {};
        setErrores(porCampo);
        enfocarPrimerError(porCampo);
        return;
      }
      setErrorGeneral(err?.message ?? 'No pudimos guardar la idea. Inténtalo de nuevo.');
      enfocarErrorGeneral();
    }
  }

  const errorTitulo = errores.titulo;
  const errorDescripcion = errores.descripcion;
  const restante = LIMITES.DESCRIPCION - valores.descripcion.length;

  return (
    <form ref={formularioRef} onSubmit={manejarEnvio} noValidate className="space-y-5">
      {/*
        `noValidate` desactiva la validación nativa del navegador a propósito:
        sus mensajes salen en el idioma del navegador, no en español, y no se
        pueden enlazar con los `role="alert"` de aquí. Manda
        `validarIdea()`, que es además la que usa el service.
      */}
      {errorGeneral && (
        <div
          ref={contenedorErroresRef}
          role="alert"
          tabIndex={-1}
          className="flex items-start gap-2 rounded-card border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 focus:outline-none focus:ring-2 focus:ring-red-300"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{errorGeneral}</span>
        </div>
      )}

      {/* Título */}
      <div>
        <label htmlFor={idTitulo} className="text-sm font-medium text-slate-800">
          Título
          <span className="ml-0.5 text-accent" aria-hidden="true">
            *
          </span>
          <span className="sr-only">(obligatorio)</span>
        </label>
        <input
          id={idTitulo}
          type="text"
          value={valores.titulo}
          onChange={(e) => cambiar('titulo', e.target.value)}
          placeholder="Picnic en el parque"
          maxLength={LIMITES.TITULO}
          required
          aria-invalid={errorTitulo ? 'true' : undefined}
          aria-describedby={errorTitulo ? idErrorTitulo : undefined}
          className={[
            'mt-1.5 w-full rounded-card border px-3.5 py-2.5 text-sm text-slate-900',
            'placeholder:text-slate-400 focus:outline-none focus:ring-2',
            errorTitulo
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-accent focus:ring-accent/30',
          ].join(' ')}
        />
        {errorTitulo && (
          <p
            id={idErrorTitulo}
            className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700"
          >
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {errorTitulo}
          </p>
        )}
      </div>

      {/* Descripción */}
      <div>
        <label htmlFor={idDescripcion} className="text-sm font-medium text-slate-800">
          Descripción
        </label>
        <textarea
          id={idDescripcion}
          value={valores.descripcion}
          onChange={(e) => cambiar('descripcion', e.target.value)}
          rows={4}
          placeholder="Manta a la sombra, algo de picar y no mirar el reloj."
          maxLength={LIMITES.DESCRIPCION}
          aria-invalid={errorDescripcion ? 'true' : undefined}
          aria-describedby={idAyudaDescripcion}
          className={[
            'mt-1.5 w-full rounded-card border px-3.5 py-2.5 text-sm text-slate-900',
            'placeholder:text-slate-400 focus:outline-none focus:ring-2',
            errorDescripcion
              ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-300 focus:border-accent focus:ring-accent/30',
          ].join(' ')}
        />
        <div className="mt-1.5 flex items-center justify-between">
          <p id={idAyudaDescripcion} className="text-xs text-slate-500">
            Opcional. Sirve para recordar los detalles.
          </p>
          {/*
            El contador solo aparece al escribir. Poner "0/500" antes de nada es
            ruido, y en el móvil, donde el campo es estrecho, es justo donde peor
            se ve.
          */}
          {enviado && valores.descripcion.length > 0 && (
            <span
              className={[
                'text-xs tabular-nums',
                restante < 0 ? 'font-semibold text-red-700' : 'text-slate-400',
              ].join(' ')}
            >
              {valores.descripcion.length}/{LIMITES.DESCRIPCION}
            </span>
          )}
        </div>
        {errorDescripcion && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-700">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {errorDescripcion}
          </p>
        )}
      </div>

      {/* Categoría, tomada del catálogo */}
      <fieldset>
        <legend className="text-sm font-medium text-slate-800">
          Categoría
          <span className="ml-0.5 text-accent" aria-hidden="true">
            *
          </span>
          <span className="sr-only">(obligatorio)</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ORDEN_CATEGORIAS_IDEA.map((clave) => {
            const info = obtenerCategoriaIdea(clave);
            const id = `${baseId}-categoria-${clave}`;
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
                {/*
                  El radio va oculto pero DENTRO del `<label>`, igual que en el
                  formulario de eventos: así el texto del chip es la etiqueta real
                  del control, las flechas recorren el grupo y el foco visible lo
                  pinta el anillo del propio label.
                */}
                <input
                  type="radio"
                  id={id}
                  name={`${baseId}-categoria`}
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
      </fieldset>

      {/* Imagen opcional */}
      <SelectorFoto
        valor={valores.imagen}
        onChange={(dataUrl) => cambiar('imagen', dataUrl)}
        etiqueta="Foto de la idea (opcional)"
      />

      <div className="flex justify-end gap-3 pt-1">
        <Boton variante="fantasma" onClick={onCerrar} type="button">
          Cancelar
        </Boton>
        <Boton variante="primario" type="submit" cargando={guardando}>
          {editando ? 'Guardar cambios' : 'Agregar idea'}
        </Boton>
      </div>
    </form>
  );
}

/**
 * Escapa un id para poder usarlo en un selector CSS.
 *
 * `CSS.escape` no está en todas partes, y los ids que genera `useId()` llevan
 * dos puntos —`:r1:`— que en un selector valen como pseudoclase y rompen la
 * búsqueda. Sin escapar, `querySelector('#:r1:-titulo')` lanza y el foco nunca
 * llega al campo con error.
 *
 * @param {string} id Identificador del elemento.
 * @returns {string} Id apto para un selector CSS.
 * @example
 * escaparCss(':r1:-titulo'); // '\\:r1\\:-titulo'
 */
function escaparCss(id) {
  return id.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
}
