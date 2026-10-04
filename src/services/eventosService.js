/**
 * Servicio de eventos.
 *
 * RESPONSABILIDAD: única puerta de entrada a los datos de los recuerdos de la
 * pareja. Toda lectura y escritura de eventos pasa por aquí; las páginas nunca
 * tocan `localStorage`. La API es asíncrona aunque hoy el backing store sea
*   local, para que migrar a Supabase no obligue a cambiar las pantallas.
 *
 * PATRÓN DE ERROR
 * - `validarEvento` lanza `ErrorValidacion` con detalle por campo: la UI puede
 *   marcar los inputs concretos.
 * - Cualquier otro fallo (JSON corrupto, cuota llena) se envuelve en
 *   `ErrorServicio` con un mensaje apto para mostrar, sin filtrar detalles
 *   internos como la pila de llamadas o el nombre de la clave.
 *
 * SEGURIDAD: la validación del cliente NO es una frontera de seguridad. En
 * Fase 2 debe replicarse en el servidor.
 * TODO-FASE2 (SEGURIDAD): mover a Supabase con RLS por pareja. Cada consulta
 * debe filtrar por `pareja_id` de la sesión, y el `id` de la ruta
 * `/evento/:id` solo puede devolver eventos de esa pareja. Ver
 * docs/MIGRACION_SUPABASE.md.
 *
 * Related: src/services/storage.js, src/data/seed.js, src/hooks/useEventos.js
 *
 * @module services/eventosService
 */

import { crearEventosSeed } from '../data/seed';
import { eventosOrdenados } from '../utils/fechas';
import { nuevoId } from '../utils/ids';
import { ahora } from '../utils/reloj';
import {
  ErrorValidacion,
  esIdValido,
  validarEvento,
} from '../utils/validaciones';
import { COLECCIONES, ErrorCuotaAlmacenamiento, borrar, guardar, leer } from './storage';

/**
 * Error genérico de la capa de servicios.
 *
 * Envuelve los fallos internos para que la UI reciba un mensaje seguro y en
 * español, sin exponer nombres de claves, rutas del sistema ni pila de
 * llamadas (que sí revelaría la estructura interna).
 *
 * @extends Error
 */
export class ErrorServicio extends Error {
  /**
   * @param {string} mensaje Mensaje seguro para la persona usuaria.
   * @param {Error} [causa] Error original, conservado solo para depuración.
   */
  constructor(mensaje, causa) {
    super(mensaje);
    this.name = 'ErrorServicio';
    this.causa = causa;
  }
}

/**
 * Lee todos los eventos, sembrando los datos de ejemplo la primera vez.
 *
 * Es la función que implementa el "get or seed": si no hay nada guardado
 * (primer arranque, datos corruptos, o reset) escribe el seed y lo devuelve.
 *
 * @returns {Promise<Array<import('../types/models.js').Evento>>} Eventos
 *   ordenados por fecha ascendente.
 * @throws {ErrorServicio} Si no se puede leer ni guardar, por ejemplo cuando
 *   `localStorage` está deshabilitado.
 * @example
 * const eventos = await getEventos();
 * eventos[0].titulo; // 'Nuestro aniversario'
 */
export async function getEventos() {
  try {
    const guardados = leer(COLECCIONES.EVENTOS);

    // Primer arranque (o datos corruptos): sembramos.
    if (guardados === null) {
      const seed = eventosOrdenados(crearEventosSeed());
      guardar(COLECCIONES.EVENTOS, seed);
      return seed;
    }

    return eventosOrdenados(guardados);
  } catch (error) {
    /*
     * Un error de cuota merece su propio mensaje: "no hay espacio" es accionable
     * para la persona usuaria, mientras que "no pudimos cargar" no dice nada
     * sobre qué hacer. Se propaga sin envolver para que llegue intacto.
     */
    if (error instanceof ErrorCuotaAlmacenamiento) {
      console.error('[eventosService] Cuota agotada al leer los eventos.', error);
      throw error;
    }

    // El detalle va a consola; el usuario recibe un mensaje limpio.
    console.error('[eventosService] Error al obtener los eventos.', error);
    throw new ErrorServicio(
      'No pudimos cargar tus recuerdos. Inténtalo de nuevo.',
      error,
    );
  }
}

/**
 * Busca un evento por su identificador.
 *
 * SEGURIDAD: el `id` se valida con `esIdValido` ANTES de buscar. Un id
 * manipulado (por ejemplo con una comilla o una inyección) se rechaza sin
 * tocar los datos. Evita que valores inesperados lleguen a las capas
 * inferiores y, en Fase 2, es la primera línea antes de preguntar al
 * servidor.
 *
 * TODO-FASE2 (SEGURIDAD): validar el formato NO sustituye a la
 * autorización. El servidor debe devolver `null` si el evento existe pero
 * pertenece a otra pareja (RLS), no un 403 que confirme su existencia.
 *
 * @param {string} id Identificador del evento.
 * @returns {Promise<import('../types/models.js').Evento|null>} El evento, o
 *   `null` si no existe o el id no es válido. La página maneja `null` con un
 *   estado "no encontrado".
 * @example
 * const evento = await getEventoById(id);
 * if (!evento) mostrarNoEncontrado();
 */
export async function getEventoById(id) {
  if (!esIdValido(id)) {
    console.warn('[eventosService] id con formato inválido, se ignora.');
    return null;
  }

  try {
    const eventos = await getEventos();
    return eventos.find((evento) => evento.id === id) ?? null;
  } catch (error) {
    console.error('[eventosService] Error al buscar el evento.', error);
    throw new ErrorServicio('No pudimos cargar ese recuerdo.', error);
  }
}

/**
 * Crea un evento nuevo y lo persiste.
 *
 * Valida antes de guardar: aunque el formulario ya valida, un service público
 * no puede asumir que su llamador lo hizo. En Fase 2 esta es exactamente la
 * validación que se replicará en el servidor.
 *
 * @param {Partial<import('../types/models.js').Evento>} datos Datos del evento.
 *   `id` y `creadoEn` los asigna el service.
 * @returns {Promise<import('../types/models.js').Evento>} El evento creado, con
 *   su `id`.
 * @throws {ErrorValidacion} Si los datos no superan la validación.
 * @throws {ErrorServicio} Si no se puede guardar (cuota, almacenamiento no
 *   disponible).
 * @example
 * try {
 *   const evento = await crearEvento({
 *     titulo: 'Cena',
 *     fecha: '2026-09-14',
 *     hora: '19:00',
 *     categoria: 'cita',
 *   });
 * } catch (e) {
 *   if (e instanceof ErrorValidacion) console.log(e.erroresPorCampo);
 * }
 */
export async function crearEvento(datos) {
  // Puede lanzar ErrorValidacion: la dejamos pasar para que la UI detalle los campos.
  const limpio = validarEvento(datos);

  try {
    const eventos = await getEventos();

    const evento = {
      ...limpio,
      id: nuevoId(),
      /*
       * La marca de alta se pide al reloj por el mismo motivo que el resto: con
       * la suite en una fecha simulada, un evento creado en la prueba quedaba
       * con la fecha real y se ordenaba entre los de otro mes. En producción el
       * reloj no está fijado, así que esto no cambia nada de lo que ve nadie.
       */
      creadoEn: ahora().toISOString(),
    };

    guardar(COLECCIONES.EVENTOS, eventosOrdenados([...eventos, evento]));
    return evento;
  } catch (error) {
    console.error('[eventosService] Error al crear el evento.', error);

    // La cuota tiene su propio mensaje accionable: no lo sobrescribimos.
    if (error instanceof ErrorCuotaAlmacenamiento) throw error;

    throw new ErrorServicio(
      error.message || 'No pudimos guardar el recuerdo.',
      error,
    );
  }
}

/**
 * Actualiza un evento existente.
 *
 * Se valida el objeto COMPLETO resultante (los campos fusionados con los
 * anteriores), no solo los campos modificados: si alguien envía un evento sin
 * título, debe rechazarse igual.
 *
 * @param {string} id Identificador del evento a actualizar.
 * @param {Partial<import('../types/models.js').Evento>} datos Campos a
 *   cambiar. Se fusionan con los existentes.
 * @returns {Promise<import('../types/models.js').Evento>} El evento ya
 *   actualizado, con su nueva posición en el orden.
 * @throws {ErrorValidacion} Si el resultado no supera la validación.
 * @throws {ErrorServicio} Si no existe el evento o no se puede guardar.
 * @example
 * await actualizarEvento(id, { titulo: 'Cena nueva', fecha: '2026-10-02' });
 */
export async function actualizarEvento(id, datos) {
  if (!esIdValido(id)) {
    throw new ErrorServicio('Ese recuerdo no existe.');
  }

  try {
    const eventos = await getEventos();
    const indice = eventos.findIndex((evento) => evento.id === id);

    if (indice === -1) {
      throw new ErrorServicio('Ese recuerdo ya no existe.');
    }

    const existente = eventos[indice];

    /*
     * Preservamos `id` y `creadoEn` aunque vengan en `datos`. Si el cliente
     * intentara cambiarlos, aquí se restauran: son campos del servidor, no
     * entrada de usuario.
     */
    const { id: _idIgnorado, creadoEn: _creadoIgnorado, ...campos } = datos ?? {};

    const limpio = validarEvento({ ...existente, ...campos });

    const actualizado = {
      ...limpio,
      id: existente.id,
      creadoEn: existente.creadoEn,
    };

    const copia = [...eventos];
    copia[indice] = actualizado;
    guardar(COLECCIONES.EVENTOS, eventosOrdenados(copia));

    return actualizado;
  } catch (error) {
    // Reenviamos los errores de validación y de servicio sin envolver.
    if (error instanceof ErrorValidacion || error instanceof ErrorServicio) {
      throw error;
    }
    console.error('[eventosService] Error al actualizar el evento.', error);
    throw new ErrorServicio('No pudimos guardar los cambios.', error);
  }
}

/**
 * Elimina un evento por su identificador.
 *
 * @param {string} id Identificador del evento a borrar.
 * @returns {Promise<boolean>} `true` si se eliminó, `false` si no existía.
 * @throws {ErrorServicio} Si no se puede guardar el cambio.
 * @example
 * const eliminado = await eliminarEvento(id);
 */
export async function eliminarEvento(id) {
  if (!esIdValido(id)) return false;

  try {
    const eventos = await getEventos();
    const restantes = eventos.filter((evento) => evento.id !== id);

    // Si no cambió el tamaño, el evento no existía.
    if (restantes.length === eventos.length) return false;

    guardar(COLECCIONES.EVENTOS, restantes);
    return true;
  } catch (error) {
    console.error('[eventosService] Error al eliminar el evento.', error);
    throw new ErrorServicio('No pudimos eliminar ese recuerdo.', error);
  }
}

/**
 * Borra todos los eventos y vuelve a sembrar los datos de ejemplo.
 *
 * Pensado para el botón "Restablecer datos" de Configuración y para pruebas
 * manuales. No es una operación de usuario normal.
 *
 * @returns {Promise<Array<import('../types/models.js').Evento>>} Los eventos
 *   del seed recién sembrados.
 * @example
 * await resetEventos(); // la app vuelve al estado recién instalado
 */
export async function resetEventos() {
  try {
    borrar(COLECCIONES.EVENTOS);
    return await getEventos();
  } catch (error) {
    console.error('[eventosService] Error al restablecer los eventos.', error);
    throw new ErrorServicio('No pudimos restablecer los datos.', error);
  }
}
