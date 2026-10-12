import Link from 'next/link';
import { redirect } from 'next/navigation';
import { diasDesde, esFechaISO, estaEnCurso, etiquetaDia, lunesDe, horaLocal, hoyISO, rangoDelDia, sumarDias } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { motivoSinHorarios } from '@/lib/dominio/sin-horarios';
import { ESTADOS_TURNO, ETIQUETA_ESTADO, esEstadoTurno, transicionesDe } from '@/lib/dominio/turnos';
import { EstadoVacio } from '@/components/marca/EstadoVacio';
import { SelectorDias } from '@/components/marca/SelectorDias';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { cambiarEstado, crearTurno } from './actions';

// Color de estado de la marca: Señal = tomado, Blanco = ahora, Grafito = pasado o cancelado.
const CAPSULA: Record<(typeof ESTADOS_TURNO)[number], string> = {
  pendiente: 'border border-senal text-senal',
  confirmado: 'capsula-reservado',
  completado: 'capsula-pasado',
  cancelado: 'capsula-pasado line-through',
  no_vino: 'capsula-pasado',
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

  // Sin horarios: averigua el motivo para decirle al dueño qué corregir.
  let motivo = '';
  if (servicioSel && p.recurso && huecosUnicos.length === 0) {
    const dow = new Date(`${fecha}T12:00:00Z`).getUTCDay();
    const [{ data: franjas }, { data: bloqueos }, { data: negocio }] = await Promise.all([
      supabase.from('horarios').select('recurso_id').eq('dia_semana', dow),
      supabase.from('bloqueos').select('recurso_id').lte('desde', fecha).gte('hasta', fecha),
      supabase.from('negocios').select('anticipacion_max_dias').eq('id', ctx.negocio.id).single(),
    ]);
    const atienden = new Set((franjas ?? []).map((f) => f.recurso_id));
    const bloqueoGeneral = (bloqueos ?? []).some((b) => b.recurso_id === null);
    const bloqueados = new Set((bloqueos ?? []).map((b) => b.recurso_id));
    const consultado = (r: { id: string; nombre: string }) => ({
      nombre: r.nombre,
      haceServicio: recursosDelServicio.some((x) => x.id === r.id),
      atiendeEseDia: atienden.has(r.id),
      bloqueado: bloqueoGeneral || bloqueados.has(r.id),
    });
    const elegido = p.recurso !== 'cualquiera' ? recursos.find((r) => r.id === p.recurso) : undefined;
    const maxDias = negocio?.anticipacion_max_dias ?? 30;
    motivo = motivoSinHorarios({
      fecha,
      hoy: hoyISO(),
      maxFecha: sumarDias(hoyISO(), maxDias),
      anticipacionMaxDias: maxDias,
      servicio: servicioSel.nombre,
      recurso: plantilla.recurso,
      elegido: elegido ? consultado(elegido) : null,
      todos: recursos.map(consultado),
    });
  }

  const reservaCap = plantilla.reserva.singular;

  return (
    <div className="space-y-8">
      <h2 className="titulo">Turnos</h2>
      {p.ok && <p role="status" className="aviso-ok">{p.ok}</p>}
      {p.error && <p role="alert" className="aviso-error">{p.error}</p>}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/panel/turnos?fecha=${sumarDias(fecha, -7)}`} aria-label="Semana anterior" className="boton-sec w-11 px-0 text-xl">‹</Link>
          <Link href={`/panel/turnos?fecha=${sumarDias(fecha, 7)}`} aria-label="Semana siguiente" className="boton-sec w-11 px-0 text-xl">›</Link>
          <Link href={`/panel/turnos?fecha=${hoyISO()}`} className="boton-sec">Hoy</Link>
          <form className="ml-auto flex items-center gap-2">
            <input type="date" name="fecha" defaultValue={fecha} aria-label="Ir a la fecha" className="min-h-11 rounded-full border border-linea bg-noche px-4 py-2 font-mono text-sm" />
            <button className="boton-sec">Ir</button>
          </form>
        </div>
        <SelectorDias
          etiqueta="Días de la semana"
          dias={diasDesde(lunesDe(fecha), 7)}
          seleccionado={fecha}
          hoy={hoyISO()}
          href={(f) => `/panel/turnos?fecha=${f}`}
        />
      </div>
      <p className="subtitulo">{etiquetaDia(fecha)}</p>

      <section aria-label="Agenda del día" className="space-y-3">
        {turnos.length === 0 && (
          <EstadoVacio titulo={`No hay ${plantilla.reserva.plural} para este día.`}>
            <a href="#nuevo" className="enlace">Cargá uno abajo</a> o compartí tu página para que te pidan.
          </EstadoVacio>
        )}
        <ul className="space-y-3">
          {turnos.map((t) => {
            const estado = esEstadoTurno(t.estado) ? t.estado : 'pendiente';
            const cliente = t.cliente as unknown as { id: string; nombre: string; telefono: string } | null;
            const servicio = t.servicio as unknown as { nombre: string; precio: number } | null;
            const ahora = estado === 'confirmado' && estaEnCurso(t.inicio, t.fin);
            return (
              <li key={t.id} className="grid grid-cols-[4.5rem_1fr] gap-3 sm:grid-cols-[5.5rem_1fr]">
                <p className="pt-4 font-mono text-sm text-niebla">{horaLocal(t.inicio)}</p>
                <div className={`space-y-2 tarjeta ${ahora ? 'border-blanco ring-1 ring-blanco' : ''} ${estado === 'cancelado' || estado === 'no_vino' ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {servicio?.nombre}
                    <span className="font-mono text-sm text-niebla"> {horaLocal(t.inicio)} a {horaLocal(t.fin)}</span>
                    <span className="text-niebla"> · {nombreRecurso.get(t.recurso_id) ?? 'Recurso desactivado'}</span>
                  </p>
                  <span className={`capsula min-h-0 py-0.5 text-xs uppercase tracking-[0.1em] ${ahora ? 'capsula-ahora' : CAPSULA[estado]}`}>
                    {ahora ? 'Ahora' : ETIQUETA_ESTADO[estado]}
                  </span>
                </div>
                <p className="text-sm text-niebla">
                  {cliente ? <Link href={`/panel/clientes/${cliente.id}`} className="enlace">{cliente.nombre}</Link> : 'Cliente'}
                  {cliente && ` · ${cliente.telefono}`}
                  {t.notas && ` · ${t.notas}`}
                  {t.monto_cobrado !== null && ` · Cobrado $${Number(t.monto_cobrado)}`}
                </p>
                {(t.nota_cliente || t.dispositivo_id) && (
                  <p className="text-sm text-niebla">
                    <span className="etiqueta text-cielo">Pedido desde la página</span>
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
                          <input name="monto" type="number" inputMode="decimal" min={0} step="any" defaultValue={Number(servicio?.precio ?? 0)} className="w-28 rounded-xl border border-linea bg-noche px-3 py-2 text-sm" />
                        </label>
                        <button className="boton">Cobrado</button>
                      </form>
                    ) : (
                      <form key={nuevo} action={cambiarEstado}>
                        <input type="hidden" name="turnoId" value={t.id} />
                        <input type="hidden" name="estado" value={nuevo} />
                        <input type="hidden" name="fecha" value={fecha} />
                        <button className="boton-sec">{{ confirmado: 'Confirmar', no_vino: 'No vino', cancelado: 'Cancelar' }[nuevo as 'confirmado' | 'no_vino' | 'cancelado']}</button>
                      </form>
                    ),
                  )}
                  {(estado === 'pendiente' || estado === 'confirmado') && (
                    <Link href={`/panel/turnos/${t.id}/mover`} className="boton-sec" aria-label={`Mover el turno de las ${horaLocal(t.inicio)}`}>Mover</Link>
                  )}
                </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="nuevo" aria-label={`Nuevo ${reservaCap}`} className="scroll-mt-40 space-y-4 tarjeta">
        <h3 className="subtitulo">Nuevo {reservaCap}</h3>
        <p className="text-sm text-niebla">Para el <span className="font-medium">{etiquetaDia(fecha)}</span>. Para otro día, cambialo arriba.</p>
        {servicios.length === 0 ? (
          <p className="text-niebla">Primero cargá tus servicios.</p>
        ) : (
          <>
            <form method="get" className="grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="fecha" value={fecha} />
              <label className="text-sm">Servicio
                <select name="servicio" defaultValue={servicioSel?.id ?? ''} required className="campo">
                  <option value="" disabled>Elegí…</option>
                  {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </label>
              <label className="text-sm capitalize">{plantilla.recurso.singular}
                <select name="recurso" defaultValue={p.recurso ?? 'cualquiera'} className="campo">
                  <option value="cualquiera">Cualquiera</option>
                  {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </label>
              <div className="flex items-end"><button className="boton-sec">Ver horarios libres</button></div>
            </form>

            {servicioSel && p.recurso && (
              huecosUnicos.length === 0 ? (
                <p role="note" className="aviso-nota">No hay horarios libres. {motivo}</p>
              ) : (
                <form action={crearTurno} className="space-y-4">
                  <input type="hidden" name="fecha" value={fecha} />
                  <input type="hidden" name="servicioId" value={servicioSel.id} />
                  <input type="hidden" name="recursoSel" value={p.recurso} />
                  <fieldset className="flex flex-wrap gap-2">
                    <legend className="etiqueta mb-2">Horarios libres</legend>
                    {huecosUnicos.map((h) => (
                      <label key={h.inicio} className="cursor-pointer">
                        <input type="radio" name="slot" value={`${h.recursoId}|${h.inicio}`} required className="peer sr-only" />
                        <span className="inline-flex min-h-11 items-center rounded-full border border-cielo px-4 py-2 font-mono text-sm text-cielo transition-colors hover:bg-cielo/10 peer-checked:bg-cielo peer-checked:text-noche peer-focus-visible:ring-2 peer-focus-visible:ring-cielo">
                          {horaLocal(h.inicio)}
                          {p.recurso === 'cualquiera' && <span className="text-xs opacity-70"> · {nombreRecurso.get(h.recursoId)}</span>}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-sm">Nombre del cliente<input name="nombre" defaultValue={p.nombre ?? ''} required minLength={2} maxLength={80} className="campo" /></label>
                    <label className="text-sm">Teléfono<input name="telefono" type="tel" inputMode="tel" defaultValue={p.telefono ?? ''} required className="campo" /></label>
                    <label className="text-sm">Nota (opcional)<input name="nota" defaultValue={p.nota ?? ''} maxLength={500} className="campo" /></label>
                  </div>
                  <button className="boton">Crear {reservaCap}</button>
                </form>
              )
            )}
          </>
        )}
      </section>
    </div>
  );
}
