/**
 * Catálogo único de categorías de "Juntos".
 *
 * RESPONSABILIDAD: ser la única fuente de verdad de las categorías de Evento y
 * de IdeaCita, incluyendo su etiqueta visible, su color y su icono. Ningún
 * otro archivo debe volver a escribir estos valores.
 *
 * POR QUÉ ESTOS COLORES NO SON CLASES DE TAILWIND
 * Tailwind escanea el código fuente al compilar y genera el CSS de las clases
 * que encuentra como texto literal. Una clase construida en tiempo de
 * ejecución (`` `bg-${color}` ``) no existe en el código fuente, así que nunca
 * llega a generarse y la clase desaparece del CSS final.
 * Por eso el color se aplica con `style={{ backgroundColor: c.hex }}`, leyendo
 * el valor de este archivo. Así, cambiar el color aquí lo cambia en toda la
 * aplicación sin tocar ningún componente ni recompilar la configuración.
 *
 * ESTE ARCHIVO ES LA ÚNICA FUENTE
 * Las listas de categorías se derivan con `Object.keys()`, y la validación y el
 * seed leen de aquí. No se repiten slugs en ningún otro archivo. Está escrito
 * en el orden en que deben mostrarse los chips.
 *
 * @see docs/ARQUITECTURA.md § "Tokens y colores de categoría"
 * @see docs/MODELO_DE_DATOS.md
 *
 * @module utils/categorias
 */

import { Cake, Heart, MapPin, Star } from 'lucide-react';

/**
 * Forma válida de una clave de categoría.
 *
 * ASCII, sin espacios ni acentos. La clave se guarda en `localStorage`, se usa
 * como valor de filtro y será una columna o un valor de enum en la base de
 * datos: un acento o un espacio ahí hay que escaparlos o no los admiten.
 *
 * @type {RegExp}
 */
export const PATRON_CATEGORIA = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * @typedef {import('../types/models.js').CategoriaEvento} CategoriaEvento
 * @typedef {import('../types/models.js').CategoriaIdeaCita} CategoriaIdeaCita
 */

/**
 * Paleta de las categorías de Evento, muestreada píxel a píxel del mockup.
 * @type {Readonly<Record<CategoriaEvento, {label: string, hex: string, bg: string, fg: string, Icon: React.ComponentType}>>}
 */
export const CATEGORIAS_EVENTO = Object.freeze({
  cita: {
    label: 'Cita',
    // Morado: punto del calendario y detalle del evento.
    hex: '#7B22CA',
    // Fondo lavanda del chip en el formulario.
    bg: '#F1F0FC',
    // Texto legible sobre ese fondo lavanda.
    fg: '#5B21A8',
    Icon: Heart,
  },
  aniversario: {
    label: 'Aniversario',
    hex: '#E44B66',
    bg: '#FCEBED',
    fg: '#B3243F',
    Icon: Heart,
  },
  viaje: {
    label: 'Viaje',
    hex: '#33A563',
    bg: '#E4F6EC',
    fg: '#1F7A47',
    Icon: MapPin,
  },
  /*
   * La clave es `cumpleanos` sin ñ a propósito. Esta clave se guarda en
   * localStorage y será el valor de una columna en Supabase, así que conviene
   * que sea ASCII: la `ñ` solo vive en `label`, que es lo que se ve y lo que
   * se muestra en la interfaz.
   */
  cumpleanos: {
    label: 'Cumpleaños',
    hex: '#FDB129',
    bg: '#FEF3DC',
    fg: '#96620A',
    Icon: Cake,
  },
  otro: {
    label: 'Otro',
    hex: '#62B1F5',
    bg: '#E6F1FD',
    fg: '#1B6BB5',
    Icon: Star,
  },
});

/**
 * Paleta de las categorías de IdeaCita, usada por los chips de filtro del
 * planeador. Tonos más apagados que los de Evento para no competir con los
 * puntos del calendario.
 * @type {Readonly<Record<CategoriaIdeaCita, {label: string, hex: string, bg: string, fg: string}>>}
 */
export const CATEGORIAS_IDEA = Object.freeze({
  'en-casa': { label: 'En casa', hex: '#C08497', bg: '#F7EDF0', fg: '#8A4A5E' },
  afuera: { label: 'Afuera', hex: '#62B1F5', bg: '#E6F1FD', fg: '#1B6BB5' },
  aventura: { label: 'Aventura', hex: '#33A563', bg: '#E4F6EC', fg: '#1F7A47' },
  relax: { label: 'Relax', hex: '#B39CDB', bg: '#EFEAF9', fg: '#5B3E8E' },
});

/**
 * @typedef {object} InfoCategoria
 * @property {string} label Etiqueta visible para la persona usuaria.
 * @property {string} hex Color principal: puntos del calendario y acentos.
 * @property {string} bg Color de fondo suave para chips y etiquetas.
 * @property {string} fg Color de texto con contraste suficiente sobre `bg`.
 */

/**
 * Busca una categoría en un catálogo y cae en la de reserva si no aparece.
 *
 * El `??` de un acceso directo no serviría: `CATEGORIAS_EVENTO` es un objeto
 * literal, así que hereda de `Object.prototype`, y un valor guardado a mano
 * como `"toString"` devolvería la función heredada en lugar de la categoría de
 * reserva. `Object.hasOwn` distingue una categoría real de una propiedad
 * heredada.
 *
 * @param {Record<string, InfoCategoria>} catalogo Catálogo donde buscar.
 * @param {string} categoria Clave buscada.
 * @param {string} reserva Clave de la categoría de reserva.
 * @returns {InfoCategoria} La categoría pedida o la de reserva.
 */
function buscarCategoria(catalogo, categoria, reserva) {
  return Object.hasOwn(catalogo, categoria) ? catalogo[categoria] : catalogo[reserva];
}

/**
 * Devuelve la información de una categoría de evento.
 *
 * Ante una categoría desconocida devuelve la de `otro` en lugar de fallar:
 * los datos de localStorage pueden haber sido editados a mano o guardar
 * registros de una versión anterior de la app.
 *
 * @param {CategoriaEvento|string} categoria Clave de la categoría.
 * @returns {InfoCategoria} Datos de estilo y etiqueta de la categoría.
 * @example
 * const { label, hex } = obtenerCategoria('viaje');
 * // label → 'Viaje', hex → '#33A563'
 */
export function obtenerCategoria(categoria) {
  return buscarCategoria(CATEGORIAS_EVENTO, categoria, 'otro');
}

/**
 * Devuelve la información de una categoría de idea de cita.
 *
 * @param {CategoriaIdeaCita|string} categoria Clave de la categoría.
 * @returns {InfoCategoria} Datos de estilo y etiqueta de la categoría.
 * @example
 * obtenerCategoriaIdea('relax').label; // 'Relax'
 */
export function obtenerCategoriaIdea(categoria) {
  return buscarCategoria(CATEGORIAS_IDEA, categoria, 'en-casa');
}

/**
 * Comprueba si una cadena es una categoría de evento del catálogo.
 *
 * `Object.hasOwn` y no un `in`: este último daría `true` para nombres como
 * `toString` o `constructor`, que heredan de `Object.prototype`, y dejaría
 * pasar una categoría inventada.
 *
 * @param {unknown} categoria Valor a comprobar.
 * @returns {boolean} `true` si es una clave del catálogo.
 * @example
 * esCategoriaValida('viaje');   // true
 * esCategoriaValida('toString'); // false
 * esCategoriaValida('nope');     // false
 */
export function esCategoriaValida(categoria) {
  return (
    typeof categoria === 'string' && Object.hasOwn(CATEGORIAS_EVENTO, categoria)
  );
}

/**
 * Comprueba si una cadena es una categoría de idea del catálogo.
 *
 * @param {unknown} categoria Valor a comprobar.
 * @returns {boolean} `true` si es una clave del catálogo de ideas.
 * @example
 * esCategoriaIdeaValida('en-casa'); // true
 */
export function esCategoriaIdeaValida(categoria) {
  return (
    typeof categoria === 'string' && Object.hasOwn(CATEGORIAS_IDEA, categoria)
  );
}

/**
 * Lista de categorías de idea en el orden en que aparecen los chips de filtro
 * del planeador. La primera entrada es "Todas" y se gestiona aparte en la UI.
 *
 * SE DERIVA DEL OBJETO, NO SE ESCRIBE A MANO
 * Leer las claves del catálogo es lo que evita que la lista y el catálogo se
 * separen. Pasó de verdad: `CATEGORIAS_IDEA` usaba la clave `cumpleaños`, con
 * `ñ`, mientras esta lista usaba `cumpleanos`. El resultado fue que la leyenda
 * del calendario leía `undefined` y la página entera se quedaba en blanco,
 * y que los eventos de cumpleaños se pintaban con el color de "Otro". Ninguna de
 * las dos cosas habría dado error de validación: `obtenerCategoria()` cae
 * silenciosamente en la categoría de reserva.
 *
 * El precio es que **el orden de las claves del objeto es el orden en que se
 * muestran**. Si alguna vez hay que reordenar la presentación, se reordena el
 * objeto; no se toca esta lista.
 *
 * @type {ReadonlyArray<CategoriaIdeaCita>}
 */
export const ORDEN_CATEGORIAS_IDEA = Object.freeze(Object.keys(CATEGORIAS_IDEA));

/**
 * Lista de categorías de evento en el orden en que aparecen los chips del
 * formulario. Se deriva del catálogo por el mismo motivo y con la misma
 * advertencia que `ORDEN_CATEGORIAS_IDEA`.
 *
 * @type {ReadonlyArray<CategoriaEvento>}
 */
export const ORDEN_CATEGORIAS_EVENTO = Object.freeze(Object.keys(CATEGORIAS_EVENTO));

/**
 * Convierte una clave de categoría en un símbolo utilizable como constante.
 *
 * `cumpleanos` → `CUMPLEANOS`, `en-casa` → `EN_CASA`.
 *
 * @param {string} clave Clave del catálogo.
 * @returns {string} Símbolo en mayúsculas.
 */
function aSimbolo(clave) {
  return clave.toUpperCase().replace(/-/g, '_');
}

/**
 * Categorías de evento, referenciadas por símbolo.
 *
 * SE DERIVA DE LAS CLAVES DEL CATÁLOGO, no se escribe a mano: cada entrada es
 * el propio slug del catálogo con el nombre puesto en mayúsculas. Así el seed
 * puede escribir `categoria: CATEGORIA.CUMPLEANOS` sin repetir el texto, que es
 * exactamente donde se deslizó la `ñ` la primera vez, y si alguien renombra una
 * clave el símbolo se regenera solo.
 *
 * El precio es que el nombre del símbolo deja de ser independiente del de la
 * clave: no se puede llamar `PASEOS` a la categoría `viaje`. Es un precio
 * aceptable, porque el símbolo no aporta información que la clave no tenga y a
 * cambio no puede quedarse desfasado.
 *
 * @example
 * categoria: CATEGORIA.CUMPLEANOS;  // 'cumpleanos'
 *
 * @type {Readonly<Record<string, CategoriaEvento>>}
 */
export const CATEGORIA = Object.freeze(
  Object.fromEntries(
    Object.keys(CATEGORIAS_EVENTO).map((clave) => [aSimbolo(clave), clave]),
  ),
);

/**
 * Equivalente de `CATEGORIA` para las ideas de cita, derivado igual.
 *
 * @type {Readonly<Record<string, CategoriaIdeaCita>>}
 */
export const CATEGORIA_IDEA = Object.freeze(
  Object.fromEntries(
    Object.keys(CATEGORIAS_IDEA).map((clave) => [aSimbolo(clave), clave]),
  ),
);

/**
 * Comprobación de integridad del catálogo, en tiempo de carga del módulo.
 *
 * Cualquier clave que no sea un slug válido (minúsculas, sin acentos, sin
 * espacios) hace que **importar este módulo lance un error**. Es deliberado:
 * un fallo ruidoso al arrancar es infinitamente más barato que el bug que
 * causó esta función.
 *
 * Qué pasaba antes: el catálogo tenía la clave `cumpleaños`, con `ñ`. Nada
 * protestó. `obtenerCategoria()` caía en la categoría de reserva, así que los
 * cumpleaños se pintaban del color de "Otro", la leyenda leía `undefined` y
 * dejaba la página en blanco. La app parecía funcionar mientras los datos
 * estaban mal, y el error se discovered a ojo, mucho después.
 *
 * El slug no es una etiqueta: es una clave que viaja a la base de datos, a la
 * URL y a las métricas. Por eso tiene reglas.
 *
 * @throws {Error} Si alguna clave del catálogo no cumple el patrón.
 * @example
 * import { CATEGORIAS_EVENTO } from './categorias';
 * // Si alguien añade 'Cumpleaños' como clave, la app no arranca.
 */
function comprobarSlugsDelCatalogo(nombreCatalogo, claves) {
  const invalidas = claves.filter((clave) => !PATRON_CATEGORIA.test(clave));
  if (invalidas.length > 0) {
    throw new Error(
      `${nombreCatalogo}: estas claves no son slugs válidos: ${invalidas.join(', ')}. ` +
        'Usa solo minúsculas ASCII, números y guiones, por ejemplo "cumpleanos" en vez de "cumpleaños".',
    );
  }
}

comprobarSlugsDelCatalogo('CATEGORIAS_EVENTO', Object.keys(CATEGORIAS_EVENTO));
comprobarSlugsDelCatalogo('CATEGORIAS_IDEA', Object.keys(CATEGORIAS_IDEA));

/*
 * Segunda red: los símbolos de arriba se leen con `CATEGORIAS_EVENTO[clave]`, así
 * que si alguien renombra o borra una clave, `CATEGORIA.CITA` pasa a valer
 * `undefined` sin throwing. Un `undefined` como categoría se guarda en el dato
 * y se rompe lejos de aquí, al pintar. Se comprueba en el mismo momento.
 */
for (const [simbolo, clave] of Object.entries(CATEGORIA)) {
  if (!esCategoriaValida(clave)) {
    throw new Error(
      `CATEGORIA.${simbolo} no apunta a una clave real del catálogo (vale ${String(clave)}). ` +
        'Si cambiaste el nombre de una categoría, actualiza CATEGORIA y CATEGORIA_IDEA.',
    );
  }
}
for (const [simbolo, clave] of Object.entries(CATEGORIA_IDEA)) {
  if (!esCategoriaIdeaValida(clave)) {
    throw new Error(
      `CATEGORIA_IDEA.${simbolo} no apunta a una clave real del catálogo de ideas (vale ${String(clave)}).`,
    );
  }
}

/**
 * Comprobación de integridad del catálogo.
 *
 * Si alguna clave no es un slug válido, el servicio de imágenes o una
 * migración de la base de datos podría tratarla de forma distinta sin que nadie
 * lo note. Es una aserción de desarrollo, no una validación de datos: lo que
 * llega de `localStorage` o de la base se comprueba con `esCategoriaValida()`.
 *
 * @type {readonly string[]}
 */
export const CATEGORIAS_EVENTO_INVALIDAS = Object.freeze(
  Object.keys(CATEGORIAS_EVENTO).filter((clave) => !PATRON_CATEGORIA.test(clave)),
);
