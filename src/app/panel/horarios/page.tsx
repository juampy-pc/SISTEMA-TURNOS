import { redirect } from 'next/navigation';
import { PASOS_MINUTOS } from '@/lib/dominio/esquemas-turnos';
import { DIAS, formatearHora } from '@/lib/dominio/horarios';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { agregarBloqueo, agregarFranja, copiarHorario, guardarConfigTurnos, quitarBloqueo, quitarFranja } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white';
const botonSec = 'min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm';

export default async function HorariosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; recurso?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_servicios')) redirect('/panel');
  const { ok, error, recurso: recursoParam } = await searchParams;
  const plantilla = plantillaDe(ctx.negocio.tipo);

  const supabase = await crearClienteServidor();
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const [{ data: recursosData }, { data: bloqueosData }, { data: negocio }] = await Promise.all([
    supabase.from('recursos').select('id, nombre').eq('activo', true).order('orden').order('nombre'),
    supabase.from('bloqueos').select('id, recurso_id, desde, hasta, motivo').gte('hasta', hoy).order('desde'),
    supabase.from('negocios').select('paso_minutos, anticipacion_min_horas, anticipacion_max_dias').eq('id', ctx.negocio.id).single(),
  ]);
  const recursos = recursosData ?? [];
  const nombreDe = new Map(recursos.map((r) => [r.id, r.nombre]));
  const actual = recursos.find((r) => r.id === recursoParam) ?? recursos[0];

  const { data: franjasData } = actual
    ? await supabase
        .from('horarios')
        .select('id, dia_semana, desde_min, hasta_min')
        .eq('recurso_id', actual.id)
        .order('desde_min')
    : { data: [] };
  const franjas = franjasData ?? [];
  const sugerido = plantilla.ejemplo.horario;

  return (
    <div className="space-y-10">
      <h2 className="text-2xl font-semibold">Horarios</h2>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}

      {recursos.length === 0 ? (
        <p className="text-stone-500">Primero cargá tus {plantilla.recurso.plural} en la sección correspondiente.</p>
      ) : (
        <section className="space-y-4">
          <nav aria-label={`Elegir ${plantilla.recurso.singular}`} className="flex flex-wrap gap-2">
            {recursos.map((r) => (
              <a
                key={r.id}
                href={`/panel/horarios?recurso=${r.id}`}
                aria-current={r.id === actual?.id ? 'page' : undefined}
                className={`rounded-full border px-3 py-1.5 text-sm ${r.id === actual?.id ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-300 bg-white'}`}
              >
                {r.nombre}
              </a>
            ))}
          </nav>

          {actual && (
            <>
              <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
                {DIAS.map((d) => {
                  const delDia = franjas.filter((f) => f.dia_semana === d.n);
                  return (
                    <li key={d.n} className="flex flex-wrap items-center gap-3 p-3">
                      <span className="w-24 font-medium">{d.largo}</span>
                      {delDia.length === 0 && <span className="text-sm text-stone-500">Cerrado</span>}
                      {delDia.map((f) => (
                        <form key={f.id} action={quitarFranja} className="flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-3 pr-1 text-sm">
                          <input type="hidden" name="franjaId" value={f.id} />
                          <input type="hidden" name="recursoId" value={actual.id} />
                          {formatearHora(f.desde_min)} a {formatearHora(f.hasta_min)}
                          <button aria-label={`Quitar franja ${formatearHora(f.desde_min)} a ${formatearHora(f.hasta_min)} del ${d.largo}`} className="min-h-8 min-w-8 rounded-full px-2 text-stone-600 hover:bg-stone-200">×</button>
                        </form>
                      ))}
                    </li>
                  );
                })}
              </ul>

              <form action={agregarFranja} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
                <input type="hidden" name="recursoId" value={actual.id} />
                <h3 className="font-semibold">Agregar horario</h3>
                <fieldset className="flex flex-wrap gap-3">
                  <legend className="mb-1 text-sm">Días</legend>
                  {DIAS.map((d) => (
                    <label key={d.n} className="flex min-h-8 items-center gap-1 text-sm">
                      <input type="checkbox" name="dias" value={d.n} defaultChecked={sugerido.dias.includes(d.n)} />
                      {d.corto}
                    </label>
                  ))}
                </fieldset>
                <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                  <label className="text-sm">Desde<input name="desde" type="time" defaultValue={formatearHora(sugerido.desde_min).replace('24:00', '23:59')} required className={input} /></label>
                  <label className="text-sm">Hasta<input name="hasta" type="time" defaultValue={sugerido.hasta_min >= 1440 ? '23:59' : formatearHora(sugerido.hasta_min)} required className={input} /></label>
                </div>
                <button className={boton}>Agregar</button>
              </form>

              {recursos.length > 1 && (
                <form action={copiarHorario} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="recursoId" value={actual.id} />
                  <label className="text-sm">Copiar el horario de
                    <select name="origenId" className={input} defaultValue="">
                      <option value="" disabled>Elegí…</option>
                      {recursos.filter((r) => r.id !== actual.id).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                    </select>
                  </label>
                  <button className={botonSec}>Copiar (reemplaza el actual)</button>
                </form>
              )}
            </>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h3 className="font-semibold">Días sin atención (feriados, vacaciones)</h3>
        <form action={agregarBloqueo} className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-4">
          {actual && <input type="hidden" name="recursoId" value={actual.id} />}
          <label className="text-sm">Desde<input name="desde" type="date" defaultValue={hoy} required className={input} /></label>
          <label className="text-sm">Hasta<input name="hasta" type="date" defaultValue={hoy} required className={input} /></label>
          <label className="text-sm">Afecta a
            <select name="aplicaA" defaultValue="todos" className={input}>
              <option value="todos">Todo el negocio</option>
              {recursos.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
          <label className="text-sm">Motivo (opcional)<input name="motivo" maxLength={80} className={input} /></label>
          <div className="sm:col-span-4"><button className={boton}>Agregar bloqueo</button></div>
        </form>
        <ul className="space-y-2">
          {(bloqueosData ?? []).map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm ring-1 ring-stone-200">
              <span>
                {b.desde === b.hasta ? b.desde : `${b.desde} a ${b.hasta}`} · {b.recurso_id ? nombreDe.get(b.recurso_id) ?? 'Desactivado' : 'Todo el negocio'}
                {b.motivo && ` · ${b.motivo}`}
              </span>
              <form action={quitarBloqueo}>
                <input type="hidden" name="bloqueoId" value={b.id} />
                {actual && <input type="hidden" name="recursoId" value={actual.id} />}
                <button className={botonSec}>Quitar</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {negocio && (
        <section className="space-y-3">
          <h3 className="font-semibold">Reglas de reserva</h3>
          <form action={guardarConfigTurnos} className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3">
            {actual && <input type="hidden" name="recursoId" value={actual.id} />}
            {ctx.negocio.modo_turnos === 'fijo' && (
              <label className="text-sm">Duración de cada turno
                <select name="paso_minutos" defaultValue={negocio.paso_minutos} className={input}>
                  {PASOS_MINUTOS.map((p) => <option key={p} value={p}>{p} minutos</option>)}
                </select>
              </label>
            )}
            <label className="text-sm">Anticipación mínima (horas)
              <input name="anticipacion_min_horas" type="number" inputMode="numeric" min={0} max={168} defaultValue={negocio.anticipacion_min_horas} required className={input} />
            </label>
            <label className="text-sm">Reservas hasta (días hacia adelante)
              <input name="anticipacion_max_dias" type="number" inputMode="numeric" min={1} max={365} defaultValue={negocio.anticipacion_max_dias} required className={input} />
            </label>
            <div className="sm:col-span-3"><button className={boton}>Guardar reglas</button></div>
          </form>
        </section>
      )}
    </div>
  );
}
