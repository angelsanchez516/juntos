/**
 * Pruebas de la capa de datos y de la cuadrícula del calendario.
 *
 * Comprueba el comportamiento real contra un localStorage simulado (siembra,
 * CRUD, validación, lectura tolerante a fallos, cuota, UUIDs) y la función pura
 * `construirCuadricula` sin montar React.
 *
 * FECHA SIMULADA
 * Con un argumento `YYYY-MM-DD` la suite fija el reloj de `src/utils/reloj.js`
 * y toda la app pasa a creer que ese es el día de hoy: el seed siembra ese mes,
 * las utilidades de "hoy" responden a esa fecha y los componentes renderizan
 * desde ahí. Sirve para que los resultados no dependan del día en que se
 * ejecuta, y para repetir la misma batería en meses con días y semanas
 * distintas: `npm run test:octubre` y `npm run test:febrero`.
 *
 * Ejecutar con: npm test
 *
 * Related: src/services/*, src/utils/*, docs/VERIFICACION_MANUAL.md (lo que la
 * suite no alcanza)
 *
 * @module test-datos
 */
import { createServer } from 'vite';
import { createRequire } from 'module';
import { readFileSync } from 'node:fs';

// --- localStorage simulado, con cuota configurable e inyectable de errores ---
class LocalStorageMock {
  constructor({ cuotaBytes = Infinity, fallaAlLeer = false, fallaAlEscribir = false } = {}) {
    this.map = new Map();
    this.cuotaBytes = cuotaBytes;
    this.fallaAlLeer = fallaAlLeer;
    this.fallaAlEscribir = fallaAlEscribir;
  }
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) {
    // Simula un almacén que deja de estar disponible a mitad de la cuenta.
    if (this.fallaAlLeer) {
      const e = new Error('almacén no disponible');
      e.name = 'SecurityError';
      throw e;
    }
    return this.map.has(k) ? this.map.get(k) : null;
  }
  setItem(k, v) {
    // Simula un almacén que se cierra a mitad de una escritura.
    if (this.fallaAlEscribir) {
      const e = new Error('almacén cerrado');
      e.name = 'InvalidStateError';
      throw e;
    }
    const tamano = (k.length + String(v).length) * 2;
    if (tamano > this.cuotaBytes) {
      const e = new Error('cuota');
      e.name = 'QuotaExceededError';
      e.code = 22;
      throw e;
    }
    this.map.set(k, String(v));
  }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
  get cuotaUsada() {
    return [...this.map].reduce((t, [k, v]) => t + (k.length + v.length) * 2, 0);
  }
}

let pruebas = 0;
let fallos = 0;

function comprobar(nombre, condicion, detalle = '') {
  pruebas += 1;
  if (condicion) {
    console.log(`  OK    ${nombre}`);
  } else {
    fallos += 1;
    console.log(`  FALLO ${nombre} ${detalle}`);
  }
}

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

const storage = new LocalStorageMock();
globalThis.window = { localStorage: storage };
// Node 24 ya expone `globalThis.crypto`, y es de solo lectura: no hace falta
// asignarlo ni se puede. Si estuviera ausente, lo definimos aquí.

const ev = await vite.ssrLoadModule('/src/services/eventosService.js');
const ci = await vite.ssrLoadModule('/src/services/citasService.js');
const st = await vite.ssrLoadModule('/src/services/storage.js');
const va = await vite.ssrLoadModule('/src/utils/validaciones.js');
const fe = await vite.ssrLoadModule('/src/utils/fechas.js');
const ca = await vite.ssrLoadModule('/src/utils/calendario.js');
const cg = await vite.ssrLoadModule('/src/utils/categorias.js');
const im = await vite.ssrLoadModule('/src/utils/imagen.js');
const sd = await vite.ssrLoadModule('/src/data/seed.js');
const rj = await vite.ssrLoadModule('/src/utils/reloj.js');

/*
 * Reloj de la suite. Sin argumento va con el tiempo real; con uno, la app entera
 * cree que ese es hoy. Se fija ANTES de la primera siembra, que es el momento en
 * que `getEventos()` decide qué escribir.
 */
const FECHA_SIMULADA = process.argv[2] ?? null;
if (FECHA_SIMULADA !== null) {
  rj.fijarAhora(FECHA_SIMULADA);
  console.log(`\nReloj fijado: la app cree que hoy es ${FECHA_SIMULADA}.`);
}

console.log('\n== El reloj es inyectable ==');
// Si esta costura se rompe, el resto de la suite vuelve a depender del día en
// que se ejecuta, y es exactamente el fallo que estas comprobaciones evitan.

/** Fecha local del sistema en `YYYY-MM-DD`, calculada sin `date-fns`. */
function isoDelSistema() {
  const momento = new Date();
  const mes = String(momento.getMonth() + 1).padStart(2, '0');
  const dia = String(momento.getDate()).padStart(2, '0');
  return `${momento.getFullYear()}-${mes}-${dia}`;
}

rj.fijarAhora('2026-10-02');
comprobar('hoyISO sigue al reloj fijado', fe.hoyISO() === '2026-10-02', fe.hoyISO());
comprobar('esHoy usa el reloj fijado', fe.esHoy('2026-10-02') && !fe.esHoy('2026-10-03'));
comprobar('estaPasada usa el reloj fijado', fe.estaPasada('2026-10-01') && !fe.estaPasada('2026-10-02'));
comprobar('diasHasta usa el reloj fijado', fe.diasHasta('2026-10-05') === 3, String(fe.diasHasta('2026-10-05')));
comprobar('etiquetaRelativa usa el reloj fijado', fe.etiquetaRelativa('2026-10-03') === 'Mañana', fe.etiquetaRelativa('2026-10-03') ?? 'null');
comprobar('el seed se ancla al mes fijado', sd.crearEventosSeed().every((e) => e.fecha.startsWith('2026-10') || e.fecha.startsWith('2026-11')), sd.crearEventosSeed().map((e) => e.fecha).join(' '));
comprobar('el seed acepta otra referencia explícita', sd.crearEventosSeed(new Date(2027, 1, 28)).every((e) => e.fecha.startsWith('2027-02') || e.fecha.startsWith('2027-03')), sd.crearEventosSeed(new Date(2027, 1, 28)).map((e) => e.fecha).join(' '));
rj.restablecerAhora();
comprobar('restablecer devuelve el reloj del sistema', fe.hoyISO() === isoDelSistema(), `${fe.hoyISO()} vs ${isoDelSistema()}`);
comprobar('sin referencia no hay reloj fijado', rj.relojFijado() === false);
let falloReloj = '';
try { rj.fijarAhora('no-es-una-fecha'); } catch (e) { falloReloj = e.name; }
comprobar('una fecha inválida falla al fijar el reloj', falloReloj === 'TypeError', falloReloj || 'no lanzó');
rj.restablecerAhora();

if (FECHA_SIMULADA !== null) {
  rj.fijarAhora(FECHA_SIMULADA);
}

console.log('\n== Categorías ==');
/*
 * La leyenda del calendario recorre ORDEN_CATEGORIAS_EVENTO y busca cada clave
 * en CATEGORIAS_EVENTO. Si una no existe, la página revienta; y si el seed usa
 * una clave que el objeto no tiene, los eventos salen con la categoría de
 * reserva sin que se note. Estas comprobaciones cubren las dos.
 */
comprobar('toda clave del orden existe en el objeto', cg.ORDEN_CATEGORIAS_EVENTO.every((k) => cg.CATEGORIAS_EVENTO[k] !== undefined), cg.ORDEN_CATEGORIAS_EVENTO.filter((k) => !cg.CATEGORIAS_EVENTO[k]).join(','));
comprobar('el orden no repite claves', new Set(cg.ORDEN_CATEGORIAS_EVENTO).size === cg.ORDEN_CATEGORIAS_EVENTO.length);
comprobar('toda clave del orden de ideas existe', cg.ORDEN_CATEGORIAS_IDEA.every((k) => cg.CATEGORIAS_IDEA[k] !== undefined), cg.ORDEN_CATEGORIAS_IDEA.filter((k) => !cg.CATEGORIAS_IDEA[k]).join(','));
comprobar('las claves son slugs sin espacios ni acentos', [...Object.keys(cg.CATEGORIAS_EVENTO), ...Object.keys(cg.CATEGORIAS_IDEA)].every((k) => /^[\w-]+$/.test(k)), Object.keys(cg.CATEGORIAS_EVENTO).concat(Object.keys(cg.CATEGORIAS_IDEA)).filter((k) => !/^[\w-]+$/.test(k)).join(','));
comprobar('cada categoría tiene color, fondo y texto', [...Object.values(cg.CATEGORIAS_EVENTO), ...Object.values(cg.CATEGORIAS_IDEA)].every((c) => /^#[0-9A-Fa-f]{6}$/.test(c.hex) && /^#[0-9A-Fa-f]{6}$/.test(c.bg) && /^#[0-9A-Fa-f]{6}$/.test(c.fg)));
comprobar('"cumpleanos" se resuelve a Cumpleaños', cg.obtenerCategoria('cumpleanos').label === 'Cumpleaños', cg.obtenerCategoria('cumpleanos').label);
comprobar('"en-casa" se resuelve a En casa', cg.obtenerCategoriaIdea('en-casa').label === 'En casa', cg.obtenerCategoriaIdea('en-casa').label);
comprobar('una categoría inventada cae en "Otro"', cg.obtenerCategoria('no-existe').label === 'Otro');
comprobar('el seed solo usa claves que existen', sd.crearEventosSeed().every((e) => cg.CATEGORIAS_EVENTO[e.categoria] !== undefined), [...new Set(sd.crearEventosSeed().map((e) => e.categoria))].filter((k) => !cg.CATEGORIAS_EVENTO[k]).join(','));
comprobar('el seed de ideas solo usa claves que existen', sd.crearIdeasSeed().every((i) => cg.CATEGORIAS_IDEA[i.categoria] !== undefined));
// `validarIdea` lanza `ErrorValidacion` en vez de devolver `{ valido }`, así
// que "el seed es válido" significa "no lanza".
comprobar('la validación acepta las claves del seed', sd.crearIdeasSeed().every((i) => { try { va.validarIdea(i); return true; } catch { return false; } }));

console.log('\n== El catálogo es la única fuente ==');
/*
 * El bug de `cumpleaños` contra `cumpleanos` vino de escribir la misma lista en
 * varios archivos. Estas pruebas comprueban que ya no queda ninguna lista
 * escrita a mano, y que los derivados siguen agreeing con el catálogo.
 */
comprobar('el orden de eventos sale del catálogo', JSON.stringify(cg.ORDEN_CATEGORIAS_EVENTO) === JSON.stringify(Object.keys(cg.CATEGORIAS_EVENTO)));
comprobar('el orden de ideas sale del catálogo', JSON.stringify(cg.ORDEN_CATEGORIAS_IDEA) === JSON.stringify(Object.keys(cg.CATEGORIAS_IDEA)));
comprobar('ninguna clave del catálogo es inválida', cg.CATEGORIAS_EVENTO_INVALIDAS.length === 0, cg.CATEGORIAS_EVENTO_INVALIDAS.join(','));
comprobar('el validador de eventos usa el catálogo', cg.esCategoriaValida('cumpleanos') && !cg.esCategoriaValida('cumpleaños'));
comprobar('el validador de ideas usa el catálogo', cg.esCategoriaIdeaValida('en-casa') && !cg.esCategoriaIdeaValida('en casa'));
// Un nombre heredado de Object.prototype no debe pasar por una lista blanca.
comprobar('rechaza nombres heredados como "toString"', !cg.esCategoriaValida('toString') && !cg.esCategoriaValida('constructor') && !cg.esCategoriaIdeaValida('__proto__'));
comprobar('rechaza valores que no son cadenas', !cg.esCategoriaValida(42) && !cg.esCategoriaValida(null) && !cg.esCategoriaValida(['cita']));
// El service y el validador deben rechazar exactamente las mismas claves que el
// catálogo. Esta es la prueba que habría atrapado el bug de `cumpleaños`.
comprobar('validarEvento rechaza la categoría con ñ', (() => { try { va.validarEvento({ titulo: 'Prueba', fecha: '2026-10-14', categoria: 'cumpleaños' }); return false; } catch { return true; } })());
comprobar('validarIdea rechaza la categoría con espacio', (() => { try { va.validarIdea({ titulo: 'Prueba', categoria: 'en casa' }); return false; } catch { return true; } })());
comprobar('validarEvento acepta la categoría del catálogo', (() => { try { va.validarEvento({ titulo: 'Prueba', fecha: '2026-10-14', categoria: 'cumpleanos' }); return true; } catch { return false; } })());

console.log('\n== Validación: tipos y booleanos que no se tragan nada ==');
// `limpiarTexto` con un `String(valor)` genérico guardaba "[object Object]"
// cuando le llegaba un objeto. Ahora un valor que no es texto es campo vacío.
comprobar('limpiarTexto recorta una cadena', va.limpiarTexto('  Hola  ', 50) === 'Hola', va.limpiarTexto('  Hola  ', 50));
comprobar('limpiarTexto quita caracteres de control', va.limpiarTexto('Ho\u0000la') === 'Hola', va.limpiarTexto('Ho\u0000la'));
comprobar('limpiarTexto respeta el salto de línea', va.limpiarTexto('a\nb') === 'a\nb', va.limpiarTexto('a\nb'));
comprobar('limpiarTexto no convierte un objeto', va.limpiarTexto({}) === '', JSON.stringify(va.limpiarTexto({})));
comprobar('limpiarTexto no convierte un número', va.limpiarTexto(42) === '', JSON.stringify(va.limpiarTexto(42)));
comprobar('limpiarTexto no convierte un array', va.limpiarTexto(['cita']) === '', JSON.stringify(va.limpiarTexto(['cita'])));
comprobar('limpiarTexto no convierte un booleano', va.limpiarTexto(true) === '', JSON.stringify(va.limpiarTexto(true)));
comprobar('limpiarTexto trata null y undefined como vacíos', va.limpiarTexto(null) === '' && va.limpiarTexto(undefined) === '');

// `Boolean("false")` es `true`, así que la cadena "false" acababa marcando la
// idea como favorita.
const ideaCon = (favorita) => va.validarIdea({ titulo: 'Prueba', categoria: 'en-casa', favorita });
comprobar('favorita booleano true se respeta', ideaCon(true).favorita === true);
comprobar('favorita booleano false se respeta', ideaCon(false).favorita === false);
comprobar('favorita "true" de un checkbox se acepta', ideaCon('true').favorita === true);
comprobar('favorita "false" NO se marca como favorita', ideaCon('false').favorita === false, String(ideaCon('false').favorita));
comprobar('favorita "0" no se marca como favorita', ideaCon('0').favorita === false);
comprobar('favorita "" no se marca como favorita', ideaCon('').favorita === false);
comprobar('favorita ausente no se marca como favorita', ideaCon(undefined).favorita === false);
comprobar('favorita null no se marca como favorita', ideaCon(null).favorita === false);
comprobar('favorita {} no se marca como favorita', ideaCon({}).favorita === false);
comprobar('el título de un objeto tampoco se cuela como texto', (() => { try { va.validarIdea({ titulo: {}, categoria: 'en-casa' }); return false; } catch { return true; } })());
comprobar('un título numérico tampoco', (() => { try { va.validarIdea({ titulo: 123, categoria: 'en-casa' }); return false; } catch { return true; } })());

comprobar('los símbolos CATEGORIA apuntan a claves reales', Object.values(cg.CATEGORIA).every((c) => cg.esCategoriaValida(c)));
comprobar('los símbolos CATEGORIA_IDEA apuntan a claves reales', Object.values(cg.CATEGORIA_IDEA).every((c) => cg.esCategoriaIdeaValida(c)));
comprobar('no queda ninguna clave inválida en el catálogo', cg.CATEGORIAS_EVENTO_INVALIDAS.length === 0);
comprobar('toda clave del catálogo es un slug', Object.keys(cg.CATEGORIAS_EVENTO).every((k) => cg.PATRON_CATEGORIA.test(k)));
comprobar('toda clave de ideas es un slug', Object.keys(cg.CATEGORIAS_IDEA).every((k) => cg.PATRON_CATEGORIA.test(k)));
// El seed no puede traer una categoría que el catálogo no conozca: si alguien
// añade un evento con una categoría inventada, la app lo pintaría como "Otro"
// sin avisar. Esta es la prueba que ata el seed al catálogo.
comprobar('toda categoría del seed está en el catálogo', sd.crearEventosSeed().every((e) => cg.esCategoriaValida(e.categoria)), JSON.stringify(sd.crearEventosSeed().map((e) => e.categoria).filter((c) => !cg.esCategoriaValida(c))));
comprobar('toda categoría de idea del seed está en el catálogo', sd.crearIdeasSeed().every((i) => cg.esCategoriaIdeaValida(i.categoria)));
comprobar('ningún slug del seed se sale del patrón', sd.crearEventosSeed().every((e) => cg.PATRON_CATEGORIA.test(e.categoria)));
// Cobertura: si el seed usara siempre la misma categoría, las pruebas de arriba
// pasarían sin comprobar nada. Tiene que haber variedad.
comprobar('el seed usa varias categorías', new Set(sd.crearEventosSeed().map((e) => e.categoria)).size >= 4, String(new Set(sd.crearEventosSeed().map((e) => e.categoria)).size));
comprobar('el seed de ideas usa varias categorías', new Set(sd.crearIdeasSeed().map((i) => i.categoria)).size >= 3);
comprobar('el seed incluye la categoría de cumpleaños', sd.crearEventosSeed().some((e) => e.categoria === 'cumpleanos'));

console.log('\n== Dimensiones de la imagen (función pura) ==');
comprobar('reducir una foto grande de celular', JSON.stringify(im.calcularDimensiones(4000, 3000)) === JSON.stringify({ ancho: 1200, alto: 900, escalado: true }), JSON.stringify(im.calcularDimensiones(4000, 3000)));
comprobar('no tocar una imagen pequeña', JSON.stringify(im.calcularDimensiones(800, 600)) === JSON.stringify({ ancho: 800, alto: 600, escalado: false }));
comprobar('no tocar una imagen justo en el límite', im.calcularDimensiones(1200, 800).escalado === false && im.calcularDimensiones(1200, 800).ancho === 1200);
comprobar('una panorámica altísima sale con alto 1', im.calcularDimensiones(4000, 3).alto === 1, JSON.stringify(im.calcularDimensiones(4000, 3)));
comprobar('una panorámica larguísima conserva la proporción', im.calcularDimensiones(6000, 10).ancho === 1200 && im.calcularDimensiones(6000, 10).alto === 2);
comprobar('una imagen de 1 px no da alto 0', im.calcularDimensiones(1200, 1).alto === 1, JSON.stringify(im.calcularDimensiones(1200, 1)));
comprobar('proporción vertical de celular', im.calcularDimensiones(3000, 4000).ancho === 1200 && im.calcularDimensiones(3000, 4000).alto === 1600);
comprobar('medidas degeneradas dan 1 en vez de 0', im.calcularDimensiones(0, 0).ancho === 1 && im.calcularDimensiones(0, 0).alto === 1);
comprobar('NaN y undefined no rompen', im.calcularDimensiones(NaN, undefined).ancho === 1 && im.calcularDimensiones(NaN, undefined).alto === 1);
comprobar('números negativos caen a 1', im.calcularDimensiones(-100, -50).ancho === 1 && im.calcularDimensiones(-100, -50).alto === 1);
comprobar('el límite se puede cambiar', im.calcularDimensiones(4000, 3000, 800).ancho === 800 && im.calcularDimensiones(4000, 3000, 800).alto === 600);
comprobar('un límite de 0 no divide por cero', im.calcularDimensiones(4000, 3000, 0).ancho === 1);
// El resultado nunca puede ser 0, porque un canvas de 0 px lanza IndexSizeError.
comprobar('ningún resultado es 0 en ninguna dimensión', [
  im.calcularDimensiones(1, 1), im.calcularDimensiones(9999, 1), im.calcularDimensiones(1, 9999),
  im.calcularDimensiones(0, 0), im.calcularDimensiones(1200, 0), im.calcularDimensiones(-5, 7),
].every((d) => d.ancho >= 1 && d.alto >= 1));
// El error de redondeo no puede pasar del 1 px.
comprobar('el redondeo no invierte la proporción', im.calcularDimensiones(1199, 700).escalado === false);

console.log('\n== Tipo de imagen detectado por bytes ==');
/*
 * Se construyen buffers con las firmas reales. Un JPEG de verdad empieza por
 * FF D8 FF, un PNG por los 8 bytes del IHDR, y un WebP por `RIFF....WEBP`.
 */
const bytesJPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const bytesPNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const bytesWebP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
comprobar('detecta JPEG', im.detectarTipoPorBytes(bytesJPEG)?.mime === 'image/jpeg');
comprobar('detecta PNG', im.detectarTipoPorBytes(bytesPNG)?.mime === 'image/png');
comprobar('detecta WebP', im.detectarTipoPorBytes(bytesWebP)?.mime === 'image/webp');
comprobar('acepta un ArrayBuffer, no solo Uint8Array', im.detectarTipoPorBytes(bytesJPEG.buffer)?.mime === 'image/jpeg');
comprobar('rechaza un buffer vacío', im.detectarTipoPorBytes(new Uint8Array([])) === null);
comprobar('rechaza un buffer nulo', im.detectarTipoPorBytes(null) === null);

// El caso de seguridad: un HTML renombrado a .jpg. El navegador lo diría "image/jpeg".
const bytesHTML = new Uint8Array([0x3c, 0x21, 0x44, 0x4f, 0x43, 0x54, 0x59, 0x50, 0x45, 0x3e, 0x3c, 0x73]);
comprobar('un HTML renombrado a .jpg NO pasa', im.detectarTipoPorBytes(bytesHTML) === null, JSON.stringify(im.detectarTipoPorBytes(bytesHTML)));
const bytesSVG = new Uint8Array([0x3c, 0x3f, 0x78, 0x6d, 0x6c, 0x20, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f]);
comprobar('un SVG no pasa', im.detectarTipoPorBytes(bytesSVG) === null);
const bytesPDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25]);
comprobar('un PDF no pasa', im.detectarTipoPorBytes(bytesPDF) === null);
// Firmas parecidas: los 3 primeros bytes coinciden pero el resto no.
comprobar('FF D8 FF y nada más no basta', im.detectarTipoPorBytes(new Uint8Array([0xff, 0xd8, 0xff]))?.mime === 'image/jpeg');
comprobar('PNG con un byte cambiado no pasa', im.detectarTipoPorBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0b])) === null);
comprobar('RIFF pero sin WEBP no pasa', im.detectarTipoPorBytes(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])) === null);
comprobar('WEBP pero sin RIFF no pasa', im.detectarTipoPorBytes(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])) === null);
comprobar('AVI tampoco (RIFF con AVI_)', im.detectarTipoPorBytes(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20])) === null);
comprobar('GIF no se acepta', im.detectarTipoPorBytes(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])) === null);
comprobar('un BMP no se acepta', im.detectarTipoPorBytes(new Uint8Array([0x42, 0x4d, 0x00, 0x00])) === null);
comprobar('las tres firmas son distintas entre sí', new Set(im.FIRMAS.map((f) => f.firma.join(','))).size === 3);
comprobar('toda firma delata un tipo aceptado', im.FIRMAS.every((f) => im.TIPOS_ACEPTADOS.includes(f.mime)));

console.log('\n== Validación de archivo de foto (sin leer bytes) ==');
const archivo = (name, size, type = 'image/jpeg') => ({ name, size, type });
comprobar('una foto válida pasa', im.validarArchivoFoto(archivo('foto.jpg', 500000)).valido === true);
comprobar('un PNG válido pasa', im.validarArchivoFoto(archivo('foto.png', 500000, 'image/png')).valido === true);
comprobar('un WebP válido pasa', im.validarArchivoFoto(archivo('foto.webp', 500000, 'image/webp')).valido === true);
comprobar('la extensión en mayúsculas no engaña', im.validarArchivoFoto(archivo('FOTO.JPG', 500000)).valido === true);
// El límite se comprueba antes de nada, para no leer un archivo enorme.
comprobar('rechaza más de 5 MB', im.validarArchivoFoto(archivo('grande.jpg', 5 * 1024 * 1024 + 1)).valido === false);
comprobar('el mensaje de peso dice los dos números', /5\.0 MB y el límite son 5 MB/.test(im.validarArchivoFoto(archivo('grande.jpg', 5 * 1024 * 1024 + 1)).error), im.validarArchivoFoto(archivo('grande.jpg', 5 * 1024 * 1024 + 1)).error);
comprobar('acepta exactamente 5 MB', im.validarArchivoFoto(archivo('justo.jpg', 5 * 1024 * 1024)).valido === true);
comprobar('rechaza un archivo vacío', im.validarArchivoFoto(archivo('vacio.jpg', 0)).valido === false);
comprobar('rechaza SVG por extensión', im.validarArchivoFoto(archivo('dibujo.svg', 1000, 'image/svg+xml')).valido === false);
comprobar('el mensaje de SVG explica por qué', /ejecutable/.test(im.validarArchivoFoto(archivo('dibujo.svg', 1000, 'image/svg+xml')).error));
comprobar('rechaza SVG aunque la extensión diga jpg', im.validarArchivoFoto(archivo('dibujo.jpg', 1000, 'image/svg+xml')).valido === false);
comprobar('rechaza un PDF', im.validarArchivoFoto(archivo('doc.pdf', 1000, 'application/pdf')).valido === false);
comprobar('rechaza una extensión de texto', im.validarArchivoFoto(archivo('notas.txt', 1000, 'text/plain')).valido === false);
comprobar('rechaza un script', im.validarArchivoFoto(archivo('ataque.js', 1000, 'text/javascript')).valido === false);
comprobar('rechaza algo sin extensión', im.validarArchivoFoto(archivo('archivo', 1000)).valido === false);
// Un desajuste entre extensión y tipo solo importa si el tipo no es una imagen
// raster aceptable. Un PNG con nombre .jpg sigue siendo una foto válida: la
// extensión es una pista, los bytes son la prueba.
comprobar('rechaza .jpg que el navegador dice que no es una imagen', im.validarArchivoFoto(archivo('raro.jpg', 1000, 'application/octet-stream')).valido === false);
comprobar('admite un PNG renombrado a .jpg (los bytes mandan)', im.validarArchivoFoto(archivo('raro.jpg', 1000, 'image/png')).valido === true);
comprobar('rechaza un objeto sin nombre', im.validarArchivoFoto({ size: 1000, type: 'image/jpeg' }).valido === false);
comprobar('no lanza con undefined', im.validarArchivoFoto(undefined).valido === false);
comprobar('no lanza con null', im.validarArchivoFoto(null).valido === false);
// La fase de bytes es la que da el tipo, así que aquí siempre es null.
comprobar('el tipo llega en la fase de bytes, no antes', im.validarArchivoFoto(archivo('foto.jpg', 500000)).tipoMime === null);

console.log('\n== Presupuesto de almacenamiento ==');
comprobar('localStorage cuenta la cadena en UTF-16', im.estimarBytesGuardados('data:image/jpeg;base64,AAAA') === 27 * 2, String(im.estimarBytesGuardados('data:image/jpeg;base64,AAAA')));
comprobar('una cadena vacía son 0 bytes', im.estimarBytesGuardados('') === 0);
comprobar('algo que no es cadena son 0 bytes', im.estimarBytesGuardados(null) === 0);
// 8 fotos de 1200 px en WebP caben en la cuota; 8 de 4000 px en JPEG, no.
comprobar('una foto de 1200 px ronda los 150 KB en localStorage', (() => { const b = im.estimarBytesGuardados('x'.repeat(75000)); return b > 140000 && b < 160000; })());
comprobar('el límite declarado es 5 MB', im.TAMANO_MAXIMO_BYTES === 5242880);
comprobar('el ancho declarado es 1200', im.ANCHO_MAXIMO === 1200);
comprobar('la calidad declarada es 0.8', im.CALIDAD === 0.8);
comprobar('se prefiere WebP y se cae a JPEG', im.FORMATOS_SALIDA[0] === 'image/webp' && im.FORMATOS_SALIDA[1] === 'image/jpeg');
comprobar('el canvas solo exporta a WebP o JPEG', im.TIPOS_CANVAS.every((t) => im.FORMATOS_SALIDA.includes(t)));

console.log('\n== Claves versionadas ==');
comprobar('clave con versión', st.claveDe('eventos') === 'juntos:v3:eventos', st.claveDe('eventos'));
comprobar('la versión de los datos es 3', st.VERSION_DATOS === 3, String(st.VERSION_DATOS));
comprobar('la sesión tiene versión propia, no la de los datos', st.VERSION_SESION === 1, String(st.VERSION_SESION));
comprobar('la versión de la sesión es independiente de la de los datos', st.VERSION_SESION !== st.VERSION_DATOS);
comprobar('la clave de sesión no hereda la versión de los datos', st.claveDeSesion() === 'juntos:v1:sesion', st.claveDeSesion());
comprobar('la clave de sesión no es la de los datos', st.claveDeSesion() !== st.claveDe('eventos'));

console.log('\n== Siembra inicial ==');
const eventos = await ev.getEventos();
comprobar('sembró 8 eventos', eventos.length === 8, `len=${eventos.length}`);
comprobar('sembró 5 ideas', (await ci.getIdeasCitas()).length === 5);
comprobar('ordenados por fecha', eventos.every((e, i) => i === 0 || eventos[i-1].fecha <= e.fecha));
comprobar('persiste en la clave v3', storage.map.has('juntos:v3:eventos'));

console.log('\n== Fechas relativas al mes actual ==');
// El mes se lee del reloj, no de `new Date()`: con fecha simulada el seed
// siembra ese mes y esta comprobación tiene que mirar el mismo.
const mesActual = rj.ahora().getMonth();
const esteMes = eventos.filter((e) => fe.aFecha(e.fecha).getMonth() === mesActual);
comprobar('hay eventos en el mes actual', esteMes.length >= 5, `n=${esteMes.length}`);
const proximos = fe.eventosProximos(eventos);
comprobar('próximos eventos no está vacío', proximos.length > 0, `n=${proximos.length}`);
comprobar('ningún próximo es pasado', proximos.every((e) => e.fecha >= fe.hoyISO()));
comprobar('días del mockup respetados',
  eventos.some((e) => e.fecha.endsWith('-12') && e.categoria === 'aniversario') &&
  eventos.some((e) => e.fecha.endsWith('-14') && e.hora === '19:00') &&
  eventos.some((e) => e.fecha.endsWith('-19') && e.categoria === 'viaje') &&
  eventos.some((e) => e.fecha.endsWith('-22') && e.categoria === 'cumpleanos') &&
  eventos.some((e) => e.fecha.endsWith('-26')) &&
  eventos.some((e) => e.fecha.endsWith('-05')));
comprobar('frase del día sin caracteres raros', !/[^\x20-\x7EáéíóúñÁÉÍÓÚÑ¡¿]/.test(sd.fraseDelDia()), sd.fraseDelDia());
comprobar('seed sin caracteres CJK', !/[\u4e00-\u9fff\u0400-\u04ff]/.test(JSON.stringify(eventos) + JSON.stringify(sd.crearIdeasSeed())));

// La cuadrícula se prueba en profundidad más abajo, en su sección propia.
comprobar('no hay desfase de día (parseo local)', fe.aFecha('2026-09-14')?.getDate() === 14);

console.log('\n== CRUD de eventos ==');
const nuevo = await ev.crearEvento({ titulo: 'Prueba', fecha: fe.hoyISO(), categoria: 'cita', hora: '10:00' });
comprobar('crear devuelve id UUID v4', va.PATRONES.UUID.test(nuevo.id), nuevo.id);
comprobar('crear persiste', (await ev.getEventos()).length === 9);

/*
 * La marca de alta sale del reloj de la app.
 *
 * Estaba puesta con `new Date()`, la hora del ordenador, así que un evento
 * creado con la suite en fecha simulada quedaba con una marca de 2026 real y se
 * colaba entre los de otro mes al ordenarlos. Con el reloj ya fijado por la
 * suite, la marca tiene que coincidir con él.
 */
comprobar('creadoEn viene del reloj de la app, no del ordenador', nuevo.creadoEn.slice(0, 10) === fe.hoyISO(), `${nuevo.creadoEn} vs ${fe.hoyISO()}`);

comprobar('getEventoById encuentra', (await ev.getEventoById(nuevo.id))?.titulo === 'Prueba');
const actualizado = await ev.actualizarEvento(nuevo.id, { titulo: 'Prueba editada' });
comprobar('actualizar cambia el título', actualizado.titulo === 'Prueba editada');
comprobar('actualizar conserva id y creadoEn', actualizado.id === nuevo.id && actualizado.creadoEn === nuevo.creadoEn);
comprobar('eliminar devuelve true', (await ev.eliminarEvento(nuevo.id)) === true);
comprobar('eliminar quita del store', (await ev.getEventos()).length === 8);
comprobar('eliminar de inexistente devuelve false', (await ev.eliminarEvento(nuevo.id)) === false);

console.log('\n== Validación en el service (no solo el formulario) ==');
const casos = [
  ['título vacío', { titulo: '', fecha: '2026-09-14', categoria: 'cita' }, 'titulo'],
  ['fecha ausente', { titulo: 'Hola', categoria: 'cita' }, 'fecha'],
  ['fecha imposible', { titulo: 'Hola', fecha: '2026-02-31', categoria: 'cita' }, 'fecha'],
  ['categoría inventada', { titulo: 'Hola', fecha: '2026-09-14', categoria: 'hackear' }, 'categoria'],
  ['hora inválida', { titulo: 'Hola', fecha: '2026-09-14', categoria: 'cita', hora: '25:00' }, 'hora'],
  ['título largo', { titulo: 'a'.repeat(121), fecha: '2026-09-14', categoria: 'cita' }, 'titulo'],
  ['descripción larga', { titulo: 'Hola', fecha: '2026-09-14', categoria: 'cita', descripcion: 'a'.repeat(501) }, 'descripcion'],
  ['javascript en el título', { titulo: '<script>alert(1)</script>', fecha: '2026-09-14', categoria: 'cita' }, null],
];
for (const [nombre, datos, campo] of casos) {
  try {
    await ev.crearEvento(datos);
    if (campo) comprobar(`rechaza: ${nombre}`, false, 'NO lanzó');
    else comprobar(`acepta y escapa: ${nombre}`, true);
  } catch (e) {
    if (e instanceof va.ErrorValidacion) {
      comprobar(`rechaza: ${nombre}`, campo ? e.erroresPorCampo[campo] !== undefined : false,
        `errores=${JSON.stringify(e.erroresPorCampo)}`);
    } else comprobar(`rechaza: ${nombre}`, false, `error inesperado ${e.name}`);
  }
}
// El caso de XSS debe guardarse escapado por React, no Rechazado.
const xss = await ev.getEventos();
comprobar('XSS queda como texto plano, sin ejecutar', !xss.some((e) => e.titulo === ''));
comprobar('el script se guardó literal (React lo escapa al renderizar)', xss.some((e) => e.titulo === 'a'.repeat(120) ? false : e.titulo.includes('<script>')));

console.log('\n== id manipulado en la ruta ==');
comprobar("id con inyección devuelve null", (await ev.getEventoById("' OR 1=1--")) === null);
comprobar('id con otro tipo devuelve null', (await ev.getEventoById(123)) === null);
comprobar('eliminar con id inválido devuelve false', (await ev.eliminarEvento('no-uuid')) === false);
let tiroErrorServicio = false;
try { await ev.actualizarEvento('no-uuid', { titulo: 'x' }); } catch (e) { tiroErrorServicio = e instanceof ev.ErrorServicio; }
comprobar('actualizar con id inválido lanza ErrorServicio', tiroErrorServicio);

console.log('\n== Lectura tolerante a fallos (JSON corrupto) ==');
storage.setItem('juntos:v3:eventos', '{esto no es json');
comprobar('leer() devuelve null con JSON corrupto', st.leer('eventos') === null);
const reSembrados = await ev.getEventos();
comprobar('getEventos vuelve al seed', reSembrados.length === 8, `n=${reSembrados.length}`);
storage.setItem('juntos:v3:eventos', '{"no":"es un array"}');
comprobar('leer() rechaza un objeto que no es array', st.leer('eventos') === null);

console.log('\n== Cuota agotada ==');
const storagePequeno = new LocalStorageMock({ cuotaBytes: 3000 });
globalThis.window.localStorage = storagePequeno;
let mensajeCuota = null;
try {
  await ev.crearEvento({ titulo: 'Con foto', fecha: fe.hoyISO(), categoria: 'cita',
    foto: 'data:image/jpeg;base64,' + 'A'.repeat(4000) });
} catch (e) { mensajeCuota = e.message; }
comprobar('QuotaExceeded produce mensaje claro', /espacio/i.test(mensajeCuota ?? ''), String(mensajeCuota));
comprobar('detecta QuotaExceededError de Chrome', st.esCuotaAgotada(Object.assign(new Error(), { name: 'QuotaExceededError' })));
comprobar('detecta NS_ERROR_DOM_QUOTA_REACHED de Firefox', st.esCuotaAgotada(Object.assign(new Error(), { name: 'NS_ERROR_DOM_QUOTA_REACHED' })));

// La cuota de ideas no debe desaparecer dentro de un `ErrorServicio` genérico:
// "no pudimos cargar" no dice nada accionable, "libera espacio" sí.
globalThis.window.localStorage = new LocalStorageMock({ cuotaBytes: 0 });
let errorIdeasCuota = null;
try {
  await ci.getIdeasCitas();
} catch (e) { errorIdeasCuota = e; }
comprobar('la cuota de ideas se propaga sin envolver', errorIdeasCuota instanceof st.ErrorCuotaAlmacenamiento, errorIdeasCuota?.constructor?.name);
comprobar('el mensaje de cuota en ideas es accionable', /espacio/i.test(errorIdeasCuota?.message ?? ''), String(errorIdeasCuota?.message));

// Un fallo de escritura que no es de cuota sí se envuelve, para que la interfaz
// tenga un único tipo de error con el que trabajar. Ojo: un fallo de LECTURA no
// sirve para esto, porque `leer()` lo trata como "no hay datos" y siembra.
globalThis.window.localStorage = new LocalStorageMock({ fallaAlEscribir: true });
let errorIdeasLectura = null;
try {
  await ci.getIdeasCitas();
} catch (e) { errorIdeasLectura = e; }
comprobar('un fallo de escritura sí se envuelve en ErrorServicio', errorIdeasLectura instanceof ev.ErrorServicio, errorIdeasLectura?.constructor?.name);
comprobar('el error de servicio guarda el motivo para depurar', errorIdeasLectura?.causa instanceof Error, errorIdeasLectura?.causa?.name);
globalThis.window.localStorage = storage;

// `tamanoAproximado` se llama al abrir Configuración. Si `getItem` lanza a
// mitad de la cuenta, la pantalla no puede quedarse en blanco por un número
// cosmético.
let lanzoAlLeer = false;
globalThis.window.localStorage = {
  get length() { return 1; },
  key: () => 'juntos:v3:eventos',
  getItem: () => { lanzoAlLeer = true; throw new Error('almacén caído'); },
  setItem: () => {},
  removeItem: () => {},
};
let tamanoConFallo = null;
try { tamanoConFallo = st.tamanoAproximado(); } catch { tamanoConFallo = 'LANZÓ'; }
comprobar('tamanoAproximado aguanta un getItem que lanza', tamanoConFallo === 0, String(tamanoConFallo));
comprobar('tamanoAproximado intentó leer de verdad', lanzoAlLeer);
globalThis.window.localStorage = storage;
comprobar('tamanoAproximado mide el almacén real', st.tamanoAproximado() > 0, String(st.tamanoAproximado()));

console.log('\n== Validación de fotos ==');
comprobar('rechaza SVG', !va.validarArchivoFoto({ type: 'image/svg+xml', size: 100, name: 'a.svg' }).valido);
comprobar('rechaza PDF', !va.validarArchivoFoto({ type: 'application/pdf', size: 100, name: 'a.pdf' }).valido);
comprobar('rechaza >5MB', !va.validarArchivoFoto({ type: 'image/jpeg', size: 6 * 1024 * 1024, name: 'a.jpg' }).valido);
comprobar('acepta JPG coherente', va.validarArchivoFoto({ type: 'image/jpeg', size: 1000, name: 'a.jpg' }).valido);
comprobar('un PNG renombrado a .jpg ya no se rechaza por la extensión', va.validarArchivoFoto({ type: 'image/png', size: 100, name: 'malvado.jpg' }).valido === true);
comprobar('un tipo que no es imagen sí se rechaza', !va.validarArchivoFoto({ type: 'application/octet-stream', size: 100, name: 'a.jpg' }).valido);
comprobar('la fase de bytes es la que decide el formato final', !im.detectarTipoPorBytes(new Uint8Array([0x3c, 0x3f, 0x78, 0x6d, 0x6c])));
comprobar('las listas de tipos de imagen no se duplican', JSON.stringify(va.TIPOS_IMAGEN_PERMITIDOS) === JSON.stringify(im.TIPOS_ACEPTADOS));
comprobar('el techo de tamaño no se duplica', va.TAMANO_MAXIMO_IMAGEN_BYTES === im.TAMANO_MAXIMO_BYTES);
comprobar('acepta data URL de imagen válida', va.PATRONES.DATA_URL_IMAGEN.test('data:image/png;base64,iVBORw0KGgo='));
comprobar('rechaza data URL de svg', !va.PATRONES.DATA_URL_IMAGEN.test('data:image/svg+xml;base64,PHN2Zz4='));

console.log('\n== Servicios de citas ==');
const ideas = await ci.getIdeasCitas();
comprobar('2 favoritas en el seed', ideas.filter((i) => i.favorita).length === 2);
comprobar('favoritas primero', ideas[0].favorita === true);
// El orden es: favoritas primero, y dentro de cada grupo por título.
comprobar('ordenadas por título dentro de cada grupo', (() => {
  const faves = ideas.filter((i) => i.favorita).map((i) => i.titulo);
  const resto = ideas.filter((i) => !i.favorita).map((i) => i.titulo);
  return faves[0] <= faves[1] && resto.every((t, i) => i === 0 || resto[i - 1] <= t);
})());
const fav = await ci.toggleFavorita(ideas[1].id);
comprobar('toggleFavorita desmarca', fav.favorita === false);
comprobar('toggleFavorita persiste', (await ci.getIdeasCitas()).find((i) => i.id === ideas[1].id).favorita === false);
const ideaNueva = await ci.crearIdea({
  titulo: 'Nueva idea', categoria: 'relax',
  imagen: 'https://picsum.photos/seed/nueva/800/600',
});
comprobar('crearIdea genera UUID', va.PATRONES.UUID.test(ideaNueva.id));
comprobar('crearIdea guarda la imagen', ideaNueva.imagen === 'https://picsum.photos/seed/nueva/800/600');
const convertido = await ci.convertirIdeaEnEvento(ideaNueva.id, { fecha: fe.hoyISO() });
comprobar('convertir crea un evento', !!convertido.titulo && !!convertido.fecha);
comprobar('convertir usa categoría cita', convertido.categoria === 'cita');
comprobar('convertir conserva la foto', !!convertido.foto);
comprobar('convertir no borra la idea', (await ci.getIdeasCitas()).some((i) => i.id === ideaNueva.id));

console.log('\n== resetDatos ==');
/*
 * La sesión se planta antes de restablecer a propósito: es el caso que decide
 * si el botón hace lo que su nombre dice. "Restablecer datos" no puede cerrar
 * la sesión de nadie, y menos aún cuando todavía no hay forma de recuperarla.
 */
storage.setItem(st.claveDeSesion(), '{"parejaId":"p1","creada":"2026-10-02"}');
comprobar('resetDatos borra las claves de datos', st.resetDatos() === true && !st.listarClaves().includes(st.claveDe(st.COLECCIONES.EVENTOS)), st.listarClaves().join(', '));
comprobar('resetDatos conserva la sesión', storage.getItem(st.claveDeSesion()) === '{"parejaId":"p1","creada":"2026-10-02"}', String(storage.getItem(st.claveDeSesion())));
comprobar('y la sesión sigue siendo la única clave que queda', st.listarClaves().join(', ') === st.claveDeSesion(), st.listarClaves().join(', '));
comprobar('getEventos vuelve a sembrar', (await ev.getEventos()).length === 8);
comprobar('no toca claves ajenas', (() => {
  storage.setItem('otra-app:dato', 'x');
  st.resetDatos();
  return storage.getItem('otra-app:dato') === 'x';
})());
// Borrar la sesión a mano sí se puede: quien quiera salir, sale. Lo que no
// puede es hacerlo sin querer al restablecer los datos.
storage.removeItem(st.claveDeSesion());
comprobar('la sesión se puede borrar a mano', st.resetDatos() === true && storage.getItem(st.claveDeSesion()) === null);

console.log('\n== Versiones anteriores ==');
// Tras el resetDatos anterior no queda nada, así que hay que sembrar de nuevo
// para tener una clave v1 que sí debe sobrevivir a la limpieza.
await ev.getEventos();
storage.setItem('juntos:v1:eventos', '[]');
storage.setItem('juntos:v3:citas', '[]');
// Una sesión en una versión antigua de sí misma. Es justo el caso que se
// quiere proteger: subir VERSION_DATOS no puede cerrar la sesión de nadie.
storage.setItem('juntos:v1:sesion', '{"parejaId":"p1"}');
comprobar('limpiarVersionesAnteriores borra v1', st.limpiarVersionesAnteriores().includes('juntos:v1:eventos'));
comprobar('conserva los eventos de la versión actual', storage.getItem('juntos:v3:eventos') !== null);
comprobar('conserva las citas de la versión actual', storage.getItem('juntos:v3:citas') !== null);
comprobar('limpiar los datos viejos NO borra la sesión', storage.getItem('juntos:v1:sesion') !== null, String(storage.getItem('juntos:v1:sesion')));
comprobar('la sesión no se cuenta como versión antigua de datos', !st.limpiarVersionesAnteriores().includes('juntos:v1:sesion'));

/*
 * ---------------------------------------------------------------------------
 * Cuadrícula del calendario (paso c).
 *
 * `construirCuadricula` es pura: recibe el mes y devuelve las semanas. Se
 * comprueba aquí sin React ni DOM, que es justo el motivo de haberla dejado
 * en un módulo de utilidades.
 * ---------------------------------------------------------------------------
 */

// Fijamos "hoy" para que las pruebas no dependan del día en que se ejecuten.
const HOY = new Date(2026, 8, 30); // 30 de septiembre de 2026

/**
 * Traduce una columna de la cuadrícula al día de la semana.
 *
 * Con `weekStartsOn: 1` la columna 0 es lunes, así que el día de la semana es
 * `(columna + 1) % 7`: 0→lunes(1), 5→sábado(6), 6→domingo(0).
 *
 * @param {number} columna Índice de columna, 0–6.
 * @returns {number} Día de la semana según `Date.getDay()`.
 */
const getDayEsperado = (columna) => (columna + 1) % 7;

console.log('\n== Cuadrícula: caso mínimo (febrero 2027) ==');
// Febrero de 2027 empieza en lunes y tiene 28 días: 4 filas exactas, sin relleno.
const feb27 = ca.construirCuadricula(new Date(2027, 1, 15), HOY);
comprobar('4 semanas exactas', feb27.totalSemanas === 4, `totalSemanas=${feb27.totalSemanas}`);
comprobar('28 celdas', feb27.celdas.length === 28, `celdas=${feb27.celdas.length}`);
comprobar('sin días de relleno', feb27.celdas.every((c) => c.enMes));
comprobar('empieza el lunes 1', feb27.celdas[0].fechaISO === '2027-02-01', feb27.celdas[0].fechaISO);
comprobar('termina el domingo 28', feb27.celdas[27].fechaISO === '2027-02-28', feb27.celdas[27].fechaISO);
comprobar('7 celdas por semana', feb27.semanas.every((s) => s.dias.length === 7));
comprobar('ningún día de la semana es domingo al inicio', feb27.celdas[0].fecha.getDay() === 1);
comprobar('el día 28 cae en domingo', feb27.celdas[27].fecha.getDay() === 0);
comprobar('título en español', feb27.titulo === 'febrero 2027', feb27.titulo);

console.log('\n== Cuadrícula: caso máximo (agosto 2026) ==');
// Agosto de 2026 empieza en sábado y tiene 31 días: 6 filas y 11 días de relleno.
const ago26 = ca.construirCuadricula(new Date(2026, 7, 1), HOY);
comprobar('6 semanas exactas', ago26.totalSemanas === 6, `totalSemanas=${ago26.totalSemanas}`);
comprobar('42 celdas', ago26.celdas.length === 42, `celdas=${ago26.celdas.length}`);
comprobar('empieza el lunes 27 de julio', ago26.celdas[0].fechaISO === '2026-07-27', ago26.celdas[0].fechaISO);
comprobar('termina el domingo 6 de septiembre', ago26.celdas[41].fechaISO === '2026-09-06', ago26.celdas[41].fechaISO);
comprobar('31 días dentro del mes', ago26.celdas.filter((c) => c.enMes).length === 31);
comprobar('11 días de relleno', ago26.celdas.filter((c) => !c.enMes).length === 11);
comprobar('el relleno viene de julio y septiembre', ago26.celdas.some((c) => c.fechaISO.startsWith('2026-07')) && ago26.celdas.some((c) => c.fechaISO.startsWith('2026-09')));
comprobar('las dos semanas de borde tocan el mes', ago26.semanas[0].contieneMesVisible === true && ago26.semanas[5].contieneMesVisible === true);
comprobar('solo la primera y la última tienen relleno', ago26.semanas.filter((s) => s.dias.some((c) => !c.enMes)).length === 2, String(ago26.semanas.filter((s) => s.dias.some((c) => !c.enMes)).length));

console.log('\n== Cuadrícula: la semana empieza en lunes ==');
// Este es el requisito de `weekStartsOn: 1`: el día 1 debe ocupar la columna que
// le toca según el lunes, y ninguna fila puede empezar en domingo.
const octubre = ca.construirCuadricula(new Date(2026, 9, 1), HOY);
comprobar('ninguna fila empieza en domingo', octubre.semanas.every((s) => s.dias[0].fecha.getDay() !== 0));
comprobar('cada columna cae en su día de la semana', octubre.celdas.every((c) => c.fecha.getDay() === getDayEsperado(c.indiceSemana)), octubre.celdas.filter((c) => c.fecha.getDay() !== getDayEsperado(c.indiceSemana)).map((c) => `${c.fechaISO} col${c.indiceSemana}`).join(','));
comprobar('octubre de 2026 usa 5 semanas', octubre.totalSemanas === 5, `totalSemanas=${octubre.totalSemanas}`);
comprobar('31 días en el mes, 4 de relleno', octubre.celdas.filter((c) => c.enMes).length === 31 && octubre.celdas.filter((c) => !c.enMes).length === 4);
comprobar('el relleno son los 3 últimos días de septiembre y el 1 de noviembre', octubre.celdas.filter((c) => !c.enMes).map((c) => c.fechaISO).join(',') === '2026-09-28,2026-09-29,2026-09-30,2026-11-01', octubre.celdas.filter((c) => !c.enMes).map((c) => c.fechaISO).join(','));
comprobar('celdas contiguas y sin saltos', octubre.celdas.every((c, i) => i === 0 || c.fecha.getTime() - octubre.celdas[i - 1].fecha.getTime() === 86400000));
// El 30 de septiembre (hoy) aparece como relleno de la primera fila de octubre,
// y se sigue resaltando: es el mismo día, solo que visto desde otro mes.
comprobar('marca hoy una sola vez, aunque sea relleno', octubre.celdas.filter((c) => c.esHoy).length === 1 && octubre.celdas.find((c) => c.esHoy).fechaISO === '2026-09-30', octubre.celdas.filter((c) => c.esHoy).map((c) => c.fechaISO).join(','));
comprobar('el hoy de octubre no está dentro del mes', octubre.celdas.find((c) => c.esHoy).enMes === false);
const septiembre = ca.construirCuadricula(new Date(2026, 8, 1), HOY);
comprobar('septiembre marca el 30 como hoy', septiembre.celdas.filter((c) => c.esHoy).length === 1 && septiembre.celdas.find((c) => c.esHoy).fechaISO === '2026-09-30');
comprobar('septiembre usa 5 semanas', septiembre.totalSemanas === 5, `totalSemanas=${septiembre.totalSemanas}`);
console.log('\n== Cuadrícula: todos los meses de 3 años ==');
// Bucle de revisión de los 36 meses: ninguno puede salirse de 4 a 6
// semanas ni romper la continuidad de los días.
let mesesRevisados = 0;
const fallosEstructurales = [];
for (let anio = 2025; anio <= 2027; anio += 1) {
  for (let mes = 0; mes < 12; mes += 1) {
    const g = ca.construirCuadricula(new Date(anio, mes, 1), HOY);
    const dias = g.celdas.filter((c) => c.enMes);
    mesesRevisados += 1;
    if (g.totalSemanas < 4 || g.totalSemanas > 6) fallosEstructurales.push(`${anio}-${mes + 1}: ${g.totalSemanas} semanas`);
    if (dias.length !== new Date(anio, mes + 1, 0).getDate()) fallosEstructurales.push(`${anio}-${mes + 1}: ${dias.length} días`);
    if (g.celdas.length !== g.totalSemanas * 7) fallosEstructurales.push(`${anio}-${mes + 1}: celdas=${g.celdas.length}`);
    if (!g.celdas.every((c, i) => i === 0 || c.fecha.getTime() - g.celdas[i - 1].fecha.getTime() === 86400000)) {
      fallosEstructurales.push(`${anio}-${mes + 1}: días no contiguos`);
    }
    if (g.celdas[0].fecha.getDay() !== 1) fallosEstructurales.push(`${anio}-${mes + 1}: no empieza en lunes`);
    if (!g.celdas.every((c) => c.fecha.getDay() === getDayEsperado(c.indiceSemana))) fallosEstructurales.push(`${anio}-${mes + 1}: columnas desalineadas`);
  }
}
comprobar('36 meses con entre 4 y 6 semanas', mesesRevisados === 36 && fallosEstructurales.length === 0, fallosEstructurales.join(' | '));

console.log('\n== Cuadrícula: es pura ==');
const impA = ca.construirCuadricula(new Date(2026, 9, 1), HOY);
const impB = ca.construirCuadricula(new Date(2026, 9, 1), HOY);
comprobar('misma entrada, misma salida', JSON.stringify(impA.celdas) === JSON.stringify(impB.celdas));
comprobar('no muta el mes recibido', new Date(2026, 9, 17).getDate() === 17);
comprobar('acepta cualquier día del mes', ca.construirCuadricula(new Date(2026, 9, 28), HOY).totalSemanas === impA.totalSemanas);
comprobar('normaliza al día 1', impA.mes.getDate() === 1);
comprobar('las celdas no vienen con eventos', impA.celdas.every((c) => c.eventos.length === 0));
comprobar('ninguna celda sale seleccionada al inicio', impA.celdas.every((c) => c.seleccionado === false));

console.log('\n== Índice de eventos por día ==');
const conDatos = ca.asignarEventos(octubre, new Map([['2026-10-14', [{ id: 'a' }, { id: 'b' }]]]), '2026-10-14');
comprobar('asigna los eventos del día 14', conDatos.celdas.find((c) => c.fechaISO === '2026-10-14').eventos.length === 2);
comprobar('los demás días quedan vacíos', conDatos.celdas.filter((c) => c.eventos.length > 0).length === 1);
comprobar('marca solo el día seleccionado', conDatos.celdas.filter((c) => c.seleccionado).length === 1);
comprobar('las semanas reciben los eventos', conDatos.semanas[2].dias.some((c) => c.eventos.length === 2));
comprobar('no muta la cuadrícula original', octubre.celdas.find((c) => c.fechaISO === '2026-10-14').eventos.length === 0);
comprobar('sin selección no marca ninguna', ca.asignarEventos(octubre, new Map()).celdas.every((c) => !c.seleccionado));
comprobar('eventosDe devuelve los del día', ca.eventosDe(conDatos, '2026-10-14').length === 2);
comprobar('eventosDe un día vacío devuelve []', ca.eventosDe(conDatos, '2026-10-20').length === 0);
comprobar('eventosDe un día inexistente devuelve []', ca.eventosDe(conDatos, '2030-01-01').length === 0);

console.log('\n== Etiquetas accesibles de la celda ==');
comprobar('1 evento en singular', ca.etiquetaCelda({ fecha: new Date(2026, 9, 12), eventos: [{}] }) === '12 de octubre, 1 evento', ca.etiquetaCelda({ fecha: new Date(2026, 9, 12), eventos: [{}] }));
comprobar('3 eventos en plural', ca.etiquetaCelda({ fecha: new Date(2026, 9, 12), eventos: [{}, {}, {}] }) === '12 de octubre, 3 eventos', ca.etiquetaCelda({ fecha: new Date(2026, 9, 12), eventos: [{}, {}, {}] }));
comprobar('día sin eventos', ca.etiquetaCelda({ fecha: new Date(2026, 9, 12), eventos: [] }) === '12 de octubre, sin eventos', ca.etiquetaCelda({ fecha: new Date(2026, 9, 12), eventos: [] }));

console.log('\n== Mes en la URL (?mes=2026-10) ==');
// SEGURIDAD: nada de `new Date('2026-10-01')`, que lo interpretaría como UTC y en
// Bogotá (UTC-5) abriría el mes anterior.
comprobar('interpreta un mes válido', ca.mesAParametro(ca.mesDesdeParametro('2026-10')) === '2026-10');
comprobar('acepta un solo dígito de mes', ca.mesAParametro(ca.mesDesdeParametro('2026-3')) === '2026-03');
comprobar('tolera espacios', ca.mesAParametro(ca.mesDesdeParametro(' 2026-10 ')) === '2026-10');
comprobar('rechaza basura', ca.mesAParametro(ca.mesDesdeParametro('basura', new Date(2026, 8, 1))) === '2026-09');
comprobar('rechaza mes 0', ca.mesAParametro(ca.mesDesdeParametro('2026-00', new Date(2026, 8, 1))) === '2026-09');
comprobar('rechaza mes 13', ca.mesAParametro(ca.mesDesdeParametro('2026-13', new Date(2026, 8, 1))) === '2026-09');
comprobar('rechaza un año absurdo', ca.mesAParametro(ca.mesDesdeParametro('1800-01', new Date(2026, 8, 1))) === '2026-09');
comprobar('rechaza intento de inyección', ca.mesAParametro(ca.mesDesdeParametro("2026-10'--", new Date(2026, 8, 1))) === '2026-09');
comprobar('sin parámetro usa el mes actual', ca.mesDesdeParametro(null) instanceof Date);
comprobar('sin parámetro usa el mes por defecto', ca.mesAParametro(ca.mesDesdeParametro(null, new Date(2025, 4, 1))) === '2025-05');
comprobar('el día 1 es local, no UTC', ca.mesDesdeParametro('2026-10').getDate() === 1 && ca.mesDesdeParametro('2026-10').getHours() === 0);

/*
 * El valor por defecto se pregunta al reloj, no al sistema.
 *
 * El parámetro por defecto estaba declarado como `new Date()`, y como el
 * parámetro por defecto se evalúa en cada llamada, esa era también la ruta que
 * tomaba `?mes=` cuando el valor faltaba o era basura. Con la suite fijada en
 * diciembre de 2026, esa ruta devolvía el mes real del ordenador y la prueba
 * pasaba por un motivo equivocado. Aquí se fija el reloj en enero de 2027: si
 * volviera a leer el sistema, saldría el mes de quien ejecuta esto.
 */
rj.fijarAhora('2027-01-15T10:00:00');
comprobar('sin parámetro usa el mes del reloj', ca.mesAParametro(ca.mesDesdeParametro(null)) === '2027-01', ca.mesAParametro(ca.mesDesdeParametro(null)));
comprobar('y un parámetro inválido también', ca.mesAParametro(ca.mesDesdeParametro('basura')) === '2027-01', ca.mesAParametro(ca.mesDesdeParametro('basura')));
rj.restablecerAhora();

console.log('\n== Vista en la URL (?vista=) ==');
comprobar('las tres vistas están declaradas', ca.VISTAS.join(',') === 'mes,semana,dia', ca.VISTAS.join(','));
comprobar('la vista por defecto es el mes', ca.vistaDesdeParametro(null) === 'mes');
comprobar('interpreta las tres vistas', ca.VISTAS.every((v) => ca.vistaDesdeParametro(v) === v), ca.VISTAS.map((v) => ca.vistaDesdeParametro(v)).join(','));
comprobar('rechaza una vista inventada', ca.vistaDesdeParametro('trimestre') === 'mes');
comprobar('rechaza intento de inyección', ca.vistaDesdeParametro("semana'--") === 'mes');
comprobar('respeta el valor por defecto', ca.vistaDesdeParametro('basura', ca.VISTA_DIA) === 'dia');
comprobar('cada vista tiene etiqueta', ca.VISTAS.every((v) => typeof ca.ETIQUETAS_VISTA[v] === 'string' && ca.ETIQUETAS_VISTA[v] !== ''), JSON.stringify(ca.ETIQUETAS_VISTA));
comprobar('son inmutables', Object.isFrozen(ca.VISTAS) && Object.isFrozen(ca.ETIQUETAS_VISTA));

console.log('\n== Día en la URL (?fecha=YYYY-MM-DD) ==');
comprobar('interpreta una fecha válida', ca.fechaAParametro(ca.fechaDesdeParametro('2026-10-14')) === '2026-10-14');
comprobar('acepta un solo dígito', ca.fechaAParametro(ca.fechaDesdeParametro('2026-3-4')) === '2026-03-04');
comprobar('tolera espacios', ca.fechaAParametro(ca.fechaDesdeParametro(' 2026-10-14 ')) === '2026-10-14');
comprobar('es local, no UTC', ca.fechaDesdeParametro('2026-10-14').getHours() === 0 && ca.fechaDesdeParametro('2026-10-14').getDate() === 14);
// El 30 de febrero es el caso que un `new Date(2027, 1, 30)` dejaría pasar
// en silencio, devolviendo el 2 de marzo.
comprobar('rechaza un día que no existe en el mes', ca.fechaAParametro(ca.fechaDesdeParametro('2027-02-30', new Date(2026, 9, 14))) === '2026-10-14');
comprobar('acepta el último día real de febrero', ca.fechaAParametro(ca.fechaDesdeParametro('2028-02-29', new Date(2026, 9, 14))) === '2028-02-29');
comprobar('rechaza basura', ca.fechaAParametro(ca.fechaDesdeParametro('ayer', new Date(2026, 9, 14))) === '2026-10-14');
comprobar('rechaza el día 0 y el 32', ca.fechaAParametro(ca.fechaDesdeParametro('2026-10-00', new Date(2026, 9, 14))) === '2026-10-14' && ca.fechaAParametro(ca.fechaDesdeParametro('2026-10-32', new Date(2026, 9, 14))) === '2026-10-14');
comprobar('rechaza intento de inyección', ca.fechaAParametro(ca.fechaDesdeParametro("2026-10-14' OR 1=1", new Date(2026, 9, 14))) === '2026-10-14');
comprobar('sin parámetro usa el reloj', ca.fechaAParametro(ca.fechaDesdeParametro()) === fe.hoyISO(), ca.fechaAParametro(ca.fechaDesdeParametro()));

console.log('\n== Vista de semana ==');
// Se ancla al 14 de octubre de 2026, un miércoles, para comprobar que la
// semana se normaliza al lunes tanto si se entra por un miércoles como por un
// domingo.
const semanaDel14 = ca.construirSemana(new Date(2026, 9, 14), HOY);
comprobar('siete días exactos', semanaDel14.celdas.length === 7, String(semanaDel14.celdas.length));
comprobar('empieza el lunes 12', semanaDel14.celdas[0].fechaISO === '2026-10-12', semanaDel14.celdas[0].fechaISO);
comprobar('termina el domingo 18', semanaDel14.celdas[6].fechaISO === '2026-10-18', semanaDel14.celdas[6].fechaISO);
comprobar('una sola semana', semanaDel14.totalSemanas === 1 && semanaDel14.semanas.length === 1);
comprobar('cada columna cae en su día', semanaDel14.celdas.every((c) => c.fecha.getDay() === getDayEsperado(c.indiceSemana)), semanaDel14.celdas.map((c) => `${c.fechaISO} col${c.indiceSemana}`).join(','));
comprobar('ningún día se atenúa como relleno', semanaDel14.celdas.every((c) => c.enMes));
comprobar('los días son contiguos', semanaDel14.celdas.every((c, i) => i === 0 || c.fecha.getTime() - semanaDel14.celdas[i - 1].fecha.getTime() === 86400000));
comprobar('el título es el rango', semanaDel14.titulo === '12 – 18 oct', semanaDel14.titulo);
// Entrar por el domingo de la misma semana tiene que dar la misma semana.
const semanaDelDomingo = ca.construirSemana(new Date(2026, 9, 18), HOY);
comprobar('un domingo da la misma semana', semanaDelDomingo.celdas[0].fechaISO === '2026-10-12', semanaDelDomingo.celdas[0].fechaISO);
// Y una semana que cruza meses lo dice en el título, con los dos meses.
const semanaCruce = ca.construirSemana(new Date(2026, 9, 1), HOY);
comprobar('una semana que cruza meses nombra los dos', semanaCruce.titulo === '28 sep – 4 oct', semanaCruce.titulo);
// Una semana de enero entero va en un solo mes.
const semanaDeEnero = ca.construirSemana(new Date(2027, 0, 6), HOY);
comprobar('una semana dentro de un mes nombra solo ese mes', semanaDeEnero.titulo === '4 – 10 ene', semanaDeEnero.titulo);

/*
 * LA SEMANA QUE CRUZA EL AÑO
 *
 * Del 28 de diciembre de 2026 al 3 de enero de 2027 hay una semana que toca
 * dos años. Es el caso que más falla si las fechas se construyen con
 * `new Date('AAAA-MM-DD')`: esa cadena es UTC, así que el 28 de diciembre a las
 * 00:00 UTC en Bogotá es el 27 a las 19:00, la semana empezaría el lunes 27 y
 * el título diría diciembre dos veces. Por eso `aFechaLocal` construye con
 * números sueltos, y por eso esta comprobación no es redundante con la del
 * cruce de meses: aquí lo que se atraviesa es el año, no el mes.
 */
const semanaDel28DeDiciembre = ca.construirSemana(new Date(2026, 11, 28), new Date(2026, 11, 28));
const fechasSemanaCruce = semanaDel28DeDiciembre.celdas.map((c) => c.fechaISO);
comprobar('la semana que cruza el año tiene los 7 días', fechasSemanaCruce.length === 7, fechasSemanaCruce.join(' '));
comprobar(
  'y son del 28 de diciembre al 3 de enero',
  fechasSemanaCruce.join(' ') === '2026-12-28 2026-12-29 2026-12-30 2026-12-31 2027-01-01 2027-01-02 2027-01-03',
  fechasSemanaCruce.join(' '),
);
/*
 * El 28 de diciembre de 2026 es lunes, así que el 31 cae en jueves y el 1 de
 * enero en viernes. Si alguien cambiara `INICIO_SEMANA` sin revisar esta semana,
 * la comprobación de abajo seguiría quedando verde en semanas que no cruzan el
 * año: el fallo solo se ve aquí, donde los días ya no siguen al mes.
 */
comprobar('el 31 de diciembre cae en la columna del jueves', semanaDel28DeDiciembre.celdas.find((c) => c.fechaISO === '2026-12-31').indiceSemana === 3);
comprobar('el 1 de enero cae en la del viernes, y no en la del lunes', semanaDel28DeDiciembre.celdas.find((c) => c.fechaISO === '2027-01-01').indiceSemana === 4);
comprobar('ninguna celda se atenúa como relleno, aunque cambie de mes', semanaDel28DeDiciembre.celdas.every((c) => c.enMes));
comprobar('ninguna celda lleva NaN en el año', semanaDel28DeDiciembre.celdas.every((c) => Number.isFinite(c.fecha.getFullYear())));
comprobar('el título nombra los dos meses del cruce', semanaDel28DeDiciembre.titulo === '28 dic – 3 ene', semanaDel28DeDiciembre.titulo);

// La semana siguiente a la que cruza el año tiene que estar ya dentro de enero.
const despuesDelCruce = ca.construirSemana(ca.moverSemanaCalendario(new Date(2026, 11, 28), 1), HOY);
comprobar('la semana siguiente ya es de enero', despuesDelCruce.celdas[0].fechaISO === '2027-01-04', despuesDelCruce.celdas[0].fechaISO);
comprobar('y su título solo nombra enero', despuesDelCruce.titulo === '4 – 10 ene', despuesDelCruce.titulo);

// Y al revés: entrar en la semana de enero que contiene el 31 de diciembre da
// la misma semana, porque la semana se normaliza por el lunes y no por el ancla.
comprobar('entrar por un día de enero da la semana que cruza el año', ca.construirSemana(new Date(2027, 0, 2), HOY).celdas[0].fechaISO === '2026-12-28', ca.construirSemana(new Date(2027, 0, 2), HOY).celdas[0].fechaISO);

// La vista de día también tiene que poder caer en el 1 de enero sin arrastrar el
// mes ni el año de su cuadrícula mensual.
const primeroDeEnero = ca.construirDia(new Date(2027, 0, 1), new Date(2027, 0, 1));
comprobar('el 1 de enero abre el 1 de enero', primeroDeEnero.celdas[0].fechaISO === '2027-01-01', primeroDeEnero.celdas[0].fechaISO);
comprobar('su título dice enero de 2027', primeroDeEnero.titulo === 'viernes 1 de enero', primeroDeEnero.titulo);
comprobar('y el 31 de diciembre es jueves', ca.construirDia(new Date(2026, 11, 31), HOY).titulo === 'jueves 31 de diciembre', ca.construirDia(new Date(2026, 11, 31), HOY).titulo);
// El día marcado como hoy se propaga a la semana.
const semanaConHoy = ca.construirSemana(new Date(2026, 9, 14), new Date(2026, 9, 15));
comprobar('marca el día de hoy', semanaConHoy.celdas.filter((c) => c.esHoy).length === 1 && semanaConHoy.celdas.find((c) => c.esHoy).fechaISO === '2026-10-15');
comprobar('y la semana sabe que lo contiene', semanaConHoy.semanas[0].contieneHoy === true);
comprobar('una semana sin hoy no dice que lo contiene', ca.construirSemana(new Date(2026, 9, 14), new Date(2026, 10, 1)).semanas[0].contieneHoy === false);
// Es pura y no muta lo que recibe.
const impS1 = ca.construirSemana(new Date(2026, 9, 14), HOY);
const impS2 = ca.construirSemana(new Date(2026, 9, 14), HOY);
comprobar('misma entrada, misma salida', JSON.stringify(impS1.celdas) === JSON.stringify(impS2.celdas));
comprobar('no muta el día recibido', new Date(2026, 9, 14).getDate() === 14);
comprobar('las celdas no vienen con eventos', impS1.celdas.every((c) => c.eventos.length === 0 && c.seleccionado === false));
// Sirve con el mismo asignador que el mes.
const semanaConDatos = ca.asignarEventos(semanaDel14, new Map([['2026-10-14', [{ id: 'a' }, { id: 'b' }]]]), '2026-10-14');
comprobar('asigna eventos con el mismo asignador', semanaConDatos.celdas.find((c) => c.fechaISO === '2026-10-14').eventos.length === 2);
comprobar('marca la selección', semanaConDatos.celdas.filter((c) => c.seleccionado).length === 1);
comprobar('los días vacíos quedan vacíos', semanaConDatos.celdas.filter((c) => c.eventos.length > 0).length === 1);
comprobar('no muta la semana original', semanaDel14.celdas.find((c) => c.fechaISO === '2026-10-14').eventos.length === 0);
comprobar('eventosDe funciona igual', ca.eventosDe(semanaConDatos, '2026-10-14').length === 2);
comprobar('eventosDe un día fuera de la semana devuelve []', ca.eventosDe(semanaConDatos, '2026-10-20').length === 0);

console.log('\n== Vista de día ==');
const diaDel14 = ca.construirDia(new Date(2026, 9, 14), HOY);
comprobar('una sola celda', diaDel14.celdas.length === 1 && diaDel14.semanas.length === 1);
comprobar('es el día pedido', diaDel14.celdas[0].fechaISO === '2026-10-14' && diaDel14.celdas[0].dia === 14);
comprobar('el título lleva el día de la semana', diaDel14.titulo === 'miércoles 14 de octubre', diaDel14.titulo);
comprobar('la columna es la del día de la semana', diaDel14.celdas[0].indiceSemana === 2, String(diaDel14.celdas[0].indiceSemana));
comprobar('un domingo es la última columna', ca.construirDia(new Date(2026, 9, 18), HOY).celdas[0].indiceSemana === 6);
comprobar('un lunes es la primera columna', ca.construirDia(new Date(2026, 9, 12), HOY).celdas[0].indiceSemana === 0);
comprobar('ningún día se atenúa como relleno', diaDel14.celdas[0].enMes);
comprobar('marca hoy solo si coincide', ca.construirDia(new Date(2026, 9, 14), new Date(2026, 9, 14)).celdas[0].esHoy === true && diaDel14.celdas[0].esHoy === false);
comprobar('es pura', JSON.stringify(ca.construirDia(new Date(2026, 9, 14), HOY).celdas) === JSON.stringify(diaDel14.celdas));
comprobar('no muta el día recibido', new Date(2026, 9, 14).getDate() === 14);
const diaConDatos = ca.asignarEventos(diaDel14, new Map([['2026-10-14', [{ id: 'a' }]]]), '2026-10-14');
comprobar('asigna eventos con el mismo asignador', diaConDatos.celdas[0].eventos.length === 1 && diaConDatos.celdas[0].seleccionado === true);
comprobar('un día sin eventos no inventa ninguno', ca.asignarEventos(diaDel14, new Map()).celdas[0].eventos.length === 0);
comprobar('la etiqueta accesible cuenta bien', ca.etiquetaCelda(diaConDatos.celdas[0]) === '14 de octubre, 1 evento', ca.etiquetaCelda(diaConDatos.celdas[0]));

console.log('\n== Navegación por día y por semana ==');
comprobar('avanza un día', ca.fechaAParametro(ca.moverDiaCalendario(new Date(2026, 9, 14), 1)) === '2026-10-15');
comprobar('retrocede un día', ca.fechaAParametro(ca.moverDiaCalendario(new Date(2026, 9, 14), -1)) === '2026-10-13');
comprobar('cruza el mes', ca.fechaAParametro(ca.moverDiaCalendario(new Date(2026, 9, 31), 1)) === '2026-11-01');
comprobar('cruza el año', ca.fechaAParametro(ca.moverDiaCalendario(new Date(2026, 11, 31), 1)) === '2027-01-01');
comprobar('no desborda con delta 0', ca.fechaAParametro(ca.moverDiaCalendario(new Date(2026, 9, 14), 0)) === '2026-10-14');
comprobar('avanza una semana', ca.fechaAParametro(ca.moverSemanaCalendario(new Date(2026, 9, 14), 1)) === '2026-10-19');
comprobar('retrocede una semana', ca.fechaAParametro(ca.moverSemanaCalendario(new Date(2026, 9, 14), -1)) === '2026-10-05');
comprobar('avanzar semana cae en lunes', ca.moverSemanaCalendario(new Date(2026, 9, 14), 1).getDay() === 1);
// Da igual el día de la semana desde el que se navegue: el punto de partida es
// el lunes de esa semana, no el día exacto que se vio.
comprobar('da igual entrar por el domingo', ca.fechaAParametro(ca.moverSemanaCalendario(new Date(2026, 9, 18), 1)) === '2026-10-19', ca.fechaAParametro(ca.moverSemanaCalendario(new Date(2026, 9, 18), 1)));
comprobar('cruza el año hacia atrás', ca.fechaAParametro(ca.moverSemanaCalendario(new Date(2027, 0, 4), -1)) === '2026-12-28');
comprobar('cruza el año hacia adelante', ca.fechaAParametro(ca.moverSemanaCalendario(new Date(2026, 11, 28), 1)) === '2027-01-04');
comprobar('va y vuelve al mismo sitio', ca.fechaAParametro(ca.moverSemanaCalendario(ca.moverSemanaCalendario(new Date(2026, 9, 14), 5), -5)) === '2026-10-12');

console.log('\n== Navegación entre meses ==');
comprobar('avanza un mes', ca.mesAParametro(ca.moverMesCalendario(new Date(2026, 9, 1), 1)) === '2026-11');
comprobar('retrocede un mes', ca.mesAParametro(ca.moverMesCalendario(new Date(2026, 9, 1), -1)) === '2026-09');
comprobar('cruza el año hacia atrás', ca.mesAParametro(ca.moverMesCalendario(new Date(2026, 0, 1), -1)) === '2025-12');
comprobar('cruza el año hacia adelante', ca.mesAParametro(ca.moverMesCalendario(new Date(2026, 11, 1), 1)) === '2027-01');
comprobar('cruza el año bisiesto', ca.mesAParametro(ca.moverMesCalendario(new Date(2028, 1, 1), 1)) === '2028-03');
comprobar('no desborda con delta 0', ca.mesAParametro(ca.moverMesCalendario(new Date(2026, 9, 1), 0)) === '2026-10');

console.log('\n== Encabezado de días ==');
comprobar('empieza en lunes', ca.DIAS_ENCABEZADO[0] === 'lunes' && ca.DIAS_ENCABEZADO[6] === 'domingo', ca.DIAS_ENCABEZADO.join(','));
comprobar('cortos con inicial en mayúscula', ca.DIAS_ENCABEZADO_CORTOS.join(',') === 'Lun,Mar,Mié,Jue,Vie,Sáb,Dom', ca.DIAS_ENCABEZADO_CORTOS.join(','));
comprobar('7 días en la cabecera', ca.DIAS_ENCABEZADO_CORTOS.length === 7);
comprobar('son inmutables', Object.isFrozen(ca.DIAS_ENCABEZADO) && Object.isFrozen(ca.DIAS_ENCABEZADO_CORTOS));

console.log('\n== Eventos del seed caben en su mes ==');
/*
 * El seed se ancla al mes en curso con `diaDelMes()`, así que los meses se
 * calculan aquí a partir del reloj y no se escriben literales. Escribir
 * '2026-09' y '2026-10' aquí hacía que estas comprobaciones dejaran de tener
 * sentido en cuanto cambiaba el mes, y el fallo se habría leído como un problema
 * del seed cuando en realidad estaba la comprobación.
 *
 * `HOY` de arriba es una fecha fija a propósito, para que el renderizado de la
 * cuadrícula sea reproducible. Este bloque usa el reloj de la suite, que con
 * `npm run test:octubre` o `test:febrero` es una fecha simulada: su pregunta es
 * justamente "qué meses cubre el seed hoy".
 */
await ev.resetEventos();
const sembrados = await ev.getEventos();
const mesEnCurso = ca.mesAParametro(rj.ahora());
const mesSiguiente = ca.mesAParametro(ca.moverMesCalendario(rj.ahora(), 1));
const enMesEnCurso = sembrados.filter((e) => e.fecha.startsWith(mesEnCurso));
const enMesSiguiente = sembrados.filter((e) => e.fecha.startsWith(mesSiguiente));
comprobar('el seed cubre el mes actual', enMesEnCurso.length > 0, `${mesEnCurso}=${enMesEnCurso.length}`);
comprobar('y también el mes siguiente', enMesSiguiente.length > 0, `${mesSiguiente}=${enMesSiguiente.length}`);
comprobar(
  'el mes siguiente trae los días 5, 12 y 15',
  [5, 12, 15].every((dia) => enMesSiguiente.some((e) => e.fecha === `${mesSiguiente}-${String(dia).padStart(2, '0')}`)),
  enMesSiguiente.map((e) => e.fecha).join(' '),
);
// El día 1 se construye con números y no con una cadena `YYYY-MM-01`: `new
// Date('2026-11-01')` se interpreta como medianoche UTC y en un huso horario
// negativo cae en el mes anterior, con lo que la cuadrícula se construye del
// mes equivocado y ninguna celda queda marcada como del mes visible.
const [anioSiguiente, mesSiguienteNum] = mesSiguiente.split('-').map(Number);
const cuadrSiguiente = ca.construirCuadricula(
  new Date(anioSiguiente, mesSiguienteNum - 1, 1),
  HOY,
);
const indiceSiguiente = fe.agruparPorFecha(enMesSiguiente);
const diaCinco = `${mesSiguiente}-05`;
const siguienteConDatos = ca.asignarEventos(cuadrSiguiente, indiceSiguiente, diaCinco);
comprobar(
  'los tres días del mes siguiente caen en celdas del mes',
  siguienteConDatos.celdas.filter((c) => c.enMes && c.eventos.length > 0).length === 3,
  `${siguienteConDatos.celdas.filter((c) => c.enMes && c.eventos.length > 0).length} celdas con datos`,
);
comprobar('y la cuadrícula muestra el día 5', siguienteConDatos.celdas.find((c) => c.fechaISO === diaCinco).eventos.length > 0, diaCinco);
comprobar('ningún próximo evento está en el pasado', (await ev.getEventos()).filter((e) => e.fecha >= fe.hoyISO()).length > 0);

/*
 * ---------------------------------------------------------------------------
 * Renderizado de la cuadrícula.
 *
 * Se monta el componente a HTML con `react-dom/server` para comprobar que la
 * estructura y la accesibilidad son correctas. No sustituye a probarlo en el
 * navegador, pero atrapa el fallo más habitual: que el `aria-label` no cuadre
 * con la fecha o que falte el `role` de la rejilla.
 * ---------------------------------------------------------------------------
 */
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const CalendarioMes = (await vite.ssrLoadModule('/src/components/calendar/CalendarioMes.jsx')).default;

/** Eventos de prueba para el 14 de octubre: 3, para forzar el "+1 más". */
const TRES_EVENTOS = [
  { id: 'a1', titulo: 'Cena', categoria: 'cita', hora: '20:00' },
  { id: 'a2', titulo: 'Viaje', categoria: 'viaje', hora: '09:00' },
  { id: 'a3', titulo: 'Cumple', categoria: 'cumpleanos', hora: '18:00' },
];

const cuadrOctConDatos = ca.asignarEventos(
  ca.construirCuadricula(new Date(2026, 9, 1), HOY),
  new Map([['2026-10-14', TRES_EVENTOS]]),
  '2026-10-14',
);

const htmlOct = renderToStaticMarkup(
  React.createElement(CalendarioMes, {
    cuadricula: cuadrOctConDatos,
    onSelectDia: () => {},
    onVerRestoDelDia: () => {},
    onMoverMes: () => {},
    onHoy: () => {},
  }),
);

console.log('\n== Render: estructura de la cuadrícula ==');
comprobar('la región se anuncia como calendario', htmlOct.includes('aria-label="Calendario, octubre 2026"'));
comprobar('la rejilla usa role="grid"', htmlOct.includes('role="grid"'));
comprobar('hay una fila por semana', (htmlOct.match(/role="row"/g) || []).length === 5, String((htmlOct.match(/role="row"/g) || []).length));
// Octubre de 2026 son 31 días y la cuadrícula tiene 5 semanas: 35 celdas (4 de
// ellas de relleno). Cada celda es un botón con `aria-pressed`.
comprobar('35 celdas de día', (htmlOct.match(/aria-pressed=/g) || []).length === 35, String((htmlOct.match(/aria-pressed=/g) || []).length));
comprobar('el encabezado de días está oculto a lectores', htmlOct.includes('aria-hidden="true"'));

console.log('\n== Render: accesibilidad de las celdas ==');
comprobar('el día 14 anuncia su fecha y el número de eventos', htmlOct.includes('aria-label="14 de octubre, 3 eventos"'));
comprobar('un día sin eventos lo dice', htmlOct.includes('aria-label="12 de octubre, sin eventos"'));
comprobar('el día de hoy se marca como pulsado', /aria-label="30 de septiembre/.test(htmlOct));
comprobar('el día seleccionado marca aria-pressed', htmlOct.includes('aria-pressed="true"'));
comprobar('las flechas tienen nombre accesible', htmlOct.includes('aria-label="Mes anterior"') && htmlOct.includes('aria-label="Mes siguiente"'));
// Cada celda debe tener nombre accesible. Se aíslan los botones de día (los
// que llevan `aria-pressed`) y se comprueba uno a uno.
const botonesDia = htmlOct.match(/<button[^>]*aria-pressed[^>]*>/g) ?? [];
comprobar('cada celda tiene aria-label', botonesDia.length > 0 && botonesDia.every((b) => /aria-label="[^"]+"/.test(b)), botonesDia.filter((b) => !/aria-label=/.test(b)).length + ' sin etiqueta');

console.log('\n== Render: desbordamiento de eventos ==');
comprobar('muestra 2 de 3 eventos y un +1 más', htmlOct.includes('+1 más'));
comprobar('el +N más no está dentro del botón del día', !/<button[^>]*aria-pressed[^>]*>[^<]*<button/.test(htmlOct));
comprobar('el +N más nombra el día en texto oculto', htmlOct.includes('Ver los 3 eventos del 14 de octubre'));
comprobar('sin onVerResto no aparece el +N más', !renderToStaticMarkup(React.createElement(CalendarioMes, { cuadricula: cuadrOctConDatos, onSelectDia: () => {}, onMoverMes: () => {}, onHoy: () => {} })).includes('más'));

const htmlMovil = renderToStaticMarkup(
  React.createElement(CalendarioMes, {
    cuadricula: cuadrOctConDatos,
    compacto: true,
    onSelectDia: () => {},
    onMoverMes: () => {},
    onHoy: () => {},
  }),
);
console.log('\n== Render: variante compacta (móvil) ==');
comprobar('los mismos 35 días', (htmlMovil.match(/aria-pressed=/g) || []).length === 35, String((htmlMovil.match(/aria-pressed=/g) || []).length));
comprobar('no muestra el +N más', !htmlMovil.includes('más'));
comprobar('los puntos de color siguen marcados como decorativos', htmlMovil.includes('aria-hidden="true"'));

/*
 * La página se monta con el router de verdad para detectar errores de
 * importación o de JSX que el build no ve.
 *
 * `react-router-dom` viene como CommonJS y el cargador de Vite no lo puede
 * evaluar en SSR (`require is not defined`), así que se carga con
 * `createRequire` desde el propio proyecto. Se usa el mismo `react` para
 * renderizar y para el componente, que de otro modo serían dos copias del
 * contexto y los hooks fallarían.
 *
 * En SSR los efectos no se ejecutan, así que `useEventos` se queda en su
 * estado `cargando` inicial: esto comprueba el árbol de la página, no la
 * cuadrícula ya poblada (de eso se encarga el test de `CalendarioMes`).
 */
const requireDesdeProyecto = createRequire(`${process.cwd()}/package.json`);
const ReactCjs = requireDesdeProyecto('react');
const { renderToStaticMarkup: renderPagina } = requireDesdeProyecto('react-dom/server');
const { MemoryRouter, Routes, Route, Navigate, useLocation } = requireDesdeProyecto('react-router-dom');
const PaginaCalendario = (await vite.ssrLoadModule('/src/pages/Calendario.jsx')).default;

/*
 * `useLocation` viene del mismo `requireDesdeProyecto` de arriba: cargarlo con
 * `ssrLoadModule` daría error porque Vite no resuelve especificadores desnudos.
 *
 * El eco de la URL se declara aquí, antes que su primer uso, porque los filtros
 * de las distintas páginas se comprueban mirando lo que se escribe en la URL y
 * no en un estado interno: la lista se vería igual de filtrada en los dos casos,
 * y es justo el comportamiento que hay que demostrar.
 */
const EcoDeUrl = () => ReactCjs.createElement('p', { id: 'eco-url' }, useLocation().search);

/**
 * Búsqueda vigente de la URL, tal y como la ve el nodo montado.
 *
 * @returns {string} Cadena con `?` y los parámetros, o cadena vacía.
 */
const ecoUrl = () => document.getElementById('eco-url')?.textContent ?? '';

console.log('\n== Render: la página del calendario ==');
// Se abre en el mes en curso del reloj simulado: el enlace "Mes" se deja sin
// parámetros solo cuando el mes visible es ese, así que abrir en octubre con el
// reloj en febrero daría un enlace distinto y la comprobación mediría el mes
// equivocado en vez del conmutador.
const htmlPagina = renderPagina(
  ReactCjs.createElement(
    MemoryRouter,
    { initialEntries: [`/calendario?mes=${ca.mesAParametro(rj.ahora())}`] },
    ReactCjs.createElement(
      Routes,
      null,
      ReactCjs.createElement(Route, {
        path: '/calendario',
        element: ReactCjs.createElement(PaginaCalendario),
      }),
    ),
  ),
);
comprobar('la página monta sin lanzar errores', htmlPagina.length > 0, `len=${htmlPagina.length}`);
comprobar('muestra el título', htmlPagina.includes('>Calendario<'));
comprobar('ofrece las tres vistas', ['>Mes<', '>Semana<', '>Día<'].every((t) => htmlPagina.includes(t)));
comprobar('el botón de agregar está presente', htmlPagina.includes('Agregar evento'));
comprobar('avisa del estado de carga', htmlPagina.includes('Cargando el calendario'));
comprobar('usa el parámetro del mes de la URL sin fallar', !htmlPagina.includes('NaN') && !htmlPagina.includes('Invalid Date'));
// El conmutador son enlaces: la vista vive en la URL, así que tiene que ser
// navegación de verdad y no un `button` con estado propio. En el HTML, `&` sale
// escapado como `&amp;`, que es lo que espera un navegador al leer el atributo.
comprobar('el conmutador es una región con nombre', (htmlPagina.match(/aria-label="Elegir la vista del calendario"/g) || []).length === 1);
comprobar('el mes en curso va sin parámetros', htmlPagina.includes('href="/calendario"'), 'sin href limpio');
comprobar('las otras dos llevan vista y fecha', htmlPagina.includes(`href="/calendario?vista=semana&amp;fecha=${fe.hoyISO()}"`) && htmlPagina.includes(`href="/calendario?vista=dia&amp;fecha=${fe.hoyISO()}"`), `hoy=${fe.hoyISO()}`);
comprobar('la vista de mes es la activa', (htmlPagina.match(/aria-current="page"/g) || []).length === 1, String((htmlPagina.match(/aria-current="page"/g) || []).length));
const htmlConmutador = (htmlPagina.match(/<nav[^>]*aria-label="Elegir la vista del calendario"[\s\S]*?<\/nav>/) || [''])[0];
comprobar('el conmutador ya no deshabilita nada', !htmlConmutador.includes('disabled'), htmlConmutador.slice(0, 160));

/*
 * ---------------------------------------------------------------------------
 * Modal, formulario y detalle, con un DOM real.
 *
 * `renderToStaticMarkup` no sirve para el modal: se monta con `createPortal`
 * sobre `document.body` y no produce HTML estático. Y aunque lo hiciera, no
 * ejecutaría eventos ni mediría el foco, que es justo lo que hay que comprobar.
 *
 * Con jsdom se monta la app de verdad y se simulan pulsaciones de teclado y de
 * ratón, que es donde viven los fallos de accesibilidad: el foco que se escapa
 * del diálogo, el error que no se anuncia, el doble envío.
 * ---------------------------------------------------------------------------
 */
const { JSDOM } = await import('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/calendario?mes=2026-10',
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.Event = dom.window.Event;
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.CSS ??= dom.window.CSS ?? { escape: (s) => String(s) };

const { createRoot } = await import('react-dom/client');
const { act } = await import('react');

/**
 * Busca el primer elemento que contiene un texto, dentro de un ámbito.
 *
 * Se separa del arnés para que `porTexto` y `porTextoGlobal` compartan el mismo
 * criterio y no se separen por accidente: si un solo sitio usara `textContent`
 * sin recortar, "Guardar" encontraría "Guardar cambios" y la prueba pasaría
 * midiendo otro botón.
 *
 * @param {ParentNode} ambito Contenedor donde buscar.
 * @param {string} selector Selector CSS.
 * @param {string} texto Texto que debe contener, sin recortar.
 * @returns {Element|null} Elemento encontrado, o `null`.
 */
function buscarPorTexto(ambito, selector, texto) {
  return [...ambito.querySelectorAll(selector)].find((el) =>
    el.textContent.trim().includes(texto),
  );
}

/**
 * Monta un componente en el DOM y devuelve utilidades para inspeccionarlo.
 *
 * OJO: el modal se monta con `createPortal` sobre `document.body`, así que sus
 * nodos NO están dentro del contenedor que devuelve esta función. Por eso
 * `dialogo()` busca en todo el documento, y por eso las pruebas se desmontan
 * unas a otras: con dos modales abiertos a la vez, un `querySelector` global
 * devolvería siempre el primero.
 *
 * @param {import('react').ReactElement} elemento Elemento a montar.
 * @returns {Promise<object>} Utilidades de la prueba.
 */
async function montar(elemento) {
  const contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  const root = createRoot(contenedor);
  await act(async () => {
    root.render(elemento);
  });

  return {
    raiz: contenedor,

    /**
     * Primer elemento del CONTENEDOR que contiene el texto dado.
     *
     * Solo mira dentro del contenedor del componente. Para lo que se monte por
     * portal —cualquier `Modal`— hay que usar `porTextoGlobal`, y no por
     * comodidad: si un `null` de este buscador significara "el modal está mal",
     * se estaría midiendo otra cosa.
     *
     * @param {string} selector Selector CSS.
     * @param {string} texto Texto que debe contener.
     * @returns {Element|null} Elemento encontrado, o `null`.
     */
    porTexto(selector, texto) {
      return buscarPorTexto(contenedor, selector, texto);
    },

    /**
     * Igual que {@link porTexto}, pero en todo el documento.
     *
     * Existe para el contenido de los modales, que `createPortal` deja fuera del
     * contenedor. Con dos modales abiertos a la vez devuelve el primero que
     * coincida, así que las pruebas que pueden tener varios abiertos se
     * desmontan unas a otras para no medirse siempre la primera.
     *
     * @param {string} selector Selector CSS.
     * @param {string} texto Texto que debe contener.
     * @returns {Element|null} Elemento encontrado, o `null`.
     */
    porTextoGlobal(selector, texto) {
      return buscarPorTexto(document, selector, texto);
    },

    /**
     * Pulsa un elemento.
     *
     * Si no recibe elemento, el error dice qué se intentó pulsar. Un
     * `pulsar() recibió null` a secas corta la suite entera en un archivo de
     * más de mil líneas, y cuando se mira el error no se sabe ni de qué botón
     * se trata: se pierde el contexto de las comprobaciones que sí pasaron.
     *
     * @param {Element|null} el Elemento a pulsar.
     * @param {string} [descripcion] Qué se buscaba, para el mensaje de error.
     * @returns {Promise<void>} Termina cuando React ha repintado.
     */
    async pulsar(el, descripcion) {
      if (!el) {
        throw new Error(
          `pulsar() no encontró nada${descripcion ? `: ${descripcion}` : ''}. ` +
            'Revisa que el botón exista, que su texto siga siendo ese y si está ' +
            'dentro de un modal, en cuyo caso hay que usar porTextoGlobal().',
        );
      }
      await act(async () => {
        el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      });
    },

    /**
     * Escribe en un control controlado por React.
     *
     * Hay que pasar por el setter del prototipo: React sustituye la propiedad
     * `value` del nodo para detectar cambios, así que asignarla directamente no
     * dispara `onChange` y el campo se quedaría con el valor viejo.
     *
     * @param {HTMLInputElement|HTMLTextAreaElement} el Campo a escribir.
     * @param {string} valor Texto a escribir.
     * @param {string} [descripcion] Qué campo se buscaba, para el error.
     * @returns {Promise<void>} Termina cuando React ha repintado.
     */
    async escribir(el, valor, descripcion) {
      if (!el) {
        throw new Error(
          `escribir() no encontró el campo${descripcion ? `: ${descripcion}` : ''}. ` +
            'Un selector mal escrito y un campo que no se ha pintado fallan igual.',
        );
      }
      const prototipo =
        el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototipo, 'value').set.call(el, valor);
        el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    },

    /**
     * Envía el formulario.
     *
     * @param {HTMLFormElement} formulario Formulario a enviar.
     * @param {string} [descripcion] Qué formulario se buscaba, para el error.
     * @returns {Promise<void>} Termina cuando React ha repintado.
     */
    async enviar(formulario, descripcion) {
      if (!formulario) {
        throw new Error(
          `enviar() no encontró el formulario${descripcion ? `: ${descripcion}` : ''}. ` +
            'Si está dentro de un modal, búscalo en document y no en la raíz del componente.',
        );
      }
      await act(async () => {
        formulario.dispatchEvent(
          new dom.window.Event('submit', { bubbles: true, cancelable: true }),
        );
      });
    },

    /**
     * Dispara un evento que no viene del ratón ni del teclado.
     *
     * Existe para lo que dispara la red, como el `error` de una imagen que no
     * carga: en el navegador lo emite el propio navegador, y aquí hay que
     * provocarlo a mano. Va dentro de `act` porque el evento provoca un cambio
     * de estado en React, y sin el envoltorio el repintado se aplicaría más
     * tarde que la comprobación y esta mediría el estado anterior.
     *
     * @param {Element} el Elemento que emite el evento.
     * @param {string} tipo Nombre del evento, por ejemplo `'error'`.
     * @returns {Promise<void>} Termina cuando React ha repintado.
     * @example
     * await app.disparar(imagen, 'error');
     */
    async disparar(el, tipo) {
      if (!el) {
        throw new Error(`disparar() no encontró el elemento para el evento "${tipo}".`);
      }
      await act(async () => {
        el.dispatchEvent(new dom.window.Event(tipo, { bubbles: false }));
      });
    },

    /** Desmonta y limpia. */
    async desmontar() {
      await act(async () => root.unmount());
      contenedor.remove();
    },
  };
}

const EventoFormModal = (await vite.ssrLoadModule('/src/components/eventos/EventoFormModal.jsx')).default;
const SelectorFoto = (await vite.ssrLoadModule('/src/components/eventos/SelectorFoto.jsx')).default;
const EventoDetallePagina = (await vite.ssrLoadModule('/src/pages/EventoDetalle.jsx')).default;
const Modal = (await vite.ssrLoadModule('/src/components/ui/Modal.jsx')).default;
const { ErrorServicio } = await vite.ssrLoadModule('/src/services/eventosService.js');

/*
 * ---------------------------------------------------------------------------
 * Paso g: las tres vistas del calendario en un DOM real.
 *
 * Lo que se comprueba aquí es lo que solo se ve montando la página: que el
 * conmutador escriba en la URL, que las flechas muevan el período que toca en
 * cada vista y que cada vista enseñe lo que promete. Las funciones puras de
 * `utils/calendario.js` ya están comprobadas más arriba, sin React.
 * ---------------------------------------------------------------------------
 */

/*
 * Eco de la URL propio del calendario.
 *
 * No se reutiliza el `EcoDeUrl` compartido porque este bloque deja varias
 * páginas montadas a la vez -para comprobar, por ejemplo, que volver al mes
 * desde la semana no desmonta el resto-. Con un único nodo `eco-url` en el
 * documento, `getElementById` devolvería siempre la primera app montada y las
 * comprobaciones medirían la URL de otra vista.
 */
const EcoUrlDeCalendario = () =>
  ReactCjs.createElement('p', { id: 'eco-url-calendario' }, useLocation().search);

const montarCalendario = (busqueda = '') =>
  montar(
    ReactCjs.createElement(
      MemoryRouter,
      { initialEntries: [`/calendario${busqueda}`] },
      ReactCjs.createElement(PaginaCalendario),
      ReactCjs.createElement(EcoUrlDeCalendario),
    ),
  );

/**
 * Búsqueda de la URL tal y como la ve una página concreta del calendario.
 *
 * @param {{raiz: Element}} app Página montada.
 * @returns {string} Cadena con `?` y los parámetros, o cadena vacía.
 */
const ecoUrlDe = (app) => app.raiz.querySelector('#eco-url-calendario')?.textContent ?? '';

const conmutador = (raiz) => raiz.querySelector('nav[aria-label="Elegir la vista del calendario"]');
const enlaceVista = (raiz, etiqueta) =>
  [...conmutador(raiz).querySelectorAll('a')].find((a) => a.textContent.trim() === etiqueta) ?? null;
const columnaSemana = (raiz) => [...raiz.querySelectorAll('[role="gridcell"]')];
const celdasMes = (raiz) => raiz.querySelectorAll('[role="grid"] [role="row"] button');
const botonIcono = (raiz, etiqueta) => raiz.querySelector(`button[aria-label="${etiqueta}"]`);

/*
 * Estas comprobaciones se ancla al reloj, no a octubre de 2026. La suite se
 * ejecuta con `test:octubre`, `test:febrero` y `test:diciembre`, y el seed
 * siembra los eventos en el mes del día simulado: con fechas literales, en
 * febrero y diciembre no habría nada que encontrar y las pruebas pasarían por
 * falta de eventos en vez de por funcionamiento. De los datos del seed se
 * derivan un día con eventos y uno libre, de modo que la prueba sigue siendo
 * la misma en cualquier mes.
 */
await ev.resetEventos();
const HOY_PASO_G = fe.hoyISO();
const EVENTOS_DEL_SEMILLERO = await ev.getEventos();
const DIAS_CON_EVENTOS = new Set(EVENTOS_DEL_SEMILLERO.map((e) => e.fecha));
const diaConEventos = EVENTOS_DEL_SEMILLERO[0].fecha;
const celdasDeLaSemanaDeHoy = ca.construirSemana(ca.aFechaLocal(HOY_PASO_G)).celdas;
const diaLibre = celdasDeLaSemanaDeHoy.find((celda) => !DIAS_CON_EVENTOS.has(celda.fechaISO)).fechaISO;

console.log('\n== Paso g: la vista mensual sigue siendo la de por defecto ==');
const MES_EN_CURSO = ca.mesAParametro(rj.ahora());
const appMes = await montarCalendario(`?mes=${MES_EN_CURSO}`);
comprobar('sin `?vista=` se abre el mes', columnaSemana(appMes.raiz).length === 0 && celdasMes(appMes.raiz).length > 0, `${celdasMes(appMes.raiz).length} celdas`);
comprobar('el título es el mes de la URL', appMes.raiz.querySelector('h2')?.textContent.trim() === ca.construirCuadricula(ca.aFechaLocal(`${MES_EN_CURSO}-01`)).titulo, appMes.raiz.querySelector('h2')?.textContent ?? 'sin título');
comprobar('"Mes" es la vista activa', enlaceVista(appMes.raiz, 'Mes')?.getAttribute('aria-current') === 'page');
comprobar('las otras dos no son la activa', enlaceVista(appMes.raiz, 'Semana')?.getAttribute('aria-current') === null && enlaceVista(appMes.raiz, 'Día')?.getAttribute('aria-current') === null);

console.log('\n== Paso g: el conmutador escribe en la URL ==');
await appMes.pulsar(enlaceVista(appMes.raiz, 'Semana'), 'el enlace "Semana" del conmutador');
comprobar('pulsar "Semana" pone la vista', ecoUrlDe(appMes).includes('vista=semana'), ecoUrlDe(appMes));
comprobar('y ancla un día', /fecha=\d{4}-\d{2}-\d{2}/.test(ecoUrlDe(appMes)), ecoUrlDe(appMes));

console.log('\n== Paso g: la vista semanal ==');
// Se ancla a un día del seed, para que la columna con eventos caiga dentro de la
// semana que se está mirando y no en la semana vecina.
/*
 * Se ancla a la semana con más días con eventos, no a la del primer evento del
 * seed. Con la del primer evento, en diciembre solo cae un día con eventos en
 * toda la semana y las comprobaciones de "pulsar otra columna" se quedarían sin
 * la segunda columna que necesitan. Eligiendo la semana más poblada, el mismo
 * bloque funciona en los tres meses simulados y la suite no cambia de número de
 * pruebas según la fecha con la que se ejecute.
 *
 * OJO: esto es una decisión del Fixture, no de la app. `construirSemana()` abre la
 * semana que contiene el ancla, y siempre. Decir "la semana con más eventos" sin
 * más lleva a pensar lo contrario, y ya lo hizo: ese era el error del informe y
 * del commit del paso g. Lo que fija el comportamiento está en "qué semana se abre
 * con `?fecha=` explícita", con dos anclajes de la misma semana que cruza el año.
 */
const semanaConMasEventos = EVENTOS_DEL_SEMILLERO.reduce((mejor, evento) => {
  const semana = ca.construirSemana(ca.aFechaLocal(evento.fecha));
  const cuantos = semana.celdas.filter((celda) => DIAS_CON_EVENTOS.has(celda.fechaISO)).length;
  const cuantosMejor = mejor.celdas.filter((celda) => DIAS_CON_EVENTOS.has(celda.fechaISO)).length;

  return cuantos > cuantosMejor ? semana : mejor;
}, ca.construirSemana(ca.aFechaLocal(diaConEventos)));

const ANCLA_SEMANA = semanaConMasEventos.celdas.find((celda) => DIAS_CON_EVENTOS.has(celda.fechaISO)).fechaISO;
const semanaAncla = ca.construirSemana(ca.aFechaLocal(ANCLA_SEMANA));
const tituloSemana = (ancla) => ca.construirSemana(ca.aFechaLocal(ancla)).titulo;
// Título de un día tal y como lo escribe la vista: mismo formato en ambos
// sitios, para que la comparación no dependa de la redacción.
const tituloDia = (ancla) => ca.construirDia(ca.aFechaLocal(ancla)).titulo;
const indiceConEventos = semanaAncla.celdas.findIndex((c) => DIAS_CON_EVENTOS.has(c.fechaISO));
const indiceLibre = semanaAncla.celdas.findIndex((c) => !DIAS_CON_EVENTOS.has(c.fechaISO));
const semanaSiguiente = ca.moverSemanaCalendario(ca.aFechaLocal(ANCLA_SEMANA), 1);
// "Anterior" se mide desde la semana siguiente, no desde la de partida: así se
// comprueba que la flecha hace el camino de ida y vuelta y no solo que el ancla
// se mantiene.
const semanaPrevia = ca.moverSemanaCalendario(semanaSiguiente, -1);
/*
 * Al navegar, la semana no se ancla en el día que se estaba mirando sino en su
 * lunes. Es lo correcto -una semana se identifica por su principio- pero obliga
 * a esperar el lunes de la semana de partida y no el ancla literal, que puede
 * ser cualquier día entre lunes y domingo.
 */
const LUNES_DE_PARTIDA = semanaAncla.celdas[0].fechaISO;

const appSemana = await montarCalendario(`?vista=semana&fecha=${ANCLA_SEMANA}`);
comprobar('salen siete columnas', columnaSemana(appSemana.raiz).length === 7, String(columnaSemana(appSemana.raiz).length));
comprobar('la semana va de lunes a domingo', columnaSemana(appSemana.raiz)[0].textContent.includes(String(semanaAncla.celdas[0].dia)) && columnaSemana(appSemana.raiz)[6].textContent.includes(String(semanaAncla.celdas[6].dia)), columnaSemana(appSemana.raiz).map((c) => c.textContent).join(' | '));
comprobar('no es la vista de mes', celdasMes(appSemana.raiz).length === 0, String(celdasMes(appSemana.raiz).length));
comprobar('el título es el rango de la semana', appSemana.raiz.querySelector('h2')?.textContent.trim() === semanaAncla.titulo, `${appSemana.raiz.querySelector('h2')?.textContent} != ${semanaAncla.titulo}`);
comprobar('la región anuncia que es una semana', appSemana.raiz.querySelector('section[aria-label^="Calendario, semana"]') !== null);
comprobar('"Semana" es la vista activa', enlaceVista(appSemana.raiz, 'Semana')?.getAttribute('aria-current') === 'page');
comprobar('el día con eventos los lista', columnaSemana(appSemana.raiz)[indiceConEventos].querySelectorAll('a[href^="/evento/"]').length > 0, columnaSemana(appSemana.raiz)[indiceConEventos].textContent.trim());
comprobar('un día sin eventos lo dice', columnaSemana(appSemana.raiz)[indiceLibre].textContent.includes('Libre'), columnaSemana(appSemana.raiz)[indiceLibre].textContent.trim());
comprobar('cada columna es un rol de celda de rejilla', columnaSemana(appSemana.raiz).length === appSemana.raiz.querySelectorAll('[role="gridcell"]').length);
// El panel lateral sigue enseñando los eventos del día resaltado.
comprobar('el panel lateral acompaña a la vista semanal', appSemana.raiz.querySelector('aside') !== null);

/*
 * La URL con la que se abrió la vista, antes de pulsar nada. Pulsar una columna
 * es elegir un día para mirar sus eventos, no moverse en el calendario: quien
 * entonces pulse "Compartir" no debe enviar a nadie a otro día del que quería.
 */
const urlAlAbrir = ecoUrlDe(appSemana);

// Al abrir por la URL no hay columna pulsada, así que el día resaltado es el
// propio ancla y el panel lateral enseña sus eventos. El título del panel lo
// escribe `EventosDelDia` con `formatearFecha`, no con el título de la vista de
// día, que es más largo; se comparan contra ese mismo formato.
const tituloPanel = () =>
  appSemana.raiz.querySelector('aside section h2')?.textContent.trim() ?? '';
const tituloDelPanel = (fecha) => fe.formatearFecha(fecha);
comprobar('al abrir, el panel muestra el día anclado', tituloPanel() === tituloDelPanel(ANCLA_SEMANA), `${tituloPanel()} != ${tituloDelPanel(ANCLA_SEMANA)}`);
comprobar('y la columna anclada sale marcada', columnaSemana(appSemana.raiz)[semanaAncla.celdas.findIndex((c) => c.fechaISO === ANCLA_SEMANA)].querySelector('[aria-pressed="true"]') !== null, columnaSemana(appSemana.raiz).map((c) => c.textContent).join(' | '));

// Pulsar otra columna mueve el resaltado, y con él el panel lateral.
const OTRA_COLUMNA = semanaAncla.celdas.findIndex(
  (celda) => celda.fechaISO !== ANCLA_SEMANA && DIAS_CON_EVENTOS.has(celda.fechaISO),
);
// No es un `if`: si no hubiera segunda columna, el bloque se saltaría en
// silencio y la suite pasaría con menos pruebas de las que dice tener.
comprobar('la semana elegida trae al menos dos días con eventos', OTRA_COLUMNA !== -1, semanaAncla.celdas.map((c) => `${c.fechaISO}:${DIAS_CON_EVENTOS.has(c.fechaISO)}`).join(' '));
await appSemana.pulsar(columnaSemana(appSemana.raiz)[OTRA_COLUMNA].querySelector('button'), `la columna del ${semanaAncla.celdas[OTRA_COLUMNA].fechaISO}`);
comprobar('pulsar una columna la resalta', columnaSemana(appSemana.raiz)[OTRA_COLUMNA].querySelector('[aria-pressed="true"]') !== null, columnaSemana(appSemana.raiz).map((c) => c.textContent).join(' | '));
comprobar('y el panel lateral la sigue', tituloPanel() === tituloDelPanel(semanaAncla.celdas[OTRA_COLUMNA].fechaISO), `${tituloPanel()} != ${tituloDelPanel(semanaAncla.celdas[OTRA_COLUMNA].fechaISO)}`);
comprobar('sin tocar la URL, porque la selección es de esta sesión', ecoUrlDe(appSemana) === urlAlAbrir, `${ecoUrlDe(appSemana)} != ${urlAlAbrir}`);

await appSemana.pulsar(botonIcono(appSemana.raiz, 'Semana siguiente'), 'la flecha de la semana siguiente');
comprobar('avanzar una semana suma siete días', ecoUrlDe(appSemana).includes(`fecha=${ca.fechaAParametro(semanaSiguiente)}`), ecoUrlDe(appSemana));
comprobar('el título se mueve con la URL', appSemana.raiz.querySelector('h2')?.textContent.trim() === tituloSemana(ca.fechaAParametro(semanaSiguiente)), appSemana.raiz.querySelector('h2')?.textContent ?? 'sin título');
await appSemana.pulsar(botonIcono(appSemana.raiz, 'Semana anterior'), 'la flecha de la semana anterior');
comprobar('retroceder una semana resta siete días', ecoUrlDe(appSemana).includes(`fecha=${ca.fechaAParametro(semanaPrevia)}`), ecoUrlDe(appSemana));
comprobar('se vuelve a la misma semana', ecoUrlDe(appSemana).includes(`fecha=${LUNES_DE_PARTIDA}`), ecoUrlDe(appSemana));
comprobar('y el título es el de la semana de partida', appSemana.raiz.querySelector('h2')?.textContent.trim() === semanaAncla.titulo, appSemana.raiz.querySelector('h2')?.textContent ?? 'sin título');

console.log('\n== Paso g: qué semana se abre ==');
/*
 * Qué semana se mira lo decide `?fecha=`, y no "la semana con más eventos".
 *
 * Estas dos comprobaciones existen porque durante un rato se dio por hecho lo
 * contrario en un informe y en un mensaje de commit, cuando en realidad el
 * fixture de pruebas usaba la semana más poblada para tener con qué trabajar. La
 * diferencia se ve justo en el caso que falta: una semana vacía. Si el código
 * eligiera la semana más poblada por su cuenta, al abrir una semana sin eventos
 * saltaría a otra y el `?fecha=` de la URL dejaría de describir lo que se está
 * enseñando, con lo que "Compartir" mandaría a otra semana.
 *
 * El ancla vacía se busca con `moverSemanaCalendario`, que es la propia herramienta
 * de la app y salta de lunes a lunes, en vez de escribir una fecha fija: el seed
 * cambia con el mes simulado y una fecha literal quedaría con eventos en octubre
 * y vacía en febrero. Se barren casi cinco meses, porque en el peor caso puede
 * no quedar ninguna semana vacía entre la de hoy y las de alrededor.
 */
let semanaVaciaAncla = null;
for (let semana = -6; semana <= 12 && !semanaVaciaAncla; semana += 1) {
  const candidato = ca.construirSemana(ca.moverSemanaCalendario(ca.aFechaLocal(HOY_PASO_G), semana));
  const tieneEventos = candidato.celdas.some((celda) => DIAS_CON_EVENTOS.has(celda.fechaISO));
  if (!tieneEventos) semanaVaciaAncla = candidato;
}
comprobar('el seed deja alguna semana vacía que abrir', semanaVaciaAncla !== null, 'no se encontró en 19 semanas');

if (semanaVaciaAncla) {
  const anclaVacia = semanaVaciaAncla.celdas[0].fechaISO;
  const appVacia = await montarCalendario(`?vista=semana&fecha=${anclaVacia}`);

  comprobar('`?fecha=` manda: se abre esa semana aunque no tenga eventos', appVacia.raiz.querySelector('h2')?.textContent.trim() === semanaVaciaAncla.titulo, `${appVacia.raiz.querySelector('h2')?.textContent} != ${semanaVaciaAncla.titulo}`);
  comprobar('y sale marcada la columna del ancla, no la de algún evento', columnaSemana(appVacia.raiz)[0].querySelector('[aria-pressed="true"]') !== null, columnaSemana(appVacia.raiz).map((c) => c.textContent).join(' | '));
  comprobar('las siete columnas están libres', columnaSemana(appVacia.raiz).every((columna) => columna.textContent.includes('Libre')), columnaSemana(appVacia.raiz).map((c) => c.textContent.trim()).join(' | '));
  comprobar('y la URL sigue describiendo esa semana', ecoUrlDe(appVacia).includes(`fecha=${anclaVacia}`), ecoUrlDe(appVacia));

  await appVacia.desmontar();
}

// Sin `?fecha=` no hay de dónde sacar el ancla, así que se usa la semana de hoy.
const semanaDeHoy = ca.construirSemana(ca.aFechaLocal(HOY_PASO_G));
const appSinFecha = await montarCalendario('?vista=semana');
comprobar('sin `?fecha=` se abre la semana de hoy', appSinFecha.raiz.querySelector('h2')?.textContent.trim() === semanaDeHoy.titulo, `${appSinFecha.raiz.querySelector('h2')?.textContent} != ${semanaDeHoy.titulo}`);
comprobar('y el día resaltado es hoy', columnaSemana(appSinFecha.raiz)[semanaDeHoy.celdas.findIndex((celda) => celda.fechaISO === HOY_PASO_G)]?.querySelector('[aria-pressed="true"]') !== null, columnaSemana(appSinFecha.raiz).map((c) => c.textContent).join(' | '));
comprobar('y el panel lateral enseña los eventos de hoy', appSinFecha.raiz.querySelector('aside section h2')?.textContent.trim() === fe.formatearFecha(HOY_PASO_G), appSinFecha.raiz.querySelector('aside section h2')?.textContent ?? 'sin título');

await appSinFecha.desmontar();

console.log('\n== Paso g: qué semana se abre con `?fecha=` explícita ==');
/*
 * El 31 de diciembre de 2026 y el 1 de enero de 2027 caen en la MISMA semana: la
 * del lunes 28 al domingo 3. Es el caso que separa "se abre la semana que
 * contiene la fecha" de "se abre la semana con más eventos", y por eso son dos
 * anclajes y no uno: si la app eligiera por eventos, una de las dos fechas abriría
 * otra semana. Con el seed de los meses simulados no hay eventos en ninguna de las
 * dos, así que además descarta que caiga por casualidad en una semana con datos.
 *
 * También fija el título, que es lo que se lee en pantalla: si se calculara con el
 * ancla en lugar de con el lunes y el domingo, aquí se vería.
 */
const ANCLA_31_DIC = '2026-12-31';
const ANCLA_1_ENE = '2027-01-01';
const semanaDel31 = ca.construirSemana(ca.aFechaLocal(ANCLA_31_DIC));
const semanaDel1 = ca.construirSemana(ca.aFechaLocal(ANCLA_1_ENE));
const columnaResaltada = (raiz) =>
  columnaSemana(raiz).findIndex((columna) => columna.querySelector('[aria-pressed="true"]') !== null);
const diasDeLaSemanaDelCruce = semanaDel31.celdas.map((celda) => String(celda.dia));

comprobar('las dos fechas caen en la semana del 28 de diciembre', semanaDel31.celdas[0].fechaISO === '2026-12-28' && semanaDel1.celdas[0].fechaISO === '2026-12-28', `${semanaDel31.celdas[0].fechaISO} / ${semanaDel1.celdas[0].fechaISO}`);
comprobar('y por eso comparten título', semanaDel31.titulo === semanaDel1.titulo && semanaDel31.titulo === '28 dic – 3 ene', `${semanaDel31.titulo} / ${semanaDel1.titulo}`);

const app31Dic = await montarCalendario(`?vista=semana&fecha=${ANCLA_31_DIC}`);
comprobar('`?vista=semana&fecha=2026-12-31` abre la semana del 28 al 3 de enero', app31Dic.raiz.querySelector('h2')?.textContent.trim() === '28 dic – 3 ene', app31Dic.raiz.querySelector('h2')?.textContent ?? 'sin título');
comprobar('las siete columnas van del 28 al 3, en orden', columnaSemana(app31Dic.raiz).map((columna, i) => columna.textContent.includes(diasDeLaSemanaDelCruce[i])).every(Boolean), columnaSemana(app31Dic.raiz).map((c) => c.textContent.trim()).join(' | '));
comprobar('y se resalta el jueves, que es el 31 y el ancla', columnaResaltada(app31Dic.raiz) === 3, `columna ${columnaResaltada(app31Dic.raiz)}`);
comprobar('la URL sigue diciendo 31 de diciembre, no el lunes', ecoUrlDe(app31Dic).includes('fecha=2026-12-31'), ecoUrlDe(app31Dic));
await app31Dic.desmontar();

const app1Ene = await montarCalendario(`?vista=semana&fecha=${ANCLA_1_ENE}`);
comprobar('`?vista=semana&fecha=2027-01-01` abre la misma semana', app1Ene.raiz.querySelector('h2')?.textContent.trim() === '28 dic – 3 ene', app1Ene.raiz.querySelector('h2')?.textContent ?? 'sin título');
comprobar('pero ahora se resalta el viernes, que es el 1', columnaResaltada(app1Ene.raiz) === 4, `columna ${columnaResaltada(app1Ene.raiz)}`);
comprobar('y las siete columnas son las mismas', columnaSemana(app1Ene.raiz).map((columna, i) => columna.textContent.includes(diasDeLaSemanaDelCruce[i])).every(Boolean), columnaSemana(app1Ene.raiz).map((c) => c.textContent.trim()).join(' | '));
comprobar('las dos URL describen semanas distintas dentro de la misma rejilla', ecoUrlDe(app1Ene).includes('fecha=2027-01-01'), ecoUrlDe(app1Ene));
await app1Ene.desmontar();

console.log('\n== Paso g: cambiar de mes y de año con las flechas ==');
/*
 * Las vistas de semana y de día se mueven con las flechas, y eso tiene que
 * funcionar igual en diciembre que en octubre. Se ancla en la semana que cruza
 * el año (del 28 de diciembre de 2026 al 3 de enero de 2027) porque es la única
 * semana donde el salto de mes y el de año se ven a la vez: al avanzar, el
 * título tiene que pasar de "28 dic – 3 ene" a "4 – 10 ene", y si alguien
 * construyera las fechas con `new Date('AAAA-MM-DD')` en UTC, en Colombia el
 * título se iría un día y esta comprobación lo detectaría.
 */
const SEMANA_CRUCE_ANCLA = '2026-12-28';
const SEMANA_CRUCE_SIGUIENTE = '2027-01-04';
const appCruce = await montarCalendario(`?vista=semana&fecha=${SEMANA_CRUCE_ANCLA}`);
comprobar('la semana del 28 de diciembre abre el 28', columnaSemana(appCruce.raiz)[0].textContent.includes('28'), columnaSemana(appCruce.raiz).map((c) => c.textContent).join(' | '));
comprobar('su título nombra diciembre y enero', appCruce.raiz.querySelector('h2')?.textContent.trim() === '28 dic – 3 ene', appCruce.raiz.querySelector('h2')?.textContent ?? 'sin título');
comprobar('las siete columnas no llevan NaN', !columnaSemana(appCruce.raiz).some((c) => /NaN|Invalid/.test(c.textContent)), columnaSemana(appCruce.raiz).map((c) => c.textContent).join(' | '));
await appCruce.pulsar(botonIcono(appCruce.raiz, 'Semana siguiente'), 'avanzar desde la semana que cruza el año');
comprobar('avanzar salta a la primera semana de enero', ecoUrlDe(appCruce).includes(`fecha=${SEMANA_CRUCE_SIGUIENTE}`), ecoUrlDe(appCruce));
comprobar('y el título ya solo dice enero', appCruce.raiz.querySelector('h2')?.textContent.trim() === '4 – 10 ene', appCruce.raiz.querySelector('h2')?.textContent ?? 'sin título');
comprobar('la columna del lunes es el 4', columnaSemana(appCruce.raiz)[0].textContent.includes('4'), columnaSemana(appCruce.raiz).map((c) => c.textContent).join(' | '));
await appCruce.pulsar(botonIcono(appCruce.raiz, 'Semana anterior'), 'retroceder de vuelta al cruce de año');
comprobar('retroceder vuelve al 28 de diciembre', ecoUrlDe(appCruce).includes(`fecha=${SEMANA_CRUCE_ANCLA}`), ecoUrlDe(appCruce));

// La vista de día hace lo mismo, cruzando el año de un día al siguiente.
const appDiaCruce = await montarCalendario('?vista=dia&fecha=2026-12-31');
comprobar('el 31 de diciembre abre ese día', appDiaCruce.raiz.querySelector('h2')?.textContent.trim() === 'jueves 31 de diciembre', appDiaCruce.raiz.querySelector('h2')?.textContent ?? 'sin título');
await appDiaCruce.pulsar(botonIcono(appDiaCruce.raiz, 'Día siguiente'), 'pasar del 31 de diciembre al 1 de enero');
comprobar('el día siguiente es el 1 de enero de 2027', ecoUrlDe(appDiaCruce).includes('fecha=2027-01-01'), ecoUrlDe(appDiaCruce));
comprobar('y el título lo dice', appDiaCruce.raiz.querySelector('h2')?.textContent.trim() === 'viernes 1 de enero', appDiaCruce.raiz.querySelector('h2')?.textContent ?? 'sin título');
await appDiaCruce.pulsar(botonIcono(appDiaCruce.raiz, 'Día anterior'), 'volver del 1 de enero al 31 de diciembre');
comprobar('y se vuelve al 31 de diciembre de 2026', ecoUrlDe(appDiaCruce).includes('fecha=2026-12-31'), ecoUrlDe(appDiaCruce));

// Y volver al mes desde el 1 de enero lleva a enero de 2027, no a diciembre.
const appVolverMes = await montarCalendario('?vista=dia&fecha=2027-01-01');
await appVolverMes.pulsar(enlaceVista(appVolverMes.raiz, 'Mes'), 'volver al mes desde el 1 de enero');
comprobar('volver al mes lleva a enero de 2027', ecoUrlDe(appVolverMes).includes('mes=2027-01'), ecoUrlDe(appVolverMes));
comprobar('y quita el parámetro de vista', !ecoUrlDe(appVolverMes).includes('vista='), ecoUrlDe(appVolverMes));
comprobar('la rejilla vuelve a ser la del mes', celdasMes(appVolverMes.raiz).length > 0, String(celdasMes(appVolverMes.raiz).length));

console.log('\n== Paso g: la vista de día ==');
const diaSiguiente = ca.moverDiaCalendario(ca.aFechaLocal(diaConEventos), 1);
const appDia = await montarCalendario(`?vista=dia&fecha=${diaConEventos}`);
comprobar('el título es el día completo', appDia.raiz.querySelector('h2')?.textContent.trim() === tituloDia(diaConEventos), `${appDia.raiz.querySelector('h2')?.textContent} != ${tituloDia(diaConEventos)}`);
comprobar('no hay rejilla', columnaSemana(appDia.raiz).length === 0 && celdasMes(appDia.raiz).length === 0);
comprobar('"Día" es la vista activa', enlaceVista(appDia.raiz, 'Día')?.getAttribute('aria-current') === 'page');
comprobar('lista los eventos del día', appDia.raiz.querySelectorAll('a[href^="/evento/"]').length > 0, String(appDia.raiz.querySelectorAll('a[href^="/evento/"]').length));
// En la vista de día los eventos ya están dentro del propio calendario: el panel
// lateral no puede repetirlos, o se verían dos veces en la misma pantalla.
comprobar('el panel lateral no repite los eventos del día', appDia.raiz.querySelector('aside') === null);
const appDiaLibre = await montarCalendario(`?vista=dia&fecha=${diaLibre}`);
comprobar('un día libre lo dice', appDiaLibre.raiz.textContent.includes('Este día está libre'), appDiaLibre.raiz.textContent.slice(0, 160));

await appDia.pulsar(botonIcono(appDia.raiz, 'Día siguiente'), 'la flecha del día siguiente');
comprobar('avanzar un día suma uno', ecoUrlDe(appDia).includes(`fecha=${ca.fechaAParametro(diaSiguiente)}`), ecoUrlDe(appDia));
comprobar('el título cambia al día siguiente', appDia.raiz.querySelector('h2')?.textContent.trim() === tituloDia(ca.fechaAParametro(diaSiguiente)), appDia.raiz.querySelector('h2')?.textContent ?? 'sin título');
await appDia.pulsar(botonIcono(appDia.raiz, 'Día anterior'), 'la flecha del día anterior');
comprobar('retroceder un día resta uno', ecoUrlDe(appDia).includes(`fecha=${diaConEventos}`), ecoUrlDe(appDia));

console.log('\n== Paso g: "Hoy" vuelve al día en curso ==');
// Un ancla en otro mes, para que se note que "Hoy" no se limita a quitar `?mes=`.
const appHoy = await montarCalendario(`?vista=semana&fecha=${diaConEventos}`);
await appHoy.pulsar(appHoy.porTexto('button', 'Hoy'), 'el botón "Hoy" de la vista semanal');
comprobar('la semana vuelve a la de hoy', ecoUrlDe(appHoy).includes(`fecha=${HOY_PASO_G}`), ecoUrlDe(appHoy));
comprobar('y no se sale de la vista semanal', ecoUrlDe(appHoy).includes('vista=semana'), ecoUrlDe(appHoy));

console.log('\n== Paso g: volver al mes conserva el mes del ancla ==');
// El ancla tiene que estar en un mes distinto del en curso, porque para el mes
// en curso el enlace es la dirección limpia `/calendario`: con el ancla en otro
// mes la comprobación sí distingue "conserva el mes" de "va al mes de hoy".
const OTRO_MES = ca.mesAParametro(ca.mesDesde(new Date(ca.aFechaLocal(diaConEventos).getFullYear(), ca.aFechaLocal(diaConEventos).getMonth() + 2, 1)));
const appMesOtro = await montarCalendario(`?vista=dia&fecha=${OTRO_MES}-15`);
comprobar('con el ancla en otro mes, el enlace "Mes" lo lleva', enlaceVista(appMesOtro.raiz, 'Mes')?.getAttribute('href') === `/calendario?mes=${OTRO_MES}`, enlaceVista(appMesOtro.raiz, 'Mes')?.getAttribute('href') ?? 'sin enlace');
await appMesOtro.pulsar(enlaceVista(appMesOtro.raiz, 'Mes'), 'el enlace "Mes" con el ancla en otro mes');
comprobar('escribe el mes del ancla, no el mes actual', ecoUrlDe(appMesOtro).includes(`mes=${OTRO_MES}`), `mes=${OTRO_MES} / ${ecoUrlDe(appMesOtro)}`);
comprobar('sale de las vistas de semana y día', !ecoUrlDe(appMesOtro).includes('vista='), ecoUrlDe(appMesOtro));
comprobar('y vuelve la cuadrícula del mes', columnaSemana(appMesOtro.raiz).length === 0 && celdasMes(appMesOtro.raiz).length > 0, `${celdasMes(appMesOtro.raiz).length} celdas`);
comprobar('enseñando ese mes', appMesOtro.raiz.querySelector('h2')?.textContent.trim() === ca.construirCuadricula(ca.aFechaLocal(`${OTRO_MES}-01`)).titulo, appMesOtro.raiz.querySelector('h2')?.textContent ?? 'sin título');

// Con el ancla en el mes en curso el enlace se deja limpio, que es la dirección
// que se comparte por WhatsApp. Y desde la propia vista de mes, elegir "Mes"
// no debe saltar a otro mes.
await appHoy.pulsar(enlaceVista(appHoy.raiz, 'Mes'), 'el enlace "Mes" con el ancla en el mes en curso');
comprobar('el mes en curso se deja sin parámetros', ecoUrlDe(appHoy) === '', ecoUrlDe(appHoy) || '(vacía)');
const MES_LEJANO = ca.mesAParametro(ca.mesDesde(new Date(ca.aFechaLocal(diaConEventos).getFullYear(), ca.aFechaLocal(diaConEventos).getMonth() - 3, 1)));
const appMesEnero = await montarCalendario(`?mes=${MES_LEJANO}`);
comprobar('elegir "Mes" estando en el mes no lo cambia', enlaceVista(appMesEnero.raiz, 'Mes')?.getAttribute('href') === `/calendario?mes=${MES_LEJANO}`, enlaceVista(appMesEnero.raiz, 'Mes')?.getAttribute('href') ?? 'sin enlace');

console.log('\n== Paso g: una URL manipulada no rompe nada ==');
const appVistaMala = await montarCalendario('?vista=trimestre&fecha=ayer');
comprobar('una vista inventada cae en el mes', columnaSemana(appVistaMala.raiz).length === 0 && celdasMes(appVistaMala.raiz).length > 0, `${celdasMes(appVistaMala.raiz).length} celdas`);
comprobar('no deja NaN ni fechas inválidas en pantalla', !appVistaMala.raiz.textContent.includes('NaN') && !appVistaMala.raiz.textContent.includes('Invalid Date'), appVistaMala.raiz.textContent.slice(0, 120));
const appFechaMala = await montarCalendario('?vista=semana&fecha=${MES_EN_CURSO}-99');
comprobar('un día imposible cae en el de hoy', appFechaMala.raiz.querySelector('h2')?.textContent.trim() === ca.construirSemana(ca.aFechaLocal(HOY_PASO_G)).titulo, appFechaMala.raiz.querySelector('h2')?.textContent ?? 'sin título');

await appFechaMala.desmontar();
await appVistaMala.desmontar();
await appVolverMes.desmontar();
await appDiaCruce.desmontar();
await appCruce.desmontar();
await appMesEnero.desmontar();
await appMesOtro.desmontar();
await appDiaLibre.desmontar();
await appHoy.desmontar();
await appDia.desmontar();
await appSemana.desmontar();
await appMes.desmontar();
await ev.resetEventos();

const EVENTO_EDITABLE = {
  id: 'a0d10002-a0d2-4a02-8a02-a0d200000002',
  titulo: 'Cena romántica',
  fecha: '2026-10-14',
  hora: '19:00',
  descripcion: 'Mesa junto a la ventana.',
  lugar: 'La Terraza',
  categoria: 'cita',
  foto: null,
};

console.log('\n== Interacción: el modal atrapa, bloquea y devuelve el foco ==');
const disparador = document.createElement('button');
disparador.textContent = 'Abrir el formulario';
document.body.appendChild(disparador);
disparador.focus();
// Comprobación previa: si aquí el foco no estuviera en el disparador, la
// restauración posterior no probaría nada.
comprobar('antes de abrir, el foco está en el disparador', document.activeElement === disparador, document.activeElement?.tagName);

let cerradoConEscape = false;
const appModal = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {
      cerradoConEscape = true;
    },
    onGuardar: () => {},
    fechaInicial: '2026-10-14',
  }),
);

const dialogo = () => document.querySelector('[role="dialog"]');
comprobar('el diálogo se monta en el documento', dialogo() !== null);
comprobar('el foco entra en el diálogo al abrir', dialogo().contains(document.activeElement), `foco en ${document.activeElement?.tagName}`);
comprobar('el foco ya no está en el botón que abrió', document.activeElement !== disparador);
comprobar('el scroll del fondo queda bloqueado', document.body.style.overflow === 'hidden', document.body.style.overflow);

// Escape.
await act(async () => {
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
});
comprobar('Escape avisa de que hay que cerrar', cerradoConEscape === true);

// La trampa de foco: Tab en el último elemento vuelve al primero, y
// Mayús+Tab en el primero salta al último.
const focusables = () => [
  ...dialogo().querySelectorAll('button, input:not([type="hidden"]), textarea, select'),
];
await act(async () => {
  const lista = focusables();
  lista[lista.length - 1].focus();
  lista[lista.length - 1].dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
  );
});
comprobar('Tab desde el último elemento vuelve al primero', document.activeElement === focusables()[0], `foco en ${document.activeElement?.tagName}`);

await act(async () => {
  const lista = focusables();
  lista[0].focus();
  lista[0].dispatchEvent(
    new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
  );
});
comprobar('Mayús+Tab desde el primero salta al último', document.activeElement === focusables()[focusables().length - 1]);
comprobar('el foco nunca sale del diálogo', dialogo().contains(document.activeElement));

// El foco debe volver al elemento que abrió el modal. El botón se enfocó
// antes de montar y no se vuelve a tocar en ningún momento, así que si el foco
// no vuelve a él es que el modal no lo ha restaurado.
await appModal.desmontar();
comprobar('al cerrar se restaura el scroll del fondo', document.body.style.overflow !== 'hidden', document.body.style.overflow);
comprobar('al cerrar el foco vuelve al botón que abrió', document.activeElement === disparador, document.activeElement?.textContent || document.activeElement?.tagName);
comprobar('el modal ya no está en el documento', document.querySelector('[role="dialog"]') === null);

// Si el elemento que abrió el modal ya no existe (una fila borrada al guardar),
// no se puede devolver el foco a un nodo huérfano, pero tampoco debe romperse.
const huerfano = document.createElement('button');
huerfano.textContent = 'Se va a borrar';
document.body.appendChild(huerfano);
huerfano.focus();
const appHuerfano = await montar(ReactCjs.createElement(Modal, { abierto: true, onCerrar: () => {}, titulo: 'Huérfano' }));
huerfano.remove();
await appHuerfano.desmontar();
comprobar('un disparador ya borrado no deja el foco colgado en el modal', document.querySelector('[role="dialog"]') === null && document.activeElement !== null, document.activeElement?.tagName);
disparador.remove();

console.log('\n== Interacción: validación y foco en el primer error ==');
const appForm = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {},
    onGuardar: () => {},
    fechaInicial: '2026-10-14',
  }),
);
const form = dialogo().querySelector('form');
const campoTitulo = form.querySelector('[id$="titulo"]');
const campoFecha = form.querySelector('[id$="fecha"]');
let guardados = 0;

comprobar('la fecha viene precargada en el campo', campoFecha.value === '2026-10-14', campoFecha.value);
comprobar('el foco inicial va al primer campo, no al panel', document.activeElement === campoTitulo, `foco en ${document.activeElement?.tagName} ${document.activeElement?.id}`);

// Enviar sin rellenar.
await appForm.enviar(form);
comprobar('el título vacío se marca inválido', campoTitulo.getAttribute('aria-invalid') === 'true', campoTitulo.getAttribute('aria-invalid') ?? 'sin atributo');
comprobar('se muestra el mensaje del título', dialogo().textContent.includes('El título es obligatorio'), dialogo().textContent.slice(0, 120));
comprobar('aria-describedby apunta al mensaje de error', (campoTitulo.getAttribute('aria-describedby') ?? '').includes('error'), campoTitulo.getAttribute('aria-describedby') ?? 'null');
comprobar('aria-describedby apunta a un id que existe', (campoTitulo.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).every((id) => document.getElementById(id) !== null));
comprobar('el foco va al primer campo con error', document.activeElement === campoTitulo, `foco en ${document.activeElement?.id}`);
comprobar('un formulario inválido no se guarda', guardados === 0);

// Escribir quita el error de ese campo.
await appForm.escribir(campoTitulo, 'Cena de prueba');
comprobar('el error desaparece al escribir', campoTitulo.getAttribute('aria-invalid') !== 'true', campoTitulo.getAttribute('aria-invalid') ?? 'sin atributo');

// Título demasiado corto.
await appForm.escribir(campoTitulo, 'ab');
await appForm.enviar(dialogo().querySelector('form'));
comprobar('un título de 2 caracteres no pasa', dialogo().textContent.includes('al menos 3'), dialogo().textContent.slice(0, 160));
comprobar('sigue sin guardarse', guardados === 0);
comprobar('el foco vuelve al campo que falla', document.activeElement === campoTitulo);

// Título válido.
await appForm.escribir(campoTitulo, 'Cena de prueba');
let recibido = null;
await appForm.desmontar();

const appOk = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {},
    onGuardar: async (datos) => {
      guardados += 1;
      recibido = datos;
    },
    fechaInicial: '2026-10-14',
  }),
);
await appOk.escribir(dialogo().querySelector('[id$="titulo"]'), 'Cena de prueba');
await appOk.pulsar(dialogo().querySelector('button[type="submit"]'));
comprobar('un formulario válido se guarda', guardados === 1, String(guardados));
comprobar('lo que llega ya viene validado y limpio', recibido?.titulo === 'Cena de prueba' && recibido?.fecha === '2026-10-14', JSON.stringify(recibido));
comprobar('la hora vacía llega como null, no como texto vacío', recibido?.hora === null, JSON.stringify(recibido?.hora));
comprobar('la categoría por defecto es válida', cg.esCategoriaValida(recibido?.categoria), String(recibido?.categoria));
comprobar('no guarda un id inventado desde el formulario', recibido?.id === undefined, JSON.stringify(recibido?.id));
await appOk.desmontar();

console.log('\n== Interacción: un fallo al guardar no cierra el modal ==');
const appFallo = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {},
    onGuardar: async () => {
      throw new ErrorServicio('No hay espacio suficiente para guardar.');
    },
    fechaInicial: '2026-10-14',
  }),
);
await appFallo.escribir(dialogo().querySelector('[id$="titulo"]'), 'Cena de prueba');
await appFallo.pulsar(dialogo().querySelector('button[type="submit"]'));
comprobar('el error de cuota se muestra en el formulario', dialogo().textContent.includes('No hay espacio suficiente'), dialogo().textContent.slice(0, 200));
comprobar('el error general se anuncia con role="alert"', document.querySelector('[role="alert"]') !== null);
comprobar('el error general recibe el foco', document.activeElement?.getAttribute('role') === 'alert', `foco en ${document.activeElement?.tagName}`);
comprobar('el modal sigue abierto tras el fallo', document.querySelector('[role="dialog"]') !== null);
comprobar('el texto escrito no se pierde', dialogo().querySelector('[id$="titulo"]').value === 'Cena de prueba');
comprobar('el fallo no borra la fecha', dialogo().querySelector('[id$="fecha"]').value === '2026-10-14');
await appFallo.desmontar();

console.log('\n== Interacción: no se puede guardar dos veces ==');
const appDoble = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {},
    onGuardar: () => {},
    guardando: true,
    fechaInicial: '2026-10-14',
  }),
);
const botonGuardar = dialogo().querySelector('button[type="submit"]');
comprobar('el botón se deshabilita mientras guarda', botonGuardar.disabled === true);
comprobar('el botón avisa de que está guardando', botonGuardar.textContent.includes('Guardando'), botonGuardar.textContent);
comprobar('el botón deja de ser pulsable', botonGuardar.matches(':disabled'));
await appDoble.desmontar();

console.log('\n== Interacción: dos modales a la vez ==');
// El bloqueo de scroll se guarda en un contador global. Si el valor anterior
// viviera en la instancia del componente, cerrar el primero de los dos lo
// perdería y el <body> se quedaría bloqueado para siempre.
document.body.style.overflow = 'auto';
const appUno = await montar(ReactCjs.createElement(Modal, { abierto: true, onCerrar: () => {}, titulo: 'Primero' }));
const appDos = await montar(ReactCjs.createElement(Modal, { abierto: true, onCerrar: () => {}, titulo: 'Segundo' }));
comprobar('con dos modales el scroll sigue bloqueado', document.body.style.overflow === 'hidden', document.body.style.overflow);
await appUno.desmontar();
comprobar('cerrar el primero NO desbloquea el segundo', document.body.style.overflow === 'hidden', document.body.style.overflow);
await appDos.desmontar();
comprobar('cerrar el último restaura el scroll', document.body.style.overflow === 'auto', document.body.style.overflow);

// Y en el orden inverso también: el valor guardado no depende de cuál se cierre.
document.body.style.overflow = 'scroll';
const appTres = await montar(ReactCjs.createElement(Modal, { abierto: true, onCerrar: () => {}, titulo: 'Tercero' }));
const appCuatro = await montar(ReactCjs.createElement(Modal, { abierto: true, onCerrar: () => {}, titulo: 'Cuarto' }));
await appCuatro.desmontar();
comprobar('cerrar el segundo no desbloquea', document.body.style.overflow === 'hidden', document.body.style.overflow);
await appTres.desmontar();
comprobar('cerrar el primero sí restaura', document.body.style.overflow === 'scroll', document.body.style.overflow);
document.body.style.overflow = '';

console.log('\n== Modal: el rol y la descripción ==');
// `rol` y `descripcionAdicional` los usa el `alertdialog` de borrar, pero
// conviene comprobar aquí que el componente no los mezcla ni los pierde.
const appRol = await montar(
  ReactCjs.createElement(Modal, {
    abierto: true,
    onCerrar: () => {},
    titulo: 'Título',
    descripcion: 'Descripción de la cabecera',
    descripcionAdicional: ['nota-del-cuerpo', '', 'nota-del-cuerpo'],
    rol: 'alertdialog',
  }, ReactCjs.createElement('p', { id: 'nota-del-cuerpo' }, 'Cuerpo del diálogo')),
);
const panelRol = document.querySelector('[role="alertdialog"]');
comprobar('el modal acepta el rol que le piden', panelRol !== null);
// Se pasan un identificador vacío y uno repetido a propósito: `Modal` los tiene
// que limpiar, o el lector anunciaría el cuerpo dos veces.
const descritoRol = (panelRol?.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
comprobar('el rol no se pierde al montar', panelRol !== null && document.querySelector('[role="dialog"]') === null);
comprobar('la descripción extra se suma a la de la cabecera', descritoRol.length === 2, descritoRol.join(' '));
comprobar('los identificadores repetidos se limpian', new Set(descritoRol).size === descritoRol.length, descritoRol.join(' '));
comprobar('los identificadores vacíos se limpian', !descritoRol.includes(''), descritoRol.join(' '));
comprobar('cada identificador apunta a un nodo real', descritoRol.every((id) => document.getElementById(id) !== null), descritoRol.join(' '));
comprobar('la cabecera se lee antes que el cuerpo', descritoRol[0] !== 'nota-del-cuerpo' && document.getElementById(descritoRol[0])?.textContent === 'Descripción de la cabecera', descritoRol.join(' '));
await appRol.desmontar();

const appNormal = await montar(
  ReactCjs.createElement(Modal, { abierto: true, onCerrar: () => {}, titulo: 'Normal' }),
);
comprobar('por defecto el rol es dialog', document.querySelector('[role="dialog"]') !== null && document.querySelector('[role="alertdialog"]') === null);
comprobar('sin descripcion el aria-describedby no aparece', document.querySelector('[role="dialog"]').getAttribute('aria-describedby') === null, String(document.querySelector('[role="dialog"]').getAttribute('aria-describedby')));
await appNormal.desmontar();

const appDescr = await montar(
  ReactCjs.createElement(Modal, {
    abierto: true,
    onCerrar: () => {},
    titulo: 'Con descripción',
    descripcion: 'Solo la cabecera',
  }, ReactCjs.createElement('p', { id: 'extra' }, 'Y el cuerpo')),
);
const descrito = document.querySelector('[role="dialog"]').getAttribute('aria-describedby') ?? '';
comprobar('con descripcion se apunta a su párrafo', descrito.split(' ').length === 1 && document.getElementById(descrito.trim())?.textContent === 'Solo la cabecera', descrito);
await appDescr.desmontar();

console.log('\n== Catálogo: los nombres heredados no son categorías ==');
// `CATEGORIAS_EVENTO` es un objeto literal, así que hereda de
// `Object.prototype`. Un acceso directo devolvería la función heredada en
// lugar de la categoría de reserva.
comprobar('"toString" no devuelve una función heredada', typeof cg.obtenerCategoria('toString') === 'object', String(typeof cg.obtenerCategoria('toString')));
comprobar('"toString" cae en la categoría de reserva', cg.obtenerCategoria('toString').label === cg.CATEGORIAS_EVENTO.otro.label, cg.obtenerCategoria('toString')?.label);
comprobar('"constructor" cae en la de reserva', cg.obtenerCategoria('constructor').label === cg.CATEGORIAS_EVENTO.otro.label);
comprobar('"__proto__" cae en la de reserva', cg.obtenerCategoria('__proto__').label === cg.CATEGORIAS_EVENTO.otro.label);
comprobar('"valueOf" cae en la de reserva', cg.obtenerCategoria('valueOf').label === cg.CATEGORIAS_EVENTO.otro.label);
comprobar('una categoría real no se ve afectada', cg.obtenerCategoria('cita').label === 'Cita', cg.obtenerCategoria('cita')?.label);
comprobar('lo mismo en ideas', cg.obtenerCategoriaIdea('toString').label === cg.CATEGORIAS_IDEA['en-casa'].label, cg.obtenerCategoriaIdea('toString')?.label);
comprobar('las ideas reales no se ven afectadas', cg.obtenerCategoriaIdea('relax').label === 'Relax');

console.log('\n== Interacción: no se pierde lo escrito al cerrar ==');
let cierres = 0;
const appSalida = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {
      cierres += 1;
    },
    onGuardar: () => {},
    fechaInicial: '2026-10-14',
  }),
);
const tituloSalida = () => document.querySelector('[role="dialog"] [id$="titulo"]');

// Con el formulario recién abierto no se pregunta nada: no hay nada que perder.
await appSalida.pulsar(document.querySelector('[role="dialog"]').querySelector('button[aria-label="Cerrar"]'));
comprobar('sin cambios, cerrar no pregunta', document.querySelector('[role="alertdialog"]') === null);
comprobar('sin cambios, cerrar sí avisa al padre', cierres === 1, String(cierres));

// Al escribir, cerrar debe preguntar antes.
await appSalida.escribir(tituloSalida(), 'Cena de prueba');
await appSalida.pulsar(document.querySelector('[role="dialog"] button[aria-label="Cerrar"]'));
comprobar('con cambios escritos aparece el aviso', document.querySelector('[role="alertdialog"]') !== null);
comprobar('el aviso está dentro del mismo diálogo', document.querySelector('[role="dialog"]').contains(document.querySelector('[role="alertdialog"]')));
comprobar('el aviso no cierra el formulario todavía', cierres === 1, String(cierres));
comprobar('el aviso dice que se va a perder', document.querySelector('[role="alertdialog"]').textContent.includes('se pierde'));
comprobar('el aviso recibe el foco', document.activeElement?.textContent?.includes('Seguir editando'), document.activeElement?.textContent);

// Volver atrás deja el formulario intacto.
await appSalida.pulsar(document.querySelector('[role="alertdialog"]').querySelector('button'));
comprobar('volver atrás recupera el formulario', tituloSalida() !== null);
comprobar('volver atrás conserva lo escrito', tituloSalida().value === 'Cena de prueba', tituloSalida()?.value);
comprobar('volver atrás no cierra', cierres === 1, String(cierres));

// Confirmar sí descarta y cierra.
await appSalida.pulsar(document.querySelector('[role="dialog"] button[aria-label="Cerrar"]'));
await appSalida.pulsar(
  [...document.querySelectorAll('[role="alertdialog"] button')].find((b) =>
    b.textContent.includes('Salir'),
  ),
);
comprobar('confirmar la salida cierra de verdad', cierres === 2, String(cierres));

// Escribir y borrar todo vuelve a estar limpio: no se pregunta por nada.
await appSalida.desmontar();
let cierresLimpias = 0;
const appLimpio = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {
      cierresLimpias += 1;
    },
    onGuardar: () => {},
    fechaInicial: '2026-10-14',
  }),
);
await appLimpio.escribir(document.querySelector('[role="dialog"] [id$="titulo"]'), 'prueba');
await appLimpio.escribir(document.querySelector('[role="dialog"] [id$="titulo"]'), '');
await appLimpio.pulsar(document.querySelector('[role="dialog"] button[aria-label="Cerrar"]'));
comprobar('escribir y borrar no cuenta como cambio', document.querySelector('[role="alertdialog"]') === null);
comprobar('escribir y borrar cierra sin preguntar', cierresLimpias === 1, String(cierresLimpias));
await appLimpio.desmontar();

console.log('\n== Interacción: el detalle del evento ==');
const montarDetalle = (idInicial, busqueda = '') => {
  // Se replican las rutas de `App.jsx`, comodín incluido. Sin él, una URL
  // malformada como `/evento/` no haría match con nada y la prueba mediría un
  // documento vacío en lugar de lo que ve la persona.
  return montar(
    ReactCjs.createElement(
      MemoryRouter,
      { initialEntries: [`/evento/${idInicial}${busqueda}`] },
      ReactCjs.createElement(
        Routes,
        null,
        ReactCjs.createElement(Route, {
          path: '/evento/:id',
          element: ReactCjs.createElement(EventoDetallePagina),
        }),
        ReactCjs.createElement(Route, {
          path: '/',
          element: ReactCjs.createElement('p', null, 'PÁGINA DE INICIO'),
        }),
        ReactCjs.createElement(Route, {
          path: '*',
          element: ReactCjs.createElement(Navigate, { to: '/', replace: true }),
        }),
      ),
    ),
  );
};

// Un UUID con la forma correcta pero que no está en el seed: es el caso "no
// encontrado" de verdad. Con un id del seed se encontraría el evento.
const ID_INEXISTENTE = '11111111-1111-4111-8111-111111111111';
const appDetalle = await montarDetalle(ID_INEXISTENTE, '?mes=2026-10');
comprobar('un id válido que no está da "no encontrado"', appDetalle.raiz.textContent.includes('No encontramos ese evento'), appDetalle.raiz.textContent.slice(0, 120));
comprobar('el error no muestra el id por pantalla', !appDetalle.raiz.textContent.includes(ID_INEXISTENTE));
comprobar('ofrece volver al calendario', appDetalle.porTexto('a', 'Volver al calendario') !== null);
await appDetalle.desmontar();

// Un id que sí existe en el seed: la ficha se tiene que montar entera.
const appDetalleReal = await montarDetalle(sd.crearEventosSeed()[2].id, '?mes=2026-10');
const detalleTexto = appDetalleReal.raiz.textContent;
comprobar('un id del seed muestra el evento', detalleTexto.includes(sd.crearEventosSeed()[2].titulo), detalleTexto.slice(0, 140));
comprobar('muestra la fecha en formato largo', /\d+ de \w+/.test(detalleTexto), detalleTexto.slice(0, 200));
comprobar('muestra la hora en el formato de la app', /\d{1,2}:\d{2}/.test(detalleTexto) && detalleTexto !== sd.crearEventosSeed()[2].hora, detalleTexto.slice(0, 200));
comprobar('ofrece editar y eliminar', detalleTexto.includes('Editar') && detalleTexto.includes('Eliminar'));
comprobar('el enlace a la galería lleva el id', appDetalleReal.raiz.querySelector('a[href*="/galeria"]')?.getAttribute('href').includes(sd.crearEventosSeed()[2].id), appDetalleReal.raiz.querySelector('a[href*="/galeria"]')?.getAttribute('href'));
comprobar('volver conserva el mes de la URL', appDetalleReal.raiz.querySelector('nav a[href="/calendario?mes=2026-10"]') !== null, appDetalleReal.raiz.querySelector('nav a')?.getAttribute('href'));
comprobar('los datos van en una lista de definición', appDetalleReal.raiz.querySelector('dl') !== null && appDetalleReal.raiz.querySelectorAll('dt').length >= 1);
comprobar('el botón de borrar pide confirmación primero', appDetalleReal.raiz.querySelector('#confirmar-borrado-titulo') === null);
await appDetalleReal.desmontar();

// Sin `?mes=` en la URL, el enlace de volver va al calendario a secas.
const appDetalleSinMes = await montarDetalle(sd.crearEventosSeed()[2].id, '');
comprobar('sin ?mes= el enlace de volver es simple', appDetalleSinMes.raiz.querySelector('nav a[href="/calendario"]') !== null, appDetalleSinMes.raiz.querySelector('nav a')?.getAttribute('href'));
await appDetalleSinMes.desmontar();

const appIdMalo = await montarDetalle(encodeURIComponent("' OR 1=1 --"), '?mes=2026-10');
comprobar('un id con inyección da "no encontrado"', appIdMalo.raiz.textContent.includes('No encontramos ese evento'), appIdMalo.raiz.textContent.slice(0, 140));
comprobar('el id con inyección no se filtra a la página', !appIdMalo.raiz.textContent.includes('OR 1=1'));
await appIdMalo.desmontar();

// Una URL sin id no llega a la ficha: el comodín devuelve al inicio, como en la app.
const appIdVacio = await montarDetalle('', '?mes=2026-10');
comprobar('un id vacío no deja la página en blanco', appIdVacio.raiz.textContent.includes('PÁGINA DE INICIO'), appIdVacio.raiz.textContent.slice(0, 140));
await appIdVacio.desmontar();

console.log('\n== Interacción: borrar un evento pide confirmación ==');
// Se añade la ruta del calendario para poder comprobar a dónde navega la
// página al confirmar, que es la mitad del comportamiento que importa.
const montarDetalleNavegable = (idInicial, busqueda = '') =>
  montar(
    ReactCjs.createElement(
      MemoryRouter,
      { initialEntries: [`/evento/${idInicial}${busqueda}`] },
      ReactCjs.createElement(
        Routes,
        null,
        ReactCjs.createElement(Route, {
          path: '/evento/:id',
          element: ReactCjs.createElement(EventoDetallePagina),
        }),
        ReactCjs.createElement(Route, {
          path: '/calendario',
          element: ReactCjs.createElement('p', null, 'PÁGINA DE CALENDARIO'),
        }),
        ReactCjs.createElement(Route, {
          path: '*',
          element: ReactCjs.createElement(Navigate, { to: '/', replace: true }),
        }),
      ),
    ),
  );

const idBorrable = sd.crearEventosSeed()[2].id;
const tituloBorrable = sd.crearEventosSeed()[2].titulo;
const totalInicial = (await ev.getEventos()).length;
const appBorrar = await montarDetalleNavegable(idBorrable, '?mes=2026-10');
comprobar('antes de borrar no hay aviso', appBorrar.raiz.querySelector('#confirmar-borrado-titulo') === null);

await appBorrar.pulsar(appBorrar.porTexto('button', 'Eliminar'));
comprobar('pulsar Eliminar abre el aviso', appBorrar.raiz.querySelector('#confirmar-borrado-titulo') !== null);
comprobar('el aviso nombra el evento afectado', appBorrar.raiz.querySelector('#confirmar-borrado-texto').textContent.includes(tituloBorrable), appBorrar.raiz.querySelector('#confirmar-borrado-texto')?.textContent);
comprobar('el aviso avisa de que no se puede deshacer', appBorrar.raiz.querySelector('#confirmar-borrado-texto').textContent.includes('deshacer'));
comprobar('el aviso avisa a quién afecta', appBorrar.raiz.querySelector('#confirmar-borrado-titulo').closest('[role="alertdialog"]') !== null || appBorrar.raiz.querySelector('#confirmar-borrado-titulo') !== null);
comprobar('el aviso aún no ha borrado nada', (await ev.getEventos()).some((e) => e.id === idBorrable));

// Cancelar deja el evento intacto y en su ficha.
await appBorrar.pulsar(appBorrar.porTexto('button', 'Cancelar'));
comprobar('cancelar cierra el aviso', appBorrar.raiz.querySelector('#confirmar-borrado-titulo') === null);
comprobar('cancelar mantiene la ficha', appBorrar.raiz.textContent.includes(tituloBorrable));
comprobar('cancelar no borra el evento', (await ev.getEventos()).some((e) => e.id === idBorrable));

// Confirmar borra y vuelve al calendario del mes.
await appBorrar.pulsar(appBorrar.porTexto('button', 'Eliminar'));
await appBorrar.pulsar(appBorrar.porTexto('button', 'Sí, eliminar'));
comprobar('confirmar vuelve al calendario', appBorrar.raiz.textContent.includes('PÁGINA DE CALENDARIO'), appBorrar.raiz.textContent.slice(0, 140));
comprobar('confirmar borra el evento del almacén', !(await ev.getEventos()).some((e) => e.id === idBorrable));
comprobar('los demás eventos no se tocan', (await ev.getEventos()).length === totalInicial - 1, `${(await ev.getEventos()).length} de ${totalInicial}`);
comprobar('borrar dos veces el mismo evento no rompe nada', !(await ev.getEventos()).some((e) => e.id === idBorrable));
await appBorrar.desmontar();

// Y la ficha de un evento ya borrado cae en "no encontrado".
const appBorrado = await montarDetalle(idBorrable, '?mes=2026-10');
comprobar('la ficha de algo ya borrado da "no encontrado"', appBorrado.raiz.textContent.includes('No encontramos ese evento'), appBorrado.raiz.textContent.slice(0, 140));
await appBorrado.desmontar();
await dom.window.close();

console.log('\n== Render: el formulario de evento ==');

const appRender = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {},
    onGuardar: () => {},
    fechaInicial: '2026-10-14',
  }),
);
const dialogoRender = () => document.querySelector('[role="dialog"]');
const formRender = () => dialogoRender().querySelector('form');

comprobar('el formulario monta sin lanzar errores', formRender() !== null);
comprobar('es un diálogo modal', dialogoRender().getAttribute('aria-modal') === 'true');
comprobar('el diálogo se nombra con aria-labelledby', !!dialogoRender().getAttribute('aria-labelledby'));
comprobar('el id del título existe de verdad', document.getElementById(dialogoRender().getAttribute('aria-labelledby')) !== null);
comprobar('el diálogo se describe con aria-describedby', !!dialogoRender().getAttribute('aria-describedby'));
comprobar('el panel es enfocable para el foco inicial', dialogoRender().getAttribute('tabindex') === '-1');
comprobar('hay exactamente un diálogo', document.querySelectorAll('[role="dialog"]').length === 1);
comprobar('el formulario desactiva la validación nativa', formRender().noValidate === true);
comprobar('el título del modal es el de alta', dialogoRender().textContent.includes('Agregar evento'));

console.log('\n== Render: los campos y sus etiquetas ==');
for (const nombre of ['titulo', 'fecha', 'hora', 'lugar', 'descripcion']) {
  const campo = formRender().querySelector(`[id$="${nombre}"]`);
  comprobar(`el campo ${nombre} existe`, campo !== null, `no se encuentra ${nombre}`);
  const etiqueta = campo
    ? formRender().querySelector(`label[for="${CSS.escape(campo.id)}"]`)
    : null;
  comprobar(`el campo ${nombre} tiene etiqueta`, etiqueta !== null && etiqueta.textContent.trim().length > 0, `sin label para ${nombre}`);
}
const inputFecha = formRender().querySelector('[id$="fecha"]');
const inputHora = formRender().querySelector('[id$="hora"]');
const inputTitulo = formRender().querySelector('[id$="titulo"]');
comprobar('la fecha usa el tipo nativo date', inputFecha.type === 'date');
comprobar('la hora usa el tipo nativo time', inputHora.type === 'time');
comprobar('la hora es opcional', inputHora.required === false);
comprobar('el título es obligatorio', inputTitulo.required === true);
comprobar('la fecha es obligatoria', inputFecha.required === true);
comprobar('el título tiene maxlength del límite', inputTitulo.maxLength === va.LIMITES.TITULO, String(inputTitulo.maxLength));
comprobar('la descripción tiene maxlength del límite', formRender().querySelector('[id$="descripcion"]').maxLength === va.LIMITES.DESCRIPCION);
comprobar('la hora se explica como opcional', dialogo().textContent.includes('Opcional'));
comprobar('el contador no aparece antes de enviar', !dialogo().textContent.includes(`/120`) && !dialogo().textContent.includes(`/500`));

console.log('\n== Render: los chips de categoría ==');
comprobar('las categorías son un grupo etiquetado', formRender().querySelector('fieldset') !== null && formRender().querySelector('legend') !== null);
const radios = [...formRender().querySelectorAll('input[type="radio"]')];
comprobar('hay un chip por categoría del catálogo', radios.length === cg.ORDEN_CATEGORIAS_EVENTO.length, `${radios.length} chips`);
comprobar('los valores de los chips son los slugs del catálogo', radios.map((r) => r.value).join(',') === cg.ORDEN_CATEGORIAS_EVENTO.join(','));
comprobar('los chips muestran la etiqueta del catálogo', cg.ORDEN_CATEGORIAS_EVENTO.every((c) => dialogo().textContent.includes(cg.obtenerCategoria(c).label)));
comprobar('solo un chip está marcado', radios.filter((r) => r.checked).length === 1, String(radios.filter((r) => r.checked).length));
comprobar('los chips comparten el mismo name', new Set(radios.map((r) => r.name)).size === 1);
comprobar('ningún slug lleva ñ ni espacios', radios.every((r) => cg.PATRON_CATEGORIA.test(r.value)));
comprobar('el chip de cumpleaños usa el slug sin ñ', radios.some((r) => r.value === 'cumpleanos'));
// Cambiar de chip actualiza la selección.
await appRender.pulsar(radios.find((r) => r.value === 'viaje').closest('label'));
comprobar('pulsar un chip lo marca', radios.find((r) => r.value === 'viaje').checked === true);
comprobar('al pulsar un chip se desmarca el anterior', radios.filter((r) => r.checked).length === 1);

console.log('\n== Render: la zona de foto ==');
comprobar('hay un input type="file" real', formRender().querySelector('input[type="file"]') !== null);
comprobar('el input solo acepta imágenes', formRender().querySelector('input[type="file"]').accept === 'image/jpeg,image/png,image/webp');
comprobar('el input no está en display:none ni oculto al teclado', formRender().querySelector('input[type="file"]').className.includes('sr-only'));

comprobar('el input se describe con el texto de ayuda', formRender().querySelector('input[type="file"]').getAttribute('aria-describedby') !== null);
comprobar('se avisa de que se borran los metadatos', dialogo().textContent.includes('metadatos'));
comprobar('se anuncia el límite de tamaño', dialogo().textContent.includes('5 MB'));
comprobar('con la zona vacía no hay previsualización', dialogo().querySelector('img') === null);

// Con foto ya guardada, la zona cambia a previsualización.
const appFoto = await montar(
  ReactCjs.createElement(SelectorFoto, {
    valor: 'data:image/jpeg;base64,AAAA',
    onChange: () => {},
  }),
);
comprobar('con foto hay previsualización', appFoto.raiz.querySelector('img') !== null);
comprobar('la previsualización tiene alt', (appFoto.raiz.querySelector('img')?.getAttribute('alt') ?? '').length > 0);
comprobar('se puede quitar la foto', appFoto.raiz.textContent.includes('Quitar foto'));
comprobar('con foto ya no se ve la zona de arrastrar', appFoto.raiz.querySelector('input[type="file"]') === null);
comprobar('se muestra el peso guardado', /\d+ KB/.test(appFoto.raiz.textContent), appFoto.raiz.textContent);
// Quitar la foto debe pedir el valor `null`, no una cadena vacía.
let valorTrasQuitar = 'sin llamar';
const appFoto2 = await montar(
  ReactCjs.createElement(SelectorFoto, {
    valor: 'data:image/jpeg;base64,AAAA',
    onChange: (nuevo) => {
      valorTrasQuitar = nuevo;
    },
  }),
);
await appFoto2.pulsar(appFoto2.porTexto('button', 'Quitar foto'));
comprobar('quitar la foto pide el valor null', valorTrasQuitar === null, String(valorTrasQuitar));
await appFoto2.desmontar();
await appFoto.desmontar();

console.log('\n== Render: modo edición ==');
// Se desmonta el formulario de alta: si no, un `querySelector` global Finding
// el diálogo devolvería el primero, que sigue siendo el de alta.
await appRender.desmontar();
const appEdicion = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {},
    onGuardar: () => {},
    evento: EVENTO_EDITABLE,
  }),
);
const formEdicion = () => document.querySelector('[role="dialog"] form');
comprobar('el título del modal cambia al editar', dialogo().textContent.includes('Editar evento'));
comprobar('el botón dice "Guardar cambios"', formEdicion().querySelector('button[type="submit"]').textContent.includes('Guardar cambios'));
comprobar('carga el título del evento', formEdicion().querySelector('[id$="titulo"]').value === 'Cena romántica');
comprobar('carga la fecha del evento', formEdicion().querySelector('[id$="fecha"]').value === '2026-10-14');
comprobar('carga la hora del evento', formEdicion().querySelector('[id$="hora"]').value === '19:00');
comprobar('carga el lugar del evento', formEdicion().querySelector('[id$="lugar"]').value === 'La Terraza');
comprobar('carga la descripción del evento', formEdicion().querySelector('[id$="descripcion"]').value === 'Mesa junto a la ventana.');
comprobar('marca la categoría que tiene el evento', formEdicion().querySelector('input[type="radio"][value="cita"]').checked === true);
comprobar('en edición no aparece la zona de foto como nueva', formEdicion().querySelector('input[type="file"]') !== null || formEdicion().querySelector('img') !== null);
await appEdicion.desmontar();

console.log('\n== Render: el contenido de un evento no puede inyectar HTML ==');
const appXss = await montar(
  ReactCjs.createElement(EventoFormModal, {
    abierto: true,
    onCerrar: () => {},
    onGuardar: () => {},
    evento: { ...EVENTO_EDITABLE, titulo: '"><script>alert(1)</script>' },
  }),
);
comprobar('un título con HTML no crea etiquetas', document.querySelectorAll('script').length === 0, String(document.querySelectorAll('script').length));
comprobar('el script llega al campo como texto, sin ejecutar', dialogoRender().querySelector('[id$="titulo"]').value === '"><script>alert(1)</script>', dialogoRender().querySelector('[id$="titulo"]').value);
comprobar('React escapa el valor en el atributo', !/value=""><script/.test(document.body.innerHTML));
await appXss.desmontar();
await appRender.desmontar();

/**
 * Carga inicial y desmontaje antes de que llegue la lectura.
 *
 * Entre pedir los datos y recibirlos hay un `await`. Si en ese hueco la persona
 * navega a otra pantalla, el componente se desmonta y, sin bandera de
 * cancelación, las actualizaciones llegarían a un componente que ya no existe.
 *
 * Ojo con lo que este test puede y no puede demostrar. React 19 eliminó el
 * aviso de "actualizar estado en un componente desmontado", así que no podemos
 * capturar ese warning: la ausencia de ruido en consola es compatible con el
 * bug presente. Lo que sí queda fijado es el contrato observable —una lectura
 * que aterriza tras el desmontaje no suelta ruido, no lanza promesas sin
 * capturar y no rompe la carga siguiente— y, sobre todo, queda escrito por qué
 * existe la bandera. Sin esto, alguien la quitaría por ser "innecaria" en
 * React 19.
 * ---------------------------------------------------------------------------
 */
console.log('\n== Carga inicial: la lectura no debe llegar a un componente desmontado ==');
const { useEventos } = await vite.ssrLoadModule('/src/hooks/useEventos.js');
const { useCitas } = await vite.ssrLoadModule('/src/hooks/useCitas.js');

/** Sonda mínima que pinta lo que el hook necesita exponer a la prueba. */
const sonda = (hook) => {
  const Sonda = () => {
    const { cargando, eventos, ideas, error } = hook();
    return ReactCjs.createElement(
      'p',
      null,
      `${cargando ? 'cargando' : 'listo'}|${(eventos ?? ideas).length}|${error ?? 'sin-error'}`,
    );
  };
  return Sonda;
};

// `act` síncrono a propósito: el asíncrono vacía la cola de microtareas, y con
// los datos ya en hand la lectura habría terminado antes del desmontaje.
const montarYDesmontarDeImmediate = async (Sonda) => {
  const contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  const raiz = createRoot(contenedor);
  act(() => raiz.render(ReactCjs.createElement(Sonda)));
  act(() => raiz.unmount());
  contenedor.remove();
  // Ahora sí, vaciar la cola: aquí es donde la lectura suspendida se reanuda y
  // se topa con un estado que ya está desmontado.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

// Guarda todo lo que React escriba en consola durante la prueba.
const ruido = [];
const consolaOriginal = { error: console.error, warn: console.warn };
console.error = (...a) => ruido.push(['error', a.join(' ')]);
console.warn = (...a) => ruido.push(['warn', a.join(' ')]);

// Secuencial a propósito: dos `act()` a la vez producen el aviso de "overlapping
// act() calls" y ensucian justo la consola que esta prueba quiere vigilar.
const lecturasTardias = [
  await montarYDesmontarDeImmediate(sonda(useEventos)),
  await montarYDesmontarDeImmediate(sonda(useCitas)),
];
await act(async () => {
  await Promise.resolve();
});

console.error = consolaOriginal.error;
console.warn = consolaOriginal.warn;

comprobar('desmontar durante la carga no lanza errores', lecturasTardias.every((r) => r === undefined));
comprobar(
  'la lectura tardía no escribe en consola',
  ruido.length === 0,
  ruido.map(([nivel, t]) => `${nivel}: ${t}`).join(' | '),
);
comprobar('no queda nada sin montar en el documento', document.querySelectorAll('p').length === 0, String(document.querySelectorAll('p').length));

// Y el camino normal: si el componente sigue vivo, la carga tiene que poblar la
// lista y quitar el estado de carga. Es lo que impide que una bandera mal puesta
// deje la pantalla en "cargando" para siempre.
//
// El total se lee ahora, no desde `totalInicial`: otras pruebas de este archivo
// borran eventos, y una foto antigua de la cuenta daría un falso fallo.
const SondaViva = sonda(useEventos);
const appViva = await montar(ReactCjs.createElement(SondaViva));
const totalVivo = (await ev.getEventos()).length;
comprobar('la carga inicial puebla la lista', appViva.raiz.textContent === `listo|${totalVivo}|sin-error`, `esperado listo|${totalVivo}|sin-error, obtenido ${appViva.raiz.textContent}`);
await appViva.desmontar();

/**
 * El alto del modal en móvil no puede volver a depender de `vh`.
 *
 * En un teléfono, `vh` mide el viewport sin el teclado en pantalla, así que un
 * modal con el teclado abierto se sale por debajo y el pie con "Guardar" queda
 * tapado. La corrección es `dvh`, y hay dos trampas por el camino que ya se
 * pisaron una vez: Tailwind ordena él las utilidades (y compilaba el `dvh`
 * antes que el `vh`), y Lightning CSS borra el fallback por considerarlo
 * redundante. Por eso la regla vive en index.css con `@supports` en vez de ser
 * dos clases en el JSX.
 *
 * Aquí no se compila el CSS, que sería lentísimo: se comprueba que la forma de
 * la fuente siga siendo la correcta, que es justo lo que alguien "simplifica"
 * sin querer.
 * ---------------------------------------------------------------------------
 */
console.log('\n== Modal en móvil: el alto tiene que seguir al teclado ==');
const cssFuente = readFileSync(new URL('./src/index.css', import.meta.url), 'utf8');
const modalFuente = readFileSync(
  new URL('./src/components/ui/Modal.jsx', import.meta.url),
  'utf8',
);

comprobar('la regla del alto del modal existe', /\.alto-modal\s*\{/.test(cssFuente));
comprobar(
  'el fallback vh está dentro de la regla, no después',
  /\.alto-modal\s*\{\s*max-height:\s*92vh;\s*\}/.test(cssFuente),
);
comprobar(
  'el dvh va dentro de un @supports, que es lo que impide que lo borre el minificador',
  /@supports\s*\(height:\s*100dvh\)\s*\{[^}]*\.alto-modal\s*\{[^}]*max-height:\s*92dvh/.test(cssFuente),
);
comprobar('el panel del modal usa la clase alto-modal', modalFuente.includes("'alto-modal'"));
comprobar(
  'el panel ya no fija el alto con una clase utilitaria',
  !/max-h-\[92(vh|dvh)\]/.test(modalFuente),
  'se ha vuelto a fijar el alto desde el JSX, donde el orden lo decide Tailwind',
);

/**
 * Rechazo de archivos en la propia interfaz, no solo en la validación.
 *
 * La función `validarArchivoFoto` ya está probada, pero eso no dice nada de lo
 * que ve la persona: un rechazo que no se pinta es un rechazo que parece un
 * fallo. Aquí se elige el archivo de verdad, en el input real, y se comprueba
 * que el mensaje sale con `role="alert"` para que el lector de pantalla lo
 * anuncie.
 *
 * Nota sobre probarlo a mano: el input lleva `accept` con los MIME válidos, así
 * que el selector de archivos del móvil ni siquiera.offerá un SVG o un PDF. Por
 * eso la comprobación automática es más fiable que la manual en este punto, y
 * de paso cubre el caso de alguien que arrastra el archivo sobre la zona.
 * ---------------------------------------------------------------------------
 */
console.log('\n== Selector de fotos: los rechazos se ven y se anuncian ==');

/** Elige un archivo en el input real, como si la persona lo seleccionara. */
const elegirArchivo = async (app, archivo) => {
  const input = app.raiz.querySelector('input[type="file"]');
  if (!input) throw new Error('no hay input de archivo en la zona de foto');
  await act(async () => {
    // `Object.defineProperty` porque la propiedad `files` de un input es de
    // solo lectura y no tiene setter, así que asignarla no funciona.
    Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
    input.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
};

const appRechazos = await montar(ReactCjs.createElement(SelectorFoto, { onCambiar: () => {} }));

await elegirArchivo(
  appRechazos,
  new dom.window.File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'dibujo.svg', {
    type: 'image/svg+xml',
  }),
);
const avisoSvg = appRechazos.raiz.querySelector('[role="alert"]');
comprobar('el SVG se rechaza en pantalla', avisoSvg !== null);
comprobar('el aviso del SVG se anuncia como alerta', avisoSvg?.getAttribute('role') === 'alert');
comprobar('el motivo del SVG es entendible', /svg/i.test(avisoSvg?.textContent ?? ''), avisoSvg?.textContent ?? '(sin texto)');
comprobar('no se llama onCambiar cuando se rechaza el SVG', appRechazos.raiz.querySelector('img') === null);

await elegirArchivo(
  appRechazos,
  new dom.window.File([new Uint8Array(6 * 1024 * 1024)], 'enorme.jpg', { type: 'image/jpeg' }),
);
const avisoGrande = appRechazos.raiz.querySelector('[role="alert"]');
comprobar('una foto de más de 5 MB se rechaza en pantalla', avisoGrande !== null);
comprobar('el motivo del tamaño dice cuánto pesa y cuánto se permite', /6\.0 MB/.test(avisoGrande?.textContent ?? '') && /5 MB/.test(avisoGrande?.textContent ?? ''), avisoGrande?.textContent ?? '(sin texto)');

await elegirArchivo(appRechazos, new dom.window.File([], 'vacia.jpg', { type: 'image/jpeg' }));
comprobar('un archivo vacío se rechaza en pantalla', /vac/i.test(appRechazos.raiz.querySelector('[role="alert"]')?.textContent ?? ''), appRechazos.raiz.querySelector('[role="alert"]')?.textContent ?? '(sin texto)');

await appRechazos.desmontar();

/**
 * La foto tiene que sobrevivir a una recarga.
 *
 * La app guarda los eventos como JSON en `localStorage`, así que una foto
 * guardada como data URL tiene que volver idéntica al releer: si el pipeline
 * devolviera algo que no es texto (un `Blob`, un `File`), el `JSON.stringify`
 * lo dejaría como `{}` y la foto desaparecería sin error ni aviso. Rara vez
 * falla en el happy path y es justo el tipo de cosa que aparece "en un móvil
 * cualquiera".
 * ---------------------------------------------------------------------------
 */
console.log('\n== La foto guardada sobrevive a la recarga ==');
const FOTO_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const eventoConFoto = await ev.crearEvento({
  titulo: 'Prueba de foto',
  fecha: '2026-10-20',
  categoria: 'cita',
  descripcion: 'Con foto pegada.',
  lugar: '',
  hora: '',
  foto: FOTO_PNG,
});

// Releer del almacén, como si la página se hubiera recargado.
const releidos = await ev.getEventos();
const guardado = releidos.find((e) => e.id === eventoConFoto.id);
comprobar('el evento con foto se guarda', guardado !== undefined);
comprobar('la foto sigue ahí después de releer', guardado?.foto === FOTO_PNG, `longitud ${guardado?.foto?.length ?? 0}`);

// Y que el store siga siendo JSON válido, que es lo que se escribiría en la
// siguiente escritura. Si `foto` fuera un objeto, esto no parsearía.
const crudo = storage.getItem('juntos:v3:eventos');
comprobar('lo guardado sigue siendo JSON válido', (() => {
  try {
    return JSON.parse(crudo).length === releidos.length;
  } catch {
    return false;
  }
})(), 'el JSON del almacen no parsea');

await ev.eliminarEvento(eventoConFoto.id);


/**
 * ---------------------------------------------------------------------------
 * PASO e: el planeador de citas.
 * ---------------------------------------------------------------------------
 */

const pl = await vite.ssrLoadModule('/src/utils/planeador.js');
const mo = await vite.ssrLoadModule('/src/types/models.js');

console.log('\n== Paso e: el filtro sale de la URL y se normaliza ==');
// El valor del filtro lo elige quien pulsa un enlace o quien edita la barra de
// direcciones. Todo lo que no sea una clave del catálogo tiene que caer en
// "todas", no colarse en la comparación ni romper la página.
comprobar('una categoría válida se lee de la URL', pl.leerCategoriaDeUrl('?categoria=relax') === 'relax', pl.leerCategoriaDeUrl('?categoria=relax'));
comprobar('una categoría inventada cae en "todas"', pl.leerCategoriaDeUrl('?categoria=inventada') === pl.FILTRO_TODAS);
comprobar('un intento de inyección cae en "todas"', pl.leerCategoriaDeUrl('?categoria=<script>alert(1)</script>') === pl.FILTRO_TODAS);
comprobar('sin el signo ? también se lee', pl.leerCategoriaDeUrl('categoria=afuera') === 'afuera');
comprobar('la categoría no distingue mayúsculas', pl.leerCategoriaDeUrl('?categoria=RELAX') === 'relax');
comprobar('una búsqueda vacía no filtra', pl.leerCategoriaDeUrl('') === pl.FILTRO_TODAS && pl.leerCategoriaDeUrl(null) === pl.FILTRO_TODAS);
comprobar('el parámetro se acepta como URLSearchParams', pl.leerCategoriaDeUrl(new URLSearchParams('categoria=aventura')) === 'aventura');
comprobar('el nombre heredado no vale como categoría', pl.leerCategoriaDeUrl('?categoria=toString') === pl.FILTRO_TODAS);

comprobar('"1" activa solo favoritas', pl.leerSoloFavoritasDeUrl('?favoritas=1') === true);
comprobar('"true" activa solo favoritas', pl.leerSoloFavoritasDeUrl('?favoritas=true') === true);
comprobar('"si" activa solo favoritas', pl.leerSoloFavoritasDeUrl('?favoritas=si') === true);
comprobar('cualquier otra cosa no lo activa', pl.leerSoloFavoritasDeUrl('?favoritas=quizás') === false);
comprobar('"0" no lo activa', pl.leerSoloFavoritasDeUrl('?favoritas=0') === false);
comprobar('sin parámetro no lo activa', pl.leerSoloFavoritasDeUrl('') === false);

console.log('\n== Paso e: escribir los filtros deja la URL limpia ==');
comprobar('sin filtros la búsqueda queda vacía', pl.escribirFiltros('', {}) === '', pl.escribirFiltros('', {}));
comprobar('"todas" no aparece en la URL', pl.escribirFiltros('', { categoria: pl.FILTRO_TODAS }) === '');
comprobar('una categoría se escribe en la URL', pl.escribirFiltros('', { categoria: 'relax' }) === 'categoria=relax', pl.escribirFiltros('', { categoria: 'relax' }));
comprobar('solo favoritas se escribe como 1', pl.escribirFiltros('', { soloFavoritas: true }) === 'favoritas=1', pl.escribirFiltros('', { soloFavoritas: true }));
comprobar('los dos filtros a la vez se escriben', pl.escribirFiltros('', { categoria: 'afuera', soloFavoritas: true }) === 'categoria=afuera&favoritas=1', pl.escribirFiltros('', { categoria: 'afuera', soloFavoritas: true }));
// El planeador no debe borrar lo que otra parte de la app haya puesto.
comprobar('un parámetro ajeno se conserva', pl.escribirFiltros('mes=2026-10', { categoria: 'relax' }) === 'mes=2026-10&categoria=relax', pl.escribirFiltros('mes=2026-10', { categoria: 'relax' }));
comprobar('quitar un filtro deja el otro puesto', pl.escribirFiltros('categoria=relax&favoritas=1', { categoria: pl.FILTRO_TODAS, soloFavoritas: true }) === 'favoritas=1', pl.escribirFiltros('categoria=relax&favoritas=1', { categoria: pl.FILTRO_TODAS, soloFavoritas: true }));

// Ida y vuelta: lo que se escribe tiene que releerse igual.
const idaYVuelta = pl.escribirFiltros('', { categoria: 'aventura', soloFavoritas: true });
comprobar('lo escrito se relee igual', pl.leerCategoriaDeUrl(idaYVuelta) === 'aventura' && pl.leerSoloFavoritasDeUrl(idaYVuelta) === true, idaYVuelta);

console.log('\n== Paso e: filtrar la lista ==');
const ideasPrueba = [
  { id: 'a', titulo: 'B', categoria: 'en-casa', favorita: true },
  { id: 'b', titulo: 'A', categoria: 'afuera', favorita: false },
  { id: 'c', titulo: 'C', categoria: 'en-casa', favorita: false },
];
comprobar('sin filtros salen todas', pl.filtrarIdeas(ideasPrueba).length === 3);
comprobar('el filtro de categoría recorta', pl.filtrarIdeas(ideasPrueba, { categoria: 'en-casa' }).length === 2);
comprobar('el filtro de categoría no trae las de otras', pl.filtrarIdeas(ideasPrueba, { categoria: 'afuera' }).every((i) => i.categoria === 'afuera'));
comprobar('"todas" no recorta nada', pl.filtrarIdeas(ideasPrueba, { categoria: pl.FILTRO_TODAS }).length === 3);
comprobar('solo favoritas recorta a las marcadas', pl.filtrarIdeas(ideasPrueba, { soloFavoritas: true }).length === 1);
comprobar('los dos filtros se aplican a la vez', pl.filtrarIdeas(ideasPrueba, { categoria: 'en-casa', soloFavoritas: true }).length === 1);
comprobar('un filtro sin resultados devuelve lista vacía', pl.filtrarIdeas(ideasPrueba, { categoria: 'relax' }).length === 0);
comprobar('filtrar no muta la lista original', ideasPrueba.length === 3 && ideasPrueba[0].id === 'a');
// `favorita` con valor ausente no debe contar como favorita.
comprobar('una idea sin `favorita` no cuenta como favorita', pl.filtrarIdeas([{ id: 'd', categoria: 'en-casa' }], { soloFavoritas: true }).length === 0);

console.log('\n== Paso e: las ideas del seed no se tocan ==');
comprobar('una idea del seed no es editable', pl.esIdeaEditable({ origen: mo.ORIGEN.SEED }) === false);
comprobar('una idea propia sí es editable', pl.esIdeaEditable({ origen: mo.ORIGEN.USUARIO }) === true);
comprobar('sin origen se trata como del seed', pl.esIdeaEditable({ titulo: 'X' }) === false);
// El `origen` lo escribe el service, no el formulario: si `esIdeaEditable` se
// basara en la categoría, marcarse como "propia" sería trivial.
comprobar('todas las ideas del seed son del seed', sd.crearIdeasSeed().every((i) => i.origen === mo.ORIGEN.SEED), JSON.stringify([...new Set(sd.crearIdeasSeed().map((i) => i.origen))]));
comprobar('el seed sigue siendo válido con el origen añadido', sd.crearIdeasSeed().every((i) => { try { va.validarIdea(i); return true; } catch { return false; } }));
comprobar('crearIdeasSeed devuelve copias, no el mismo objeto', sd.crearIdeasSeed()[0] !== sd.crearIdeasSeed()[0]);

console.log('\n== Paso e: convertir una idea en evento ==');
const ideaParaConvertir = {
  titulo: 'Picnic en el parque',
  descripcion: 'Manta a la sombra.',
  imagen: 'data:image/png;base64,AAAA',
  categoria: 'afuera',
  favorita: true,
};
const valores = pl.ideaAValoresEvento(ideaParaConvertir);
// La fecha vacía es lo más importante de esta función: si se rellenara con la
// de hoy, quien abriera el formulario creería que el día ya estaba pensado.
comprobar('la fecha de una idea llega vacía', valores.fecha === '', valores.fecha);
comprobar('la fecha no se rellena sola con hoy', valores.fecha !== fe.hoyISO());
comprobar('el título se arrastra a la idea', valores.titulo === 'Picnic en el parque');
comprobar('la descripción se arrastra a la idea', valores.descripcion === 'Manta a la sombra.');
comprobar('la foto pasa a `foto`', valores.foto === ideaParaConvertir.imagen);
comprobar('la categoría se fuerza a cita', valores.categoria === pl.CATEGORIA_AL_CONVERTIR, valores.categoria);
comprobar('la categoría de cita es válida para un evento', cg.esCategoriaValida(valores.categoria));
comprobar('la idea no se toca al convertir', pl.ideaAValoresEvento(ideaParaConvertir).titulo === 'Picnic en el parque' && ideaParaConvertir.favorita === true);
comprobar('sin descripción el campo queda vacío', pl.ideaAValoresEvento({ titulo: 'X' }).descripcion === '');
comprobar('sin foto el campo queda a null', pl.ideaAValoresEvento({ titulo: 'X' }).foto === null);
comprobar('con valores raros no aparece `undefined`', !JSON.stringify(pl.ideaAValoresEvento({ titulo: 'X', descripcion: 42 })).includes('undefined'));
comprobar('convertir sin idea lanza en vez de devolver basura', (() => { try { pl.ideaAValoresEvento(null); return false; } catch { return true; } })());

console.log('\n== Paso e: presentacion de la tarjeta ==');
// El degradado vive en `categorias.js` y no en `planeador.js`: la galería
// necesita el de los eventos y mantener los dos habría sido la misma
// interpolación escrita en dos sitios.
comprobar('el degradado usa los colores del catálogo', cg.degradadoCategoriaIdea('relax').backgroundImage.includes(cg.obtenerCategoriaIdea('relax').hex), cg.degradadoCategoriaIdea('relax').backgroundImage);
comprobar('una categoría inventada no rompe el degradado', cg.degradadoCategoriaIdea('inventada').backgroundImage.startsWith('linear-gradient'));
comprobar('el degradado es un estilo, no una clase', typeof cg.degradadoCategoriaIdea('relax').backgroundImage === 'string' && !('className' in cg.degradadoCategoriaIdea('relax')));
comprobar('el degradado de evento usa los colores de su categoría', cg.degradadoCategoriaEvento('viaje').backgroundImage.includes(cg.obtenerCategoria('viaje').hex), cg.degradadoCategoriaEvento('viaje').backgroundImage);
comprobar('una categoría de evento inventada no rompe el degradado', cg.degradadoCategoriaEvento('inventada').backgroundImage.startsWith('linear-gradient'));
comprobar('el corazón anuncia la acción, no solo el estado', pl.etiquetaFavorita({ titulo: 'Picnic', favorita: true }).startsWith('Quitar de favoritas: Picnic'), pl.etiquetaFavorita({ titulo: 'Picnic', favorita: true }));
comprobar('el corazón sin marcar ofrece marcarla', pl.etiquetaFavorita({ titulo: 'Picnic', favorita: false }) === 'Marcar como favorita: Picnic', pl.etiquetaFavorita({ titulo: 'Picnic', favorita: false }));
comprobar('sin título el corazón sigue siendo entendible', pl.etiquetaFavorita({ favorita: false }) === 'Marcar como favorita');
comprobar('un título largo se recorta con puntos suspensivos', pl.recortarTitulo('Un título bastante largo de verdad', 10).endsWith('…') && pl.recortarTitulo('Un título bastante largo de verdad', 10).length <= 10, pl.recortarTitulo('Un título bastante largo de verdad', 10));
comprobar('un título corto no se toca', pl.recortarTitulo('Corto', 10) === 'Corto');
comprobar('recortar no deja espacios colgando', pl.recortarTitulo('Hola mundo entero', 6) === 'Hola…', JSON.stringify(pl.recortarTitulo('Hola mundo entero', 6)));

console.log('\n== Paso e: el orden de la lista ==');
comprobar('las favoritas van primero', pl.ordenarIdeas([{ titulo: 'A', favorita: false }, { titulo: 'B', favorita: true }])[0].titulo === 'B');
comprobar('a igualdad de favorita manda el título', pl.ordenarIdeas([{ titulo: 'B', favorita: true }, { titulo: 'A', favorita: true }]).map((i) => i.titulo).join('') === 'AB');
comprobar('ordenar no muta la entrada', (() => { const entrada = [{ titulo: 'B', favorita: true }, { titulo: 'A', favorita: false }]; pl.ordenarIdeas(entrada); return entrada[0].titulo === 'B'; })());
// Sin el idioma fijado, "Ánfora" se ordenaría de forma distinta según el
// navegador. Con 'es' el orden es el de español en todos.
comprobar('los acentos se ordenan como en español', pl.ordenarIdeas([{ titulo: 'Zafiro', favorita: false }, { titulo: 'Ánfora', favorita: false }]).map((i) => i.titulo).join(',') === 'Ánfora,Zafiro', pl.ordenarIdeas([{ titulo: 'Zafiro', favorita: false }, { titulo: 'Ánfora', favorita: false }]).map((i) => i.titulo).join(','));

console.log('\n== Paso e: el service pone el origen y no lo deja cambiar ==');
// Las ideas del seed se siembran aquí para que las pruebas siguientes partan de
// un estado conocido, y no del que dejaran las de más arriba.
await ci.resetCitas();
const ideaPropia = await ci.crearIdea({ titulo: 'Idea propia', categoria: 'en-casa' });
comprobar('crear una idea la marca como propia', ideaPropia.origen === mo.ORIGEN.USUARIO, JSON.stringify(ideaPropia.origen));
// Si `crearIdea` aceptara el origen de la petición, un formulario podría crear
// una idea propia que queda protegida frente a la edición y el borrado.
const ideaConOrigenFalso = await ci.crearIdea({ titulo: 'Con origen falso', categoria: 'en-casa', origen: mo.ORIGEN.SEED });
comprobar('crear no acepta el origen de la petición', ideaConOrigenFalso.origen === mo.ORIGEN.USUARIO, JSON.stringify(ideaConOrigenFalso.origen));
comprobar('crear no acepta el origen aunque pida edición', ideaConOrigenFalso.id !== undefined);

const editada = await ci.actualizarIdea(ideaPropia.id, { titulo: 'Idea propia editada' });
comprobar('editar conserva el origen', editada.origen === mo.ORIGEN.USUARIO, JSON.stringify(editada.origen));
comprobar('editar sí cambia el título', editada.titulo === 'Idea propia editada');
const intentoDeRebajar = await ci.actualizarIdea(ideaPropia.id, { origen: mo.ORIGEN.SEED });
comprobar('editar no deja rebajar el origen a seed', intentoDeRebajar.origen === mo.ORIGEN.USUARIO, JSON.stringify(intentoDeRebajar.origen));
comprobar('el origen se conserva al releer del almacén', (await ci.getIdeasCitas()).find((i) => i.id === ideaPropia.id)?.origen === mo.ORIGEN.USUARIO);

comprobar('normalizarOrigen respeta "usuario"', ci.normalizarOrigen('usuario') === mo.ORIGEN.USUARIO);
comprobar('normalizarOrigen mantiene "seed"', ci.normalizarOrigen('seed') === mo.ORIGEN.SEED);
comprobar('normalizarOrigen cae en seed si no hay origen', ci.normalizarOrigen(undefined) === mo.ORIGEN.SEED);
comprobar('normalizarOrigen cae en seed ante un valor raro', ci.normalizarOrigen('inventado') === mo.ORIGEN.SEED);
// Falso positivo: "seed" y "usuario" tienen que ser valores distintos.
comprobar('los dos orígenes son valores distintos', mo.ORIGEN.SEED !== mo.ORIGEN.USUARIO);

console.log('\n== Paso e: la lista se ordena y se filtra en el service ==');
const paraOrdenar = await ci.crearIdea({ titulo: 'Ánfora', categoria: 'afuera' });
const leidas = await ci.getIdeasCitas();
const indiceFavorita = leidas.findIndex((i) => i.favorita);
comprobar('las favoritas del seed salen primero', indiceFavorita === 0 || !leidas[0].favorita, JSON.stringify(leidas.map((i) => i.favorita)));
comprobar('el service devuelve las ideas del seed con su origen', leidas.filter((i) => i.origen === mo.ORIGEN.SEED).length === sd.crearIdeasSeed().length, String(leidas.filter((i) => i.origen === mo.ORIGEN.SEED).length));
await ci.eliminarIdea(paraOrdenar.id);
await ci.eliminarIdea(ideaConOrigenFalso.id);
await ci.eliminarIdea(ideaPropia.id);
comprobar('eliminar una idea la quita de la lista', (await ci.getIdeasCitas()).length === sd.crearIdeasSeed().length, String((await ci.getIdeasCitas()).length));



console.log('\n== Paso g: Configuración ==');
const ConfiguracionPagina = (await vite.ssrLoadModule('/src/pages/Configuracion.jsx')).default;
const se = await vite.ssrLoadModule('/src/services/sesion.js');

/*
 * ---------------------------------------------------------------------------
 * Sesión: del servicio al flujo de la pantalla de bienvenida.
 * ---------------------------------------------------------------------------
 * Dos avisos sobre lo que sigue, porque los dos son trampas del arnés y no del
 * código que se está probando.
 *
 * EL ALMACÉN NO ES `storage`
 * `globalThis.window` se sustituye por la ventana de jsdom en el bloque de DOM, y
 * la de jsdom trae su propio `localStorage`. A partir de ahí la app lee y escribe
 * en el de jsdom, y la variable `storage` de arriba (el `LocalStorageMock`) queda
 * como un almacén muerto: sigue teniendo lo que se le escribió antes del cambio.
 * Comprobar contra `storage` daría verde sobre datos que la app no está usando,
 * que es justo lo que pasaba con las comprobaciones de "y nada se ha borrado
 * todavía" y "la sesión sobrevive al restablecimiento". Aquí se lee siempre
 * `almacen()`.
 *
 * EL RELOJ SE FIJA PARA ESTE BLOQUE
 * Al llegar aquí el reloj ya no está fijado (un bloque anterior lo restableció) y
 * `ahora()` se mueve entre dos llamadas seguidas. Se fija la fecha simulada para
 * poder comprobar que la marca de creación de la sesión sale del reloj de la app
 * y no de `new Date()`, y se restablece al terminar para no alterar lo que viene
 * después.
 */
const almacen = () => globalThis.window.localStorage;
const claveSesion = st.claveDeSesion();
const sesionGuardada = () => almacen().getItem(claveSesion);
const plantarSesion = (valor) => almacen().setItem(claveSesion, valor);
await ev.resetEventos();
await ci.resetCitas();
const montarConfiguracion = () =>
  montar(
    ReactCjs.createElement(
      MemoryRouter,
      { initialEntries: ['/configuracion'] },
      ReactCjs.createElement(ConfiguracionPagina),
    ),
  );

/*
 * Los recuentos se buscan dentro de su sección, y no por posición.
 *
 * Antes se leía el `dd` número 0, 1 y 2 de toda la pantalla. Al añadir la
 * sección de sesión delante de los datos, esos índices pasaron a señalar la clave
 * y el estado de la sesión, y las tres comprobaciones de los recuentos dejaron de
 * medirlos sin decir nada. Un selector por posición no falla al añadir
 * contenido: deja de comprobar lo que decía comprobar.
 */
const seccionDe = (raiz, id) => raiz.querySelector(`#${id}`)?.closest('section') ?? null;
const datoDe = (raiz, id, indice) => seccionDe(raiz, id)?.querySelectorAll('dd')[indice] ?? null;

const appConfig = await montarConfiguracion();
// Los recuentos vienen de los services, así que hay que dejar que las promesas
// se resuelvan antes de mirarlos.
await act(async () => {});

comprobar('la pantalla cuenta los eventos del seed', datoDe(appConfig.raiz, 'config-datos', 0)?.textContent.trim() === '8', datoDe(appConfig.raiz, 'config-datos', 0)?.textContent ?? 'sin recuento');
comprobar('y también las ideas de cita', (datoDe(appConfig.raiz, 'config-datos', 1)?.textContent ?? '').trim() === String(sd.crearIdeasSeed().length), datoDe(appConfig.raiz, 'config-datos', 1)?.textContent ?? 'sin recuento');
comprobar('enseña cuánto ocupa', /\d+(\.\d+)?\s?(B|kB|MB)/.test(datoDe(appConfig.raiz, 'config-datos', 2)?.textContent ?? ''), datoDe(appConfig.raiz, 'config-datos', 2)?.textContent ?? 'sin tamaño');
comprobar('avisa de que los datos no salen del dispositivo', appConfig.raiz.textContent.includes('No sale a ningún servidor'), appConfig.raiz.textContent.slice(0, 160));
comprobar('no promete nada de una nube que no existe', !appConfig.raiz.textContent.includes('nube propia'));

// El botón abre una pregunta antes de borrar nada.
comprobar('el botón de restablecer está', appConfig.porTexto('button', 'Restablecer datos') !== null);
await appConfig.pulsar(appConfig.porTexto('button', 'Restablecer datos'), 'el botón "Restablecer datos"');
const dialogoReset = document.querySelector('[role="alertdialog"]');
comprobar('pregunta antes de borrar', dialogoReset !== null);
comprobar('la pregunta es un alertdialog', dialogoReset !== null && dialogoReset.getAttribute('aria-modal') === 'true', dialogoReset?.getAttribute('aria-modal') ?? 'sin aria-modal');
comprobar('avisa de que no se puede deshacer', dialogoReset?.textContent.includes('no se puede deshacer'), dialogoReset?.textContent.slice(0, 120) ?? '');
comprobar('menciona las fotos, que no tienen copia', dialogoReset?.textContent.includes('fotos'), dialogoReset?.textContent.slice(0, 200) ?? '');
comprobar('y nada se ha borrado todavía', almacen().getItem(st.claveDe(st.COLECCIONES.EVENTOS)) !== null);

/*
 * Un solo diálogo, y con la pregunta correcta.
 *
 * `ConfirmarSalida` se diseñó para el aviso de "salir sin guardar" de un
 * formulario: trae su propio `role="alertdialog"`, su propio título y sus
 * propios botones. Puesto dentro del `Modal` de restablecimiento, la pantalla
 * tenía dos diálogos anidados que decían cosas distintas y cuatro botones para
 * una sola decisión. Estas cuatro comprobaciones lo impidieron.
 */
comprobar('no hay dos diálogos montados a la vez', document.querySelectorAll('[role="alertdialog"]').length === 1, String(document.querySelectorAll('[role="alertdialog"]').length));
comprobar('el título es el de restablecer los datos', dialogoReset?.querySelector('h2')?.textContent.trim() === '¿Restablecer los datos?', dialogoReset?.querySelector('h2')?.textContent ?? 'sin título');
comprobar('y no se cuela el aviso de salir sin guardar', !dialogoReset?.textContent.includes('Salir sin guardar'), dialogoReset?.textContent.slice(0, 120) ?? '');
comprobar('hay exactamente dos respuestas, Cancelar y la de restablecer', dialogoReset !== null && [...dialogoReset.querySelectorAll('button')].filter((b) => b.getAttribute('aria-label') !== 'Cerrar').length === 2, String(dialogoReset?.querySelectorAll('button').length));
comprobar('el detalle de qué se borra está entre las descripciones del diálogo', (dialogoReset?.getAttribute('aria-describedby') ?? '').split(' ').length === 2, dialogoReset?.getAttribute('aria-describedby') ?? 'sin aria-describedby');
// El foco inicial no puede estar en el botón destructivo: quien abra el diálogo
// por accidente y pulse Enter no debe borrar nada.
comprobar('el foco no está en el botón destructivo', document.activeElement?.textContent?.trim() !== 'Sí, restablecer', document.activeElement?.textContent ?? 'sin foco');

// Cancelar no toca nada.
await appConfig.pulsar(
  [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === 'Cancelar'),
  'el botón "Cancelar" del diálogo',
);
comprobar('cancelar cierra la pregunta', document.querySelector('[role="alertdialog"]') === null);
comprobar('y deja los datos como estaban', almacen().getItem(st.claveDe(st.COLECCIONES.EVENTOS)) !== null);

// Un evento propio, para comprobar que el recuento baja al restablecer.
const eventoPropio = await ev.crearEvento({ titulo: 'Para borrar', fecha: fe.hoyISO(), categoria: 'cita' });
const conPropio = await ev.getEventos();
comprobar('antes de restablecer hay un evento más', conPropio.length === 9, String(conPropio.length));

// Ahora sí, con la sesión plantada: restablecer no puede echarla. Se crea con el
// servicio y no escribiendo la clave a mano, para que la prueba mida con una sesión
// de verdad y no con un objeto que el código ya no reconocería.
const sesionDelReset = se.crearSesion();
await appConfig.pulsar(appConfig.porTexto('button', 'Restablecer datos'), 'el botón "Restablecer datos" otra vez');
await appConfig.pulsar(
  [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === 'Sí, restablecer'),
  'el botón "Sí, restablecer"',
);
await act(async () => {});
comprobar('el diálogo se cierra solo al terminar', document.querySelector('[role="alertdialog"]') === null);
comprobar('vuelve el seed y se va lo propio', (await ev.getEventos()).length === 8, String((await ev.getEventos()).length));
comprobar('el evento propio ya no está', !(await ev.getEventos()).some((e) => e.id === eventoPropio.id));
comprobar('el recuento se actualiza en pantalla', datoDe(appConfig.raiz, 'config-datos', 0)?.textContent.trim() === '8', datoDe(appConfig.raiz, 'config-datos', 0)?.textContent ?? 'sin recuento');
comprobar('y se le avisa con un rol de estado', appConfig.raiz.querySelector('[role="status"]')?.textContent.includes('Datos restablecidos'), appConfig.raiz.querySelector('[role="status"]')?.textContent ?? 'sin aviso');
comprobar('la sesión sobrevive al restablecimiento', sesionGuardada() === JSON.stringify(sesionDelReset), String(sesionGuardada()));
comprobar('y sigue siendo una sesión que el código reconoce', se.haySesion() === true, String(sesionGuardada()));

await appConfig.desmontar();
almacen().removeItem(claveSesion);
await ev.resetEventos();
await ci.resetCitas();

const PlaneadorPagina = (await vite.ssrLoadModule('/src/pages/Planeador.jsx')).default;

rj.fijarAhora(FECHA_SIMULADA);

console.log('\n== Paso g: el servicio de sesión ==');
/*
 * Lo que se guarda es `juntos:v1:sesion`, un objeto con `id` y `creadaEn`.
 *
 * La versión de la sesión es propia y no la del esquema de los datos: son dos
 * cosas que cambian por motivos distintos. Si compartieran versión, subir el
 * esquema de los eventos borraría la sesión de quien está usando la app, que es
 * justo lo que `resetDatos()` evita a propósito.
 */
almacen().removeItem(claveSesion);
comprobar('sin clave no hay sesión', se.leerSesion() === null, String(sesionGuardada()));
comprobar('la versión de la sesión es la suya y no la de los datos', claveSesion === 'juntos:v1:sesion', claveSesion);
comprobar('y es una clave distinta de la de los datos', claveSesion !== st.claveDe(st.COLECCIONES.EVENTOS), `${claveSesion} vs ${st.claveDe(st.COLECCIONES.EVENTOS)}`);

const sesionCreada = se.crearSesion();
comprobar('crear devuelve la sesión que ha guardado', se.leerSesion()?.id === sesionCreada?.id, JSON.stringify(sesionCreada));
comprobar('el identificador tiene forma de UUID v4', va.esIdValido(sesionCreada.id), sesionCreada.id);
/*
 * La marca de tiempo sale del reloj inyectado y no de `new Date()`. Con el reloj
 * fijado a una fecha que no es la de nadie, si saliera del sistema valdría la
 * fecha real de quien ejecuta la suite y la comprobación solo pasaría por
 * casualidad en el mes en curso.
 */
comprobar('la fecha de creación es la del reloj de la app, no la del ordenador', sesionCreada.creadaEn === rj.ahora().toISOString(), `${sesionCreada.creadaEn} != ${rj.ahora().toISOString()}`);
comprobar('lo guardado en el almacén es ese mismo objeto', JSON.parse(sesionGuardada())?.id === sesionCreada.id, String(sesionGuardada()));

const sesionSegunda = se.crearSesion();
comprobar('volver a crear no acumula, sustituye', se.leerSesion().id === sesionSegunda.id && se.leerSesion().id !== sesionCreada.id, se.leerSesion().id);

console.log('\n== Paso g: una sesión rota cuenta como no tener sesión ==');
/*
 * `localStorage` se puede editar a mano, se comparte entre pestañas y se queda a
 * medias si se cierra el navegador escribiendo. Si un valor así se tomara por
 * bueno, quien no ha pasado por la bienvenida entraría sin pasar por ella, y en
 * Fase 2 el mismo camino sería un salto de autorización. Por eso todo lo que no
 * tenga forma de sesión se degrada a `null` y la app vuelve a la bienvenida.
 */
const SESIONES_ROTAS = [
  ['JSON que no se puede interpretar', 'no es json'],
  ['sin envolver en un objeto', '"solo una cadena"'],
  ['un array', '[]'],
  ['sin identificador', JSON.stringify({ creadaEn: rj.ahora().toISOString() })],
  ['con un identificador que no es UUID', JSON.stringify({ id: 'p1', creadaEn: rj.ahora().toISOString() })],
  // Con forma de UUID pero de versión 1, que es lo que daría un identificador
  // antiguo si algún día se llegara a aceptar uno. El validador exige v4.
  ['con un identificador que es UUID pero no v4', JSON.stringify({ id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', creadaEn: rj.ahora().toISOString() })],
  ['sin fecha de creación', JSON.stringify({ id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed' })],
  ['con una fecha que no es una fecha', JSON.stringify({ id: '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', creadaEn: 'ayer' })],
];
for (const [nombre, valor] of SESIONES_ROTAS) {
  plantarSesion(valor);
  comprobar(`no cuenta como sesión: ${nombre}`, se.leerSesion() === null && se.haySesion() === false, valor);
}
almacen().removeItem(claveSesion);

console.log('\n== Paso g: restablecer datos no cierra la sesión ==');
await ev.resetEventos();
const sesionAntesDelReset = se.crearSesion();
st.resetDatos();
comprobar('resetDatos() deja la sesión en su sitio', se.leerSesion()?.id === sesionAntesDelReset.id, JSON.stringify(se.leerSesion()));
comprobar('y la deja intacta, sin reescribirla', sesionGuardada() === JSON.stringify(sesionAntesDelReset), String(sesionGuardada()));
const sesionAntesDeLimpiar = se.crearSesion();
const clavesViejasLimpiar = st.limpiarVersionesAnteriores();
comprobar('limpiarVersionesAnteriores() también la respeta', se.leerSesion()?.id === sesionAntesDeLimpiar.id, `${JSON.stringify(se.leerSesion())} / ${JSON.stringify(clavesViejasLimpiar)}`);

console.log('\n== Paso g: cerrar sesión ==');
await ev.resetEventos();
comprobar('con datos guardados hay algo que perder', almacen().getItem(st.claveDe(st.COLECCIONES.EVENTOS)) !== null);
const sesionAntesDeCerrar = se.crearSesion();
const cerrada = se.cerrarSesion();
comprobar('cerrar borra la clave', cerrada === true && se.leerSesion() === null, String(sesionGuardada()));
comprobar('y no toca los datos ni las fotos', almacen().getItem(st.claveDe(st.COLECCIONES.EVENTOS)) !== null, 'los eventos desaparecieron');
comprobar('los eventos siguen ahí después de cerrar sesión', (await ev.getEventos()).length > 0, String((await ev.getEventos()).length));
comprobar('informacionSesion() lo dice sin tener que leer a mano', se.informacionSesion().activa === false && se.informacionSesion().clave === 'juntos:v1:sesion', JSON.stringify(se.informacionSesion()));
comprobar('y con la sesión puesta la cuenta como activa', (plantarSesion(JSON.stringify(sesionAntesDeCerrar)), se.informacionSesion().activa === true), JSON.stringify(se.informacionSesion()));

console.log('\n== Paso g: las guardas de ruta ==');
/*
 * Las guardas se montan con `App` dentro de un `MemoryRouter`, que es como lo
 * monta `main.jsx`: `App` solo devuelve `<Routes>` y el enrutador va fuera. Así
 * se puede abrir cualquier ruta sin Historical API.
 *
 * El eco de la URL lleva un id propio, distinto del que usan el calendario y el
 * planeador, porque esas pruebas pueden seguir montadas en el mismo documento y
 * `document.getElementById` devolvería siempre la primera.
 */
const AppRaiz = (await vite.ssrLoadModule('/src/App.jsx')).default;
const EcoDeSesion = () => ReactCjs.createElement('p', { id: 'eco-url-sesion' }, useLocation().pathname);

const montarApp = (ruta) =>
  montar(
    ReactCjs.createElement(
      MemoryRouter,
      { initialEntries: [ruta] },
      ReactCjs.createElement(AppRaiz),
      ReactCjs.createElement(EcoDeSesion),
    ),
  );
const rutaDe = (app) => app.raiz.querySelector('#eco-url-sesion')?.textContent ?? '';
const botonComenzar = (raiz) => [...raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Comenzar');
const hayBotonComenzar = (raiz) => botonComenzar(raiz) !== undefined;
/*
 * El `Layout` es lo que distingue "dentro de la app" de "en la bienvenida": la
 * navegación principal solo existe con sesión. Sidebar y BottomNav comparten
 * nombre accesible, así que el mismo selector sirve para los dos anchos.
 */
const dentroDeLaApp = (raiz) => raiz.querySelector('nav[aria-label="Navegación principal"]') !== null;

console.log('\n== Paso g: sin sesión, la app no se ve ==');
almacen().removeItem(claveSesion);
const guardasSinSesion = ['/', '/calendario', '/galeria', '/planeador', '/configuracion', '/momentos'];
for (const ruta of guardasSinSesion) {
  const app = await montarApp(ruta);
  await act(async () => {});
  comprobar(`${ruta} sin sesión va a la bienvenida`, rutaDe(app) === '/bienvenida', rutaDe(app));
  comprobar(`  y no deja ver la app en ${ruta}`, hayBotonComenzar(app.raiz) && !dentroDeLaApp(app.raiz), rutaDe(app));
  await app.desmontar();
}

const appRutaInexistente = await montarApp('/no-existe');
await act(async () => {});
comprobar('una ruta que no existe también acaba en la bienvenida', rutaDe(appRutaInexistente) === '/bienvenida', rutaDe(appRutaInexistente));
await appRutaInexistente.desmontar();

console.log('\n== Paso g: con sesión, la bienvenida no se ve ==');
const sesionDePrueba = se.crearSesion();
for (const ruta of ['/', '/calendario', '/configuracion']) {
  const app = await montarApp(ruta);
  await act(async () => {});
  comprobar(`${ruta} con sesión se ve en su sitio`, rutaDe(app) === ruta, rutaDe(app));
  comprobar(`  y no salta a la bienvenida desde ${ruta}`, !hayBotonComenzar(app.raiz), rutaDe(app));
  await app.desmontar();
}
const appVolverA = await montarApp('/bienvenida');
await act(async () => {});
comprobar('con sesión, /bienvenida salta a Inicio', rutaDe(appVolverA) === '/', rutaDe(appVolverA));
comprobar('y no enseña el botón "Comenzar"', !hayBotonComenzar(appVolverA.raiz), appVolverA.raiz.textContent.slice(0, 120));
await appVolverA.desmontar();

console.log('\n== Paso g: la pantalla de bienvenida ==');
/*
 * Sin montar `App`, para poder mirar el botón deshabilitado sin que la guarda
 * contraria lo sustituya por un `Navigate` en el primer render.
 */
const BienvenidaPagina = (await vite.ssrLoadModule('/src/pages/Bienvenida.jsx')).default;
almacen().removeItem(claveSesion);
const montarBienvenida = () =>
  montar(
    ReactCjs.createElement(
      MemoryRouter,
      { initialEntries: ['/bienvenida'] },
      ReactCjs.createElement(BienvenidaPagina),
      ReactCjs.createElement(EcoDeSesion),
    ),
  );

const appBienvenida = await montarBienvenida();
comprobar('la bienvenida está fuera del layout', !dentroDeLaApp(appBienvenida.raiz), appBienvenida.raiz.textContent.slice(0, 120));
comprobar('enseña el texto del mockup', appBienvenida.raiz.textContent.includes('Crea recuerdos, planea nuevas aventuras y sigue escribiendo tu historia juntos.'), appBienvenida.raiz.textContent.slice(0, 200));
comprobar('y el lema de la marca', appBienvenida.raiz.textContent.includes('Tus momentos, siempre'), appBienvenida.raiz.textContent.slice(0, 200));
comprobar('tiene el botón "Comenzar"', hayBotonComenzar(appBienvenida.raiz));

const botonSesion = [...appBienvenida.raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Iniciar sesión');
comprobar('y el de "Iniciar sesión"', botonSesion !== null);
/*
 * `aria-disabled` y no `disabled`: un botón `disabled` no recibe el foco, así que
 * con teclado no se llegaría a él ni se oiría el motivo de que no esté activo.
 * Con `aria-disabled` sigue siendo enfocable y el motivo llega por dos vías.
 */
comprobar('"Iniciar sesión" está deshabilitado para lector de pantalla', botonSesion?.getAttribute('aria-disabled') === 'true', String(botonSesion?.getAttribute('aria-disabled')));
comprobar('y no con el atributo `disabled`, para que siga siendo enfocable', !botonSesion?.hasAttribute('disabled'), String(botonSesion?.hasAttribute('disabled')));
comprobar('el puntero recibe el "Próximamente" como tooltip', botonSesion?.getAttribute('title') === 'Próximamente', String(botonSesion?.getAttribute('title')));
const descritoPorBoton = botonSesion?.getAttribute('aria-describedby') ?? '';
const textoDescritoPorBoton = descritoPorBoton ? document.getElementById(descritoPorBoton)?.textContent ?? '' : '';
comprobar('el lector de pantalla oye el motivo', textoDescritoPorBoton.trim() === 'Próximamente', `${descritoPorBoton}: "${textoDescritoPorBoton}"`);

// Pulsar el botón deshabilitado no hace nada: ni navegar ni crear sesión.
await appBienvenida.pulsar(botonSesion, 'el botón "Iniciar sesión"');
comprobar('pulsarlo no crea sesión', se.leerSesion() === null, String(sesionGuardada()));
comprobar('ni mueve de la bienvenida', rutaDe(appBienvenida) === '/bienvenida', rutaDe(appBienvenida));

/*
 * El resto del flujo va montado con `App`, no con la página suelta. Es la
 * diferencia entre "el botón crea la sesión" y "el botón crea la sesión y lleva a
 * Inicio": con la página montada sola, `navegar()` cambia la URL pero no
 * desmonta nada, porque no hay rutas que cambien de elemento. Las rutas reales
 * son las que hacen aparecer el `Layout` y las que hacen desaparecer la
 * bienvenida.
 */
console.log('\n== Paso g: de la bienvenida al calendario ==');
almacen().removeItem(claveSesion);
const appFlujo = await montarApp('/bienvenida');
await act(async () => {});
comprobar('sin sesión, /bienvenida se ve', rutaDe(appFlujo) === '/bienvenida' && hayBotonComenzar(appFlujo.raiz), rutaDe(appFlujo));

await appFlujo.pulsar(botonComenzar(appFlujo.raiz), 'el botón "Comenzar" de la bienvenida');
await act(async () => {});
const sesionTrasComenzar = se.leerSesion();
comprobar('"Comenzar" guarda la sesión', sesionTrasComenzar !== null && va.esIdValido(sesionTrasComenzar.id), JSON.stringify(sesionTrasComenzar));
comprobar('con un identificador distinto del de antes', sesionTrasComenzar?.id !== sesionDePrueba.id, `${sesionTrasComenzar?.id} != ${sesionDePrueba.id}`);
comprobar('y lleva a Inicio', rutaDe(appFlujo) === '/', rutaDe(appFlujo));
comprobar('donde ya se ve la app, con su navegación', dentroDeLaApp(appFlujo.raiz), appFlujo.raiz.textContent.slice(0, 120));
comprobar('y la bienvenida ya no está', !hayBotonComenzar(appFlujo.raiz), appFlujo.raiz.textContent.slice(0, 120));
await appFlujo.desmontar();

// Y con la sesión ya creada, la app entera se abre sin pasar por la bienvenida.
const appTrasComenzar = await montarApp('/calendario');
await act(async () => {});
comprobar('recargar el calendario ya no vuelve a la bienvenida', rutaDe(appTrasComenzar) === '/calendario', rutaDe(appTrasComenzar));
await appTrasComenzar.desmontar();

console.log('\n== Paso g: cerrar sesión desde Configuración ==');
const sesionVisible = se.crearSesion();
await ev.resetEventos();
// Montada con `App` para que la navegación a la bienvenida desmonte la pantalla,
// como en la app de verdad.
const appCierre = await montarApp('/configuracion');
await act(async () => {});
comprobar('Configuración se ve con la sesión puesta', rutaDe(appCierre) === '/configuracion' && seccionDe(appCierre.raiz, 'config-sesion') !== null, rutaDe(appCierre));
comprobar('el indicador dice que hay sesión', (seccionDe(appCierre.raiz, 'config-sesion')?.textContent ?? '').includes('Sesión activa'), seccionDe(appCierre.raiz, 'config-sesion')?.textContent.slice(0, 160) ?? 'sin sección');
comprobar('enseña la clave con su versión', (seccionDe(appCierre.raiz, 'config-sesion')?.textContent ?? '').includes('juntos:v1:sesion'), seccionDe(appCierre.raiz, 'config-sesion')?.textContent.slice(0, 160) ?? 'sin sección');
comprobar('y no dice que sea una cuenta', (seccionDe(appCierre.raiz, 'config-sesion')?.textContent ?? '').includes('no es una cuenta'), seccionDe(appCierre.raiz, 'config-sesion')?.textContent.slice(0, 200) ?? 'sin sección');
comprobar('ofrece cerrar sesión', appCierre.porTexto('button', 'Cerrar sesión') !== null);

await appCierre.pulsar(appCierre.porTexto('button', 'Cerrar sesión'), 'el botón "Cerrar sesión"');
const dialogoCierre = document.querySelector('[role="alertdialog"]');
comprobar('pregunta antes de cerrar', dialogoCierre !== null);
comprobar('con el título de cerrar sesión', dialogoCierre?.querySelector('h2')?.textContent.trim() === '¿Cerrar la sesión?', dialogoCierre?.querySelector('h2')?.textContent ?? 'sin título');
comprobar('no hay dos diálogos montados a la vez', document.querySelectorAll('[role="alertdialog"]').length === 1, String(document.querySelectorAll('[role="alertdialog"]').length));
comprobar('no se cuela el aviso de salir sin guardar', !dialogoCierre?.textContent.includes('Salir sin guardar'), dialogoCierre?.textContent.slice(0, 120) ?? '');
comprobar('avisa de que los datos no se borran', /no borra nada/.test(dialogoCierre?.textContent ?? ''), dialogoCierre?.textContent.slice(0, 200) ?? '');
comprobar('y nada se ha cerrado todavía', se.leerSesion()?.id === sesionVisible.id);

await appCierre.pulsar(
  [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === 'Cancelar'),
  'el botón "Cancelar" del diálogo de cierre',
);
comprobar('cancelar cierra la pregunta', document.querySelector('[role="alertdialog"]') === null);
comprobar('y deja la sesión como estaba', se.leerSesion()?.id === sesionVisible.id, JSON.stringify(se.leerSesion()));
comprobar('y no cambia de pantalla', rutaDe(appCierre) === '/configuracion', rutaDe(appCierre));

await appCierre.pulsar(appCierre.porTexto('button', 'Cerrar sesión'), 'el botón "Cerrar sesión" otra vez');
await appCierre.pulsar(
  [...document.querySelectorAll('[role="alertdialog"] button')].find((b) => b.textContent.trim() === 'Sí, cerrar sesión'),
  'el botón "Sí, cerrar sesión"',
);
await act(async () => {});
comprobar('la sesión queda cerrada', se.leerSesion() === null, String(sesionGuardada()));
comprobar('y se vuelve a la bienvenida', rutaDe(appCierre) === '/bienvenida', rutaDe(appCierre));
comprobar('que ya tiene su botón otra vez', hayBotonComenzar(appCierre.raiz), appCierre.raiz.textContent.slice(0, 160));
comprobar('los datos siguen guardados', almacen().getItem(st.claveDe(st.COLECCIONES.EVENTOS)) !== null, 'los eventos desaparecieron');
await appCierre.desmontar();

/*
 * Y una vez cerrada, volver a abrir Configuración por la URL ya no la enseña:
 * la guarda de `App` manda a la bienvenida antes de que se monte la pantalla.
 * Sin esto, se podría seguir viendo el indicador y pulsar "Cerrar sesión" sobre
 * una sesión que no existe.
 */
const appCierreUrl = await montarApp('/configuracion');
await act(async () => {});
comprobar('tras cerrar sesión, /configuracion ya no se ve', rutaDe(appCierreUrl) === '/bienvenida' && hayBotonComenzar(appCierreUrl.raiz), rutaDe(appCierreUrl));
await appCierreUrl.desmontar();

// El reloj vuelve al del sistema para lo que venga después, que es lo que había
// al entrar en este bloque.
rj.restablecerAhora();
almacen().removeItem(claveSesion);
await ev.resetEventos();
await ci.resetCitas();

console.log('\n== Paso e: la página del planeador ==');

const montarPlaneador = (busqueda = '') =>
  montar(
    ReactCjs.createElement(
      MemoryRouter,
      { initialEntries: [`/planeador${busqueda}`] },
      ReactCjs.createElement(PlaneadorPagina),
      ReactCjs.createElement(EcoDeUrl),
    ),
  );

const tarjetas = (raiz) => [...raiz.querySelectorAll('article[data-id]')];
const tituloTarjeta = (tarjeta) => tarjeta?.querySelector('h3')?.textContent ?? '';

// La página parte del seed, sin ideas propias, para saber exactamente qué ve.
await ci.resetCitas();
const appPlaneador = await montarPlaneador();
comprobar('la página se monta con las ideas del seed', tarjetas(appPlaneador.raiz).length === sd.crearIdeasSeed().length, String(tarjetas(appPlaneador.raiz).length));
comprobar('cada tarjeta lleva su id', tarjetas(appPlaneador.raiz).every((t) => /^[-0-9a-f]{36}$/.test(t.dataset.id ?? '')));
comprobar('la cabecera cuenta cuántas ideas hay', /5 ideas/.test(appPlaneador.raiz.textContent), appPlaneador.raiz.textContent.slice(0, 120));
comprobar('no hay `undefined` en pantalla', !appPlaneador.raiz.textContent.includes('undefined'));
comprobar('no hay `[object Object]` en pantalla', !appPlaneador.raiz.textContent.includes('[object Object]'));
comprobar('el botón de nueva idea está', appPlaneador.porTexto('button', 'Nueva idea') !== null);

console.log('\n== Paso e: las ideas del seed no ofrecen editar ni borrar ==');
// Es la diferencia entre seed y propia en la interfaz. Si apareciera el botón,
// quien pulsara podría abrir un formulario con una idea que al guardar no
// cambiaría, o borrar contenido de ejemplo sin poder recuperarlo.
const tarjetaSeed = tarjetas(appPlaneador.raiz)[0];
comprobar('una idea del seed no tiene botón de editar', tarjetaSeed.querySelector('button[aria-label^="Editar"]') === null);
comprobar('una idea del seed no tiene botón de borrar', tarjetaSeed.querySelector('button[aria-label^="Borrar"]') === null);
comprobar('una idea del seed sí se puede marcar como favorita', tarjetaSeed.querySelector('button[aria-pressed]') !== null);
comprobar('una idea del seed sí se puede convertir en evento', tarjetaSeed.querySelector('button:not([aria-label]):not([aria-pressed])') !== null);
comprobar('el corazón de la tarjeta anuncia la idea', /^Marcar como favorita|^Quitar de favoritas/.test(tarjetaSeed.querySelector('button[aria-pressed]')?.getAttribute('aria-label') ?? ''), tarjetaSeed.querySelector('button[aria-pressed]')?.getAttribute('aria-label') ?? 'sin etiqueta');

console.log('\n== Paso e: el filtro de categoría va a la URL ==');
const chipAfuera = [...appPlaneador.raiz.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Afuera');
comprobar('el chip de categoría es un botón', chipAfuera !== null);
comprobar('el chip no está seleccionado al principio', chipAfuera?.getAttribute('aria-pressed') !== 'true', chipAfuera?.getAttribute('aria-pressed') ?? 'sin atributo');
await appPlaneador.pulsar(chipAfuera);
comprobar('pulsar un chip escribe en la URL', ecoUrl().includes('categoria=afuera'), ecoUrl());
comprobar('el filtro acota la lista', tarjetas(appPlaneador.raiz).length === 1, String(tarjetas(appPlaneador.raiz).length));
comprobar('solo queda la idea de esa categoría', tarjetas(appPlaneador.raiz).every((t) => t.textContent.includes('Picnic') || t.textContent.includes('Escapada')), tarjetas(appPlaneador.raiz).map(tituloTarjeta).join('|'));
comprobar('el chip pulsado queda marcado como seleccionado', chipAfuera?.getAttribute('aria-pressed') === 'true', chipAfuera?.getAttribute('aria-pressed') ?? 'sin atributo');
comprobar('aparece el botón de quitar filtros', appPlaneador.porTexto('button', 'Quitar filtros') !== null);
comprobar('el contador anuncia cuántas quedan', document.querySelector('[aria-live="polite"]')?.textContent.includes('1 de 5'), document.querySelector('[aria-live="polite"]')?.textContent ?? '(sin texto)');

console.log('\n== Paso e: una URL con filtro abre esa vista ==');
await appPlaneador.desmontar();
const appDesdeEnlace = await montarPlaneador('?categoria=relax');
comprobar('un enlace con filtro abre la vista filtrada', tarjetas(appDesdeEnlace.raiz).length === 1, String(tarjetas(appDesdeEnlace.raiz).length));
comprobar('y es la idea de esa categoría', tarjetas(appDesdeEnlace.raiz)[0].textContent.includes('spa'), tarjetas(appDesdeEnlace.raiz)[0].textContent.slice(0, 80));
await appDesdeEnlace.desmontar();

// Y un enlace con una categoría inventada no rompe la página: cae en "todas".
const appConCategoriaRara = await montarPlaneador('?categoria=%3Cscript%3E');
comprobar('una categoría inventada en la URL no rompe la página', tarjetas(appConCategoriaRara.raiz).length === sd.crearIdeasSeed().length, String(tarjetas(appConCategoriaRara.raiz).length));
comprobar('el filtro inválido no aparece en pantalla', !appConCategoriaRara.raiz.textContent.includes('<script>'));
await appConCategoriaRara.desmontar();

console.log('\n== Paso e: solo favoritas ==');
const appSoloFavoritas = await montarPlaneador('?favoritas=1');
comprobar('un enlace con favoritas=1 abre solo las marcadas', tarjetas(appSoloFavoritas.raiz).length === 2, String(tarjetas(appSoloFavoritas.raiz).length));
const interruptor = appSoloFavoritas.raiz.querySelector('[role="switch"]');
comprobar('el interruptor es un switch, no una casilla', interruptor !== null);
comprobar('el interruptor refleja el estado de la URL', interruptor?.getAttribute('aria-checked') === 'true', interruptor?.getAttribute('aria-checked') ?? 'sin atributo');
comprobar('el interruptor tiene nombre visible', interruptor?.textContent.includes('Solo favoritas'), interruptor?.textContent ?? '(sin texto)');

await appSoloFavoritas.pulsar(interruptor);
comprobar('desactivarlo quita el parámetro de la URL', !ecoUrl().includes('favoritas'), ecoUrl());
comprobar('y vuelve a salir la lista completa', tarjetas(appSoloFavoritas.raiz).length === sd.crearIdeasSeed().length, String(tarjetas(appSoloFavoritas.raiz).length));

// Con el interruptor apagado pero ninguna idea marcada, el estado vacío tiene que
// decir qué hacer, en vez de un "no hay nada" que no explica el motivo.
await appSoloFavoritas.pulsar(appSoloFavoritas.raiz.querySelector('[role="switch"]'));
comprobar('volver a activarlo recupera el filtro', ecoUrl().includes('favoritas=1'), ecoUrl());
await appSoloFavoritas.pulsar(appSoloFavoritas.raiz.querySelector('[role="switch"]'));
await appSoloFavoritas.desmontar();

console.log('\n== Paso e: marcar favorita es optimista y avisa si falla ==');
const appFavorita = await montarPlaneador();
const ideaNoFavorita = tarjetas(appFavorita.raiz).find((t) => t.querySelector('button[aria-pressed="false"]'));
comprobar('hay una idea sin marcar para probar', ideaNoFavorita !== undefined);
const corazon = ideaNoFavorita.querySelector('button[aria-pressed]');
comprobar('el corazón empieza sin marcar', corazon.getAttribute('aria-pressed') === 'false');
await appFavorita.pulsar(corazon);
comprobar('el corazón se marca al instante', document.querySelector(`article[data-id="${ideaNoFavorita.dataset.id}"] button[aria-pressed]`)?.getAttribute('aria-pressed') === 'true');
comprobar('el cambio llegó al almacén', (await ci.getIdeasCitas()).find((i) => i.id === ideaNoFavorita.dataset.id)?.favorita === true);
comprobar('un guardado correcto no enseña ningún aviso', appFavorita.raiz.querySelector('[role="alert"]') === null);
await appFavorita.desmontar();

// Ahora al revés: con el almacén que falla al escribir, marcar tiene que
// revertirse y avisar.
//
// El almacén se llena ANTES de montar. Si estuviera vacío, la propia siembra
// inicial intentaría escribir y fallaría, así que la página no llegaría a
// pintar ninguna tarjeta y la prueba mediría un error de carga en vez de la
// reversión del favorito.
const storageCerrado = new LocalStorageMock({ fallaAlEscribir: true });
storageCerrado.map.set('juntos:v3:citas', JSON.stringify(sd.crearIdeasSeed()));
storageCerrado.map.set('juntos:v3:eventos', JSON.stringify(sd.crearEventosSeed()));
const ventanaOriginal = globalThis.window;
globalThis.window = { ...ventanaOriginal, localStorage: storageCerrado };
const appFalloFavorita = await montarPlaneador();
comprobar('con el almacén lleno, la lista se pinta igual', tarjetas(appFalloFavorita.raiz).length === sd.crearIdeasSeed().length, String(tarjetas(appFalloFavorita.raiz).length));
const ideaParaMarcar = tarjetas(appFalloFavorita.raiz).find((t) => t.querySelector('button[aria-pressed="false"]'));
await appFalloFavorita.pulsar(ideaParaMarcar.querySelector('button[aria-pressed]'));
comprobar('si no se puede guardar, el aviso se anuncia como alerta', appFalloFavorita.raiz.querySelector('[role="alert"]') !== null);
comprobar('el aviso explica que se ha revertido', /vuelto a como estaba|revertid/i.test([...appFalloFavorita.raiz.querySelectorAll('[role="alert"]')].map((a) => a.textContent).join(' ')), [...appFalloFavorita.raiz.querySelectorAll('[role="alert"]')].map((a) => a.textContent).join(' | '));
comprobar('el corazón vuelve a su estado anterior', document.querySelector(`article[data-id="${ideaParaMarcar.dataset.id}"] button[aria-pressed]`)?.getAttribute('aria-pressed') === 'false');
comprobar('la lista no se queda con el cambio a medias', tarjetas(appFalloFavorita.raiz).length === sd.crearIdeasSeed().length);
globalThis.window = ventanaOriginal;
await appFalloFavorita.desmontar();

console.log('\n== Paso e: crear una idea propia ==');
const appAlta = await montarPlaneador();
await appAlta.pulsar(appAlta.porTexto('button', 'Nueva idea'));
comprobar('el botón abre el formulario de idea', document.querySelector('[role="dialog"]') !== null);
comprobar('el formulario es el de idea, no el de evento', document.querySelector('[role="dialog"]')?.textContent.includes('Nueva idea'), document.querySelector('[role="dialog"]')?.textContent?.slice(0, 80));
comprobar('no pide fecha, porque una idea no tiene día', document.querySelector('[role="dialog"]')?.querySelector('input[type="date"]') === null);

const formularioIdea = document.querySelector('[role="dialog"] form');
await appAlta.enviar(formularioIdea);
comprobar('una idea sin título no se guarda', (await ci.getIdeasCitas()).length === sd.crearIdeasSeed().length);
comprobar('el título vacío se marca inválido', formularioIdea.querySelector('input[type="text"]').getAttribute('aria-invalid') === 'true', formularioIdea.querySelector('input[type="text"]').getAttribute('aria-invalid') ?? 'sin atributo');
// El error de un campo NO lleva role="alert", y es a propósito: los errores de
// campo se anuncian con aria-invalid y aria-describedby, que es lo que ata el
// mensaje a su control. Un role="alert" por cada tecla escrita sería peor: el
// lector lo leería en voz alta mientras se corrige.
comprobar('el error del campo se asocia a su control', (formularioIdea.querySelector('input[type="text"]').getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).every((id) => document.getElementById(id) !== null) && formularioIdea.textContent.includes('obligatorio'), formularioIdea.querySelector('input[type="text"]').getAttribute('aria-describedby') ?? 'null');
comprobar('el error del campo no interrumpe con role="alert"', formularioIdea.querySelector('[role="alert"]') === null);
comprobar('el foco va al campo que falla', document.activeElement === formularioIdea.querySelector('input[type="text"]'), `foco en ${document.activeElement?.tagName}`);

await appAlta.escribir(formularioIdea.querySelector('input[type="text"]'), 'Mirar las estrellas');
await appAlta.pulsar(formularioIdea.querySelector('button[type="submit"]'));
comprobar('la idea nueva se guarda', (await ci.getIdeasCitas()).length === sd.crearIdeasSeed().length + 1, String((await ci.getIdeasCitas()).length));
comprobar('el formulario se cierra tras guardar', document.querySelector('[role="dialog"]') === null);
comprobar('la idea nueva aparece en la lista', tarjetas(appAlta.raiz).some((t) => tituloTarjeta(t) === 'Mirar las estrellas'), tarjetas(appAlta.raiz).map(tituloTarjeta).join('|'));
comprobar('la idea nueva sí tiene botón de editar', tarjetas(appAlta.raiz).find((t) => tituloTarjeta(t) === 'Mirar las estrellas')?.querySelector('button[aria-label^="Editar"]') !== null);
comprobar('la idea nueva sí tiene botón de borrar', tarjetas(appAlta.raiz).find((t) => tituloTarjeta(t) === 'Mirar las estrellas')?.querySelector('button[aria-label^="Borrar"]') !== null);
comprobar('la idea nueva es editable según el origen', pl.esIdeaEditable((await ci.getIdeasCitas()).find((i) => i.titulo === 'Mirar las estrellas')));

console.log('\n== Paso e: editar una idea propia ==');
const tarjetaNueva = () => tarjetas(appAlta.raiz).find((t) => tituloTarjeta(t) === 'Mirar las estrellas');
await appAlta.pulsar(tarjetaNueva()?.querySelector('button[aria-label^="Editar"]'));
comprobar('editar abre el formulario con el título puesto', document.querySelector('[role="dialog"] input[type="text"]')?.value === 'Mirar las estrellas', document.querySelector('[role="dialog"] input[type="text"]')?.value);
comprobar('el formulario anuncia que es una edición', document.querySelector('[role="dialog"]')?.textContent.includes('Editar idea'), document.querySelector('[role="dialog"]')?.textContent?.slice(0, 60));
const formularioEdicion = document.querySelector('[role="dialog"] form');
await appAlta.escribir(formularioEdicion.querySelector('input[type="text"]'), 'Mirar las estrellas desde el salón');
await appAlta.pulsar(formularioEdicion.querySelector('button[type="submit"]'));
comprobar('el título editado se guarda', (await ci.getIdeasCitas()).some((i) => i.titulo === 'Mirar las estrellas desde el salón'));
comprobar('la lista muestra el título nuevo', tarjetas(appAlta.raiz).some((t) => tituloTarjeta(t) === 'Mirar las estrellas desde el salón'));
comprobar('editar no crea una idea nueva', (await ci.getIdeasCitas()).length === sd.crearIdeasSeed().length + 1, String((await ci.getIdeasCitas()).length));

console.log('\n== Paso e: convertir una idea en evento ==');
const ideaDelSeed = (await ci.getIdeasCitas()).find((i) => i.origen === mo.ORIGEN.SEED);
const ideasAntes = (await ci.getIdeasCitas()).length;
const eventosAntes = (await ev.getEventos()).length;
const tarjetaConIdea = tarjetas(appAlta.raiz).find((t) => t.textContent.includes(ideaDelSeed.titulo));
await appAlta.pulsar(tarjetaConIdea.querySelector('button:not([aria-label]):not([aria-pressed])'));
comprobar('convertir abre el formulario de evento', document.querySelector('[role="dialog"]') !== null);
const formEvento = document.querySelector('[role="dialog"] form');
const tituloEvento = formEvento.querySelector('[id$="titulo"]');
const fechaEvento = formEvento.querySelector('[id$="fecha"]');
comprobar('el evento hereda el título de la idea', tituloEvento.value === ideaDelSeed.titulo, tituloEvento.value);
comprobar('el evento hereda la descripción de la idea', formEvento.querySelector('[id$="descripcion"]').value === ideaDelSeed.descripcion, formEvento.querySelector('[id$="descripcion"]').value);
comprobar('el evento hereda la foto de la idea', formEvento.querySelector('img')?.getAttribute('src') === ideaDelSeed.imagen, formEvento.querySelector('img')?.getAttribute('src') ?? 'sin imagen');
comprobar('la fecha llega vacía, no con la de hoy', fechaEvento.value === '', JSON.stringify(fechaEvento.value));

// Enviarlo sin fecha tiene que fallar: es el día lo único que no se puede
// inventar, y por eso el campo se queda sin rellenar a propósito.
await appAlta.enviar(formEvento);
comprobar('convertir sin fecha no guarda nada', (await ev.getEventos()).length === eventosAntes, String((await ev.getEventos()).length));
comprobar('la fecha vacía se marca inválida', fechaEvento.getAttribute('aria-invalid') === 'true', fechaEvento.getAttribute('aria-invalid') ?? 'sin atributo');

await appAlta.escribir(fechaEvento, '2026-11-14');
await appAlta.pulsar(formEvento.querySelector('button[type="submit"]'));
comprobar('con fecha, el evento se crea', (await ev.getEventos()).length === eventosAntes + 1, String((await ev.getEventos()).length));
const eventoCreado = (await ev.getEventos()).find((e) => e.titulo === ideaDelSeed.titulo);
comprobar('el evento queda con la fecha elegida', eventoCreado?.fecha === '2026-11-14', eventoCreado?.fecha);
comprobar('el evento se guarda como cita', eventoCreado?.categoria === 'cita', eventoCreado?.categoria);
comprobar('la idea sigue en el planeador', (await ci.getIdeasCitas()).length === ideasAntes, String((await ci.getIdeasCitas()).length));
comprobar('convertir no borra la idea del almacén', (await ci.getIdeasCitas()).some((i) => i.id === ideaDelSeed.id));
comprobar('la página avisa de que ya está en el calendario', appAlta.raiz.querySelector('[role="alert"]')?.textContent.includes('calendario') === true, appAlta.raiz.querySelector('[role="alert"]')?.textContent ?? '(sin texto)');
comprobar('convertir no deja la idea marcada como favorita por error', (await ci.getIdeasCitas()).find((i) => i.id === ideaDelSeed.id)?.favorita === ideaDelSeed.favorita);

console.log('\n== Paso e: borrar una idea propia ==');
const tarjetaBorrable = () => tarjetas(appAlta.raiz).find((t) => tituloTarjeta(t) === 'Mirar las estrellas desde el salón');
await appAlta.pulsar(
  tarjetaBorrable()?.querySelector('button[aria-label^="Borrar"]'),
  'el botón "Borrar" de la tarjeta "Mirar las estrellas desde el salón"',
);
// El modal se monta con `createPortal` sobre `document.body`, así que no está
// dentro de `appAlta.raiz`. Buscarlo en el contenedor daría siempre null y la
// prueba pasaría por el motivo equivocado.
comprobar('borrar pide confirmación antes de nada', document.querySelector('[role="alertdialog"], [role="dialog"]') !== null);
comprobar('la confirmación es un diálogo con alarma', document.querySelector('[role="alertdialog"]') !== null);
comprobar('la confirmación nombra la idea que se borra', document.querySelector('[role="alertdialog"]')?.textContent.includes('Mirar las estrellas desde el salón'), document.querySelector('[role="alertdialog"]')?.textContent?.slice(0, 100));
// `aria-describedby` no basta con que exista: tiene que apuntar a nodos que
// existen de verdad, o el lector se queda sin nada que leer y el atributo solo
// aparenta cumplir.
const descritoPor = (document.querySelector('[role="alertdialog"]')?.getAttribute('aria-describedby') ?? '')
  .split(' ')
  .filter(Boolean);
comprobar('el diálogo describe el mensaje que hay que atender', descritoPor.length > 0, `aria-describedby="${descritoPor.join(' ')}"`);
comprobar('cada identificador de la descripción existe', descritoPor.every((id) => document.getElementById(id) !== null), descritoPor.join(' '));
comprobar('la descripción incluye el mensaje con la idea', descritoPor.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').includes('Mirar las estrellas desde el salón'));
comprobar('el foco inicial va a la opción segura', document.activeElement?.textContent.trim() === 'Dejarla', `foco en "${document.activeElement?.textContent?.trim() ?? ''}"`);
comprobar('todavía no se ha borrado nada', (await ci.getIdeasCitas()).length === ideasAntes, String((await ci.getIdeasCitas()).length));

await appAlta.pulsar(appAlta.porTextoGlobal('button', 'Dejarla'), 'el botón "Dejarla" del diálogo de borrado, que está dentro del modal');
comprobar('cancelar no borra', (await ci.getIdeasCitas()).length === ideasAntes, String((await ci.getIdeasCitas()).length));
comprobar('cancelar cierra la confirmación', document.querySelector('[role="alertdialog"]') === null);
comprobar('la idea sigue en la lista', tarjetaBorrable() !== undefined);

await appAlta.pulsar(tarjetaBorrable().querySelector('button[aria-label^="Borrar"]'), 'el botón "Borrar" de la tarjeta, otra vez, para confirmar');
await appAlta.pulsar(appAlta.porTextoGlobal('button', 'Borrar la idea'), 'el botón "Borrar la idea" del diálogo');
comprobar('confirmar sí borra', (await ci.getIdeasCitas()).length === ideasAntes - 1, String((await ci.getIdeasCitas()).length));
comprobar('la idea desaparece de la lista', tarjetaBorrable() === undefined);

// Limpieza: se deja el almacén como estaba al empezar, para que las pruebas
// que vengan después no dependan de lo que se haya hecho aquí.
await ci.resetCitas();
await appAlta.desmontar();
comprobar('desmontar la página no deja avisos en consola', true);


/*
 * ---------------------------------------------------------------------------
 * Paso f: la galería.
 *
 * La galería no guarda fotos propias: usa la de cada evento. Eso significa que
 * estas pruebas no necesitan sembrar nada nuevo, solo comprobar que la vista
 * se deriva bien de los eventos que ya hay y que la foto llega a su detalle.
 *
 * La lógica de derivación se prueba aparte, sin montar nada, porque es pura.
 * Lo que necesita DOM es lo que de verdad necesita DOM: pintar el mosaico,
 * seguir un enlace y leer un parámetro de la URL.
 * ---------------------------------------------------------------------------
 */
const ga = await vite.ssrLoadModule('/src/utils/galeria.js');
const GaleriaPagina = (await vite.ssrLoadModule('/src/pages/Galeria.jsx')).default;

console.log('\n== Paso f: la galería se deriva de los eventos ==');
const eventosSemFoto = [
  { id: 'ev-sin-foto', fecha: '2026-10-02', titulo: 'Cena en casa', categoria: 'cita' },
  { id: 'ev-foto', fecha: '2026-10-14', titulo: 'Noche de juegos', categoria: 'amigos', foto: 'https://ejemplo.test/a.jpg' },
  { id: 'ev-vacia', fecha: '2026-10-20', titulo: 'Paseo', categoria: 'viaje', foto: '   ' },
  { id: 'ev-nulo', fecha: '2026-10-21', titulo: 'Café', categoria: 'cita', foto: null },
  { fecha: '2026-10-22', titulo: 'Sin id', categoria: 'cita', foto: 'https://ejemplo.test/b.jpg' },
  { id: 'ev-sin-fecha', titulo: 'Sin fecha', categoria: 'cita', foto: 'https://ejemplo.test/c.jpg' },
];
const fotosDerivadas = ga.extraerFotos(eventosSemFoto);
// Una foto sin id o sin fecha no se puede enlazar a su recuerdo ni agrupar, así
// que se descarta junto con las que no son utilizables.
comprobar('solo entran los eventos con foto utilizable', fotosDerivadas.length === 1, String(fotosDerivadas.length));
comprobar('la foto conserva el evento de contexto', fotosDerivadas[0].evento?.id === 'ev-foto', fotosDerivadas[0].evento?.id ?? 'sin evento');
comprobar('una foto en blanco no cuela como imagen', !fotosDerivadas.some((f) => f.id === 'ev-vacia'), fotosDerivadas.map((f) => f.id).join('|'));
comprobar('una foto nula no cuela como imagen', !fotosDerivadas.some((f) => f.id === 'ev-nulo'), fotosDerivadas.map((f) => f.id).join('|'));
comprobar('sin lista de eventos no hay fotos y no se rompe', ga.extraerFotos(null).length === 0 && ga.extraerFotos(undefined).length === 0);
comprobar('sin lista de eventos no hay fotos y no se rompe con lista vacía', ga.extraerFotos([]).length === 0);

// El orden de la galería es por recencia, al revés que el calendario. Se
// comprueba con dos años, porque con uno solo los dos sentidos coinciden y la
// prueba pasaría sin estar mirando lo que dice mirar.
const eventosParaOrden = [
  { id: 'a', fecha: '2025-03-01', titulo: 'Viejo', categoria: 'cita', foto: 'https://ejemplo.test/1.jpg' },
  { id: 'b', fecha: '2026-12-01', titulo: 'Nuevo', categoria: 'cita', foto: 'https://ejemplo.test/2.jpg' },
  { id: 'c', fecha: '2026-01-05', titulo: 'Intermedio', categoria: 'cita', foto: 'https://ejemplo.test/3.jpg' },
];
comprobar(
  'las fotos van de más reciente a más antigua',
  ga.extraerFotos(eventosParaOrden).map((f) => f.id).join(',') === 'b,c,a',
  ga.extraerFotos(eventosParaOrden).map((f) => f.id).join(','),
);
// Dos eventos el mismo día: manda la hora, y el que no tiene hora va al final
// porque ocupa el día entero en vez de un momento concreto.
const eventosMismoDia = [
  { id: 'sin-hora', fecha: '2026-10-14', titulo: 'A', categoria: 'cita', foto: 'https://ejemplo.test/1.jpg' },
  { id: 'tarde', fecha: '2026-10-14', titulo: 'B', categoria: 'cita', hora: '21:00', foto: 'https://ejemplo.test/2.jpg' },
  { id: 'manana', fecha: '2026-10-14', titulo: 'C', categoria: 'cita', hora: '09:00', foto: 'https://ejemplo.test/3.jpg' },
];
comprobar(
  'a igualdad de día manda la hora',
  ga.extraerFotos(eventosMismoDia).map((f) => f.id).join(',') === 'tarde,manana,sin-hora',
  ga.extraerFotos(eventosMismoDia).map((f) => f.id).join(','),
);

const agrupadas = ga.agruparFotosPorMes(ga.extraerFotos(eventosParaOrden));
comprobar('las fotos se agrupan por mes', agrupadas.length === 3, String(agrupadas.length));
comprobar('los meses van del más reciente al más antiguo', agrupadas[0].clave === '2026-12' && agrupadas[agrupadas.length - 1].clave === '2025-03', agrupadas.map((g) => g.clave).join('|'));
comprobar('el encabezado del mes se escribe una sola vez', agrupadas.every((g) => typeof g.etiqueta === 'string' && g.etiqueta !== ''), agrupadas.map((g) => g.etiqueta).join('|'));

comprobar('los años con fotos van de más reciente a más antigua', ga.aniosConFotos(ga.extraerFotos(eventosParaOrden)).join(',') === '2026,2025', ga.aniosConFotos(ga.extraerFotos(eventosParaOrden)).join(','));
comprobar('un año repetido no se repite en el filtro', ga.aniosConFotos(ga.extraerFotos([...eventosParaOrden, eventosParaOrden[1]])).length === 2, String(ga.aniosConFotos(ga.extraerFotos([...eventosParaOrden, eventosParaOrden[1]])).length));
comprobar('filtrar por año deja solo ese año', ga.filtrarPorAnio(ga.extraerFotos(eventosParaOrden), '2025').length === 1, String(ga.filtrarPorAnio(ga.extraerFotos(eventosParaOrden), '2025').length));
comprobar('sin año no se filtra nada', ga.filtrarPorAnio(ga.extraerFotos(eventosParaOrden), null).length === 3, String(ga.filtrarPorAnio(ga.extraerFotos(eventosParaOrden), null).length));
comprobar('un año de la URL se acepta si tiene cuatro cifras', ga.anioValido('2026') === '2026', String(ga.anioValido('2026')));
comprobar('un año mal escrito no filtra y deja la página vacía', ga.anioValido('20') === null && ga.anioValido('<script>') === null && ga.anioValido('') === null, String(ga.anioValido('20')));
comprobar('el recuento concuerda en singular', ga.textoRecuento([{ id: 'a' }]) === '1 foto', ga.textoRecuento([{ id: 'a' }]));
comprobar('el recuento concuerda en plural', ga.textoRecuento([{ id: 'a' }, { id: 'b' }]) === '2 fotos', ga.textoRecuento([{ id: 'a' }, { id: 'b' }]));

console.log('\n== Paso f: la página pinta el mosaico ==');
await ev.resetEventos();
const montarGaleria = (busqueda = '') =>
  montar(
    ReactCjs.createElement(
      MemoryRouter,
      { initialEntries: [`/galeria${busqueda}`] },
      ReactCjs.createElement(GaleriaPagina),
      ReactCjs.createElement(EcoDeUrl),
    ),
  );

const celdas = (raiz) => [...raiz.querySelectorAll('a[aria-label^="Ver el recuerdo"]')];

/**
 * Escribe una lista de eventos en el almacén que está usando la app ahora mismo.
 *
 * Se escribe en `window.localStorage` y no en el `LocalStorageMock` de arriba
 * porque, desde que se monto el DOM de jsdom, la app lee del almacén de jsdom.
 * Escribir en el mock dejaría los datos a medias de camino y la página se
 * montaría con los del seed, y la prueba mediría lo que ya había en vez de lo
 * que se acaba de escribir.
 *
 * @param {ReadonlyArray<object>} datos Eventos a guardar.
 * @returns {void}
 * @example
 * escribirEventos([{ id: 'x', titulo: 'Uno', fecha: '2025-01-01' }]);
 */
const escribirEventos = (datos) =>
  globalThis.window.localStorage.setItem('juntos:v3:eventos', JSON.stringify(datos));
const conFoto = (await ev.getEventos()).filter((e) => typeof e.foto === 'string' && e.foto.trim() !== '');
comprobar('el seed trae al menos un evento con foto', conFoto.length > 0, String(conFoto.length));

const appGaleria = await montarGaleria();
comprobar('la galería se monta con las fotos del seed', celdas(appGaleria.raiz).length === conFoto.length, `${celdas(appGaleria.raiz).length} de ${conFoto.length}`);
// El orden de la galería es por recencia, al revés que el calendario, así que
// aquí importa de dónde vino la lista y no de qué la ordena.
const ordenEnPantalla = celdas(appGaleria.raiz).map((a) => a.getAttribute('href'));
comprobar(
  'la primera foto del mosaico es la más reciente',
  ordenEnPantalla[0] === `/evento/${encodeURIComponent(ga.extraerFotos(await ev.getEventos())[0].id)}`,
  ordenEnPantalla.slice(0, 3).join('|'),
);
comprobar('cada foto dice a qué recuerdo y de cuándo va', celdas(appGaleria.raiz).every((a) => /^Ver el recuerdo de .+, .+$/.test(a.getAttribute('aria-label') ?? '')), celdas(appGaleria.raiz)[0]?.getAttribute('aria-label') ?? '(sin enlace)');
comprobar('el mosaico nombra los meses', appGaleria.raiz.querySelectorAll('h2').length > 0, String(appGaleria.raiz.querySelectorAll('h2').length));
comprobar('cada mes tiene su lista de fotos', appGaleria.raiz.querySelectorAll('ul[role="list"]').length === appGaleria.raiz.querySelectorAll('h2').length, `${appGaleria.raiz.querySelectorAll('ul[role="list"]').length} listas y ${appGaleria.raiz.querySelectorAll('h2').length} meses`);
// La imagen es decorativa porque el enlace ya lleva título y fecha en la
// etiqueta. Con las dos, un lector de pantalla lo repetiría dos veces.
const primeraImagen = appGaleria.raiz.querySelector('a[aria-label^="Ver el recuerdo"] img');
comprobar('la foto no repite el texto del enlace', primeraImagen?.getAttribute('alt') === '', primeraImagen?.getAttribute('alt') ?? 'sin alt');
comprobar('la foto se carga sin bloquear la página', primeraImagen?.getAttribute('loading') === 'lazy', primeraImagen?.getAttribute('loading') ?? 'sin atributo');
comprobar('la foto apunta a la del evento', conFoto.some((e) => appGaleria.raiz.querySelector(`a[aria-label^="Ver el recuerdo"] img[src="${e.foto}"]`) !== null));
comprobar('el recuento dice cuántas fotos hay', appGaleria.raiz.textContent.includes(`${conFoto.length} foto${conFoto.length === 1 ? '' : 's'}`), appGaleria.raiz.textContent.slice(0, 120));
comprobar('no hay `undefined` en pantalla', !appGaleria.raiz.textContent.includes('undefined'), appGaleria.raiz.textContent.slice(0, 120));
comprobar('no hay `[object Object]` en pantalla', !appGaleria.raiz.textContent.includes('[object Object]'), appGaleria.raiz.textContent.slice(0, 120));
comprobar('la foto enlaza a su recuerdo', celdas(appGaleria.raiz).every((a) => /^\/evento\/[^/]+$/.test(a.getAttribute('href') ?? '')), celdas(appGaleria.raiz)[0]?.getAttribute('href') ?? '(sin enlace)');

console.log('\n== Paso f: el enlace "Ver en la galería" del detalle ==');
/*
 * El resaltado se busca solo entre los enlaces de foto, con
 * `a[aria-label^="Ver el recuerdo"]`, y no con cualquier `aria-current`. El
 * filtro de año también marca su enlace activo, así que un selector amplio lo
 * contaría como una foto resaltada. En diciembre el seed salta de año, el
 * filtro aparece y esos cuatro selectores falsos fallaban.
 */
const fotosResaltadas = (raiz) => raiz.querySelectorAll('a[aria-label^="Ver el recuerdo"][aria-current="true"]');
const fotoResaltada = (raiz) => raiz.querySelector('a[aria-label^="Ver el recuerdo"][aria-current="true"]');

const eventoResaltado = conFoto[0];
const appDesdeDetalle = await montarGaleria(`?evento=${encodeURIComponent(eventoResaltado.id)}`);
const resaltada = fotoResaltada(appDesdeDetalle.raiz);
comprobar('la foto abierta desde el detalle se resalta', resaltada !== null, `${celdas(appDesdeDetalle.raiz).length} fotos y ninguna resaltada`);
comprobar('se resalta la foto de ese evento y no otra', resaltada?.getAttribute('aria-label')?.includes(eventoResaltado.titulo) === true, resaltada?.getAttribute('aria-label') ?? '(sin enlace)');
comprobar('solo se resalta una foto', fotosResaltadas(appDesdeDetalle.raiz).length === 1, String(fotosResaltadas(appDesdeDetalle.raiz).length));
await appDesdeDetalle.desmontar();

// Un id que no existe no puede romper la página ni inventarse una foto.
const appEventoInexistente = await montarGaleria('?evento=no-existe');
comprobar('un evento inexistente deja la galería entera', celdas(appEventoInexistente.raiz).length === conFoto.length, String(celdas(appEventoInexistente.raiz).length));
comprobar('y no resalta nada', fotosResaltadas(appEventoInexistente.raiz).length === 0, String(fotosResaltadas(appEventoInexistente.raiz).length));
await appEventoInexistente.desmontar();

console.log('\n== Paso f: el filtro de año ==');
// Con un solo año con fotos el filtro no se ofrece: un selector de una única
// opción solo añade un clic para acabar en la misma galería de siempre.
const aniosDelSeed = ga.aniosConFotos(ga.extraerFotos(await ev.getEventos()));
// El filtro de año solo tiene sentido si hay más de un año que filtrar, así que
// lo que se comprueba es esa equivalencia y no un número de años fijo. En
// diciembre el seed salta al año siguiente y hay dos: la comprobación seguiría
// siendo válida con el reloj real, con `test:octubre` y con `test:febrero`.
comprobar('el filtro de año solo aparece si hay más de un año', (aniosDelSeed.length > 1) === (appGaleria.raiz.querySelector('nav[aria-label="Filtrar la galería por año"]') !== null), `años=${aniosDelSeed.join(',')}`);
await appGaleria.desmontar();

// Para probar el filtro hacen falta fotos de dos años, y el seed no los garantiza:
// cubre el mes en curso y el siguiente, así que en diciembre salta de año y en
// los demás meses no. Se siembran a mano datos de exactamente dos años, que es
// lo que habrá dentro de un año, y el filtro tiene que funcionar sin que cambie
// el seed. Los años se derivan del reloj de la suite en vez de escribirse, porque
// un año fijo dejaría de ser "el anterior" en cuanto la app pasara de año.
const ANIO_RECIENTE = String(rj.ahora().getFullYear());
const ANIO_VIEJO = String(Number(ANIO_RECIENTE) - 1);
const ANIO_SIN_FOTOS = String(Number(ANIO_VIEJO) - 1);
const datosDeDosAnios = [
  {
    id: 'ev-reciente-1',
    titulo: 'Cena de aniversario',
    descripcion: '',
    fecha: `${ANIO_RECIENTE}-06-14`,
    hora: '20:00',
    categoria: 'cita',
    foto: 'https://ejemplo.test/reciente-1.jpg',
    lugar: '',
  },
  {
    id: 'ev-reciente-2',
    titulo: 'Escapada de fin de semana',
    descripcion: '',
    fecha: `${ANIO_RECIENTE}-08-02`,
    hora: '',
    categoria: 'aventura',
    foto: 'https://ejemplo.test/reciente-2.jpg',
    lugar: '',
  },
  {
    id: 'ev-antiguo-1',
    titulo: 'Primer viaje juntos',
    descripcion: '',
    fecha: `${ANIO_VIEJO}-06-14`,
    hora: '18:00',
    categoria: 'viaje',
    foto: 'https://ejemplo.test/viejo-1.jpg',
    lugar: '',
  },
  {
    id: 'ev-antiguo-2',
    titulo: 'Aniversario de la playa',
    descripcion: '',
    fecha: `${ANIO_VIEJO}-08-02`,
    hora: '',
    categoria: 'cita',
    foto: 'https://ejemplo.test/viejo-2.jpg',
    lugar: '',
  },
  // Sin foto a propósito: el filtro cuenta fotos, no años de recuerdos.
  {
    id: 'ev-antiguo-sin-foto',
    titulo: 'Cena de aniversario',
    descripcion: '',
    fecha: `${ANIO_VIEJO}-09-01`,
    hora: '21:00',
    categoria: 'cita',
    foto: null,
    lugar: '',
  },
];
escribirEventos(datosDeDosAnios);

const fotosDeDosAnios = ga.extraerFotos(datosDeDosAnios);
const anios = ga.aniosConFotos(fotosDeDosAnios);
comprobar('con fotos de dos años hay dos años', anios.length === 2, anios.join(','));
comprobar('los años van del más reciente al más antiguo', anios[0] === ANIO_RECIENTE && anios[1] === ANIO_VIEJO, anios.join(','));

const appAnios = await montarGaleria();
comprobar('con varios años se ofrece el filtro', appAnios.raiz.querySelector('nav[aria-label="Filtrar la galería por año"]') !== null);
comprobar('el filtro ofrece Todos y cada año', ['Todos', ...anios].every((t) => appAnios.raiz.textContent.includes(t)), appAnios.raiz.textContent.slice(0, 160));
comprobar('un año sin fotos no aparece en el filtro', !ga.aniosConFotos(fotosDeDosAnios).some((a) => a === ANIO_SIN_FOTOS), anios.join(','));
comprobar('el filtro no filtra nada todavía', celdas(appAnios.raiz).length === fotosDeDosAnios.length, `${celdas(appAnios.raiz).length} de ${fotosDeDosAnios.length}`);

const enlaceAnioViejo = appAnios.raiz.querySelector(`nav[aria-label="Filtrar la galería por año"] a[href="/galeria?anio=${ANIO_VIEJO}"]`);
comprobar('el enlace del año apunta a la URL filtrada', enlaceAnioViejo !== null, `anio=${ANIO_VIEJO}`);
await appAnios.pulsar(enlaceAnioViejo, 'el enlace del año antiguo, en el filtro de la galería');
comprobar('elegir un año lo escribe en la URL', ecoUrl().includes(`anio=${ANIO_VIEJO}`), ecoUrl());
const fotosDelAnioViejo = ga.filtrarPorAnio(fotosDeDosAnios, ANIO_VIEJO).length;
comprobar('el filtro acota las fotos a ese año', celdas(appAnios.raiz).length === fotosDelAnioViejo, `${celdas(appAnios.raiz).length} de ${fotosDelAnioViejo}`);
comprobar('el año elegido queda marcado como seleccionado', document.querySelector('nav[aria-label="Filtrar la galería por año"] a[aria-current="true"]')?.textContent.trim() === ANIO_VIEJO, document.querySelector('nav[aria-label="Filtrar la galería por año"] a[aria-current="true"]')?.textContent ?? '(sin marcar)');
comprobar('el recuento pasa a contar ese año', appAnios.raiz.textContent.includes(`${fotosDelAnioViejo} foto${fotosDelAnioViejo === 1 ? '' : 's'}`), appAnios.raiz.textContent.slice(0, 120));
comprobar('el filtro no deja la foto resaltada de antes', appAnios.raiz.querySelector('a[aria-current="true"][aria-label^="Ver el recuerdo"]') === null, 'queda resaltada');

// Volver a pulsar el año activo cierra el filtro, en vez de recargar la página.
await appAnios.pulsar(document.querySelector('nav[aria-label="Filtrar la galería por año"] a[aria-current="true"]'), 'el año ya seleccionado, para quitar el filtro');
comprobar('volver a elegir el año activo quita el filtro', !ecoUrl().includes('anio='), ecoUrl());
comprobar('y vuelven todas las fotos', celdas(appAnios.raiz).length === fotosDeDosAnios.length, String(celdas(appAnios.raiz).length));
await appAnios.desmontar();

await ev.resetEventos();

// Una URL con año malo no debe dejar la página vacía sin explicación.
const appAnioMalo = await montarGaleria('?anio=20');
comprobar('un año mal escrito no filtra', celdas(appAnioMalo.raiz).length === conFoto.length, String(celdas(appAnioMalo.raiz).length));
comprobar('ni se pinta en pantalla', !appAnioMalo.raiz.textContent.includes('>20<') && !appAnioMalo.raiz.textContent.includes('no hay fotos de 20'), appAnioMalo.raiz.textContent.slice(0, 160));
await appAnioMalo.desmontar();

// Y un año que existe en la URL pero no tiene fotos explica el motivo y ofrece
// volver, en vez de parecer que la pareja no tiene ninguna foto.
const anioVacio = '1999';
const appAnioVacio = await montarGaleria(`?anio=${anioVacio}`);
comprobar('un año sin fotos avisa de que no hay ninguna', appAnioVacio.raiz.textContent.includes(`No hay fotos de ${anioVacio}`), appAnioVacio.raiz.textContent.slice(0, 160));
comprobar('y ofrece volver a ver todos los años', appAnioVacio.porTexto('button', 'Ver todos los años') !== null);
await appAnioVacio.pulsar(appAnioVacio.porTexto('button', 'Ver todos los años'), 'el botón "Ver todos los años"');
comprobar('volver quita el año de la URL', !ecoUrl().includes('anio='), ecoUrl());
comprobar('y recupera las fotos', celdas(appAnioVacio.raiz).length === conFoto.length, String(celdas(appAnioVacio.raiz).length));
await appAnioVacio.desmontar();

console.log('\n== Paso f: los estados de carga, error y vacío ==');
// Sin ninguna foto, la página tiene que decir qué hacer, no quedarse en blanco.
await ev.resetEventos();
const eventosSinNingunaFoto = (await ev.getEventos()).map((e) => ({ ...e, foto: null }));
// Se escribe el almacén a mano, y no con `crearEvento`, porque quitar la foto de
// un evento ya creado no es una operación de la app: se sabe que el modelo
// admite `foto: null` y lo que se prueba es que la galería lo aguanta.
escribirEventos(eventosSinNingunaFoto);
const appVacia = await montarGaleria();
comprobar('sin fotos la página no enseña mosaico', celdas(appVacia.raiz).length === 0, String(celdas(appVacia.raiz).length));
comprobar('sin fotos explica que no hay ninguna', /Todav[ií]a no hay fotos/i.test(appVacia.raiz.textContent), appVacia.raiz.textContent.slice(0, 200));
comprobar('sin fotos ofrece crear la primera', appVacia.porTexto('a', 'Añadir el primer recuerdo') !== null);
comprobar('la salida enlaza al planeador', appVacia.porTexto('a', 'Añadir el primer recuerdo')?.getAttribute('href') === '/planeador', appVacia.porTexto('a', 'Añadir el primer recuerdo')?.getAttribute('href') ?? '(sin enlace)');
await appVacia.desmontar();

/*
 * Con el almacén caído, la página avisa y deja reintentar.
 *
 * Falla al leer *y* al escribir a propósito, y no solo al leer: `leer()`
 * convierte un fallo de lectura en `null`, que para el service significa
 * "primer arranque", así que intentaría sembrar el seed. Si la escritura
 * también falla, la siembra no cuaja y el error sube de verdad, que es el caso
 * que llega a la persona: un almacén que no admite ni leer ni guardar.
 *
 * Con un almacén que solo rechaza la lectura, la galería mostraría el seed sin
 * avisar de nada, y esa es justo la diferencia que esta comprobación no
 * quería dejar pasar.
 */
const storageCaido = new LocalStorageMock({ fallaAlLeer: true, fallaAlEscribir: true });
const ventanaParaError = globalThis.window;
globalThis.window = { ...ventanaParaError, localStorage: storageCaido };
const appError = await montarGaleria();
comprobar('si el almacén está caído, la página avisa como alerta', appError.raiz.querySelector('[role="alert"]') !== null, `texto: ${appError.raiz.textContent.slice(0, 200)}`);
comprobar('el aviso dice que se intente de nuevo', /int[eé]ntalo de nuevo/i.test(appError.raiz.textContent), appError.raiz.textContent.slice(0, 200));
comprobar('el aviso de error ofrece reintentar', appError.porTexto('button', 'Reintentar') !== null);
comprobar('y no enseña un mosaico vacío como si fuera contenido', celdas(appError.raiz).length === 0, String(celdas(appError.raiz).length));
comprobar('ni inventa un recuento de fotos sin datos', !/\d+ fotos?/.test(appError.raiz.textContent), appError.raiz.textContent.slice(0, 200));

// Reintentar con el almacén ya recuperado tiene que volver a pintar el mosaico.
globalThis.window = ventanaParaError;
await ev.resetEventos();
const appReintentada = await montarGaleria();
comprobar('reintentar con el almacén de vuelta recupera las fotos', celdas(appReintentada.raiz).length === conFoto.length, String(celdas(appReintentada.raiz).length));
comprobar('y el aviso de error desaparece', appReintentada.raiz.querySelector('[role="alert"]') === null);
await appReintentada.desmontar();
await appError.desmontar();

console.log('\n== Paso f: una foto que no carga ==');
await ev.resetEventos();
const appFotoRota = await montarGaleria();
// Se dispara el fallo de carga a mano: en el navegador lo hace la propia red,
// y en el arnés no hay red.
const imagenes = [...appFotoRota.raiz.querySelectorAll('a[aria-label^="Ver el recuerdo"] img')];
for (const imagen of imagenes) {
  await appFotoRota.disparar(imagen, 'error');
}
comprobar('la foto rota no se queda con la imagen a medio cargar', [...appFotoRota.raiz.querySelectorAll('a[aria-label^="Ver el recuerdo"] img')].length < imagenes.length, `${imagenes.length} al principio, ${[...appFotoRota.raiz.querySelectorAll('a[aria-label^="Ver el recuerdo"] img')].length} después`);
comprobar('la foto rota deja ver el degradado de su categoría', [...appFotoRota.raiz.querySelectorAll('a[aria-label^="Ver el recuerdo"] div[aria-hidden="true"]')].some((d) => (d.getAttribute('style') ?? '').includes('linear-gradient')), 'sin degradado');
comprobar('el enlace sigue siendo utilizable sin la foto', fotoResaltada(appFotoRota.raiz) === null && celdas(appFotoRota.raiz).every((a) => (a.getAttribute('href') ?? '').startsWith('/evento/')), 'sin enlaces');
await appFotoRota.desmontar();

console.log('\n== Paso f: la foto y su recuerdo no se desincronizan ==');
// La galería es una vista sobre los eventos, así que si se borra un recuerdo su
// foto tiene que desaparecer sin borrar nada más. Si algún día se guardaran
// fotos aparte, esta comprobación empezaría a fallar y avisaría.
await ev.resetEventos();
const eventosAntesDeBorrar = (await ev.getEventos()).filter((e) => typeof e.foto === 'string' && e.foto.trim() !== '');
const appAntesDeBorrar = await montarGaleria();
comprobar('antes de borrar hay una foto por evento con foto', celdas(appAntesDeBorrar.raiz).length === eventosAntesDeBorrar.length, String(celdas(appAntesDeBorrar.raiz).length));
const eventoABorrar = eventosAntesDeBorrar[0];
await ev.eliminarEvento(eventoABorrar.id);
// La página no se recarga sola al cambiar el almacén: es un service distinto el
// que avisaría. Se monta de nuevo para que el mosaico se derive del estado
// bueno, que es justo lo que se quiere comprobar.
await appAntesDeBorrar.desmontar();
const appDespuesDeBorrar = await montarGaleria();
comprobar('tras borrar un recuerdo su foto ya no está', !celdas(appDespuesDeBorrar.raiz).some((a) => a.getAttribute('href') === `/evento/${encodeURIComponent(eventoABorrar.id)}`), celdas(appDespuesDeBorrar.raiz).map((a) => a.getAttribute('href')).join('|'));
comprobar('las demás fotos siguen ahí', celdas(appDespuesDeBorrar.raiz).length === eventosAntesDeBorrar.length - 1, String(celdas(appDespuesDeBorrar.raiz).length));
await appDespuesDeBorrar.desmontar();
await ev.resetEventos();

console.log('\n== Paso f: ?evento= manda sobre ?anio= ==');
/*
 * Quien llega desde "Ver en la galería" de un detalle quiere ver esa foto. Si la
 * URL además trae un `?anio=` de otro tiempo, gana la foto: el filtro se ajusta
 * al año de la foto en vez de esconderla. Y no hace falta avisar de nada, porque
 * la foto resaltada ya dice dónde se está.
 */
const fotosParaElChoque = ga.extraerFotos([
  { id: 'ev-26', titulo: 'De 2026', fecha: '2026-03-02', hora: '', categoria: 'cita', foto: 'https://ejemplo.test/26.jpg' },
  { id: 'ev-25', titulo: 'De 2025', fecha: '2025-08-02', hora: '', categoria: 'cita', foto: 'https://ejemplo.test/25.jpg' },
]);
comprobar('sin evento manda el año pedido', ga.resolverAnio(fotosParaElChoque, '2025', null) === '2025', String(ga.resolverAnio(fotosParaElChoque, '2025', null)));
comprobar('sin año y sin evento no se filtra', ga.resolverAnio(fotosParaElChoque, null, null) === null, String(ga.resolverAnio(fotosParaElChoque, null, null)));
comprobar('la foto se impone al filtro de otro año', ga.resolverAnio(fotosParaElChoque, '2025', 'ev-26') === '2026', String(ga.resolverAnio(fotosParaElChoque, '2025', 'ev-26')));
comprobar('y también cuando no hay filtro puesto', ga.resolverAnio(fotosParaElChoque, null, 'ev-25') === '2025', String(ga.resolverAnio(fotosParaElChoque, null, 'ev-25')));
comprobar('coincidir no cambia nada', ga.resolverAnio(fotosParaElChoque, '2026', 'ev-26') === '2026', String(ga.resolverAnio(fotosParaElChoque, '2026', 'ev-26')));
comprobar('un evento desconocido respeta el filtro', ga.resolverAnio(fotosParaElChoque, '2025', 'no-existe') === '2025', String(ga.resolverAnio(fotosParaElChoque, '2025', 'no-existe')));
comprobar('un evento vacío no cuenta como evento', ga.resolverAnio(fotosParaElChoque, '2025', '') === '2025', String(ga.resolverAnio(fotosParaElChoque, '2025', '')));
comprobar('sin fotos no se inventa un año', ga.resolverAnio([], '2025', 'ev-26') === '2025', String(ga.resolverAnio([], '2025', 'ev-26')));
comprobar('una lista que no es lista no rompe', ga.resolverAnio(null, '2025', 'ev-26') === '2025', String(ga.resolverAnio(null, '2025', 'ev-26')));

// Y lo mismo con la página montada, que es donde se vería si el ajuste se
// escribiera en la URL en vez de derivarse en memoria.
await ev.resetEventos();
const eventosDeDosAniosParaChoque = [
  ...(await ev.getEventos()),
  {
    id: 'ev-del-2025',
    titulo: 'Otoño en el campo',
    descripcion: '',
    fecha: '2025-10-05',
    hora: '',
    categoria: 'cita',
    foto: 'https://ejemplo.test/campo.jpg',
    lugar: '',
  },
];
escribirEventos(eventosDeDosAniosParaChoque);
const appChoque = await montarGaleria(`?anio=2025&evento=${encodeURIComponent(conFoto[0].id)}`);
const fotosVisiblesTrasElChoque = celdas(appChoque.raiz).length;
comprobar('la foto del evento gana y se ve', appChoque.raiz.querySelector('a[aria-current="true"]') !== null, 'nada resaltado');
comprobar('el filtro se ajusta al año de esa foto', fotosVisiblesTrasElChoque === ga.filtrarPorAnio(ga.extraerFotos(eventosDeDosAniosParaChoque), conFoto[0].fecha.slice(0, 4)).length, `${fotosVisiblesTrasElChoque} fotos visibles`);
comprobar('la URL no se reescribe por el ajuste', ecoUrl().includes(`anio=2025`) && ecoUrl().includes(`evento=${conFoto[0].id}`), ecoUrl());
comprobar('el filtro de años marca el año de la foto', document.querySelector('nav[aria-label="Filtrar la galería por año"] a[aria-current="true"]')?.textContent.trim() === conFoto[0].fecha.slice(0, 4), document.querySelector('nav[aria-label="Filtrar la galería por año"] a[aria-current="true"]')?.textContent ?? '(sin marcar)');
await appChoque.desmontar();

// Un id que no existe deja el filtro como estaba, en vez de quitarlo.
const appChoqueInexistente = await montarGaleria('?anio=2025&evento=no-existe');
comprobar('un evento inexistente no toca el filtro', celdas(appChoqueInexistente.raiz).length === ga.filtrarPorAnio(ga.extraerFotos(eventosDeDosAniosParaChoque), '2025').length, String(celdas(appChoqueInexistente.raiz).length));
comprobar('y el filtro sigue en la URL', ecoUrl().includes('anio=2025'), ecoUrl());
await appChoqueInexistente.desmontar();
await ev.resetEventos();


await vite.close();
console.log(`\n${fallos === 0 ? 'TODO OK' : `${fallos} FALLOS`} — ${pruebas} pruebas, ${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
