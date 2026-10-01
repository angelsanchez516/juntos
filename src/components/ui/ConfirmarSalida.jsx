/**
 * Componente `ConfirmarSalida`.
 *
 * RESPONSABILIDAD: el aviso "¿salir sin guardar?" que aparece dentro de un
 * formulario cuando se intenta cerrar con cambios sin confirmar.
 *
 * Se muestra DENTRO del diálogo que lo origina, no como un modal encima. Es
 * intencionado: el aviso pertenece a la decisión sobre ese formulario, así que
 * un lector de pantalla debe recorrer los dos como una sola cosa, y el velo del
 * modal no debe duplicarse.
 *
 * Related: components/ui/Modal.jsx, components/eventos/EventoFormModal.jsx,
 * components/citas/IdeaFormModal.jsx
 *
 * @module components/ui/ConfirmarSalida
 */

import { useEffect, useId, useRef } from 'react';

/**
 * @typedef {object} ConfirmarSalidaProps
 * @property {() => void} onCancelar Vuelve al formulario sin cerrar nada.
 * @property {() => void} onConfirmar Cierra y pierde lo escrito.
 * @property {string} [detalle] Qué se perderá. Por defecto, texto genérico.
 */

/**
 * Renderiza la confirmación de salida con cambios sin guardar.
 *
 * @param {ConfirmarSalidaProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Aviso con las dos respuestas.
 * @example
 * <ConfirmarSalida onCancelar={seguir} onConfirmar={salir} />
 */
export default function ConfirmarSalida({ onCancelar, onConfirmar, detalle }) {
  const baseId = useId();
  const idTitulo = `${baseId}-titulo`;
  const idDescripcion = `${baseId}-descripcion`;
  const cancelarRef = useRef(null);

  /*
   * El foco arranca en "Seguir editando", no en la opción destructiva. Quien
   * abre el aviso por accidente y pulsa Enter sin leer —con el móvil en la
   * mano, sin querer— no debe perder lo que había escrito. Confirmar exige
   * desplazarse a un botón que dice lo que hace.
   */
  useEffect(() => {
    cancelarRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-labelledby={idTitulo}
      aria-describedby={idDescripcion}
      className="space-y-4"
    >
      <div>
        <h2 id={idTitulo} className="text-base font-semibold text-slate-900">
          ¿Salir sin guardar?
        </h2>
        <p id={idDescripcion} className="mt-1 text-sm text-slate-600">
          {detalle ?? 'Has escrito algo que no se ha guardado. Si sales ahora, se pierde.'}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          ref={cancelarRef}
          onClick={onCancelar}
          className="rounded-pill border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Seguir editando
        </button>
        <button
          type="button"
          onClick={onConfirmar}
          className="rounded-pill bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800"
        >
          Salir y perderlo
        </button>
      </div>
    </div>
  );
}
