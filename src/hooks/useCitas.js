/**
 * Hook `useCitas`.
 *
 * RESPONSABILIDAD: dar a las páginas las ideas de cita y las operaciones
 * sobre ellas, con estado de carga, error y filtro. Mismo patrón de estado
 * local que `useEventos`: las mutaciones actualizan la lista sin volver a
 * leer del almacenamiento.
 *
 * El filtro por categoría vive en el hook y no en la página, porque es
 * lógica de presentación compartida entre el planeador y, más adelante, el
 * botón de "convertir en evento".
 *
 * @see src/services/citasService.js
 *
 * @module hooks/useCitas
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  crearIdea,
  eliminarIdea,
  getIdeasCitas,
  resetCitas,
  toggleFavorita,
  actualizarIdea,
} from '../services/citasService';
import { ORDEN_CATEGORIAS_IDEA } from '../utils/categorias';

/** Valor del filtro que significa "sin filtro". */
export const FILTRO_TODAS = 'todas';

/**
 * @typedef {object} EstadoCitas
 * @property {import('../types/models.js').IdeaCita[]} ideas Ideas sin filtrar.
 * @property {import('../types/models.js').IdeaCita[]} ideasFiltradas Ideas
 *   según el filtro activo.
 * @property {import('../types/models.js').IdeaCita[]} favoritas Solo las
 *   marcadas con el corazón.
 * @property {import('../types/models.js').CategoriaIdeaCita|FiltroTodas} filtro
 *   Categoría activa.
 * @property {(c: import('../types/models.js').CategoriaIdeaCita|FiltroTodas) => void}
 *   setFiltro Cambia el filtro.
 * @property {boolean} cargando `true` mientras se lee el almacenamiento.
 * @property {boolean} guardando `true` mientras hay una escritura en curso.
 * @property {string|null} error Mensaje de error listo para mostrar.
 * @property {(datos: object) => Promise<import('../types/models.js').IdeaCita|null>}
 *   crear Crea una idea.
 * @property {(id: string) => Promise<import('../types/models.js').IdeaCita|null>}
 *   alternarFavorita Alterna el corazón de una idea.
 * @property {(id: string, datos: object) => Promise<import('../types/models.js').IdeaCita|null>}
 *   actualizar Modifica una idea.
 * @property {(id: string) => Promise<boolean>} eliminar Borra una idea.
 * @property {() => Promise<void>} recargar Vuelve a leer del almacenamiento.
 * @property {() => Promise<void>} restablecer Vuelve a sembrar el seed.
 */

/**
 * @typedef {'todas'} FiltroTodas
 */

/**
 * Gestiona las ideas de cita y el filtro activo.
 *
 * @returns {EstadoCitas} Estado y operaciones de ideas de cita.
 * @example
 * const { ideasFiltradas, setFiltro, alternarFavorita } = useCitas();
 * <Filtros valor={filtro} onChange={setFiltro} />
 */
export function useCitas() {
  const [ideas, setIdeas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState(FILTRO_TODAS);

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
      // Se limpia el error tras una lectura correcta, no antes: hacerlo al
      // inicio sería un setState síncrono dentro del efecto, que provoca un
      // render en cascada innecesario. Ver la nota equivalente en useEventos.
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

  /** Envuelve una escritura y captura el error en el estado. */
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
   * @param {Partial<import('../types/models.js').IdeaCita>} datos Datos de la idea.
   * @returns {Promise<import('../types/models.js').IdeaCita|null>} La idea creada.
   * @example
   * await crear({ titulo: 'Cocinar algo nuevo', categoria: 'en casa' });
   */
  const crear = useCallback(
    (datos) =>
      ejecutarEscritura(async () => {
        const idea = await crearIdea(datos);
        setIdeas((actuales) =>
          ordenar([...actuales, idea]),
        );
        return idea;
      }),
    [ejecutarEscritura],
  );

  /**
   * Alterna el corazón de favorita.
   *
   * @param {string} id Identificador de la idea.
   * @returns {Promise<import('../types/models.js').IdeaCita|null>} La idea con
   *   el nuevo estado, o `null` si falló.
   * @example
   * await alternarFavorita(id);
   */
  const alternarFavorita = useCallback(
    (id) =>
      ejecutarEscritura(async () => {
        const idea = await toggleFavorita(id);
        if (idea) {
          // Reordenamos porque las favoritas se muestran arriba.
          setIdeas((actuales) =>
            ordenar(actuales.map((otra) => (otra.id === id ? idea : otra))),
          );
        }
        return idea;
      }),
    [ejecutarEscritura],
  );

  /**
   * Actualiza una idea.
   *
   * @param {string} id Identificador de la idea.
   * @param {Partial<import('../types/models.js').IdeaCita>} datos Campos a cambiar.
   * @returns {Promise<import('../types/models.js').IdeaCita|null>} La idea actualizada.
   * @example
   * await actualizar(id, { favorita: false });
   */
  const actualizar = useCallback(
    (id, datos) =>
      ejecutarEscritura(async () => {
        const idea = await actualizarIdea(id, datos);
        setIdeas((actuales) =>
          ordenar(actuales.map((otra) => (otra.id === id ? idea : otra))),
        );
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
        return ok;
      }),
    [ejecutarEscritura],
  );

  /** Vuelve a leer todas las ideas del almacenamiento. */
  const recargar = useCallback(async () => {
    await cargar();
  }, [cargar]);

  /** Borra todo y vuelve a sembrar el seed. */
  const restablecer = useCallback(
    () =>
      ejecutarEscritura(async () => {
        const nuevas = await resetCitas();
        setIdeas(nuevas);
        return nuevas;
      }),
    [ejecutarEscritura],
  );

  /** Ideas según el filtro activo. */
  const ideasFiltradas = useMemo(() => {
    if (filtro === FILTRO_TODAS) return ideas;
    return ideas.filter((idea) => idea.categoria === filtro);
  }, [ideas, filtro]);

  /** Solo las favoritas, para la sección destacada del planeador. */
  const favoritas = useMemo(
    () => ideas.filter((idea) => idea.favorita),
    [ideas],
  );

  /** Opciones de filtro, empezando por "Todas". */
  const opcionesFiltro = useMemo(
    () => [FILTRO_TODAS, ...ORDEN_CATEGORIAS_IDEA],
    [],
  );

  return {
    ideas,
    ideasFiltradas,
    favoritas,
    filtro,
    setFiltro,
    opcionesFiltro,
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

/**
 * Ordena las ideas: favoritas primero, luego por título en español.
 *
 * Réplica local de la ordenación del service. Se necesita también en el
 * cliente para que la lista no salte de posición al alternar un corazón, ya
 * que el service solo ordena al escribir.
 *
 * @param {Array<import('../types/models.js').IdeaCita>} ideas Ideas a ordenar.
 * @returns {Array<import('../types/models.js').IdeaCita>} Nuevo array ordenado.
 * @example
 * ordenar([{titulo:'B',favorita:false},{titulo:'A',favorita:true}]);
 * // → [{titulo:'A',favorita:true},{titulo:'B',favorita:false}]
 */
function ordenar(ideas) {
  return [...ideas].sort((a, b) => {
    if (a.favorita !== b.favorita) return a.favorita ? -1 : 1;
    return String(a.titulo).localeCompare(String(b.titulo), 'es');
  });
}
