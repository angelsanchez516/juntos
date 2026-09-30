/**
 * Componente `BottomNav`.
 *
 * RESPONSABILIDAD: barra de navegación inferior de móvil con los cinco
 * destinos principales. Fija al pie de la pantalla, con separación para la
 * "safe area" de los iPhone con indicador de inicio.
 *
 * Related: src/constants/nav.js, src/components/layout/MobileHeader.jsx
 *
 * @module components/layout/BottomNav
 */

import { NavLink } from 'react-router-dom';
import { MENU_MOVIL } from '../../constants/nav';

/**
 * Renderiza la barra inferior de navegación.
 *
 * @returns {import('react').ReactElement} Barra de navegación fija inferior.
 */
export default function BottomNav() {
  return (
    <nav
      aria-label="Navegación principal"
      className={[
        'fixed inset-x-0 bottom-0 z-30 border-t border-white/5 lg:hidden',
        'bg-sidebar/95 backdrop-blur',
        // pb-extra: en iPhone la barra de inicio ocupa los últimos 34px, así
        // que sin este espacio los iconos quedarían detrás del indicador.
        'pb-[env(safe-area-inset-bottom)]',
      ].join(' ')}
    >
      <ul className="grid grid-cols-5">
        {MENU_MOVIL.map(({ to, label, Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                [
                  // min-h de 56px mantiene el área táctil por encima del
                  // mínimo de 44px recomendado.
                  'flex min-h-14 flex-col items-center justify-center gap-1',
                  'text-[11px] font-medium transition-colors duration-150',
                  isActive ? 'text-accent' : 'text-slate-400 active:text-slate-200',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                  {/*
                    Punto indicador del destino activo. `scale-0` lo colapsa
                    para que no ocupe espacio cuando está inactivo.
                  */}
                  <span
                    className={[
                      'size-1 rounded-pill bg-accent transition-transform duration-150',
                      isActive ? 'scale-100' : 'scale-0',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
