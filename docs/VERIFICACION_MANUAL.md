# Verificación manual

Lo que la suite **no** puede comprobar. Todo lo automatizado está cubierto por
`npm test`, `npm run lint`, `npm run build` y `npm run auditar-codificacion`,
también con las fechas simuladas de octubre, febrero y diciembre.

Estas casillas están vacías a propósito. Nadie las ha marcado, porque nada de
esto se ha visto en un navegador: la prueba llega al DOM real con jsdom, pero no
al ancho de la ventana, ni al desplazamiento real, ni a la composición de
fuentes, ni a un dedo sobre una pantalla.

## Cómo hacerlo

```bash
npm run dev
```

Y abrirlo en el móvil con la IP local de la máquina, no en el navegador del
escritorio. La mitad de lo que hay aquí solo se ve en un ancho de móvil real,
con la barra del navegador abierta.

---

## 1. Fidelidad con el mockup

- [ ] **Inicio** en escritorio: el banner, el saludo, la frase del día y "El más próximo" se parecen al mockup en posición y tamaño.
- [ ] **Calendario mensual** en escritorio: la rejilla de 6 filas, la columna lateral fija y la leyenda coinciden.
- [ ] **Vista de semana**: las 7 columnas se leen y los títulos de evento no se cortan.
- [ ] **Vista de día**: el título y la lista de eventos tienen el aire que les da el mockup.
- [ ] **Planeador** y **Galería**: tarjetas, rejilla y pies de foto.
- [ ] Todo lo anterior **repetido en móvil**, con la barra inferior visible y el área segura respetada.
- [ ] Las tipografías de pantalla cargan. Si no, el mockup se ve con la de reserva y la comparación no vale.

## 2. Ancho de la rejilla de la semana

- [ ] En un móvil de **360 px de ancho** (el más estrecho que sigue siendo habitual), las 7 caben sin recorte.
- [ ] El título de un evento largo **no rompe la columna** ni desborda hacia la vecina.
- [ ] Con dos o más eventos el mismo día, la columna crece hacia abajo sin empujar a las demás de forma desigual.

## 3. Desplazamiento horizontal

- [ ] Ninguna pantalla genera **scroll horizontal** en 360 px: ni Inicio, ni Calendario, ni Planeador, ni Galería, ni Configuración.
- [ ] Y el caso peor: el título más largo del seed y una descripción de 500 caracteres.
- [ ] Con el teclado virtual abierto en móvil.

## 4. Orientación y metadatos de las fotos (EXIF y GPS)

- [ ] Una foto **vertical** (móvil en retrato) se guarda y se ve **vertical**, no girada.
- [ ] Una foto **horizontal** (móvil en paisaje) se guarda y se ve horizontal.
- [ ] Se ve la **miniatura** mientras se elige, con la orientación correcta.
- [ ] La foto que aparece en el calendario, en el detalle, en Inicio y en la galería está **en la misma orientación** en las cuatro pantallas. Si en una sale girada y en otra no, el EXIF no se está quitando de forma consistente.
- [ ] **GPS borrado**: abrir el `.webp` exportado con un visor de EXIF y comprobar que no aparecen latitud ni longitud. En Android: Ajustes → Acerca del teléfono → Estado → Información de composición, o cualquier visor de metadatos.
- [ ] **EXIF borrado**: el mismo fichero no debe mostrar cámara, modelo ni fecha de captura. La recompresión a canvas es lo que lo hace; si algún camino se la salta, el archivo lo conserva.

## 5. Unidades `dvh` con el teclado abierto

- [ ] En Inicio, en la vista de día del calendario y en Planeador, con el **teclado abierto**, el campo sobre el que se escribe queda **por encima del teclado**, sin quedar tapado.
- [ ] Al cambiar el foco entre campos, la vista **sube lo justo** y no salta de golpe.
- [ ] Al cerrar el teclado, la pantalla **vuelve a su sitio** y no queda un hueco vacío abajo.
- [ ] Con la barra del navegador plegada y desplegada, el contenido sigue alcanzable.

## 6. Contraste

- [ ] El texto de las **cinco categorías** (`cita`, `aniversario`, `viaje`, `cumpleanos`, `otro`) sobre su propio fondo pasa **AA**: se lee el texto de las franjas, el de los chips y el de los títulos de la vista de semana.
- [ ] El **color principal de la app sobre `#F7FAFC`** se ve en los botones y en los números de día activos. En `viaje`, `cumpleanos` y `otro` **no llega a 3:1**, así que el significado no puede depender solo del color: hay que poder distinguir la categoría por su texto.
- [ ] Con el **modo de alto contraste** del sistema operativo, la rejilla y los chips siguen distinguibles.
- [ ] Los textos sobre la foto en la galería se leen con la mayor parte de las fotos del seed.

## 7. Sesión, bienvenida y cierre

Lo que la suite no puede ver aquí es el `localStorage` del navegador de verdad y
la reacción entre dos pestañas.

### Primera entrada

- [ ] Con el almacenamiento limpio, `/` **no muestra Inicio**: salta a `/bienvenida`.
- [ ] `/bienvenida` se ve **sin** barra lateral ni barra inferior, con el logo, la frase y los dos botones.
- [ ] Cualquier ruta escrita a mano sin sesión (`/calendario`, `/planeador`, `/galeria`, `/configuracion`, `/momentos`) vuelve a la bienvenida.
- [ ] Una ruta **inexistente** también acaba en la bienvenida, sin pantalla en blanco.
- [ ] "Comenzar" lleva a Inicio y, al volver atrás, no se repite la bienvenida.

### Volver a entrar con la sesión ya creada

- [ ] Escribiendo `/bienvenida` a mano con la sesión creada, salta a Inicio.
- [ ] El botón atrás del navegador **no** devuelve a la bienvenida, que es lo que se Busca: no se puede volver a una pantalla que ya no aplica.

### "Iniciar sesión"

- [ ] Se ve en pantalla, se nota que no está activo y **no hace nada**: ni navega, ni error, ni pantalla rota.
- [ ] Con **Tab** se llega al botón y con **Enter o Espacio** no pasa nada. Es el punto clave: con `disabled` de verdad dejaría de ser alcanzable, y con eso no se oye el motivo.
- [ ] El tooltip "Próximamente" aparece al puntero.
- [ ] Con un lector de pantalla se anuncia como no disponible y se oye el motivo, no solo "botón".

### Cerrar sesión en Configuración

- [ ] La sección de sesión enseña la clave y avisa de que no es autenticación.
- [ ] "Cerrar sesión" **pregunta antes** y solo hay un diálogo, con un único título.
- [ ] Al cancelar, no se borra nada.
- [ ] Al confirmar, vuelve a la bienvenida y **los datos siguen ahí**: los recuerdos, las ideas y las fotos no se han perdido.
- [ ] Entrando otra vez, el seed no se ha vuelto a sembrar: no hay recuerdos duplicados.

### Sesión en la misma pestaña y en otra

- [ ] Con la app abierta en **dos pestañas**, cerrar sesión en una **cambia el indicador de la otra** sin recargar. Es la razón de que el hook se suscriba al evento `storage`.
- [ ] Al revés: cambiar cualquier dato en una pestaña no hace aparecer ni un aviso raro en la otra.
- [ ] Cerrar sesión en una pestaña **no borra los datos** de la otra.

### Lo que hay que saber antes de marcar nada

- [ ] La clave se puede escribir a mano desde la consola del navegador (`localStorage.setItem('juntos:v1:sesion', '{"id":"..."}')`). Si alguien lo hace, entra. **Esto no se arregla en este paso**, y hay que decirlo en voz alta antes de dar la sesión por buena.
- [ ] "Cerrar sesión" **no borra los datos**. Si lo que se quería era borrar todo, el botón es "Restablecer datos", y avisa de lo contrario.

## 8. Lo que se añadió sin revisión

- [ ] **Las vistas de semana y día, tal como están ahora.** No estaban en el encargo del paso g, que pedía dejarlas deshabilitadas con "Próximamente". Se implementaron igual y van en un commit aparte para poder deshacerlas sin perder el resto del paso. Merece una mirada propia antes de dar el paso por bueno.

---

## Nota

Mientras estas casillas estén vacías, ninguna afirmación de "funciona" de este
proyecto vale para un navegador de verdad. La suite mide lógica y DOM, que es
justo lo que no falla solo; el resto es lo que más se desajusta del mockup y
lo que más caro sale corregir después.
