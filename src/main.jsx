/**
 * Punto de entrada de la aplicación "Juntos".
 *
 * RESPONSABILIDAD: montar React en el nodo #root y registrar el enrutador
 * global. La composición de rutas vive en src/App.jsx.
 *
 * Related: src/App.jsx
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

// Verificamos que el nodo raíz exista antes de montar. Si alguien abre el HTML
// sin el #root, fallamos con un mensaje claro en lugar del error opaco de
// React sobre un contenedor nulo.
const contenedor = document.getElementById('root');
if (!contenedor) {
  throw new Error('No se encontró el elemento #root en index.html');
}

createRoot(contenedor).render(
  <StrictMode>
    {/* SEGURIDAD: `BrowserRouter` no protege nada por sí mismo. La guarda de
        rutas de `App.jsx` solo comprueba si existe la clave de sesión en
        `localStorage`, y eso cualquiera puede escribirlo: evita repetir la
        bienvenida, no autoriza.
        TODO-FASE2 (SEGURIDAD): sustituir la guarda por sesión de Supabase Auth
        verificada en servidor, con autorización en las políticas RLS. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
