/**
 * Página `Planeador`.
 *
 * RESPONSABILIDAD: listado de ideas de cita con filtros por categoría,
 * marcado de favoritas y conversión de una idea en evento. Se construye en el
 * paso e, cuando existan los services de citas.
 *
 * Related: src/hooks/useCitas.js, src/components/citas/ (pendientes)
 *
 * @module pages/Planeador
 */

import PagePlaceholder from '../components/ui/PagePlaceholder';

/**
 * Renderiza el planeador de citas.
 *
 * @returns {import('react').ReactElement} Página del planeador.
 */
export default function Planeador() {
  return (
    <PagePlaceholder
      titulo="Planeador de citas"
      descripcion="Ideas para compartir, con filtros y favoritas."
      paso="Paso e"
    />
  );
}
