/**
 * Componente `MobileHeader`.
 *
 * RESPONSABILIDAD: cabecera superior visible solo en móvil. Lleva el logo y un
 * acceso rápido a Configuración, que sustituye a la navegación por icono que
 * no cabe en el header.
 *
 * Related: src/components/layout/BottomNav.jsx (navegación principal de móvil)
 *
 * @module components/layout/MobileHeader
 */

import { Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import Logo from '../ui/Logo';
import { RUTAS } from '../../constants/nav';

/**
 * Renderiza la cabecera de móvil.
 *
 * @returns {import('react').ReactElement} Cabecera fija superior.
 */
export default function MobileHeader() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/5 bg-sidebar/95 px-4 py-3 backdrop-blur lg:hidden">
      <Link to={RUTAS.INICIO} aria-label="Ir al inicio">
        <Logo tamano="sm" />
      </Link>

      <Link
        to={RUTAS.CONFIGURACION}
        aria-label="Configuración"
        className="rounded-pill p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
      >
        <Settings className="size-5" aria-hidden="true" />
      </Link>
    </header>
  );
}
