/**
 * Página `Galeria`.
 *
 * RESPONSABILIDAD: grid de fotos de los eventos. Al hacer clic en una foto
 * se navega al detalle del evento que la contiene. Se construye en el paso f,
 * utilizando solo datos de los eventos (src/hooks/useEventos.js).
 *
 * Related: src/services/eventosService.js, EventoDetalle.jsx
 *
 * @module pages/Galeria
 */

import PagePlaceholder from '../components/ui/PagePlaceholder';

/**
 * Renderiza la galería de momentos.
 *
 * @returns {import('react').ReactElement} Página de galería.
 */
export default function Galeria() {
  return (
    <PagePlaceholder
      titulo="Galería"
      descripcion="Todas las fotos de nuestros eventos."
      paso="Paso f"
    />
  );
}
