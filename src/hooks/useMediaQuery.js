/**
 * Hook `useMediaQuery`.
 *
 * RESPONSABILIDAD: consultar si una media query del CSS se cumple y
 * re-renderizar cuando cambia. Se usa para decidir entre el layout de
 * escritorio (sidebar fija) y el de móvil (header + barra inferior) en
 * lugar de ocultar con `hidden`, para no renderizar dos veces el árbol.
 *
 * Related: src/components/layout/Layout.jsx
 *
 * @module hooks/useMediaQuery
 */

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Suscribe el componente al resultado de una media query.
 *
 * IMPLEMENTACIÓN: `useSyncExternalStore` es la API de React para leer el
 * estado de una fuente externa, y aquí encaja exactamente: `matchMedia` es un
 * store del navegador, con `subscribe` para los cambios y `getSnapshot` para
 * el valor actual.
 *
 * Evita el patrón habitual de "useState inicial + useEffect que corrige el
 * valor", que hace un render de más y provoca un parpadeo del layout al
 * cambiar el tamaño de la pantalla.
 *
 * @param {string} query Media query CSS, por ejemplo `'(min-width: 1024px)'`.
 * @returns {boolean} `true` si la consulta se cumple en este momento.
 * @example
 * const esEscritorio = useMediaQuery('(min-width: 1024px)');
 * return esEscritorio ? <Sidebar /> : <MobileHeader />;
 */
export function useMediaQuery(query) {
  /*
   * `getSnapshot` debe devolver el mismo valor si nada ha cambiado: si
   * devolviera un objeto nuevo en cada llamada, React entraría en bucle de
   * render. `matchMedia(query).matches` es un booleano primitivo, así que
   * cumple esa condición.
   */
  const suscribir = useCallback(
    (alCambiar) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {};

      const mql = window.matchMedia(query);

      /*
       * addEventListener es la API moderna; Safari anterior a 14 solo tenía
       * addListener, por eso mantenemos ese respaldo.
       */
      if (mql.addEventListener) {
        mql.addEventListener('change', alCambiar);
        return () => mql.removeEventListener('change', alCambiar);
      }

      mql.addListener(alCambiar);
      return () => mql.removeListener(alCambiar);
    },
    [query],
  );

  const leer = useCallback(() => {
    // `window` no existe al renderizar en servidor ni en tests de node.
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // El tercer argumento es el snapshot para renderizado en servidor, donde no
  // hay `window`; devolvemos false y el cliente corrige en su primer render.
  return useSyncExternalStore(suscribir, leer, () => false);
}

/**
 * Punto de corte que separa el layout de escritorio del de móvil.
 * Coincide con el `lg` por defecto de Tailwind.
 *
 * @type {string}
 */
export const BREAKPOINT_ESCRITORIO = '(min-width: 1024px)';

/**
 * Atajo de {@link useMediaQuery} ya fijado al breakpoint de escritorio.
 *
 * @returns {boolean} `true` si el viewport mide 1024px o más.
 */
export function useEsEscritorio() {
  return useMediaQuery(BREAKPOINT_ESCRITORIO);
}
