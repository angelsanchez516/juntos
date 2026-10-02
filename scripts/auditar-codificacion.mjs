/**
 * Auditoría de codificación y de caracteres no latinos.
 *
 * RESPONSABILIDAD: revisar los ficheros de texto del proyecto y avisar de
 * problemas de codificación y de caracteres que no deberían estar.
 *
 * POR QUÉ EXISTE
 * Los fallos de generación de texto no salen en el mensaje de error: un
 * fichero puede compilar, pasar los tests y llevar palabras en otro idioma
 * dentro de una frase en español. Ya ha pasado tres veces, y ninguna la
 * detectó el linter, porque para un linter una palabra extraña tiene el mismo
 * aspecto que cualquier otra.
 *
 * Por eso la comprobación es un script aparte y no una nota de "revisalo a
 * ojo": un escaneo que depende de que alguien recuerde mirarlo se salta en
 * cuanto hay prisa.
 *
 * QUÉ MIRA
 * 1. Caracteres fuera del alfabeto latino y de la lista de símbolos
 *    permitidos. Se buscan por rangos completos de Unicode y no por una lista
 *    de palabras, para que también salga un carácter que nadie ha visto antes.
 * 2. U+FFFD, el carácter de reemplazo: indica que algo se leyó mal antes.
 * 3. Mojibake del tipo A con tilde encima: es UTF-8 leído como latin-1, y no
 *    lo vería el punto 1 porque cae dentro del rango latino.
 * 4. BOM y bytes nulos.
 * 5. Saltos de línea mezclados, que ensucian el diff.
 *
 * LO QUE NO ES UN FALLO
 * Las flechas, el apartado, el símbolo de grado, las comillas angulares, la
 * raya larga y el corazón están permitidos y nombrados en `PERMITIDOS`, con su
 * motivo. No es una lista blanca de conveniencia: cada entrada dice por qué se
 * acepta, y una entrada sin motivo no tiene sitio en esa lista.
 *
 * USO
 * `npm run auditar-codificacion` — sale con código 1 si encuentra algo.
 *
 * Related: README.md (Notas importantes), docs/CHANGELOG.md
 *
 * @module scripts/auditar-codificacion
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/** Extensiones con texto dentro. El resto son binarios y no se abren. */
const EXTENSIONES = new Set(['.js', '.jsx', '.mjs', '.md', '.json', '.html', '.css']);

/** Carpetas que no se revisan: dependencias, compilados y metadatos. */
const CARPETAS_IGNORADAS = new Set(['node_modules', 'dist', '.git', 'coverage']);

/**
 * Bloques de Unicode que no pertenecen a un texto en español.
 *
 * Se declaran por nombre y con sus números para poder revisarlos de un vistazo.
 * Cada entrada cubre un bloque entero, así que un carácter raro que nadie ha
 * visto tampoco se escapa.
 *
 * Los rangos de símbolos de uso común (flechas, apartado, grado) NO van aquí:
 * están en `PERMITIDOS`, con su motivo, porque sí se usan en el proyecto.
 *
 * @type {ReadonlyArray<{nombre: string, desde: number, hasta: number}>}
 */
const RANGOS_ESTRANOS = [
  { nombre: 'cirilico', desde: 0x0400, hasta: 0x04ff },
  { nombre: 'cirilico extendido', desde: 0x0500, hasta: 0x052f },
  { nombre: 'hebreo', desde: 0x0590, hasta: 0x05ff },
  { nombre: 'arabe', desde: 0x0600, hasta: 0x06ff },
  { nombre: 'devanagari', desde: 0x0900, hasta: 0x097f },
  { nombre: 'bengali', desde: 0x0980, hasta: 0x09ff },
  { nombre: 'gurmukhi', desde: 0x0a00, hasta: 0x0a7f },
  { nombre: 'gujarati', desde: 0x0a80, hasta: 0x0aff },
  { nombre: 'kannada', desde: 0x0c80, hasta: 0x0cff },
  { nombre: 'malayalam', desde: 0x0d00, hasta: 0x0d7f },
  { nombre: 'tamil', desde: 0x0b80, hasta: 0x0bff },
  { nombre: 'telandes', desde: 0x0e00, hasta: 0x0e7f },
  { nombre: 'lao', desde: 0x0e80, hasta: 0x0eff },
  { nombre: 'tibetano', desde: 0x0f00, hasta: 0x0fff },
  { nombre: 'georgiano', desde: 0x10a0, hasta: 0x10ff },
  { nombre: 'hangul jamo', desde: 0x1100, hasta: 0x11ff },
  { nombre: 'etíope', desde: 0x1200, hasta: 0x137f },
  { nombre: 'cherokee', desde: 0x13a0, hasta: 0x13ff },
  { nombre: 'oglada', desde: 0x1400, hasta: 0x167f },
  { nombre: 'runico', desde: 0x16a0, hasta: 0x16ff },
  { nombre: 'silabario-oriental', desde: 0x1b00, hasta: 0x1b7f },
  { nombre: 'carian', desde: 0x1c80, hasta: 0x1c8f },
  { nombre: 'sinos y vietnamitas', desde: 0x2e80, hasta: 0x2eff },
  { nombre: 'hiragana y katakana', desde: 0x3040, hasta: 0x309f },
  { nombre: 'katakana extendido', desde: 0x30a0, hasta: 0x30ff },
  { nombre: 'katakana pequeno', desde: 0x31f0, hasta: 0x31ff },
  { nombre: 'coreano hangul', desde: 0xac00, hasta: 0xd7af },
  { nombre: 'hangul jamo B', desde: 0x3130, hasta: 0x318f },
  { nombre: 'compatibilidad sino', desde: 0xf900, hasta: 0xfaff },
  { nombre: 'ideogramas', desde: 0x4e00, hasta: 0x9fff },
  { nombre: 'emojis', desde: 0x1f000, hasta: 0x1faff },
  { nombre: 'ideogramas supplement', desde: 0x20000, hasta: 0x2ffff },
];

/**
 * Símbolos permitidos fuera del alfabeto latino, con su motivo.
 *
 * Cada entrada justifica por qué se acepta. Sin motivo no entra aquí: una lista
 * blanca que crece sin explicación deja de ser una lista blanca y pasa a ser
 * una puerta abierta con las bisagras rotas.
 *
 * @type {ReadonlyArray<{caracter: string, motivo: string}>}
 */
const PERMITIDOS = [
  { caracter: '¿', motivo: 'apertura de interrogacion del español' },
  { caracter: '¡', motivo: 'apertura de exclamacion del español' },
  { caracter: '€', motivo: 'moneda citada en la documentacion' },
  { caracter: '—', motivo: 'raya larga en prosa' },
  { caracter: '–', motivo: 'raya corta entre numeros' },
  { caracter: '‘', motivo: 'comilla simple tipografica' },
  { caracter: '’', motivo: 'comilla simple tipografica' },
  { caracter: '“', motivo: 'comillas dobles tipograficas' },
  { caracter: '”', motivo: 'comillas dobles tipograficas' },
  { caracter: '…', motivo: 'puntos suspensivos' },
  { caracter: '·', motivo: 'punto medio en listas de rutas y campos' },
  { caracter: '§', motivo: 'referencia a una seccion de la documentacion' },
  { caracter: '°', motivo: 'grado de los ajustes de imagen' },
  { caracter: '±', motivo: 'mas menos en medidas' },
  { caracter: '≥', motivo: 'mayor o igual en tablas de props' },
  { caracter: '→', motivo: 'flecha en diagramas de flujo y de arquitectura' },
  { caracter: '←', motivo: 'flecha de vuelta' },
  { caracter: '↑', motivo: 'flecha que marca el sentido del flujo' },
  { caracter: '↓', motivo: 'flecha que marca el sentido del flujo' },
  { caracter: '│', motivo: 'caracter de dibujo de tablas de migracion' },
  { caracter: '└', motivo: 'caracter de dibujo de tablas de migracion' },
  { caracter: '▲', motivo: 'marca de advertencia en tablas' },
  { caracter: '⚠', motivo: 'advertencia en encabezados de la documentacion' },
  { caracter: '❤', motivo: 'icono de favorito junto al nombre de la funcion' },
  { caracter: '️', motivo: 'selector de presentacion que acompana a un emoji' },
];

/**
 * Mojibake: lo que se ve cuando un fichero UTF-8 se decodifica como latin-1.
 *
 * Son dos caracteres, el primero con la tilde perdida, y el español no los
 * produce nunca. Se construyen a partir de sus números con `String.fromCharCode`
 * en lugar de escribirlos como literales, porque este fichero contiene la lista
 * y se detectaría a sí mismo: el script que busca el fallo no puede llevar el
 * fallo dentro. Es el mismo motivo por el que los rangos raros de más arriba
 * llevan el nombre en ascii.
 *
 * @type {ReadonlyArray<string>}
 */
const MOJIBAKE = [
  [0x00c3, 0x00a9], // e con acento
  [0x00c3, 0x00a1], // a con acento
  [0x00c3, 0x00ad], // i con acento
  [0x00c3, 0x00b3], // o con acento
  [0x00c3, 0x00ba], // u con acento
  [0x00c3, 0x00b1], // enye
  [0x00c3, 0x00bc], // u con dieresis
  [0x00c3, 0x00a8], // e con acento grave
  [0x00c3, 0x00b6], // o con dieresis
  [0x00c3, 0x00a7], // cedilla
  [0x00c2, 0x00bf], // interrogacion con signo
  [0x00c2, 0x00a1], // exclamacion con signo
  [0x00c2, 0x00b0], // grado
  [0x00e2, 0x20ac], // guion largo mal leido
  [0x00f0, 0x0178], // emoji mal leido
].map((pares) => pares.map((codigo) => String.fromCharCode(codigo)).join(''));

/**
 * Recorre el proyecto y devuelve los ficheros de texto.
 *
 * @param {string} dir Carpeta donde empezar.
 * @returns {string[]} Rutas absolutas de los ficheros a revisar.
 */
function ficherosDeTexto(dir) {
  const encontrados = [];

  for (const nombre of readdirSync(dir)) {
    if (CARPETAS_IGNORADAS.has(nombre)) continue;

    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      encontrados.push(...ficherosDeTexto(ruta));
    } else if (EXTENSIONES.has(extname(nombre))) {
      encontrados.push(ruta);
    }
  }

  return encontrados;
}

/**
 * Construye el conjunto de códigos permitidos.
 *
 * Se calcula una vez en lugar de recorrer la lista en cada carácter del
 * proyecto, que son cientos de miles.
 *
 * @returns {Set<number>} Códigos aceptados.
 */
const permitidos = new Set([
  0x09, // tabulador
  0x0a, // salto de linea
  0x0d, // retorno de carro
]);

// Signos ascii y letras latinas sin acento.
for (let codigo = 0x20; codigo <= 0x7e; codigo += 1) permitidos.add(codigo);

// Latin-1 con acentos, la enye y los signos que se usan en el texto.
for (let codigo = 0xa0; codigo <= 0x24f; codigo += 1) permitidos.add(codigo);

for (const { caracter } of PERMITIDOS) {
  permitidos.add(caracter.codePointAt(0));
}

/**
 * Nombre legible de un carácter que no debería estar en el proyecto.
 *
 * @param {number} codigo Código del carácter.
 * @returns {string} A qué bloque de Unicode pertenece y su número.
 * @example
 * nombreDe(0x4e2d); // 'ideogramas (20013)'
 */
function nombreDe(codigo) {
  const rango = RANGOS_ESTRANOS.find((r) => codigo >= r.desde && codigo <= r.hasta);
  return `${rango?.nombre ?? 'bloque sin identificar'} (${codigo})`;
}

/**
 * Revisa un fichero y devuelve los problemas que encuentra.
 *
 * @param {string} ruta Ruta del fichero.
 * @param {string} raiz Carpeta del proyecto, para mostrar rutas cortas.
 * @returns {string[]} Problemas, con la cabecera del fichero delante, o vacío.
 */
function revisar(ruta, raiz) {
  const buffer = readFileSync(ruta);
  const texto = buffer.toString('utf8');
  const nombre = ruta.slice(raiz.length + 1);
  const problemas = [];

  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    problemas.push('tiene BOM, y un fichero UTF-8 con BOM no siempre se lee igual');
  }

  if (buffer.includes(0)) {
    problemas.push('tiene bytes nulos, así que no es un fichero de texto válido');
  }

  for (const mojibake of MOJIBAKE) {
    if (texto.includes(mojibake)) {
      problemas.push(`contiene mojibake, que es UTF-8 leído como latin-1 (${mojibake})`);
    }
  }

  /*
   * Se recorre carácter a carácter y no con una expresión regular porque los
   * rangos están declarados como números: escribirlos en un literal deja el
   * valor partido entre varias líneas del código y un rango mal escrito no se ve
   * hasta que falla. Además el aviso necesita el número de línea, y una
   * coincidencia global no lo da.
   */
  const yaAvisados = new Set();
  let linea = 1;

  for (const caracter of texto) {
    if (caracter === '\n') {
      linea += 1;
      continue;
    }

    const codigo = caracter.codePointAt(0);

    // U+FFFD se cuenta como problema propio, para no repetirlo dos veces.
    if (codigo === 0xfffd) {
      if (!yaAvisados.has('fffd')) {
        problemas.push(
          `línea ${linea}: carácter de reemplazo U+FFFD, algo se leyó mal antes`,
        );
        yaAvisados.add('fffd');
      }
      continue;
    }

    if (!permitidos.has(codigo)) {
      const clave = `${linea}-${codigo}`;
      if (!yaAvisados.has(clave)) {
        problemas.push(`línea ${linea}: ${nombreDe(codigo)}, el carácter "${caracter}"`);
        yaAvisados.add(clave);
      }
    }
  }

  const crlf = (texto.match(/\r\n/g) || []).length;
  const lf = (texto.match(/(?<!\r)\n/g) || []).length;
  if (crlf > 0 && lf > 0) {
    problemas.push(`saltos de línea mezclados: ${crlf} CRLF y ${lf} LF`);
  }

  if (texto !== '' && !texto.endsWith('\n')) {
    problemas.push('no termina en salto de línea');
  }

  return problemas.length === 0 ? [] : [nombre, ...problemas.map((p) => `  ${p}`)];
}

const raiz = process.cwd();
const ficheros = ficherosDeTexto(raiz);
const problemas = ficheros.map((f) => revisar(f, raiz)).filter((p) => p.length > 0);

for (const grupo of problemas) {
  console.log('');
  grupo.forEach((linea) => console.log(linea));
}

console.log('');
console.log(`Ficheros revisados: ${ficheros.length}`);
console.log(`Con problemas: ${problemas.length}`);

if (problemas.length > 0) {
  console.log('');
  console.log('Cada aviso dice fichero, línea y el número del carácter.');
  process.exit(1);
}

console.log('Sin problemas de codificación ni de caracteres no latinos.')
