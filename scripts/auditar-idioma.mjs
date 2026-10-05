/**
 * Auditoría de idioma: palabras inglesas dentro de frases en español.
 *
 * RESPONSABILIDAD: revisar el texto del proyecto (documentación, README,
 * comentarios del código y de los scripts) y avisar de palabras inglesas que se
 * han colado en medio de una frase en español.
 *
 * POR QUÉ EXISTE
 * El fallo no da error de sintaxis, no rompe la suite y no lo ve el linter: para
 * un linter, "the" y "con" tienen el mismo aspecto. La auditoría de codificación
 * tampoco lo ve, porque "the" es perfectamente latina. Y no es un problema
 * teórico: en este proyecto han aparecido media docena de veces ("La manages",
 * "affirmed", "yuir", "puntokeyboard"), y cada vez que se corregía una aparecía
 * otra en el siguiente fichero. Es exactamente el fallo que se corrige a mano y
 * vuelve.
 *
 * QUÉ MIRA
 * 1. En Markdown: el texto de las líneas, dejando fuera las vallas de código, el
 *    código en línea, las etiquetas HTML y el destino de los enlaces. El destino
 *    se quita porque es una URL, y una URL no es prosa: `date-fns` y `main` no son
 *    palabras inglesas escritas en una frase.
 * 2. En JavaScript y JSX: SOLO los comentarios. El código no se revisa, porque
 *    ahí los nombres vienen del inglés por acuerdo (useState, localStorage) y
 *    encontrar un fallo ahí sería rechazar identificadores, no prosa.
 *
 * LO QUE NO ES UN FALLO
 * Los nombres propios y los términos técnicos van en CamelCase o con mayúscula
 * (`React`, `localStorage`, `date-fns`, `Tailwind`), así que no coinciden con
 * ninguna palabra de la lista: la comparación distingue mayúsculas y minúsculas
 * a propósito. Lo que sí hace falta son las excepciones de `EXCEPCIONES`, y cada
 * una lleva su motivo: una lista blanca que crece sin explicación deja de ser una
 * lista blanca.
 *
 * POR QUÉ ESTE FICHERO NO SE REVISA A SÍ MISMO
 * Es el único fichero del proyecto que contiene la lista de palabras inglesas, y
 * lo hace a propósito. Por eso `EXCLUIDOS` lo aparta en lugar de intentar
 * distinguir "la lista" de "una falta".
 *
 * USO
 * `npm run auditar-idioma` — sale con código 1 si encuentra algo.
 * `npm run auditar-idioma -- --mensajes` — lo mismo, pero sobre los mensajes de
 * commit, que se leen con `git log` y no se pueden arreglar solos.
 *
 * Related: scripts/auditar-codificacion.mjs, README.md (Auditoría de idioma),
 * docs/CHANGELOG.md
 *
 * @module scripts/auditar-idioma
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/** Carpetas que no se revisan: dependencias, compilados y metadatos. */
const CARPETAS_IGNORADAS = new Set(['node_modules', 'dist', '.git', 'coverage']);

/** Carpetas del proyecto que se revisan, además de la raíz. */
const CARPETAS = ['docs', 'src', 'scripts'];

/** Ficheros sueltos de la raíz que se revisan. */
const FICHEROS_SUELTOS = ['README.md'];

/** Ficheros que se apartan a propósito, con el motivo declarado abajo. */
const EXCLUIDOS = new Set(['auditar-idioma.mjs']);

/** Extensiones con prosa. En `.js` y `.jsx` solo se miran los comentarios. */
const ES_MARKDOWN = new Set(['.md']);
const ES_CODIGO = new Set(['.js', '.jsx', '.mjs']);

/**
 * Palabras inglesas que no existen en español.
 *
 * La lista se declara por grupos y en minúsculas porque la comparación distingue
 * mayúsculas: así `React` no se confunde con `react`, y `The` al principio de una
 * frase (que es donde un hilo entero en inglés se escaparía) sí salta.
 *
 * CRITERIO PARA ENTRAR
 * Una palabra entra si no aparece en ningún uso del español, ni técnico ni
 * coloquial. Por eso está `an` y no `a`, que es la preposición española; por eso no
 * están `if`, `so`, `to`, `on`, `at`, `in` ni `no`, que son palabras muy cortas que
 * se cuelan dentro de fragmentos de código citados o de nombres de fichero, y en
 * español `no` es además la negación; y por eso `use` NO está, aunque de sobra se
 * usa: "quien use" es el subjuntivo de "usar", tan español como "tenga". Esa es
 * la clase de falso positivo que hace que un auditor de idioma se apague: el
 * primer escaneo del proyecto avisó de `use` seis veces y todas eran eso.
 *
 * @type {ReadonlyArray<{grupo: string, motivo: string, palabras: ReadonlyArray<string>}>}
 */
const GRUPOS = [
  {
    grupo: 'determinantes y pronombres',
    motivo: 'el español no tiene artículo ante el plural ni estos demostrativos',
    palabras: [
      'the', 'an', 'this', 'that', 'these', 'those', 'which', 'who', 'whom',
      'whose', 'what', 'any', 'each', 'every', 'both', 'either', 'neither',
      'none', 'such', 'same', 'another', 'other', 'others', 'own', 'several',
    ],
  },
  {
    grupo: 'preposiciones',
    motivo: 'el español usa "de", "en", "con", "para", "sobre"',
    palabras: [
      'of', 'for', 'with', 'without', 'from', 'into', 'onto', 'upon', 'within',
      'about', 'above', 'below', 'between', 'during', 'through', 'across',
      'around', 'against', 'behind', 'beyond', 'along', 'before', 'after',
      'over', 'under', 'toward', 'towards', 'off', 'out', 'there', 'here',
    ],
  },
  {
    grupo: 'conjunciones',
    motivo: 'el español usa "y", "o", "pero", "porque", "mientras"',
    palabras: ['and', 'or', 'nor', 'than', 'because', 'while', 'until', 'whether', 'but'],
  },
  {
    grupo: 'verbos auxiliares',
    motivo: 'el español los conjuga, así que su forma infinita no aparece',
    palabras: [
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
      'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should',
      'may', 'might', 'must',
    ],
  },
  {
    grupo: 'adverbios y partículas',
    motivo: 'el español tiene "no", "solo", "todavía", "ya"',
    palabras: [
      'not', 'only', 'also', 'just', 'still', 'yet', 'already', 'always',
      'never', 'often', 'sometimes', 'usually', 'again', 'once', 'twice',
      'then', 'thus', 'hence', 'however', 'therefore', 'instead', 'otherwise',
      'anyway', 'indeed', 'even', 'ever', 'else', 'too', 'very', 'quite',
      'rather', 'almost', 'nearly', 'soon', 'later', 'away', 'back', 'well',
      'now', 'enough',
    ],
  },
  {
    grupo: 'préstamos que el proyecto escribe en inglés',
    motivo: 'son inglesas, pero el proyecto las usa como si fueran del idioma',
    palabras: ['hook'],
  },
  {
    grupo: 'verbos muy frecuentes',
    motivo: 'son los que más se cuelan al traducir un comentario',
    palabras: [
      'need', 'needs', 'want', 'keep', 'keeps', 'show', 'shows', 'find',
      'finds', 'build', 'builds', 'built', 'pass', 'passes', 'fail', 'fails',
      'return', 'returns', 'uses', 'used', 'using', 'make', 'makes', 'see',
      'seen', 'take', 'give', 'gives', 'tell', 'told', 'says', 'know',
      'knows', 'read', 'write', 'call', 'calls', 'delete', 'remove', 'removes',
    ],
  },
];

/**
 * Palabras inglesas que el proyecto usa a propósito, con su motivo.
 *
 * Cada entrada justifica por qué se acepta. Sin motivo no entra: una excepción sin
 * explicación es un fallo esperando a que alguien la lea como permiso.
 *
 * @type {ReadonlyArray<{palabra: string, motivo: string}>}
 */
const EXCEPCIONES = [
  { palabra: 'check', motivo: 'nombre de la restricción de PostgreSQL y de las de SQL en general' },
  { palabra: 'hook', motivo: 'préstamo que el proyecto usa al hablar de useEstado y sus derivados' },
  { palabra: 'build', motivo: 'el nombre de la tarea de construcción (`npm run build`), que aquí se dice tal cual' },
];

/**
 * Una línea de comentario que es código y no prosa.
 *
 * Los ejemplos de `@example` y los fragmentos que se citan dentro de un comentario
 * son código escrito en inglés por acuerdo, igual que los identificadores. Se
 * distinguen por cuatro señales: empezar por una palabra clave, llevar una flecha
 * gorda, terminar en punto y coma (seguido o no de un comentario de cola) o llevar
 * llaves. Una frase en español no cumple ninguna.
 */
const RE_LINEA_DE_CODIGO = /^\s*(?:import|export|const|let|var|function|return|if|for|while)\b|=>|;\s*(?:\/\/|$)|[{}]/;

/** Conjunto de palabras a buscar, ya en minúsculas. */
const BUSCADAS = new Set(GRUPOS.flatMap((g) => g.palabras));

/** Conjunto de excepciones, ya en minúsculas. */
const PERMITIDAS = new Set(EXCEPCIONES.map((e) => e.palabra.toLowerCase()));

/** Una palabra de la lista, sin distinguir mayúsculas. */
const RE_PALABRA = /[A-Za-z]+/g;

/**
 * Recorre una carpeta y devuelve los ficheros de prosa que hay dentro.
 *
 * @param {string} dir Carpeta donde mirar.
 * @param {string} raiz Carpeta del proyecto, para mostrar rutas cortas.
 * @returns {Array<{ruta: string, relativa: string, markdown: boolean}>} Ficheros.
 */
function ficherosDeProsaEn(dir, raiz) {
  const encontrados = [];

  for (const nombre of readdirSync(dir)) {
    if (CARPETAS_IGNORADAS.has(nombre) || EXCLUIDOS.has(nombre)) continue;

    const completa = join(dir, nombre);
    if (statSync(completa).isDirectory()) {
      encontrados.push(...ficherosDeProsaEn(completa, raiz));
      continue;
    }

    if (!esFicheroDeProse(completa)) continue;

    encontrados.push({
      ruta: completa,
      relativa: completa.slice(raiz.length + 1),
      markdown: ES_MARKDOWN.has(extname(nombre)),
    });
  }

  return encontrados;
}

/**
 * Devuelve los ficheros que hay que revisar, y son los mismos en cada ejecución.
 *
 * @param {string} raiz Carpeta del proyecto.
 * @returns {Array<{ruta: string, relativa: string, markdown: boolean}>} Ficheros.
 */
function ficherosARevisar(raiz) {
  const carpetas = CARPETAS
    .map((carpeta) => join(raiz, carpeta))
    .filter((ruta) => statSync(ruta, { throwIfNoEntry: false })?.isDirectory());

  const deCarpetas = carpetas.flatMap((carpeta) => ficherosDeProsaEn(carpeta, raiz));

  const sueltos = FICHEROS_SUELTOS
    .map((nombre) => join(raiz, nombre))
    .filter((ruta) => esFicheroDeProse(ruta) && !EXCLUIDOS.has(ruta.slice(raiz.length + 1)))
    .map((ruta) => ({
      ruta,
      relativa: ruta.slice(raiz.length + 1),
      markdown: ES_MARKDOWN.has(extname(ruta)),
    }));

  return [...deCarpetas, ...sueltos];
}

/**
 * Indica si la extensión del fichero contiene prosa.
 *
 * @param {string} ruta Ruta del fichero.
 * @returns {boolean} `true` si hay texto que revisar.
 */
function esFicheroDeProse(ruta) {
  const extension = extname(ruta);
  return ES_MARKDOWN.has(extension) || ES_CODIGO.has(extension);
}

/**
 * Quita las tildes antes de comparar.
 *
 * Sin esto, un patrón de letras ASCII parte las palabras acentuadas en trozos: en
 * "funcionarían" vería "funcionar" y "an", y avisaría de una palabra inglesa que
 * no está. También haría que "Mayús" pareciera contener "may" y "foránea" contener
 * "for". Los dos falsos positivos más ruidosos del primer escaneo.
 *
 * @param {string} texto Texto cualquiera.
 * @returns {string} El mismo texto sin marcas de acentuación.
 */
function sinAcentos(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Quita de una línea lo que no es prosa.
 *
 * @param {string} linea Línea de Markdown, ya sin vallas ni código en línea.
 * @returns {string} La línea sin etiquetas ni destinos de enlace.
 */
function sinMarcado(linea) {
  return linea
    .replace(/<[^>]*>/g, ' ')
    .replace(/\]\([^)]*\)/g, '] ')
    .replace(/https?:\/\/\S+/g, ' ');
}

/**
 * Quita de un comentario lo que no es prosa en español.
 *
 * Se quitan las URLs y, en los comentarios de bloque, los nombres de las etiquetas
 * de JSDoc (`@param`, `@returns`, `@example`...). Son inglés por acuerdo, como los
 * identificadores, y aparecen en todos los ficheros del proyecto.
 *
 * @param {string} texto Comentario entero.
 * @param {boolean} esBloque `true` si viene de un comentario de bloque.
 * @returns {string} El comentario sin código ni nombres de etiqueta.
 */
/**
 * Sustituye por espacios los bloques entre llaves, y deja los saltos de línea.
 *
 * Son las anotaciones de tipo de JSDoc (`{Promise<any>}`, `{Readonly<Record<string,
 * any>>}`). Sin quitarlo, `any` salía en seis ficheros: no es prosa, es la
 * gramática de TypeScript escrita en un comentario.
 *
 * @param {string} texto Comentario entero.
 * @returns {string} El mismo texto con las llaves y su contenido en blanco.
 */
function sinTipos(texto) {
  let salida = '';
  let profundidad = 0;

  for (const caracter of texto) {
    if (caracter === '{') profundidad += 1;
    if (caracter === '}') profundidad = Math.max(0, profundidad - 1);
    salida += profundidad > 0 && caracter !== '\n' ? ' ' : caracter;
  }

  return salida;
}

/**
 * Quita de un comentario lo que no es prosa en español.
 *
 * Se quitan, por este orden: la viñeta `*` de cada línea (para que las señales de
 * código se puedan reconocer), las líneas que son código, los tipos entre llaves, el
 * código en línea, las URLs y, en los comentarios de bloque, los nombres de las
 * etiquetas de JSDoc (`@param`, `@returns`, `@example`...). Es inglés por acuerdo,
 * como los identificadores, y aparece en todos los ficheros del proyecto.
 *
 * @param {string} texto Comentario entero.
 * @param {boolean} esBloque `true` si viene de un comentario de bloque.
 * @returns {string} El comentario sin código ni nombres de etiqueta.
 */
function sinCodigoDeComentario(texto, esBloque) {
  const sinVinetas = esBloque
    ? texto.split('\n').map((linea) => linea.replace(/^\s*\*+\s?/, '')).join('\n')
    : texto;

  const sinLineasDeCodigo = sinTipos(sinVinetas)
    .split('\n')
    .filter((linea) => !RE_LINEA_DE_CODIGO.test(linea))
    .join('\n');

  const limpio = sinLineasDeCodigo
    .replace(/`+[^`]*`+/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ');

  return esBloque ? limpio.replace(/@[A-Za-z]+/g, ' ') : limpio;
}

/**
 * Devuelve las líneas de prosa de un Markdown, con las vallas de código vacías.
 *
 * Las vallas se lleva la línea de apertura y la de cierre, y todo lo de dentro. Si
 * no se llevaran, cada ejemplo de `docs/` sería un informe de idioma nuevo.
 *
 * El código en línea se quita DESPUÉS, sobre el texto entero y no línea a línea,
 * porque un bloque puede empezar en una línea y acabar en otra. Al sustituirlo por
 * espacios se conservan los saltos, para que el número de línea del aviso siga
 * siendo el del fichero.
 *
 * @param {string[]} lineas Líneas del fichero.
 * @returns {string[]} Líneas limpias, en la misma posición.
 */
function prosaDeMarkdown(lineas) {
  let dentroDeValla = false;

  const sinVallas = lineas.map((linea) => {
    if (/^\s*(```|~~~)/.test(linea)) {
      dentroDeValla = !dentroDeValla;
      return '';
    }
    return dentroDeValla ? '' : linea;
  });

  const sinCodigo = sinVallas
    .join('\n')
    .replace(/`+[^`]*`+/g, (trozo) => trozo.replace(/[^\n]/g, ' '));

  return sinCodigo.split('\n').map(sinMarcado);
}

/**
 * Devuelve los comentarios de un fichero de código, con su número de línea.
 *
 * Los literales de cadena no se distinguen de los comentarios: un `//` dentro de
 * una URL se tomaría por el inicio de un comentario. No importa, porque a un
 * literal no le van a quedar palabras inglesas sueltas, y el aviso sale con su
 * línea, que es justo lo que hace falta para juzgarlo. Distinguirlo exigiría un
 * analizador de JavaScript entero para ahorrarse un aviso.
 *
 * El salto de línea se guarda al final de cada línea del bloque, porque sin él el
 * comentario entero llega a `sinCodigoDeComentario()` como una línea sola, y las
 * señales de "esto es código" dejan de poder mirarse línea a línea.
 *
 * @param {string[]} lineas Líneas del fichero.
 * @returns {Array<{linea: number, texto: string}>} Comentarios con su línea.
 */
function comentariosDeCodigo(lineas) {
  const comentarios = [];
  let dentroDeBloque = false;
  let numeroDeLinea = 0;
  let desde = 0;
  let buffer = '';

  for (const linea of lineas) {
    numeroDeLinea += 1;
    let cursor = 0;

    while (cursor < linea.length) {
      if (dentroDeBloque) {
        const fin = linea.indexOf('*/', cursor);
        if (fin === -1) {
          buffer += `${linea.slice(cursor)}\n`;
          cursor = linea.length;
          break;
        }
        buffer += linea.slice(cursor, fin);
        comentarios.push({ linea: desde, texto: sinCodigoDeComentario(buffer, true) });
        dentroDeBloque = false;
        buffer = '';
        cursor = fin + 2;
        continue;
      }

      const abre = linea.indexOf('/*', cursor);
      const cierra = linea.indexOf('//', cursor);

      if (abre !== -1 && (cierra === -1 || abre < cierra)) {
        dentroDeBloque = true;
        desde = numeroDeLinea;
        buffer = '';
        cursor = abre;
        continue;
      }

      if (cierra !== -1) {
        comentarios.push({ linea: numeroDeLinea, texto: sinCodigoDeComentario(linea.slice(cierra + 2), false) });
        cursor = linea.length;
        break;
      }

      cursor = linea.length;
    }
  }

  return comentarios;
}

/**
 * Busca palabras de la lista en un fragmento ya limpio.
 *
 * @param {string} texto Texto a revisar.
 * @returns {Set<string>} Palabras encontradas, en minúsculas y sin repetir.
 */
function palabrasEncontradas(texto) {
  const encontradas = new Set();
  for (const coincidencia of sinAcentos(texto).matchAll(RE_PALABRA)) {
    const palabra = coincidencia[0].toLowerCase();
    if (BUSCADAS.has(palabra) && !PERMITIDAS.has(palabra)) encontradas.add(palabra);
  }
  return encontradas;
}

/**
 * Recorta el aviso para que se vea la frase en la que está la palabra.
 *
 * La palabra se busca con sus límites, y no con `indexOf`: un `indexOf('an')`
 * encuentra el "an" de "escanea" y el aviso acaba señalando media línea antes de
 * donde está el fallo, que es peor que no señalar nada.
 *
 * @param {string} texto Texto de la línea.
 * @param {string} palabra Palabra encontrada.
 * @returns {string} Un trozo corto de texto con la palabra en medio.
 */
function excerpt(texto, palabra) {
  const limpio = texto.replace(/\s+/g, ' ').trim();
  const coincidencia = new RegExp(`(?<![A-Za-zÀ-ÿ])(${palabra})(?![A-Za-zÀ-ÿ])`, 'i').exec(limpio);
  if (!coincidencia) return limpio.slice(0, 90);

  const desde = Math.max(0, coincidencia.index - 40);
  const trozo = limpio.slice(desde, desde + 90);
  return desde > 0 ? `…${trozo}` : trozo;
}

/**
 * Revisa un fichero y devuelve los problemas que encuentra.
 *
 * @param {{ruta: string, relativa: string, markdown: boolean}} fichero Fichero.
 * @returns {string[]} Problemas, con el nombre del fichero delante, o vacío.
 */
function revisar(fichero) {
  const texto = readFileSync(fichero.ruta, 'utf8').replace(/\r\n/g, '\n');
  const lineas = texto.split('\n');
  const problemas = [];

  if (fichero.markdown) {
    const limpias = prosaDeMarkdown(lineas);
    limpias.forEach((linea, indice) => {
      for (const palabra of palabrasEncontradas(linea)) {
        problemas.push(`  línea ${indice + 1}: "${palabra}" — ${excerpt(linea, palabra)}`);
      }
    });
    return problemas.length === 0 ? [] : [fichero.relativa, ...problemas];
  }

  for (const comentario of comentariosDeCodigo(lineas)) {
    for (const palabra of palabrasEncontradas(comentario.texto)) {
      problemas.push(`  línea ${comentario.linea}: "${palabra}" — ${excerpt(comentario.texto, palabra)}`);
    }
  }

  return problemas.length === 0 ? [] : [fichero.relativa, ...problemas];
}

/**
 * Revisa los mensajes de commit y devuelve los que traen palabras inglesas.
 *
 * Los mensajes son prosa también, y son la parte del proyecto que peor se recuerda
 * seis meses después. Se leen con `git log`, así que el historial queda donde está:
 * el script lo señala, pero no lo puede arreglar. Arreglar un mensaje antiguo es
 * reescribir la historia, y eso lo decide quien manda, no un script.
 *
 * @returns {string[]} Problemas, uno por commit.
 */
function revisarMensajes() {
  const log = execFileSync('git', ['log', '--format=%h%x1f%B%x1e'], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });

  const problemas = [];

  for (const entrada of log.split('\x1e')) {
    const [hash, ...resto] = entrada.trim().split('\x1f');
    if (!hash || resto.length === 0) continue;

    const texto = sinMarcado(resto.join('\x1f').replace(/`+[^`]*`+/g, ' '));
    const encontrados = [...palabrasEncontradas(texto)];
    if (encontrados.length === 0) continue;

    const linea = texto.split('\n').find((l) => encontrados.some((p) => new RegExp(`(?<![A-Za-zÀ-ÿ])${p}(?![A-Za-zÀ-ÿ])`, 'i').test(l))) ?? '';
    problemas.push(`  ${hash}  "${encontrados.join('", "')}" — ${excerpt(linea, encontrados[0])}`);
  }

  return problemas;
}

const raiz = process.cwd();
const soloMensajes = process.argv.includes('--mensajes');

if (soloMensajes) {
  const problemas = revisarMensajes();

  console.log('');
  console.log(`Palabras vigiladas: ${BUSCADAS.size}`);
  console.log(`Excepciones: ${PERMITIDAS.size}`);
  console.log(`Mensajes revisados: ${execFileSync('git', ['rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim()}`);
  console.log(`Con problemas: ${problemas.length}`);

  if (problemas.length > 0) {
    console.log('');
    problemas.forEach((linea) => console.log(linea));
    console.log('');
    console.log('Corregir un mensaje ya escrito es reescribir la historia: se decide a mano,');
    console.log('con `git rebase`, y solo si el commit no se ha compartido todavía.');
    process.exit(1);
  }

  console.log('');
  console.log('Sin palabras inglesas en los mensajes de commit.');
} else {
  const ficheros = ficherosARevisar(raiz);
  const problemas = ficheros.map(revisar).filter((p) => p.length > 0);

  for (const grupo of problemas) {
    console.log('');
    grupo.forEach((linea) => console.log(linea));
  }

  console.log('');
  console.log(`Palabras vigiladas: ${BUSCADAS.size}`);
  console.log(`Excepciones: ${PERMITIDAS.size}`);
  console.log(`Ficheros revisados: ${ficheros.length}`);
  console.log(`Con problemas: ${problemas.length}`);

  if (problemas.length > 0) {
    console.log('');
    console.log('Cada aviso dice fichero, línea, la palabra y el trozo donde está.');
    console.log('Si la palabra está en inglés a propósito, añádela a EXCEPCIONES con su motivo.');
    process.exit(1);
  }

  console.log('Sin palabras inglesas en la prosa.');
}
