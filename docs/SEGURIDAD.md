# SEGURIDAD — Juntos (Fase 1)

Qué se ha aplicado en esta fase, qué queda fuera y qué hay que reforçar en Fase 2.

> **Idea central:** en Fase 1 el cliente no es una frontera de seguridad. Todo lo que hay aquí sirve para dar buena experiencia de usuario y para no dejar trampas en el código. La seguridad real la pone el backend.

---

## Medidas aplicadas en Fase 1

### 1. XSS: React escapa por defecto

No usamos `dangerouslySetInnerHTML` en ningún punto de la aplicación. Cuando React renderiza `{evento.titulo}`, escapa `<`, `>`, `&`, `"` y `'`, así que un título con `<script>alert(1)</script>` se guarda literal pero **se muestra como texto** y no se ejecuta.

Comprobado en `test-datos.mjs`: un evento con `<script>` en el título se acepta, se guarda literal y se renderiza escapado.

**Por qué no hace falta un sanitizer en Fase 1:** no hay `innerHTML` en ninguna parte. Un sanitizador (DOMPurify) solo hace falta si se introduce `dangerouslySetInnerHTML` o contenido de terceros con HTML real (un `.md` de una descripción, por ejemplo). TODO-FASE2: si algún día se acepta Markdown, sanitizar en servidor además de en cliente.

### 2. Validación y sanitización de entradas

Reglas en `src/utils/validaciones.js`, aplicadas en **dos capas** (formulario para el feedback, service para no confiar en el llamador):

| Campo | Reglas |
|---|---|
| `titulo` | Obligatorio, 3–120 caracteres |
| `fecha` | Obligatoria, `YYYY-MM-DD` estricto, y el día debe existir en el mes (`2026-02-31` se rechaza) |
| `hora` | Opcional, `HH:mm` 24 h |
| `descripcion` | Opcional, máximo 500 |
| `lugar` | Opcional, máximo 160 |
| `categoria` | Lista blanca (`Object.hasOwn` sobre el catálogo) |
| `foto` / `imagen` | URL `http(s)` o data URL de imagen permitida |

`limpiarTexto()` elimina caracteres de control ASCII (respetando `\n` y `\t`, válidos en una descripción) y recorta los extremos.

### 3. Validación de archivos de imagen

La validación va en **dos fases**, y la segunda es la que de verdad decide.

**Fase 1 — lo que declara el navegador** (`validarArchivoFoto`), rápida y sin
leer el archivo:
- **Lista blanca de MIME**: solo `image/jpeg`, `image/png`, `image/webp`. Se rechaza SVG y HTML (pueden llevar JavaScript incrustado o ejecutar scripts al servirse).
- **Tamaño máximo 5 MB**, para no agotar la cuota antes de comprimir.
- **Coherencia MIME/extensión**, que filtra el error más común (un `.jpg` renombrado).

**Fase 2 — los bytes reales** (`validarBytesDeArchivo`), leyendo solo el
principio del archivo y comparando con las firmas de cada formato. Sin esto, un
SVG o un HTML renombrado a `.jpg` con `type: 'image/jpeg'` pasaba la fase 1.

```
JPEG  FF D8 FF
PNG   89 50 4E 47 0D 0A 1A 0A
WebP  RIFF....WEBP
```

**Recompresión obligatoria antes de guardar.** La foto se reescala a 1200 px del
lado mayor y se vuelve a exportar con `canvas.toDataURL()`. El canvas no copia
los metadatos del original, así que esa recompresión es lo que elimina **EXIF y
GPS**: la foto de un móvil no lleva ni el modelo del teléfono ni la ubicación
donde se tomó. La orientación EXIF sí se respeta, porque sin `imageOrientation:
'from-image'` una foto vertical se vería girada.

El relleno de blanco del fondo ocurre **solo al exportar a JPEG**, justo antes de
esa exportación. JPEG no tiene canal alfa, así que las zonas transparentes de un
PNG se volverían negras; WebP sí las admite, y rellenando antes de dibujar se
perdía la transparencia en el formato que ni siquiera necesita relleno.

Ojo: la firma no descodifica la imagen. Un archivo con la cabecera correcta y el
resto corrupto la supera; detrás de esto está `createImageBitmap()`, que sí falla
al abrirla. La verificación real de contenido sigue siendo tarea del servidor.

### 4. El contenido de un evento nunca se interpreta como HTML

React escapa todo lo que se renderiza, y en la app no se usa
`dangerouslySetInnerHTML` en ningún punto. Además, `limpiarTexto()` **solo
acepta cadenas**: con un `String(valor)` genérico, un objeto o un número
acabarían guardados como texto (`"[object Object]"`). Un valor que no sea texto se
trata como campo vacío, que es justo lo que acaba haciendo la validación de
obligatoriedad más abajo.

### 5. Identificadores no predecibles

Los ids se generan con `crypto.randomUUID()` (UUID v4, 122 bits de entropía) en lugar de un contador incremental. Con un contador, quien supiera cuántos eventos hay podría probar `id + 1` y leer los ajenos. Además el formato coincide con el de las claves primarias de Supabase, así que no habrá que migrar ids.

### 6. Validación del `:id` de la ruta

`getEventoById()`, `actualizarEvento()`, `eliminarEvento()`, `toggleFavorita()` y compañía validan el formato con `esIdValido()` **antes** de tocar los datos. Un id manipulado (comillas, guiones SQL, `__proto__`) devuelve `null` o lanza `ErrorServicio` sin llegar a la capa de búsqueda.

En `EventoDetalle`, un id mal formado y un id que no existe dan **la misma
pantalla** de "no encontramos ese evento", y en ninguno de los dos casos se
imprime el id. No se confirma nada, ni se da una pista de qué parte de la URL
falló.

Comprobado: `getEventoById("' OR 1=1--")` → `null`, y la página no filtra el id.

**Esto NO sustituye a la autorización** (ver pendientes).

### 7. El catálogo de categorías no acepta nombres heredados

Las claves de los objetos de `categorias.js` son slugs, y `esCategoriaValida()`
comprueba **pertenencia propia** con `Object.hasOwn`, no con `in`. Con `in`,
`"toString"` daría `true` y una categoría guardada a mano con ese nombre
colaría en el store.

`obtenerCategoria()` usa la misma comprobación para el fallback. El catálogo es
un objeto literal y hereda de `Object.prototype`, así que un acceso directo
`CATEGORIAS_EVENTO["toString"]` devolvería la **función heredada** en lugar de la
categoría de reserva, y `??` no la detectaría porque una función no es `null`.

### 8. Lectura tolerante a fallos de `localStorage`

`localStorage` puede contener JSON corrupto (edición manual desde DevTools, escritura interrumpida, datos de una versión anterior). Un `JSON.parse` sin proteger lanzaría y dejaría la app en blanco.

`storage.leer()` envuelve todo en `try/catch`, registra el error en consola y devuelve `null`, lo que hace que el service vuelva al seed. La app sigue funcionando.

Un fallo de **escritura**, en cambio, sí propaga, y si es de cuota llega intacto
como `ErrorCuotaAlmacenamiento` en lugar de envuelto en `ErrorServicio`: "no
hay espacio" es accionable, "no pudimos cargar" no dice nada sobre qué hacer.

`tamanoAproximado()` envuelve cada `getItem` por separado. Se llama al abrir
Configuración y solo produce una estimación cosmética; que el almacén se caiga a
mitad de la cuenta no puede dejar la pantalla en blanco.

Comprobado: JSON inválido y un objeto que no es array → la app vuelve al seed sin romperse.

### 9. Cuota de almacenamiento

Se detectan las tres variantes del error del navegador (`QuotaExceededError` en Chrome/Safari, `NS_ERROR_DOM_QUOTA_REACHED` en Firefox, `code` 22/1014) y se traduce a `ErrorCuotaAlmacenamiento` con un mensaje accionable. Ese error no se reescribe en los services, porque "no hay espacio, borra alguna foto" es útil y "no pudimos guardar" no lo es.

### 10. No se exponen detalles internos

`ErrorServicio` envuelve los fallos con un mensaje en español apto para mostrar. La causa original se conserva en `error.causa` y el detalle va a `console.error` para depurar, pero nunca al mensaje que ve la persona usuaria: eso filtraría nombres de claves, rutas del sistema y la pila de llamadas.

### 11. `try/catch` en toda la capa de datos

Todos los services capturan sus excepciones. `storage.js` nunca deja escapar un error de cuota sin traducir; los services nunca dejan escapar un `JSON.parse` fallido.

### 12. Claves de `localStorage` con espacio de nombres

Prefijo `juntos:` en todas las claves. `resetDatos()` y `limpiarVersionesAnteriores()` enumeran y borran **solo** las claves con ese prefijo, nunca `localStorage.clear()`, para no destruir datos de otras apps del mismo origen.

### 13. El parámetro `?mes=` se valida antes de construir una fecha

El mes visible llega desde la barra de direcciones, o sea, desde fuera de la app. `mesDesdeParametro()` no se lo pasa tal cual al `Date`: exige que case con `AAAA-MM`, rechaza el mes `0` y el `13`, acota el año y, si algo no cuadra, cae al mes actual. Nunca se usa `new Date(texto)`, que además de interpretar la fecha como UTC devolvería un `Invalid Date` sin avisar.

### 14. Ninguna fecha se construye con `new Date('YYYY-MM-DD')`

Esa cadena se interpreta como **UTC**. En Bogotá (UTC-5) el 1 de octubre a las 00:00 UTC es el 30 de septiembre a las 19:00 locales, así que un evento caería un día antes del que es. Todo pasa por `parseISO` o por números sueltos.

### 15. La cuadrícula no se construye en el render

`construirCuadricula()` es una función pura sin efectos: no lee el reloj, no toca el DOM y no muta lo que recibe. Recibe `fechaHoy` como parámetro en lugar de llamar a `new Date()` dentro, lo que además la hace testeable con una fecha fija. El resultado va en un `useMemo` para no recorrer 42 fechas en cada render.

### 16. Accesibilidad de la cuadrícula

Cada día es un `button` con `aria-label` (`"14 de octubre, 3 eventos"`), `aria-pressed` cuando está seleccionado y anillo de foco visible. La rejilla declara `role="grid"` y `role="row"` por semana, y los nombres de los días llevan `aria-hidden` para que un lector de pantalla no lea "lunes" y después "lunes 1 de septiembre”" por cada una de las 35 celdas.

**El "+N más" no va dentro del `button` del día.** No se puede anidar un `button` dentro de otro `button`: es HTML inválido, el interno no es alcanzable con el teclado y el lector de pantalla lo anuncia mal. Va como hermano, superpuesto con posicionamiento, lo que además permite darle su propio `aria-label` con el detalle completo.

---

## Limitaciones conocidas de Fase 1

### `localStorage` no es un almacén seguro

- No cifra nada. Cualquiera con acceso al navegador puede leer los datos desde la consola.
- No hay control de acceso: los datos son los mismos para cualquiera que abra la app en ese dispositivo.
- Los datos persisten en disco y sobreviven a cerrar el navegador.
- Es accesible desde el contexto de la página: un XSS sería capaz de leer todo.
- La cuota (~5 MB) es el único límite real.

Para datos de ejemplo está bien. Para recuerdos reales de una pareja **no**.

### El login es simulado

`/bienvenida` tiene un botón "Comenzar" que navega a `/`. No hay autenticación, no hay sesión, no hay token, no hay contraseña. Cualquiera que abra la app entra.

`PERFIL_PAREJA` ("Tú y Yo", "12 abr 2024") es una constante en `src/constants/nav.js`, editable por cualquiera desde el código.

### Los datos no están autorizados por pareja

Hoy hay un único conjunto de eventos para "la pareja". En Fase 2, cuando dos personas distintas usen la cuenta, alguien podría leer o modificar datos de la otra. Hoy no es un problema (no hay dos usuarios); en Fase 2 sí lo es, y se resuelve con RLS en Supabase.

### Las fotos viajan a un tercero

Las del seed son URLs de `picsum.photos`. Al cargar la app, ese servidor ve la IP de quien la visita. Con fotos reales en Fase 2 deben ir a un bucket de Supabase Storage, no a un CDN externo.

### El foco se queda dentro del modal

Un modal que no atrapa el foco no es un problema de estética: quien navega con
teclado o con lector de pantalla sigue creyendo que está en la página, porque el
foco se va al fondo sin ningún aviso.

`Modal.jsx` cubre cuatro casos, y los cuatro importan:

- **Anuncio**: el panel se nombra con `aria-labelledby` apuntando al `h2` real,
  no con `aria-label`. Con `aria-label`, el lector anuncia el texto del atributo
  y el encabezado se lee como contenido suelto.
- **Foco atrapado**: Tab y Mayús+Tab circulan dentro del panel, con la lista de
  elementos recalculada en cada pulsación, porque el contenido cambia.
- **Foco devuelto** al elemento que abrió el modal, si sigue en el documento.
  Si el elemento ya no existe (una fila que se ha borrado al guardar), el foco
  no se queda en un nodo huérfano.
- **Bloqueo del scroll** del fondo, con contador global para que dos modales
  apilados no lo desbloqueen antes de tiempo.

Dos detalles de implementación que no parecen obvios y sí importan:

- El disparador y el foco inicial se resuelven en un `useLayoutEffect`, no en un
  `useEffect`. React ejecuta los efectos de abajo arriba, así que un efecto
  normal del modal se aplicaría **después** de que el formulario enfocara su
  primer campo: se guardaría el input del formulario en vez del botón que abrió
  el modal, y al cerrar el foco caería en `body`.
- El modal no le quita el foco al contenido si este ya ha enfocado algo dentro.
  Enfocar el panel a la fuerza hacía que el primer campo del formulario no
  recibiera nunca el foco.

### No perder lo escrito por preguntar si se quiere perder

Cerrar un formulario con cambios abre un aviso. Ese aviso existe para proteger
el trabajo escrito, así que el contenido **no se desmonta** al preguntar: se
oculta con `hidden` y el aviso va encima. Si se sustituyera por el aviso, quien
cancelara volvería a un formulario recién montado y perdería todo.

Y "¿hay cambios?" se calcula comparando con los valores con los que arrancó, no
con un flag "tocado": escribir y luego borrar deja el formulario como estaba, y
preguntar en ese caso enseña a confirmar sin leer.

---

## Pendientes para Fase 2

| # | Tarea | Dónde | Por qué importa |
|---|---|---|---|
| 1 | **Autenticación real** (correo + OTP, o proveedor) | `pages/Bienvenida.jsx`, `main.jsx` | Hoy el acceso es simulado. |
| 2 | **Sesión verificada en servidor** | Routes de React Router | Un token de cliente no se puede confiar. |
| 3 | **Tabla `parejas` + `pareja_id` en todas las entidades** | Esquema de Supabase | Sin esto no hay separación entre parejas. |
| 4 | **Row Level Security** | Políticas de Supabase | Es la barrera real: el usuario solo ve sus filas, aunque manipule las peticiones. |
| 5 | **Validación server-side** (mismas reglas de `validaciones.js`) | Edge function o trigger | La validación del cliente es solo UX. |
| 6 | **Fotos a Supabase Storage** (bucket privado) | `services/eventosService.js` | Quita el límite de 5 MB y la exposición a terceros. |
| 7 | **Verificación real del tipo de imagen** leyendo bytes | Edge function | Los headers MIME los controla quien sube el archivo. |
| 8 | **Autorización por recurso** | `getEventoById` y compañía | Devolver `null` (no un 403) si el evento es de otra pareja: un 403 confirmaría que existe. |
| 9 | **Sanitización en servidor** | Edge function | Última línea si algún día se acepta HTML/Markdown. |
| 10 | **Rate limiting** | Edge function / Supabase | Evita abuso de escritura. |
| 11 | **Cifrado en reposo y backups** | Supabase | Los recuerdos son datos personales de una pareja. |
| 12 | **Exportar / borrar datos (derecho al olvido)** | `Configuracion.jsx` | La pareja debe poder llevarse o borrar su información. |
| 13 | **Consentimiento y aviso de privacidad** | `Bienvenida.jsx` | Se guardan fotos de personas. |
| 14 | **CSP (Content-Security-Policy)** | Cabeceras de despliegue | Defensa en profundidad ante XSS. |

Cada punto aparece en el código como `TODO-FASE2 (SEGURIDAD):` con referencia a este documento.

---

## Marcas en el código

| Marca | Significado |
|---|---|
| `SEGURIDAD:` | Práctica aplicada y su motivo. |
| `TODO-FASE2 (SEGURIDAD):` | Lo que debe reforzarse o añadirse con backend. |
| `DOCUMENTADO EN:` | Referencia a un archivo de `docs/` para no repetir la explicación. |
