import Link from 'next/link';
import { pasosIniciales } from '@/lib/dominio/checklist';
import { estaEnCurso, etiquetaDia, horaLocal, hoyISO, rangoDelDia, ZONA } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { ETIQUETA_ESTADO, esEstadoTurno } from '@/lib/dominio/turnos';
import { EstadoVacio } from '@/components/marca/EstadoVacio';
import { cambiarEstado } from './turnos/actions';

function pesos(n: number): string {
  return `$${n.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

export default async function InicioPage() {
  const ctx = await obtenerContexto();
  const plantilla = plantillaDe(ctx.negocio.tipo);

  const supabase = await crearClienteServidor();
  // RLS ya limita a las agendas que este usuario puede ver.
  const { data: pendientesData } = puede(ctx.rol, 'gestionar_turnos')
    ? await supabase
        .from('turnos')
        .select('id, inicio, nota_cliente, servicio:servicios(nombre), cliente:clientes(id, nombre, telefono)')
        .eq('estado', 'pendiente')
        .gte('inicio', new Date().toISOString())
        .order('inicio')
        .limit(20)
    : { data: [] };
  const pendientes = pendientesData ?? [];

  // Hoy: turnos del día e indicadores (los ingresos solo con permiso).
  const hoy = hoyISO();
  const { desde, hasta } = rangoDelDia(hoy);
  const veTurnos = puede(ctx.rol, 'gestionar_turnos');
  const veIngresos = puede(ctx.rol, 'ver_ingresos');
  const [{ data: hoyData }, { data: ventasHoy }] = await Promise.all([
    veTurnos
      ? supabase
          .from('turnos')
          .select('id, inicio, fin, estado, monto_cobrado, servicio:servicios(nombre), cliente:clientes(nombre)')
          .gte('inicio', desde)
          .lt('inicio', hasta)
          .order('inicio')
      : Promise.resolve({ data: [] as never[] }),
    veIngresos && ctx.negocio.vende_productos
      ? supabase.from('ventas').select('monto').gte('created_at', desde).lt('created_at', hasta)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const turnosHoy = (hoyData ?? []).filter((t) => t.estado !== 'cancelado');
  const cobradoHoy =
    turnosHoy.reduce((s, t) => s + Number(t.monto_cobrado ?? 0), 0) +
    (ventasHoy ?? []).reduce((s, v) => s + Number(v.monto), 0);
  const quedan = turnosHoy.filter((t) => t.estado === 'confirmado' || t.estado === 'pendiente').length;

  let pasos: ReturnType<typeof pasosIniciales> = [];
  if (ctx.rol.es_dueno) {
    const contar = async (tabla: 'miembros' | 'servicios' | 'recursos' | 'horarios') => {
      const { count } = await supabase.from(tabla).select('id', { count: 'exact', head: true });
      return count ?? 0;
    };
    const [cantidadMiembros, cantidadServicios, cantidadRecursos, cantidadHorarios] = await Promise.all([
      contar('miembros'),
      contar('servicios'),
      contar('recursos'),
      contar('horarios'),
    ]);
    pasos = pasosIniciales(
      { cantidadMiembros: cantidadMiembros || 1, cantidadServicios, cantidadRecursos, cantidadHorarios },
      plantilla.recurso,
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="titulo">Hola, {ctx.miembro.nombre}</h2>
        <p className="text-niebla">
          Acá vas a manejar tus {plantilla.reserva.plural} y tus {plantilla.recurso.plural}.
        </p>
      </section>

      {veTurnos && (
        <section aria-label="Hoy" className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <h3 className="subtitulo">Hoy <span className="font-mono text-sm font-normal tracking-normal text-niebla normal-case">{etiquetaDia(hoy)}</span></h3>
            <Link href="/panel/turnos" className="enlace text-sm">Ver agenda</Link>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <div className="tarjeta">
              <dt className="etiqueta">{plantilla.reserva.plural}</dt>
              <dd className="truncate font-display text-3xl font-bold sm:text-4xl">{turnosHoy.length}</dd>
            </div>
            <div className="tarjeta">
              <dt className="etiqueta">Quedan</dt>
              <dd className="truncate font-display text-3xl font-bold sm:text-4xl text-cielo">{quedan}</dd>
            </div>
            <div className="tarjeta">
              <dt className="etiqueta">{veIngresos ? 'Cobrado' : 'A confirmar'}</dt>
              <dd className="truncate font-display text-3xl font-bold sm:text-4xl">{veIngresos ? pesos(cobradoHoy) : pendientes.length}</dd>
            </div>
          </dl>
          {turnosHoy.length === 0 ? (
            <EstadoVacio titulo={`No tenés ${plantilla.reserva.plural} hoy.`}>
              Compartí tu página <span className="font-mono text-cielo">/b/{ctx.negocio.slug}</span> para que te pidan.
            </EstadoVacio>
          ) : (
            <ul className="lista">
              {turnosHoy.map((t) => {
                const estado = esEstadoTurno(t.estado) ? t.estado : 'pendiente';
                const ahora = estado === 'confirmado' && estaEnCurso(t.inicio, t.fin);
                const servicio = t.servicio as unknown as { nombre: string } | null;
                const cliente = t.cliente as unknown as { nombre: string } | null;
                const pasado = estado === 'completado' || estado === 'no_vino';
                return (
                  <li key={t.id} className={`flex items-center gap-4 px-4 py-3 ${pasado ? 'text-niebla' : ''}`}>
                    <span className="w-12 shrink-0 font-mono text-sm">{horaLocal(t.inicio)}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {servicio?.nombre} <span className="text-niebla">· {cliente?.nombre}</span>
                    </span>
                    <span
                      className={`capsula min-h-0 py-0.5 text-xs tracking-[0.1em] uppercase ${
                        ahora ? 'capsula-ahora' : estado === 'confirmado' ? 'capsula-reservado' : estado === 'pendiente' ? 'border border-senal text-senal' : 'capsula-pasado'
                      }`}
                    >
                      {ahora ? 'Ahora' : ETIQUETA_ESTADO[estado]}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {pendientes.length > 0 && (
        <section aria-label="Pendientes de confirmar" className="space-y-3 rounded-2xl border border-senal bg-grafito p-4">
          <h3 className="subtitulo">Pendientes de confirmar ({pendientes.length})</h3>
          <ul className="space-y-3">
            {pendientes.map((t) => {
              const cliente = t.cliente as unknown as { id: string; nombre: string; telefono: string } | null;
              const servicio = t.servicio as unknown as { nombre: string } | null;
              const fecha = new Date(t.inicio).toLocaleDateString('en-CA', { timeZone: ZONA });
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-noche p-3 text-sm">
                  <span>
                    <span className="capitalize">{etiquetaDia(fecha)}</span> <span className="font-mono text-senal">{horaLocal(t.inicio)}</span> · {servicio?.nombre}
                    <br />
                    {cliente && <Link href={`/panel/clientes/${cliente.id}`} className="enlace">{cliente.nombre}</Link>}
                    {cliente && ` · ${cliente.telefono}`}
                    {t.nota_cliente && <span className="text-niebla"> · “{t.nota_cliente}”</span>}
                  </span>
                  <span className="flex gap-2">
                    {(['confirmado', 'cancelado'] as const).map((estado) => (
                      <form key={estado} action={cambiarEstado}>
                        <input type="hidden" name="turnoId" value={t.id} />
                        <input type="hidden" name="estado" value={estado} />
                        <input type="hidden" name="fecha" value={fecha} />
                        <button className={estado === 'confirmado' ? 'boton' : 'boton-sec'}>{estado === 'confirmado' ? 'Confirmar' : 'Rechazar'}</button>
                      </form>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ctx.rol.es_dueno && (
        <p className="text-sm text-niebla">
          Tu página para pedir turnos:{' '}
          <a href={`/b/${ctx.negocio.slug}`} target="_blank" className="enlace font-mono">/b/{ctx.negocio.slug}</a>
        </p>
      )}

      {pasos.length > 0 && (
        <section aria-label="Primeros pasos" className="tarjeta">
          <h3 className="subtitulo mb-3">Primeros pasos</h3>
          <ul className="space-y-2">
            {pasos.map((p) => (
              <li key={p.id} className={`flex items-center gap-3 ${p.hecho ? 'text-niebla' : ''}`}>
                <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${p.hecho ? 'bg-cielo' : 'border border-niebla'}`} />
                <span className="sr-only">{p.hecho ? 'Hecho:' : 'Pendiente:'}</span>
                {p.href && !p.hecho ? <Link href={p.href} className="enlace">{p.texto}</Link> : <span>{p.texto}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Consejos" className="tarjeta">
        <h3 className="subtitulo mb-3">Consejos para {plantilla.etiqueta.toLowerCase()}</h3>
        <ul className="list-disc space-y-2 pl-5 text-niebla">
          {plantilla.tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </div>
  );
}
