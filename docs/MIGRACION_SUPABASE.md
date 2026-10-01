# MIGRACIÓN A SUPABASE — Juntos

Cómo sustituir la capa `services/` (hoy `localStorage`) por Supabase **sin tocar ninguna página ni componente**.

> Este documento se redactó inmediatamente después de escribir los services del paso b, que es el momento en que las equivalencias se pueden ver con certeza. Se irá completando según se construyan los pasos siguientes.

---

## El principio de la arquitectura

```
Página/Componente  →  Hook  →  Service  →  (localStorage | Supabase)
                     ▲
                     │
              No cambia nunca
```

Las páginas **nunca** llaman a Supabase directamente. Si lo hicieran, habría que reescribirlas en Fase 2. Esa es la razón de que los services sean `async` aunque el backing store sea local: la firma no cambia al migrar.

Consecuencia práctica: **esta migración es un cambio confinado a `src/services/`**. Los imports de `useEventos` y `useCitas` en las páginas siguen siendo válidos.

---

## Esquema de base de datos

```sql
-- Parentes: agrupa los datos de una pareja. Es la unidad de autorización.
create table parejas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  fecha_inicio  date,
  creado_at     timestamptz not null default now()
);

-- Controles: quién puede leer y escribir.
create type rol_couple as enum ('propietario', 'pareja');

create table miembros (
  pareja_id   uuid not null references parejas(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rol         rol_couple not null default 'pareja',
  primary key (pareja_id, user_id)
);

create table eventos (
  id           uuid primary key default gen_random_uuid(),
  pareja_id    uuid not null references parejas(id) on delete cascade,
  titulo       text not null check (char_length(titulo) between 3 and 120),
  fecha        date not null,
  hora         time,
  descripcion  text not null default '' check (char_length(descripcion) <= 500),
  lugar        text not null default '' check (char_length(lugar) <= 160),
  categoria    text not null check (categoria in
                 ('cita','aniversario','viaje','cumpleanos','otro')),
  foto_path    text,                -- nombre del objeto en Storage, no la URL
  creado_at    timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);

create table ideas_citas (
  id           uuid primary key default gen_random_uuid(),
  pareja_id    uuid not null references parejas(id) on delete cascade,
  titulo       text not null check (char_length(titulo) between 3 and 120),
  descripcion  text not null default '' check (char_length(descripcion) <= 500),
  categoria    text not null check (categoria in
                 ('en-casa','afuera','aventura','relax')),
   favorita     boolean not null default false,
  imagen_path  text,
  creado_at    timestamptz not null default now()
);
```

Los `check` del esquema replican `src/utils/validaciones.js`. El cliente valida para dar feedback inmediato; **la base de datos es la frontera real**, porque no se puede esquivar desde fuera.

### `IdeaCita.origen` no viaja a Supabase

En Fase 1, `IdeaCita` lleva un campo `origen` (`'seed'` o `'usuario'`) que decide si la idea se puede editar o borrar. **Esa columna no existe en el esquema de arriba, y no debe añadirse.**

El problema que resuelve `origen` es concreto de Fase 1: la app siembra 5 ideas de ejemplo en el mismo almacén donde la pareja crea las suyas, y sin una marca no hay forma de distinguir unas de otras salvo por los ids o por el texto, que se rompen en cuanto cambia el seed.

En Supabase el problema desaparece por sí solo, porque el aislamiento lo da la fila:

- Cada idea tiene su `id`, y cada escritura lleva el `pareja_id` de la sesión. Solo existen ideas de la pareja.
- El ejemplo se crea al dar de alta la pareja, en `seed.js` **de la Fase 2**, y en ese momento se conoce qué filas son de ejemplo.

Si aun así hiciera falta mostrarlas como "sugeridas" en lugar de "vuestras", la forma correcta no es una columna `origen` sino una marca de creación, por ejemplo `creado_por text not null default 'pareja'`, que distingue lo seed de lo propio sin depender del contenido. Lo que no debe hacerse es portar el campo tal cual: en Fase 2 ya no es la fuente de verdad y acabaría siendo un dato que hay que mantener sincronizado sin que nada lo exija.

### Las claves de categoría son slugs, y eso obliga a migrar

`categoria` es un `text` con `check`, no un `enum`. Las claves son slugs ASCII
(`cumpleanos`, `en-casa`) porque van al almacén, a la URL y a estos `check`; la
etiqueta visible ("Cumpleaños", "En casa") vive solo en el `label` del catálogo
del cliente.

La consecuencia práctica: **cambiar un slug es una migración de datos, no un
cambio de código.** Si algún día se renombra una categoría, hay que hacer las dos
cosas en el mismo despliegue, o el `check` y los datos quedarán desalineados:

```sql
-- 1. Datos primero: todo lo que no se actualice violará el check nuevo.
update eventos
   set categoria = 'cumpleanos'
 where categoria = 'cumpleaños' or categoria = 'cumpleanos';

update ideas_citas
   set categoria = 'en-casa'
 where categoria = 'en casa' or categoria = 'en casa';

-- 2. Constraint, después.
alter table eventos
  drop constraint eventos_categoria_check,
  add  constraint eventos_categoria_check
  check (categoria in ('cita','aniversario','viaje','cumpleanos','otro'));
```

El orden importa. Si se suelta el `check` antes de actualizar los datos, el
`update` se cuela sin problema pero la tabla queda admitiendo temporalmente
valores que el cliente ya no puede generar.

Subir `VERSION_DATOS` en el cliente **no** migra nada aquí: solo cambia la clave
de `localStorage`. En Fase 2 el equivalente es una migración de datos en
Supabase, y por eso tiene que acompañar al cambio de código.

### Etiquetas traducibles

Con un `check` de slugs, la etiqueta no está en la base de datos: sale del
catálogo del cliente. Si algún día hay que mostrar las categorías en otro
idioma, o añadirlas desde un panel de administración, la lista pasa a ser una
tabla `categorias` con su propia tabla de traducciones, y el `check` se
sustituye por una clave foránea. Es más trabajo, pero es el punto en el que
empezar a hardcodear slugs en la base de datos se paga caro.

---

## Row Level Security

Es la pieza de seguridad más importante y la que no existe hoy. Sin esto, cualquier persona con la URL de la API podría leer los recuerdos de otra pareja.

```sql
alter table eventos      enable row level security;
alter table ideas_citas  enable row level security;
alter table parejas      enable row level security;
alter table miembros     enable row level security;

-- ¿Es la persona usuaria miembro de esta pareja?
create or replace function es_miembro(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros
    where pareja_id = p and user_id = auth.uid()
  );
$$;

-- Eventos: solo los de las parejas a las que pertenece.
create policy "leer eventos propios" on eventos
  for select using (es_miembro(pareja_id));

create policy "crear eventos propios" on eventos
  for insert with check (es_miembro(pareja_id));

create policy "actualizar eventos propios" on eventos
  for update using (es_miembro(pareja_id))
  with check (es_miembro(pareja_id));

create policy "borrar eventos propios" on eventos
  for delete using (es_miembro(pareja_id));
-- (Idénticas para ideas_citas.)
```

Detalle importante: con RLS, un `select` sobre un evento de otra pareja devuelve **cero filas**, no un error. Por eso `getEventoById` debe devolver `null` y no propagar un 404: un "no encontrado" explícito confirmaría que ese id existe.

---

## Equivalencia función por función

### `eventosService.js`

| Función actual (localStorage) | Equivalente en Supabase | Notas |
|---|---|---|
| `getEventos()` | `supabase.from('eventos').select('*').order('fecha')` | RLS filtra por `pareja_id` automáticamente. El orden por `fecha` mantiene el contrato actual. |
| `getEventoById(id)` | `supabase.from('eventos').select('*').eq('id', id).maybeSingle()` | **`maybeSingle()`**: devuelve `null` si no hay fila, sin lanzar error. Es lo que mantiene el "no encontrado" indistinguible de "no es tuyo". |
| `crearEvento(datos)` | `.insert({...}).select().single()` | El `id` lo genera la base de datos. La pareja se obtiene de la sesión, **nunca del cliente**. |
| `actualizarEvento(id, datos)` | `.update({...}).eq('id', id).select().single()` | Se elimina la fusión con el existente: la base de datos tiene el registro completo y los `check` de la tabla validan el resultado. |
| `eliminarEvento(id)` | `.delete().eq('id', id)` | Comprobar `data`/`error` para saber si había fila. |
| `resetEventos()` | `delete` de los datos de la pareja | **Ojo:** es una operación destructiva. En Fase 2 debe pedir confirmación explícita y quedar fuera de la UI de producción, o pasar a ser "borrar cuenta". |

### `citasService.js`

| Función actual | Equivalente en Supabase | Notas |
|---|---|---|
| `getIdeasCitas()` | `from('ideas_citas').select('*').order('favorita', {ascending:false}).order('titulo')` | El orden favoritas-primero pasa del cliente a la consulta. |
| `getIdeaById(id)` | `.eq('id', id).maybeSingle()` | Igual que eventos. |
| `crearIdea(datos)` | `.insert({...}).select().single()` | |
| `actualizarIdea(id, datos)` | `.update({...}).eq('id', id).select().single()` | |
| `toggleFavorita(id)` | `rpc('alternar_favorita', { p_id: id })` | **Considerar una función RPC** en vez de leer y escribir: leer-modificar-escribir tiene una condición de carrera si la pareja pulsa el corazón a la vez desde dos dispositivos. |
| `eliminarIdea(id)` | `.delete().eq('id', id)` | |
| `convertirIdeaEnEvento(id, {fecha, hora, lugar})` | `rpc('convertir_idea_en_evento', {...})` | **RPC con `transaction`**: crea el evento y (opcionalmente) marca la idea como usada, de forma atómica. Nunca dos acciones separadas: si la segunda falla, quedaría un evento sin origen. |
| `esIdeaEditable(idea)` | **Desaparece** | Es una regla de Fase 1 que depende de `origen`. En Supabase todas las ideas de la sesión son de la pareja, así que la comprobación se elimina del service, del hook y de la tarjeta. Ver "IdeaCita.origen no viaja a Supabase". |

### `storage.js`

| Función actual | Equivalente | Notas |
|---|---|---|
| `leer(coleccion)` | La consulta Supabase correspondiente | Desaparece: no hay caché local que leer. |
| `guardar(coleccion, datos)` | `insert`/`update`/`delete` | Desaparece. |
| `borrar(coleccion)` | `.delete()` filtrado por `pareja_id` | |
| `resetDatos()` | `rpc('borrar_datos_pareja')` | |
| `storageDisponible()` | Comprobación de `session` | |
| `esCuotaAgotada(error)` | **Ya no aplica** | Supabase no tiene la cuota de 5 MB. Desaparece, y con ella el problema que motivó comprimir las imágenes en el paso d. |
| `listarClaves()`, `tamanoAproximado()` | Desaparecen | Sin almacenamiento local que medir. |
| `VERSION_DATOS`, `claveDe()`, `limpiarVersionesAnteriores()` | Desaparecen | No hay esquema local que versionar: el `check` de cada columna hace ese trabajo, y una migración de datos es un `alter table` explícito. |
| `VERSION_SESION`, `claveDeSesion()` | **Desaparecen, pero no se sustituyen** | En Fase 2 la sesión vive en la cookie de Supabase Auth, en el servidor, no en el navegador. Este es el punto donde `VERSION_SESION` deja de tener sentido: ver `docs/SEGURIDAD.md`. |

**La única pieza de `storage.js` que sobrevive** es la capa de tolerancia a fallos: los services deben seguir envueltos en `try/catch` yuir la sesión, o una caída de red, y devolver un mensaje presentable.

---

## Fotos: de base64 a Supabase Storage

Es el cambio más grande de comportamiento, y el que más mejora la app.

**Hoy (Fase 1):** la foto se convierte a base64 y se guarda dentro del propio registro del evento. Esto duplica el peso de cada lectura de `getEventos()` y agota la cuota rápido.

**En Fase 2:** la foto va a un bucket privado y el evento solo guarda la ruta.

```js
// Subida
const { data, error } = await supabase.storage
  .from('fotos-eventos')
  .upload(`${parejaId}/${crypto.randomUUID()}.jpg`, blob, {
    contentType: 'image/jpeg',
    // TODO-FASE2 (SEGURIDAD): bucket privado. Con `public: true` las fotos
    // quedarían accesibles a quien conozca la URL.
    upsert: false,
  });

// Lectura: URL firmada, con caducidad.
const { data: { signedUrl } } = await supabase.storage
  .from('fotos-eventos')
  .createSignedUrl(evento.foto_path, 3600);
```

Consecuencias para la UI:
- `getEventos()` deja de traer la imagen en línea: hay que pedir las URLs firmadas aparte (o un endpoint que las adjunte).
- La compresión a 1200 px del paso d sigue siendo recomendable, pero ya no es una necesidad de cuota.
- Al eliminar un evento hay que eliminar también el objeto del Storage, o quedaran archivos huérfanos. Conviene hacerlo con un trigger o una función.

### Lo que este cambio obliga a revisar en la galería

La galería (paso f) es hoy una **vista** sobre los eventos: sus fotos son
`Evento.foto` y `src/utils/galeria.js` las deriva de la lista. Eso es lo que le
permite no tener clave de almacenamiento ni service propios.

Dos cosas se rompen con el cambio a Storage, y conviene decidir cuál se quiere
antes de escribir código:

1. **Las URLs firmadas caducan.** Si la galería pide la imagen en línea como hoy,
   una galería abierta durante más de una hora empezará a mostrar el degradado de
   reserva en las fotos viejas. Con la foto dentro del registro esto no pasa.
2. **Varias fotos por evento.** Hoy el modelo tiene un solo `foto`. Si en Fase 2
   un recuerdo admite varias fotos, la galería deja de poder derivarse y necesita
   su propio service y su propia tabla.

Mientras tanto, la decisión menos costosa es **mantener `foto` en la respuesta de
`getEventos()`** —es decir, pedir las URLs firmadas en el mismo `select`— para no
tocar `extraerFotos()`. Si más adelante se admite más de una foto por evento, el
cambio se acota a `src/utils/galeria.js` y a un service nuevo.


---

## Autenticación

```js
// Registro / inicio de sesión por correo con OTP magic link.
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${window.location.origin}/` },
});

// Listener de cambios de sesión.
supabase.auth.onAuthStateChange((evento, sesion) => {
  // 'SIGNED_OUT' → limpiar el estado y volver a /bienvenida
});
```

`/bienvenida` deja de ser un `navegar('/')` y pasa a esperar la sesión real. Las rutas de React Router se vuelven **protegidas**: sin sesión, redirect a `/bienvenida`.

---

## Pasos concretos de la migración

1. Crear el proyecto en Supabase y ejecutar el esquema SQL de arriba.
2. Habilitar RLS y crear las políticas.
3. `npm install @supabase/supabase-js`.
4. Crear `src/services/supabaseClient.js` con la URL y la clave anónima.
5. Reescribir las funciones de `eventosService.js` manteniendo **las mismas firmas y los mismos tipos de error** (`ErrorServicio`, `null` en no encontrado).
6. Idem con `citasService.js`.
7. Crear las RPC de `toggleFavorita` y `convertirIdeaEnEvento`.
8. Borrar `storage.js` (o dejar solo la capa de manejo de errores).
9. Conectar Storage y subir las fotos.
10. Sustituir `Bienvenida` por el flujo de sesión real.
11. **Verificar que ninguna página importa `@supabase/supabase-js` directamente.** Es la comprobación que garantiza que la arquitectura aguantó.

---

## Qué no hay que tocar

- `src/hooks/useEventos.js` y `useCitas.js`: siguen hablando con la misma interfaz.
- `src/pages/*`: ni una línea.
- `src/components/*`: ni una línea.
- `src/utils/validaciones.js`: pasa a ser la **referencia** de lo que valida la base de datos, no una segunda barrera.
- `src/types/models.js`: los tipos pasan a mapear 1:1 con las columnas.

Esa es la prueba de que la separación por capas de la Fase 1 funcionó.
