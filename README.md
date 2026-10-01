# Juntos — Calendario de recuerdos + planeador de citas

"Juntos" es una aplicación web responsive para parejas: combina un calendario de recuerdos con un planeador de citas. Esta fase 1 es un prototipo **solo frontend**, con datos simulados persistidos en `localStorage`.

## Estado actual (Pasos a, b, c, d y e)
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
- [ ] Galería (paso f)
- [ ] Pulido final y vistas Semana/Día (paso g)

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

## Build
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
- **Las ideas del seed no se editan ni se borran:** `IdeaCita.origen` dice de dónde viene cada una, y solo las de la pareja tienen botones de editar y borrar. Sin ese campo habría que reconocerlas por sus ids o por su contenido, que se rompe en cuanto cambia el seed.
- **La cuadrícula se calcula fuera de React**, en funciones puras de `src/utils/calendario.js`, para poder testearla sin montar componentes.
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
guardar, borrado confirmado y su navegación. **444 comprobaciones.**

## Notas importantes
- **Login simulado:** la pantalla `/bienvenida` tiene un botón "Comenzar" que no realiza autenticación real. Esto queda marcado con `SEGURIDAD:` y `TODO-FASE2 (SEGURIDAD)`.
- **localStorage no es seguro:** se documenta explícitamente en `docs/SEGURIDAD.md`. En Fase 2 pasará al backend (Supabase) con autorización por pareja (RLS).
- **Colores de categoría:** se aplican con `style={{ backgroundColor }}` (hex desde `src/utils/categorias.js`). Esto evita el problema de clases dinámicas que Tailwind purga en tiempo de compilación. El texto de las cinco categorías pasa contraste AA sobre su fondo; los colores principales sobre `#F7FAFC` no llegan a 3:1 en `viaje`, `cumpleanos` y `otro`, así que el significado no debe depender solo del color.
- **Calendario:** se construye a mano con `date-fns` (locale `es`), ignorando la pequeña duplicación visible en el mockup.
- **Fotos:** las del seed usan URLs remotas (`picsum.photos`). Las que sube la persona se recomprimen en el cliente antes de guardarse como `base64`, y ese canvas es lo que elimina los metadatos EXIF/GPS. En Fase 2 van a un bucket privado de Supabase Storage.
- **Sin smoke test en navegador todavía:** las pruebas cubren el DOM y la lógica, pero falta la comprobación visual en escritorio y móvil. La persona usuaria no puede ejecutar la app, así que sigue pendiente.

## Licencia
Proyecto educativo para desarrollo del prototipo "Juntos".
