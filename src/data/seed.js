/**
 * Datos de ejemplo de "Juntos".
 *
 * RESPONSABILIDAD: contener los eventos e ideas de cita iniciales del mockup.
 * Es la única fuente de datos de arranque; los services lo leen **una sola
 * vez**, cuando no hay nada guardado todavía.
 *
 * POR QUÉ LAS FECHAS SE CALCULAN Y NO SE ESCRIBEN FIJAS
 * El mockup se diseñó en septiembre de 2025, con eventos los días 5, 12, 14,
 * 19, 22 y 26 de septiembre. Si copiáramos esas fechas literales
 * (`'2025-09-12'`), al abrir la app en 2026 el calendario del mes actual
 * saldría completamente vacío y el panel "Próximos eventos" no tendría nada
 * que enseñar. Los datos de ejemplo dejarían de ser útiles al día siguiente
 * de escribirlos.
 *
 * Por eso las fechas se generan con `diaDelMes()` de src/utils/fechas.js,
 * que las ancla al mes en curso. Los días 5 y 12, que en el mockup ya habían
 * pasado, se desplazan al mes siguiente para que siempre haya pasado y futuro.
 *
 * Related: src/services/eventosService.js, src/services/citasService.js,
 * src/utils/fechas.js, src/utils/reloj.js
 *
 * @module data/seed
 */

import { diaDelMes } from '../utils/fechas';
import { ahora } from '../utils/reloj';
import { CATEGORIA, CATEGORIA_IDEA } from '../utils/categorias';
import { ORIGEN } from '../types/models';

/**
 * IDs estables de los datos de ejemplo.
 *
 * Se fijan a mano (en lugar de generar UUID al vuelo) para que el seed sea
 * determinista: facilita la depuración y hace que volver a sembrar tras un
 * reset produzca exactamente los mismos datos, útil al escribir tests.
 *
 * DEBEN SER UUID VÁLIDOS. Los ids los validan los services con `esIdValido`
 * antes de cualquier búsqueda, así que un id con formato libre (por ejemplo
 * `'seed-cena'`) haría que toda operación sobre ese registro devolviera `null`
 * sin error: la idea no se podría marcar como favorita ni editar.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const IDS_SEED = Object.freeze({
  ANIVERSARIO: 'a0d10001-a0d1-4a01-8a01-a0d100000001',
  CENA: 'a0d10002-a0d2-4a02-8a02-a0d200000002',
  SAN_GIL: 'a0d10003-a0d3-4a03-8a03-a0d300000003',
  CUMPLEANOS: 'a0d10004-a0d4-4a04-8a04-a0d400000004',
  CINE: 'a0d10005-a0d5-4a05-8a05-a0d500000005',
  JUEGOS: 'a0d10006-a0d6-4a06-8a06-a0d600000006',
  TENTACION_CARPACHO: 'a0d10007-a0d7-4a07-8a07-a0d700000007',
  ANIVERSARIO_PASADO: 'a0d10008-a0d8-4a08-8a08-a0d800000008',
});

/**
 * IDs de las ideas de ejemplo.
 *
 * OJO CON EL FORMATO: estos tienen que ser UUID válidos (versión 4, con el
 * nibble `4` en el tercer grupo y `8`/`9`/`a`/`b` en el cuarto), igual que los
 * que genera `nuevoId()`. Si se pusieran textos como `'seed-idea-cine'`,
 * `esIdValido` los rechazaría y ninguna operación sobre esas ideas
 * (marcar favorita, editar, eliminar) encontraría el registro: fallaría en
 * silencio, devolviendo `null` sin error visible.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const IDS_SEED_IDEAS = Object.freeze({
  CINE_CASA: 'b0d20001-b0d2-4b01-8b01-b0d100000001',
  PICNIC: 'b0d20002-b0d2-4b02-8b02-b0d200000002',
  ESCAPADA: 'b0d20003-b0d3-4b03-8b03-b0d300000003',
  COCINAR: 'b0d20004-b0d4-4b04-8b04-b0d400000004',
  SPA: 'b0d20005-b0d5-4b05-8b05-b0d500000005',
});

/**
 * Foto de una pareja al atardecer, usada como banner de Inicio.
 * Placeholder remoto hasta tener las fotos reales de la pareja.
 * @type {string}
 */
export const FOTO_BANNER =
  'https://picsum.photos/seed/juntos-banner/1200/600';

/**
 * Genera una URL de placeholder determinista para una foto de evento.
 *
 * `picsum.photos` permite pedir una imagen por semilla, así que siempre
 * devuelve la misma para el mismo `seed` y los datos de ejemplo son estables
 * entre recargas.
 *
 * @param {string} semilla Semilla que identifica la imagen.
 * @param {number} [ancho] Ancho en píxeles.
 * @param {number} [alto] Alto en píxeles.
 * @returns {string} URL de la imagen.
 * @example
 * fotoPlaceholder('cena', 800, 600);
 * // 'https://picsum.photos/seed/cena/800/600'
 */
export function fotoPlaceholder(semilla, ancho = 800, alto = 600) {
  return `https://picsum.photos/seed/${semilla}/${ancho}/${alto}`;
}

/**
 * Eventos de ejemplo del mockup.
 *
 * Reparto de meses para que el calendario del mes actual tenga contenido y el
 * panel de próximos eventos nunca esté vacío:
 * - **Mes actual:** aniversario (12), cena (14), San Gil (19), cumpleaños (22),
 *   juegos (26).
 * - **Mes siguiente:** cine (5) y un segundo aniversario (12), que en el
 *   mockup ya habían pasado y aquí sirven de próximos.
 *
 * @param {Date} [fechaReferencia] Instante cuyo mes y año anclan las fechas. Por
 *   defecto, el reloj de `src/utils/reloj.js`. Se pasa explícito para poder
 *   sembrar un mes concreto desde una prueba sin tocar el reloj global.
 * @returns {Array<import('../types/models.js').Evento>} Eventos nuevos, con sus
 *   fechas ya resueltas a fechas del mes indicado.
 * @example
 * const eventos = crearEventosSeed();
 * eventos[0].fecha; // '2026-10-12'
 * crearEventosSeed(new Date(2027, 1, 28))[0].fecha; // '2027-02-12'
 */
export function crearEventosSeed(fechaReferencia = ahora()) {
  return [
    {
      id: IDS_SEED.ANIVERSARIO_PASADO,
      titulo: 'Nuestro aniversario',
      fecha: diaDelMes(12, 1, fechaReferencia),
      hora: null,
      descripcion:
        'El primer año juntos. Luego veníamos a cenar aquí cada mes, y cada vez nos contábamos más cosas.',
      lugar: 'Casa',
      categoria: CATEGORIA.ANIVERSARIO,
      foto: fotoPlaceholder('aniversario-pasado', 1200, 800),
      creadoEn: fechaReferencia.toISOString(),
    },
    {
      id: IDS_SEED.ANIVERSARIO,
      titulo: 'Nuestro aniversario',
      fecha: diaDelMes(12, 0, fechaReferencia),
      hora: null,
      descripcion:
        'Dos años desde que empezó todo. No lo planeamos, pero salió perfecto. Vamos a celebrarlo con algo dulce y mucho tiempo sin mirar el reloj.',
      lugar: 'Casa',
      categoria: CATEGORIA.ANIVERSARIO,
      foto: fotoPlaceholder('aniversario', 1200, 800),
      creadoEn: fechaReferencia.toISOString(),
    },
    {
      id: IDS_SEED.CENA,
      titulo: 'Cena romántica',
      fecha: diaDelMes(14, 0, fechaReferencia),
      hora: '19:00',
      descripcion:
        'Mesa junto a la ventana, como la última vez. Pedimos el vino que probamos y ahí nos dimos cuenta de que ninguno de los dos quería irnos.',
      lugar: 'Restaurante La Terraza – Ocaña',
      categoria: CATEGORIA.CITA,
      foto: fotoPlaceholder('cena-romantica', 1200, 800),
      creadoEn: fechaReferencia.toISOString(),
    },
    {
      id: IDS_SEED.SAN_GIL,
      titulo: 'Viaje a San Gil',
      fecha: diaDelMes(19, 0, fechaReferencia),
      hora: null,
      descripcion:
        'Tres días fuera. Senderismo por la mañana y siesta larga después. Hay que reservar el hotel antes, que en temporada se llena.',
      lugar: 'San Gil, Santander',
      categoria: CATEGORIA.VIAJE,
      foto: fotoPlaceholder('san-gil', 1200, 800),
      creadoEn: fechaReferencia.toISOString(),
    },
    {
      id: IDS_SEED.CUMPLEANOS,
      titulo: 'Cumpleaños',
      fecha: diaDelMes(22, 0, fechaReferencia),
      hora: null,
      descripcion: 'Tarta y velas. Ese día manda ella.',
      lugar: 'Casa',
      categoria: CATEGORIA.CUMPLEANOS,
      foto: fotoPlaceholder('cumpleanos', 1200, 800),
      creadoEn: fechaReferencia.toISOString(),
    },
    {
      id: IDS_SEED.JUEGOS,
      titulo: 'Noche de juegos',
      fecha: diaDelMes(26, 0, fechaReferencia),
      hora: '20:00',
      descripcion:
        'Juegos de mesa hasta que nos den las ganas de dormir, o hasta que alguien gane, lo que pase primero.',
      lugar: 'Casa',
      categoria: CATEGORIA.CITA,
      foto: fotoPlaceholder('noche-de-juegos', 1200, 800),
      creadoEn: fechaReferencia.toISOString(),
    },
    {
      id: IDS_SEED.CINE,
      titulo: 'Cine',
      fecha: diaDelMes(5, 1, fechaReferencia),
      hora: '21:00',
      descripcion: 'La que estaba en cartelera. Palomitas grandes.',
      lugar: 'Multicentro',
      categoria: CATEGORIA.CITA,
      foto: fotoPlaceholder('cine', 1200, 800),
      creadoEn: fechaReferencia.toISOString(),
    },
    {
      id: IDS_SEED.TENTACION_CARPACHO,
      titulo: 'Tentación: completar la colección',
      fecha: diaDelMes(15, 1, fechaReferencia),
      hora: null,
      descripcion:
        'Un viaje a la ciudad para mirar cosas que no vamos a comprar. Pero vamos a mirar.',
      lugar: 'Bogotá',
      categoria: CATEGORIA.OTRO,
      foto: fotoPlaceholder('carpacho', 1200, 800),
      creadoEn: fechaReferencia.toISOString(),
    },
  ];
}

/**
 * Ideas de cita de ejemplo del mockup, sin su origen todavía.
 *
 * Van aparte de `crearIdeasSeed()` a propósito. El `origen` se añade en un solo
 * sitio, en el `map` de esa función, y no escrito cinco veces en estos objetos: si
 * estuviera en cada literal, añadir una sexta idea obligaría a acordarse de
 * escribir `origen: ORIGEN.SEED` en ella, y una idea sin esa línea se
 * confundiría con una idea propia y se podría editar o borrar sin querer. Aquí
 * es imposible: toda idea que salga de aquí lleva origen.
 *
 * Las dos primeras se marcan como favoritas, como en el mockup.
 *
 * @type {ReadonlyArray<Omit<import('../types/models.js').IdeaCita, 'origen'>>}
 */
const IDEAS_SEED = Object.freeze([
  {
    id: IDS_SEED_IDEAS.CINE_CASA,
    titulo: 'Noche de cine en casa',
    descripcion:
      'Luz apagada, manta y algo rico para picar. Película que ya vimos mil veces pero da igual.',
    categoria: CATEGORIA_IDEA.EN_CASA,
    favorita: true,
    imagen: fotoPlaceholder('idea-cine-casa', 800, 600),
  },
  {
    id: IDS_SEED_IDEAS.PICNIC,
    titulo: 'Picnic en el parque',
    descripcion:
      'Manta a la sombra, algo de picar y no mirar el reloj. Llevar un libro por si acaso.',
    categoria: CATEGORIA_IDEA.AFUERA,
    favorita: true,
    imagen: fotoPlaceholder('idea-picnic', 800, 600),
  },
  {
    id: IDS_SEED_IDEAS.ESCAPADA,
    titulo: 'Escapada de fin de semana',
    descripcion:
      'Carretera, un sitio con piscina y ninguna lista de cosas que hacer. Dormir sin alarma.',
    categoria: CATEGORIA_IDEA.AVENTURA,
    favorita: false,
    imagen: fotoPlaceholder('idea-escapada', 800, 600),
  },
  {
    id: IDS_SEED_IDEAS.COCINAR,
    titulo: 'Cocinar juntos',
    descripcion:
      'Elegimos la receta más ambiciosa que encontremos y vemos qué sale. Perdemos el primer intento.',
    categoria: CATEGORIA_IDEA.EN_CASA,
    favorita: false,
    imagen: fotoPlaceholder('idea-cocinar', 800, 600),
  },
  {
    id: IDS_SEED_IDEAS.SPA,
    titulo: 'Día de spa en pareja',
    descripcion:
      'Masajes, baños y cero prisa. El mejor regalo de cumpleaños que no cuesta nada.',
    categoria: CATEGORIA_IDEA.RELAX,
    favorita: false,
    imagen: fotoPlaceholder('idea-spa', 800, 600),
  },
]);

/**
 * Ideas de cita de ejemplo del mockup.
 *
 * Todas llevan `origen: 'seed'`, y por eso ninguna se puede editar ni borrar
 * desde el planeador: son contenido de ejemplo, y borrarlas dejaría la pantalla
 * más vacía de lo que empezó sin forma de recuperarlas.
 *
 * @returns {Array<import('../types/models.js').IdeaCita>} Ideas nuevas.
 * @example
 * const ideas = crearIdeasSeed();
 * ideas[0].favorita; // true
 * ideas[0].origen;   // 'seed'
 */
export function crearIdeasSeed() {
  return IDEAS_SEED.map((idea) => ({ ...idea, origen: ORIGEN.SEED }));
}

/**
 * Frase destacada que aparece en la tarjeta de Inicio.
 *
 * Se elige de forma determinista según el día del mes para que cambie a lo
 * largo del mes sin necesidad de backend ni de aleatoriedad.
 *
 * @type {ReadonlyArray<string>}
 */
export const FRASES = Object.freeze([
  'Los pequeños momentos son los que se quedan.',
  'Cada día contigo es un plan.',
  'Lo que más importa es que estemos juntos.',
  'Hay días que valen por meses enteros.',
  'Seguimos sin planearlo, y aun así nos sale bien.',
]);

/**
 * Devuelve la frase del día.
 *
 * El día se lee en hora local (`getDate()`) y no recortando la cadena UTC que
 * devuelve `toISOString()`. Recortar la cadena elegía la frase según el día en
 * UTC, que va cinco horas por delante de Colombia: desde las siete de la tarde
 * la app anunciaba la frase de mañana. Se pide al reloj de `src/utils/reloj.js`
 * para que una prueba con fecha simulada reciba siempre la misma frase.
 *
 * @returns {string} Una frase, estable durante todo el día.
 * @example
 * fraseDelDia(); // 'Cada día contigo es un plan.'
 */
export function fraseDelDia() {
  return FRASES[ahora().getDate() % FRASES.length];
}
