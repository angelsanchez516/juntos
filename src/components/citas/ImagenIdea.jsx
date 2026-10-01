/**
 * Componente `ImagenIdea`.
 *
 * RESPONSABILIDAD: pintar la imagen de una tarjeta de idea, con un degradado
 * derivado de la categoría cuando no hay foto o cuando la foto falla.
 *
 * POR QUÉ NO DEPENDE DE LAS URLs DEL SEED
 * Las fotos del seed apuntan a `picsum.photos`. Sin conexión, con el ahorro de
 * datos del móvil o con un wifi de centro comercial, esas peticiones fallan y
 * la tarjeta se queda con un hueco roto con un icono de imagen rota. Aquí la
 * foto es un intento, no una garantía: si no carga, el degradado de la categoría
 * queda debajo y no se ve ningún hueco.
 *
 * Related: src/utils/categorias.js (`degradadoCategoriaIdea`), TarjetaIdea.jsx
 *
 * @module components/citas/ImagenIdea
 */

import { useState } from 'react';
import { degradadoCategoriaIdea } from '../../utils/categorias';

/**
 * @typedef {object} ImagenIdeaProps
 * @property {string|null} [imagen] URL o data URL de la foto. `null` si no hay.
 * @property {import('../../types/models.js').CategoriaIdeaCita|string} categoria
 *   Categoría de la idea, de la que se deriva el degradado.
 * @property {string} alt Texto alternativo. Describe la foto, no la idea: si no
 *   hay foto, el componente no pinta ninguna imagen y el alt no se lee.
 * @property {string} [className] Clases del contenedor.
 * @property {boolean} [esLazy] Carga diferida. Por defecto `true`, porque la
 *   galería puede tener muchas tarjetas y las de abajo no se ven al abrir.
 */

/**
 * Renderiza la imagen de una idea o su degradado de reserva.
 *
 * @param {ImagenIdeaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Imagen o degradado.
 * @example
 * <ImagenIdea imagen={idea.imagen} categoria={idea.categoria} alt={idea.titulo} />
 */
export default function ImagenIdea({
  imagen,
  categoria,
  alt,
  className = '',
  esLazy = true,
}) {
  const [fallo, setFallo] = useState(false);

  /*
   * El degradado se aplica al contenedor, no a la imagen. Si estuviera en la
   * propia <img>, al fallar la carga el navegador sustituye el elemento entero
   * y el estilo se va con él, dejando el hueco roto.
   */
  const estilo = degradadoCategoriaIdea(categoria);

  if (!imagen || fallo) {
    return (
      <div
        // Sin imagen que describir, el contenedor es decorativo y se oculta del
        // árbol de accesibilidad. El título de la tarjeta ya está en la página.
        aria-hidden="true"
        style={estilo}
        className={className}
      />
    );
  }

  return (
    <div style={estilo} className={className}>
      {/*
        `onError` es la red de seguridad. `useState` mantiene el fallo entre
        re-renders: si solo se guardara en una variable durante el render, un
        re-render por otro motivo volvería a intentar pintar la <img>.
      */}
      <img
        src={imagen}
        alt={alt}
        loading={esLazy ? 'lazy' : 'eager'}
        decoding="async"
        onError={() => setFallo(true)}
        className="size-full object-cover"
      />
    </div>
  );
}
