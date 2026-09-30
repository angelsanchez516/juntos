/**
 * Definición de rutas de "Juntos".
 *
 * RESPONSABILIDAD: mapear todas las rutas de la aplicación. Las páginas
 * anidadas bajo `<Layout />` comparten sidebar, header móvil y barra inferior.
 * La ruta `/bienvenida` queda fuera de ese layout para que muestre una
 * pantalla limpia, tal y como se ve en el mockup.
 *
 * Por qué Inicio (`/`) y Momentos (`/momentos`) NO comparten ruta: con
 * `NavLink` dos ítems con el mismo `to` se marcan como activos a la vez. Esta
 * separación corrige ese comportamiento.
 *
 * Related: src/constants/nav.js (coincide con RUTAS), src/components/layout/Layout.jsx
 *
 * @module App
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { RUTAS } from './constants/nav';

// Páginas anidadas bajo Layout
import Inicio from './pages/Inicio';
import Calendario from './pages/Calendario';
import EventoDetalle from './pages/EventoDetalle';
import Planeador from './pages/Planeador';
import Momentos from './pages/Momentos';
import Galeria from './pages/Galeria';
import Configuracion from './pages/Configuracion';

// Página fuera del layout
import Bienvenida from './pages/Bienvenida';

/**
 * Componente raíz de la aplicación.
 *
 * @returns {import('react').ReactElement} Árbol de rutas.
 */
export default function App() {
  return (
    <Routes>
      {/*
        Ruta pública de bienvenida (sin layout). No requiere autenticación en
        Fase 1 (login simulado). TODO-FASE2 (SEGURIDAD): proteger rutas
        privadas y redirigir a /bienvenida cuando no hay sesión válida.
      */}
      <Route path={RUTAS.BIENVENIDA} element={<Bienvenida />} />

      {/*
        Rutas principales dentro del armazón de la aplicación. Todas comparten
        el layout responsive (sidebar / header + bottom nav).
      */}
      <Route element={<Layout />}>
        <Route path={RUTAS.INICIO} element={<Inicio />} />
        <Route path={RUTAS.CALENDARIO} element={<Calendario />} />
        <Route path={RUTAS.EVENTO} element={<EventoDetalle />} />
        <Route path={RUTAS.PLANEADOR} element={<Planeador />} />
        <Route path={RUTAS.MOMENTOS} element={<Momentos />} />
        <Route path={RUTAS.GALERIA} element={<Galeria />} />
        <Route path={RUTAS.CONFIGURACION} element={<Configuracion />} />
      </Route>

      {/*
        Fallback: cualquier ruta desconocida redirige al inicio. En Fase 2 esto
        puede redirigir a 404 o a bienvenida según el estado de sesión.
      */}
      <Route path="*" element={<Navigate to={RUTAS.INICIO} replace />} />
    </Routes>
  );
}
