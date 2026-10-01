/**
 * Página `Planeador`.
 *
 * RESPONSABILIDAD: la pantalla de ideas de cita. Muestra la lista, aplica los
 * filtros, deja crear, editar, borrar y marcar favoritas, y convierte una idea
 * en evento abriendo el formulario de eventos con sus datos ya puestos.
 *
 * LA URL ES EL ESTADO DE LOS FILTROS
 * `?categoria=` y `?favoritas=1` son la única fuente de verdad. La razón es
 * concreta: un enlace con filtro tiene que abrir esa vista, recargar tiene que
 * mantenerla y el botón "Atrás" tiene que deshacer un cambio. Un filtro en un
 * `useState` de la página cumple las tres solo por casualidad, y en cuanto se
 * llega desde un enlace con `?categoria=relax` pintado, deja de cumplirlas.
 *
 * Related: src/hooks/useCitas.js, src/components/citas/, src/utils/planeador.js
 *
 * @module pages/Planeador
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Lightbulb, Plus, Trash2 } from 'lucide-react';
import Boton from '../components/ui/Boton';
import Modal from '../components/ui/Modal';
import FiltrosIdeas from '../components/citas/FiltrosIdeas';
import IdeaFormModal from '../components/citas/IdeaFormModal';
import TarjetaIdea from '../components/citas/TarjetaIdea';
import EventoFormModal from '../components/eventos/EventoFormModal';
import { useCitas } from '../hooks/useCitas';
import { useEventos } from '../hooks/useEventos';
import {
  FILTRO_TODAS,
  escribirFiltros,
  ideaAValoresEvento,
  leerCategoriaDeUrl,
  leerSoloFavoritasDeUrl,
} from '../utils/planeador';

/**
 * Estado cerrado del formulario de idea.
 *
 * Un solo objeto para el alta y la edición, en vez de dos estados
 * independientes: con `formulario.idea` presente se edita y sin ella se crea.
 * Dos estados sueltos podrían quedar en "creando" y "editando" a la vez, que es
 * la forma más fácil de que el formulario abra con los datos de la idea
 * equivocada.
 *
 * @type {Readonly<{abierto: boolean, idea: import('../types/models.js').IdeaCita|null}>}
 */
const FORMULARIO_CERRADO = Object.freeze({ abierto: false, idea: null });

/**
 * Renderiza el planeador de citas.
 *
 * @returns {import('react').ReactElement} Página del planeador.
 * @example
 * <Planeador />
 */
export default function Planeador() {
  const [parametros, setParametros] = useSearchParams();

  /*
   * Los filtros se leen de la URL en cada render, no se guardan en estado. Así
   * el botón "Atrás" del navegador y un enlace recibido por WhatsApp funcionan
   * sin ningún código que los escuche: basta con volver a leer los parámetros.
   */
  const categoria = leerCategoriaDeUrl(parametros);
  const soloFavoritas = leerSoloFavoritasDeUrl(parametros);

  const {
    ideas,
    ideasFiltradas,
    favoritas,
    hayFiltros,
    cargando,
    guardando,
    error,
    crear,
    actualizar,
    alternarFavorita,
    eliminar,
  } = useCitas({ categoria, soloFavoritas });

  /*
   * El evento creado al convertir una idea lo guarda `useEventos`. Se usa su
   * propio hook y no el de otra página: leer el almacenamiento una vez por cada
   * idea convertida traería eventos de otra couple si la pareja hubiera cambiado
   * en otra pestaña, y aquí solo hace falta la función de alta.
   */
  const { crear: crearEvento, guardando: guardandoEvento } = useEventos();

  const [formulario, setFormulario] = useState(FORMULARIO_CERRADO);
  const [aBorrar, setABorrar] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [aviso, setAviso] = useState(null);

  /**
   * Escribe un filtro nuevo en la URL y limpia el aviso en curso.
   *
   * `escribirFiltros` devuelve una cadena vacía cuando no queda ningún filtro,
   * y una cadena vacía es lo que React Router espera para quitar los
   * parámetros. Devolver `undefined` provocaría el aviso "Cannot update a
   * component while rendering a different component".
   *
   * @param {{categoria: string, soloFavoritas: boolean}} filtros Filtros nuevos.
   * @returns {void}
   */
  const aplicarFiltros = useCallback(
    (filtros) => {
      setAviso(null);
      setParametros(escribirFiltros(parametros, filtros));
    },
    [parametros, setParametros],
  );

  /** Quita los dos filtros de golpe. */
  const limpiarFiltros = useCallback(() => {
    setAviso(null);
    setParametros(escribirFiltros(parametros, { categoria: FILTRO_TODAS, soloFavoritas: false }));
  }, [parametros, setParametros]);

  /** Abre el formulario de alta. */
  const abrirAlta = useCallback(() => {
    setAviso(null);
    setFormulario({ abierto: true, idea: null });
  }, []);

  /**
   * Abre el formulario sobre una idea concreta.
   *
   * @param {import('../types/models.js').IdeaCita} idea Idea a editar.
   * @returns {void}
   */
  const abrirEdicion = useCallback((idea) => {
    setAviso(null);
    setFormulario({ abierto: true, idea });
  }, []);

  /** Cierra el formulario de idea. */
  const cerrarFormulario = useCallback(() => {
    setFormulario(FORMULARIO_CERRADO);
  }, []);

  /**
   * Guarda lo que salga del formulario, creando o editando.
   *
   * EL ID SE SACA DEL ESTADO DEL FORMULARIO, NO DE LO QUE LLEGA. `validarIdea`
   * devuelve solo los campos que conoce y descarta el resto, así que un `id` en
   * los datos ya no estaría cuando llegara aquí. Si el id fuera a parar al
   * servicio por otra vía, el servicio lo borraría; y si esta función lo leyera
   * de los datos, nunca encontraría nada y cada edición crearía una idea nueva
   * en lugar de cambiar la anterior.
   *
   * No se cierra el modal aquí: lo cierra quien lo ha abierto, después de
   * comprobar que el guardado funcionó. Si se cerrara antes de saber si la
   * escritura tuvo éxito, un fallo de cuota dejaría a quien está delante sin
   * formulario y con lo escrito perdido.
   *
   * @param {object} datos Idea ya validada, con `id` si es edición.
   * @returns {Promise<void>} Termina cuando la idea está guardada.
   */
  const guardarIdea = useCallback(
    async (datos) => {
      const idAEditar = formulario.idea?.id;
      const guardada = idAEditar ? await actualizar(idAEditar, datos) : await crear(datos);
      if (!guardada) {
        throw new Error('No pudimos guardar la idea.');
      }
      cerrarFormulario();
    },
    [crear, actualizar, cerrarFormulario, formulario.idea],
  );

  /**
   * Alterna el corazón y avisa si el cambio no se pudo guardar.
   *
   * El aviso va en un `role="alert"` propio y no en el error del hook, porque
   * los dos casos se mezclan mal: un fallo al marcar un favorito entre veinte
   * tarjetas se entendería mejor si estuviera junto a la lista que como un
   * error general de la página.
   *
   * @param {import('../types/models.js').IdeaCita} idea Idea a marcar.
   * @returns {Promise<void>} Termina cuando el cambio está guardado o revertido.
   */
  const marcarFavorita = useCallback(
    async (idea) => {
      const ok = await alternarFavorita(idea.id);
      setAviso(
        ok
          ? null
          : 'No se pudo guardar esa idea como favorita. Se ha vuelto a como estaba.',
      );
    },
    [alternarFavorita],
  );

  /**
   * Pide confirmación antes de borrar, porque no hay forma de recuperarlo.
   *
   * @param {import('../types/models.js').IdeaCita} idea Idea a borrar.
   * @returns {void}
   */
  const pedirBorrado = useCallback((idea) => {
    setAviso(null);
    setABorrar(idea);
  }, []);

  /**
   * Borra la idea pendiente de confirmación.
   *
   * @returns {Promise<void>} Termina cuando el borrado acaba.
   */
  const confirmarBorrado = useCallback(async () => {
    const idea = aBorrar;
    if (!idea) return;
    const ok = await eliminar(idea.id);
    setABorrar(null);
    setAviso(ok ? null : 'No se pudo borrar esa idea.');
  }, [aBorrar, eliminar]);

  /**
   * Abre el formulario de evento con los datos de una idea.
   *
   * La idea NO se borra ni se marca: sigue en el planeador. Convertir es
   * "esto ya tiene día", no "esto era una mentira".
   *
   * @param {import('../types/models.js').IdeaCita} idea Idea a convertir.
   * @returns {void}
   */
  const convertir = useCallback((idea) => {
    setAviso(null);
    setConversion({ idea, valores: ideaAValoresEvento(idea) });
  }, []);

  /** Cierra el formulario de conversión. */
  const cerrarConversion = useCallback(() => {
    setConversion(null);
  }, []);

  /**
   * Crea el evento a partir de la idea y avisa de que ya existe en el
   * calendario.
   *
   * @param {object} datos Evento ya validado por el formulario.
   * @returns {Promise<void>} Termina cuando el evento está creado.
   */
  const guardarConversion = useCallback(
    async (datos) => {
      await crearEvento(datos);
      setConversion(null);
      setAviso(`"${datos.titulo}" ya está en el calendario. La idea sigue aquí, por si queréis repetirla.`);
    },
    [crearEvento],
  );

  /**
   * Texto del estado vacío, distinto según el motivo.
   *
   * Son tres casos y no uno porque el mensaje es lo único que explica qué
   * hacer: si no hay ninguna idea, hay que crear; si hay ideas pero el filtro no
   * deja ver ninguna, hay que quitar el filtro. Con un único "no hay nada"
   * quien activa "solo favoritas" sin ninguna marcada no sabe qué ha hecho mal.
   */
  const mensajeVacio = useMemo(() => {
    if (ideas.length === 0) {
      return 'Todavía no hay ideas. Añadid la primera: cualquier tontería sirve, la mejor de todas suele ser "quedarnos en casa".';
    }
    if (soloFavoritas) {
      return 'No hay ninguna idea marcada como favorita todavía. Marca el corazón de la que os apetezca o quita el interruptor para verlas todas.';
    }
    return `No hay ideas de esta categoría.${hayFiltros ? ' Prueba con otra o quita el filtro.' : ''}`;
  }, [ideas.length, soloFavoritas, hayFiltros]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-slate-900 sm:text-3xl">
            Planeador de citas
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {ideas.length === 0
              ? 'Ideas sueltas. Cuando hagáis una, aparecerá en el calendario.'
              : `${ideas.length} ${ideas.length === 1 ? 'idea' : 'ideas'}${favoritas.length > 0 ? ` · ${favoritas.length} ${favoritas.length === 1 ? 'favorita' : 'favoritas'}` : ''}`}
          </p>
        </div>

        <Boton onClick={abrirAlta}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva idea
        </Boton>
      </header>

      {/*
        Los dos avisos no compiten: `error` es del hook y `aviso`, de las acciones
        que lo revierten. Se pintan en sitios distintos y no se pisan entre sí.
      */}
      {error && (
        <p role="alert" className="rounded-card bg-accent/10 px-4 py-3 text-sm text-slate-700">
          {error}
        </p>
      )}

      {aviso && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-card bg-accent/10 px-4 py-3 text-sm text-slate-700"
        >
          <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{aviso}</span>
        </p>
      )}

      {!cargando && ideas.length > 0 && (
        <FiltrosIdeas
          categoria={categoria}
          soloFavoritas={soloFavoritas}
          countCuadra={ideasFiltradas.length}
          countTotal={ideas.length}
          countFavoritas={favoritas.length}
          hayFiltros={hayFiltros}
          onCambio={aplicarFiltros}
          onLimpiar={limpiarFiltros}
        />
      )}

      {cargando ? (
        <p className="rounded-card bg-surface p-8 text-center text-sm text-slate-500 shadow-card">
          Cargando las ideas…
        </p>
      ) : ideasFiltradas.length === 0 ? (
        <div className="rounded-card bg-surface p-8 text-center shadow-card">
          <p className="text-sm text-slate-600">{mensajeVacio}</p>
          {hayFiltros && (
            <div className="mt-4 flex justify-center">
              <Boton variante="fantasma" onClick={limpiarFiltros}>
                Quitar filtros
              </Boton>
            </div>
          )}
        </div>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {ideasFiltradas.map((idea) => (
            <li key={idea.id} className="flex">
              <div className="flex w-full">
                <TarjetaIdea
                  idea={idea}
                  onFavorita={() => marcarFavorita(idea)}
                  onEditar={() => abrirEdicion(idea)}
                  onBorrar={() => pedirBorrado(idea)}
                  onConvertir={() => convertir(idea)}
                  guardando={guardando}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <IdeaFormModal
        abierto={formulario.abierto}
        idea={formulario.idea}
        guardando={guardando}
        onCerrar={cerrarFormulario}
        onGuardar={guardarIdea}
      />

      {/*
        La conversión reutiliza el formulario de evento entero, con los valores de
        la idea ya puestos y la fecha vacía. La `key` incluye el id de la idea
        para que convertir una idea tras otra remonte el formulario: si no, el
        título de la primera se quedaría en el de la segunda.
      */}
      <EventoFormModal
        key={conversion ? `convertir-${conversion.idea.id}` : 'convertir-ninguna'}
        abierto={conversion !== null}
        valoresIniciales={conversion?.valores}
        guardando={guardandoEvento}
        onCerrar={cerrarConversion}
        onGuardar={guardarConversion}
      />

      {aBorrar && (
        <ConfirmarBorrado
          titulo={aBorrar.titulo}
          onCancelar={() => setABorrar(null)}
          onConfirmar={confirmarBorrado}
        />
      )}
    </div>
  );
}

/**
 * Diálogo de confirmación del borrado de una idea.
 *
 * Va en su propio modal y no en un `alert`, por lo mismo que el aviso de salida
 * del formulario: `alert()` bloquea, no se puede estilar y su texto no lleva la
 * tipografía de la app.
 *
 * El mensaje que explica qué va a pasar se marca como descripción del diálogo,
 * no como un simple párrafo suelto. Con `aria-describedby`, el lector de
 * pantalla lee el título y la descripción al abrir, sin que haya que navegar
 * hasta el texto: es justo la información que hace falta para decidir.
 *
 * @param {object} props Propiedades del diálogo.
 * @param {string} props.titulo Título de la idea que se va a borrar.
 * @param {() => void} props.onCancelar Cierra sin borrar.
 * @param {() => Promise<void>} props.onConfirmar Borra y cierra.
 * @returns {import('react').ReactElement} Modal de confirmación.
 */
function ConfirmarBorrado({ titulo, onCancelar, onConfirmar }) {
  const cancelarRef = useRef(null);

  /*
   * El foco inicial va a la opción que no destruye nada. `Modal` pone el foco
   * en el panel para que se anuncie, y con teclado o lector de pantalla el
   * siguiente Tab caería en "Borrar la idea": es decir, la acción destructiva
   * sería la primera que se alcanza por inercia. Con doble pulsación de Intro —
   * como hace quien navega sin mirar —, esa idea desaparecería.
   */
  useEffect(() => {
    cancelarRef.current?.focus();
  }, []);

  return (
    <Modal
      abierto
      onCerrar={onCancelar}
      titulo="¿Borrar esta idea?"
      descripcion="No se puede deshacer."
      ancho="sm"
      // `alertdialog` y no `dialog`: la pregunta es urgente y destructiva, y el
      // lector de pantalla tiene que enterarse de que la está esperando.
      rol="alertdialog"
      // El párrafo de abajo, con el nombre de la idea, también describe el
      // diálogo: así el lector lee "qué va a pasar" y "con qué" al abrir, sin
      // tener que navegar hasta el texto.
      descripcionAdicional={['confirmar-borrado-aviso']}
    >
      <div className="space-y-5">
        <p id="confirmar-borrado-aviso" className="text-sm text-slate-700">
          Vas a borrar <strong className="font-semibold text-slate-900">{titulo}</strong>. Si
          la queríais para otro día, convertidla en evento antes: eso sí se puede volver a
          revisar.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Boton
            ref={cancelarRef}
            variante="fantasma"
            onClick={onCancelar}
            type="button"
          >
            Dejarla
          </Boton>
          <Boton variante="primario" onClick={onConfirmar} type="button">
            <Trash2 className="size-4" aria-hidden="true" />
            Borrar la idea
          </Boton>
        </div>
      </div>
    </Modal>
  );
}
