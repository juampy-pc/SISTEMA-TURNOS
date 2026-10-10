import Link from 'next/link';
import { redirect } from 'next/navigation';
import { esFechaISO, etiquetaDia, horaLocal, hoyISO, rangoDelDia, sumarDias } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { ESTADOS_TURNO, ETIQUETA_ESTADO, esEstadoTurno, transicionesDe } from '@/lib/dominio/turnos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { cambiarEstado, crearTurno } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white';
const botonSec = 'min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm';
const COLOR: Record<(typeof ESTADOS_TURNO)[number], string> = {
  pendiente: 'bg-amber-100 text-amber-900',
  confirmado: 'bg-blue-100 text-blue-900',
  completado: 'bg-green-100 text-green-900',
  cancelado: 'bg-stone-200 text-stone-600',
  no_vino: 'bg-red-100 text-red-900',
};

interface Params {
  ok?: string;
  error?: string;
  fecha?: string;
  servicio?: string;
  recurso?: string;
  nombre?: string;
  telefono?: string;
  nota?: string;
}

export default async function TurnosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_turnos')) redirect('/panel');
  const p = await searchParams;
  const fecha = esFechaISO(p.fecha) ? p.fecha : hoyISO();
  const plantilla = plantillaDe(ctx.negocio.tipo);

  const supabase = await crearClienteServidor();
  const { desde, hasta } = rangoDelDia(fecha);
  const [{ data: turnosData }, { data: recursosData }, { data: serviciosData }, { data: vinculos }] = await Promise.all([
    supabase
      .from('turnos')
      .select('id, inicio, fin, estado, notas, nota_cliente, monto_cobrado, dispositivo_id, recurso_id, servicio:servicios(nombre, precio), cliente:clientes(id, nombre, telefono)')
      .gte('inicio', desde)
      .lt('inicio', hasta)
      .order('inicio'),
    supabase.from('recursos').select('id, nombre').eq('activo', true).order('orden').order('nombre'),
    supabase.from('servicios').select('id, nombre, duracion_min, precio').eq('activo', true).order('nombre'),
    supabase.from('recurso_servicio').select('recurso_id, servicio_id'),
  ]);
  const turnos = turnosData ?? [];
  const recursos = recursosData ?? [];
  const servicios = serviciosData ?? [];
  const nombreRecurso = new Map(recursos.map((r) => [r.id, r.nombre]));

  // Huecos para el alta manual (si ya eligió servicio y recurso)
  const servicioSel = servicios.find((s) => s.id === p.servicio);
  const recursosDelServicio = recursos.filter((r) =>
    (vinculos ?? []).some((v) => v.recurso_id === r.id && v.servicio_id === servicioSel?.id),
  );
  const recursosAConsultar =
    p.recurso && p.recurso !== 'cualquiera'
      ? recursosDelServicio.filter((r) => r.id === p.recurso)
      : recursosDelServicio;
  const huecos: { recursoId: string; inicio: string; fin: string }[] = [];
  if (servicioSel && p.recurso) {
    for (const r of recursosAConsultar) {
      const { data } = await supabase.rpc('huecos_disponibles', { p_recurso: r.id, p_servicio: servicioSel.id, p_fecha: fecha });
      for (const h of data ?? []) huecos.push({ recursoId: r.id, inicio: h.inicio, fin: h.fin });
    }
    huecos.sort((a, b) => a.inicio.localeCompare(b.inicio));
  }
  // "Cualquiera": un solo botón por horario, con el primer recurso libre.
  const vistos = new Set<string>();
  const huecosUnicos = huecos.filter((h) => (vistos.has(h.inicio) ? false : (vistos.add(h.inicio), true)));

  const reservaCap = plantilla.reserva.singular;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">Turnos</h2>
      {p.ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{p.ok}</p>}
      {p.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{p.error}</p>}

      <nav aria-label="Elegir día" className="flex flex-wrap items-center gap-2">
        <Link href={`/panel/turnos?fecha=${sumarDias(fecha, -1)}`} className={botonSec}>← Anterior</Link>
        <Link href={`/panel/turnos?fecha=${hoyISO()}`} className={botonSec}>Hoy</Link>
        <Link href={`/panel/turnos?fecha=${sumarDias(fecha, 1)}`} className={botonSec}>Siguiente →</Link>
        <form className="flex items-center gap-2">
          <input type="date" name="fecha" defaultValue={fecha} aria-label="Ir a la fecha" className="rounded-lg border border-stone-300 px-3 py-2" />
          <button className={botonSec}>Ir</button>
        </form>
      </nav>
      <p className="text-lg font-medium capitalize">{etiquetaDia(fecha)}</p>

      <section aria-label="Agenda del día" className="space-y-3">
        {turnos.length === 0 && <p className="text-stone-500">No hay {plantilla.reserva.plural} para este día.</p>}
        <ul className="space-y-3">
          {turnos.map((t) => {
            const estado = esEstadoTurno(t.estado) ? t.estado : 'pendiente';
            const cliente = t.cliente as unknown as { id: string; nombre: string; telefono: string } | null;
            const servicio = t.servicio as unknown as { nombre: string; precio: number } | null;
            return (
              <li key={t.id} className="space-y-2 rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {horaLocal(t.inicio)} a {horaLocal(t.fin)} · {servicio?.nombre}
                    <span className="text-stone-500"> · {nombreRecurso.get(t.recurso_id) ?? 'Recurso desactivado'}</span>
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${COLOR[estado]}`}>{ETIQUETA_ESTADO[estado]}</span>
                </div>
                <p className="text-sm text-stone-700">
                  {cliente ? <Link href={`/panel/clientes/${cliente.id}`} className="underline">{cliente.nombre}</Link> : 'Cliente'}
                  {cliente && ` · ${cliente.telefono}`}
                  {t.notas && ` · ${t.notas}`}
                  {t.monto_cobrado !== null && ` · Cobrado $${Number(t.monto_cobrado)}`}
                </p>
                {(t.nota_cliente || t.dispositivo_id) && (
                  <p className="text-sm text-stone-600">
                    <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs">Pedido desde la página</span>
                    {t.nota_cliente && ` “${t.nota_cliente}”`}
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  {transicionesDe(estado).map((nuevo) =>
                    nuevo === 'completado' ? (
                      <form key={nuevo} action={cambiarEstado} className="flex items-end gap-2">
                        <input type="hidden" name="turnoId" value={t.id} />
                        <input type="hidden" name="estado" value="completado" />
                        <input type="hidden" name="fecha" value={fecha} />
                        <label className="text-xs">Monto ($)
                          <input name="monto" type="number" inputMode="decimal" min={0} step="any" defaultValue={Number(servicio?.precio ?? 0)} className="w-28 rounded-lg border border-stone-300 px-2 py-2 text-sm" />
                        </label>
                        <button className={boton}>Cobrado</button>
                      </form>
                    ) : (
                      <form key={nuevo} action={cambiarEstado}>
                        <input type="hidden" name="turnoId" value={t.id} />
                        <input type="hidden" name="estado" value={nuevo} />
                        <input type="hidden" name="fecha" value={fecha} />
                        <button className={botonSec}>{{ confirmado: 'Confirmar', no_vino: 'No vino', cancelado: 'Cancelar' }[nuevo as 'confirmado' | 'no_vino' | 'cancelado']}</button>
                      </form>
                    ),
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label={`Nuevo ${reservaCap}`} className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="font-semibold">Nuevo {reservaCap}</h3>
        {servicios.length === 0 ? (
          <p className="text-stone-500">Primero cargá tus servicios.</p>
        ) : (
          <>
            <form method="get" className="grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="fecha" value={fecha} />
              <label className="text-sm">Servicio
                <select name="servicio" defaultValue={servicioSel?.id ?? ''} required className={input}>
                  <option value="" disabled>Elegí…</option>
                  {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
              <label className="text-sm capitalize">{plantilla.recurso.singular}
                <select name="recurso" defaultValue={p.recurso ?? 'cualquiera'} className={input}>
                  <option value="cualquiera">Cualquiera</option>
                  {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </label>
              <div className="flex items-end"><button className={botonSec}>Ver horarios libres</button></div>
            </form>

            {servicioSel && p.recurso && (
              huecosUnicos.length === 0 ? (
                <p className="text-stone-500">No hay horarios libres para ese día. Probá con otro día o {plantilla.recurso.singular}.</p>
              ) : (
                <form action={crearTurno} className="space-y-4">
                  <input type="hidden" name="fecha" value={fecha} />
                  <input type="hidden" name="servicioId" value={servicioSel.id} />
                  <input type="hidden" name="recursoSel" value={p.recurso} />
                  <fieldset className="flex flex-wrap gap-2">
                    <legend className="mb-1 text-sm">Horario</legend>
                    {huecosUnicos.map((h) => (
                      <label key={h.inicio} className="cursor-pointer">
                        <input type="radio" name="slot" value={`${h.recursoId}|${h.inicio}`} required className="peer sr-only" />
                        <span className="inline-block min-h-11 rounded-lg border border-stone-300 px-3 py-2 text-sm peer-checked:border-stone-900 peer-checked:bg-stone-900 peer-checked:text-white peer-focus-visible:ring-2">
                          {horaLocal(h.inicio)}
                          {p.recurso === 'cualquiera' && <span className="text-xs opacity-70"> · {nombreRecurso.get(h.recursoId)}</span>}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-sm">Nombre del cliente<input name="nombre" defaultValue={p.nombre ?? ''} required minLength={2} maxLength={80} className={input} /></label>
                    <label className="text-sm">Teléfono<input name="telefono" type="tel" inputMode="tel" defaultValue={p.telefono ?? ''} required className={input} /></label>
                    <label className="text-sm">Nota (opcional)<input name="nota" defaultValue={p.nota ?? ''} maxLength={500} className={input} /></label>
                  </div>
                  <button className={boton}>Crear {reservaCap}</button>
                </form>
              )
            )}
          </>
        )}
      </section>
    </div>
  );
}
