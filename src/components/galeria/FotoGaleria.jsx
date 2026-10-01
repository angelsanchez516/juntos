/**
 * Fotografía de la galería.
 *
 * RESPONSABILIDAD: pintar una foto del mosaico, su degradado de reserva, su
 * pie de foto y el enlace a su recuerdo. No pide datos: quien la usa le pasa
 * la foto ya construida por `extraerFotos`.
 *
 * Related: src/utils/galeria.js (los datos), MosaicoGaleria.jsx (el grid),
 * src/components/citas/ImagenIdea.jsx (mismo patrón de reserva)
 *
 * @module components/galeria/FotoGaleria
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Images } from 'lucide-react';
import { degradadoCategoriaEvento, obtenerCategoria } from '../../utils/categorias';
import { formatearFecha } from '../../utils/fechas';
import { RUTAS } from '../../constants/nav';

/**
 * @typedef {object} FotoGaleriaProps
 * @property {import('../../utils/galeria.js').FotoGaleria} foto Foto con su
 *   evento de contexto.
 * @property {boolean} [resaltada] Marca la foto abierta desde `?evento=`, para
 *   que quien llega desde un detalle sepa dónde está dentro del mosaico.
 * @property {string} [ancho] Clase de Tailwind con el ancho. Permite variar el
 *   alto en el mosaico sin duplicar el componente.
 */

/**
 * Pinta una foto enlazada a su recuerdo.
 *
 * La foto del seed es una URL externa y puede fallar sin conexión. La imagen se
 * monta **encima** de un degradado de la categoría, y si el `onError` la apaga
 * queda el degradado con su icono, no un hueco roto ni un icono de navegador.
 *
 * @param {FotoGaleriaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Celda del mosaico.
 * @example
 * <FotoGaleria foto={foto} resaltada={foto.id === eventoAbierto} />
 */
export default function FotoGaleria({ foto, resaltada = false, ancho = 'w-full' }) {
  // Se guarda el fallo de carga para no reintentar: si una URL está rota,
  // volver a pedirla en cada re-render solo gastaría datos a cambio de nada.
  const [falloCarga, setFalloCarga] = useState(false);

  const { evento, titulo, fecha } = foto;
  const categoria = obtenerCategoria(foto.categoria);
  const estiloReserva = degradadoCategoriaEvento(foto.categoria);

  return (
    <Link
      to={`${RUTAS.EVENTO.replace(':id', encodeURIComponent(evento.id))}`}
      /*
       * `group` permite reaccionar en hover/focus a los hijos, y `aria-current` le
       * dice al lector de pantalla que esta es la foto abierta. La etiqueta
       * lleva el título y la fecha: dos fotos del mismo mes tienen que sonar
       * distintas al recorrer la galería.
       */
      className={[
        'group relative block overflow-hidden rounded-card bg-surface shadow-card',
        'transition-shadow hover:shadow-card-strong focus-visible:outline-2',
        'focus-visible:outline-offset-2 focus-visible:outline-accent',
        resaltada ? 'ring-2 ring-accent' : '',
        ancho,
      ].join(' ')}
      aria-label={`Ver el recuerdo de ${titulo}, ${formatearFecha(fecha)}`}
      aria-current={resaltada ? 'true' : undefined}
    >
      {/*
        `aria-hidden` porque el enlace ya tiene etiqueta: con las dos, un lector
        de pantalla anunciaría el título y la fecha dos veces.
      */}
      <div
        className="flex aspect-square w-full items-center justify-center"
        style={estiloReserva}
        aria-hidden="true"
      >
        {falloCarga ? (
          <Images className="size-8 text-white/80" />
        ) : (
          <img
            src={foto.url}
            alt=""
            className="size-full object-cover"
            /*
             * `lazy` porque la galería puede ser larga y las fotos del seed son
             * remotas. Sin esto, abrir la página descargaría todas.
             */
            loading="lazy"
            decoding="async"
            onError={() => setFalloCarga(true)}
          />
        )}
      </div>

      {/*
        El pie va sobre la foto, no debajo: en un mosaico lo que importa es
        reconocer la imagen, y taparla con un bloque de texto taparía el
        recuerdo entero. El degradado del pie es lo que permite leer el texto
        sobre cualquier foto sin saber de antemano cómo es.
      */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/80 to-transparent p-3">
        <p className="truncate text-sm font-semibold text-white">{titulo}</p>
        <p className="truncate text-xs text-white/80">
          {formatearFecha(fecha)} · {categoria.label}
        </p>
      </div>
    </Link>
  );
}
