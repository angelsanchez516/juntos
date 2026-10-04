/**
 * Página `Bienvenida`.
 *
 * RESPONSABILIDAD: pantalla de onboarding fuera del layout principal. Muestra
 * el logotipo y crea la sesión con "Comenzar". Esta página NO debe mostrar el
 * sidebar ni la barra inferior de móvil, por eso no está anidada bajo
 * `<Layout />` en las rutas.
 *
 * SEGURIDAD: lo que se guarda aquí NO es autenticación. `crearSesion()` escribe
 * un objeto en `localStorage` que solo dice "esta persona ya pasó por esta
 * pantalla": sin correo, sin contraseña y sin nada que un servidor pueda
 * verificar. Quien quiera puede escribir esa clave a mano y entrar. La pantalla
 * existe para no repetir el primer pantallazo, no para proteger nada.
 * TODO-FASE2 (SEGURIDAD): sustituir por un flujo real (correo, OTP o proveedor)
 * con la sesión verificada en el servidor. Ver `src/services/sesion.js` y
 * `docs/SEGURIDAD.md`.
 *
 * @see App.jsx (ruta sin Layout, protegida con `SinSesion`)
 *
 * @module pages/Bienvenida
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import Logo from '../components/ui/Logo';
import Boton from '../components/ui/Boton';
import { RUTAS } from '../constants/nav';
import { crearSesion } from '../services/sesion';

/**
 * Renderiza la pantalla de bienvenida.
 *
 * @returns {import('react').ReactElement} Página de bienvenida.
 */
export default function Bienvenida() {
  const navegar = useNavigate();
  const [error, setError] = useState('');

  /**
   * Crea la sesión y entra.
   *
   * Si la sesión no se puede guardar no se navega: entrar sin ella dejaría a la
   * persona en Inicio y la guarda de `App` la devolvería aquí al instante, con un
   * salto visible que parece un fallo de la app. Es mejor quedarse en la
   * bienvenida explicando qué ha pasado.
   *
   * @returns {void}
   */
  const comenzar = () => {
    setError('');

    const sesion = crearSesion();
    if (!sesion) {
      setError(
        'No se ha podido guardar la sesión en este navegador. Puede que esté en modo privado o sin espacio; prueba a recargar la página.',
      );
      return;
    }

    navegar(RUTAS.INICIO, { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-4">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center">
          <Logo tamano="lg" mostrarTagline />
          <p className="mt-6 max-w-xs text-sm text-slate-400">
            Crea recuerdos, planea nuevas aventuras y sigue escribiendo tu historia juntos.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
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
            "Iniciar sesión" está deshabilitado, no oculto: el mockup lo enseña y
            así se ve que va a existir.

            `aria-disabled` en vez del atributo `disabled` a propósito. Un botón
            `disabled` no recibe el foco, así que con teclado no se llegaría a él
            ni se oiría el motivo; además muchos lectores de pantalla ni anuncian
            su `title`. Con `aria-disabled` sigue siendo enfocable y se declara
            inactivo, el `title` da el "Próximamente" al puntero y el texto oculto
            lo da al lector de pantalla. Sin `onClick` no hace nada, que es justo
            lo que debe hacer un botón deshabilitado.

            TODO-FASE2 (SEGURIDAD): con autenticación real, este botón deja de
            estar deshabilitado y entra en su propio formulario.
          */}
          <button
            type="button"
            aria-disabled="true"
            aria-describedby="iniciar-sesion-proximamente"
            title="Próximamente"
            className="w-full cursor-not-allowed text-sm text-slate-400"
          >
            Iniciar sesión
          </button>
          <span id="iniciar-sesion-proximamente" className="sr-only">
            Próximamente
          </span>

          {/*
            El resultado se anuncia con `role="alert"` porque es la respuesta a
            un clic: quien acaba de pulsar "Comenzar" está mirando el botón, y un
            diálogo le robaría el foco para repetirle lo que ya va a leer aquí.
          */}
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
