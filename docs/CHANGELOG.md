# CHANGELOG — Juntos (Fase 1)

Todas las novedades de esta fase. Las secciones se rellenan **al terminar cada paso**, junto con el código.

---

## Paso e — Planeador de citas

### Añadido
- **Página `Planeador` real**, antes un marcador de posición. Alta, edición, borrado, favoritas y conversión a evento.
- **`IdeaCita.origen`**: campo nuevo que marca cada idea como `seed` o `usuario` (`ORIGEN` en `src/types/models.js`). Solo las de `usuario` se pueden editar o borrar.
- **`crearIdeasSeed()`** en `src/data/seed.js`: un único `map` que devuelve copias del seed con `ORIGEN.SEED`, en lugar de repetir el literal en cada sitio.
- **`src/utils/planeador.js`**: reglas puras del planeador. `esIdeaEditable`, `normalizarOrigen`, `ideaAValoresEvento`, `ordenarIdeas`, lectura y escritura de los filtros en la URL, y el degradado de reserva de la imagen.
- **`ordenarIdeas()`** compartida por `citasService` y `useCitas`, para que el orden no esté escrito dos veces.
- **Filtros en la URL**: `?categoria=…` y `?favoritas=1`. Se pueden compartir y el botón "atrás" funciona. `useCitas` es controlado por esos parámetros.
- **Favorita con actualización optimista**: la tarjeta cambia al instante y, si el guardado falla, vuelve a como estaba y lo dice con un `role="alert"`.
- **Conversión a evento**: precarga `EventoFormModal` con el título, la descripción, la foto y la categoría `cita`, y **la fecha vacía**. La idea no se borra ni se marca: sigue en el planeador.
- **Componentes nuevos** en `src/components/citas/`: `IdeaFormModal`, `TarjetaIdea`, `FiltrosIdeas`, `ImagenIdea`.
- **`ui/Interruptor.jsx`**: el conmutador de "Solo favoritas", con `role="switch"`.
- **`ui/ConfirmarSalida.jsx`**: el aviso de "¿salir sin guardar?" extraído a un componente, para que lo reutilicen el formulario de evento y el de idea. Enfoca la opción que no pierde nada.
- **`Modal` acepta `rol`**: los `alertdialog` de confirmación (borrar) usan ese rol, que es el que dice que el contenido es urgente. Por defecto sigue siendo `dialog`.
- **`Modal` acepta `descripcionAdicional`**: identificadores extra que se suman al `aria-describedby`, para que el diálogo describa también el párrafo que explica qué va a pasar.
- **`VERSION_SESION` en `storage.js`**, con su propia clave `juntos:v1:sesion`. La sesión no comparte versión con los datos: si compartiera, un cambio de esquema cerraría la sesión de todo el mundo. `limpiarVersionesAnteriores()` nunca la borra. La constante ya existe, aunque la sesión todavía no se escriba: `Bienvenida` sigue sin guardar nada.

### Cambiado
- **`VERSION_DATOS` sube de 2 a 3.** Las claves de las ideas pasan a `juntos:v3:citas` y los eventos a `juntos:v3:eventos`.
- **`citasService`**: `crearIdea()` fuerza `ORIGEN.USUARIO` y `actualizarIdea()` conserva el origen que ya tenía, ignorando el que venga en los datos, para que editar no convierta una idea en seed ni al revés.
- **`EventoFormModal`** admite `valoresIniciales`, con la fecha vacía respetada.
- **`ui/Modal.jsx`** ya no fija `role="dialog"` en el JSX, lo toma de la prop.

### Correcciones
- **La seed se había corrompido en UTF-8** por una edición desde PowerShell y se recuperó desde Git. La revisión de codificación de los 63 ficheros del proyecto no encuentra U+FFFD, BOM, bytes nulos ni mojibake.
- **`IdeaCita.categoria`** tenía `CategoriaIdea` en el `@typedef`, que no existe; ahora es `CategoriaIdeaCita`.
- **La suite se cortaba en silencio** al no encontrar un botón: `pulsar()` lanzaba un `pulsar() recibió null` sin más contexto, y en un archivo de más de dos mil líneas eso perdía las comprobaciones que sí habían pasado. Ahora `pulsar`, `escribir` y `enviar` dicen qué estaban buscando.
- **El arnés no tenía forma de buscar dentro de un modal.** `porTexto()` solo miraba el contenedor del componente, y los modales se montan por `createPortal` sobre `document.body`. Una prueba de un `alertdialog` habría dado `null` siempre, y `null` se habría leído como que el diálogo no existía. Añadido `porTextoGlobal()`.

### Decisión: qué pasa con las ideas al subir a v3
Las ideas ya guardadas en v2 **no tienen `origen`** y no se pueden distinguir de las de la pareja. Rellenarlas como `usuario` sería inventarse un dato, y como `seed` dejaría ideas propias sin poder editar. La app prefiere perder esas ideas de prueba y volver a sembrar, de forma que lo que queda sí dice la verdad. Es un coste aceptable en un prototipo de datos de ejemplo; en Fase 2 no aplica, porque allí cada idea es una fila y no hay seed mezclado. Ver `docs/MIGRACION_SUPABASE.md`.

### Verificación
- `npm test`: 644 comprobaciones, 0 fallos, estable en 3 pasadas seguidas.
- `npm run lint`: 0 avisos y 0 errores.
- `npm run build`: correcto.
- Codificación revisada en los 63 ficheros del proyecto, incluidos los `.md` tocados.
- **Las expectativas se comprobaron contra el código, no contra sí mismas:** se invirtió a propósito el conteo de una comprobación de borrado y la suite la detectó (`1 FALLOS`) en lugar de darla por buena. Después se restauró.
- **`Modal` se comprueba aparte del planeador:** que el rol por defecto siga siendo `dialog`, que `aria-describedby` no aparezca sin descripción, y que los identificadores repetidos o vacíos de `descripcionAdicional` se limpien.
- Pendiente de comprobación manual, por necesitar un dispositivo real: orientación EXIF con una foto vertical, stripping de GPS, el botón "Guardar" con el teclado abierto a ~375 px, y contraste y fidelidad visual.

---

## Paso a — Setup + layout + navegación responsive

### Añadido
- **Scaffold** con Vite (`react` template, JavaScript).
- Dependencias: `react-router-dom`, `date-fns`, `lucide-react`; dev: `tailwindcss@3.4.17` (fijado a v3.4 a propósito), `postcss`, `autoprefixer`.
- **Configuración de diseño** en `tailwind.config.js` con los tokens del mockup:
  - `base #070B10`, `sidebar #0D121A`, `navactive #6C2B43`, `surface #F7FAFC`
  - `accent #D1536C` (base) / `accent-strong #C62E53` (hover/activo) / `accent-soft #F9E7EB`
  - `chip-cita #F1F0FC`
  - Fuentes: `script` (Dancing Script), `sans` (Inter). Sombras `card`/`pop`, radios `card`/`pill`.
- **Decisión de diseño (importante):** los colores de categoría **no** están en Tailwind. Viven en `src/utils/categorias.js` como hex y se aplican con `style={{ backgroundColor }}` para evitar el problema de clases dinámicas purgadas en compilación.
- `index.html`: `lang="es"`, `viewport-fit=cover`, Google Fonts (Dancing Script + Inter), `<title>` y `<meta description>`.
- `src/index.css`: directivas de Tailwind, variables CSS de respaldo, fondo oscuro en `<body>`, `:focus-visible` con anillo de acento, scrollbar fina, `prefers-reduced-motion`, animación de aparición de página.
- `src/types/models.js`: `@typedef` de `Evento`, `IdeaCita`, `CategoriaEvento`, `CategoriaIdeaCita`, `ResultadoOperacion`.
- `src/utils/categorias.js`: catálogo único de categorías con `label`, `hex`, `bg`, `fg`, `Icon`; funciones `obtenerCategoria`, `obtenerCategoriaIdea`; órdenes de categorías.
- `src/constants/nav.js`: `RUTAS`, `MENU_ESCRITORIO`, `MENU_MOVIL`, `PERFIL_PAREJA`, `MARCA`.
- `src/hooks/useMediaQuery.js`: `useMediaQuery` + `useEsEscritorio` + `BREAKPOINT_ESCRITORIO`.
- **Componentes UI base:**
  - `ui/Logo.jsx` — nombre cursivo + corazón + tagline opcional.
  - `ui/Boton.jsx` — variantes (primario/secundario/fantasma), tamaños, `cargando`, `soloIcono`.
  - `ui/Chip.jsx` — etiqueta/filtro de categoría con color por `style`, estado seleccionado, punto, icono.
  - `ui/Modal.jsx` — diálogo con portal, velo, cierre por Escape/velo/"X", bloqueo de scroll, foco inicial.
  - `ui/PagePlaceholder.jsx` — marcador para páginas aún no implementadas.
- **Layout responsive:**
  - `layout/Sidebar.jsx` — barra fija de escritorio: logo, menú, perfil "Tú y Yo ❤️ — Juntos desde 12 abr 2024" al pie.
  - `layout/MobileHeader.jsx` — cabecera móvil con logo + acceso a Configuración.
  - `layout/BottomNav.jsx` — barra inferior de 5 destinos con safe-area.
  - `layout/Layout.jsx` — armazón; elige sidebar vs. header+bottom nav con `useEsEscritorio`.
- **Páginas placeholder:** `Inicio`, `Calendario`, `EventoDetalle`, `Planeador`, `Momentos`, `Galeria`, `Configuracion`, `Bienvenida`.
- **Rutas en `src/App.jsx`:** `/bienvenida` fuera del layout; resto anidado bajo `<Layout />`; fallback `*` → `/`.
- **Documentación inicial:** `README.md`, `docs/ARQUITECTURA.md`, `docs/CHANGELOG.md`, `docs/COMPONENTES.md`.

### Corregido / Decidido
- **Inicio y Momentos NO comparten ruta.** `/` = Inicio, `/momentos` = Momentos. Con `NavLink`, dos ítems con el mismo `to` se marcan activos a la vez; además no son la misma pantalla en el mockup. `NavLink` de `/` lleva `end` para no activarse en subrutas.
- **Tailwind fijado en v3.4.17** (no v4) para conservar `tailwind.config.js` como fuente de tokens. Migración futura a v4 anotada en `ARQUITECTURA.md` y aquí.
- **Colores de categoría con `style` en línea** en lugar de clases dinámicas o `safelist`.

### Notas / Decisiones
- El login de `/bienvenida` es **simulado** (botón "Comenzar" navega a `/`). Marcado con `SEGURIDAD:` y `TODO-FASE2 (SEGURIDAD)`.
- `localStorage` todavía no se usa en el paso a; entra en el paso b con services y seed.
- No se detectó inconsistencia en el mockup durante este paso; el aviso de la semana duplicada (18) se atenderá en el paso c generando la cuadrícula con `date-fns`.

### Verificación
- `npm run lint` (oxlint): **0 errores, 0 warnings**.
- `npm run build`: correcto (~275 kB JS / 14 kB CSS).
- **Smoke test de renderizado** (script temporal con `react-dom/server` + `StaticRouter`, ya eliminado): las 8 rutas renderizan sin error. `/bienvenida` renderiza el logo y el botón "Comenzar" y **no** incluye la navegación, confirmando que está fuera del `Layout`.
- **Navegación activa verificada** por ruta: en `/` solo `Inicio` queda activo, en `/calendario` solo `Calendario`, en `/planeador` solo `Planeador`, en `/momentos` solo `Momentos`. Confirma que `end` funciona y que `Inicio` y `Momentos` no se activan a la vez.
- **Colores de categoría:** comprobado en el CSS compilado que no existen clases `bg-{categoria}` (Tailwind las habría purgado) y que los hex viajan por estilos en línea.
- `npm run dev` arranca correctamente en `http://localhost:5173`.
- Pendiente de verificación visual por el usuario (`npm run dev` en escritorio y móvil).

### Notas técnicas
- `useMediaQuery` se implementó con **`useSyncExternalStore`** en lugar del patrón habitual `useState` + `useEffect`. `matchMedia` es un store externo del navegador y esa API está diseñada exactamente para eso: evita el render extra y el parpadeo de layout al cambiar de tamaño de pantalla. También se eliminó el `useState`/`useEffect` redundante que quedaba en `Layout`.
- Nota de versión: `react-router-dom` es v7 y exporta `StaticRouter` desde `react-router` (no desde `react-router-dom/server`, que ya no existe).

---

## Paso b — Services + seed + hooks

### Añadido

**Utilidades**

- `src/utils/validaciones.js`: reglas compartidas de validación y sanitización. `LIMITES` (título 120, descripción 500, lugar 160), `PATRONES` (regex de fecha/hora/UUID/URL/data URL), `TIPOS_IMAGEN_PERMITIDOS` (lista blanca: JPEG, PNG, WebP), `TAMANO_MAXIMO_IMAGEN_BYTES` (5 MB), clase `ErrorValidacion` con detalle por campo, y las funciones `limpiarTexto`, `normalizarFecha`, `esFechaValida`, `validarEvento`, `validarIdea`, `esIdValido`, `validarArchivoFoto`.
- `src/utils/fechas.js`: parseo, formateo y comparación con `date-fns` + locale `es`. `aFecha`, `formatearFecha`, `formatearHora`, `hoyISO`, `diaDelMes`, `construirCuadricula`, `esDelMesVisible`, `eventosOrdenados`, `eventosProximos`, `agruparPorFecha`, `etiquetaRelativa`, `esHoy`, `estaPasada`, `diasHasta`, `moverMes`, `estaEnRango`.
- `src/utils/ids.js`: `nuevoId()` con `crypto.randomUUID()` (UUID v4), con respaldo documentado para navegadores sin WebCrypto.

**Capa de persistencia y services**

- `src/services/storage.js`: claves versionadas (`juntos:v1:eventos`, `juntos:v1:citas`), lectura tolerante a JSON corrupto, detección de `QuotaExceededError` en sus tres variantes, `resetDatos()`, `limpiarVersionesAnteriores()`, `listarClaves()`, `tamanoAproximado()`, `storageDisponible()`.
- `src/services/eventosService.js`: `getEventos`, `getEventoById`, `crearEvento`, `actualizarEvento`, `eliminarEvento`, `resetEventos`, más la clase `ErrorServicio`. API asíncrona y validación en la capa de datos.
- `src/services/citasService.js`: `getIdeasCitas`, `getIdeaById`, `crearIdea`, `actualizarIdea`, `toggleFavorita`, `eliminarIdea`, `convertirIdeaEnEvento`, `resetCitas`.

**Datos y hooks**

- `src/data/seed.js`: 8 eventos y 5 ideas del mockup, con `crearEventosSeed()`, `crearIdeasSeed()`, `fotoPlaceholder()`, `fraseDelDia()`, `IDS_SEED`, `IDS_SEED_IDEAS`, `FOTO_BANNER`, `FRASES`.
- `src/hooks/useEventos.js`: estado `{eventos, eventosPorFecha, cargando, guardando, error}` y mutaciones `crear`, `actualizar`, `eliminar`, `obtenerEvento`, `recargar`, `restablecer` que actualizan la lista local sin releer el store.
- `src/hooks/useCitas.js`: además del estado, gestiona el filtro por categoría (`filtro`, `setFiltro`, `ideasFiltradas`, `favoritas`, `opcionesFiltro`).

**UI conectada a datos reales**

- `src/components/eventos/ProximosEventos.jsx`: lista de próximos eventos con franja de color por categoría, etiqueta relativa (Hoy/Mañana/En N días) y enlace al detalle.
- `src/pages/Inicio.jsx`: banner con foto, saludo "Hola, mi amor", frase del día, contador de recuerdos, "El más próximo" con días restantes, accesos rápidos y la lista de próximos eventos.
- `src/pages/Calendario.jsx`: monta los datos reales y el panel de próximos eventos (la cuadrícula llega en el paso c).

**Documentación**

- `docs/MODELO_DE_DATOS.md`: campos, tipos, reglas de validación, formato de fechas, cuota de almacenamiento y el porqué de las fechas relativas del seed.
- `docs/SEGURIDAD.md`: 10 medidas aplicadas, limitaciones conocidas de Fase 1 y 14 pendientes para Fase 2.
- `docs/MIGRACION_SUPABASE.md`: esquema SQL, políticas RLS y tabla de equivalencias función por función.
- Actualizados: `docs/ARQUITECTURA.md`, `docs/COMPONENTES.md`, `docs/CHANGELOG.md`, `README.md`.

### Bugs encontrados y corregidos durante el paso

1. **Los ids del seed no eran UUID.** `esIdValido()` los rechazaba, así que `toggleFavorita`, `actualizarIdea` y `eliminarIdea` devolvían `null` **en silencio** sobre todas las ideas de ejemplo: sin error visible, solo corazones que no cambiaban. Corregido con UUID v4 válidos y documentado el motivo en `IDS_SEED` para que no se repita.
2. **La validación de longitud de la descripción no detectaba el exceso.** `limpiarTexto` recortaba a 500 antes de comparar, así que `length > 500` nunca era cierto y la validación era inerte. Ahora se lee un carácter de más (`LIMITE + 1`) para poder distinguir "cabe" de "se pasó", y se recorta al devolver.
3. **El mensaje de cuota se perdía.** `crearEvento` delegaba en `getEventos()`, que re-lanzaba con "No pudimos cargar tus recuerdos". Ahora `ErrorCuotaAlmacenamiento` se propaga sin envolver en ambas funciones, porque "no hay espacio, borra alguna foto" es accionable y "no pudimos cargar" no lo es.
4. **El mismo hueco de validación existía en `lugar`**, que no estaba acotado. Corregido igual que la descripción.

### Decisiones

- **Fechas del seed relativas al mes actual.** `diaDelMes(día, mesesAdelante)` las ancla al mes en curso. Con las fechas literales del mockup (septiembre 2025) el calendario del mes actual saldría vacío y "Próximos eventos" no tendría contenido. Los días 5 y 12, ya pasados en el mockup, se desplazan al mes siguiente.
- **Validación en el service, no solo en el formulario.** Un service es una API pública y no puede asumir que su llamador validó. Es además el punto exacto que se replica en el servidor en Fase 2.
- **Claves versionadas.** `juntos:v1:eventos` en lugar de guardar la versión dentro del JSON: al subir `VERSION_DATOS` la app deja de leer las claves antiguas sin necesidad de código de migración.
- **Las mutaciones actualizan el estado local** en vez de releer el store, para que un evento nuevo aparezca al instante sin parpadeo.
- **`resetDatos()` borra por prefijo**, no con `localStorage.clear()`, para no destruir datos de otras apps del mismo origen.

### Verificación

- `npm run lint`: 2 warnings, ambos falsos positivos documentados en el código (setState tras `await` en la carga inicial, que por definición va en un efecto). 0 errores.
- `npm run build`: correcto (323 kB JS, 17 kB CSS).
- **Suite de pruebas** (entonces `test-services.mjs`, hoy `test-datos.mjs`; 67 comprobaciones en este paso) contra un `localStorage` simulado:
  - Claves versionadas y siembra (8 eventos, 5 ideas, ordenados por fecha).
  - Fechas relativas: hay eventos en el mes actual, ningún próximo está pasado, los días del mockup (5, 12, 14, 19, 22, 26) están respetados.
  - `aFecha('2026-09-14').getDate() === 14` (sin desfase de zona horaria). La prueba de cuadrícula de este paso se sustituyó por la sección propia del paso c, que usa `weekStartsOn: 1` y un número variable de semanas.
  - CRUD completo, con verificación de que `actualizar` conserva `id` y `creadoEn`.
  - 8 casos de validación rechazados por el service: título vacío, fecha ausente, fecha imposible (`2026-02-31`), categoría inventada, hora inválida (25:00), título y descripción demasiado largos.
  - XSS: un `<script>` en el título se guarda literal y se renderiza escapado.
  - `id` manipulado (`' OR 1=1--`, número, texto no-UUID) → `null` o `ErrorServicio`.
  - JSON corrupto y objeto no-array → vuelta al seed sin romperse.
  - Cuota agotada → mensaje de espacio, y detección de las variantes de Chrome y Firefox.
  - Fotos: rechazo de SVG, PDF, >5 MB y MIME/extensión incoherentes; aceptación de data URL de imagen.
  - Citas: 2 favoritas, orden, toggle persistente, conversión a evento que conserva título, descripción y foto.
  - `resetDatos()` y `limpiarVersionesAnteriores()`, comprobando que no tocan claves ajenas a la app.

### Pendiente para el paso d
- Compresión de imágenes con `canvas` a 1200 px de ancho antes de convertirlas a base64 (mitiga la cuota de ~5 MB).
- `EventoFormModal`: el `onAgregar(fecha)` del calendario y de cada día ya le pasa la fecha, así que solo falta abrirlo con ella precargada.
- Validación del `:id` en `EventoDetalle`, que ya enlaza desde la celda y desde la lista de próximos eventos.

---

## Paso c — Calendario mensual

### Añadido
- **`src/utils/calendario.js`**, módulo nuevo con toda la lógica de la cuadrícula, fuera de React:
  - `construirCuadricula(mes, fechaHoy?)` — función pura que devuelve las semanas de un mes. Se le pasa `fechaHoy` para que los tests no dependan del día en que se ejecutan.
  - `asignarEventos(cuadricula, indice, fechaISO?)` — pone los eventos en sus celdas y marca el día elegido, sin mutar la cuadrícula original.
  - `etiquetaCelda(celda)` — `"14 de octubre, 3 eventos"`, con singular y plural.
  - `eventosDe(cuadricula, fechaISO)`, `mesDesde`, `mesDesdeParametro`, `mesAParametro`, `moverMesCalendario`, `aFechaLocal`.
  - `INICIO_SEMANA`, `MAX_EVENTOS_CELDA`, `MAX_EVENTOS_MOVIL`, `DIAS_ENCABEZADO`, `DIAS_ENCABEZADO_CORTOS`.
- **Componentes nuevos** en `src/components/calendar/`:
  - `CalendarioMes.jsx` — encabezado con título, flechas y "Hoy", nombres de día, y las celdas. `role="grid"` con `role="row"` por semana.
  - `CeldaDia.jsx` — un día como `button`, con `aria-label`, `aria-pressed` y anillo de foco. Variante compacta para móvil.
  - `EventosDelDia.jsx` — lista completa de los eventos de un día, con franja de categoría, hora y lugar.
- **`Calendario.jsx` pasa a ser el mes completo:**
  - El mes visible vive en `?mes=2026-10`, así que al abrir un evento y volver, el calendario reabre donde se estaba. El botón "Hoy" quita el parámetro.
  - Cuadrícula memoizada con `useMemo`; los eventos llegan por el `Map` `eventosPorFecha` del hook, no con un `filter` por celda.
  - Máximo 2 eventos visibles por celda y un "+N más" que selecciona el día, con lo que el panel de abajo muestra la lista completa.
  - Días fuera del mes atenuados, el de hoy resaltado y el seleccionado con anillo de acento.
  - Leyenda de categorías y "Agregar evento" con la fecha del día resaltado.
  - Selector Mes/Semana/Día: "Semana" y "Día" quedan deshabilitados con tooltip "Próximamente".
  - En móvil, celdas de 44 px con puntos de color y el `EventosDelDia` debajo, junto a "Próximos eventos".
- **`useEventos`** documenta `eventosPorFecha`, que ya usaba el calendario.

### Corregido
- **Las claves de categoría no coincidían entre archivos.** `CATEGORIAS_EVENTO` usaba la clave `cumpleaños` (con ñ) mientras `ORDEN_CATEGORIAS_EVENTO`, el seed y la validación usaban `cumpleanos`. Dos consecuencias: la leyenda del calendario leía `undefined` y **reventaba la página entera**, y todos los eventos de cumpleaños se pintaban con el color y la etiqueta de "Otro". Ahora la clave es el slug ASCII `cumpleanos` y el `ñ` solo vive en `label`, que es lo que se ve.
- **Las categorías de ideas usaban claves con espacio** (`'en casa'`). Una clave de categoría acaba siendo un valor de filtro y una columna, así que se normalizaron a slugs: `en-casa`, `afuera`, `aventura`, `relax`.
- **`VERSION_DATOS` sube de 1 a 2.** El esquema de las categorías cambió de forma, así que los datos guardados en `juntos:v1:*` dejan de leerse en lugar de quedar con valores que la validación rechazaría.
- **`construirCuadricula` se mudó de `fechas.js` a `calendario.js`.** Estaba duplicada con `weekStartsOn: 0` y 42 celdas fijas, lo contrario de lo pedido. Ahora solo existe en un sitio.
- **`asignarEventos` no llegaba a las semanas.** Reconstruía `semanas.dias` buscando en el array de celdas *original*, así que los eventos se perdían en la rejilla aunque se vieran en la lista plana. Las pruebas de renderizado lo detectaron.
- **`describirRango` recibía celdas y las trataba como `Date`.** Rompía en el primer render de cualquier mes.

### Decisiones
- **La cuadrícula tiene 4, 5 o 6 filas, no siempre 6.** Se extiende solo hasta completar la última semana. Fijar 6 siempre dejaría dos semanas en blanco en la mitad de los meses.
- **Ninguna fecha se construye con `new Date('YYYY-MM-DD')`.** Esa cadena se interpreta como UTC y, en Bogotá (UTC-5), el 1 de octubre a las 00:00 UTC es el 30 de septiembre a las 19:00 locales: el calendario abriría en el mes equivocado. Todo pasa por `parseISO` o por números sueltos, que además deja poner `HH:mm` a la hora.
- **`?mes=` se valida con una expresión regular** y cae al mes actual si no encaja, en vez de pasarle al `Date` lo que venga en la barra de direcciones.
- **El "+N más" es hermano del `button` del día, no hijo.** No se puede anidar un `button` dentro de otro `button`.

### Verificación
- `npm test` — **174 comprobaciones, 0 fallos**, incluyendo:
  - **Febrero de 2027** (empieza en lunes, 28 días): 4 semanas exactas, 28 celdas, sin relleno.
  - **Agosto de 2026** (empieza en sábado, 31 días): 6 semanas exactas, 42 celdas, 11 días de relleno.
  - Octubre de 2026: 5 semanas, y el relleno son los 3 últimos días de septiembre más el 1 de noviembre.
  - Los 36 meses de 2025–2027: ninguno se sale de 4 a 6 semanas, todos empiezan en lunes y ninguna celda se salta un día.
  - `?mes=` rechaza basura, mes `0`, mes `13`, año absurdo e intento de inyección; y el día 1 sale local, no UTC.
  - Navegación entre meses cruzando el año en ambos sentidos, incluido el bisiesto.
  - Renderizado real de `CalendarioMes` con `react-dom/server`: 35 celdas, una fila por semana, `aria-label` correcto con singular/plural, y el "+1 más" **fuera** del `button` del día.
  - La página `Calendario` monta con el router real y el parámetro `?mes=2026-10`.
  - Integridad de las categorías: toda clave del orden existe en el objeto, el seed no usa claves inexistentes y la validación acepta las del seed.
- `npm run lint` — 0 errores, 2 warnings conocidos (falsos positivos de `setState` tras `await` en un efecto de carga inicial).
- `npm run build` — correcto.

### Pendiente para el paso d
- `EventoFormModal`: el `onAgregar(fecha)` del calendario y de cada día ya le pasa la fecha, así que solo falta abrirlo con ella precargada.
- Validación del `:id` en `EventoDetalle`, que ya enlaza desde la celda y desde la lista de próximos eventos.

---

## Paso d - Eventos, fotos y detalle

### Añadido

**Catálogo de categorías como fuente única** (`src/utils/categorias.js`)
- `PATRON_CATEGORIA`, `ORDEN_CATEGORIAS_EVENTO`, `ORDEN_CATEGORIAS_IDEA` derivados, `esCategoriaValida()` y `esCategoriaIdeaValida()`.
- `CATEGORIA` y `CATEGORIA_IDEA`: constantes con nombre, derivadas del catálogo, para que el seed deje de escribir slugs a mano.
- Una clave inválida en el catálogo hace **fallar la importación** al cargar el módulo. Es preferible a una app que arranca y luego rompe al pintar.

**Procesado de imágenes** (`src/utils/imagen.js`, nuevo)
- `calcularDimensiones()`, `detectarTipoPorBytes()`, `validarBytesDeArchivo()`, `comprimirImagen()`, `estimarBytesGuardados()`.
- Validación en dos fases: tipo y tamaño declarados primero, **magic bytes** después. Sin la segunda, un SVG renombrado a `.jpg` pasaba el filtro.
- Recompresión a 1200 px / WebP ~0.8 antes de guardar. El canvas no copia metadatos, así que esto elimina EXIF y GPS. La orientación EXIF sí se respeta.
- `validarArchivoFoto` y las constantes de imagen se reexportan desde `validaciones.js` para no romper importaciones existentes.

**Interfaz**
- `SelectorFoto.jsx`: input de archivo real (no un `div` con `onClick`), previsualización, borrado y estado de carga.
- `EventoFormModal.jsx`: un único formulario para alta y edición, con validación compartida, chips derivados, contadores, `aria-describedby`, foco en el primer error, doble envío bloqueado y aviso al cerrar con cambios.
- `EventoDetalle.jsx`: ficha con foto, categoría, fecha, hora, lugar, descripción, edición, borrado con confirmación y vuelta a `?mes=`.
- `CeldaDia`: el día seleccionado pasa a `bg-accent/15 ring-2 ring-accent`.
- `Calendario`: alta con la fecha preseleccionada, y `EventosDelDia` movido a un `aside` sticky en escritorio para que se vea sin desplazarse.
- `Modal.jsx` reescrito: `useId`, callback en ref, foco atrapado, foco devuelto, Escape y bloqueo de scroll con contador.

**Pruebas**
- `jsdom` como dependencia de desarrollo, para probar de verdad portal, teclado, foco y eventos en lugar de solo renderizado a texto.

### Bugs encontrados y corregidos durante el paso

Estos los encontraron las pruebas, no la lectura del código:

- **El formulario siempre parecía "sucio".** El ref de valores iniciales guardaba la *función* `valoresIniciales` en vez de su resultado, y `JSON.stringify` comparaba una función consigo misma. Resultado: el aviso de "¿salir sin guardar?" salía incluso sin tocar nada.
- **Preguntar si se quiere salir borraba lo escrito.** Al aparecer el aviso, el formulario se sustituía por él; al cancelar, se montaba uno nuevo y vacío. El aviso existía para proteger ese trabajo y lo destruía. Ahora el contenido se oculta con `hidden` y sigue montado.
- **El foco no volvía al botón que abrió el modal.** Se guardaba el elemento activo en un efecto normal, que React aplica **después** de que el formulario enfocara su primer campo: se guardaba el input del formulario, no el disparador. Al cerrar, el foco caía en `body`.
- **El primer campo del formulario nunca recibía el foco.** El modal lo enfocaba a la fuerza en un segundo efecto, quitándole el foco al contenido.
- **Con dos modales abiertos, el scroll se quedaba bloqueado para siempre.** El contador era global pero el estilo guardado del `<body>` vivía en la instancia del componente: cerrando el primero de los dos, el valor se perdía.
- **`elementosFocusables()` no encontraba nada en un DOM sin layout.** Filtraba por `offsetParent !== null`, que además de no existir en jsdom habría excluido del teclado los radios `sr-only` de las categorías.
- **`obtenerCategoria('toString')` devolvía una función.** El `??` de un acceso directo no detecta propiedades heredadas de `Object.prototype`. Ahora usa `Object.hasOwn`.
- **Se perdía la transparencia al exportar a WebP.** El fondo blanco se rellenaba antes de dibujar, así que también se aplicaba al formato que sí admite canal alfa. El relleno va ahora solo justo antes de exportar a JPEG.
- **`limpiarTexto()` guardaba `"[object Object]"`** con un `String(valor)` genérico. Ahora solo acepta cadenas.
- **`favorita: "false"` marcaba una idea como favorita**, porque la cadena es truthy y `Boolean("false")` es `true`.
- **La cuota de ideas se perdía dentro de un `ErrorServicio`.** "No pudimos cargar" no es accionable; "libera espacio" sí.
- **`tamanoAproximado()` podía tirar la pantalla de Configuración** si el almacén se caía a mitad de la cuenta. Cada `getItem` va ahora en su propio `try/catch`.

### Decisiones

- **Alta y edición comparten componente.** La validación, los límites, los chips y el selector de foto son los mismos; duplicarlos garantiza que uno se quede desactualizado.
- **"¿Hay cambios?" compara con los valores iniciales**, no con un flag "tocado". Escribir y borrar devuelve el formulario a su estado original, y preguntar en ese caso enseña a confirmar sin leer.
- **El texto de las categorías cumple AA sobre su fondo** en los cinco casos (de 4.71 a 8.35). Los colores principales sobre `#F7FAFC` **no** alcanzan 3:1 en `viaje` (2.99), `cumpleanos` (1.74) y `otro` (2.20): el significado no depende solo del color, pero queda pendiente revisar el contraste de franjas y puntos.
- **Las claves de categoría son slugs y las etiquetas no.** La clave va al almacén y a la URL, así que no lleva tildes ni espacios. Subir `VERSION_DATOS` no migra datos reales: cambiar un slug exige migración de datos y del enum en el mismo despliegue.

### Verificación

- `npm test`: **463 comprobaciones, 0 fallos** (261 antes de añadir jsdom; 358 al montar el entorno DOM, con 12 fallos que fueron los que destaparon los bugs de foco y scroll de arriba).
- `npm run lint`: **0 errores, 0 warnings**.
- `npm run build`: correcto (360 kB JS, 24 kB CSS).

La suite cubre, además de lo anterior: foco atrapado (Tab y Mayús+Tab), Escape, aviso de cambios sin guardar con sus tres desenlaces, validación con foco en el primer error, doble envío bloqueado, borrado confirmado y su navegación, `id` inexistente, `id` con inyección y `id` vacío, nombres heredados del catálogo, cuota de ideas, `tamanoAproximado` con un almacén caído, y renderizado de un título con `<script>` sin crear nodos.

Los dos pendientes del paso c que se citan arriba quedan resueltos: `EventoFormModal` se abre con la fecha preseleccionada, y `EventoDetalle` valida el `:id` y tiene su estado de "no encontrado".

### Revisión posterior: dos avisos que no eran ruido

- **La carga inicial ya no escribe en un componente desmontado.** `useEventos` y `useCitas` piden los datos y actualizan al recibirlos, con un `await` en medio. Si en ese hueco se navega a otra pantalla, las actualizaciones llegaban a un componente que ya no existía. Ahora `cargar` recibe un `sigueVivo` y el efecto pasa una bandera con su limpieza.
- **El modal ya no se va debajo del teclado en móvil.** El panel se limitaba con `max-h-[92vh]`, y en un teléfono `vh` mide el viewport *sin* el teclado, así que el pie con "Guardar" acababa debajo. Ahora la altura usa `dvh` con un respaldo a `vh`.

Sobre el segundo arreglo hay un detalle que costó tres intentos y conviene que no se repita, porque el arreglo "limpio" es el que no funciona:

| Intento | Resultado |
| --- | --- |
| `max-h-[92vh] max-h-[92dvh]` en el JSX | Tailwind ordena las utilidades por su catálogo, no por el orden escrito: compiló el `dvh` **antes** que el `vh`, y ganaba el `vh`. |
| Array de valores en `addUtilities` | Tailwind se queda solo con el último valor. |
| Las dos declaraciones en CSS plano | Correcto en el fuente, pero **Lightning CSS** (el que trae Vite) borraba el `92vh` por considerarlo redundante, al no tener `build.cssTarget` configurado. |
| CSS plano con `@supports (height: 100dvh)` | Correcto y verificado en el CSS compilado. |

Es decir: ni Tailwind ni el minificador respetan el orden en este caso. La regla vive en `src/index.css` y hay un test que falla si alguien vuelve a poner la altura desde el JSX.

### Pendiente

- **Smoke test en navegador** de escritorio y móvil: portal, foco, alta, edición, borrado, panel visible sin scroll y consola limpia.
- **Una foto real de móvil** para validar orientación EXIF, stripping de GPS y compresión de punta a punta. No hay ningún archivo de ese tipo disponible. La orientación depende de que el navegador honre `createImageBitmap(..., { imageOrientation: 'from-image' })`: si lo ignora, la foto sale tumbada y no hay forma de detectarlo desde el código.
- Contraste no textual de las franjas de categoría (ver arriba).
