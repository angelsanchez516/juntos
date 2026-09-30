# MODELO DE DATOS — Juntos (Fase 1)

Definición de las entidades, sus tipos, sus reglas de validación y cómo se almacenan.

> Fuente de verdad en código: los `@typedef` de [`src/types/models.js`](../src/types/models.js) y las reglas de [`src/utils/validaciones.js`](../src/utils/validaciones.js). Este documento explica el porqué; el código, el qué.

---

## Almacenamiento

| Colección | Clave en `localStorage` | Contenido |
|---|---|---|
| Eventos | `juntos:v2:eventos` | `Evento[]` |
| Ideas de cita | `juntos:v2:citas` | `IdeaCita[]` |

El formato de la clave es `juntos:v{VERSION}:{coleccion}` (ver `VERSION_DATOS` en `src/services/storage.js`).

**Por qué versionar la clave y no el contenido:** si el esquema cambia, subir `VERSION_DATOS` hace que la app deje de leer las claves antiguas y escriba bajo las nuevas. No hay que escribir código de migración para datos de prueba, y los datos antiguos no se interpretan con el esquema nuevo (lo que sí rompería). `limpiarVersionesAnteriores()` borra lo viejo cuando haga falta.

**Historial de versiones:**

| Versión | Cambio | Por qué |
|---|---|---|
| `v1` | Primera versión. Categorías con clave `cumpleaños` (con ñ) y `en casa` (con espacio). | El seed usaba `cumpleanos` y el orden `en casa`, así que esos valores no existían en el objeto de categorías. |
| `v2` | Claves de categoría normalizadas a slugs ASCII: `cumpleanos`, `en-casa`. | Los datos en `v1` eran inválidos según el esquema nuevo. |

---

## Evento

```js
{
  id: 'a0d10002-a0d2-4a02-8a02-a0d200000002',
  titulo: 'Cena romántica',
  fecha: '2026-09-14',
  hora: '19:00',              // o null
  descripcion: 'Mesa junto a la ventana...',
  lugar: 'Restaurante La Terraza – Ocaña',
  categoria: 'cita',
  foto: 'https://picsum.photos/seed/cena/1200/800',  // o data URL base64, o null
  creadoEn: '2026-09-29T14:03:11.882Z'
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `id` | `string` (UUID v4) | Sí (lo asigna el service) | Formato UUID. **No** acepta texto libre: los services lo validan antes de buscar. |
| `titulo` | `string` | Sí | 3–120 caracteres. Se eliminan caracteres de control y se recortan los extremos. |
| `fecha` | `string` `YYYY-MM-DD` | Sí | Formato estricto **y** el día debe existir en ese mes (`2026-02-31` se rechaza). |
| `hora` | `string` `HH:mm` \| `null` | No | 24 h, `00:00`–`23:59`. `null` = evento de todo el día. |
| `descripcion` | `string` | No | Máximo 500 caracteres. |
| `lugar` | `string` | No | Máximo 160 caracteres. |
| `categoria` | `CategoriaEvento` | Sí | Una de: `cita`, `aniversario`, `viaje`, `cumpleanos`, `otro`. Lista blanca, no texto libre. |
| `foto` | `string` \| `null` | No | URL `http(s)` **o** data URL `data:image/(jpeg\|png\|webp);base64,...`. |
| `creadoEn` | `string` ISO 8601 | Sí (lo asigna el service) | Solo lectura. El service lo restaura aunque venga en la entrada. |

### Categorías y colores

Definidas en [`src/utils/categorias.js`](../src/utils/categorias.js) (fuente única de verdad).

| Clave | Etiqueta | Color |
|---|---|---|
| `cita` | Cita | `#7B22CA` morado |
| `aniversario` | Aniversario | `#E44B66` rosa/rojo |
| `viaje` | Viaje | `#33A563` verde |
| `cumpleanos` | Cumpleaños | `#FDB129` amarillo |
| `otro` | Otro | `#62B1F5` azul |

**La clave es un slug, la etiqueta lleva los acentos.** `cumpleanos` se escribe sin `ñ` y `en-casa` con guion bajo, pero lo que ve la persona es "Cumpleaños" y "En casa". La razón es que estas claves se guardan en `localStorage`, acaban siendo el valor de una columna en Supabase y se usan en filtros y URLs: un acento o un espacio ahí se rompen o hay que escaparlos. La `ñ` vive solo en `label`.

No se puede cambiar la clave de una categoría sin subir `VERSION_DATOS`: si el objeto y el seed no coinciden, los eventos caen en la categoría de reserva sin avisar. Para evitarlo hay una prueba que comprueba que toda clave de `ORDEN_CATEGORIAS_EVENTO` existe en `CATEGORIAS_EVENTO` y que el seed no usa claves inexistentes.

Se aplican con `style={{ backgroundColor }}`, no con clases de Tailwind, porque Tailwind purga las clases construidas en tiempo de ejecución. Ver `docs/ARQUITECTURA.md`.

---

## IdeaCita

```js
{
  id: 'b0d20001-b0d2-4b01-8b01-b0d100000001',
  titulo: 'Noche de cine en casa',
  descripcion: 'Luz apagada, manta y algo rico para picar...',
  categoria: 'en-casa',
  favorita: true,
  imagen: 'https://picsum.photos/seed/idea-cine-casa/800/600'  // o null
}
```

| Campo | Tipo | Obligatorio | Reglas |
|---|---|---|---|
| `id` | `string` (UUID v4) | Sí (lo asigna el service) | Mismo formato que `Evento`. |
| `titulo` | `string` | Sí | Máximo 120 caracteres. |
| `descripcion` | `string` | No | Máximo 500 caracteres. |
| `categoria` | `CategoriaIdeaCita` | Sí | Una de: `en-casa`, `afuera`, `aventura`, `relax`. |
| `favorita` | `boolean` | No (por defecto `false`) | Booleano estricto, no string `"true"`. |
| `imagen` | `string` \| `null` | No | Mismas reglas que `foto`. |

### Categorías de idea

| Clave | Etiqueta | Color |
|---|---|---|
| `en-casa` | En casa | `#C08497` |
| `afuera` | Afuera | `#62B1F5` |
| `aventura` | Aventura | `#33A563` |
| `relax` | Relax | `#B39CDB` |

**Por qué las ideas y los eventos tienen categorías distintas:** una idea se filtra por *contexto* (dónde o cómo), mientras que un evento se clasifica por *naturaleza* (qué es). Al convertir una idea en evento, la categoría de contexto no encaja en las del evento, así que se traduce a `cita` (la pareja puede cambiarla después).

---

## Fechas: por qué `YYYY-MM-DD` en string

Las fechas se guardan como texto ISO, no como `Date` ni como timestamp numérico.

1. **`JSON.stringify` convierte `Date` a ISO con zona horaria** (`2026-09-14T00:00:00.000Z`), y al releer se reinterpretaría en la zona local, desplazando potencialmente el día.
2. **`new Date('2026-09-14')` se interpreta como UTC**, no como local. En UTC-5 (Colombia) esa fecha corresponde al 13 a las 19:00 locales, y `getDate()` devuelve 13. Es el error clásico de un día de desfase en el calendario.
3. **El orden lexicográfico coincide con el cronológico** en formato `YYYY-MM-DD`, así que comparar fechas es comparar cadenas: sin conversiones ni zonas horarias de por medio.

Por eso toda conversión pasa por `utils/fechas.js` (`aFecha()` usa `parseISO` + hora local, `formatearFecha()`, etc.) y nunca se escribe `new Date(stringISO)` a mano.

---

## Validación: en dos capas, por qué

Las reglas viven en `src/utils/validaciones.js` y se aplican en dos sitios:

| Capa | Dónde | Para qué |
|---|---|---|
| **Formulario** | `pages/`, `components/` | Pintar el error en el input concreto y dar feedback inmediato. |
| **Service** | `services/` | Rechazar datos inválidos aunque el formulario los haya dejado pasar. |

Que el service valide no es redundancia: un service es una API pública y no puede asumir que su llamador hizo la validación. Un formulario con un bug, una extensión del navegador o un `console.log` mal puesto no deben poder meter datos corruptos en el store.

**En Fase 2 la capa decisiva es el servidor.** Estas reglas son para la experiencia de usuario, no para seguridad. Ver `docs/SEGURIDAD.md` y el `TODO-FASE2` marcado en `validaciones.js`.

### Validación de fotos

La validación va en **dos fases**. La segunda es la que decide de verdad.

| Regla | Valor | Motivo |
|---|---|---|
| MIME permitidos | `image/jpeg`, `image/png`, `image/webp` | Lista blanca. SVG y HTML pueden llevar JavaScript incrustado. |
| Tamaño máximo | 5 MB (5 × 1024 × 1024) | El límite del enunciado y un techo razonable antes de comprimir. |
| Coherencia MIME/extensión | `.jpg`→`image/jpeg`, etc. | Filtra el error más común. |
| **Firmas de bytes** | `FF D8 FF` / `89 50 4E 47` / `RIFF....WEBP` | Segunda fase. Sin ella, un SVG renombrado a `.jpg` con `type: 'image/jpeg'` pasa la primera. |

### Procesado de fotos (paso d)

Al elegir un archivo, `src/utils/imagen.js` lo reescala y lo vuelve a exportar
antes de guardarlo. La foto que acaba en el registro **no es la original**.

| Paso | Valor | Motivo |
|---|---|---|
| Lado mayor | 1200 px | Una foto de móvil de 4000 px ocupa ~11× más sin que se note en pantalla. |
| Formato de salida | WebP, con JPEG de reserva | WebP pesa entre un 25 % y un 35 % menos a calidad equivalente. |
| Calidad | 0.8 | Por debajo de 0.75 la foto se ve peor; por encima, no compensa. |
| Orientación | EXIF aplicada al decodificar | Sin esto, las fotos verticales se verían giradas. |
| Metadatos | **Eliminados** | El canvas no copia EXIF ni GPS: la foto no lleva ni el móvil ni la ubicación. |
| Fondo | Relleno blanco solo al exportar a JPEG | JPEG no tiene canal alfa; WebP sí, y rellenando antes se perdería la transparencia. |

La firma no descodifica la imagen, así que un archivo con la cabecera correcta y
el resto corrupto la supera; `createImageBitmap()` es quien falla después al
abrirlo. La verificación real sigue siendo tarea del servidor.

---

## Datos de ejemplo (seed)

`src/data/seed.js` contiene 8 eventos y 5 ideas, derivados del mockup.

**Las fechas NO son fijas.** Se generan con `diaDelMes(día, mesesAdelante)` de `utils/fechas.js`, ancladas al mes en curso. El mockup se diseñó en septiembre de 2025; con fechas literales (`'2025-09-12'`) el calendario del mes actual saldría vacío y "Próximos eventos" no tendría nada que enseñar. Los días 5 y 12, que en el mockup ya habían pasado, se desplazan al mes siguiente.

| Día del mes | Evento | Categoría | Mes |
|---|---|---|---|
| 5 (mes siguiente) | Cine | `cita` | +1 |
| 12 | Nuestro aniversario | `aniversario` | actual |
| 12 (mes siguiente) | Nuestro aniversario | `aniversario` | +1 |
| 14 | Cena romántica (19:00) | `cita` | actual |
| 15 (mes siguiente) | Tentación: completar la colección | `otro` | +1 |
| 19 | Viaje a San Gil | `viaje` | actual |
| 22 | Cumpleaños | `cumpleanos` | actual |
| 26 | Noche de juegos (20:00) | `cita` | actual |

| Ideas | Categoría | Favorita |
|---|---|---|
| Noche de cine en casa | `en-casa` | Sí |
| Picnic en el parque | `afuera` | Sí |
| Escapada de fin de semana | `aventura` | No |
| Cocinar juntos | `en-casa` | No |
| Día de spa en pareja | `relax` | No |

Los `id` del seed son UUID v4 válidos, no texto legible, porque los services los validan con `esIdValido` antes de buscar: un id con formato libre haría que toda operación sobre ese registro devolviera `null` en silencio (sin error visible), rompiendo los corazones y la edición de las ideas de ejemplo.

Las fotos usan `picsum.photos` con semilla fija, así que son deterministas entre recargas. Se sustituyen por las fotos reales de la pareja.

---

## Cuota de almacenamiento

`localStorage` ronda los **5 MB por origen**. Las fotos en base64 ocupan ~33 % más que el binario original, y base64 no comprime. Una decena de fotos de móvil puede agotar el espacio.

Medidas aplicadas:
- `storage.js` detecta `QuotaExceededError` (Chrome/Safari) y `NS_ERROR_DOM_QUOTA_REACHED` (Firefox), y lanza `ErrorCuotaAlmacenamiento` con un mensaje accionable.
- Ese error **no se reescribe** en los services: un mensaje de cuota es accionable ("borra alguna foto"), mientras que "no pudimos guardar" no dice qué hacer. Esto vale también en `citasService.getIdeasCitas()`, que lo propaga sin envolver aunque ocurra al guardar el seed.
- `tamanoAproximado()` estima el consumo, para avisar en Configuración. Cada `getItem` va en su propio `try/catch`: si el almacén se cae a mitad de la cuenta, la pantalla no puede quedarse en blanco por un número cosmético.
- Las imágenes se reducen a 1200 px y se recomprimen a WebP/JPEG ~0.8 antes de guardarse. Una foto de móvil de 4 MB baja a una fracción de eso, y de paso pierde EXIF y GPS.

TODO-FASE2 (SEGURIDAD): en Supabase, las fotos van a Storage (bucket privado) y el `localStorage` desaparece.

---

## Correspondencia con Supabase (adelanto)

Detalle completo en [`docs/MIGRACION_SUPABASE.md`](./MIGRACION_SUPABASE.md).

| Campo (local) | Columna (Supabase) | Tipo |
|---|---|---|
| `id` | `id` | `uuid` PK, `default gen_random_uuid()` |
| — | `pareja_id` | `uuid` FK, **nuevo** (RLS) |
| `titulo` | `titulo` | `text` `not null` |
| `fecha` | `fecha` | `date` |
| `hora` | `hora` | `time` |
| `descripcion` | `descripcion` | `text` |
| `lugar` | `lugar` | `text` |
| `categoria` | `categoria` | `text` con `check` en las 5 opciones |
| `foto` | `foto_path` | `text` → nombre en Storage |
| `creadoEn` | `creado_at` | `timestamptz` `default now()` |
