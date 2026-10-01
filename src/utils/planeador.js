/**
 * Utilidades puras del planeador de citas.
 *
 * RESPONSABILIDAD: toda la lógica del planeador que no necesita React ni el
 * almacén. Leer el filtro de la URL, escribirlo de vuelta, filtrar la lista,
 * traducir una idea a los valores iniciales del formulario de evento y decir si
 * una idea se puede editar.
 *
 * POR QUÉ ESTÁN TODAS AQUÍ Y NO EN LA PÁGINA
 * Son reglas con entradas hostiles —el `?categoria=` de la URL lo elige quien
 * pulse un enlace— y reglas de las que depende el esquema de datos, como el
 * `origen` de una idea. Si estuvieran en el componente habría que probarlas
 * montando la página entera; aquí se prueban con dos líneas y la página solo
 * las pinta.
 *
 * Related: src/hooks/useCitas.js, src/pages/Planeador.jsx,
 * src/components/citas/, src/utils/categorias.js
 *
 * @module utils/planeador
 */

import { CATEGORIA, esCategoriaIdeaValida } from './categorias';
import { LIMITES } from './validaciones';
import { ORIGEN } from '../types/models';

/**
 * Valor del filtro que significa "sin filtro de categoría".
 *
 * NO es una clave del catálogo: existe para que el `?categoria=` pueda
 * desaparecer de la URL cuando no se está filtrando, en vez de llevar
 * `?categoria=todas`, que no significa nada en ningún sitio más.
 *
 * @type {string}
 */
export const FILTRO_TODAS = 'todas';

/**
 * Categoría a la que se traduce una idea al convertirse en evento.
 *
 * Las categorías de idea ("en casa", "aventura") describen el contexto y no
 * existen entre las del evento, así que no hay traducción posible: una cita ya
 * planificada es una cita. Quien quiera clasificarla de otro modo la cambia
 * desde el formulario, que es el sitio donde se toman esas decisiones.
 *
 * Se lee del símbolo `CATEGORIA`, derivado del catálogo, y no se escribe
 * `'cita'` a mano en cuatro sitios distintos.
 *
 * @type {import('../types/models.js').CategoriaEvento}
 */
export const CATEGORIA_AL_CONVERTIR = CATEGORIA.CITA;

/**
 * Traduce una idea a los valores con los que se abre el formulario de evento.
 *
 * LA FECHA VA VACÍA A PROPÓSITO. Es lo más importante de esta función. Una idea
 * no tiene fecha: es exactamente lo que le falta para ser un evento. Si se
 * rellenara con la fecha de hoy, quien abriera el formulario creería que la
 * fecha ya estaba pensada y la aceptaría sin revisarla, que es justo el error
 * que cuesta una cita mal planificada. El campo queda marcado como error por
 * la validación hasta que se elija.
 *
 * La categoría se fuerza a `cita` y la idea original no se toca: sigue en el
 * planeador para poder consultarla o repetirla.
 *
 * @param {import('../types/models.js').IdeaCita} idea Idea a convertir.
 * @returns {{titulo: string, fecha: string, hora: string, descripcion: string, lugar: string, categoria: import('../types/models.js').CategoriaEvento, foto: string|null}}
 *   Valores iniciales del formulario de evento.
 * @throws {Error} Si la idea no es un objeto, para no devolver un formulario
 *   lleno de `undefined`.
 * @example
 * ideaAValoresEvento({ titulo: 'Picnic', descripcion: 'Con pan', imagen: null });
 * // → { titulo: 'Picnic', fecha: '', categoria: 'cita', ... }
 */
export function ideaAValoresEvento(idea) {
  if (!idea || typeof idea !== 'object') {
    throw new Error('ideaAValoresEvento necesita una idea válida.');
  }

  return {
    titulo: limpiar(idea.titulo),
    fecha: '',
    hora: '',
    descripcion: limpiar(idea.descripcion),
    lugar: '',
    categoria: CATEGORIA_AL_CONVERTIR,
    foto: idea.imagen ? String(idea.imagen) : null,
  };
}

/**
 * Normaliza cualquier valor a un texto limpio o a cadena vacía.
 *
 * @param {unknown} valor Valor de entrada.
 * @returns {string} Texto recortado, o `''`.
 */
function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Lee el filtro de categoría de la URL y lo valida contra el catálogo.
 *
 * UNA CATEGORÍA INVÁLIDA VALE LO MISMO QUE NINGUNA. No se rechaza con un error
 * ni se deja que llegue a la lista: se cae en "todas". Motivo: este valor lo
 * elige quien pulsa un enlace, o quien edita la barra de direcciones, y un
 * `?categoria=<script>` no puede romper la página ni colarse en la comparación.
 * La comparación posterior es por igualdad sobre una clave del catálogo, así
 * que un valor inventado no podría hacer daño aunque llegara; normalizar aquí
 * además hace que los chips marquen correctamente.
 *
 * @param {string|URLSearchParams|null} busqueda Cadena de búsqueda, objeto
 *   `URLSearchParams` o `null`.
 * @returns {string} Clave de categoría del catálogo, o {@link FILTRO_TODAS}.
 * @example
 * leerCategoriaDeUrl('?categoria=relax');   // 'relax'
 * leerCategoriaDeUrl('?categoria=inventada'); // 'todas'
 * leerCategoriaDeUrl('?categoria=<script>'); // 'todas'
 */
export function leerCategoriaDeUrl(busqueda) {
  const valor = leerParametro(busqueda, 'categoria');
  return esCategoriaIdeaValida(valor) ? valor : FILTRO_TODAS;
}

/**
 * Lee el interruptor de "solo favoritas" de la URL.
 *
 * Acepta `1`, `true` y `si`, que son las tres formas en que se puede escribir a
 * mano. Cualquier otra cosa, incluido el caso de que no esté, es `false`: un
 * interruptor que se activa solo porque el parámetro es raro sería peor que no
 * tenerlo.
 *
 * @param {string|URLSearchParams|null} busqueda Cadena de búsqueda, objeto
 *   `URLSearchParams` o `null`.
 * @returns {boolean} `true` si solo se muestran las favoritas.
 * @example
 * leerSoloFavoritasDeUrl('?favoritas=1');    // true
 * leerSoloFavoritasDeUrl('?favoritas=quizás'); // false
 */
export function leerSoloFavoritasDeUrl(busqueda) {
  const valor = leerParametro(busqueda, 'favoritas');
  return valor === '1' || valor === 'true' || valor === 'si';
}

/**
 * Extrae un parámetro de una búsqueda, venga como venga.
 *
 * @param {string|URLSearchParams|null} busqueda Cadena, `URLSearchParams` o `null`.
 * @param {string} nombre Nombre del parámetro.
 * @returns {string} Valor en minúsculas y recortado, o `''`.
 */
function leerParametro(busqueda, nombre) {
  if (!busqueda) return '';
  if (typeof busqueda === 'string') {
    // Se tolerate el `?` inicial porque es lo que devuelve `location.search`.
    return new URLSearchParams(busqueda.replace(/^[?]/, '')).get(nombre)?.toLowerCase().trim() ?? '';
  }
  return String(busqueda.get(nombre) ?? '').toLowerCase().trim();
}

/**
 * Escribe el estado de los filtros en una cadena de búsqueda.
 *
 * DEVUELVE UNA CADENA VACÍA CUANDO NO HAY NADA QUE FILTRAR. Es lo que mantiene
 * la URL limpia: con ningún filtro activo la ruta es `/planeador`, y no
 * `/planeador?categoria=todas`. Devolver `undefined` desde un componente de
 * React Router provoca el aviso "Cannot update a component while rendering a
 * different component", así que se devuelve siempre una cadena.
 *
 * Los filtros que ya estaban en la URL y no forman parte de estos dos se
 * conservan, por ejemplo `?mes=`, para que el planeador no borre parámetros que
 * otra parte de la app pusiera.
 *
 * @param {string|URLSearchParams|null} actual Búsqueda vigente.
 * @param {{categoria?: string, soloFavoritas?: boolean}} filtros Filtros a escribir.
 * @returns {string} Cadena de búsqueda sin `?` inicial, o `''`.
 * @example
 * escribirFiltros('', { categoria: 'relax', soloFavoritas: true });
 * // → 'categoria=relax&favoritas=1'
 */
export function escribirFiltros(actual, filtros) {
  const params = new URLSearchParams(
    typeof actual === 'string' ? actual.replace(/^[?]/, '') : String(actual ?? ''),
  );

  const categoria = filtros?.categoria;
  if (!categoria || categoria === FILTRO_TODAS) params.delete('categoria');
  else params.set('categoria', categoria);

  if (filtros?.soloFavoritas) params.set('favoritas', '1');
  else params.delete('favoritas');

  return params.toString();
}

/**
 * Aplica los filtros a una lista de ideas.
 *
 * @param {ReadonlyArray<import('../types/models.js').IdeaCita>} ideas Ideas a filtrar.
 * @param {{categoria?: string, soloFavoritas?: boolean}} [filtros] Filtros activos.
 * @returns {Array<import('../types/models.js').IdeaCita>} Nuevo array con las
 *   ideas que pasan los filtros. No muta la entrada.
 * @example
 * filtrarIdeas(ideas, { categoria: 'relax', soloFavoritas: true });
 */
export function filtrarIdeas(ideas, filtros = {}) {
  const categoria = filtros.categoria;
  const soloFavoritas = filtros.soloFavoritas === true;

  return ideas.filter((idea) => {
    if (categoria && categoria !== FILTRO_TODAS && idea.categoria !== categoria) {
      return false;
    }
    if (soloFavoritas && idea.favorita !== true) return false;
    return true;
  });
}

/**
 * Indica si la persona usuaria puede editar o borrar una idea.
 *
 * SOLO LAS IDEAS PROPIAS. Las del seed son contenido de ejemplo: borrarlas
 * dejaría el planeador más vacío de lo que empezó, y no hay forma de
 * recuperarlas. En su lugar se pueden marcar como favoritas, que es reversible
 * y no destruye nada.
 *
 * El campo `origen` lo escribe el service al crear la idea y lo conserva al
 * editarla; no viene del formulario, así que no se puede falseificar desde la
 * interfaz. La comparación es estricta: solo una idea que diga exactamente
 * `'usuario'` es editable, y cualquier otra cosa —sin `origen`, o con un valor
 * que nadie ha escrito— se trata como del seed. Es la misma decisión que toma
 * `normalizarOrigen` al leer, y tiene que coincidir: si esta función aceptara
 * una idea sin origen mientras el service la lee como del seed, bastaría con
 * que un registro antiguo llegara a la interfaz para que saliera editable
 * cuando el service ya la considera protegida.
 *
 * @param {import('../types/models.js').IdeaCita} idea Idea a comprobar.
 * @returns {boolean} `true` si se puede modificar o eliminar.
 * @example
 * esIdeaEditable({ origen: 'seed' });    // false
 * esIdeaEditable({ origen: 'usuario' }); // true
 * esIdeaEditable({ titulo: 'Sin origen' }); // false
 */
export function esIdeaEditable(idea) {
  return idea?.origen === ORIGEN.USUARIO;
}

/*
 * El degradado de reserva de una idea sin imagen NO se define aquí, sino en
 * `categorias.js` como `degradadoCategoriaIdea`, junto al resto de funciones que
 * leen el catálogo. Estaba antes en este archivo y la galería necesitaba el
 * equivalente para los eventos: mantener los dos habría sido copiar la misma
 * interpolación en dos sitios, y cambiar la dirección del degradado en uno solo
 * habría dejado la app con dos tipos de hueco.
 */

/**
 * Construye el `aria-label` del corazón de una idea.
 *
 * "Quitar de favoritas: Picnic en el parque" y no "Favorita". Un lector de
 * pantalla que recorre la lista se encuentra veinte botones con el mismo nombre
 * y no sabe cuál es cuál; con el título, cada botón se anuncia distinto y se
 * entiende la acción que hace.
 *
 * @param {import('../types/models.js').IdeaCita} idea Idea de la tarjeta.
 * @returns {string} Texto accesible del botón.
 * @example
 * etiquetaFavorita({ titulo: 'Picnic', favorita: true });
 * // → 'Quitar de favoritas: Picnic'
 */
export function etiquetaFavorita(idea) {
  const accion = idea?.favorita ? 'Quitar de favoritas' : 'Marcar como favorita';
  const titulo = limpiar(idea?.titulo);
  return titulo ? `${accion}: ${titulo}` : accion;
}

/**
 * Recorta un título para usarlo en un `alt` o un encabezado estrecho.
 *
 * @param {string} titulo Título original.
 * @param {number} [maximo] Longitud máxima.
 * @returns {string} Título recortado con puntos suspensivos si hizo falta.
 * @example
 * recortarTitulo('Picnic en el parque grande', 12); // 'Picnic en el…'
 */
export function recortarTitulo(titulo, maximo = LIMITES.TITULO) {
  const texto = limpiar(titulo);
  if (texto.length <= maximo) return texto;
  return `${texto.slice(0, Math.max(0, maximo - 1)).trimEnd()}…`;
}

/**
 * Ordena las ideas: favoritas primero y, a igualdad, por título en español.
 *
 * VIVE AQUÍ Y NO EN EL SERVICE POR UN MOTIVO CONCRETO. La ordenación tiene que
 * ser la misma en los tres sitios donde se ordena: al leer del almacén, al
 * escribir una idea y al alternar un corazón en el cliente. Con la regla
 * duplicada, un cambio de criterio obligaba a acordarse de tocar tres archivos y
 * la lista se recolocaba de forma distinta según por dónde llegara la idea.
 * Aquí hay una sola definición y los tres la importan.
 *
 * `localeCompare` con `'es'` y no el orden por defecto: sin fijar el idioma,
 * "Ánfora" se ordenaría después de "Zafiro" en unos navegadores y antes en
 * otros, según la tabla de ordenación que cada sistema tenga activa.
 *
 * @param {ReadonlyArray<import('../types/models.js').IdeaCita>} ideas Ideas a ordenar.
 * @returns {Array<import('../types/models.js').IdeaCita>} Nuevo array ordenado.
 *   No muta la entrada.
 * @example
 * ordenarIdeas([
 *   { titulo: 'B', favorita: false },
 *   { titulo: 'A', favorita: true },
 * ]);
 * // → [{ titulo: 'A', favorita: true }, { titulo: 'B', favorita: false }]
 */
export function ordenarIdeas(ideas) {
  return [...ideas].sort((a, b) => {
    if (a.favorita !== b.favorita) return a.favorita ? -1 : 1;
    return String(a.titulo).localeCompare(String(b.titulo), 'es');
  });
}
