/**
 * Auditoría de cabeceras y documentación: que ningún fichero quede sin explicar y
 * ninguna exportación se documente por sorpresa al leerla.
 *
 * RESPONSABILIDAD: recorrer los ficheros del código y avisar de dos cosas: un
 * fichero sin cabecera, y una función, un hook, un componente o una constante
 * exportada sin JSDoc encima. Al final enseña un resumen "X de Y" por tipo.
 *
 * POR QUÉ EXISTE
 * Las otras dos auditorías miran el texto: una busca caracteres que no son
 * latinos, la otra palabras inglesas. Esta mira la forma. Los dos fallos que
 * busca son los que se cuelan sin que salte ninguna alarma:
 *
 * 1. Un fichero sin cabecera. La cabecera dice qué responsabilidad tiene el
 *    fichero, qué es de otro y por qué. Sin ella, quien lo abre tiene que
 *    averiguarlo leyendo las cuarenta líneas siguientes, y el que lo escribió
 *    tampoco se acuerda.
 * 2. Una exportación sin JSDoc. Exportar es una promesa de que el nombre es
 *    público; sin comentario, el que lo llama tiene que abrir el fichero para
 *    saber qué devuelve y qué acepta.
 *
 * En este proyecto ya estaban los dos casos cubiertos a mano, así que este
 * script sale limpio la primera vez. Eso es justamente el motivo de que exista:
 * la revisión manual funciona hasta el primer fichero nuevo, y ese fichero
 * entra sin cabecera porque a las dos de la mañana nadie recuerda que el
 * proyecto la exige. Un script no lo recuerda mal.
 *
 * QUÉ EXIGE
 * - Cada fichero empieza con un bloque de comentario de documentación y ese
 *   bloque lleva `@module`. Es la convención que ya seguían los 54 ficheros de
 *   `src/`, y los dos que se quedaban sin `@module` se corrigieron al escribir
 *   este script, en vez de relajar la regla para que pasasen.
 * - Cada exportación lleva un bloque JSDoc encima. Se admite una línea en blanco
 *   entre el bloque y la exportación, porque es una forma normal de separarlos.
 *   No se admite un comentario de línea `//`, que no es JSDoc aunque se lea
 *   igual de bien.
 *
 * POR QUÉ CLASIFICA POR TIPO
 * El resumen se pide por tipo porque cada tipo falla de forma distinta: un hook
 * sin JSDoc es el peor caso, porque su firma no dice cuándo se llama ni qué
 * devuelve. Saber que faltan 3 de 114 funciones importa; saber que faltan 1 de
 * 5 hooks, no.
 *
 * Related: scripts/auditar-codificacion.mjs, scripts/auditar-idioma.mjs,
 * README.md (Auditoría de cabeceras y documentación), docs/CHANGELOG.md
 *
 * @module scripts/auditar-docs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/** Carpetas que se revisan. */
const CARPETAS = ['src', 'scripts'];

/** Ficheros sueltos de la raíz que se revisan. */
const FICHEROS_SUELTOS = ['test-datos.mjs'];

/** Carpetas que nunca se miran. */
const EXCLUIDAS = new Set(['node_modules', 'dist', '.git', 'coverage']);

/** Ficheros que se apartan a propósito. */
const APARTADOS = new Set(['auditar-docs.mjs']);

/** Extensiones con código. */
const ES_CODIGO = new Set(['.js', '.jsx', '.mjs', '.css']);

/**
 * Tipos de exportación, en el orden en que se cuentan.
 *
 * `componente` y `hook` se separan del resto porque son los que más se usan y los
 * que peor se documentan: los dos se llaman igual que en inglés y por eso el
 * nombre no dice nada de lo que hacen.
 */
const TIPOS = ['archivo', 'componente', 'hook', 'funcion', 'constante'];

/**
 * Artículo de cada tipo, para que el aviso se lea en español y no como un
 * "`constante` exportado".
 */
const ARTICULO = { componente: 'el', hook: 'el', funcion: 'la', constante: 'la' };

/**
 * Expresiones regulares que localizan las declaraciones exportadas.
 *
 * Van ancladas al principio de línea porque una mención a `export` dentro de un
 * comentario o de una cadena no exporta nada. La última recoge las listas
 * `export { a, b }`, que no declaran nada pero sí obligan a documentar.
 */
const PATRONES_EXPORT = [
  /^export\s+default\s+function\s+([A-Za-z0-9_$]+)/gm,
  /^export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm,
  /^export\s+class\s+([A-Za-z0-9_$]+)/gm,
  /^export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/gm,
];

/**
 * Dice si un nombre es el de un hook.
 *
 * @param {string} nombre Nombre de la exportación.
 * @returns {boolean} Si empieza por "use" seguido de mayúscula.
 */
function esHook(nombre) {
  return /^use[A-Z]/.test(nombre);
}

/**
 * Dice si un nombre es el de un componente.
 *
 * React obliga a que el nombre empiece por mayúscula, así que la mayúscula es la
 * pista. Con `export const` hace falta mirar además el valor, porque
 * `export const VISTA_MES = 'mes'` también empieza por mayúscula y no es un
 * componente: se considera componente lo que además es una flecha, una función o
 * un envoltorio de React.
 *
 * @param {string} nombre Nombre de la exportación.
 * @param {string} valor Texto que sigue al signo igual.
 * @returns {boolean} Si parece un componente.
 */
function esComponente(nombre, valor) {
  if (esHook(nombre)) return false;
  if (!/^[A-Z]/.test(nombre)) return false;
  return /=>|\(|memo|forwardRef|createElement|jsx/.test(valor);
}

/**
 * Decide de qué tipo es una exportación.
 *
 * @param {string} nombre Nombre de la exportación.
 * @param {string} valor Texto que sigue al signo igual, o cadena vacía.
 * @returns {string} Uno de los valores de `TIPOS`.
 */
function tipoDe(nombre, valor) {
  if (esHook(nombre)) return 'hook';
  if (esComponente(nombre, valor)) return 'componente';
  if (/^[A-Z]/.test(nombre)) return 'constante';
  return 'funcion';
}

/**
 * Devuelve el texto que sigue al `=` de una declaración.
 *
 * @param {string} texto Fichero completo.
 * @param {number} desde Índice del final de la declaración.
 * @returns {string} Lo que queda de esa misma línea.
 */
function valorEn(texto, desde) {
  const resto = texto.slice(desde);
  const fin = resto.indexOf('\n');
  return fin === -1 ? resto : resto.slice(0, fin);
}

/**
 * Cuenta las líneas de un índice de texto.
 *
 * @param {string} texto Fichero completo.
 * @param {number} indice Índice de carácter.
 * @returns {number} Número de línea, empezando en 1.
 */
function lineaDe(texto, indice) {
  return texto.slice(0, indice).split('\n').length;
}

/**
 * Mira si hay un bloque JSDoc justo encima de una línea.
 *
 * Sube desde la declaración saltando líneas en blanco y exige que la línea
 * anterior cierre un bloque que empiece por `/**`. Si lo que hay es un `//` o un
 * `/*` de los que no son JSDoc, cuenta como que no hay documentación: la
 * diferencia importa, porque JSDoc es lo que leen las herramientas y lo que
 * alguien copia al usar la función.
 *
 * @param {string[]} lineas Líneas del fichero.
 * @param {number} indiceDe Linea de la declaración, empezando en 0.
 * @returns {boolean} Si hay JSDoc encima.
 */
function tieneJsdoc(lineas, indiceDe) {
  let i = indiceDe - 1;
  let blancos = 0;

  while (i >= 0 && blancos <= 1) {
    const linea = lineas[i].trim();
    if (linea === '') {
      blancos += 1;
      i -= 1;
      continue;
    }
    if (!linea.endsWith('*/')) return false;
    if (linea.includes('/**')) return true;

    let abre = i - 1;
    while (abre >= 0) {
      if (lineas[abre].includes('/**')) return true;
      if (lineas[abre].includes('*/')) return false;
      abre -= 1;
    }

    return false;
  }

  return false;
}

/**
 * Devuelve la cabecera de un fichero, si la tiene.
 *
 * @param {string[]} lineas Líneas del fichero.
 * @returns {string[]} El bloque de cabecera, o lista vacía.
 */
function cabeceraDe(lineas) {
  let inicio = 0;
  while (inicio < lineas.length && lineas[inicio].trim() === '') inicio += 1;
  if (inicio >= lineas.length || !lineas[inicio].trim().startsWith('/**')) return [];

  const bloque = [];
  for (let i = inicio; i < lineas.length; i += 1) {
    bloque.push(lineas[i]);
    if (lineas[i].includes('*/')) return bloque;
  }

  return [];
}

/**
 * Recorre un directorio y devuelve los ficheros con código.
 *
 * @param {string} ruta Ruta a recorrer.
 * @param {string} raiz Raíz del proyecto, para escribir rutas relativas.
 * @returns {string[]} Rutas relativas.
 */
function ficherosDe(ruta, raiz) {
  const encontrados = [];

  for (const entrada of readdirSync(ruta)) {
    if (EXCLUIDAS.has(entrada)) continue;

    const completa = join(ruta, entrada);
    const relativa = completa.slice(raiz.length + 1);

    if (statSync(completa).isDirectory()) {
      encontrados.push(...ficherosDe(completa, raiz));
    } else if (ES_CODIGO.has(extname(entrada)) && !APARTADOS.has(entrada)) {
      encontrados.push(relativa);
    }
  }

  return encontrados;
}

const raiz = process.cwd();
const rutas = [
  ...CARPETAS.flatMap((carpeta) => ficherosDe(join(raiz, carpeta), raiz)),
  ...FICHEROS_SUELTOS.filter((fichero) => statSync(join(raiz, fichero)).isFile()),
];

const cuenta = Object.fromEntries(TIPOS.map((tipo) => [tipo, { conDocumentacion: 0, total: 0 }]));
const problemas = [];

for (const ruta of rutas) {
  const texto = readFileSync(join(raiz, ruta), 'utf8').replace(/\r\n/g, '\n');
  const lineas = texto.split('\n');
  const fallos = [];

  cuenta.archivo.total += 1;
  const cabecera = cabeceraDe(lineas);

  if (cabecera.length === 0) {
    fallos.push('  sin bloque de cabecera al principio del fichero');
  } else if (!cabecera.some((linea) => linea.includes('@module'))) {
    fallos.push('  la cabecera no declara `@module`');
  } else {
    cuenta.archivo.conDocumentacion += 1;
  }

  for (const patron of PATRONES_EXPORT) {
    patron.lastIndex = 0;

    for (const coincidencia of texto.matchAll(patron)) {
      const nombre = coincidencia[1];
      const indice = coincidencia.index + coincidencia[0].length;
      const tipo = tipoDe(nombre, valorEn(texto, indice));
      const linea = lineaDe(texto, coincidencia.index);

      cuenta[tipo].total += 1;

      if (tieneJsdoc(lineas, linea - 1)) {
        cuenta[tipo].conDocumentacion += 1;
      } else {
        fallos.push(`  línea ${linea}: ${ARTICULO[tipo]} ${tipo} exportad${tipo === 'componente' || tipo === 'hook' ? 'o' : 'a'} \`${nombre}\` no tiene JSDoc encima`);
      }
    }
  }

  for (const coincidencia of texto.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    const linea = lineaDe(texto, coincidencia.index);

    for (const parte of coincidencia[1].split(',')) {
      const nombre = parte.trim().split(/\s+as\s+/).pop() ?? '';
      if (nombre === '' || !/^[A-Za-z0-9_$]+$/.test(nombre)) continue;

      const tipo = tipoDe(nombre, '');
      cuenta[tipo].total += 1;

      if (tieneJsdoc(lineas, linea - 1)) {
        cuenta[tipo].conDocumentacion += 1;
      } else {
        fallos.push(`  línea ${linea}: \`${nombre}\` se reexporta sin JSDoc`);
      }
    }
  }

  if (fallos.length > 0) problemas.push([ruta, fallos]);
}

console.log('');
console.log('Auditoría de cabeceras y documentación');
console.log('');
console.log(`Ficheros revisados: ${rutas.length}`);
console.log('');

for (const tipo of TIPOS) {
  const { conDocumentacion, total } = cuenta[tipo];
  console.log(`${tipo.padEnd(10)} ${String(conDocumentacion).padStart(4)} de ${total}`);
}

if (problemas.length === 0) {
  console.log('');
  console.log('Todos los ficheros y todas las exportaciones están documentados.');
} else {
  console.log('');

  for (const [ruta, fallos] of problemas) {
    console.log(ruta);
    fallos.forEach((fallo) => console.log(fallo));
    console.log('');
  }

  const total = problemas.reduce((suma, [, fallos]) => suma + fallos.length, 0);
  const ficheros = problemas.length === 1 ? '1 fichero' : `${problemas.length} ficheros`;
  console.log(`${total} problemas en ${ficheros}. Cada uno dice cuál y por qué.`);
  console.log('El resumen de arriba se puede leer igual aunque falle: por eso va antes.');
  process.exit(1);
}
