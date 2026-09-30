/**
 * Constantes de navegación de "Juntos".
 *
 * RESPONSABILIDAD: definir las rutas de la aplicación y los ítems de menú de
 * escritorio y móvil. Centralizar el menú aquí evita duplicar la lista en el
 * Sidebar y en la BottomNav, y garantiza que las rutas de navegación y las de
 * React Router no se desincronicen.
 *
 * Related: src/App.jsx (define las mismas rutas), src/components/layout/
 *
 * @module constants/nav
 */

import {
  CalendarDays,
  Heart,
  Home,
  Images,
  Settings,
  Sparkles,
  User,
} from 'lucide-react';

/**
 * Rutas de la aplicación.
 *
 * `RAIZ` existe como ruta propia y separada de `/momentos`. En la primera
 * versión del plan ambas apuntaban a `/`, lo que hacía que con `NavLink` los
 * dos ítems quedaran activos a la vez; hoy son páginas separadas.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const RUTAS = Object.freeze({
  BIENVENIDA: '/bienvenida',
  INICIO: '/',
  CALENDARIO: '/calendario',
  EVENTO: '/evento/:id',
  PLANEADOR: '/planeador',
  MOMENTOS: '/momentos',
  GALERIA: '/galeria',
  CONFIGURACION: '/configuracion',
});

/**
 * Menú de la barra lateral en escritorio (lg y superior).
 *
 * @type {ReadonlyArray<{to: string, label: string, Icon: React.ComponentType}>}
 */
export const MENU_ESCRITORIO = Object.freeze([
  { to: RUTAS.INICIO, label: 'Inicio', Icon: Home },
  { to: RUTAS.CALENDARIO, label: 'Calendario', Icon: CalendarDays },
  { to: RUTAS.PLANEADOR, label: 'Planeador de citas', Icon: Sparkles },
  { to: RUTAS.MOMENTOS, label: 'Momentos', Icon: Heart },
  { to: RUTAS.GALERIA, label: 'Galería', Icon: Images },
  { to: RUTAS.CONFIGURACION, label: 'Configuración', Icon: Settings },
]);

/**
 * Barra inferior de navegación en móvil. Se muestran cinco destinos porque un
 * sexto no cabe sin reducir el área táctil por debajo de los 44px recomendados.
 * "Perfil" es la etiqueta de móvil para Configuración.
 *
 * @type {ReadonlyArray<{to: string, label: string, Icon: React.ComponentType}>}
 */
export const MENU_MOVIL = Object.freeze([
  { to: RUTAS.INICIO, label: 'Inicio', Icon: Home },
  { to: RUTAS.CALENDARIO, label: 'Calendario', Icon: CalendarDays },
  { to: RUTAS.PLANEADOR, label: 'Planeador', Icon: Sparkles },
  { to: RUTAS.MOMENTOS, label: 'Momentos', Icon: Heart },
  { to: RUTAS.CONFIGURACION, label: 'Perfil', Icon: User },
]);

/**
 * Perfil fijo de la pareja, mostrado al pie del sidebar.
 *
 * TODO-FASE2 (SEGURIDAD): estos datos vienen hoy de una constante local.
 * Cuando exista autenticación real deben leerse de la sesión del servidor y
 *Jamás de un valor que el cliente pueda manipular para suplantar a la pareja.
 *
 * @type {Readonly<{nombre: string, desde: string}>}
 */
export const PERFIL_PAREJA = Object.freeze({
  nombre: 'Tú y Yo',
  desde: '12 abr 2024',
});

/**
 * Texto de marca de la aplicación.
 *
 * @type {Readonly<{nombre: string, tagline: string}>}
 */
export const MARCA = Object.freeze({
  nombre: 'Juntos',
  tagline: 'Tus momentos, siempre',
});
