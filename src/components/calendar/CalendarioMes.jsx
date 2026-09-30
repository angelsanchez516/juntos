/**
 * Componente `CalendarioMes`.
 *
 * RESPONSABILIDAD: pintar la cuadrícula de un mes (encabezado de días, celdas
 * y navegación) y avisar de qué día se ha seleccionado. No sabe de dónde
 * vienen los eventos: recibe la cuadrícula ya construida con
 * `construirCuadricula` + `asignarEventos`, de modo que todo el cálculo queda
 * en `src/utils/calendario.js`, fuera de React y testeable.
 *
 * Related: components/calendar/CeldaDia.jsx, utils/calendario.js
 *
 * @module components/calendar/CalendarioMes
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Boton from '../ui/Boton';
import CeldaDia from './CeldaDia';
import { DIAS_ENCABEZADO_CORTOS } from '../../utils/calendario';

/**
 * @typedef {object} CalendarioMesProps
 * @property {import('../../utils/calendario.js').Cuadricula} cuadricula
 *   Cuadrícula del mes, con los eventos ya asignados y el día seleccionado
 *   marcado en cada celda por `asignarEventos`. No hace falta pasar la fecha
 *   seleccionada aparte: el estado de selección vive en la cuadrícula.
 * @property {boolean} [compacto] Variante de móvil: celdas bajas con puntos de
 *   color en lugar de franjas con texto. Por defecto `false`.
 * @property {() => void} onSelectDia Gestor al elegir un día.
 * @property {() => void} [onVerRestoDelDia] Gestor del "+N más". Si se omite,
 *   el enlace no aparece.
 * @property {(delta: number) => void} onMoverMes Gestor de las flechas.
 * @property {() => void} onHoy Gestor del botón "Hoy".
 * @property {boolean} [mesActual] `true` si el mes visible es el mes en curso,
 *   para desactivar "Hoy". Por defecto `false`.
 */

/**
 * Renderiza la cuadrícula de un mes con su navegación.
 *
 * @param {CalendarioMesProps} props Propiedades del componente.
 * @returns {import('react').ReactElement} Cuadrícula del mes.
 * @example
 * <CalendarioMes
 *   cuadricula={cuadricula}
 *   onSelectDia={elegirDia}
 *   onMoverMes={mover}
 *   onHoy={irAHoy}
 * />
 */
export default function CalendarioMes({
  cuadricula,
  compacto = false,
  onSelectDia,
  onVerRestoDelDia,
  onMoverMes,
  onHoy,
  mesActual = false,
}) {
  return (
    <section
      className="rounded-card bg-surface p-4 shadow-card sm:p-5"
      /*
       * `aria-label` en la región: un lector de pantalla anuncia "Calendario,
       * mes" antes de entrar en los 42 botones, en lugar de soltarlos uno a
       * uno sin contexto.
       */
      aria-label={`Calendario, ${cuadricula.titulo}`}
    >
      {/* --- Encabezado: título, flechas y "Hoy" --- */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Boton
            variante="secundario"
            soloIcono
            tamano="sm"
            ariaLabel="Mes anterior"
            onClick={() => onMoverMes(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </Boton>

          <Boton
            variante="secundario"
            soloIcono
            tamano="sm"
            ariaLabel="Mes siguiente"
            onClick={() => onMoverMes(1)}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </Boton>
        </div>

        {/*
          `h2` con el mes: es el encabezado de la vista, que es lo que anuncia
          el salto entre secciones al navegar con el lector de pantalla.
        */}
        <h2 className="font-display text-lg capitalize text-slate-900 sm:text-xl">
          {cuadricula.titulo}
        </h2>

        <Boton
          variante={mesActual ? 'fantasma' : 'secundario'}
          tamano="sm"
          onClick={onHoy}
          disabled={mesActual}
        >
          Hoy
        </Boton>
      </div>

      {/*
        Encabezado de los días de la semana. `aria-hidden` porque cada celda
        ya anuncia su fecha completa: si además se leyeran los nombres, un
        lector de pantalla oiría "lunes" y después "lunes 28 de septiembre..."
        por cada uno de los 42 días.
      */}
      <div className="mb-1 grid grid-cols-7 gap-1" aria-hidden="true">
        {DIAS_ENCABEZADO_CORTOS.map((dia) => (
          <div
            key={dia}
            className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {compacto ? dia.charAt(0) : dia}
          </div>
        ))}
      </div>

      {/*
        `role="grid"` con filas y celdas explícitas: es la semántica correcta
        para una cuadrícula y permite navegar con flechas en varios lectores de
        pantalla. Cada celda aporta además su `aria-label`.
      */}
      <div role="grid" className="flex flex-col gap-1">
        {cuadricula.semanas.map((semana) => (
          <div
            key={semana.rango}
            role="row"
            className="grid grid-cols-7 gap-1"
            aria-label={semana.rango}
          >
            {semana.dias.map((celda) => (
              <CeldaDia
                key={celda.fechaISO}
                celda={celda}
                compacto={compacto}
                onSelect={() => onSelectDia(celda.fechaISO)}
                onVerResto={
                  onVerRestoDelDia ? () => onVerRestoDelDia(celda.fechaISO) : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
