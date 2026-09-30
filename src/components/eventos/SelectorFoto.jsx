/**
 * Componente `SelectorFoto`.
 *
 * RESPONSABILIDAD: dejar elegir, previsualizar y quitar una foto de evento.
 * Valida el archivo antes de procesarlo y expone la foto ya comprimida, lista
 * para guardar.
 *
 * Related: utils/imagen.js, components/eventos/EventoFormModal.jsx
 *
 * @module components/eventos/SelectorFoto
 */

import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import {
  ANCHO_MAXIMO,
  TAMANO_MAXIMO_BYTES,
  comprimirImagen,
  estimarBytesGuardados,
  validarArchivoFoto,
  validarBytesDeArchivo,
} from '../../utils/imagen';

/**
 * @typedef {object} SelectorFotoProps
 * @property {string|null} valor Data URL de la foto actual, o `null`.
 * @property {(dataUrl: string|null) => void} onChange Se llama con la foto
 *   comprimida al elegirla, y con `null` al quitarla.
 * @property {string} [etiqueta] Texto visible de la zona de arrastrar.
 * @property {string} [idCampo] Id del campo de error, para enlazarlo con
 *   `aria-describedby` desde el formulario.
 */

/**
 * Límite en texto, para mostrarlo en la interfaz sin repetir el número.
 *
 * @returns {string} Texto del límite.
 */
function textoLimite() {
  return `${TAMANO_MAXIMO_BYTES / (1024 * 1024)} MB`;
}

/**
 * Zona de carga de una foto de evento.
 *
 * ACCESIBILIDAD: no es un `<div>` con manejadores, sino un `<label>` sobre un
 * `<input type="file">` real. Por eso funciona con teclado, se anuncia como
 * control de formulario y se abre con un solo clic en toda su superficie, sin
 * necesidad de un `role="button"` y un `tabIndex` que además habría que
 * mantener sincronizados con el input real.
 *
 * El input está `sr-only`, no `hidden`: con `hidden` queda fuera del orden de
 * tabulación y no se puede alcanzar con el teclado, que es justo el problema que
 * se quería evitar.
 *
 * @param {SelectorFotoProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Zona de carga o previsualización.
 * @example
 * <SelectorFoto valor={foto} onChange={setFoto} />
 */
export default function SelectorFoto({ valor, onChange, etiqueta = 'Foto', idCampo }) {
  const inputRef = useRef(null);
  const idInterno = useId();
  const idInput = `${idInterno}-input`;
  const idAyuda = `${idInterno}-ayuda`;

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [aviso, setAviso] = useState(null);

  /**
   * Procesa el archivo elegido: valida, comprime y avisa.
   *
   * @param {File|undefined} archivo Archivo elegido.
   * @returns {Promise<void>} Termina cuando se avisa a la persona.
   */
  async function manejarArchivo(archivo) {
    if (!archivo) return;

    setError(null);
    setAviso(null);

    // Primero el tamaño y la extensión, sin leer el archivo entero.
    const previo = validarArchivoFoto(archivo);
    if (!previo.valido) {
      setError(previo.error);
      return;
    }

    setProcesando(true);
    try {
      /*
       * Ahora sí, los bytes. Solo se lee el inicio del archivo con
       * `arrayBuffer()` sobre un blob ya acotado por la validación de tamaño.
       */
      const porBytes = await validarBytesDeArchivo(archivo);
      if (!porBytes.valido) {
        setError(porBytes.error);
        return;
      }

      const resultado = await comprimirImagen(archivo);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      onChange(resultado.dataUrl);
      setAviso(
        `Foto lista: ${resultado.ancho}×${resultado.alto} px, ` +
          `${Math.round(estimarBytesGuardados(resultado.dataUrl) / 1024)} KB. ` +
          'Se guardó sin los datos de ubicación de la cámara.',
      );
    } catch (err) {
      setError(err?.message ?? 'No pudimos procesar la foto.');
    } finally {
      setProcesando(false);
      // Permite volver a elegir el mismo archivo después de un error: si el
      // valor del input no cambia, el `change` no se dispara.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  /**
   * Quita la foto actual.
   *
   * @returns {void}
   */
  function quitar() {
    onChange(null);
    setError(null);
    setAviso(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  // Con foto: previsualización, dimensiones y botón de quitar.
  if (valor) {
    return (
      <div className="space-y-2">
        <img
          src={valor}
          alt="Vista previa de la foto del evento"
          className="aspect-[4/3] w-full rounded-card object-cover"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Guardada como {Math.round(estimarBytesGuardados(valor) / 1024)} KB
          </p>
          <button
            type="button"
            onClick={quitar}
            className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="size-4" aria-hidden="true" />
            Quitar foto
          </button>
        </div>
        {aviso && (
          <p className="text-xs text-emerald-700" role="status">
            {aviso}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={idInput}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2',
          'rounded-card border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-8',
          'text-center transition-colors hover:border-accent/60 hover:bg-accent/5',
          'focus-within:border-accent focus-within:bg-accent/5',
          procesando ? 'pointer-events-none opacity-60' : '',
          error ? 'border-red-400 bg-red-50/50' : '',
        ].join(' ')}
      >
        {procesando ? (
          <>
            <Loader2 className="size-7 animate-spin text-accent" aria-hidden="true" />
            <span className="text-sm font-medium text-slate-700">Procesando la foto…</span>
          </>
        ) : (
          <>
            <ImagePlus className="size-7 text-slate-400" aria-hidden="true" />
            <span className="text-sm font-medium text-slate-700">
              {etiqueta}: elige una imagen o arrástrala aquí
            </span>
            <span className="text-xs text-slate-500">
              JPEG, PNG o WebP hasta {textoLimite()}. Se reduce a {ANCHO_MAXIMO} px.
            </span>
          </>
        )}

        <input
          ref={inputRef}
          id={idInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-describedby={idAyuda}
          disabled={procesando}
          onChange={(e) => manejarArchivo(e.target.files?.[0])}
        />
      </label>

      <p id={idAyuda} className="text-xs text-slate-500">
        Al guardarla se borran los metadatos de la foto, incluida la ubicación.
      </p>

      {error && (
        <p id={idCampo} role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
