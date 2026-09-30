/**
 * Componente `PagePlaceholder`.
 *
 * RESPONSABILIDAD: estado transitorio de las páginas cuya funcionalidad aún
 * no está construida. En el paso a todas las rutas usan esto, para poder
 * probar la navegación y el layout antes de tener los datos.
 * Los pasos siguientes sustituyen este componente por la página real.
 *
 * Related: src/pages/*
 *
 * @module components/ui/PagePlaceholder
 */

/**
 * @typedef {object} PagePlaceholderProps
 * @property {string} titulo Nombre de la sección.
 * @property {string} descripcion Qué hará esta pantalla, en una línea.
 * @property {string} [paso] Etiqueta del paso del plan que la implementará,
 *   por ejemplo `"Paso c"`.
 */

/**
 * Renderiza el marcador de una página todavía no implementada.
 *
 * @param {PagePlaceholderProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Panel informativo.
 * @example
 * <PagePlaceholder titulo="Calendario" descripcion="Vista mensual" paso="Paso c" />
 */
export default function PagePlaceholder({ titulo, descripcion, paso }) {
  return (
    <section className="animate-aparecer">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-white sm:text-3xl">
          {titulo}
        </h1>
        <p className="mt-1 text-slate-400">{descripcion}</p>
      </header>

      <div className="rounded-card border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
        <p className="text-sm text-slate-400">
          Esta pantalla se construye en el{' '}
          {paso ? <strong className="text-accent">{paso}</strong> : 'siguiente paso'}.
        </p>
      </div>
    </section>
  );
}
