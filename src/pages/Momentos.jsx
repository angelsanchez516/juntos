/**
 * Página `Momentos`.
 *
 * RESPONSABILIDAD: línea de tiempo de recuerdos de la pareja. Ruta propia,
 * separada de Inicio. En el paso a es un marcador de posición; su contenido se
 * definirá más adelante.
 *
 * Related: src/constants/nav.js (por qué no comparte ruta con Inicio)
 *
 * @module pages/Momentos
 */

import PagePlaceholder from '../components/ui/PagePlaceholder';

/**
 * Renderiza la pantalla de momentos.
 *
 * @returns {import('react').ReactElement} Página de momentos.
 */
export default function Momentos() {
  return (
    <PagePlaceholder
      titulo="Momentos"
      descripcion="Nuestra línea de tiempo de recuerdos."
      paso="Próximos pasos"
    />
  );
}
