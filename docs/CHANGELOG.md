# CHANGELOG — Juntos (Fase 1)

Todas las novedades de esta fase. Las secciones se rellenan **al terminar cada paso**, junto con el código.

---

## Paso g — Sesión, guardas de ruta y vistas de semana y día

### Añadido
- **`src/utils/reloj.js`**: reloj de la aplicación. `ahora()`, `fijarAhora()`, `restablecerAhora()` y `relojFijado()`. Es el único punto por el que se pregunta qué día es hoy.
- **`src/services/sesion.js`**: `leerSesion()`, `haySesion()`, `crearSesion()`, `cerrarSesion()` e `informacionSesion()`. Guarda `juntos:v1:sesion` con `{ id, creadaEn }`, con su versión propia y separada de la de los datos.
- **`src/hooks/useSesion.js`**: estado de la sesión para la interfaz, suscrito al evento `storage` para que el indicador cambie cuando otra pestaña cierra sesión.
- **Guardas de ruta en `src/App.jsx`**: `ConSesion` para todo lo de dentro de `<Layout />` y `SinSesion` para `/bienvenida`.
- **Vistas de Semana y Día** en `src/components/calendar/`: `CalendarioSemana` y `CalendarioDia`. La de día reutiliza `EventosDelDia`, el mismo componente que el panel lateral, para que no puedan desincronizarse.
- **Funciones puras de navegación** en `src/utils/calendario.js`: `construirSemana`, `construirDia`, `moverDiaCalendario`, `moverSemanaCalendario`, `vistaDesdeParametro`, `fechaDesdeParametro` y `fechaAParametro`, más las constantes `VISTA_MES`, `VISTA_SEMANA`, `VISTA_DIA`, `VISTAS` y `ETIQUETAS_VISTA`.
- **Pantalla `Configuracion` real**, antes un marcador de posición. Estado de la sesión con su clave, recuentos de eventos e ideas, espacio aproximado ocupado, lista de claves con su versión, "Cerrar sesión" y "Restablecer datos", cada uno con su confirmación.
- **Funciones de clave suelta en `storage.js`**: `leerClave()`, `escribirClave()` y `borrarClave()`. Las de colección asumen un array de `COLECCIONES`, y la sesión es un objeto con versión propia.
- **Scripts de fecha simulada**: `npm run test:octubre`, `npm run test:febrero` y `npm run test:diciembre`. La suite acepta además una fecha por argumento: `node test-datos.mjs 2026-10-02`.
- **`docs/VERIFICACION_MANUAL.md`**: lo que la suite no puede comprobar, en casillas. Fidelidad con el mockup, ancho de la rejilla de la semana, scroll horizontal, EXIF y GPS, `dvh` con el teclado abierto, contraste y el flujo de bienvenida. Estaba en el informe y en el chat, que es donde se pierde.

### Cambiado
- **La vista vive en la URL**: `?vista=semana|dia&fecha=YYYY-MM-DD` para las dos nuevas, y `?mes=YYYY-MM` para la mensual. El conmutador son `Link`, no botones, para que "Atrás" y un enlace recibido por WhatsApp funcionen sin código que los escuche.
- **`mesEnCurso` se lee del reloj**, no de `new Date()`, para que la página respete la fecha simulada de la suite.
- **`resetDatos()` conserva la sesión.** Antes borraba todas las claves con el prefijo, incluida `juntos:v1:sesion`.
- **`fraseDelDia()` usa la fecha local** (`ahora().getDate()`) en vez de la de UTC, que podía dar el día siguiente en un huso horario negativo.
- **`Bienvenida` crea la sesión.** Antes "Comenzar" solo navegaba. "Iniciar sesión" pasa a estar deshabilitado con el tooltip "Próximamente", con `aria-disabled` en vez de `disabled` para que siga siendo alcanzable con teclado y se oiga el motivo.

### Decisiones
- **La sesión no se regenera; los datos sí.** Restablecer datos y perder la sesión son dos cosas distintas, y la sesión es el único dato que la app no puede recrear. En esta fase no hay recuperación de sesión, así que borrarla en un botón de "¿quiero volver a empezar?" sería cerrar la puerta sin avisar. `limpiarVersionesAnteriores()` aplica la misma excepción desde antes. Ver `TODO-FASE2 (SEGURIDAD)`.
- **La sesión va con versión propia** (`VERSION_SESION`), suelta de la de los datos (`VERSION_DATOS`). Si compartieran número, añadir el campo `origen` a las ideas cerraría la sesión de todo el mundo sin que nadie hubiera hecho nada que lo justificara.
- **Cerrar sesión borra solo la sesión.** Los datos y las fotos se quedan: es lo contrario de "Restablecer datos", y no se pisan.
- **Las guardas van en los dos sentidos.** Con sesión ya creada, `/bienvenida` devolvería un "Comenzar" que sobrescribiría el identificador de sesión con uno nuevo sin avisar. Se protege el `Layout` entero y no ruta por ruta: una pantalla nueva entra protegida por defecto, que es lo contrario de lo que se puede olvidar.
- **"Iniciar sesión" se enseña deshabilitado, no se oculta.** El mockup lo tiene. Con `aria-disabled` y un texto oculto enlazado con `aria-describedby`, porque un `disabled` de verdad quita el botón del orden de tabulación y con teclado no se alcanzaría ni se oiría el motivo.
- **Si la sesión no se puede guardar, no se navega.** Entrar sin ella dejaría a la persona en Inicio y la guarda la devolvería al instante, con un salto visible que parece un fallo de la app. Se queda en la bienvenida explicando qué ha pasado.
- **El estado de la sesión se suscribe al evento `storage`, no se relee al pintar.** "Cerrar sesión" no recarga la página, y el evento `storage` no lo dispara la propia pestaña: sin suscripción, el indicador seguiría diciendo que hay sesión y ofrecería cerrar una sesión que ya no existe.
- **Nada de esto es autenticación, y se dice donde se lee.** La clave se puede escribir a mano desde la consola del navegador. Lo que se guarda solo evita repetir el primer pantallazo. El aviso está en el `sesion.js`, en `App.jsx`, en `main.jsx`, en `docs/SEGURIDAD.md` y en la propia pantalla de Configuración, porque la tentación de tratar "hay sesión" como "está autorizado" aparece justo cuando alguien empieza a usar esto para algo más.
- **Una sesión con forma inesperada cuenta como no tener sesión.** `leerSesion()` valida que sea un objeto con `id` en formato UUID v4 y `creadaEn` que sea una fecha, y devuelve `null` ante JSON corrupto, un array o una clave escrita a mano. Es preferible volver a la bienvenida que dejar entrar a alguien por un valor que nadie ha validado.
- **Pulsar un día no escribe en la URL.** Elegir un día es mirar sus eventos, no moverse en el calendario: si quien pulsa "Compartir" mandara a otro día del que quería, el enlace sería peor que no tenerlo. Moverse sí escribe, y ahí la URL es lo que hace el trabajo.
- **La selección empieza vacía.** Señalar el día de hoy al montar haría que la pantalla fuera distinta en cada apertura. El día resaltado sale de una regla: el seleccionado si está en la vista, si no el primer día con eventos, si no el primero del mes.
- **`elegirDiaResaltado` y `resaltarCuadricula` viven fuera del componente.** Son reglas de la cuadrícula, no estado de React. Dentro del componente, el `useMemo` del resaltado y el que lo pintaba se podían conservar: uno invalidaba al otro y acababan pudiendo mostrar días distintos.
- **La vista de día no pinta panel lateral.** `CalendarioDia` ya lista los eventos; repetirlo sería ver lo mismo dos veces en la misma pantalla.
- **`Configuracion` avisa de dónde viven los datos** y de que no hay nube. Es la misma decisión de la pantalla de bienvenida, escrita donde se va a mirar cuando alguien se pregunta qué guarda la app.

### Correcciones
- **El informe y un mensaje de commit decían que la app elegía "la semana con más eventos".** No era así: lo que se abre es la semana que contiene `?fecha=`, y sin ese parámetro, la de hoy. La frase solo era cierta del fixture de pruebas, que elige la semana más poblada para tener días con eventos con los que trabajar. Un informe y un commit afirmaban lo contrario, y podía leerse como que
el conmutador de vistas no respetaba la URL. Ahora hay dos comprobaciones que lo
fijan: `?fecha=` gana incluso en una semana sin eventos, y sin `?fecha=` se abre
la semana del reloj.
- **El enlace "Mes" conservaba el mes equivocado.** Iba siempre a `/calendario`, así que desde la vista de día de noviembre se volvía a octubre. Ahora lleva el mes del ancla, y solo se deja limpio cuando es el mes en curso, que es la dirección que se comparte.
- **`mesEnCurso` usaba `new Date()`**, que ignora el reloj inyectado. Con la suite en febrero, "Hoy" quedaba mal deshabilitado.
- **Ciclo entre `reloj.js` y `fechas.js`.** `reloj.js` importaba `aFecha` de `fechas.js`, y   `fechas.js` pregunta por "hoy" a `reloj.js`. Según el orden de resolución del grafo, `ahora()` podía no existir cuando se la llamaba. El parser se repite ahora en `reloj.js` con las mismas dos funciones de `date-fns`.
- **Erratas en comentarios y textos**: `sinParameters`, `wheeled` en `src/pages/Calendario.jsx`; `technique` en `src/pages/Configuracion.jsx`; `Úsica`, `keypad` y `cosmeticamente` en `src/services/storage.js`; `sinfiltrar` en `src/services/eventosService.js`. Ninguna llegó a verse en pantalla, y las siete las encontró la lectura del código, no la auditoría automática, que solo detecta caracteres no latinos.
- **`Configuracion` tenía dos diálogos anidados al confirmar el restablecimiento.** `ConfirmarSalida` se usó dentro del `Modal`: traía su propio `role="alertdialog"`, un título que decía "¿Salir sin guardar?" y sus dos botones, así que la pantalla tenía dos diálogos con dos títulos que se contradecían y cuatro botones para una sola decisión. Se quitó el componente y su detalle pasó a `descripcionAdicional`; el `Modal` ya pone el foco en el panel, así que el botón destructivo queda a un Tab de distancia. Cuatro comprobaciones nuevas lo impiden de volver. El diálogo de cerrar sesión lleva su propio `alertdialog` por el mismo motivo, y no reutiliza `ConfirmarSalida`.
- **Dos rutas se saltaban el reloj.** `mesDesdeParametro()` declaraba su valor por defecto como `new Date()`, y como los parámetros por defecto se evalúan en cada llamada, esa era también la ruta de `?mes=` cuando faltaba o venía basura: con la suite en diciembre devolvía el mes real del ordenador. Y `crearEvento()` sellaba `creadoEn` con `new Date()`, de modo que un evento creado en prueba quedaba con la fecha real y se colaba entre los de otro mes al ordenarlos. Las dos preguntan ahora al reloj. En producción el reloj no está fijado, así que lo que ve nadie cambia.
- **Un comentario justificaba mal el código.** `moverDiaCalendario()` decía que `addDays` evita que `setDate` desborde de fin de mes. No era verdad: los dos resuelven el desbordamiento igual, y lo que se gana es no tener que comprobarlo a mano. El comentario estaba corregido para dejar de sonar a error frecuente.
- **Dos comprobaciones medían el almacén equivocado.** En la sección de DOM del test, `globalThis.window` pasa a ser la ventana de jsdom, que trae su propio `localStorage`; la variable `storage` del principio queda como un almacén muerto. "Y nada se ha borrado todavía" y "la sesión sobrevive al restablecimiento" leían de ahí, así que daban verde sin comprobar nada de lo que la app usa. Ahora leen de `globalThis.window.localStorage`.

### Verificación
- `npm test`: 1025 comprobaciones, 0 fallos, estable en 3 pasadas seguidas.
- Fechas simuladas: `npm run test:octubre`, `npm run test:febrero` y `npm run test:diciembre`, las tres con 1025 y 0 fallos.
- `npm run lint`: 0 avisos y 0 errores.
- `npm run build`: correcto.
- `npm run auditar-codificacion`: 74 ficheros, 0 problemas.
- `npm run auditar-idioma`: 64 ficheros, 0 problemas. Con `-- --mensajes`: los 9 mensajes de commit, 0 problemas.
- La sesión se prueba de punta a punta y montada con `App` dentro de un `MemoryRouter`: sin ella, ninguna ruta de dentro del layout enseña nada; con ella, `/bienvenida` salta a Inicio; `Comenzar` guarda la sesión y entra; cerrar sesión borra solo esa clave y devuelve a la bienvenida con los datos intactos.
- Las tres vistas se prueban montadas, con DOM real y pulsaciones: el conmutador escribe en la URL, las flechas mueven el período de cada vista, "Hoy" vuelve al día en curso, y una URL manipulada (`?vista=trimestre`, `?fecha=2026-10-99`) cae en algo válido sin NaN.
- Las comprobaciones de las vistas se anclan al reloj y no a octubre de 2026. Con fechas literales, en febrero y diciembre no habría eventos que encontrar y las pruebas pasarían por falta de datos en vez de por funcionamiento.
- Hay pruebas de cruce de año, no solo de mes: la semana del 28 de diciembre de 2026 al 3 de enero de 2027, y la navegación del 31 de diciembre al 1 de enero. Es justo el caso en el que un título, un índice de día o un salto de semana se rompen sin que en octubre se note.
- **Los dos anclajes que cruzan el año se comprueban por URL, no por presunción.** `?vista=semana&fecha=2026-12-31` y `?vista=semana&fecha=2027-01-01` tienen que enseñar la misma semana, con el título `28 dic – 3 ene`, y cambiar solo la columna resaltada: la del jueves en el primer caso y la del viernes en el segundo. También que el enlace directo a esa semana funcione con `Link`, y que el reloj simulado en diciembre y en el mes siguiente dé el mismo resultado. Diez comprobaciones nuevas; sin ellas, el caso de `fechaAParametro()` y `elegirDiaResaltado()` solo se veía en octubre, donde cualquier fecha cae dentro de la semana y nada se rompe.
- Todo lo que la suite no alcanza está en `docs/VERIFICACION_MANUAL.md`. Las casillas siguen vacías.

---

## Auditoría de codificación

### Añadido
- **`npm run auditar-codificacion`** (`scripts/auditar-codificacion.mjs`): escanea los ficheros de texto del proyecto y falla con código 1 ante caracteres fuera del alfabeto latino y de los signos del español (CJK, cirílico, árabe, hebreo y demás), `U+FFFD`, mojibake de UTF-8 leído como latin-1, BOM, bytes nulos, saltos de línea mezclados y ficheros sin salto final.

### Decisiones
- **El fallo que busca es invisible al linter.** Un fichero puede compilar, pasar los tests y llevar tres palabras en otro idioma dentro de una frase en español: no hay error de sintaxis que lo delate. Ha pasado cuatro veces en este proyecto, y la última en el informe del paso f.
- **La lista de permitidos justifica cada símbolo.** Flechas, `§`, `°`, `❤`, `«»` y la raya larga se usan a propósito, y cada entrada dice por qué se acepta. Una entrada sin motivo no tiene sitio en esa lista, para que ampliarla sea una decisión visible.
- **Se recorre carácter a carácter y no con una expresión regular**, porque los rangos se declaran como números: escritos en un literal quedarían partidos entre varias líneas y un rango mal escrito no se vería hasta que falla.
- **El script se autoexcluye del mojibake.** Construye las secuencias con `String.fromCharCode` en vez de escribirlas como literales, porque el fichero contiene la lista y se detectaría a sí mismo.

### Verificación
- Comprobado con un fichero temporal que mezcla ideograma, cirílico y hebreo: los tres se detectan con su bloque y su número.
- Los comentarios corregidos en el paso f (`quienchoosable`, `discovered`, `throwing`) salen limpios.

---

## Auditoría de idioma

### Añadido
- **`npm run auditar-idioma`** (`scripts/auditar-idioma.mjs`): escanea la prosa del proyecto y falla con código 1 ante palabras inglesas en medio de frases en español. Revisa `docs/`, `README.md`, los comentarios de `src/` y los de `scripts/`.
- **`npm run auditar-idioma -- --mensajes`**: lo mismo sobre los mensajes de commit, que se leen con `git log`. No los arregla, porque corregir un mensaje ya escrito es reescribir la historia.

### Decisiones
- **El fallo que busca también es invisible al linter, y además lo ve la otra auditoría.** Una palabra inglesa es perfectamente latina, así que `auditar-codificacion` no puede verla. Ha pasado media docena de veces en este proyecto, y la última en el informe de este mismo paso: `La manages`, `affirmed`, `respected`, `yuir`, `puntokeyboard`. Cada vez que se corregía una aparecía otra en el fichero siguiente, que es la señal de que hacía falta una comprobación automática y no más revisión a mano.
- **La lista son 168 palabras funcionales**, declaradas por grupos y con el motivo de cada uno. Solo entran las que no existen en ningún uso del español.
- **`use` y `a` no se vigilan, a propósito.** `use` es el subjuntivo de "usar" ("quien use") y `a` es la preposición española. El primer escaneo avisó de `use` seis veces y las seis eran español; un auditor que se apaga por eso no vuelve a mirarse.
- **Lo que no es prosa se quita antes de comparar.** En Markdown, las vallas de código, el código en línea, las etiquetas HTML y el destino de los enlaces; en los comentarios, las líneas que son código, los tipos entre llaves y las etiquetas de JSDoc. Los identificadores vienen del inglés por acuerdo (`useState`, `localStorage`) y revisarlos sería rechazarlos.
- **Las tildes se quitan antes de comparar.** Un patrón de letras ASCII parte "funcionarían" en dos palabras y avisaba de una inglesa inexistente; lo mismo pasaba con "Mayús" y "foránea". Es la causa de la mayoría de los falsos positivos del primer escaneo.
- **Tres excepciones, cada una con su motivo escrito**: `check` (la restricción de PostgreSQL), `hook` (préstamo del proyecto) y `build` (la tarea de construcción). Ampliar la lista es una decisión visible.
- **El script se autoexcluye.** Es el único fichero que lleva la lista de palabras inglesas dentro, y la lleva a propósito.
- **El aviso enseña el trozo de texto con la palabra en medio**, buscada con sus límites: con `indexOf` el aviso acababa señalando media línea antes del fallo, que es peor que no señalar nada.

### Verificación
- 64 ficheros revisados y 0 problemas, después de corregir lo que el primer escaneo encontró de verdad: el encabezado `## Build` del README, `appearance-none` sin acentuar en `Interruptor.jsx`, un comentario en inglés de `eventosService.js` y dos citas del aviso de React escritas en inglés y sin acentuar, ahora entre comillas invertidas.
- Comprobado con dos ficheros temporales: detecta la palabra en la prosa de un `.md` y en un comentario de bloque de un `.mjs`, y no avisa de la que estaba dentro de un bloque de código ni de la que estaba en código en línea.
- Los 9 mensajes de commit revisados salen limpios. Cinco decían "build correcto", que es el mismo préstamo que la excepción declara.

---

## Paso f — Galería

### Añadido
- **Página `Galeria` real**, antes un marcador de posición. Mosaico de fotos agrupado por mes, con recuento y salida al planeador.
- **`src/utils/galeria.js`**: derivación pura de la galería a partir de los eventos. `extraerFotos`, `agruparFotosPorMes`, `aniosConFotos`, `filtrarPorAnio`, `anioValido` y `textoRecuento`.
- **Componentes nuevos** en `src/components/galeria/`: `MosaicoGaleria` y `FotoGaleria`.
- **Filtro de año en la URL** (`?anio=AAAA`), con enlace "Todos". Solo aparece si hay fotos de más de un año: un selector de una sola opción solo añade un clic para acabar en la misma galería.
- **`?evento=<id>`**: el enlace "Ver en la galería" del detalle ya escribía este parámetro y la galería lo entendía. Resalta esa foto con `aria-current`, y el enlace lleva título y fecha para que dos fotos del mismo mes suenen distintas al recorrerla.
- **Cuatro estados distintos**: cargando, error con botón "Reintentar", vacío con salida al planeador, y mosaico. Se distinguen a propósito porque confundirlos deja una pantalla en blanco que parece un fallo.

### Cambiado
- **`degradadoCategoria` sale de `planeador.js` a `categorias.js`**, y se parte en `degradadoCategoriaEvento` y `degradadoCategoriaIdea`. La galería necesita el de los eventos y mantener los dos habría sido la misma interpolación escrita en dos sitios, con el riesgo de que cambiaran por separado. `ImagenIdea` usa ahora la del catálogo.
- **`Galeria` en la lista de páginas reales** de `docs/COMPONENTES.md`, con sus props y sus decisiones.

### Decisiones
- **La galería no guarda fotos propias.** Sus fotos son `Evento.foto`, derivadas de `useEventos()`. No hay tabla, clave ni service nuevos, y no existe el estado en el que una foto y su recuerdo se desincronicen. Si en Supabase las fotos pasan a ser una tabla aparte, esto deja de ser derivable; está anotado en `docs/MIGRACION_SUPABASE.md`.
- **El orden no se hereda del calendario.** El calendario pone lo próximo arriba y la galería lo último que pasó primero, porque se recorre como un álbum. `extraerFotos` lo hace explícito en vez de reutilizar `eventosOrdenados`, que sería correcto por casualidad. A igualdad de día manda la hora, y el evento sin hora va al final porque ocupa el día entero.
- **`agruparPorMes` se reutiliza desde `fechas.js`** en vez de reimplementar el agrupado, para que el encabezado del mes se escriba en un solo sitio y la galería no pueda desincronizarse de la línea de tiempo.
- **`anioValido()` normaliza al leer la URL, no al escribirla.** Un `?anio=20` se trata como "sin filtro" en lugar de dejar el mosaico vacío sin explicación, que es la peor forma de fallar.

### Correcciones
- **La imagen del mosaico es decorativa** (`alt=""`), porque el enlace ya lleva el título y la fecha en su `aria-label`. Con las dos, un lector de pantalla lo repetiría dos veces.
- **Debajo de cada foto hay un degradado de la categoría** y la imagen se apaga con `onError` si no carga. Las fotos del seed son URLs remotas y sin conexión habría huecos rotos y los iconos del navegador.
- **La rejilla lleva `role="list"` explícito** en el `ul`, porque Safari deja de anunciar los roles de lista cuando el contenedor es un `div` con `display: grid`.
- **Erratas en comentarios, no visibles en pantalla:** `Separate de` en `src/types/models.js`, `quienchoosable` en `src/utils/imagen.js`, y `discovered`/`throwing` en `src/utils/categorias.js`. Se corrigieron al leer el código; ninguna era texto de interfaz. Un escaneo automático de caracteres no latinos confirma que no queda ninguna más.

### Decisiones revisadas
- **`?evento=` manda sobre `?anio=`.** Quien llega desde "Ver en la galería" de un detalle quiere ver esa foto; si el año del filtro no es el suyo, se aplica el de la foto en vez de esconderla. Se ajusta en memoria (`resolverAnio()`) y no reescribiendo la URL, para que el botón "atrás" no devuelva al filtro viejo. Con un `?evento=` desconocido el filtro se respeta, porque un enlace antiguo no debe borrar lo que la persona había elegido.
- **Las fotos remotas del seed se quedan.** Son datos de ejemplo, y el degradado de reserva ya evita el icono roto sin conexión. En Fase 2 desaparece el problema de fondo, pero no el degradado: una URL firmada caducada falla igual. Anotado en `docs/MIGRACION_SUPABASE.md`.

### Correcciones de las pruebas
- **Dos comprobaciones del seed dependían del mes literal.** Escribían `'2026-09'` y `'2026-10'` en vez de derivar el mes del reloj, así que dejaban de ser ciertas en cuanto cambiaba el mes y el fallo se habría leído como un problema del seed. Ahora los meses se calculan desde la fecha real, que es justo lo que comprueban: que el seed ancla al mes en curso y al siguiente.
- **El día 1 del mes se construye con números**, no con `new Date('YYYY-MM-01')`: esa cadena es UTC y en un huso horario negativo cae en el mes anterior, con lo que la cuadrícula se construye del mes equivocado y ninguna celda queda marcada como del mes visible. Es el mismo fallo que ya estaba documentado en el README para las fechas del calendario.
- **El arnés gana `disparar(el, tipo)`**: dispara un evento que no viene del ratón ni del teclado, como el `error` de una imagen que no carga. Va dentro de `act` porque provoca un cambio de estado, y sin el envoltorio la comprobación mediría el estado anterior.

### Verificación
- `npm test`: 737 comprobaciones, 0 fallos, estable en 3 pasadas seguidas.
- `npm run lint`: 0 avisos y 0 errores.
- `npm run build`: correcto.
- Codificación revisada con `npm run auditar-codificacion`: 67 ficheros de texto del proyecto, incluidos los `.md` tocados, 0 problemas.
- La derivación se prueba **sin montar nada**, porque es pura: orden descendente entre años, la hora a igualdad de día, el evento sin hora al final, y el descarte de `foto: null`, cadena vacía, falta de `id` y falta de `fecha`.
- La coherencia entre foto y recuerdo se comprueba borrando un evento: su foto desaparece de la galería y las demás siguen ahí.
- Pendiente de comprobación manual: el mosaico con fotos reales de la pareja, la fidelidad visual en escritorio y móvil, el comportamiento de la reserva cuando falla la red, y si el filtro de año se relaciona bien con el scroll.

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
