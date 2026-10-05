# Juntos — Calendario de recuerdos + planeador de citas

"Juntos" es una aplicación web responsive para parejas: combina un calendario de recuerdos con un planeador de citas. Esta fase 1 es un prototipo **solo frontend**, con datos simulados persistidos en `localStorage`.

## Estado actual (Pasos a, b, c, d, e, f y g)
- [x] Setup Vite + React (JS)
- [x] Tailwind CSS v3.4.17 fijado (decisión para mantener `tailwind.config.js`)
- [x] React Router + rutas (Inicio, Calendario, EventoDetalle, Planeador, Momentos, Galería, Configuración y Bienvenida fuera del layout)
- [x] Layout responsive (sidebar fija en escritorio / header + barra inferior en móvil)
- [x] Tokens de diseño del mockup (#070B10, #0D121A, #6C2B43, #F7FAFC, #D1536C, #C62E53, #F1F0FC y colores de categoría)
- [x] Componentes UI base: Logo, Boton, Chip, Modal, PagePlaceholder
- [x] Tipografía: Dancing Script + Inter (Google Fonts)
- [x] **Services** (`storage.js`, `eventosService.js`, `citasService.js`) con validación, claves versionadas y manejo de cuota
- [x] **Seed** con 8 eventos y 5 ideas, con fechas relativas al mes actual
- [x] **Hooks** `useEventos` y `useCitas` con `cargando`, `error` y mutaciones que actualizan el estado local
- [x] Inicio y Calendario conectados a datos reales
- [x] **Calendario mensual**: cuadrícula propia con `weekStartsOn: 1`, mes en la URL (`?mes=2026-10`), botón "Hoy", día seleccionado, "+N más", versión móvil con puntos de color y accesibilidad por teclado y lector de pantalla
- [x] **Catálogo de categorías como fuente única**: slugs sin acentos ni espacios, derivados, con predicados y fallo en la importación si una clave no es válida
- [x] **Fotos**: selector accesible, validación en dos fases (MIME/tamaño y magic bytes), y recompresión a 1200 px WebP ~0.8 que elimina EXIF y GPS
- [x] **Formulario de evento** único para alta y edición, con validación por campo, foco en el primer error y aviso al cerrar con cambios sin guardar
- [x] **Detalle del evento** con edición, borrado confirmado, vuelta a `?mes=` y enlace a la galería
- [x] **Planeador de citas** (paso e): alta, edición y borrado de ideas propias, favoritas con actualización optimista, conversión a evento y filtros por categoría y favoritas en la URL
- [x] **Origen de las ideas**: `IdeaCita.origen` distingue las del seed de las de la pareja, y solo estas se pueden editar o borrar
- [x] **Galería** (paso f): mosaico responsive agrupado por mes, derivado de los eventos, con filtro de año en la URL y enlace a cada recuerdo
- [x] **Vistas Semana y Día** (paso g): conmutador con la vista en la URL (`?vista=semana|dia&fecha=YYYY-MM-DD`), navegación con flechas y "Hoy", y panel lateral que sigue al día resaltado
- [x] **Configuración** (paso g): recuentos, espacio ocupado, claves con su versión, "Cerrar sesión" y "Restablecer datos" con sus confirmaciones. Restablecer conserva la sesión; cerrarla borra solo la sesión
- [x] **Sesión simulada** (paso g): `juntos:v1:sesion`, guardas de ruta en los dos sentidos y "Comenzar" como única entrada. No es autenticación
- [x] **Reloj inyectable** (`src/utils/reloj.js`) y suites con fecha simulada para octubre, febrero y diciembre
- [x] **Auditoría de idioma** (`npm run auditar-idioma`), que busca palabras inglesas en la prosa del proyecto
- [x] **Auditoría de cabeceras y documentación** (`npm run auditar-docs`), que exige cabecera en cada fichero y JSDoc en cada exportación
- [ ] Pulido final y paso h

## Requisitos
- Node.js 20+ (probado con v24.15.0)
- npm 11+ (probado con 11.12.1)

## Instalación
```bash
npm install
```

## Desarrollo
```bash
npm run dev
```
La app abre por defecto en `http://localhost:5173`. En móvil, usa tu IP local para probar el layout responsive.

## Construcción
```bash
npm run build
npm run preview
```

## Arquitectura (resumen)
La capa de datos está separada de la UI: `src/services/*` encapsulan toda la lectura/escritura (hoy `localStorage`), `src/hooks/*` exponen estado derivado, `src/data/seed.js` inicializa los datos la primera vez. Las páginas **nunca** acceden a `localStorage` directamente.

```
Página/Componente  →  Hook  →  Service  →  localStorage
                     ↑        ↑
                     └-- no cambia al migrar a Supabase
```

- **Claves versionadas:** `juntos:v3:eventos` y `juntos:v3:citas`. Si el modelo cambia, se sube `VERSION_DATOS` y la app deja de leer las claves antiguas sin código de migración.
- **Dos versiones, no una:** la sesión lleva la suya (`VERSION_SESION`), separada de la de los datos. Si compartieran número, un cambio de esquema cerraría la sesión de todo el mundo.
- **Categorías en un solo archivo:** `src/utils/categorias.js` es la única fuente. La clave es un slug sin acentos ni espacios porque va al almacén y a la URL; la etiqueta visible sí los lleva. Ningún otro archivo escribe un slug.
- **Fechas del seed relativas al mes actual:** con las fechas literales del mockup (septiembre 2025) el calendario del mes actual saldría vacío.
- **Validación en dos capas:** el formulario da el feedback, el service rechaza. En Fase 2 la base de datos replicará las mismas reglas.
- **Fotos en dos fases:** primero el tipo y el tamaño que declara el navegador, y después los magic bytes reales. Sin la segunda fase, un SVG renombrado a `.jpg` pasaba el filtro. La recompresión con canvas es también lo que elimina EXIF y GPS.
- **IDs con `crypto.randomUUID()`:** UUID v4, compatible con las claves de Supabase e imposible de adivinar.
- **Un solo reloj:** `src/utils/reloj.js` es lo único que responde a "¿qué día es hoy?". El seed, las comparaciones de fechas y la frase del día leen de ahí, así que la suite puede fijar la fecha sin cambiar la firma de ninguna función de producción.
- **Restablecer datos no cierra la sesión:** `resetDatos()` borra las claves de datos y conserva `juntos:v1:sesion`. La sesión es el único dato que la app no puede recrear, y en esta fase no hay forma de recuperarla.
- **Las ideas del seed no se editan ni se borran:** `IdeaCita.origen` dice de dónde viene cada una, y solo las de la pareja tienen botones de editar y borrar. Sin ese campo habría que reconocerlas por sus ids o por su contenido, que se rompe en cuanto cambia el seed.
- **La cuadrícula se calcula fuera de React**, en funciones puras de `src/utils/calendario.js`, para poder testearla sin montar componentes.
- **La galería es una vista, no una tabla:** sus fotos son `Evento.foto`, derivadas en `src/utils/galeria.js`. No hay clave de almacenamiento ni service nuevos, y no existe el estado en el que una foto y su recuerdo se desincronicen. Si en Supabase las fotos pasan a ser una tabla aparte, esto deja de ser derivable.
- **Ninguna fecha se construye con `new Date('YYYY-MM-DD')`:** esa cadena es UTC, y en Bogotá (UTC-5) el 1 de octubre sería el 30 de septiembre a las 19:00. Todo pasa por `parseISO` o por números sueltos.

Ver `docs/ARQUITECTURA.md` para el detalle completo.

## Documentación
- [Arquitectura](docs/ARQUITECTURA.md)
- [Modelo de datos](docs/MODELO_DE_DATOS.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Componentes](docs/COMPONENTES.md)
- [Migración a Supabase](docs/MIGRACION_SUPABASE.md)
- [Changelog](docs/CHANGELOG.md)

## Pruebas

```bash
npm test
```

Hay un único script, `test-datos.mjs`, en dos fases. La primera trabaja contra un
`localStorage` simulado (cuota inyectable, JSON corrupto, almacén caído) y monta
los componentes a HTML para revisar su estructura. La segunda levanta un **jsdom**
real, porque el modal se monta con `createPortal` y `renderToStaticMarkup` no
llegaría ni a ejecutarlo: sin DOM no hay foco, ni `keydown`, ni eventos.

Cubre siembra, CRUD, validación, XSS, ids manipulados, cuota agotada, fechas,
conversión de ideas en eventos, integridad de las categorías, la cuadrícula del
calendario (incluidos febrero de 2027 con 4 filas y agosto de 2026 con 6), y la
interacción real del modal y del formulario: foco atrapado con Tab y Mayús+Tab,
foco devuelto al cerrarlo, Escape, doble envío bloqueado, aviso de cambios sin
guardar, borrado confirmado y su navegación. La galería se comprueba con su
mosaico, su filtro de año, sus cuatro estados, el degradado de reserva cuando
una foto remota no carga y el reparto de `?evento=` sobre `?anio=`. Las tres
vistas del calendario se montan con DOM real y se comprueban por pulsación: el
conmutador escribe en la URL, las flechas mueven el período de cada vista, "Hoy"
vuelve al día en curso, una URL manipulada cae en algo válido, el cambio de mes y
de año no rompe títulos ni índices de día, y la configuración pregunta antes de
borrar con un único diálogo y no borra nada si se cancela.
La sesión se prueba de punta a punta: sin ella ninguna ruta de dentro del layout
enseña nada y `/bienvenida` es la pantalla a la que se llega; con ella la
bienvenida ya no aparece; una clave corrupta, un array o un `id` que no sea un
UUID cuentan como "no hay sesión"; "Comenzar" guarda la sesión y entra en Inicio;
y cerrar sesión borra solo esa clave, deja los datos donde estaban y pregunta
antes con un único diálogo.
**1095 comprobaciones.**

Dos de ellas son los flujos completos, montados con la app entera y no pantalla
por pantalla: el de un recuerdo con foto (bienvenida, "Comenzar", calendario,
"Agregar evento", elegir foto, verlo en el calendario, en la galería y en su
detalle, editarlo y borrarlo) y el de una idea del planeador convertida en
evento. Lo que cada pantalla guarda por su lado ya estaba comprobado; lo que no
estaba es que los dos extremos se hablaran.

Lo que la suite no alcanza está en
[`docs/VERIFICACION_MANUAL.md`](docs/VERIFICACION_MANUAL.md): fidelidad con el
mockup, ancho de la rejilla de la semana, scroll horizontal, EXIF y GPS, `dvh`
con el teclado abierto, y contraste. Las casillas están vacías a propósito.

La suite acepta una fecha para correr como si fuera otro día:

```bash
node test-datos.mjs 2027-02-28
npm run test:octubre    # 2 de octubre de 2026
npm run test:febrero    # 28 de febrero de 2027
npm run test:diciembre  # 31 de diciembre de 2026
```

Las tres fechas están elegidas a propósito: octubre es el mes del seed, febrero
tiene cuatro semanas y diciembre cae en un mes de 31 días que hace saltar la
cuadrícula. Con fechas literales en las pruebas, en febrero y diciembre no
habría eventos que encontrar y la suite pasaría por falta de datos en vez de por
funcionamiento.

La semana que cruza el año tiene comprobaciones propias: `?vista=semana&fecha=2026-12-31`
y `?vista=semana&fecha=2027-01-01` tienen que dar la misma semana, del 28 de
diciembre al 3 de enero, cambiando solo la columna resaltada. En octubre cualquier
fecha cae dentro de la semana en curso y ese fallo no se vería.

Y para lo que no se puede automatizar desde aquí: **no hay smoke test en
navegador**. La cobertura llega al DOM real con jsdom, pero no al ancho de la
ventana, ni al desplazamiento real, ni a la composición de fuentes. Sigue
pendiente.

## Auditoría de codificación

```bash
npm run auditar-codificacion
```

Escanea `src/`, `docs/`, `scripts/`, la raíz y los tests, y falla con código 1 si
encuentra caracteres fuera del alfabeto latino y de los signos del español
(bloques CJK, cirílico, árabe, hebreo y demás), el carácter de reemplazo
`U+FFFD`, mojibake del tipo UTF-8 leído como latin-1, un BOM, bytes nulos,
saltos de línea mezclados o un fichero sin salto final.

Existe porque **el linter no puede ver este fallo**. Un fichero puede compilar,
pasar los 1095 tests y llevar tres palabras en chino en medio de una frase en
español: no hay error de sintaxis que lo delate. Ha pasado siete veces en este
proyecto. Los símbolos que sí se usan a propósito (flechas, `§`, `°`, `❤`) están
en la lista de permitidos del script, cada uno con su motivo, para que ampliar la
excepción sea una decisión visible y no un descuido.

El escaneo recorre carácter a carácter en lugar de usar una expresión regular
porque los rangos se declaran como números: escritos en un literal quedarían
partidos en varias líneas y un rango mal escrito no se vería hasta que falla.

Conviene ejecutarlo antes de cerrar cada paso, junto a `npm test`,
`npm run lint` y `npm run build`.

## Auditoría de idioma

```bash
npm run auditar-idioma                  # docs/, README.md, src/ y scripts/
npm run auditar-idioma -- --mensajes    # los mensajes de commit, con git log
```

Busca palabras inglesas dentro de frases en español y sale con código 1 si
encuentra alguna. La lista son 168 palabras funcionales (`the`, `and`, `with`,
`which`, `is`, `not`…), agrupadas por lo que son y con el motivo de cada grupo.

Existe por la misma razón que la otra auditoría y por un motivo peor: **una
palabra en otro idioma es latina, así que la auditoría de codificación no la ve**,
y tampoco el linter. En este proyecto han salido media docena ("La manages",
"affirmed", "yuir", "puntokeyboard"), y cada vez que se corregía una aparecía otra
en el fichero siguiente. Una revisión a mano depende de que alguien la haga; esto
no.

Qué ignora, y por qué:

- **En Markdown**, las vallas de código, el código en línea, las etiquetas HTML y
  el destino de los enlaces. El destino se quita porque es una URL, y `date-fns` no
  es una palabra inglesa escrita en una frase.
- **En JavaScript**, todo menos los comentarios. Los identificadores vienen del
  inglés por acuerdo (`useState`, `localStorage`) y revisarlos sería rechazarlos.
- **Dentro de los comentarios**, las líneas que son código (empiezan por palabra
  clave, llevan `=>`, terminan en `;` o tienen llaves), los tipos entre llaves
  (`{Promise<any>}`) y las etiquetas de JSDoc.
- **Las tildes**, antes de comparar: sin eso, el patrón de letras parte una palabra
  acentuada en dos y el escaneo ve una palabra inglesa donde no la hay. Pasaba con
  cualquier palabra terminada en «-ían».

Hay una lista corta de excepciones, cada una con su motivo escrito: `check` (la
restricción de PostgreSQL), `hook` (préstamo del proyecto) y `build` (la tarea de
construcción). Ampliarla es una decisión visible, no un descuido.

Dos palabras que están fuera a propósito, y conviene saber por qué: **`use` no se
vigila**, porque "quien use" es el subjuntivo de "usar" (el primer escaneo avisó
seis veces y las seis eran eso), y **`a` no se vigila**, porque es la preposición
española. Un auditor de idioma que se apaga por dar seis falsos positivos no vuelve
a mirarse.

## Auditoría de cabeceras y documentación

```bash
npm run auditar-docs
```

Avisa de un fichero sin cabecera y de una exportación sin JSDoc, y enseña un
resumen "X de Y" por tipo:

```
Ficheros revisados: 59

archivo      59 de 59
componente   65 de 65
hook          5 de 5
funcion     114 de 114
constante    20 de 20
```

Lo que exige es lo que el proyecto ya hacía a mano: cada fichero empieza con un
bloque de cabecera que declara su `RESPONSABILIDAD` y su `@module`, y cada
función, hook, componente y constante exportada lleva JSDoc encima. Sale con
código 1 si algo falla, y el resumen se imprime igual, porque un recuento que
solo aparece cuando todo está bien no sirve para ver quién añadió el último
fichero sin documentar.

La clasificación es por nombre, como manda React: lo que empieza por `use` y
mayúscula es un hook, lo que empieza por mayúscula y contiene una flecha o una
llamada es un componente, y el resto son funciones y constantes. Está separado
por tipo porque cada tipo falla distinto: un hook sin JSDoc es el peor caso,
porque su firma no dice cuándo se llama ni qué devuelve.

## Notas importantes
- **Sesión simulada, no autenticación:** "Comenzar" escribe `juntos:v1:sesion` y las guardas de `App.jsx` la comprueban para decidir si se ve la bienvenida o la app. La clave se puede escribir a mano desde la consola del navegador, así que no protege datos ni separa parejas: solo evita repetir el primer pantallazo. Marcado con `SEGURIDAD:` y `TODO-FASE2 (SEGURIDAD)` en el código, en `docs/SEGURIDAD.md` y en la propia pantalla de Configuración.
- **localStorage no es seguro:** se documenta explícitamente en `docs/SEGURIDAD.md`. En Fase 2 pasará al backend (Supabase) con autorización por pareja (RLS).
- **Colores de categoría:** se aplican con `style={{ backgroundColor }}` (hex desde `src/utils/categorias.js`). Esto evita el problema de clases dinámicas que Tailwind purga en tiempo de compilación. El texto de las cinco categorías pasa contraste AA sobre su fondo; los colores principales sobre `#F7FAFC` no llegan a 3:1 en `viaje`, `cumpleanos` y `otro`, así que el significado no debe depender solo del color.
- **Calendario:** se construye a mano con `date-fns` (locale `es`), ignorando la pequeña duplicación visible en el mockup.
- **Fotos:** las del seed son SVG de `public/img/`, uno por semilla, 500 bytes cada uno: son datos de ejemplo a propósito y no salen de casa. Las que sube la persona se recomprimen en el cliente antes de guardarse como `base64`, y ese canvas es lo que elimina los metadatos EXIF/GPS. En Fase 2 van a un bucket privado de Supabase Storage. El degradado de reserva se mantiene en las dos fases: con una URL firmada caducada el fallo de carga es el mismo que con una imagen bloqueada, y con un marcador que no llegara a cargar, igual.
- **Rutas locales en los datos:** `PATRONES.RUTA_LOCAL_IMAGEN` solo admite `/img/` seguido de un nombre y una extensión de imagen. Entra en la lista blanca de `foto` e `imagen` junto a las URL http(s) y las `data:` de base64. La estrechez es a propósito: `//sitio.com/foto.svg`, `..`, `javascript:`, `data:text/html` y `/api/...` quedan fuera, y hay una prueba para cada caso.
- **Sin smoke test en navegador todavía:** las pruebas cubren el DOM y la lógica, pero falta la comprobación visual en escritorio y móvil. La persona usuaria no puede ejecutar la app, así que sigue pendiente.

## Licencia
Proyecto educativo para desarrollo del prototipo "Juntos".
