import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { EstadoVacio } from '@/components/marca/EstadoVacio';
import { SelectorDias } from '@/components/marca/SelectorDias';
import { diasDesde, esFechaISO, etiquetaDia, horaLocal, hoyISO, ZONA } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { moverTurno } from '../../actions';

interface Params {
  fecha?: string;
  servicio?: string;
  recurso?: string;
  error?: string;
}

export default async function MoverTurnoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_turnos')) redirect('/panel');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const p = await searchParams;
  const plantilla = plantillaDe(ctx.negocio.tipo);

  const supabase = await crearClienteServidor();
  const [{ data: turno }, { data: recursosData }, { data: serviciosData }, { data: vinculos }, { data: negocio }] =
    await Promise.all([
      supabase
        .from('turnos')
        .select('id, inicio, estado, recurso_id, servicio_id, servicio:servicios(nombre), cliente:clientes(nombre)')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('recursos').select('id, nombre').eq('activo', true).order('orden').order('nombre'),
      supabase.from('servicios').select('id, nombre, duracion_min').eq('activo', true).order('nombre'),
      supabase.from('recurso_servicio').select('recurso_id, servicio_id'),
      supabase.from('negocios').select('anticipacion_max_dias').eq('id', ctx.negocio.id).single(),
    ]);
  if (!turno) notFound();
  const fechaActual = new Date(turno.inicio).toLocaleDateString('en-CA', { timeZone: ZONA });
  if (turno.estado !== 'pendiente' && turno.estado !== 'confirmado') {
    redirect(`/panel/turnos?fecha=${fechaActual}&error=${encodeURIComponent('Solo se mueven turnos pendientes o confirmados.')}`);
  }

  const recursos = recursosData ?? [];
  const servicios = serviciosData ?? [];
  const servicioId = servicios.some((s) => s.id === p.servicio) ? p.servicio! : turno.servicio_id;
  const recursosDelServicio = recursos.filter((r) =>
    (vinculos ?? []).some((v) => v.recurso_id === r.id && v.servicio_id === servicioId),
  );
  const recursoId = recursosDelServicio.find((r) => r.id === (p.recurso ?? turno.recurso_id))?.id ?? recursosDelServicio[0]?.id;
  const hoy = hoyISO();
  const fecha = esFechaISO(p.fecha) && p.fecha >= hoy ? p.fecha : fechaActual >= hoy ? fechaActual : hoy;

  const { data: huecosData } = recursoId
    ? await supabase.rpc('huecos_para_mover', { p_turno: id, p_recurso: recursoId, p_servicio: servicioId, p_fecha: fecha })
    : { data: [] };
  const huecos = huecosData ?? [];
  const servicio = turno.servicio as unknown as { nombre: string } | null;
  const cliente = turno.cliente as unknown as { nombre: string } | null;
  const esLaActual = (inicio: string) =>
    recursoId === turno.recurso_id && new Date(inicio).getTime() === new Date(turno.inicio).getTime();

  return (
    <div className="space-y-8">
      <p><Link href={`/panel/turnos?fecha=${fechaActual}`} className="enlace text-sm">← Turnos</Link></p>
      <h2 className="titulo">Mover {plantilla.reserva.singular}</h2>
      {p.error && <p role="alert" className="aviso-error">{p.error}</p>}

      <section aria-label="Turno actual" className="tarjeta flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="etiqueta">Ahora</span>
        <span className="font-mono text-senal">{horaLocal(turno.inicio)}</span>
        <span className="capitalize">{etiquetaDia(fechaActual)}</span>
        <span className="text-niebla">
          {servicio?.nombre} · {cliente?.nombre} · {recursos.find((r) => r.id === turno.recurso_id)?.nombre}
        </span>
      </section>

      <form method="get" className="space-y-4 tarjeta">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Servicio
            <select name="servicio" defaultValue={servicioId} className="campo">
              {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre} · {s.duracion_min} min</option>)}
            </select>
          </label>
          <label className="text-sm capitalize">{plantilla.recurso.singular}
            <select name="recurso" defaultValue={recursoId} className="campo">
              {recursosDelServicio.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
        </div>
        <SelectorDias
          etiqueta="Día"
          nombre="fecha"
          hoy={hoy}
          dias={diasDesde(hoy, Math.min(negocio?.anticipacion_max_dias ?? 30, 60) + 1)}
          seleccionado={fecha}
        />
        <button className="boton-sec">Ver horarios</button>
      </form>

      <section aria-label="Horarios libres" className="space-y-4">
        <h3 className="subtitulo">{etiquetaDia(fecha)}</h3>
        {!recursoId ? (
          <EstadoVacio titulo={`Nadie hace ese servicio.`}>Asignalo en {plantilla.recurso.plural}.</EstadoVacio>
        ) : huecos.length === 0 ? (
          <EstadoVacio titulo="No hay horarios libres ese día.">Probá con otro día o con otra persona.</EstadoVacio>
        ) : (
          <form action={moverTurno} className="space-y-4">
            <input type="hidden" name="turnoId" value={turno.id} />
            <input type="hidden" name="servicioId" value={servicioId} />
            <input type="hidden" name="recursoId" value={recursoId} />
            <input type="hidden" name="fecha" value={fecha} />
            <fieldset className="flex flex-wrap gap-2">
              <legend className="etiqueta mb-2">Horarios libres</legend>
              {huecos.map((h) => (
                <label key={h.inicio} className="relative cursor-pointer">
                  <input type="radio" name="inicio" value={h.inicio} required disabled={esLaActual(h.inicio)} className="peer sr-only" />
                  <span className="inline-flex min-h-11 items-center rounded-full border border-cielo px-4 py-2 font-mono text-sm text-cielo transition-colors hover:bg-cielo/10 peer-checked:bg-cielo peer-checked:text-noche peer-focus-visible:ring-2 peer-focus-visible:ring-cielo peer-disabled:cursor-default peer-disabled:border-senal peer-disabled:bg-senal peer-disabled:text-noche">
                    {horaLocal(h.inicio)}
                    {esLaActual(h.inicio) && <span className="sr-only"> (horario actual)</span>}
                  </span>
                </label>
              ))}
            </fieldset>
            <button className="boton">Mover acá</button>
          </form>
        )}
      </section>
    </div>
  );
}
