/**
 * Hook `useEventos`.
 *
 * RESPONSABILIDAD: dar a las páginas los eventos y las operaciones sobre
 * ellos, con estado de carga y error. Es la única capa que las páginas usan
 * para hablar con `eventosService`.
 *
 * PATRÓN DE ESTADO LOCAL
 * Tras crear, actualizar o eliminar, el hook actualiza su propia lista en
 * lugar de volver a pedir los datos al service. Así el evento nuevo aparece
 * de inmediato en el calendario y en "Próximos eventos", sin parpadeos ni
 * un round-trip a almacenamiento. Esto es posible porque el service devuelve
 * la entidad ya guardada y normalizada.
 *
 * @see src/services/eventosService.js
 *
 * @module hooks/useEventos
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  crearEvento,
  eliminarEvento,
  getEventos,
  resetEventos,
  actualizarEvento,
} from '../services/eventosService';
import { agruparPorFecha, eventosOrdenados } from '../utils/fechas';

/**
 * @typedef {object} EstadoEventos
 * @property {import('../types/models.js').Evento[]} eventos Todos los eventos,
 *   ordenados por fecha.
 * @property {Map<string, import('../types/models.js').Evento[]>} eventosPorFecha
 *   Índice `YYYY-MM-DD` → eventos de ese día, derivado con `useMemo` para que
 *   el calendario no agrupe dentro de cada celda.
 * @property {boolean} cargando `true` mientras se lee el almacenamiento.
 * @property {string|null} error Mensaje de error listo para mostrar, o `null`.
 * @property {boolean} guardando `true` mientras hay una escritura en curso.
 * @property {(id: string) => Promise<import('../types/models.js').Evento|null>}
 *   obtenerEvento Busca un evento por id. `null` si no existe.
 * @property {(datos: object) => Promise<import('../types/models.js').Evento|null>}
 *   crear Crea un evento. `null` si falló (el error queda en `error`).
 * @property {(id: string, datos: object) => Promise<import('../types/models.js').Evento|null>}
 *   actualizar Modifica un evento existente.
 * @property {(id: string) => Promise<boolean>} eliminar Borra un evento.
 * @property {() => Promise<void>} recargar Vuelve a leer del almacenamiento.
 * @property {() => Promise<void>} restablecer Vuelve a sembrar el seed.
 */

/**
 * Gestiona los eventos de la pareja.
 *
 * @returns {EstadoEventos} Estado y operaciones de eventos.
 * @example
 * const { eventos, cargando, crear } = useEventos();
 * if (cargando) return <Spinner />;
 * return <Calendario eventos={eventos} onCrear={crear} />;
 */
export function useEventos() {
  /*
   * Los datos iniciales se leen al montar. `cargando` empieza en `true` porque
   * hasta que la promesa resuelva no hay nada que mostrar.
   */
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Lee los eventos del service y los guarda en el estado.
   *
   * @param {boolean} [mostrarCarga] Pone `cargando` a `true` mientras lee.
   *   En `false` para la carga inicial, porque el estado ya nace en `true` y
   *   marcarlo otra vez provocaría un render extra sin efecto visible.
   * @returns {Promise<void>} Resuelve cuando la lectura termina.
   */
  const cargar = useCallback(async (mostrarCarga = true, sigueVivo = () => true) => {
    if (mostrarCarga) setCargando(true);

    try {
      const datos = await getEventos();
      if (!sigueVivo()) return;

      setEventos(datos);
      // Limpiamos el error solo cuando la lectura va bien. Hacerlo antes
      // (sincrónicamente, al empezar) provocaría un render extra dentro del
      // efecto, que es justo lo que el linter de React marca como
      // "setState síncrono en un efecto".
      setError(null);
    } catch (err) {
      if (!sigueVivo()) return;

      // `err.message` ya viene en español y sin detalles internos (ver
      // ErrorServicio). No mostramos la pila de llamadas a la persona usuaria.
      setError(err.message ?? 'Algo salió mal.');
    } finally {
      if (sigueVivo()) setCargando(false);
    }
  }, []);

  /*
   * Carga inicial. `cargar` ya es estable (useCallback con dependencias
   * vacías), así que no hay riesgo de bucle: el efecto corre una sola vez.
   *
   * La bandera `cancelado` es lo que hace segura la carga: entre pedir los datos
   * y recibirlos hay un `await`, y en ese hueco la persona puede haber navegado a
   * otra pantalla. Sin la comprobación, las actualizaciones llegarían a un
   * componente desmontado, que en desarrollo lanza un aviso y en producción
   * desperdicia el trabajo de todos modos.
   *
   * Sobre el aviso de `set-state-in-effect`: es una heurística que ve la llamada
   * a `cargar` en el cuerpo del efecto y supone que actualiza estado de forma
   * síncrona. Aquí no ocurre: con `mostrarCarga` en `false` no hay ningún
   * `setState` antes del `await`, y `cargar` es estable, así que el efecto
   * corre una sola vez. No hay render en cascada posible. La comprobación de
   * `cancelado` de arriba es la que evita el problema real.
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
   * Envuelve una escritura: activa `guardando`, captura errores y devuelve el
   * resultado o `null` sin propagar la excepción.
   *
   * Devolver `null` en lugar de lanzar simplifica las páginas: pueden hacer
   * `const evento = await crear(...); if (evento) {...}` y el mensaje de error
   * ya está en el estado `error` para pintarlo.
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
   * Crea un evento y lo añade a la lista local.
   *
   * @param {Partial<import('../types/models.js').Evento>} datos Datos del evento.
   * @returns {Promise<import('../types/models.js').Evento|null>} El evento
   *   creado, o `null` si la validación o el guardado fallaron.
   * @example
   * const evento = await crear({ titulo: 'Cena', fecha: hoyISO(), categoria: 'cita' });
   */
  const crear = useCallback(
    (datos) =>
      ejecutarEscritura(async () => {
        const evento = await crearEvento(datos);
        setEventos((actuales) => eventosOrdenados([...actuales, evento]));
        return evento;
      }),
    [ejecutarEscritura],
  );

  /**
   * Actualiza un evento y lo sustituye en la lista local.
   *
   * @param {string} id Identificador del evento.
   * @param {Partial<import('../types/models.js').Evento>} datos Campos a cambiar.
   * @returns {Promise<import('../types/models.js').Evento|null>} El evento
   *   actualizado, o `null` si falló.
   * @example
   * await actualizar(id, { titulo: 'Cena nueva' });
   */
  const actualizar = useCallback(
    (id, datos) =>
      ejecutarEscritura(async () => {
        const evento = await actualizarEvento(id, datos);
        setEventos((actuales) =>
          eventosOrdenados(
            actuales.map((otro) => (otro.id === id ? evento : otro)),
          ),
        );
        return evento;
      }),
    [ejecutarEscritura],
  );

  /**
   * Elimina un evento y lo quita de la lista local.
   *
   * @param {string} id Identificador del evento.
   * @returns {Promise<boolean>} `true` si se eliminó.
   * @example
   * await eliminar(id);
   */
  const eliminar = useCallback(
    (id) =>
      ejecutarEscritura(async () => {
        const ok = await eliminarEvento(id);
        if (ok) {
          setEventos((actuales) => actuales.filter((otro) => otro.id !== id));
        }
        return ok;
      }),
    [ejecutarEscritura],
  );

  /**
   * Busca un evento por id entre los ya cargados, sin ir al almacenamiento.
   *
   * @param {string} id Identificador del evento.
   * @returns {import('../types/models.js').Evento|null} El evento o `null`.
   */
  const obtenerEvento = useCallback(
    (id) => eventos.find((evento) => evento.id === id) ?? null,
    [eventos],
  );

  /** Vuelve a leer todos los eventos del almacenamiento. */
  const recargar = useCallback(async () => {
    await cargar();
  }, [cargar]);

  /**
   * Borra todo y vuelve a sembrar el seed de ejemplo.
   *
   * Pensado para el botón de Configuración. Avisa antes: borra también las
   * fotos subidas.
   */
  const restablecer = useCallback(
    () =>
      ejecutarEscritura(async () => {
        const nuevos = await resetEventos();
        setEventos(nuevos);
        return nuevos;
      }),
    [ejecutarEscritura],
  );

  /*
   * Índices derivados. Los calculamos una sola vez por cambio de la lista
   * para que el calendario no tenga que agrupar en cada celda.
   */
  const eventosPorFecha = useMemo(() => agruparPorFecha(eventos), [eventos]);

  return {
    eventos,
    eventosPorFecha,
    cargando,
    guardando,
    error,
    obtenerEvento,
    crear,
    actualizar,
    eliminar,
    recargar,
    restablecer,
  };
}
