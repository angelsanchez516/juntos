/**
 * Componente `Layout`.
 *
 * RESPONSABILIDAD: armazón de la aplicación. Decide entre el layout de
 * escritorio (sidebar fija) y el de móvil (header superior + barra inferior),
 * y aporta el contenedor de scroll del contenido.
 *
 * Related: src/components/layout/Sidebar.jsx, MobileHeader.jsx, BottomNav.jsx
 *
 * @module components/layout/Layout
 */

import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import BottomNav from './BottomNav';
import { useEsEscritorio } from '../../hooks/useMediaQuery';

/**
 * Renderiza el armazón de la aplicación.
 *
 * No recibe props: el contenido de cada página llega por el <Outlet /> de
 * React Router, porque las rutas se definen anidadas bajo este layout.
 *
 * @returns {import('react').ReactElement} Estructura completa del layout.
 */
export default function Layout() {
  const esEscritorio = useEsEscritorio();
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-base">
      {/* Navegación de escritorio. */}
      {esEscritorio && <Sidebar />}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navegación de móvil. */}
        {!esEscritorio && <MobileHeader />}

        {/*
          Contenido con scroll propio. `key` cambia al navegar para que la
          animación de entrada se repita en cada página.
        */}
        <main
          key={location.pathname}
          className={[
            'flex-1 overflow-y-auto',
            // En móvil hay que reservar el alto de la barra inferior fija.
            !esEscritorio && 'pb-24',
            'px-4 py-6 sm:px-6 lg:px-10 lg:py-10',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="mx-auto w-full max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>

      {!esEscritorio && <BottomNav />}
    </div>
  );
}
