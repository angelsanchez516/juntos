# ARQUITECTURA — Juntos (Fase 1)

## Visión general
La aplicación sigue una arquitectura de capas con clara separación entre **UI**, **estado derivado (hooks)**, **acceso a datos (services)** y **origen de datos (localStorage + seed)**. El objetivo es poder migrar la capa de services a Supabase **sin tocar ninguna página**.

## Capas

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| **Presentación (UI)** | `src/components/`, `src/pages/` | Renderiza la interfaz, recibe interacciones del usuario. **Nunca** accede a `localStorage` directamente. |
| **Hooks** | `src/hooks/` | Exponen datos y operaciones a las páginas (`useEventos`, `useCitas`, `useMediaQuery`, `useSesion`). Normalizan estado, agrupan operaciones y encapsulan efectos. |
| **Services** | `src/services/` | **Única puerta de entrada a los datos**. Funciones `async` (`getEventos`, `crearEvento`, `toggleFavorita`, ...) y las de sesión, que son síncronas. Internamente usan `localStorage` y siembran con `seed.js` en el primer uso. Aquí van todos los `try/catch`. |
| **Storage** | `src/services/storage.js` | Abstracción sobre `localStorage`: claves versionadas (`juntos:v3:eventos`, `juntos:v1:sesion`), parseo tolerante, detección de cuota, `resetDatos()`. Única capa que toca `localStorage`. |
| **Datos iniciales** | `src/data/seed.js` | Datos de ejemplo del mockup (8 eventos + 5 ideas), con **fechas relativas al mes actual**. Solo se leen cuando el storage está vacío o corrupto. |
| **Tipos/contratos** | `src/types/models.js` | `@typedef` de `Evento` e `IdeaCita`, y la constante `ORIGEN` (fuente única de verdad). |
| **Utilidades** | `src/utils/` | `validaciones.js` (reglas de validación compartidas), `fechas.js` (parseo y formateo con date-fns), `calendario.js` (construcción de la cuadrícula, sin React), `categorias.js` (catálogo único de categorías), `planeador.js` (reglas puras del planeador), `ids.js` (UUID v4). |
| **Constantes de navegación** | `src/constants/nav.js` | Rutas, menús (escritorio/móvil), perfil de pareja y marca. |

## Dos versiones, no una
`storage.js` mantiene **dos números de versión independientes**, porque no sirven para lo mismo:

| Constante | Valor | Qué versiona | Qué pasa al subirla |
|---|---|---|---|
| `VERSION_DATOS` | 3 | La forma de los modelos: `Evento` e `IdeaCita` | La app deja de leer `juntos:v2:*`, vuelve a sembrar y escribe bajo `juntos:v3:*` |
| `VERSION_SESION` | 1 | La forma del objeto de sesión (`id`, `creadaEn`) | Nada: la sesión se conserva y no se regenera |

El motivo de separarlas es que la sesión es el único dato que **no se puede reconstruir**: si comparte versión con los datos, un cambio de esquema cerraría la sesión de todo el mundo sin motivo. `resetDatos()` y `limpiarVersionesAnteriores()` nunca borran la clave de sesión. Ver `docs/SEGURIDAD.md`.

## Sesión y guardas de ruta

`juntos:v1:sesion` guarda `{ id, creadaEn }`. La gestiona `src/services/sesion.js`
(`leerSesion`, `crearSesion`, `cerrarSesion`, `haySesion`, `informacionSesion`) y
`src/hooks/useSesion.js` la expone a la interfaz, suscribiéndose al evento
`storage` para que el indicador de Configuración cambie cuando otra pestaña cierra
sesión.

**No es autenticación.** La clave se puede escribir a mano desde la consola, así que
`ConSesion` y `SinSesion` en `src/App.jsx` solo evitan repetir la bienvenida.
`leerSesion()` valida la forma del valor y degrada a `null` ante un JSON corrupto,
un array o un `id` que no sea un UUID v4. `TODO-FASE2 (SEGURIDAD)` sustituye todo
esto por la sesión de Supabase Auth.

Las guardas van en los dos sentidos: sin sesión, todo lo de dentro de `<Layout />`
redirige a `/bienvenida`; con sesión, `/bienvenida` redirige a `/`. Se protegen el
`Layout` entero y no ruta por ruta, para que una pantalla nueva quede protegida sin
acordarse.

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

## La vista del calendario vive en la URL
Las tres vistas comparten la página y el conmutador, y cambian de estado con `?` en la dirección:

| Vista | Parámetros | Cuadícula |
|---|---|---|
| Mes | `?mes=YYYY-MM` | `construirCuadricula` |
| Semana | `?vista=semana&fecha=YYYY-MM-DD` | `construirSemana` |
| Día | `?vista=dia&fecha=YYYY-MM-DD` | `construirDia` |

- **El conmutador son `Link`, no botones.** Con `button` + estado propio, el botón "Atrás" del navegador y un enlace recibido por WhatsApp no funcionarían sin código que los escuchara. `aria-current="page"` marca la activa.
- **`fechaDesdeParametro()` normaliza al leer.** Un `?vista=trimestre` cae en el mes y un `?fecha=2026-10-99` cae en hoy, en vez de dejar la pantalla vacía sin explicación.
- **Cambiar de vista conserva el día que se estaba mirando.** Al volver al mes se escribe `?mes=` con el mes del ancla, no el mes en curso: quien estaba en noviembre y vuelve al mes espera ver noviembre. Solo el mes en curso se deja sin parámetros, porque esa es la dirección que se comparte.
- **Elegir un día no escribe en la URL.** Es mirar sus eventos, no moverse: si "Compartir" mandara a otro día, el enlace sería peor que no tenerlo. Moverse con las flechas sí escribe.
- **`elegirDiaResaltado` y `resaltarCuadricula` están fuera del componente** (`src/pages/Calendario.jsx`). Son reglas de la cuadrícula, no estado de React. Dentro del componente, el `useMemo` del resaltado y el que lo pintaba no se podían conservar: uno invalidaba al otro y podían acabar mostrando días distintos.

## Un solo reloj
`src/utils/reloj.js` es lo único que responde a "¿qué día es hoy?". El seed, `hoyISO`, `esHoy`, `estaPasada`, `diasHasta` y `fraseDelDia` leen de ahí.

- **Por qué un módulo y no un parámetro en cada función.** El día en curso se consulta desde el seed, tres utilidades y dos páginas. Pasarlo como parámetro obligaría a arrastrarlo por `getEventos` → `crearEventosSeed` → `diaDelMes` y a cambiar la firma de hooks que solo necesitan la lista. Con una costura única, el comportamiento por defecto sigue siendo el reloj real y las pruebas pueden fijar la fecha sin tocar ninguna firma de producción.
- **`reloj.js` no importa de `fechas.js`, al revés de lo que se haría por costumbre.** `fechas.js` pregunta por "hoy" a `reloj.js`; si `reloj.js` importara su parser, la evaluación de los dos módulos quedaría suspendida entre sí y el orden de resolución del grafo decidiría si `ahora()` existe cuando se la llama. El parser se repite con las mismas dos funciones de `date-fns`.
- **La suite corre con el reloj fijado.** `node test-datos.mjs 2027-02-28`, o `npm run test:octubre`, `test:febrero` y `test:diciembre`. Las fechas están elegidas por lo que rompen: octubre es el mes del seed, febrero tiene cuatro semanas y diciembre salta la cuadrícula.
- **Dos rutas se saltaban el reloj y por eso la suite las daba por buenas.** `mesDesdeParametro()` tenía `new Date()` como valor por defecto del parámetro, y como los parámetros por defecto se evalúan en cada llamada, esa era también la ruta de `?mes=` cuando faltaba o venía basura. `crearEvento()` sellaba `creadoEn` con `new Date()`. Ninguna de las dos fallaba en octubre: devolvían el mes y la hora del ordenador, que en la máquina de quien prueba son los mismos. Por eso el reloj se fija antes de que la comprobación mire el resultado, y no después.

## Restablecer datos no es cerrar la sesión
`resetDatos()` borra las claves de datos de la app y **conserva `juntos:v1:sesion`**.

- **Por qué.** Restablecer los datos y perder la sesión son dos cosas distintas. La sesión es el único dato que la app no puede recrear, y en esta fase no hay recuperación: borrarla dejaría a cualquiera fuera de su propio calendario por haber pulsado un botón de "¿quieres volver a empezar?".
- **`limpiarVersionesAnteriores()` aplica la misma excepción** desde antes, por el mismo motivo: subir `VERSION_DATOS` no puede cerrar la sesión de nadie.
- **La sesión sí se puede borrar a mano**, desde el código, que es lo que hará el futuro "salir de la pareja". Lo que no puede es desaparecer sin querer al restablecer los datos.
- En Fase 2, con recuperación de sesión y autorización por pareja en Supabase, el aviso de "salir de la pareja" dirá por separado lo que sí se pierde. Ver `TODO-FASE2 (SEGURIDAD)` y `docs/SEGURIDAD.md`.

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
- **Rutas:** definidas en `src/App.jsx`. `/bienvenida` está **fuera** de `<Layout />` (sin sidebar ni barra inferior). El resto anidado bajo `<Layout />`, envuelto en `ConSesion`.
- **Guardas:** `ConSesion` y `SinSesion` deciden, en cada momento, si se ve la bienvenida o la app. Son guardas de navegación, no autenticación. Ver "Sesión y guardas de ruta" arriba y `docs/SEGURIDAD.md`.
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
- El mes visible viaja en la **URL** (`?mes=2026-10`), validado con una expresión regular. Así el calendario reabre en el mismo mes al volver del detalle, y un mes se puede compartir por enlace. Las vistas de semana y día añaden `?vista=` y `?fecha=`, descritas en "La vista del calendario vive en la URL".

## Próximos pasos (orden acordado)
- **c)** Calendario mensual a mano con date-fns. **Hecho.**
- **d)** `EventoFormModal` (validación por campo con `ErrorValidacion`, contador 500, chips, drag&drop → compresión con canvas a 1200 px → base64), detalle/editar/eliminar, estado "evento no encontrado" para el `:id`. **Hecho.**
- **e)** Planeador: filtros, corazón favorita, "Nueva idea", "Convertir en evento" precargando el formulario. **Hecho.**
- **f)** Galería: grid responsive → navega a detalle. **Hecho.**
- **g)** Pulido, `resetDatos` en Configuración, vistas Semana/Día, sesión simulada con guardas de ruta y cierre desde Configuración, README final y cierre probando `npm run dev`. **Hecho.** Dos cosas se hicieron sin estar en el encargo original: las vistas de semana y día, que pedía dejarlas deshabilitadas con "Próximamente", y la sesión con sus guardas, que solo era una excepción de `resetDatos()`. Ambas van en su propio commit para poder deshacerlas. Queda pendiente la comprobación visual en navegador real, que no se puede automatizar desde el terminal: está recogida en `docs/VERIFICACION_MANUAL.md`, con las casillas vacías.
