# COMPONENTES — Juntos (Fase 1)

Catálogo de componentes con sus props. Se actualiza al terminar cada paso.

---

## UI base (`src/components/ui/`)

### `Logo`
Marca de la aplicación: nombre cursivo "Juntos", corazón de acento y tagline opcional.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `tamano` | `'sm' \| 'md' \| 'lg'` | No | `'md'` | Escala visual del logo. |
| `mostrarTagline` | `boolean` | No | `false` | Muestra "Tus momentos, siempre". |
| `className` | `string` | No | `''` | Clases extra del contenedor. |

```jsx
<Logo tamano="lg" mostrarTagline />
```

### `Boton`
Botón con variantes del acento del mockup.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `children` | `ReactNode` | Sí | — | Contenido. |
| `variante` | `'primario' \| 'secundario' \| 'fantasma'` | No | `'primario'` | Estilo visual. |
| `tamano` | `'sm' \| 'md' \| 'lg'` | No | `'md'` | Alto del botón. |
| `cargando` | `boolean` | No | `false` | Spinner + deshabilitado. |
| `soloIcono` | `boolean` | No | `false` | Cuadra el botón para un icono. |
| `tipo` | `string` | No | `'button'` | Atributo `type`. |
| `disabled` | `boolean` | No | `false` | Deshabilita. |
| `onClick` | `() => void` | No | — | Gestor de clic. |
| `ariaLabel` | `string` | No | — | Texto accesible (solo icono). |
| `className` | `string` | No | `''` | Clases extra. |

```jsx
<Boton variante="primario" onClick={abrirModal}>Agregar evento</Boton>
```

### `Chip`
Etiqueta o filtro de categoría. El color se aplica con `style` leyendo `src/utils/categorias.js` (fuente de verdad de los hex).

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `label` | `string` | No | — | Texto visible (si no se pasa `children`). |
| `color` | `string` | No | — | Color principal (hex). |
| `fondo` | `string` | No | — | Color de fondo (hex). |
| `Icon` | `ComponentType` | No | — | Icono a la izquierda. |
| `seleccionado` | `boolean` | No | `false` | Invierte fondo/texto (activo). |
| `soloPunto` | `boolean` | No | `false` | Solo el punto de color. |
| `conMuestra` | `boolean` | No | `true` | Punto delante del texto. |
| `onClick` | `() => void` | No | — | Convierte en botón seleccionable. |
| `className` | `string` | No | `''` | Clases extra. |
| `children` | `ReactNode` | No | — | Contenido alternativo a `label`. |

```jsx
<Chip label="Cita" color="#7B22CA" fondo="#F1F0FC" />
```

### `Modal`
Diálogo superpuesto accesible (portal, Escape, velo, bloqueo de scroll, foco).

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `abierto` | `boolean` | Sí | — | Visible desde el padre. |
| `onCerrar` | `() => void` | Sí | — | Escape / velo / "X". |
| `titulo` | `string` | Sí | — | Título del diálogo. |
| `descripcion` | `string` | No | — | Texto secundario. |
| `children` | `ReactNode` | Sí | — | Contenido. |
| `pie` | `ReactNode` | No | — | Barra de acciones. |
| `ancho` | `'sm' \| 'md' \| 'lg'` | No | `'md'` | Ancho máximo. |
| `className` | `string` | No | `''` | Clases extra del panel. |

```jsx
<Modal abierto={abierto} onCerrar={cerrar} titulo="Agregar evento" pie={<Boton>Guardar</Boton>}>
  {/* formulario */}
</Modal>
```

#### Foco, y por qué está repartido en dos efectos

El componente cumple cinco cosas de accesibilidad, y dos de ellas usan hooks
distintos a propósito:

- **Anuncio.** El panel se nombra con `aria-labelledby` apuntando al `h2`, no
  con `aria-label`. Con `aria-label` el lector anuncia el texto del atributo y
  el `h2` real se lee como contenido suelto.
- **Foco inicial** (`useLayoutEffect`). Va al panel para que el lector anuncie
  el título, pero **solo si el contenido no ha enfocado ya algo dentro**: el
  formulario pone el foco en su primer campo, y enfocarlo sin mirar se lo
  quitaría.
- **Captura del disparador** (mismo `useLayoutEffect`). Se guarda qué elemento
  tenía el foco para devolvérselo al cerrar. Es un efecto de diseño y no uno
  normal por un motivo concreto: React ejecuta los efectos de abajo arriba, así
  que un efecto normal del `Modal` se aplicaría **después** de que el formulario
  enfocara su primer campo, y se guardaría el input del formulario en lugar del
  botón que abrió el modal. Al cerrar, el foco volvería a un nodo que ya no
  existe y quedaría en `body`.
- **Trampa de foco** (evento `keydown` en `document`). Tab y Mayús+Tab circulan
  dentro del panel. La lista de elementos se recalcula en cada pulsación,
  porque el contenido cambia (un error, un chip, una previsualización) y una
  lista congelada dejaría fuera lo nuevo. Se descartan los `[hidden]` y los
  `aria-hidden`, **no** los `offsetParent`, que además de no existir en un DOM
  sin layout excluiría los radios `sr-only` de las categorías, que sí tienen que
  ser alcanzables con el teclado.
- **Scroll y restauradores** (`useEffect`). El contador de modales abiertos y
  el estilo anterior del `<body>` viven a **nivel de módulo**, no en el
  componente. Si vivieran en la instancia, cerrar el primero de dos modales
  perdería el valor y el `<body>` se quedaría con `overflow: hidden` para
  siempre.

### `PagePlaceholder`
Marcador para páginas aún no implementadas (transitorio en Fase 1).

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `titulo` | `string` | Sí | — | Nombre de la sección. |
| `descripcion` | `string` | Sí | — | Qué hará la pantalla. |
| `paso` | `string` | No | — | Etiqueta del paso que la implementará. |

---

## Layout (`src/components/layout/`)

### `Sidebar`
Barra lateral fija de escritorio. Logo, menú (`MENU_ESCRITORIO`) y perfil de pareja al pie. Todos los `NavLink` llevan `end`.

### `MobileHeader`
Cabecera superior de móvil: logo (enlace a inicio) + acceso a Configuración.

### `BottomNav`
Barra inferior de móvil con 5 destinos (`MENU_MOVIL`), indicador de activo y safe-area de iOS.

### `Layout`
Armazón de la aplicación. Elige sidebar (≥1024px) o header+bottom nav con `useEsEscritorio()`. Aporta el contenedor de scroll y renderiza `<Outlet />`. Sin props.

---

## Páginas (`src/pages/`)
- `Inicio`: banner con foto, saludo, frase del día, contador de recuerdos, "El más próximo" y próximos eventos. Usa `useEventos()`.
- `Calendario`: las tres vistas del calendario, con un conmutador que vive en la URL. Cuadrícula del mes, navegación, leyenda de categorías y próximos eventos. El mes se guarda en `?mes=AAAA-MM`; la semana y el día, en `?vista=semana|dia&fecha=AAAA-MM-DD`. Ver "La vista vive en la URL" más abajo. Abre `EventoFormModal` en alta con la fecha del día resaltado. En escritorio la lista del día vive en un `aside` con `sticky` a la derecha, para que se vea sin tener que desplazarse; en móvil va debajo de la cuadrícula. En la vista de día no se pinta el panel lateral, porque `CalendarioDia` ya lista los eventos.
- `EventoDetalle`: ficha de un evento con foto, categoría, fecha, hora, lugar, descripción y enlace a la galería. Abre la edición y el borrado con confirmación, y vuelve a `?mes=` al terminar. Un id mal formado y un id inexistente dan la misma pantalla de "no encontrado", y en ninguno de los dos casos se muestra el id.
- `Planeador`: lista de ideas de cita con alta, edición, borrado, favoritas y conversión a evento. Los filtros de categoría y de favoritas viven en la URL (`?categoria=…`, `?favoritas=1`), no en estado local, para que el filtro se pueda compartir y el botón "atrás" del navegador funcione. Ver "Componentes de citas" más abajo.
- `Galeria`: mosaico de las fotos de los eventos, agrupado por mes y con un filtro de año. No guarda fotos propias: deriva de `useEventos()` con `extraerFotos()`, así que al borrar un recuerdo su foto desaparece sin borrar nada más. El año vive en la URL (`?anio=AAAA`) y `?evento=<id>` resalta la foto que se abrió desde el detalle. Con cuatro estados distintos: cargando, error con "Reintentar", vacío con salida al planeador, y mosaico. Ver "Componentes de galería" más abajo.
- `Configuracion`: estado de la sesión con su clave, recuentos de eventos e ideas, espacio aproximado ocupado, lista de claves con su versión, "Cerrar sesión" con confirmación y "Restablecer datos" con confirmación. Ver "Configuración" más abajo.
- `Momentos`: marcador de posición.
- `Bienvenida`: fuera del layout, con el botón "Comenzar", que crea la sesión en `juntos:v1:sesion` y entra, e "Iniciar sesión" deshabilitado con el tooltip "Próximamente". Ver "La bienvenida y la sesión" más abajo.

## La vista del calendario vive en la URL

Las tres vistas comparten la página y el conmutador, y cambian de estado con `?` en la dirección:

| Vista | Parámetros | Cuadrícula |
|---|---|---|
| Mes | `?mes=AAAA-MM` | `construirCuadricula` |
| Semana | `?vista=semana&fecha=AAAA-MM-DD` | `construirSemana` |
| Día | `?vista=dia&fecha=AAAA-MM-DD` | `construirDia` |

- **El conmutador son `Link`, no botones.** Con `button` y estado propio, el botón "Atrás" del navegador y un enlace recibido por WhatsApp no funcionarían sin código que los escuche. `aria-current="page"` marca la activa.
- **`fechaDesdeParametro()` normaliza al leer.** Un `?vista=inventada` cae en el mes y un `?fecha=2026-10-99` cae en hoy, en vez de dejar la pantalla vacía sin explicación.
- **Cambiar de vista conserva el día que se estaba mirando.** Al volver al mes se escribe `?mes=` con el mes del día anclado, no el mes en curso: quien estaba en noviembre y vuelve al mes espera ver noviembre. La excepción es el mes en curso, que se deja sin parámetros porque esa es la dirección que se comparte.
- **Elegir un día no escribe en la URL.** Es mirar sus eventos, no moverse: si "Compartir" mandara a otro día, el enlace sería peor que no tenerlo. Moverse con las flechas sí escribe.
- **La selección empieza vacía y el resaltado no.** Señalar el día de hoy al montar haría que la pantalla fuera distinta en cada apertura. El día resaltado sale de `elegirDiaResaltado`: el seleccionado si está en la vista, si no el primer día con eventos, si no el día 1 del mes.
- **`elegirDiaResaltado` y `resaltarCuadricula` viven fuera del componente**, en el propio fichero de la página. Son reglas de la cuadrícula, no estado de React. Dentro del componente, el `useMemo` del resaltado y el que lo pintaba no se podían conservar: uno invalidaba al otro y podían acabar mostrando días distintos.

## La bienvenida y la sesión

`Bienvenida` es la única puerta de entrada, y vive fuera de `<Layout />` para que
se vea como en el mockup: sin sidebar, sin barra inferior. Muestra el logo con su
tagline, la frase "Crea recuerdos, planea nuevas aventuras y sigue escribiendo tu
historia juntos.", "Comenzar" e "Iniciar sesión".

**"Comenzar" crea la sesión.** `crearSesion()` escribe en `juntos:v1:sesion` un
objeto `{ id, creadaEn }`, con el UUID de `utils/ids.js` y la hora del reloj
inyectado, y a continuación navega a `/`. Si la escritura falla, no navega:
entrar sin sesión dejaría a la persona en Inicio y la guarda la devolvería al
instante, con un salto visible que parece un fallo. Se queda en la bienvenida
explicando qué ha pasado.

**"Iniciar sesión" está deshabilitado, no oculto.** El mockup lo enseña. Usa
`aria-disabled="true"` en vez del atributo `disabled`, y no lleva `onClick`:

| Atributo | Qué aporta |
|---|---|
| `aria-disabled="true"` | El lector de pantalla lo anuncia como inactivo |
| `title="Próximamente"` | El tooltip al puntero |
| `aria-describedby` → texto oculto | El motivo, oído con teclado |

Un `disabled` de verdad habría quitado el botón del orden de tabulación: con
teclado no se llegaría a él ni se oiría por qué no está activo.

**No es autenticación.** La clave se puede escribir a mano desde la consola del
navegador, así que la sesión solo evita repetir el primer pantallazo. Ver
`docs/SEGURIDAD.md`.

### Las guardas

`src/App.jsx` declara `ConSesion` y `SinSesion`, y las dos van en sentidos
opuestos:

| Situación | Qué se ve |
|---|---|
| Sin sesión, cualquier ruta de dentro de `Layout` | `/bienvenida` |
| Sin sesión, ruta que no existe | `/bienvenida` (vía el `*` → `/` → la guarda) |
| Con sesión, cualquier ruta de dentro de `Layout` | La ruta pedida |
| Con sesión, `/bienvenida` | `/` |

Se protege el `Layout` entero en vez de cada ruta, para que una pantalla nueva
quede protegida sin acordarse: lo que se puede olvidar es acordarse de protegerla,
no que esté dentro. Y se protege en los dos sentidos, porque con sesión ya creada
"Comenzar" sobrescribiría el identificador de sesión con uno nuevo sin avisar.

La comprobación es síncrona, pero va en un componente y no en un `if` dentro de
`App`: las dos guardas necesitan el mismo dato en el mismo momento, y así se lee
el sentido de las dos en el mismo sitio.

### La sesión en Configuración

La primera sección de `Configuracion` dice si hay sesión, enseña la clave con su
versión y ofrece "Cerrar sesión" con un `alertdialog` propio, que **no** reutiliza
`ConfirmarSalida`: ese componente trae su propio `role`, su propio título y sus
propios botones, y puesto dentro del `Modal` habría dos diálogos anidados con dos
títulos distintos para una sola decisión.

El botón se oculta en vez de quedar deshabilitado cuando no hay sesión: no hay
nada que cerrar.

`useSesion` se suscribe al evento `storage` porque "Cerrar sesión" borra una clave
de `localStorage` sin recargar la página. El evento `storage` no lo dispara la
propia pestaña, así que sin suscripción el indicador seguiría diciendo que hay
sesión y ofrecería cerrar una sesión que ya no existe.

Cerrar sesión borra **solo** la clave de sesión: los datos y las fotos se quedan.
Es lo contrario de "Restablecer datos", que borra los datos y conserva la sesión.

## Configuración

`Configuracion` era un marcador de posición y ahora muestra lo que la app guarda de verdad:

- **Recuentos de eventos e ideas**, leídos de los services, no contados a mano sobre lo que hay pintado.
- **Espacio aproximado**, con `tamanoAproximado()`, y la lista de claves con su versión. Las dos cosas salen de `listarClaves()`, que es lo único que hay: el navegador no expone el consumo real.
- **La privacidad, por escrito.** Dice que los datos viven en este navegador y que no hay nube. Es la misma decisión de la pantalla de bienvenida, escrita donde se va a mirar cuando alguien se pregunta qué guarda la app.
- **"Restablecer datos" pide confirmación** y avisa de que también borra las fotos. La confirmación es `role="alertdialog"`, y el foco inicial lo pone el `Modal` en el panel, no en un botón: el destructivo queda a un Tab de distancia. Detalle de qué se pierde en contenido del modal, no con `ConfirmarSalida`: ese componente trae su propio `alertdialog`, su propio título y sus propios botones, y puesto aquí habría dejado dos diálogos anidados con dos títulos distintos y cuatro botones para una sola decisión.
- **El resultado se anuncia** con `role="status"`, para que quien usa lector de pantalla sepa si funcionó sin tener que buscar el texto.

`resetDatos()` conserva la clave de sesión. Ver "Restablecer datos no es cerrar la sesión" en `docs/ARQUITECTURA.md`.

## Componentes de galería (`src/components/galeria/`)
### `MosaicoGaleria`
Pinta los grupos de mes ya formados, con un `h2` por mes y un `ul role="list"` de fotos debajo. No sabe de dónde salen las fotos ni decide el orden: recibe los grupos.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `fotos` | `FotoGaleria[]` | Sí | — | Grupos de mes, del más reciente al más antiguo. |
| `eventoResaltado` | `string \| null` | No | `null` | Id del evento abierto desde `?evento=`. |

La rejilla va de 2 columnas en móvil a 4 en escritorio. El `ul` lleva `role="list"` explícito porque Safari deja de anunciar los roles de lista cuando el contenedor es un `div` con `display: grid`.

### `FotoGaleria`
Una celda del mosaico: la foto, su pie y el enlace a su recuerdo.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `foto` | `FotoGaleria` | Sí | — | Foto con su evento de contexto. |
| `resaltada` | `boolean` | No | `false` | Marca la foto abierta desde el detalle. |
| `ancho` | `string` | No | `'w-full'` | Clase de Tailwind con el ancho. |

Tres decisiones que no son obvias:

- **La imagen es decorativa** (`alt=""`), porque el enlace ya lleva `aria-label` con el título y la fecha. Con las dos, un lector de pantalla lo repetiría dos veces, y dos fotos del mismo suenan distintas al recorrer la galería.
- **Debajo hay un degradado de la categoría.** La foto del seed es una URL externa y puede fallar sin conexión: si el `onError` la apaga, queda el degradado con su icono, no un hueco roto. El degradado sale de `degradadoCategoriaEvento` de `categorias.js`.
- **El pie va sobre la foto, no debajo.** En un mosaico lo que importa es reconocer la imagen, y taparla con un bloque de texto taparía el recuerdo entero. El degradado del pie es lo que permite leerlo sobre cualquier foto.


## Componentes de calendario (`src/components/calendar/`)
### `CalendarioMes`
Pinta la cuadrícula de un mes: encabezado con título, flechas y "Hoy", nombres de los días, y las celdas. No calcula fechas: recibe la cuadrícula ya hecha.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `cuadricula` | `Cuadricula` | Sí | — | Resultado de `construirCuadricula` + `asignarEventos`. |
| `compacto` | `boolean` | No | `false` | Variante de móvil: celdas bajas con puntos de color. |
| `onSelectDia` | `(fechaISO) => void` | Sí | — | Elige un día. |
| `onVerRestoDelDia` | `(fechaISO) => void` | No | — | Activa el "+N más". Si se omite, no aparece. |
| `onMoverMes` | `(delta) => void` | Sí | — | Flechas. `delta` es `-1` o `1`. |
| `onHoy` | `() => void` | Sí | — | Vuelve al mes en curso. |
| `mesActual` | `boolean` | No | `false` | Desactiva "Hoy" si ya se está en el mes actual. |

La rejilla usa `role="grid"` con `role="row"` por semana. El encabezado de los nombres de día lleva `aria-hidden`, porque si no cada día se anunciaría dos veces ("lunes", y luego "lunes 1 de septiembre…").

### `CeldaDia`
Un día. Envuelve el `button` del día y, superpuesto en la parte baja, el `button` de "+N más".

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `celda` | `Celda` | Sí | — | Día con sus eventos ya asignados. |
| `compacto` | `boolean` | No | `false` | Móvil: sin texto, solo puntos. |
| `onSelect` | `() => void` | Sí | — | Selecciona el día. |
| `onVerResto` | `() => void` | No | — | Abre el resto de eventos del día. |

**Por qué el "+N más" es hermano y no hijo del `button` del día:** no se puede anidar un `button` dentro de otro `button`; es HTML inválido, el interno no es alcanzable con el teclado y el lector de pantalla lo anuncia mal. Por eso el envoltorio es un `div` con `relative` y el "+N más" va posicionado encima. El botón del día deja hueco abajo con `pb` para que no se solapen.

### `EventosDelDia`
Lista completa de los eventos de un día, con franja de categoría, hora, lugar y enlace al detalle. En móvil es la única forma de verlos, porque la celda solo muestra puntos de color. También es donde aterriza el "+N más" en escritorio, y es la vista entera de `CalendarioDia`.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `eventos` | `Evento[]` | Sí | — | Eventos de ese día. |
| `fechaISO` | `string` | Sí | — | Fecha `YYYY-MM-DD` del encabezado. |
| `onAgregar` | `() => void` | No | — | Muestra "Agregar" para ese día. |
| `compacto` | `boolean` | No | `false` | Ajusta el texto del botón. |

### `CalendarioSemana`
Siete columnas, una por día, con los eventos de cada día debajo de su fecha. No calcula fechas: recibe la semana ya hecha por `construirSemana` + `asignarEventos`.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `cuadricula` | `Cuadricula` | Sí | — | Semana con los eventos ya asignados. |
| `onSelectDia` | `(fechaISO) => void` | Sí | — | Elige un día. |
| `onMoverSemana` | `(delta) => void` | Sí | — | Flechas. `delta` es `-1` o `1`. |
| `onHoy` | `() => void` | Sí | — | Vuelve a la semana del día en curso. |
| `hoyEnSemana` | `boolean` | No | `false` | Desactiva "Hoy" si ya se está en ella. |

Tres decisiones que no son obvias:

- **No reutiliza `CeldaDia`.** La celda del mes está hecha para una casilla pequeña: número arriba y dos franjas con la hora. En la vista semanal cada día tiene una columna entera, así que cabe el título del evento, y el texto es justo lo que hace útil la vista.
- **La columna no es una acción; el botón va en la cabecera.** El `div` de la columna lleva `role="gridcell"` porque contiene un grupo de enlaces, y el `button` que elige el día está en la cabecera, que es lo que se pulsa para ver ese día entero.
- **El nombre del día va en `aria-hidden`, con el nombre largo en `title`.** El `aria-label` del botón ya dice la fecha completa y cuántos eventos hay; repetir el nombre haría que un lector de pantalla oyera "miércoles" y después "14 de octubre, 1 evento". En su lugar el `title` aparece al pasar el ratón, y en móvil, donde solo cabe la inicial, queda la abreviatura.

### `CalendarioDia`
Un día con su navegación por días. Reutiliza `EventosDelDia`, así que no duplica la lista de eventos en un componente propio.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `cuadricula` | `Cuadricula` | Sí | — | Día con los eventos ya asignados. |
| `onMoverDia` | `(delta) => void` | Sí | — | Flechas. `delta` es `-1` o `1`. |
| `onHoy` | `() => void` | Sí | — | Vuelve al día en curso. |
| `esHoy` | `boolean` | No | `false` | Desactiva "Hoy" si el día visible es el de hoy. |

- **`EventosDelDia` va con `compacto` desactivado.** En el calendario mensual se usaba la variante grande porque el panel salía bajo una rejilla ya apretada; aquí tiene todo el ancho.
- **`capitalize` va en la clase y no en el texto.** La cadena de `construirDia` es minúscula ("miércoles 14 de octubre"), como manda el español, y la mayúscula inicial la pone el estilo.
- **No lleva panel lateral en la página.** Los eventos ya están dentro, y repetirlos sería ver lo mismo dos veces en la misma pantalla.

## Componentes de eventos (`src/components/eventos/`)
### `ProximosEventos`
Lista compacta de próximos eventos: franja con el color de la categoría, título, fecha, hora, etiqueta relativa y enlace al detalle.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `eventos` | `Evento[]` | Sí | — | Eventos ya filtrados y ordenados. |
| `titulo` | `string` | No | `'Próximos eventos'` | Encabezado. |
| `limite` | `number` | No | `5` | Máximo de eventos. |
| `mostrarVacio` | `boolean` | No | `true` | Muestra texto si no hay eventos. |

### `SelectorFoto`
Input de archivo real (no un `div` con `onClick`) con previsualización, borrado y
recompresión en el cliente.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `valor` | `string \| null` | Sí | — | Data URL guardada, o `null` si no hay. |
| `onChange` | `(dataUrl \| null) => void` | Sí | — | Recibe la nueva foto, o **`null`** al quitarla. |
| `error` | `string` | No | `''` | Error de validación del formulario padre. |

- El input es `<input type="file" accept="image/jpeg,image/png,image/webp">`
  oculto tras una etiqueta. Un `div` con `onClick` no es alcanzable con el
  teclado ni lo anuncia un lector de pantalla.
- Acepta y rechaza en dos fases: primero el tipo y el tamaño declarados, y
  después los **magic bytes** reales del archivo. Una imagen con extensión `.jpg`
  que en realidad es un SVG pasa la primera fase y se rechaza en la segunda.
- Al elegir archivo se **recomprime** antes de guardar (máx. 1200 px, WebP o
  JPEG ~0.8). El canvas no copia los metadatos originales, así que esa
  recompresión es lo que elimina EXIF y GPS.
- Mientras procesa, el input se deshabilita y se avisa con `aria-live`.

### `EventoFormModal`
Un único formulario para alta y edición, envuelto en `Modal`.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `abierto` | `boolean` | Sí | — | Visible desde el padre. |
| `onCerrar` | `() => void` | Sí | — | Se llama al confirmar el cierre. |
| `onGuardar` | `(datos) => Promise<unknown>` | Sí | — | El padre guarda y cierra. |
| `evento` | `Evento \| null` | No | `null` | Si viene, es edición. |
| `fechaInicial` | `string` | No | — | Fecha a precargar en alta (`YYYY-MM-DD`). |
| `valoresIniciales` | `object` | No | `null` | Campos ya rellenos al abrir. Se usa al convertir una idea en evento, y la `fecha` llega vacía a propósito: la idea no tiene día y poner el de hoy sería inventarlo. Una fecha vacía no se sustituye por la de hoy, porque `fechaInicial` solo se aplica cuando no hay nada escrito. |
| `guardando` | `boolean` | No | `false` | Bloquea el envío y el botón. |

Cuatro decisiones que no son obvias:

1. **Alta y edición en un componente, no dos.** La validación, los límites, los
   chips y el selector de foto son los mismos; duplicarlos garantiza que uno se
   quede desactualizado.
2. **El contenido no se desmonta al preguntar "¿salir sin guardar?".** Se
   oculta con `hidden` y el aviso se muestra encima. Si se sustituyera, quien
   cancelara volvería a un formulario recién montado y perdería lo escrito: el
   aviso existiría para proteger ese trabajo y lo estaría destruyendo.
3. **"¿Hay cambios?" se calcula comparando con los valores iniciales**, no con
   un flag "tocado". Escribir y borrar devuelve el formulario a su estado
   original, y preguntar en ese caso enseña a confirmar sin leer.
4. **Los ids de los campos son constantes de módulo.** No dependen de la
   instancia (salen de `CAMPOS`) y solo hay un formulario de evento en
   pantalla, así que `useId` o un `useMemo` no aportarían nada.

El foco va al primer campo al abrir, y a un error de campo o al aviso general al
enviar con datos inválidos.

---

## Componentes de citas (`src/components/citas/`)

### `ImagenIdea`
Foto de la tarjeta, con degradado de reserva cuando no hay imagen. El degradado se aplica en el contenedor, no sobre la foto: si la imagen carga, el color queda detrás y no se ve el hueco mientras descarga.

### `TarjetaIdea`
Una idea en la lista.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `idea` | `IdeaCita` | Sí | — | La idea a pintar. |
| `editable` | `boolean` | No | `false` | Si es `true`, muestra editar y borrar. La página lo decide con `esIdeaEditable`, no la tarjeta, para que el componente no conozca `ORIGEN`. |
| `alEditar` | `(idea) => void` | No | — | Pide la edición. |
| `alBorrar` | `(idea) => void` | No | — | Pide el borrado; no borra, la página confirma. |
| `alAlternarFavorita` | `(idea) => void` | Sí | — | Marca o desmarca. |

Las ideas del seed no llevan botones de editar ni de borrar: se reconocen por `origen`, y no por su texto ni sus ids, que cambian con el seed.

### `FiltrosIdeas`
Chips de categoría y el interruptor de favoritas. **No guarda estado**: recibe los valores y llama a los callbacks, y quien lo usa es `Planeador`, que los refleja en la URL.

### `IdeaFormModal`
Alta y edición de ideas. Mismo enfoque que `EventoFormModal`: un solo componente, validación por campo con `validarIdea`, foco al primer error, aviso al cerrar con cambios sin guardar y `SelectorFoto` reutilizado.

| Prop | Tipo | Obligatoria | Por defecto | Descripción |
|---|---|---|---|---|
| `abierto` | `boolean` | Sí | — | Visible desde el padre. |
| `onCerrar` | `() => void` | Sí | — | Se llama al confirmar el cierre. |
| `onGuardar` | `(datos) => Promise<unknown>` | Sí | — | El padre guarda y cierra. |
| `idea` | `IdeaCita \| null` | No | `null` | Si viene, es edición. |
| `guardando` | `boolean` | No | `false` | Bloquea el envío y el botón. |

Un detalle de accesibilidad: **los errores de campo no llevan `role="alert"`**. Se anuncian con `aria-invalid` y `aria-describedby`, que es lo que ata el mensaje a su control. Un `role="alert"` por cada tecla escrita sería contraproducente, porque el lector lo leería en voz alta mientras se corrige.

---

## Hooks

### `useEventos()`
Estado y operaciones de los eventos.

| Campo | Tipo | Descripción |
|---|---|---|
| `eventos` | `Evento[]` | Ordenados por fecha ascendente. |
| `eventosPorFecha` | `Map<string, Evento[]>` | Índice fecha → eventos, para el calendario. |
| `cargando` | `boolean` | `true` mientras lee el almacenamiento. |
| `guardando` | `boolean` | `true` mientras hay una escritura en curso. |
| `error` | `string \| null` | Mensaje listo para mostrar, ya en español. |
| `obtenerEvento(id)` | `(id) => Evento \| null` | Busca en la lista ya cargada, sin ir al store. |
| `crear(datos)` | `(datos) => Promise<Evento \| null>` | Crea y añade a la lista local. |
| `actualizar(id, datos)` | `(id, datos) => Promise<Evento \| null>` | Modifica y sustituye en la lista local. |
| `eliminar(id)` | `(id) => Promise<boolean>` | Borra y quita de la lista local. |
| `recargar()` | `() => Promise<void>` | Vuelve a leer del almacenamiento. |
| `restablecer()` | `() => Promise<Evento[]>` | Borra todo y vuelve a sembrar el seed. |

```jsx
const { eventos, cargando, error, crear, actualizar, eliminar } = useEventos();
```

### `useCitas()`
Igual que `useEventos`, más: `ideasFiltradas`, `favoritas`, `filtro`, `setFiltro`, `opcionesFiltro` y `alternarFavorita(id)`.

```jsx
const { ideasFiltradas, filtro, setFiltro, alternarFavorita } = useCitas();
```

---

## Services (`src/services/`)

### `eventosService.js`
| Función | Devuelve | Errores |
|---|---|---|
| `getEventos()` | `Promise<Evento[]>` | `ErrorServicio` |
| `getEventoById(id)` | `Promise<Evento \| null>` | `ErrorServicio` |
| `crearEvento(datos)` | `Promise<Evento>` | `ErrorValidacion`, `ErrorServicio`, `ErrorCuotaAlmacenamiento` |
| `actualizarEvento(id, datos)` | `Promise<Evento>` | `ErrorValidacion`, `ErrorServicio` |
| `eliminarEvento(id)` | `Promise<boolean>` | `ErrorServicio` |
| `resetEventos()` | `Promise<Evento[]>` | `ErrorServicio` |

### `citasService.js`
| Función | Devuelve | Errores |
|---|---|---|
| `getIdeasCitas()` | `Promise<IdeaCita[]>` | `ErrorServicio`, `ErrorCuotaAlmacenamiento` |
| `getIdeaById(id)` | `Promise<IdeaCita \| null>` | `ErrorServicio` |
| `crearIdea(datos)` | `Promise<IdeaCita>` | `ErrorValidacion`, `ErrorServicio` |
| `actualizarIdea(id, datos)` | `Promise<IdeaCita>` | `ErrorValidacion`, `ErrorServicio` |
| `toggleFavorita(id)` | `Promise<IdeaCita \| null>` | `ErrorServicio` |
| `eliminarIdea(id)` | `Promise<boolean>` | `ErrorServicio` |
| `convertirIdeaEnEvento(id, {fecha, hora, lugar})` | `Promise<Evento>` | `ErrorValidacion`, `ErrorServicio` |
| `resetCitas()` | `Promise<IdeaCita[]>` | `ErrorServicio` |

`getIdeasCitas()` propaga `ErrorCuotaAlmacenamiento` **sin envolver**. Ocurre al
guardar el seed la primera vez, y si se envolviera en `ErrorServicio` la interfaz
mostraría "no pudimos cargar las ideas", que no dice nada accionable, en lugar
del aviso de liberar espacio que sí lo dice. Cualquier otro fallo sí se envuelve,
para que la interfaz tenga un único tipo de error con el que trabajar.

### `storage.js`
Abstracción sobre `localStorage` con claves versionadas `juntos:v3:{coleccion}`. Exporta `VERSION_DATOS`, `VERSION_SESION`, `COLECCIONES`, `claveDe`, `claveDeSesion`, `leer`, `guardar`, `borrar`, `resetDatos`, `limpiarVersionesAnteriores`, `listarClaves`, `tamanoAproximado`, `storageDisponible`, `esCuotaAgotada`, y la clase `ErrorCuotaAlmacenamiento`.

**Dos versiones, no una.** `VERSION_DATOS` (3) versiona la forma de los modelos; `VERSION_SESION` (1) versiona la sesión, y no sigue a la anterior. Si compartieran número, subir la versión de los datos cerraría la sesión de todo el mundo sin motivo, porque la sesión es el único dato que no se puede regenerar: el seed se vuelve a sembrar solo, una sesión no. `claveDeSesion()` no pasa por `claveDe()` a propósito, para que el desacople sea explícito y no dependa de que quien llame se acuerde. `limpiarVersionesAnteriores()` conserva siempre su clave. Ver `docs/SEGURIDAD.md`.

`leer()` devuelve `null` — no lanza — cuando no hay datos, cuando el JSON está
corrupto o cuando el almacén no está disponible. La respuesta a los tres casos es
la misma en el service: sembrar. Pero un fallo al **escribir** sí propaga, y si
es de cuota llega intacto como `ErrorCuotaAlmacenamiento`.

`tamanoAproximado()` envuelve cada `getItem` en su propio `try/catch`. Se llama
al abrir Configuración y solo produce un número cosmético; que el almacén se
caiga a mitad de la cuenta no puede dejar la pantalla en blanco.

---

## Constantes y utilidades

### `src/utils/categorias.js`
Fuente única de las categorías. Ningún otro archivo escribe un slug.

- `CATEGORIAS_EVENTO`: `cita`, `aniversario`, `viaje`, `cumpleanos`, `otro` con `label/hex/bg/fg/Icon`.
- `CATEGORIAS_IDEA`: `en-casa`, `afuera`, `aventura`, `relax`.
- `obtenerCategoria(clave)`, `obtenerCategoriaIdea(clave)`: con fallback a la
  categoría de reserva.
- `ORDEN_CATEGORIAS_EVENTO`, `ORDEN_CATEGORIAS_IDEA`: orden de los chips,
  derivados de `Object.keys()`.
- `CATEGORIA`, `CATEGORIA_IDEA`: constantes con nombre, derivadas del catálogo.
- `PATRON_CATEGORIA`, `esCategoriaValida()`, `esCategoriaIdeaValida()`.
- `degradadoCategoriaEvento(clave)`, `degradadoCategoriaIdea(clave)`: el
  degradado de reserva cuando no hay foto o la foto no carga. Devuelven un
  `style` con `backgroundImage`, no una clase, por el mismo motivo que los
  colores: una clase construida en tiempo de ejecución no llega al CSS final.
  **Están aquí y no en `planeador.js`:** la galería necesita el de los eventos y
  mantener los dos habría sido la misma interpolación en dos sitios.

**Las claves son slugs, las etiquetas no.** La clave va al almacén y a la URL, y
por eso no lleva tildes ni espacios; la etiqueta visible sí los lleva. Un cambio
de slug exige migración de datos y del enum en Supabase en el mismo
despliegue: subir `VERSION_DATOS` no migra datos reales.

`obtenerCategoria()` busca con `Object.hasOwn`, no con un acceso directo. El
catálogo es un objeto literal y por tanto hereda de `Object.prototype`: con
`CATEGORIAS_EVENTO[clave] ?? reserva`, un valor guardado a mano como `"toString"`
devolvería la función heredada en lugar de la categoría de reserva. La búsqueda
comprueba pertenencia propia.

### `src/utils/imagen.js`
Todo el procesamiento de fotos, en un solo sitio y sin React.

| Export | Devuelve | Para qué |
|---|---|---|
| `calcularDimensiones(ancho, alto, maximo?)` | `{ancho, alto}` | Reduce a 1200 px del lado mayor sin deformar. |
| `detectarTipoPorBytes(buffer)` | `string \| null` | Lee los primeros bytes y decide el formato real. |
| `validarBytesDeArchivo(file)` | `Promise<{valido, error, tipoMime}>` | Segunda fase: el contenido real del archivo. |
| `validarArchivoFoto({type, size, name})` | `{valido, error}` | Primera fase: lo que el navegador declara. |
| `comprimirImagen(file, opciones?)` | `Promise<{ok, dataUrl, ancho, alto, bytes, tipoMime, error}>` | Reescala y recomprime, eliminando metadatos. |
| `estimarBytesGuardados(dataUrl, original)` | `{ahorro, porcentaje}` | Cuánto se ha ganado en la cuota. |
| `TIPOS_ACEPTADOS`, `FORMATOS_SALIDA`, `TAMANO_MAXIMO_BYTES`, `FIRMAS` | — | Constantes compartidas. |

La validación va en dos fases a propósito: el tipo y el tamaño que declara el
navegador primero (rápido, evita leer el archivo), y después los **magic bytes**
reales. Es lo que hace que un SVG renombrado a `.jpg` se rechace.

El relleno de blanco ocurre **solo al exportar a JPEG**, justo antes de esa
exportación, no antes de dibujar. Rellenando antes, también se perdía la
transparencia al exportar a WebP, que sí la admite y es el primer formato que se
intenta.

### `src/utils/validaciones.js`
- `LIMITES`, `PATRONES`, `TIPOS_IMAGEN_PERMITIDOS`, `TAMANO_MAXIMO_IMAGEN_BYTES`.
- `ErrorValidacion` (con `erroresPorCampo`), `limpiarTexto`, `normalizarFecha`, `esFechaValida`, `validarEvento`, `validarIdea`, `esIdValido`.
- `validarArchivoFoto` y las constantes de imagen se **reexportan** desde aquí
  para no romper a quien ya las importaba de este módulo. La implementación vive
  en `imagen.js`.

`limpiarTexto()` solo acepta cadenas. Con un `String(valor)` genérico, un objeto
acaba guardado como `"[object Object]"`; un valor que no sea texto se trata como
campo vacío, que es lo que acabaría haciendo la validación de obligatoriedad.

`validarIdea()` no usa `Boolean(entrada.favorita)`: la cadena `"false"` es
truthy, así que un `favorita: "false"` acababa marcando la idea como favorita. Se
acepta un booleano real o el valor que devuelve un `<input type="checkbox">`.

```jsx
try {
  await crearEvento(datos);
} catch (e) {
  if (e instanceof ErrorValidacion) setErrores(e.erroresPorCampo);
}
```

### `src/utils/calendario.js`
Todo el cálculo de la cuadrícula, fuera de React y por tanto testeable sin DOM.

| Export | Devuelve | Para qué |
|---|---|---|
| `construirCuadricula(mes, fechaHoy?)` | `Cuadricula` | Las semanas de un mes, de 4 a 6 filas. Función pura. |
| `construirSemana(fecha, fechaHoy?)` | `Cuadricula` | Los 7 días de la semana que contiene esa fecha, de lunes a domingo. |
| `construirDia(fecha, fechaHoy?)` | `Cuadricula` | Un solo día, como cuadrícula de una celda para no duplicar el pintado. |
| `asignarEventos(cuadricula, indice, fechaISO?)` | `Cuadricula` | Pone los eventos en sus celdas y marca el día elegido. |
| `etiquetaCelda(celda)` | `string` | `"14 de octubre, 3 eventos"`, con singular y plural. |
| `eventosDe(cuadricula, fechaISO)` | `Evento[]` | Eventos de un día, para el panel de móvil. |
| `mesDesdeParametro(valor, porDefecto?)` | `Date` | Interpreta `?mes=2026-10` sin `new Date(string)`. |
| `mesAParametro(mes)` | `string` | Serializa a `AAAA-MM`. |
| `fechaDesdeParametro(valor, porDefecto?)` | `Date` | Interpreta `?fecha=2026-10-14`, con vuelta a hoy si no es válida. |
| `fechaAParametro(fecha)` | `string` | Serializa a `AAAA-MM-DD`. |
| `vistaDesdeParametro(valor, porDefecto?)` | `string` | Interpreta `?vista=semana`, con vuelta a `mes` si no es válida. |
| `moverMesCalendario(mes, delta)` | `Date` | Avanza o retrocede meses. |
| `moverSemanaCalendario(fecha, delta)` | `Date` | Avanza o retrocede una semana, desde el lunes de la visible. |
| `moverDiaCalendario(fecha, delta)` | `Date` | Avanza o retrocede un día. |
| `mesDesde(fecha)` | `Date` | Normaliza al día 1 del mes. |
| `aFechaLocal(fechaISO)` | `Date` | Fecha local desde `AAAA-MM-DD`, sin el cambio de día que hace `parseISO` con la zona horaria. |
| `VISTA_MES` / `VISTA_SEMANA` / `VISTA_DIA` | `string` | Las tres claves de vista. |
| `VISTAS` | `string[]` | Las tres, en el orden en que las pinta el conmutador. |
| `ETIQUETAS_VISTA` | `Record<string,string>` | Texto visible de cada una: "Mes", "Semana", "Día". |
| `INICIO_SEMANA` | `1` | Constante: la semana empieza en lunes. |
| `MAX_EVENTOS_CELDA` | `2` | Eventos visibles por celda antes de colapsar. |
| `MAX_EVENTOS_MOVIL` | `4` | Puntos de color por celda en móvil. |
| `DIAS_ENCABEZADO` / `DIAS_ENCABEZADO_CORTOS` | `string[]` | Nombres de día, lunes primero. |

```jsx
const cuadricula = useMemo(
  () => asignarEventos(construirCuadricula(mes), eventosPorFecha, fechaSeleccionada),
  [mes, eventosPorFecha, fechaSeleccionada],
);
```

**Por qué la cuadrícula tiene 4, 5 o 6 filas y no siempre 6:** se extiende solo hasta completar la última semana. Fevereiro de 2027 (empieza en lunes, 28 días) ocupa exactamente 4 filas; agosto de 2026 (empieza en sábado) ocupa 6. Fijar 6 siempre dejaría dos semanas vacías en la mitad de los meses. El alto de la rejilla cambia al navegar, pero ese salto cae por debajo del pliegue en móvil.

**Por qué la semana y el día se anclan a una fecha y no a un mes:** una semana atraviesa dos meses a menudo, así que `?mes=` no puede representar "la semana del 28 de diciembre", que va del 28 al 3 de enero y solo pisa dos días de enero. `construirSemana` devuelve los 7 días reales del lunes al domingo, crucen el año que crucen, y `CalendarioSemana` busca cada columna por su `fechaISO` en vez de confiar en el orden del array: si el orden de la cuadrícula cambiara, las columnas se mezclarían con las cabeceras.

### `src/utils/fechas.js`
`LOCALE`, `DIAS_SEMANA`, `DIAS_SEMANA_LARGOS`, `aFecha`, `formatearFecha`, `formatearHora`, `hoyISO`, `diaDelMes`, `esDelMesVisible`, `eventosOrdenados`, `eventosProximos`, `agruparPorFecha`, `agruparPorMes`, `etiquetaDeMes`, `etiquetaRelativa`, `esHoy`, `estaPasada`, `diasHasta`, `estaEnRango`, `getDay`. Todas leen "hoy" de `src/utils/reloj.js`, no del reloj del sistema.

### `src/utils/reloj.js`
El módulo que responde "¿qué día es hoy?". Es el único sitio del proyecto que mira el reloj del sistema para saber la fecha de ahora.

| Export | Devuelve | Para qué |
|---|---|---|
| `ahora()` | `Date` | La fecha actual, o la fijada con `fijarAhora`. |
| `fijarAhora(fecha)` | `void` | Fija la fecha para las pruebas. Acepta `Date` o `AAAA-MM-DD`. |
| `restablecerAhora()` | `void` | Vuelve al reloj real. |
| `relojFijado()` | `boolean` | `true` si hay una fecha fijada. |

- **`fechas.js` y `seed.js` leen de aquí.** Así la suite puede correr "como si fuera" el 28 de febrero de 2027 sin cambiar la firma de ninguna función de producción: `node test-datos.mjs 2027-02-28`.
- **No importa de `fechas.js`, al revés de lo que se haría por costumbre.** `fechas.js` le pregunta por "hoy"; si `reloj.js` importara su parser, la evaluación de los dos módulos quedaría suspendida entre sí y el orden de resolución del grafo decidiría si `ahora()` existe cuando se la llama. El parser se repite aquí con las mismas dos funciones de `date-fns`.
- **`aFechaLocal()` vive en `calendario.js`, no aquí**, porque construye fechas de cuadrícula, no lee el reloj.

### `src/utils/galeria.js`
Derivar la galería a partir de los eventos. Todo es pura: recibe eventos y devuelve datos, sin React ni acceso al almacén, por eso se prueba sin montar nada.

- `extraerFotos(eventos)`: deja solo los eventos con foto utilizable y los
  ordena de más reciente a más antigua. Descarta `foto: null`, cadena vacía y
  eventos sin `id` o sin `fecha`, que no se podrían enlazar ni agrupar.
- `agruparFotosPorMes(fotos)`: envuelve a `agruparPorMes` de `fechas.js` en vez
  de reimplementar el agrupado, para que el encabezado del mes se escriba en un
  solo sitio.
- `aniosConFotos(fotos)`, `filtrarPorAnio(fotos, anio)`, `anioValido(valor)`,
  `textoRecuento(fotos)`.

**El orden no es el del calendario.** `eventosOrdenados` pone lo próximo arriba;
la galería pone lo último que pasó primero, porque se recorre como un álbum. A
igual de día manda la hora, y el evento sin hora va al final: ocupa el día
entero y no tiene una hora propia con la que ordenar.

`anioValido()` normaliza al leer el parámetro de la URL, no al escribirlo: un
`?anio=20` se trata como "sin filtro" en lugar de dejar el mosaico vacío sin
explicación, que es la peor forma de fallar.

### `src/utils/ids.js`
`nuevoId()` → UUID v4 con `crypto.randomUUID()`.

### `src/constants/nav.js`
`RUTAS`, `MENU_ESCRITORIO`, `MENU_MOVIL`, `PERFIL_PAREJA`, `MARCA`.

### `src/hooks/useMediaQuery.js`
`useMediaQuery(query)`, `useEsEscritorio()`, `BREAKPOINT_ESCRITORIO` (implementado con `useSyncExternalStore`).

### `src/data/seed.js`
`crearEventosSeed()`, `crearIdeasSeed()`, `fotoPlaceholder(semilla, ancho, alto)`, `fraseDelDia()`, `IDS_SEED`, `IDS_SEED_IDEAS`, `FOTO_BANNER`, `FRASES`.
