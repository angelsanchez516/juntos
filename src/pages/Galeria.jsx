/**
 * Página de la galería de fotos.
 *
 * RESPONSABILIDAD: recoger los eventos, derivar de ellos la lista de fotos y
 * pintarla agrupada por mes. No guarda fotos propias ni tiene datos nuevos: la
 * galería es una vista sobre los eventos, y por eso al borrar un recuerdo su
 * foto desaparece sin borrar nada más.
 *
 * ESTADOS DE LA PÁGINA
 * Son cuatro y se distinguen a propósito, porque confundirlos deja una pantalla
 * en blanco que parece un fallo:
 *   - cargando:eleton con el texto de espera, para que se vea que hay algo.
 *   - error: el mensaje del servicio y un botón para reintentar. Un evento con
 *     `status: false` es un error de la pareja, no un fallo de la app, así que
 *     el botón se llama "Reintentar".
 *   - vacío: la pareja todavía no tiene eventos con foto. Offerimos añadir uno
 *     en vez de dejar el hueco sin explicación.
 *   - con datos: mosaico por meses y filtro de año.
 *
 * LA URL COMO ESTADO
 * `?anio=` y `?evento=` viven en la URL, igual que `?categoria=` en el
 * planeador. Así el enlace "Ver en la galería" del detalle puede abrir la foto
 * exacta con `?evento=<id>`, y un filtro se puede compartir o marcar sin que la
 * página tenga que acordarse de nada entre recargas.
 *
 * Related: src/utils/galeria.js, src/hooks/useEventos.js, MosaicoGaleria.jsx
 *
 * @module pages/Galeria
 */

import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ImagePlus, RefreshCw } from 'lucide-react';
import { useEventos } from '../hooks/useEventos';
import {
  aniosConFotos,
  anioValido,
  extraerFotos,
  filtrarPorAnio,
  agruparFotosPorMes,
  resolverAnio,
  textoRecuento,
} from '../utils/galeria';
import MosaicoGaleria from '../components/galeria/MosaicoGaleria';
import Boton from '../components/ui/Boton';
import { RUTAS } from '../constants/nav';

/**
 * Enlace de un año de la galería, o de "Todos".
 *
 * Va en su propio componente y no en un `map` dentro de la página porque su
 * enlace necesita dos ramas: con año puesto hay que quitar el parámetro, no
 * ponerlo a vacío, y eso no se puede expresar en un `to` calculado de una vez.
 * Además "Todos" no es un año, así que su `to` no lleva `?anio=` en ningún caso
 * y por eso no puede ser el mismo `map` que el resto.
 *
 * @param {object} props Propiedades del enlace.
 * @param {string|null} props.anio Año `YYYY`, o `null` para el enlace "Todos".
 * @param {string} props.texto Texto visible. Puede no ser el propio año.
 * @param {boolean} props.seleccionado Si es el filtro activo.
 * @param {(anio: string|null) => void} props.onElegir Gestor del clic, con el
 *   año a activar o `null` para quitar el filtro.
 * @returns {import('react').ReactElement} Enlace del filtro de años.
 * @example
 * <EnlaceAnio anio={null} texto="Todos" seleccionado onElegir={cambiarAnio} />
 * <EnlaceAnio anio="2026" texto="2026" seleccionado={anio === '2026'} onElegir={cambiarAnio} />
 */
function EnlaceAnio({ anio, texto, seleccionado, onElegir }) {
  return (
    <Link
      to={anio ? `${RUTAS.GALERIA}?anio=${anio}` : RUTAS.GALERIA}
      onClick={(e) => {
        /*
         * Se anula la navegación al pulsar: el enlace se usa como botón, y con
         * `to` sin comprobar el estado, elegir el año ya activo recargaría la
         * página entera en lugar de cerrar el filtro.
         */
        e.preventDefault();
        onElegir(seleccionado && anio ? null : anio);
      }}
      aria-current={seleccionado ? 'true' : undefined}
      className={[
        'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
        seleccionado ? 'bg-accent text-white' : 'bg-surface text-slate-600 hover:bg-slate-100',
      ].join(' ')}
    >
      {texto}
    </Link>
  );
}

/**
 * Renderiza la galería de fotos de la pareja.
 *
 * @returns {import('react').ReactElement} Página de la galería.
 * @example
 * <Galeria />
 */
export default function Galeria() {
  const { eventos, cargando, error, recargar } = useEventos();
  const [parametros, setParametros] = useSearchParams();

  // `?anio=` se normaliza al leerlo, no al escribirlo: una URL con `?anio=20`
  // se trata como "sin filtro" en lugar de dejar el mosaico vacío sin aviso.
  const anioPedido = anioValido(parametros.get('anio'));
  const eventoResaltado = parametros.get('evento');

  const fotos = useMemo(() => extraerFotos(eventos), [eventos]);
  const anios = useMemo(() => aniosConFotos(fotos), [fotos]);

  /*
   * `?evento=` manda sobre `?anio=`. Quien llega desde "Ver en la galería" de un
   * detalle quiere ver esa foto, así que si el año del filtro no es el suyo se
   * aplica el de la foto. El ajuste se deriva en memoria y no reescribiendo la
   * URL, para que el botón "atrás" no devuelva al filtro viejo.
   */
  const anio = useMemo(
    () => resolverAnio(fotos, anioPedido, eventoResaltado),
    [fotos, anioPedido, eventoResaltado],
  );

  const fotosVisibles = useMemo(() => filtrarPorAnio(fotos, anio), [fotos, anio]);
  const grupos = useMemo(() => agruparFotosPorMes(fotosVisibles), [fotosVisibles]);

  /**
   * Cambia el filtro de año en la URL.
   *
   * Al cambiar de año se borra `?evento=` a propósito: la foto resaltada
   * puede no estar en el año nuevo, y dejarla marcada llevaría a un `?evento=`
   * que ya no señala ninguna foto visible.
   *
   * @param {string|null} nuevo Año elegido, o `null` para quitar el filtro.
   * @returns {void}
   */
  function cambiarAnio(nuevo) {
    const siguiente = new URLSearchParams(parametros);
    siguiente.delete('evento');
    if (nuevo) siguiente.set('anio', nuevo);
    else siguiente.delete('anio');
    setParametros(siguiente, { replace: true });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Galería</h1>
          {/*
            El recuento se pone solo. Con el filtro de año puesto dice cuántas
            fotos hay *en ese año*, que es la pregunta que se está haciendo
            quien acaba de filtrar.
          */}
          {!cargando && !error && fotos.length > 0 && (
            <p className="mt-1 text-sm text-slate-500">{textoRecuento(fotosVisibles)}</p>
          )}
        </div>

        <Link
          to={RUTAS.PLANEADOR}
          className="inline-flex items-center gap-2 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          Añadir recuerdo
        </Link>
      </header>

      {/* Años con fotos. Solo si hay más de uno, para no poner un filtro de una opción. */}
      {anios.length > 1 && (
        <nav
          aria-label="Filtrar la galería por año"
          className="flex flex-wrap items-center gap-2"
        >
          <EnlaceAnio
            anio={null}
            texto="Todos"
            seleccionado={!anio}
            onElegir={cambiarAnio}
          />
          {anios.map((valor) => (
            <EnlaceAnio
              key={valor}
              anio={valor}
              texto={valor}
              seleccionado={anio === valor}
              onElegir={cambiarAnio}
            />
          ))}
        </nav>
      )}

      {cargando ? (
        <p className="text-sm text-slate-500" role="status">
          Cargando la galería…
        </p>
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-card bg-surface p-6 shadow-card"
        >
          <p className="text-sm text-red-700">{error}</p>
          <Boton variante="secundario" onClick={recargar}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Reintentar
          </Boton>
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card bg-surface p-6 shadow-card">
          <p className="text-sm text-slate-600">
            {anio
              ? `No hay fotos de ${anio}. Prueba con otro año.`
              : 'Todavía no hay fotos. Añade un recuerdo con una imagen para empezar.'}
          </p>
          {/*
            Sin filtro de año, la salida es "crea una foto". Con filtro puesto,
            volver a "Todos" es más útil que repetir la misma invitación: el
            problema no es que falten fotos, es que se está mirando el año
            equivocado.
          */}
          {anio ? (
            <Boton variante="secundario" onClick={() => cambiarAnio(null)}>
              Ver todos los años
            </Boton>
          ) : (
            <Link
              to={RUTAS.PLANEADOR}
              className="inline-flex items-center gap-2 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-strong"
            >
              <ImagePlus className="size-4" aria-hidden="true" />
              Añadir el primer recuerdo
            </Link>
          )}
        </div>
      ) : (
        <MosaicoGaleria fotos={grupos} eventoResaltado={eventoResaltado} />
      )}
    </div>
  );
}
