# ARQUITECTURA — Juntos (Fase 1)

## Visión general
La aplicación sigue una arquitectura de capas con clara separación entre **UI**, **estado derivado (hooks)**, **acceso a datos (services)** y **origen de datos (localStorage + seed)**. El objetivo es poder migrar la capa de services a Supabase **sin tocar ninguna página**.

## Capas

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| **Presentación (UI)** | `src/components/`, `src/pages/` | Renderiza la interfaz, recibe interacciones del usuario. **Nunca** accede a `localStorage` directamente. |
| **Hooks** | `src/hooks/` | Exponen datos y operaciones a las páginas (`useEventos`, `useCitas`, `useMediaQuery`). Normalizan estado, agrupan operaciones y encapsulan efectos. |
| **Services** | `src/services/` | **Única puerta de entrada a los datos**. Funciones `async` (`getEventos`, `crearEvento`, `toggleFavorita`, ...). Internamente usan `localStorage` y siembran con `seed.js` en el primer uso. Aquí van todos los `try/catch`. |
| **Storage** | `src/services/storage.js` | Abstracción sobre `localStorage`: claves versionadas (`juntos:v3:eventos`), parseo tolerante, detección de cuota, `resetDatos()`. Única capa que toca `localStorage`. |
| **Datos iniciales** | `src/data/seed.js` | Datos de ejemplo del mockup (8 eventos + 5 ideas), con **fechas relativas al mes actual**. Solo se leen cuando el storage está vacío o corrupto. |
| **Tipos/contratos** | `src/types/models.js` | `@typedef` de `Evento` e `IdeaCita`, y la constante `ORIGEN` (fuente única de verdad). |
| **Utilidades** | `src/utils/` | `validaciones.js` (reglas de validación compartidas), `fechas.js` (parseo y formateo con date-fns), `calendario.js` (construcción de la cuadrícula, sin React), `categorias.js` (catálogo único de categorías), `planeador.js` (reglas puras del planeador), `ids.js` (UUID v4). |
| **Constantes de navegación** | `src/constants/nav.js` | Rutas, menús (escritorio/móvil), perfil de pareja y marca. |

## Dos versiones, no una
`storage.js` mantiene **dos números de versión independientes**, porque no sirven para lo mismo:

| Constante | Valor | Qué versiona | Qué pasa al subirla |
|---|---|---|---|
| `VERSION_DATOS` | 3 | La forma de los modelos: `Evento` e `IdeaCita` | La app deja de leer `juntos:v2:*`, vuelve a sembrar y escribe bajo `juntos:v3:*` |
| `VERSION_SESION` | 1 | Lo que guarda la sesión, cuando exista | Nada: la sesión se conserva y no se regenera |

El motivo de separarlas es que la sesión es el único dato que **no se puede reconstruir**: si comparte versión con los datos, un cambio de esquema cerraría la sesión de todo el mundo sin motivo. `limpiarVersionesAnteriores()` nunca borra la clave de sesión. Ver `docs/SEGURIDAD.md`.

## Flujo de datos
1. **Primer acceso:** `eventosService.getEventos()` llama a `storage.leer()` → devuelve `null` (nada guardado, o JSON corrupto) → se siembra con `seed.js` → se guarda en `juntos:v3:eventos` → devuelve el array ordenado.
2. **Página:** consume `useEventos()`, que llama al service en un efecto y guarda el resultado en estado.
3. **Escritura:** la página llama a `crear()` del hook → el service valida con `validarEvento()` → persiste → devuelve la entidad normalizada → el hook la inserta en su lista local. **No hay re-lectura:** el evento aparece al instante sin parpadeo.
4. **UI reacciona:** React re-renderiza con el estado ya actualizado.

**Principio:** las páginas desconocen el origen de los datos (localStorage hoy, Supabase mañana). Ver `docs/MIGRACION_SUPABASE.md`.

## Páginas que son vistas sobre otras
La galería no tiene datos propios: es una **vista** sobre los eventos. `src/utils/galeria.js` recibe la lista de eventos y devuelve la de los que tienen foto, ordenada y agrupada por mes.

- **Sin tabla, sin clave y sin service nuevos.** Una foto es `Evento.foto`, así que al borrar un recuerdo su foto desaparece sin borrar nada más, y no existe el estado en el que las dos cosas se desincronicen.
- **Consecuencia para Fase 2:** si en Supabase `foto` pasa a ser una tabla aparte (por ejemplo, para varias fotos por evento), la galería deja de ser derivable y habrá que darle su propio service. Está anotado en `docs/MIGRACION_SUPABASE.md`.
- **El orden no se hereda del calendario.** El calendario ordena ascendente (lo próximo arriba) y la galería descendente (lo último que pasó primero). `extraerFotos` lo hace explícito en vez de reutilizar `eventosOrdenados`, porque heredarlo sería correcto por casualidad.
- **El filtro de año viaja en la URL** (`?anio=2026`), igual que `?mes=` en el calendario y `?categoria=` en el planeador. Se normaliza al leerlo: un `?anio=20` se trata como "sin filtro" en vez de dejar la página vacía sin explicación.
- **`?evento=<id>`** lo escribe el enlace "Ver en la galería" del detalle y resalta esa foto con `aria-current`. Al cambiar de año se borra, porque la foto resaltada puede no estar en el año nuevo.
- **El degradado de reserva vive en `categorias.js`**, no en `planeador.js` ni en el componente: la galería necesita el de los eventos y mantener los dos habría sido la misma interpolación escrita en dos sitios.


## Validación en dos capas
Las reglas viven solo en `src/utils/validaciones.js` y se aplican en dos sitios:
- **Formulario:** para pintar el error en el input concreto (UX inmediata).
- **Service:** para rechazar datos inválidos aunque el formulario los haya dejado pasar.

Que el service valide no es redundancia: es una API pública y no puede asumir que su llamador validó. En Fase 2, la base de datos replicará estas reglas como `check`; el cliente pasará a ser referencia, no barrera.

## Tokens y colores de categoría
- **Tailwind v3:** los tokens estructurales (base, sidebar, accent, surface...) viven en `tailwind.config.js` (`theme.extend.colors`).
- **Colores de categoría:** **no** están en Tailwind. Viven en `src/utils/categorias.js` como hex (`#7B22CA`, etc.) y se aplican con `style={{ backgroundColor }}`.
  - **Motivo técnico:** Tailwind no genera clases construidas dinámicamente (`bg-${hex}` o `bg-${clave}` concatenada en runtime) porque las purga al escanear el código fuente. Usar `style` mantiene `categorias.js` como **única fuente de verdad** y evita `safelist` innecesario.
- **Decisión sobre Tailwind:** fijamos `tailwindcss@3.4.17` explícitamente. Vite instalaría v4 por defecto (que usa `@theme` en CSS y elimina `tailwind.config.js`). Esta decisión se documenta aquí y en `docs/CHANGELOG.md` (paso a) para facilitar una migración futura.

## Navegación y layout
- **Rutas:** definidas en `src/App.jsx`. `/bienvenida` está **fuera** de `<Layout />` (sin sidebar ni barra inferior). El resto anidado bajo `<Layout />`.
- **Separación Inicio/Momentos:** `/` (Inicio) y `/momentos` (Momentos) son rutas distintas. Con `NavLink`, dos ítems con el mismo `to` quedaban activos simultáneamente; además no compartían propósito en el mockup. El `NavLink` de `/` lleva `end` para no marcarse activo en subrutas.
- **Responsive:** `useMediaQuery('(min-width: 1024px)')` decide entre layout de escritorio y móvil (no CSS `hidden`), para evitar doble render innecesario.
- **Safe area (iOS):** `viewport-fit=cover` en `index.html` + `pb-[env(safe-area-inset-bottom)]` en `BottomNav.jsx`.

## Seguridad (Fase 1)
- Validación de entradas en formularios (campos obligatorios, longitudes máximas 120/500). Ver `docs/SEGURIDAD.md`.
- **Nunca** `dangerouslySetInnerHTML`. React escapa por defecto; se explica con comentario `SEGURIDAD:`.
- Subida de fotos: solo MIME permitidos (jpeg/png/webp), tamaño máximo 5 MB, conversión controlada a base64. Validación y manejo de errores con `try/catch`.
- `localStorage`: **no seguro para datos sensibles** (accesible desde DevTools). Login simulado **no es autenticación real**.
- Parámetros de ruta (`:id`): se validarán/gestionarán con estado "evento no encontrado" (paso d).
- Todos los services usan `try/catch`; no se exponen detalles internos al usuario.
- Marcadores: `SEGURIDAD:` para prácticas aplicadas; `TODO-FASE2 (SEGURIDAD):` para lo que debe migrar al backend (autenticación, autorización por pareja/RLS, validación server-side, Storage de Supabase).

## Convenciones de código
- Cada archivo empieza con cabecera JSDoc (qué hace, responsabilidad, módulos relacionados).
- Cada función/componente/hook lleva JSDoc completo (`@param`, `@returns`, `@example` cuando no es obvio).
- Props de componentes documentadas con `@typedef`.
- Comentarios en línea explican el **por qué** (lógica no trivial). **No** comentarios superfluos.
- Modelos en `src/types/models.js` con `@typedef`.
- Español en comentarios, etiquetas UI y documentación.

## Categorías: un solo archivo

`src/utils/categorias.js` es la **única fuente**. Las listas de categorías se derivan con `Object.keys()`, la validación usa `esCategoriaValida()` y el seed lee del catálogo. No se repite ningún slug en otro archivo.

No es una preferencia de estilo, es un arreglo. La lista de categorías estaba escrita a mano en cuatro sitios y se desincronizó: el catálogo usaba la clave `cumpleaños` con `ñ` y el resto usaba `cumpleanos`. Como `obtenerCategoria()` cae en `otro` ante una clave desconocida, **ninguna validación de datos lo detectó**: los eventos de cumpleaños se pintaban con el color equivocado y la leyenda del calendario leía `undefined` y dejaba la página en blanco. Un derivado no puede desincronizarse.

**El orden de las claves del objeto es el orden de los chips.** Si alguna vez hay que reordenar la presentación, se reordena el objeto, no la lista derivada.

## ⚠️ Cambiar un slug en Fase 2 exige migrar la base de datos

`VERSION_DATOS` protege los datos de `localStorage`: al subirla, la app deja de leer las claves antiguas y vuelve a sembrar. **Eso no sirve para datos reales.** Cuando haya tabla en Supabase:

- La columna de categoría tendrá un tipo enum o un `check` con los slugs escritos a mano. Cambiar un slug en el código **no cambia** ese enum: los registros existentes quedan con un valor que la app ya no reconoce.
- Habrá que escribir una migración de datos (`update … set categoria = 'cumpleanos' where categoria = 'cumpleaños'`) y alterarla constraint, **en el mismo despliegue** que el código nuevo.
- El orden importa: primero la migración de datos, después el código. Si se despliega el código antes, los registros viejos se muestran con la categoría de reserva.

Mientras tanto, la regla práctica es: **un slug es un contrato.** Cambiarlo en `categorias.js` no es un refactor.

Ninguna fecha se construye con `new Date('YYYY-MM-DD')`. Esa cadena se interpreta como **UTC**, y en Bogotá (UTC-5) el 1 de octubre a las 00:00 UTC es el 30 de septiembre a las 19:00 locales: un evento caería en el día anterior. Todo pasa por `aFecha()` (que usa `parseISO`) o por números sueltos, que además permite poner `HH:mm` a la hora.

- La **cuadrícula** se calcula en `src/utils/calendario.js`, en funciones puras, para poder testearla sin montar React.
- La semana empieza en **lunes** (`weekStartsOn: 1`).
- La cuadrícula tiene **4, 5 o 6 filas** según el mes, no 6 fijas: se extiende solo hasta completar la última semana.
- El mes visible viaja en la **URL** (`?mes=2026-10`), validado con una expresión regular. Así el calendario reabre en el mismo mes al volver del detalle, y un mes se puede compartir por enlace.

## Próximos pasos (orden acordado)
- **c)** Calendario mensual a mano con date-fns. **Hecho.**
- **d)** `EventoFormModal` (validación por campo con `ErrorValidacion`, contador 500, chips, drag&drop → compresión con canvas a 1200 px → base64), detalle/editar/eliminar, estado "evento no encontrado" para el `:id`.
- **e)** Planeador: filtros, corazón favorita, "Nueva idea", "Convertir en evento" precargando el formulario. **Hecho.**
- **f)** Galería: grid responsive → navega a detalle. **Hecho.**
- **g)** Pulido, `resetDatos` en Configuración, vistas Semana/Día, README final y cierre probando `npm run dev`.
