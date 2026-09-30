/**
 * Página `Inicio`.
 *
 * RESPONSABILIDAD: pantalla de bienvenida a la pareja. Muestra el banner con
 * el saludo "Hola, mi amor", la frase destacada, los próximos eventos y el
 * acceso rápido a agregar un recuerdo.
 *
 * En este paso (b) se conecta con los datos reales vía `useEventos`. El
 * botón de agregar abre el formulario, que llega en el paso d.
 *
 * Related: src/hooks/useEventos.js, src/data/seed.js
 *
 * @module pages/Inicio
 */

import { Link, useNavigate } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import Boton from '../components/ui/Boton';
import ProximosEventos from '../components/eventos/ProximosEventos';
import { useEventos } from '../hooks/useEventos';
import { FOTO_BANNER, fraseDelDia } from '../data/seed';
import { diasHasta, eventosProximos, formatearFecha, hoyISO } from '../utils/fechas';
import { PERFIL_PAREJA } from '../constants/nav';

/**
 * Renderiza la pantalla de inicio.
 *
 * @returns {import('react').ReactElement} Página de inicio.
 */
export default function Inicio() {
  const { eventos, cargando, error } = useEventos();
  const navegar = useNavigate();
  const proximos = eventosProximos(eventos, undefined, 4);
  const frase = fraseDelDia();

  /*
   * `eventos` viene ordenado por fecha, así que el primero es el más antiguo.
   * Si aún no hay ninguno, mostramos hoy como referencia. Usamos `hoyISO()` y
   * no `new Date()` en línea porque el linter de pureza de React marca como
   * impura una llamada a un constructor de fecha durante el render: el valor
   * podría cambiar entre renders sin que cambie ninguna dependencia.
   */
  const primerasFecha = eventos[0]?.fecha ?? hoyISO();

  return (
    <div className="animate-aparecer space-y-6">
      {/* Cabecera de la página */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white sm:text-3xl">
            Hola, mi amor
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Juntos desde {PERFIL_PAREJA.desde}
          </p>
        </div>

        {/*
          El botón rápido abre el formulario, que se construye en el paso d.
          Por ahora navega al calendario, donde habrá un botón equivalente.
          Usamos `useNavigate` de React Router y no `window.location`, que
          recargaría la página entera y perdería el estado del store local
          en memoria.
        */}
        <Boton variante="primario" onClick={() => navegar('/calendario')}>
          <Plus className="size-4" aria-hidden="true" />
          Agregar evento
        </Boton>
      </header>

      {/* Banner con la foto de la pareja al atardecer */}
      <section className="relative overflow-hidden rounded-card">
        <img
          src={FOTO_BANNER}
          alt="Nosotros al atardecer"
          className="h-48 w-full object-cover sm:h-64"
          // La imagen viene de un servidor externo: si falla, el `alt` sigue
          // describiendo la escena para quien use lector de pantalla.
          loading="lazy"
        />
        {/* Degradado para que el texto tenga contraste sobre la foto. */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-base/90 via-base/40 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-white">
            <Sparkles className="size-4 text-accent" aria-hidden="true" />
            {frase}
          </p>
        </div>
      </section>

      {/* Error de carga. No interrumpe el resto de la pantalla. */}
      {error && (
        <p
          role="alert"
          className="rounded-card border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Próximos eventos */}
        <div className="lg:col-span-2">
          {cargando ? (
            <div className="h-56 animate-pulse rounded-card bg-white/5" />
          ) : (
            <ProximosEventos eventos={proximos} />
          )}
        </div>

        {/* Contador de días y accesos rápidos */}
        <div className="space-y-4">
          <div className="rounded-card bg-surface p-5 text-slate-800 shadow-card">
            <h2 className="text-sm font-semibold text-slate-900">
              Recuerdos guardados
            </h2>
            <p className="mt-2 text-3xl font-semibold text-accent">
              {eventos.length}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {cargando ? 'Cargando…' : `Desde ${formatearFecha(primerasFecha, 'd MMMM yyyy')}`}
            </p>
          </div>

          {/*
            Días que faltan para el próximo evento. Solo tiene sentido si hay
            alguno pendiente; con `diasHasta` calculamos la distancia.
          */}
          {proximos[0] && (
            <div className="rounded-card bg-surface p-5 text-slate-800 shadow-card">
              <h2 className="text-sm font-semibold text-slate-900">
                El más próximo
              </h2>
              <p className="mt-2 truncate text-lg font-medium text-slate-900">
                {proximos[0].titulo}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {(() => {
                  const dias = diasHasta(proximos[0].fecha);
                  if (dias === 0) return '¡Es hoy!';
                  if (dias === 1) return 'Mañana';
                  return `En ${dias} días`;
                })()}
              </p>
            </div>
          )}

          {/* Accesos rápidos */}
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/calendario"
              className="rounded-card bg-white/[0.04] p-4 text-center transition-colors hover:bg-white/[0.08]"
            >
              <p className="text-sm font-medium text-slate-200">Calendario</p>
              <p className="mt-0.5 text-xs text-slate-400">Ver el mes</p>
            </Link>
            <Link
              to="/planeador"
              className="rounded-card bg-white/[0.04] p-4 text-center transition-colors hover:bg-white/[0.08]"
            >
              <p className="text-sm font-medium text-slate-200">Planeador</p>
              <p className="mt-0.5 text-xs text-slate-400">Ideas de citas</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
