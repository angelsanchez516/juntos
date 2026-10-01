/**
 * Utilidades de la galería de fotos.
 *
 * RESPONSABILIDAD: derivar la lista de fotos a partir de los eventos y
 * decidir cómo se agrupan y ordenan. Todo aquí es pura: recibe eventos y
 * devuelve datos, sin React, sin `localStorage` y sin leer nada de la pantalla.
 * Por eso se puede probar sin montar un componente.
 *
 * DE DÓNDE SALEN LAS FOTOS
 * La galería no tiene fotos propias: usa la de cada
 * {@link import('../types/models.js').Evento}. Eso significa que no hay una
 * tabla nueva, ni una clave de almacenamiento nueva, ni un servicio nuevo. La
 * galería es una *vista* sobre los eventos, y por eso al borrar un evento
 * desaparece su foto sin que haya que borrar nada más.
 *
 * Related: src/pages/Galeria.jsx, src/hooks/useEventos.js, src/utils/fechas.js
 *
 * @module utils/galeria
 */

import { agruparPorMes } from './fechas';

/**
 * Una foto de la galería, con el contexto de su evento.
 *
 * No es un `Evento`: guarda solo lo que la galería necesita pintar y un
 * puntero al evento entero, para que el enlace al detalle no tenga que
 * reconstruir la ruta desde campos sueltos.
 *
 * @typedef {object} FotoGaleria
 * @property {string} id Id del evento. Sirve de clave de React y permite
 *   resaltar la foto abierta desde `?evento=`.
 * @property {string} url La foto: URL del seed o data URL subida por la pareja.
 * @property {import('../types/models.js').Evento} evento El evento completo.
 * @property {string} fecha Fecha `YYYY-MM-DD` del evento, para agrupar por mes.
 * @property {string} titulo Título del evento, para el texto bajo la foto.
 * @property {import('../types/models.js').CategoriaEvento} categoria
 *   Categoría del evento, de la que sale el degradado si la foto no carga.
 */

/**
 * Orden de las fotos dentro de un mes: más reciente primero.
 *
 * La galería se mira de arriba abajo como un álbum, así que lo último que pasó
 * es lo primero que se ve. Es lo contrario que en el calendario, donde lo
 * próximo va arriba, y por eso el sentido no se hereda de `eventosOrdenados`:
 * heredarlo sería correcto por casualidad y nadie sabría por qué.
 *
 * Dentro del mismo día, la hora manda: un evento de las 21:00 es más reciente
 * que uno de las 9:00. Sin hora se trata como `''`, que ordena antes, pero como
 * se compara con el signo hay que decidir en qué lado: aquí el sin hora va al
 * final, porque ocupa el día entero y no tiene una hora propia con la que
 * ordenar.
 *
 * @param {FotoGaleria} a Primera foto.
 * @param {FotoGaleria} b Segunda foto.
 * @returns {number} Negativo si `a` va antes.
 * @example
 * // Orden descendente por fecha.
 * [a, b].sort(ordenarPorRecencia);
 */
function ordenarPorRecencia(a, b) {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;

  const horaA = a.evento?.hora ?? '';
  const horaB = b.evento?.hora ?? '';
  if (horaA === horaB) return 0;

  // Sin hora no es "más temprano", es "todo el día": va detrás.
  if (horaA === '') return 1;
  if (horaB === '') return -1;
  return horaA < horaB ? 1 : -1;
}

/**
 * Extrae las fotos de una lista de eventos.
 *
 * Descarta los eventos sin foto. Una `foto` puede venir como `null`, como
 * cadena vacía o ausente según cómo se haya escrito el dato, y los tres casos
 * son "no hay foto": si solo se filtrara el `null`, una cadena vacía se
 * colaría en la galería y pintaría un hueco que no es una imagen.
 *
 * Las fotos del seed apuntan a `picsum.photos`, así que pueden fallar sin
 * conexión. Por eso quien las pinta lleva un degradado de reserva debajo; aquí
 * no se puede saber si cargarán y no se descarta nada por si acaso.
 *
 * @param {ReadonlyArray<import('../types/models.js').Evento>} Eventos de la
 *   pareja, en cualquier orden.
 * @returns {ReadonlyArray<FotoGaleria>} Fotos ordenadas de más reciente a más
 *   antigua. Vacío si ningún evento tiene foto.
 * @example
 * const fotos = extraerFotos(eventos);
 * fotos[0].titulo; // 'Noche de juegos'
 * fotos.length;   // solo los eventos con foto
 */
export function extraerFotos(eventos) {
  if (!Array.isArray(eventos)) return [];

  return eventos
    .filter((evento) => {
      const foto = evento?.foto;
      // Se descarta también un id o una fecha que no sirvan, porque sin ellos
      // la foto no se podría enlazar a su recuerdo.
      return (
        typeof foto === 'string' &&
        foto.trim() !== '' &&
        typeof evento.id === 'string' &&
        evento.id !== '' &&
        typeof evento.fecha === 'string' &&
        evento.fecha !== ''
      );
    })
    .map((evento) => ({
      id: evento.id,
      url: evento.foto,
      evento,
      fecha: evento.fecha,
      titulo: evento.titulo,
      categoria: evento.categoria,
    }))
    .sort(ordenarPorRecencia);
}

/**
 * Agrupa las fotos por mes, de más reciente a más antigua.
 *
 * Envuelve a `agruparPorMes` de `utils/fechas.js` en vez de reimplementar el
 * agrupado. Esa función ya resuelve dos cosas que son fáciles de hacer mal: la
 * clave del mes se compara **como cadena** (`YYYY-MM` ordena cronológicamente
 * sin parsear fechas) y el encabezado se formatea en un único sitio, de modo
 * que la galería y la línea de tiempo no pueden desincronizarse en cómo se
 * escribe "octubre de 2026".
 *
 * El orden descendente viene de la propia función, y no se invierte aquí: ella
 * espera una lista ordenada de más reciente a más antigua, que es justo lo que
 * devuelve `extraerFotos`.
 *
 * @param {ReadonlyArray<FotoGaleria>} fotos Fotos ya ordenadas.
 * @returns {ReadonlyArray<{clave: string, etiqueta: string, items: FotoGaleria[]}>}
 *   Grupos de mes, del más reciente al más antiguo.
 * @example
 * agruparFotosPorMes(fotos)[0].etiqueta; // 'Octubre de 2026'
 */
export function agruparFotosPorMes(fotos) {
  return agruparPorMes(fotos);
}

/**
 * Años que tienen fotos, del más reciente al más antiguo.
 *
 * Sirve para el selector de año. Se derivan de las fotos y no del grupo de meses
 * para que el orden sea explícito: los meses vienen ya ordenados, y elegir el
 * año "de cabeza" apoyándose en ese orden sería frágil en cuanto se filtrara.
 *
 * @param {ReadonlyArray<FotoGaleria>} fotos Fotos de la galería.
 * @returns {ReadonlyArray<string>} Años únicos `YYYY`, descendentes.
 * @example
 * aniosConFotos(fotos); // ['2026', '2025']
 */
export function aniosConFotos(fotos) {
  const anios = new Set();
  for (const foto of fotos) {
    const anio = String(foto?.fecha ?? '').slice(0, 4);
    if (/^\d{4}$/.test(anio)) anios.add(anio);
  }
  return [...anios].sort((a, b) => (a < b ? 1 : -1));
}

/**
 * Deja solo las fotos del año pedido.
 *
 * Acepta `null` o `undefined` y devuelve la lista entera, que es lo que quiere
 * la página cuando no hay año seleccionado. Así la llamada no necesita un
 * `if` en el JSX, y el valor de la URL se puede pasar tal cual.
 *
 * @param {ReadonlyArray<FotoGaleria>} fotos Fotos de la galería.
 * @param {string|null|undefined} anio Año `YYYY`, o `null` para todos.
 * @returns {ReadonlyArray<FotoGaleria>} Fotos de ese año, en el mismo orden.
 * @example
 * filtrarPorAnio(fotos, '2026');
 * filtrarPorAnio(fotos, null).length; // todas
 */
export function filtrarPorAnio(fotos, anio) {
  if (!anio) return fotos;
  return fotos.filter((foto) => String(foto?.fecha ?? '').slice(0, 4) === anio);
}

/**
 * Saca el año de un parámetro de la URL y lo normaliza.
 *
 * La URL la escribe la persona, o un enlace antiguo, o un `?anio=` pegado a
 * mano. Solo se acepta un año de cuatro cifras; cualquier otra cosa se
 * descarta y se trata como "sin filtro". Sin esta normalización, un `?anio=20`
 * dejaría la galería vacía sin explicación, que es la peor forma de fallar.
 *
 * @param {string|null|undefined} valor Valor crudo del parámetro.
 * @returns {string|null} Año `YYYY`, o `null` si no es válido.
 * @example
 * anioValido('2026'); // '2026'
 * anioValido('20');   // null
 * anioValido(null);   // null
 */
export function anioValido(valor) {
  if (typeof valor !== 'string') return null;
  return /^\d{4}$/.test(valor) ? valor : null;
}

/**
 * Cuenta cuántas fotos hay, para el encabezado de la página.
 *
 * El plural tiene que concordar: "1 foto" y "3 fotos". Es un detalle pequeño,
 * pero un "1 fotos" delata que el texto es una plantilla.
 *
 * @param {ReadonlyArray<FotoGaleria>} fotos Fotos visibles.
 * @returns {string} Texto del recuento, por ejemplo "3 fotos".
 * @example
 * textoRecuento([{ id: 'a' }]); // '1 foto'
 */
export function textoRecuento(fotos) {
  const total = Array.isArray(fotos) ? fotos.length : 0;
  return total === 1 ? '1 foto' : `${total} fotos`;
}
