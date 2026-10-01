/**
 * Hook `useCitas`.
 *
 * RESPONSABILIDAD: dar a la página del planeador las ideas de cita y las
 * operaciones sobre ellas, con estado de carga, error y guardado. Mismo patrón
 * de estado local que `useEventos`: las mutaciones actualizan la lista sin
 * volver a leer del almacenamiento.
 *
 * LOS FILTROS VIENEN DE FUERA A PROPÓSITO
 * `categoria` y `soloFavoritas` son parámetros, no estado interno. La URL es la
 * única fuente de verdad: quien recibe un enlace con `?categoria=relax` ve esa
 * vista, el botón "Atrás" deshace un cambio de filtro y recargar mantiene lo que
 * se estaba viendo. Si el filtro viviera aquí dentro, la URL y la lista
 * empezarían a discrepar en cuanto alguien pulsara atrás.
 *
 * Related: src/services/citasService.js, src/utils/planeador.js,
 * src/pages/Planeador.jsx
 *
 * @module hooks/useCitas
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { crearIdea, eliminarIdea, getIdeasCitas, resetCitas, toggleFavorita, actualizarIdea } from '../services/citasService';
import { FILTRO_TODAS, filtrarIdeas, ordenarIdeas } from '../utils/planeador';

/**
 * @typedef {object} EstadoCitas
 * @property {import('../types/models.js').IdeaCita[]} ideas Ideas sin filtrar,
 *   ya ordenadas.
 * @property {import('../types/models.js').IdeaCita[]} ideasFiltradas Ideas
 *   según los filtros activos.
 * @property {import('../types/models.js').IdeaCita[]} favoritas Solo las
 *   marcadas con el corazón.
 * @property {boolean} hayFiltros `true` si algún filtro está activo.
 * @property {boolean} cargando `true` mientras se lee el almacenamiento.
 * @property {boolean} guardando `true` mientras hay una escritura en curso.
 * @property {string|null} error Mensaje de error listo para mostrar.
 * @property {(datos: object) => Promise<import('../types/models.js').IdeaCita|null>}
 *   crear Crea una idea.
 * @property {(id: string) => Promise<boolean>} alternarFavorita Alterna el
 *   corazón. Devuelve `false` si el cambio no se pudo guardar, en cuyo caso la
 *   lista ya ha vuelto a su estado anterior.
 * @property {(id: string, datos: object) => Promise<import('../types/models.js').IdeaCita|null>}
 *   actualizar Modifica una idea.
 * @property {(id: string) => Promise<boolean>} eliminar Borra una idea.
 * @property {() => Promise<void>} recargar Vuelve a leer del almacenamiento.
 * @property {() => Promise<void>} restablecer Vuelve a sembrar el seed.
 */

/**
 * @typedef {object} OpcionesCitas
 * @property {string} [categoria] Categoría activa, o {@link FILTRO_TODAS}.
 * @property {boolean} [soloFavoritas] Si solo se muestran las favoritas.
 */

/**
 * Gestiona las ideas de cita y los filtros que las recortan.
 *
 * @param {OpcionesCitas} [opciones] Filtros activos, que la página lee de la URL.
 * @returns {EstadoCitas} Estado y operaciones de ideas de cita.
 * @example
 * const { ideasFiltradas, alternarFavorita } = useCitas({ categoria: 'relax' });
 * <FiltrosIdeas valor={categoria} onChange={setCategoria} />
 */
export function useCitas({ categoria = FILTRO_TODAS, soloFavoritas = false } = {}) {
  const [ideas, setIdeas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Lee las ideas del service.
   *
   * @param {boolean} [mostrarCarga] Pone `cargando` a `true` mientras lee. En
   *   la carga inicial se pasa `false` porque el estado ya nace en `true` y
   *   repetirlo solo provocaría un render extra.
   * @param {() => boolean} [sigueVivo] Si devuelve `false`, se abandona la
   *   lectura sin tocar el estado. Lo usa el efecto de carga inicial: si quien
   *   navega a otra página mientras se lee, el componente se desmonta y las
   *   actualizaciones llegarían a un componente que ya no existe.
   * @returns {Promise<void>} Resuelve cuando la lectura termina.
   */
  const cargar = useCallback(async (mostrarCarga = true, sigueVivo = () => true) => {
    if (mostrarCarga) setCargando(true);

    try {
      const datos = await getIdeasCitas();
      if (!sigueVivo()) return;

      setIdeas(datos);
      // El error se limpia tras una lectura correcta, no antes: hacerlo al
      // principio sería un setState síncrono dentro del efecto y provocaría un
      // render en cascada. Ver la nota equivalente en `useEventos`.
      setError(null);
    } catch (err) {
      if (!sigueVivo()) return;
      setError(err.message ?? 'Algo salió mal.');
    } finally {
      if (sigueVivo()) setCargando(false);
    }
  }, []);

  /*
   * Carga inicial.
   *
   * La bandera `cancelado` es lo que hace segura la carga: entre pedir los datos
   * y recibirlos hay un `await`, y en ese hueco la persona puede haber navegado a
   * otra pantalla. Sin la comprobación, las actualizaciones llegarían a un
   * componente desmontado, que en desarrollo lanza un aviso y en producción
   * desperdicia el trabajo de todos modos.
   *
   * El aviso de `set-state-in-effect` es una heurística: supone que `cargar`
   * actualiza estado de forma síncrona, pero con `mostrarCarga` en `false` el
   * primer `setState` llega tras el `await`, y como `cargar` es estable el
   * efecto corre una sola vez. No puede haber render en cascada.
   */
  useEffect(() => {
    let cancelado = false;
    // oxlint-disable-next-line react/set-state-in-effect
    cargar(false, () => !cancelado);

    return () => {
      cancelado = true;
    };
  }, [cargar]);

  /**
   * Envuelve una escritura y captura el error en el estado.
   *
   * @param {() => Promise<any>} operacion Escritura a ejecutar.
   * @returns {Promise<any>} Lo que devuelva la operación, o `null` si falló.
   */
  const ejecutarEscritura = useCallback(async (operacion) => {
    setGuardando(true);
    setError(null);

    try {
      return await operacion();
    } catch (err) {
      setError(err.message ?? 'No pudimos guardar los cambios.');
      return null;
    } finally {
      setGuardando(false);
    }
  }, []);

  /**
   * Crea una idea y la añade a la lista local.
   *
   * @param {object} datos Datos de la idea, ya validados por el formulario.
   * @returns {Promise<import('../types/models.js').IdeaCita|null>} La idea creada,
   *   o `null` si falló.
   * @example
   * await crear({ titulo: 'Cocinar algo nuevo', categoria: 'en-casa' });
   */
  const crear = useCallback(
    (datos) =>
      ejecutarEscritura(async () => {
        const idea = await crearIdea(datos);
        setIdeas((actuales) => ordenarIdeas([...actuales, idea]));
        return idea;
      }),
    [ejecutarEscritura],
  );

  /**
   * Alterna el corazón de una idea, con actualización optimista.
   *
   * LA LISTA CAMBIA ANTES DE ESCRIBIR. Marcar un favorito es la acción más
   * frecuente del planeador y cada escritura pasa por `localStorage`, que es
   * síncrono pero puede tardar en un móvil con almacenamiento lleno. Si la
   * lista esperase, el corazón tardaría en moverse y parecería que no funciona.
   *
   * Y SI LA ESCRITURA FALLA, SE VUELVE ATRÁS. Se guarda la idea tal como
   * estaba antes del pulso y se restaura. Sin ese paso, la pantalla mentiría: se
   * vería un corazón marcado que al recargar desaparecería, y nadie sabría si
   * se había guardado. El mensaje de error lo pone la página, que es quien
   * decide cómo se avisa; aquí solo se devuelve `false`.
   *
   * La lista se reordena con el cambio optimista, porque las favoritas se
   * muestran arriba: si no, la tarjeta saltaría de sitio de forma más
   * desconcertante que la propia espera.
   *
   * @param {string} id Identificador de la idea.
   * @returns {Promise<boolean>} `true` si se guardó el cambio, `false` si hubo
   *   que revertirlo.
   * @example
   * const ok = await alternarFavorita(id);
   * if (!ok) avisar('No se pudo guardar el favorito.');
   */
  const alternarFavorita = useCallback(
    (id) =>
      ejecutarEscritura(async () => {
        const anterior = ideas.find((otra) => otra.id === id);
        if (!anterior) return false;

        setIdeas((actuales) =>
          ordenarIdeas(
            actuales.map((otra) =>
              otra.id === id ? { ...otra, favorita: otra.favorita !== true } : otra,
            ),
          ),
        );

        try {
          const guardada = await toggleFavorita(id);
          if (!guardada) {
            setIdeas((actuales) =>
              ordenarIdeas(actuales.map((otra) => (otra.id === id ? anterior : otra))),
            );
            return false;
          }
          // Se sustituye por lo que devuelva el service, no por lo que se
          // suponía: si el almacenamiento normaliza algo, la lista refleja la
          // realidad y no una intención.
          setIdeas((actuales) =>
            ordenarIdeas(actuales.map((otra) => (otra.id === id ? guardada : otra))),
          );
          return true;
        } catch (err) {
          setIdeas((actuales) =>
            ordenarIdeas(actuales.map((otra) => (otra.id === id ? anterior : otra))),
          );
          throw err;
        }
      }),
    [ejecutarEscritura, ideas],
  );

  /**
   * Actualiza una idea.
   *
   * @param {string} id Identificador de la idea.
   * @param {object} datos Campos a cambiar, ya validados por el formulario.
   * @returns {Promise<import('../types/models.js').IdeaCita|null>} La idea
   *   actualizada, o `null` si falló.
   * @example
   * await actualizar(id, { titulo: 'Picnic corto' });
   */
  const actualizar = useCallback(
    (id, datos) =>
      ejecutarEscritura(async () => {
        const idea = await actualizarIdea(id, datos);
        if (idea) {
          setIdeas((actuales) =>
            ordenarIdeas(actuales.map((otra) => (otra.id === id ? idea : otra))),
          );
        }
        return idea;
      }),
    [ejecutarEscritura],
  );

  /**
   * Elimina una idea.
   *
   * @param {string} id Identificador de la idea.
   * @returns {Promise<boolean>} `true` si se eliminó.
   * @example
   * await eliminar(id);
   */
  const eliminar = useCallback(
    (id) =>
      ejecutarEscritura(async () => {
        const ok = await eliminarIdea(id);
        if (ok) {
          setIdeas((actuales) => actuales.filter((otra) => otra.id !== id));
        }
        return ok === true;
      }),
    [ejecutarEscritura],
  );

  /** Vuelve a leer todas las ideas del almacenamiento. */
  const recargar = useCallback(async () => {
    await cargar();
  }, [cargar]);

  /**
   * Borra todo y vuelve a sembrar el seed.
   *
   * @returns {Promise<void>} Termina cuando el restablecimiento acaba.
   */
  const restablecer = useCallback(
    () =>
      ejecutarEscritura(async () => {
        const nuevas = await resetCitas();
        setIdeas(nuevas);
        return nuevas;
      }),
    [ejecutarEscritura],
  );

  /** Ideas según los filtros activos, sin reordenar. */
  const ideasFiltradas = useMemo(
    () => filtrarIdeas(ideas, { categoria, soloFavoritas }),
    [ideas, categoria, soloFavoritas],
  );

  /** Solo las favoritas, para el contador del interruptor. */
  const favoritas = useMemo(() => ideas.filter((idea) => idea.favorita), [ideas]);

  /** `true` si hay algún filtro que pueda quitarse con un clic. */
  const hayFiltros = categoria !== FILTRO_TODAS || soloFavoritas === true;

  return {
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
    recargar,
    restablecer,
  };
}
