/**
 * Página `Bienvenida`.
 *
 * RESPONSABILIDAD: pantalla de onboarding fuera del layout principal. Muestra
 * el logotipo y permite "Comenzar" la aplicación. Esta página NO debe mostrar
 * el sidebar ni la barra inferior de móvil, por eso no está anidada bajo
 * `<Layout />` en las rutas.
 *
 * SEGURIDAD: es un login simulado (botón "Comenzar"). NO es autenticación
 * real. Esto se deja documentado explícitamente para evitar confusiones.
 * TODO-FASE2 (SEGURIDAD): sustituir por flujo de autenticación real (correo,
 * OTP o proveedor) con sesión verificada en servidor.
 *
 * @see App.jsx (ruta sin Layout)
 *
 * @module pages/Bienvenida
 */

import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import Logo from '../components/ui/Logo';
import Boton from '../components/ui/Boton';
import { RUTAS } from '../constants/nav';

/**
 * Renderiza la pantalla de bienvenida.
 *
 * @returns {import('react').ReactElement} Página de bienvenida.
 */
export default function Bienvenida() {
  const navegar = useNavigate();

  const comenzar = () => {
    // En esta fase solo navegamos. No guardamos token, sesión ni estado de
    // autenticación: es un acceso simulado.
    navegar(RUTAS.INICIO, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-4">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center">
          <Logo tamano="lg" mostrarTagline />
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Heart
              className="size-4 fill-accent text-accent"
              aria-hidden="true"
            />
            <span>Creado para dos corazones</span>
          </div>
        </div>

        <div className="w-full max-w-xs space-y-4">
          <Boton
            variante="primario"
            tamano="lg"
            className="w-full"
            onClick={comenzar}
          >
            Comenzar
          </Boton>
          {/*
            Enlace de "Iniciar sesión" simulado: no ejecuta ninguna llamada
            HTTP en Fase 1. Se deja presente para que la UI coincida con el
            mockup. SEGURIDAD: login NO implementado todavía.
          */}
          <button
            type="button"
            className="w-full text-sm text-slate-400 transition-colors hover:text-slate-100"
          >
            Iniciar sesión
          </button>
        </div>
      </div>

      {/*
        Nota de seguridad visible únicamente en desarrollo a modo de recordatorio.
        No aparece en la UI final, es solo comentario.
        SEGURIDAD: este acceso es simulado y NO constituye autenticación real.
        TODO-FASE2 (SEGURIDAD): implementar flujo de autenticación con servidor.
      */}
    </div>
  );
}
