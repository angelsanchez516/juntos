/**
 * Componente `Logo`.
 *
 * RESPONSABILIDAD: la marca de la aplicación. Muestra el nombre "Juntos" en
 * la fuente cursiva del mockup, un corazón de acento y el tagline. Se usa
 * tanto en el sidebar de escritorio como en el header de móvil, variando
 * tamaño y si muestra el tagline.
 *
 * @see src/constants/nav.js (texto de marca)
 * @see tailwind.config.js (token `accent`, fuente `script`)
 *
 * @module components/ui/Logo
 */

import { Heart } from 'lucide-react';
import { MARCA } from '../../constants/nav';

/**
 * @typedef {object} LogoProps
 * @property {'sm'|'md'|'lg'} [tamano] Escala visual del logotipo. Por defecto
 *   `'md'`.
 * @property {boolean} [mostrarTagline] Muestra la frase "Tus momentos,
 *   siempre" bajo el nombre. En móvil ocupa espacio de más, por lo que se
 *   desactiva ahí. Por defecto `false`.
 * @property {string} [className] Clases extra para el contenedor raíz.
 */

/**
 * Sizes del logotipo. Se declaran como clases completas y literales porque
 * Tailwind no puede detectar clases construidas por concatenación.
 */
const TAMAÑOS = {
  sm: { nombre: 'text-2xl', corazon: 'size-4', tagline: 'text-[10px]' },
  md: { nombre: 'text-3xl', corazon: 'size-5', tagline: 'text-xs' },
  lg: { nombre: 'text-5xl', corazon: 'size-7', tagline: 'text-sm' },
};

/**
 * Renderiza la marca de la aplicación.
 *
 * @param {LogoProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Elemento de marca.
 * @example
 * <Logo tamano="lg" mostrarTagline />
 */
export default function Logo({
  tamano = 'md',
  mostrarTagline = false,
  className = '',
}) {
  const escala = TAMAÑOS[tamano] ?? TAMAÑOS.md;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="flex items-center gap-1.5">
        <span
          className={`font-script font-bold leading-none text-white ${escala.nombre}`}
        >
          {MARCA.nombre}
        </span>
        {/*
          El corazón se sitúa con `-ml-1` y ligeramente subido para que se
          superponga a la "s" final, como en el mockup.
        */}
        <Heart
          className={`-ml-1 -mt-2 shrink-0 fill-accent text-accent ${escala.corazon}`}
          aria-hidden="true"
        />
      </div>

      {mostrarTagline && (
        <p
          className={`mt-0.5 tracking-wide text-slate-400 ${escala.tagline}`}
        >
          {MARCA.tagline}
        </p>
      )}
    </div>
  );
}
