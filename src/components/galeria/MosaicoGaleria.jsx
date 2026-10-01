/**
 * Mosaico de fotos agrupado por mes.
 *
 * RESPONSABILIDAD: pintar la rejilla y sus encabezados de mes. No sabe de
 * dónde salen las fotos ni decide el orden: recibe los grupos ya formados, que
 * es la parte con lógica.
 *
 * Related: src/utils/galeria.js (`agruparFotosPorMes`), FotoGaleria.jsx
 *
 * @module components/galeria/MosaicoGaleria
 */

import FotoGaleria from './FotoGaleria';

/**
 * @typedef {object} MosaicoGaleriaProps
 * @property {ReadonlyArray<import('../../utils/galeria.js').FotoGaleria>} fotos
 *   Fotos a pintar, ya ordenadas de más reciente a más antigua.
 * @property {string|null} [eventoResaltado] Id del evento abierto desde
 *   `?evento=`, para distinguirlo dentro del mosaico.
 */

/**
 * Pinta el mosaico de la galería, con un encabezado por mes.
 *
 * Las clases del grid son deliberadamente explícitas en lugar de venir de una
 * constante: son cuatro números y en una sola línea se lee de qué columnas
 * parte el mosaico en cada tamaño, cosa que una constante repartida en otro
 * sitio ocultaría.
 *
 * @param {MosaicoGaleriaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Lista de meses con sus fotos.
 * @example
 * <MosaicoGaleria fotos={fotos} eventoResaltado="ev-1" />
 */
export default function MosaicoGaleria({ fotos, eventoResaltado = null }) {
  return (
    <div className="flex flex-col gap-10">
      {fotos.map((grupo) => (
        <section key={grupo.clave} aria-labelledby={`mes-${grupo.clave}`}>
          <h2
            id={`mes-${grupo.clave}`}
            className="mb-4 text-lg font-semibold capitalize text-slate-900"
          >
            {grupo.etiqueta}
          </h2>

          {/*
            `role="list"` con hijos `role="listitem"`: un `ul` de celdas
            enlazadas se anunciaría como "lista de enlaces" sin indicar cuántas
            fotos hay, y `Safari` deja de anunciar los roles de lista si el
            contenedor es un `div` sin `display: grid` explícito.
          */}
          <ul
            role="list"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          >
            {grupo.items.map((foto) => (
              <li key={foto.id}>
                <FotoGaleria
                  foto={foto}
                  resaltada={foto.id === eventoResaltado}
                  ancho="w-full"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
