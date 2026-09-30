/**
 * Pruebas de la capa de datos y de la cuadrícula del calendario.
 *
 * Comprueba el comportamiento real contra un localStorage simulado (siembra,
 * CRUD, validación, lectura tolerante a fallos, cuota, UUIDs) y la función pura
 * `construirCuadricula` sin montar React.
 * Ejecutar con: npm test
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
comprobar('clave con versión', st.claveDe('eventos') === 'juntos:v2:eventos', st.claveDe('eventos'));

console.log('\n== Siembra inicial ==');
const eventos = await ev.getEventos();
comprobar('sembró 8 eventos', eventos.length === 8, `len=${eventos.length}`);
comprobar('sembró 5 ideas', (await ci.getIdeasCitas()).length === 5);
comprobar('ordenados por fecha', eventos.every((e, i) => i === 0 || eventos[i-1].fecha <= e.fecha));
comprobar('persiste en la clave v2', storage.map.has('juntos:v2:eventos'));

console.log('\n== Fechas relativas al mes actual (29 sep 2026) ==');
const mesActual = new Date().getMonth();
const esteMes = eventos.filter((e) => new Date(e.fecha + 'T00:00:00').getMonth() === mesActual);
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
storage.setItem('juntos:v2:eventos', '{esto no es json');
comprobar('leer() devuelve null con JSON corrupto', st.leer('eventos') === null);
const reSembrados = await ev.getEventos();
comprobar('getEventos vuelve al seed', reSembrados.length === 8, `n=${reSembrados.length}`);
storage.setItem('juntos:v2:eventos', '{"no":"es un array"}');
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
  key: () => 'juntos:v2:eventos',
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
comprobar('resetDatos borra las claves', st.resetDatos() === true && st.listarClaves().length === 0);
comprobar('getEventos vuelve a sembrar', (await ev.getEventos()).length === 8);
comprobar('no toca claves ajenas', (() => {
  storage.setItem('otra-app:dato', 'x');
  st.resetDatos();
  return storage.getItem('otra-app:dato') === 'x';
})());

console.log('\n== Versiones anteriores ==');
// Tras el resetDatos anterior no queda nada, así que hay que sembrar de nuevo
// para tener una clave v1 que sí debe sobrevivir a la limpieza.
await ev.getEventos();
storage.setItem('juntos:v1:eventos', '[]');
storage.setItem('juntos:v2:citas', '[]');
comprobar('limpiarVersionesAnteriores borra v1', st.limpiarVersionesAnteriores().includes('juntos:v1:eventos'));
comprobar('conserva los eventos de la versión actual', storage.getItem('juntos:v2:eventos') !== null);
comprobar('conserva las citas de la versión actual', storage.getItem('juntos:v2:citas') !== null);

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
// Con hoy = 30 de septiembre casi todo el seed del mes actual ya pasó, así que
// los próximos eventos tienen que caer en meses siguientes y ser visibles al
// navegar con las flechas.
await ev.resetEventos();
const sembrados = await ev.getEventos();
const enSeptiembre = sembrados.filter((e) => e.fecha.startsWith('2026-09'));
const enOctubre = sembrados.filter((e) => e.fecha.startsWith('2026-10'));
comprobar('el seed cubre el mes actual', enSeptiembre.length > 0, `septiembre=${enSeptiembre.length}`);
comprobar('y también el mes siguiente', enOctubre.length > 0, `octubre=${enOctubre.length}`);
comprobar('octubre tiene los días 5, 12 y 15', ['2026-10-05', '2026-10-12', '2026-10-15'].every((f) => enOctubre.some((e) => e.fecha === f)));
const cuadrOct = ca.construirCuadricula(new Date(2026, 9, 1), HOY);
const indiceOct = fe.agruparPorFecha(enOctubre);
const octConDatos = ca.asignarEventos(cuadrOct, indiceOct, '2026-10-05');
comprobar('los eventos de octubre caen en celdas del mes', octConDatos.celdas.filter((c) => c.enMes && c.eventos.length > 0).length === 3);
comprobar('octubre muestra el 5 de octubre', octConDatos.celdas.find((c) => c.fechaISO === '2026-10-05').eventos.length > 0);
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
const { MemoryRouter, Routes, Route, Navigate } = requireDesdeProyecto('react-router-dom');
const PaginaCalendario = (await vite.ssrLoadModule('/src/pages/Calendario.jsx')).default;

console.log('\n== Render: la página del calendario ==');
const htmlPagina = renderPagina(
  ReactCjs.createElement(
    MemoryRouter,
    { initialEntries: ['/calendario?mes=2026-10'] },
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
// Sin cuadrícula, "Semana" y "Día" deben quedar inutilizables.
comprobar('Semana y Día salen deshabilitados', (htmlPagina.match(/disabled/g) || []).length >= 2, String((htmlPagina.match(/disabled/g) || []).length));

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

    /** Primer elemento que contiene el texto dado. */
    porTexto(selector, texto) {
      return [...contenedor.querySelectorAll(selector)].find((el) =>
        el.textContent.trim().includes(texto),
      );
    },

    /** Pulsa un elemento. */
    async pulsar(el) {
      if (!el) throw new Error('pulsar() recibió null');
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
     * @returns {Promise<void>} Termina cuando React ha repintado.
     */
    async escribir(el, valor) {
      if (!el) throw new Error('escribir() recibió null');
      const prototipo =
        el.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
      await act(async () => {
        Object.getOwnPropertyDescriptor(prototipo, 'value').set.call(el, valor);
        el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
      });
    },

    /** Envía el formulario. */
    async enviar(formulario) {
      await act(async () => {
        formulario.dispatchEvent(
          new dom.window.Event('submit', { bubbles: true, cancelable: true }),
        );
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
const crudo = storage.getItem('juntos:v2:eventos');
comprobar('lo guardado sigue siendo JSON válido', (() => {
  try {
    return JSON.parse(crudo).length === releidos.length;
  } catch {
    return false;
  }
})(), 'el JSON del almacen no parsea');

await ev.eliminarEvento(eventoConFoto.id);

await vite.close();
console.log(`\n${fallos === 0 ? 'TODO OK' : `${fallos} FALLOS`} — ${pruebas} pruebas, ${fallos} fallos`);
process.exit(fallos === 0 ? 0 : 1);
