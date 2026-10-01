/**
 * Modelos de datos de "Juntos".
 *
 * RESPONSABILIDAD: documentar con @typedef la forma de cada entidad de la
 * aplicación. Estos typedef son la fuente única de verdad de los contratos de
 * datos: los services de src/services/ construyen y validan contra estas
 * formas, y los hooks de src/hooks/ las consumen.
 *
 * En Fase 1 los datos viven en localStorage. En Fase 2 pasarán a ser filas de
 * tablas en Supabase, y estos mismos typedef mapean 1:1 con las columnas.
 * Ver docs/MODELO_DE_DATOS.md y docs/MIGRACION_SUPABASE.md.
 *
 * Related: src/utils/categorias.js, src/data/seed.js, src/services/
 *
 * @module types/models
 */

/**
 * Categoría de un Evento.
 *
 * Determina el color del punto o etiqueta en el calendario y de los chips del
 * formulario. Los valores son literales fijos, no texto libre del usuario.
 *
 * @typedef {'cita'|'aniversario'|'viaje'|'cumpleanos'|'otro'} CategoriaEvento
 */

/**
 * Categoría de una IdeaCita.
 *
 * Separate de {@link CategoriaEvento}: una idea se filtra por contexto
 * ("en casa", "afuera"), mientras que un evento se clasifica por naturaleza
 * ("cita", "viaje"). Al convertir una idea en evento, la idea aporta título,
 * descripción, foto y categoría de contexto.
 *
 * LAS CLAVES TIENEN GUION, NO ESPACIO. `en-casa` y no `en casa`: el valor viaja a
 * la URL como `?categoria=en-casa`, al almacén y a una columna de la base de
 * datos, y un espacio obliga a escaparlo en las tres. Este typedef se escribió
 * una vez con un espacio, que es exactamente el error que el catálogo comprueba
 * al arrancar; las claves válidas las lleva `CATEGORIAS_IDEA`.
 *
 * @typedef {'en-casa'|'afuera'|'aventura'|'relax'} CategoriaIdeaCita
 */

/**
 * Origen de una {@link IdeaCita}: la escribió el seed o la persona usuaria.
 *
 * Vive aquí y no en `citasService` porque el seed también lo necesita, y el
 * service importa al seed: ponerlo en el service obligaría al seed a importar
 * al service y crearía un ciclo. Este módulo no importa nada, así que todos
 * pueden depender de él.
 *
 * @type {Readonly<Record<string, 'seed'|'usuario'>>}
 */
export const ORIGEN = Object.freeze({
  SEED: 'seed',
  USUARIO: 'usuario',
});

/**
 * Un recuerdo con fecha: el corazón de la aplicación.
 *
 * @typedef {object} Evento
 * @property {string} id Identificador único. Generado por los services; en
 *   Fase 2 será la clave primaria de la tabla en Supabase.
 * @property {string} titulo Nombre del evento. Obligatorio, máximo 120
 *   caracteres. Se escapa siempre al renderizar (React lo hace por defecto).
 * @property {string} fecha Fecha del evento en formato ISO calendario
 *   `YYYY-MM-DD`, sin zona horaria. Este es el formato que usam date-fns para
 *   evitar los desfases de un día al parsear con `new Date(string)`.
 * @property {string|null} [hora] Hora local opcional en formato 24h `HH:mm`.
 *   `null` cuando el evento dura todo el día.
 * @property {string} descripcion Texto libre. Máximo 500 caracteres, según el
 *   contador del formulario.
 * @property {string} lugar Sitio o lugar donde ocurre. Puede estar vacío.
 * @property {CategoriaEvento} categoria Clasificación visual del evento.
 * @property {string|null} [foto] URL remota (las del seed) o cadena base64
 *   (las que sube la pareja). `null` cuando el evento no tiene foto.
 * @property {string} [creadoEn] Marca ISO del alta, para ordenar y depurar.
 */

/**
 * Una propuesta de cita sin fecha: vive en el planeador hasta que se
 * convierte en un {@link Evento}.
 *
 * @typedef {object} IdeaCita
 * @property {string} id Identificador único generado por el service.
 * @property {string} titulo Nombre de la idea. Obligatorio, máximo 120.
 * @property {string} descripcion Detalle de la propuesta. Máximo 500.
 * @property {CategoriaIdeaCita} categoria Contexto de la idea, usado por los
 *   filtros del planeador.
 * @property {boolean} favorita Marcada con el corazón. Solo hay una por
 *   pareja, así que se almacena como boolean en lugar de lista.
 * @property {string|null} [imagen] URL o base64 de la imagen de la tarjeta.
 * @property {'seed'|'usuario'} origen Quién escribió la idea. Solo las de
 *   `usuario` se pueden editar o borrar: las del seed son contenido de ejemplo
 *   y borrarlas dejaría el planeador más vacío de lo que empezó. Lo escribe el
 *   service al crear y lo conserva al editar, nunca el formulario.
 *   @see ORIGEN
 */

/**
 * Resultado de una escritura en un service.
 *
 * Los services de Fase 1 lançan excepciones y las páginas manejan el error con
 * try/catch, por lo que este tipo documenta el caso exitoso normal.
 *
 * @typedef {object} ResultadoOperacion
 * @property {boolean} ok `true` si la operación se completó.
 * @property {string} [mensaje] Mensaje corto para mostrar en un toast.
 */

export {};
