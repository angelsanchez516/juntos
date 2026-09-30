/**
 * Página `Configuracion`.
 *
 * RESPONSABILIDAD: configuraciones de la app. En esta Fase 1 es un
 * placeholder. En Fase 2 incluirá preferencias del tema, exportar/limpiar
 * datos locales y avisos de privacidad.
 *
 * SEGURIDAD: es accesible desde la barra inferior (Perfil) y desde el perfil
 * del sidebar. No contiene información sensible en Fase 1.
 *
 * @module pages/Configuracion
 */

import PagePlaceholder from '../components/ui/PagePlaceholder';

/**
 * Renderiza la pantalla de configuración.
 *
 * @returns {import('react').ReactElement} Página de configuración.
 */
export default function Configuracion() {
  return (
    <PagePlaceholder
      titulo="Configuración"
      descripcion="Preferencias de la aplicación."
      paso="Paso g"
    />
  );
}
