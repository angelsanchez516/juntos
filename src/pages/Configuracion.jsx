/**
 * Página `Configuracion`.
 *
 * RESPONSABILIDAD: enseñar qué datos guarda la app en ese dispositivo, dónde está
 * la sesión y ofrecer las dos operaciones de Fase 1: restablecer los datos y
 * cerrar la sesión.
 *
 * Related: src/services/storage.js, src/services/sesion.js,
 *   src/services/eventosService.js, src/hooks/useSesion.js,
 *   src/components/ui/Modal.jsx
 *
 * @module pages/Configuracion
 */

import { useCallback, useEffect, useId, useState } from 'react';
import { HardDriveDownload, LogOut, Lock, RotateCcw, Trash2, UserCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Boton from '../components/ui/Boton';
import Modal from '../components/ui/Modal';
import useSesion from '../hooks/useSesion';
import { RUTAS } from '../constants/nav';
import { COLECCIONES, claveDeSesion, leer, listarClaves, resetDatos, tamanoAproximado } from '../services/storage';
import { cerrarSesion } from '../services/sesion';
import { getEventos, resetEventos } from '../services/eventosService';
import { getIdeasCitas } from '../services/citasService';

/**
 * Formatea un número de bytes en una unidad legible.
 *
 * Se usa `Intl.NumberFormat` con unidades decimales porque los tamaños que
 * aparecen aquí rondan el kilobyte, y `24,0 kB` se lee mejor que `24000 B`.
 *
 * @param {number} bytes Tamaño en bytes.
 * @returns {string} Texto como `1,4 MB`.
 */
function formatearTamano(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const unidades = ['B', 'kB', 'MB'];
  const unidad = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
  const valor = bytes / 1024 ** unidad;

  return `${new Intl.NumberFormat('es', { maximumFractionDigits: 1 }).format(valor)} ${unidades[unidad]}`;
}

/**
 * Renderiza la pantalla de configuración.
 *
 * @returns {import('react').ReactElement} Página de configuración.
 */
export default function Configuracion() {
  const [recuento, setRecuento] = useState({ eventos: 0, ideas: 0 });
  const [tamano, setTamano] = useState(0);
  const [claves, setClaves] = useState([]);
  const [preguntando, setPreguntando] = useState(false);
  const [restableciendo, setRestableciendo] = useState(false);
  const [preguntandoCierre, setPreguntandoCierre] = useState(false);
  const [aviso, setAviso] = useState('');

  const navegar = useNavigate();

  /*
   * La sesión se lee con un hook y no a mano, porque "Cerrar sesión" no recarga la
   * página: sin suscripción al evento `storage`, el indicador seguiría diciendo
   * que hay sesión y ofrecería cerrar una sesión que ya no existe.
   */
  const { haySesion: sesionActiva, refrescar: refrescarSesion } = useSesion();

  /*
   * Identificador del párrafo que explica qué se va a borrar. Lo referencia
   * `descripcionAdicional` del modal para que el lector de pantalla lo lea
   * detrás del título, y no solo lo encuentre con los ojos dentro del diálogo.
   */
  const idDetalle = useId();

  /*
   * El del diálogo de cierre de sesión, que necesita el suyo propio: cada `Modal`
   * describe su contenido con un id, y si compartieran el mismo dos diálogos
   * apuntarían al párrafo del otro.
   */
  const idCierre = useId();

  /**
   * Vuelve a leer el almacén y cuenta lo que hay.
   *
   * Lee por los servicios y no desde `storage` a propósito: así lo que se
   * enseña es exactamente lo que la app está usando, con el seed ya aplicado si
   * todavía no había nada. Una cifra sacada de la clave cruda sería cero en la
   * primera visita, que es cuando más engaña.
   *
   * La misma función sirve al montar y después de restablecer. Si el montaje
   * contara por su cuenta y el restablecimiento usara esta, los dos caminos
   * podrían dar números distintos en cuanto uno de los dos se tocara.
   *
   * @returns {Promise<void>} Termina cuando la pantalla está al día.
   */
  const medir = useCallback(async () => {
    const [eventos, ideas] = await Promise.all([getEventos(), getIdeasCitas()]);

    setRecuento({ eventos: eventos.length, ideas: ideas.length });
    setTamano(tamanoAproximado());
    setClaves(listarClaves());
  }, []);

  /*
   * La carga inicial sí va en un efecto, y no es el caso que la regla busca: leer
   * el almacén es un sistema externo, y su respuesta llega por promesa. El
   * `setState` está después del `await`, nunca en el propio cuerpo del efecto,
   * que es lo que convierte una carga en un bucle de renders.
   */
  useEffect(() => {
    let vigente = true;

    getEventos()
      .then(() => getIdeasCitas())
      .then(() => {
        if (!vigente) return;

        setRecuento({
          eventos: leer(COLECCIONES.EVENTOS)?.length ?? 0,
          ideas: leer(COLECCIONES.CITAS)?.length ?? 0,
        });
        setTamano(tamanoAproximado());
        setClaves(listarClaves());
      });

    return () => {
      vigente = false;
    };
  }, []);

  /**
   * Borra los datos y vuelve a sembrar el seed.
   *
   * Tras `resetDatos()` el almacén está vacío, así que `resetEventos()` no haría
   * falta para los eventos; se llama para que las dos colecciones queden
   * sembradas y la pantalla pueda mostrar el recuento sin esperar a que alguien
   * abra el calendario.
   *
   * @returns {Promise<void>} Termina cuando los datos están de vuelta.
   */
  const restablecer = useCallback(async () => {
    setRestableciendo(true);
    try {
      resetDatos();
      await resetEventos();
      await medir();
      setPreguntando(false);
      setAviso('Datos restablecidos. Vuelve a estar todo como el primer día.');
    } catch {
      setPreguntando(false);
      setAviso('No se pudieron restablecer los datos. Inténtalo de nuevo.');
    } finally {
      setRestableciendo(false);
    }
  }, [medir]);

  /**
   * Cierra la sesión y vuelve a la bienvenida.
   *
   * Se borra la clave de sesión y se refresca el estado antes de navegar, para
   * que el indicador no llegue a pintarse con una sesión que ya no existe. La
   * navegación no es un extra: sin ella, quien cerrara sesión seguiría viendo el
   * calendario con el `Layout` montado, y la guarda solo actuaría en el siguiente
   * cambio de ruta.
   *
   * No se deja aviso en `aviso` a propósito. La página se desmonta al navegar,
   * así que un `role="status"` escrito aquí no lo leería nadie; el aviso de que
   * se cerró es cosa de la pantalla a la que se llega, y la bienvenida todavía no
   * lo tiene. Coger `preguntando` y el diálogo es lo que sí hace falta cerrar.
   *
   * Los datos y las fotos no se tocan. Es lo contrario de "Restablecer datos",
   * que borra los datos y conserva la sesión.
   *
   * @returns {void}
   */
  const cerrar = useCallback(() => {
    cerrarSesion();
    refrescarSesion();
    setPreguntandoCierre(false);
    navegar(RUTAS.BIENVENIDA, { replace: true });
  }, [navegar, refrescarSesion]);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-2xl text-slate-900">Configuración</h1>
        <p className="mt-1 text-sm text-slate-500">
          Todo lo que hay aquí ocurre en este dispositivo y en este navegador.
        </p>
      </header>

      {/*
        El resultado de la operación se anuncia con `role="status"`, y no con un
        diálogo: quien acaba de borrar los datos ya está mirando esta misma
        zona, y un `alertdialog` le robaría el foco para repetirle lo que
        acaba de leer.
      */}
      {aviso && (
        <p role="status" className="rounded-card bg-accent/10 px-4 py-3 text-sm text-slate-700">
          {aviso}
        </p>
      )}

      <section
        aria-labelledby="config-sesion"
        className="rounded-card border border-slate-200/70 bg-white p-5 shadow-card"
      >
        <h2 id="config-sesion" className="flex items-center gap-2 font-display text-lg text-slate-900">
          <UserCheck className="size-5 text-accent" aria-hidden="true" />
          Sesión en este dispositivo
        </h2>

        {/*
          El indicador dice si hay sesión, con qué clave y si está activa. Se
          enseña la clave por el mismo motivo que las de los datos: para poder
          depurar en otro navegador.
        */}
        <p className="mt-3 text-sm text-slate-600">
          {sesionActiva ? (
            <>Hay sesión abierta en este navegador.</>
          ) : (
            <>No hay sesión abierta en este navegador.</>
          )}
        </p>

        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Clave</dt>
            <dd>
              <code className="rounded bg-surface px-1.5 py-0.5 text-xs">{claveDeSesion()}</code>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Estado</dt>
            <dd className="font-display text-lg text-slate-900">
              {sesionActiva ? 'Sesión activa' : 'Sesión cerrada'}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-slate-500">
          Esto no es una cuenta ni una autenticación: no hay correo ni contraseña,
          y cualquiera puede escribir esa clave desde la consola del navegador.
          Solo sirve para no volver a mostrar la bienvenida. TODO-FASE2
          (SEGURIDAD): sustituirlo por la sesión de Supabase Auth.
        </p>

        {/*
          El botón se oculta en vez de quedar deshabilitado cuando no hay
          sesión: no hay nada que cerrar, y un botón inactivo que además hay que
          explicar es peor que no estar.
        */}
        {sesionActiva && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Boton variante="secundario" onClick={() => setPreguntandoCierre(true)}>
              <LogOut className="size-4" aria-hidden="true" />
              Cerrar sesión
            </Boton>
            <p className="text-xs text-slate-500">
              Vuelve a la bienvenida. Tus datos y tus fotos se quedan aquí.
            </p>
          </div>
        )}
      </section>

      <section
        aria-labelledby="config-datos"
        className="rounded-card border border-slate-200/70 bg-white p-5 shadow-card"
      >
        <h2 id="config-datos" className="flex items-center gap-2 font-display text-lg text-slate-900">
          <HardDriveDownload className="size-5 text-accent" aria-hidden="true" />
          Datos en este dispositivo
        </h2>

        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Eventos</dt>
            <dd className="font-display text-2xl text-slate-900">{recuento.eventos}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Ideas de cita</dt>
            <dd className="font-display text-2xl text-slate-900">{recuento.ideas}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Espacio usado</dt>
            <dd className="font-display text-2xl text-slate-900">{formatearTamano(tamano)}</dd>
          </div>
        </dl>

        {/*
          Las claves se enseñan tal cual, con su versión. No es información
          técnica: es la misma lista que `listarClaves()` devuelve, y sirve para
          que quien depure en otro navegador vea si la app está escribiendo donde
          cree. Qué se hará con ellas en la Fase 2 está anotado en
          docs/MIGRACION_SUPABASE.md.
        */}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-700">
            Ver las claves que usa la app
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {claves.length === 0 ? (
              <li>Ahora mismo no hay ninguna clave guardada.</li>
            ) : (
              claves.map((clave) => (
                <li key={clave}>
                  <code className="rounded bg-surface px-1.5 py-0.5">{clave}</code>
                </li>
              ))
            )}
          </ul>
        </details>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Boton variante="secundario" onClick={() => setPreguntando(true)}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Restablecer datos
          </Boton>
          <p className="text-xs text-slate-500">
            Vuelve a los datos de ejemplo y borra lo que habéis añadido.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="config-privacidad"
        className="rounded-card border border-slate-200/70 bg-white p-5 shadow-card"
      >
        <h2 id="config-privacidad" className="flex items-center gap-2 font-display text-lg text-slate-900">
          <Lock className="size-5 text-accent" aria-hidden="true" />
          Privacidad
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>
            Lo que escribís se queda en este navegador. No sale a ningún servidor: en
            esta fase no hay cuenta ni nube.
          </li>
          <li>
            Las fotos de los datos de ejemplo vienen de un servicio de Internet, así
            que al verlas esa dirección ya está siendo contactada.
          </li>
          <li>
            Si dos personas usan el mismo navegador, ven lo mismo. Todavía no hay
            forma de separar una pareja de otra.
          </li>
        </ul>
      </section>

      {/*
        `alertdialog` y no `dialog`: la pregunta es si se borran fotos que no
        tienen copia en ninguna parte. Un diálogo normal se trataría como una
        ventana más y quien fuera con lector de pantalla podría no enterarse de
        que hay una decisión esperándole.

        El aviso va como contenido del modal y los dos botones en su `pie`, en
        vez de reutilizar `ConfirmarSalida`. Ese componente trae su propio
        `role="alertdialog"`, su propio título ("¿Salir sin guardar?") y sus
        propios botones, pensado para el aviso de un formulario. Puesto aquí
        dentro, la pantalla habría tenido dos diálogos anidados con dos títulos
        que dicen cosas distintas, y cuatro botones para una sola decisión.
      */}
      <Modal
        abierto={preguntando}
        onCerrar={() => setPreguntando(false)}
        titulo="¿Restablecer los datos?"
        descripcion="Esta acción no se puede deshacer."
        descripcionAdicional={[idDetalle]}
        rol="alertdialog"
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setPreguntando(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" cargando={restableciendo} onClick={restablecer}>
              <Trash2 className="size-4" aria-hidden="true" />
              Sí, restablecer
            </Boton>
          </>
        }
      >
        {/*
          El foco inicial lo pone el `Modal` en el panel, no en un botón. Es lo
          que ya hace el resto de diálogos de la app, y deja el botón
          destructivo a un Tab de distancia: quien abra el diálogo por accidente
          y pulse Enter no borra nada.
        */}
        <p id={idDetalle} className="text-sm text-slate-600">
          Se borrarán los {recuento.eventos} eventos y las {recuento.ideas} ideas de cita,
          incluidas las fotos que habéis subido, y volverán a aparecer los datos de
          ejemplo.
        </p>
      </Modal>

      {/*
        Diálogo de cierre de sesión, con su propio `alertdialog` y NO reutilizando
        `ConfirmarSalida`, que trae su propio `role`, su propio título ("¿Salir sin
        guardar?") y sus propios botones: aquí eso sería un segundo diálogo dentro
        del primero, con dos títulos distintos y cuatro botones para una decisión.

        El aviso importa menos que en el otro caso: cerrar sesión no borra nada y se
        puede deshacer pulsando "Comenzar", así que no es `alertdialog` por el
        riesgo sino por la misma coherencia de la pantalla. `dialog` habría bastado.
      */}
      <Modal
        abierto={preguntandoCierre}
        onCerrar={() => setPreguntandoCierre(false)}
        titulo="¿Cerrar la sesión?"
        descripcion="Volverás a la pantalla de bienvenida en este dispositivo."
        descripcionAdicional={[idCierre]}
        rol="alertdialog"
        pie={
          <>
            <Boton variante="fantasma" onClick={() => setPreguntandoCierre(false)}>
              Cancelar
            </Boton>
            <Boton variante="primario" onClick={cerrar}>
              <LogOut className="size-4" aria-hidden="true" />
              Sí, cerrar sesión
            </Boton>
          </>
        }
      >
        <p id={idCierre} className="text-sm text-slate-600">
          Tus {recuento.eventos} eventos y tus {recuento.ideas} ideas de cita, con sus
          fotos, se quedan guardados: cerrar sesión no borra nada. Para volver a entrar
          en esta fase hay que pulsar "Comenzar" otra vez.
        </p>
      </Modal>
    </div>
  );
}
