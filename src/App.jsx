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
 * Y las dos guardas de sesión: `ConSesion` para todo lo de dentro del layout, y
 * `SinSesion` para la bienvenida. Ninguna de las dos es autenticación.
 *
 * Related: src/constants/nav.js (coincide con RUTAS), src/components/layout/Layout.jsx
 *
 * @module App
 */

import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import { RUTAS } from './constants/nav';
import { haySesion } from './services/sesion';

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
 * Deja pasar solo a quien tiene sesión.
 *
 * SEGURIDAD: esto NO es autenticación. `haySesion()` solo comprueba si existe la
 * clave `juntos:v1:sesion`, que cualquiera puede escribir desde la consola del
 * navegador, así que la guarda evita repetir el primer pantallazo de bienvenida y
 * nada más: no protege datos ni separa parejas.
 * `TODO-FASE2 (SEGURIDAD)`: sustituir por la sesión de Supabase Auth, que el
 * servidor pueda verificar. Ver `src/services/sesion.js` y `docs/SEGURIDAD.md`.
 *
 * POR QUÉ UN COMPONENTE Y NO UN `if` EN `App`
 * `haySesion()` es síncrona, así que un `if` antes de devolver el JSX sería más
 * corto. Se hace componente porque las dos guardas necesitan el mismo dato en el
 * mismo momento y así esa comprobación vive en un sitio, y porque `Layout` es
 * quien decide qué queda protegido: una pantalla nueva entra dentro por
 * defecto, que es justo lo contrario de lo que se puede olvidar.
 *
 * @param {{children: React.ReactNode}} children Rutas a proteger.
 * @returns {import('react').ReactElement} Las rutas, o la redirección.
 */
function ConSesion({ children }) {
  if (!haySesion()) return <Navigate to={RUTAS.BIENVENIDA} replace />;

  return children;
}

/**
 * La guarda contraria: la bienvenida solo tiene sentido sin sesión.
 *
 * Con sesión ya creada, `/bienvenida` devuelve un "Comenzar" que volvería a
 * sobrescribir la sesión con un identificador nuevo. Redirigir a Inicio evita
 * que quien ya está dentro de su calendario pueda volver atrás y vea la puerta
 * de entrada.
 *
 * @param {{children: React.ReactNode}} children Ruta pública.
 * @returns {import('react').ReactElement} La ruta, o la redirección a Inicio.
 */
function SinSesion({ children }) {
  if (haySesion()) return <Navigate to={RUTAS.INICIO} replace />;

  return children;
}

/**
 * Componente raíz de la aplicación.
 *
 * @returns {import('react').ReactElement} Árbol de rutas.
 */
export default function App() {
  return (
    <Routes>
      {/*
        Ruta pública de bienvenida (sin layout), y solo sin sesión. Con sesión ya
        creada, "Comenzar" sobrescribiría el identificador de sesión con uno
        nuevo, así que `SinSesion` manda a Inicio.
      */}
      <Route path={RUTAS.BIENVENIDA} element={<SinSesion><Bienvenida /></SinSesion>} />

      {/*
        Rutas principales dentro del armazón de la aplicación. Todas comparten
        el layout responsive (sidebar / header + bottom nav) y todas exigen
        sesión: la guarda envuelve al `Layout` entero en vez de a cada ruta, para
        que una pantalla nueva quede protegida sin acordarse.
      */}
      <Route element={<ConSesion><Layout /></ConSesion>}>
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
