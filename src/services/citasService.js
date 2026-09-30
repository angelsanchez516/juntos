/**
 * Servicio de ideas de cita.
 *
 * RESPONSABILIDAD: única puerta de entrada a los datos del planeador de
 * citas. La misma filosofía que `eventosService`: API asíncrona, validación en
 * la capa de datos y errores ya formateados para la UI.
 *
 * Las ideas no tienen fecha: son propuestas. Cuando la pareja decide hacer una,
 * se convierte en un Evento (ver `convertirIdeaEnEvento`).
 *
 * SEGURIDAD: mismas consideraciones que `eventosService`.
 * TODO-FASE2 (SEGURIDAD): migrar a Supabase. La lista de ideas de cita puede
 * ser compartida entre ambas personas de la pareja, así que necesita la misma
 * política RLS por `pareja_id`.
 *
 * Related: src/services/eventosService.js, src/services/storage.js,
 * src/hooks/useCitas.js, src/data/seed.js
 *
 * @module services/citasService
 */

import { crearIdeasSeed } from '../data/seed';
import { nuevoId } from '../utils/ids';
import { ErrorValidacion, esIdValido, validarIdea } from '../utils/validaciones';
import { COLECCIONES, ErrorCuotaAlmacenamiento, borrar, guardar, leer } from './storage';
import { ErrorServicio, crearEvento } from './eventosService';

/**
 * Lee las ideas de cita, sembrando las de ejemplo la primera vez.
 *
 * @returns {Promise<Array<import('../types/models.js').IdeaCita>>} Ideas,
 *   con las favoritas primero y luego por título.
 * @throws {ErrorServicio} Si no se pueden leer ni guardar los datos.
 * @example
 * const ideas = await getIdeasCitas();
 * ideas.filter((i) => i.favorita).length; // 2
 */
export async function getIdeasCitas() {
  try {
    const guardadas = leer(COLECCIONES.CITAS);

    if (guardadas === null) {
      const seed = ordenarIdeas(crearIdeasSeed());
      guardar(COLECCIONES.CITAS, seed);
      return seed;
    }

    return ordenarIdeas(guardadas);
  } catch (error) {
    /*
     * El error de cuota se propaga sin envolver. En `getIdeasCitas` ocurre al
     * guardar el seed la primera vez, y si se envolviera en `ErrorServicio` la
     * interfaz mostraría "no pudimos cargar las ideas", que no dice nada
     * accionable, en lugar del aviso de liberar espacio que sí lo dice.
     */
    if (error instanceof ErrorCuotaAlmacenamiento) {
      console.error('[citasService] Cuota agotada al leer las ideas.', error);
      throw error;
    }

    console.error('[citasService] Error al obtener las ideas.', error);
    throw new ErrorServicio(
      'No pudimos cargar las ideas de cita. Inténtalo de nuevo.',
      error,
    );
  }
}

/**
 * Ordena las ideas: favoritas primero, luego alfabéticamente por título.
 *
 * Es el orden que espera la interfaz del planeador, donde las favoritas se
 * muestran al principio de la lista.
 *
 * @param {Array<import('../types/models.js').IdeaCita>} ideas Ideas a ordenar.
 * @returns {Array<import('../types/models.js').IdeaCita>} Nuevo array ordenado,
 *   sin mutar el original.
 * @example
 * ordenarIdeas(ideas)[0].favorita; // true
 */
function ordenarIdeas(ideas) {
  return [...ideas].sort((a, b) => {
    if (a.favorita !== b.favorita) return a.favorita ? -1 : 1;
    return String(a.titulo).localeCompare(String(b.titulo), 'es');
  });
}

/**
 * Busca una idea por su identificador.
 *
 * @param {string} id Identificador de la idea.
 * @returns {Promise<import('../types/models.js').IdeaCita|null>} La idea, o
 *   `null` si no existe o el id no es válido.
 * @example
 * const idea = await getIdeaById(id);
 */
export async function getIdeaById(id) {
  if (!esIdValido(id)) return null;

  try {
    const ideas = await getIdeasCitas();
    return ideas.find((idea) => idea.id === id) ?? null;
  } catch (error) {
    console.error('[citasService] Error al buscar la idea.', error);
    throw new ErrorServicio('No pudimos cargar esa idea.', error);
  }
}

/**
 * Crea una idea de cita nueva.
 *
 * @param {Partial<import('../types/models.js').IdeaCita>} datos Datos de la
 *   idea. `id` lo asigna el service.
 * @returns {Promise<import('../types/models.js').IdeaCita>} La idea creada.
 * @throws {ErrorValidacion} Si los datos no superan la validación.
 * @throws {ErrorServicio} Si no se puede guardar.
 * @example
 * const idea = await crearIdea({
 *   titulo: 'Bailar en la sala',
 *   categoria: 'en casa',
 * });
 */
export async function crearIdea(datos) {
  const limpio = validarIdea(datos);

  try {
    const ideas = await getIdeasCitas();
    const idea = { ...limpio, id: nuevoId() };

    guardar(COLECCIONES.CITAS, ordenarIdeas([...ideas, idea]));
    return idea;
  } catch (error) {
    console.error('[citasService] Error al crear la idea.', error);
    throw new ErrorServicio(
      error.message || 'No pudimos guardar la idea.',
      error,
    );
  }
}

/**
 * Actualiza una idea existente.
 *
 * @param {string} id Identificador de la idea.
 * @param {Partial<import('../types/models.js').IdeaCita>} datos Campos a
 *   cambiar, fusionados con los existentes.
 * @returns {Promise<import('../types/models.js').IdeaCita>} La idea
 *   actualizada.
 * @throws {ErrorValidacion} Si el resultado no supera la validación.
 * @throws {ErrorServicio} Si la idea no existe o no se puede guardar.
 * @example
 * await actualizarIdea(id, { favorita: true });
 */
export async function actualizarIdea(id, datos) {
  if (!esIdValido(id)) {
    throw new ErrorServicio('Esa idea no existe.');
  }

  try {
    const ideas = await getIdeasCitas();
    const indice = ideas.findIndex((idea) => idea.id === id);

    if (indice === -1) {
      throw new ErrorServicio('Esa idea ya no existe.');
    }

    const existente = ideas[indice];
    // `id` no es entrada de usuario: se restaura aunque venga en `datos`.
    const { id: _ignorado, ...campos } = datos ?? {};

    const limpio = validarIdea({ ...existente, ...campos });
    const actualizada = { ...limpio, id: existente.id };

    const copia = [...ideas];
    copia[indice] = actualizada;
    guardar(COLECCIONES.CITAS, ordenarIdeas(copia));

    return actualizada;
  } catch (error) {
    if (error instanceof ErrorValidacion || error instanceof ErrorServicio) {
      throw error;
    }
    console.error('[citasService] Error al actualizar la idea.', error);
    throw new ErrorServicio('No pudimos guardar los cambios.', error);
  }
}

/**
 * Marca o desmarca una idea como favorita.
 *
 * Atajo de `actualizarIdea(id, { favorita: !actual })` para el corazón del
 * planeador, que solo necesita alternar un booleano.
 *
 * @param {string} id Identificador de la idea.
 * @returns {Promise<import('../types/models.js').IdeaCita|null>} La idea con el
 *   nuevo estado de favorita, o `null` si no existe.
 * @throws {ErrorServicio} Si no se puede guardar.
 * @example
 * const idea = await toggleFavorita(id); // idea.favorita ahora es true
 */
export async function toggleFavorita(id) {
  if (!esIdValido(id)) return null;

  const idea = await getIdeaById(id);
  if (!idea) return null;

  return actualizarIdea(id, { favorita: !idea.favorita });
}

/**
 * Elimina una idea de cita.
 *
 * @param {string} id Identificador de la idea.
 * @returns {Promise<boolean>} `true` si se eliminó, `false` si no existía.
 * @throws {ErrorServicio} Si no se puede guardar el cambio.
 * @example
 * await eliminarIdea(id);
 */
export async function eliminarIdea(id) {
  if (!esIdValido(id)) return false;

  try {
    const ideas = await getIdeasCitas();
    const restantes = ideas.filter((idea) => idea.id !== id);

    if (restantes.length === ideas.length) return false;

    guardar(COLECCIONES.CITAS, restantes);
    return true;
  } catch (error) {
    console.error('[citasService] Error al eliminar la idea.', error);
    throw new ErrorServicio('No pudimos eliminar esa idea.', error);
  }
}

/**
 * Convierte una idea de cita en un evento con fecha.
 *
 * La idea conserva su título, descripción y foto, pero la categoría se
 * traduce: una idea de contexto ("en casa", "aventura") no encaja en las
 * categorías del evento, así que una cita programada se marca como `cita`.
 * La persona usuaria puede cambiarla después desde el formulario.
 *
 * La idea NO se borra: queda en el planeador hasta que la pareja decida
 * quitarla, para poder consultarla o repetirla.
 *
 * @param {string} idIdea Identificador de la idea a convertir.
 * @param {{fecha: string, hora?: string|null, lugar?: string}} parametros
 *   Fecha obligatoria y datos opcionales del evento resultante.
 * @returns {Promise<import('../types/models.js').Evento>} El evento creado.
 * @throws {ErrorValidacion} Si la fecha no es válida.
 * @throws {ErrorServicio} Si la idea no existe o no se puede guardar.
 * @example
 * const evento = await convertirIdeaEnEvento(id, { fecha: '2026-10-05' });
 */
export async function convertirIdeaEnEvento(idIdea, parametros) {
  const idea = await getIdeaById(idIdea);

  if (!idea) {
    throw new ErrorServicio('Esa idea ya no está en el planeador.');
  }

  // Delegamos la creación en el service de eventos para no duplicar la
  // validación ni el formato de error de la escritura.
  return crearEvento({
    titulo: idea.titulo,
    descripcion: idea.descripcion,
    foto: idea.imagen,
    categoria: 'cita',
    fecha: parametros?.fecha,
    hora: parametros?.hora ?? null,
    lugar: parametros?.lugar ?? '',
  });
}

/**
 * Borra todas las ideas y vuelve a sembrar las de ejemplo.
 *
 * @returns {Promise<Array<import('../types/models.js').IdeaCita>>} Las ideas
 *   del seed recién sembradas.
 * @example
 * await resetCitas();
 */
export async function resetCitas() {
  try {
    borrar(COLECCIONES.CITAS);
    return await getIdeasCitas();
  } catch (error) {
    console.error('[citasService] Error al restablecer las ideas.', error);
    throw new ErrorServicio('No pudimos restablecer las ideas.', error);
  }
}
