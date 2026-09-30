/**
 * Configuración de Tailwind CSS v3 para "Juntos".
 *
 * RESPONSABILIDAD: definir los tokens de diseño extraídos del mockup
 * (docs/mockup.png) y las extensiones de utilidad que usa toda la app.
 *
 * DECISIÓN TÉCNICA (Fase 1): se fija Tailwind v3.4 de forma explícita en
 * package.json. Vite instala v4 por defecto, pero v4 eliminó este archivo de
 * configuración y mueve los tokens a `@theme` dentro del CSS. Mantenemos v3
 * porque el resto de la app está construida sobre este archivo.
 * Cuando se decida migrar: los tokens de `theme.extend.colors` se copian tal
 * cual a un bloque `@theme` en src/index.css y se borra este archivo.
 * Ver docs/CHANGELOG.md.
 *
 * IMPORTANTE — COLORES DE CATEGORÍA: los colores de categoría (cita,
 * aniversario, viaje, cumpleaños, otro) NO están aquí a propósito. Viven en
 * src/utils/categorias.js como valores hex y se aplican con
 * `style={{ backgroundColor }}`. Motivo: Tailwind escanea el código fuente en
 * tiempo de compilación y no puede generar clases construidas dinámicamente
 * como `` `bg-${color}` ``, por lo que se eliminarían del CSS final.
 * Ver docs/ARQUITECTURA.md § "Tokens y colores de categoría".
 *
 * @module tailwind.config
 */

/** @type {import('tailwindcss').Config} */
export default {
  // Rutas donde Tailwind busca clases. `content` debe incluir los .jsx de src
  // porque todos los componentes viven ahí.
  content: ['./index.html', './src/**/*.{js,jsx}'],

  // Desactivamos el preflight para poder basingar el reset con el de Vite,
  // evitando que Tailwind reinicie los estilos del documento dos veces.
  corePlugins: {
    preflight: true,
  },

  theme: {
    extend: {
      /**
       * Tokens de color extraídos píxel a píxel del mockup.
       * Única fuente de verdad para el tema; los colores de categoría viven
       * aparte (ver cabecera del archivo).
       */
      colors: {
        // Fondo general de la aplicación, el "negro azulado" del mockup.
        base: '#070B10',
        // Fondo de la barra lateral y del header móvil.
        sidebar: '#0D121A',
        // Fondo del ítem de navegación activo (vino oscuro).
        navactive: '#6C2B43',
        // Superficies claras: tarjetas, calendario, modales.
        surface: '#F7FAFC',
        // Acento principal: botones como "Guardar evento".
        accent: {
          DEFAULT: '#D1536C', // color base del mockup
          strong: '#C62E53', // hover y estados activos
          soft: '#F9E7EB', // fondos tenues derivados del acento
        },
        // Fondo del chip de categoría "Cita" (lavanda muy claro).
        'chip-cita': '#F1F0FC',
      },

      /** Familias tipográficas. Ambas llegan desde Google Fonts (index.html). */
      fontFamily: {
        // Fuente cursiva del logo "Juntos".
        script: ['"Dancing Script"', 'cursive'],
        // Texto de interfaz. Se usa la pila de sistema como respaldo.
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },

      /** Sombras suaves: el mockup usa elevaciones bajas y difusas. */
      boxShadow: {
        card: '0 2px 8px rgba(7, 11, 16, 0.08)',
        // Elevación mayor, para modales y menús flotantes.
        pop: '0 8px 24px rgba(7, 11, 16, 0.16)',
      },

      /** Radios redondeados coherentes en toda la app. */
      borderRadius: {
        card: '1rem',
        pill: '9999px',
      },
    },
  },

  plugins: [],
};
