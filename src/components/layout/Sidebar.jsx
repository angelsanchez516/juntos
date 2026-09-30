/**
 * Componente `Sidebar`.
 *
 * RESPONSABILIDAD: barra lateral fija de escritorio con el logo, el menú de
 * navegación y el perfil de la pareja anclado al pie. Solo se renderiza en
 * viewports de 1024px o más; en móvil lo sustituyen MobileHeader y BottomNav.
 *
 * Related: src/constants/nav.js, src/components/ui/Logo.jsx, Layout.jsx
 *
 * @module components/layout/Sidebar
 */

import { NavLink } from 'react-router-dom';
import Logo from '../ui/Logo';
import { MENU_ESCRITORIO, PERFIL_PAREJA, RUTAS } from '../../constants/nav';

/**
 * Renderiza la barra lateral de escritorio.
 *
 * El ítem de Inicio usa `end` para que no quede marcado como activo en todas
 * las rutas hijas: sin `end`, `/` hace match con cualquier ruta y "Inicio"
 * se iluminaría junto a Calendario o Galería.
 *
 * @returns {import('react').ReactElement} Barra lateral.
 */
export default function Sidebar() {
  return (
    <aside
      className={[
        'hidden shrink-0 flex-col bg-sidebar lg:flex',
        // `h-screen` + `sticky` mantiene la barra fija sin usar position fixed,
        // así el contenido principal gestiona su propio scroll.
        'sticky top-0 h-screen w-64 border-r border-white/5',
      ].join(' ')}
    >
      {/* Marca */}
      <div className="px-6 pb-6 pt-8">
        <Logo tamano="md" />
      </div>

      {/* Menú principal */}
      <nav aria-label="Navegación principal" className="flex-1 px-3">
        <ul className="space-y-1">
          {MENU_ESCRITORIO.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                // `end` solo importa para la raíz, pero lo aplicamos a todos
                // para que el comportamiento sea homogéneo si mañana "/"
                // dejara de ser una hoja y pasara a tener subrutas.
                end
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-xl px-3 py-2.5',
                    'text-sm font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-navactive text-white'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`size-5 shrink-0 ${isActive ? 'text-accent' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/*
        Perfil de la pareja, anclado al fondo con mt-auto. Va fuera del <nav>
        porque no es navegación: es información de la cuenta.
      */}
      <div className="border-t border-white/5 p-4">
        <NavLink
          to={RUTAS.CONFIGURACION}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
              isActive
                ? 'bg-navactive text-white'
                : 'hover:bg-white/5 hover:text-slate-100',
            ].join(' ')
          }
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-accent/20 text-base"
            aria-hidden="true"
          >
            ❤️
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-white">
              {PERFIL_PAREJA.nombre}
            </span>
            <span className="block truncate text-xs text-slate-400">
              Juntos desde {PERFIL_PAREJA.desde}
            </span>
          </span>
        </NavLink>
      </div>
    </aside>
  );
}
