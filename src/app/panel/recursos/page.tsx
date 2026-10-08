import { redirect } from 'next/navigation';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { alternarRecurso, crearRecurso, guardarServiciosDeRecurso, renombrarRecurso } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white';
const botonSec = 'min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm';

export default async function RecursosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_servicios')) redirect('/panel');
  const { ok, error } = await searchParams;
  const { recurso } = plantillaDe(ctx.negocio.tipo);

  const supabase = await crearClienteServidor();
  const [{ data: recursosData }, { data: serviciosData }, { data: asignaciones }] = await Promise.all([
    supabase.from('recursos').select('id, nombre, activo').order('orden').order('nombre'),
    supabase.from('servicios').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('recurso_servicio').select('recurso_id, servicio_id'),
  ]);
  const recursos = recursosData ?? [];
  const servicios = serviciosData ?? [];
  const asignado = new Set((asignaciones ?? []).map((a) => `${a.recurso_id}:${a.servicio_id}`));
  const activos = recursos.filter((r) => r.activo);
  const inactivos = recursos.filter((r) => !r.activo);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold capitalize">{recurso.plural}</h2>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}

      <section className="space-y-3">
        <h3 className="font-semibold">Sumar {recurso.singular}</h3>
        <form action={crearRecurso} className="flex flex-wrap items-end gap-3">
          <label className="min-w-48 flex-1">Nombre<input name="nombre" required minLength={2} maxLength={60} className={input} /></label>
          <button className={boton}>Agregar</button>
        </form>
      </section>

      {activos.length === 0 && <p className="text-stone-500">Todavía no cargaste {recurso.plural}.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {activos.map((r) => (
          <section key={r.id} className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
            <form action={renombrarRecurso} className="flex items-end gap-2">
              <input type="hidden" name="recursoId" value={r.id} />
              <label className="flex-1 text-sm">Nombre<input name="nombre" defaultValue={r.nombre} required minLength={2} maxLength={60} className={input} /></label>
              <button className={botonSec}>Guardar</button>
            </form>
            <form action={guardarServiciosDeRecurso} className="space-y-2">
              <input type="hidden" name="recursoId" value={r.id} />
              <p className="text-sm font-medium">Servicios que realiza</p>
              {servicios.length === 0 && <p className="text-sm text-stone-500">Primero cargá servicios.</p>}
              {servicios.map((s) => (
                <label key={s.id} className="flex min-h-8 items-center gap-2 text-sm">
                  <input type="checkbox" name={`servicio_${s.id}`} defaultChecked={asignado.has(`${r.id}:${s.id}`)} />
                  {s.nombre}
                </label>
              ))}
              {servicios.length > 0 && <button className={botonSec}>Guardar servicios</button>}
            </form>
            <form action={alternarRecurso}>
              <input type="hidden" name="recursoId" value={r.id} />
              <input type="hidden" name="activar" value="no" />
              <button className="text-sm text-red-700 underline">Desactivar</button>
            </form>
          </section>
        ))}
      </div>

      {inactivos.length > 0 && (
        <details className="rounded-xl border border-stone-200 bg-white p-3">
          <summary className="cursor-pointer font-medium">Desactivadas ({inactivos.length})</summary>
          <ul className="mt-3 space-y-2">
            {inactivos.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="text-stone-600">{r.nombre}</span>
                <form action={alternarRecurso}>
                  <input type="hidden" name="recursoId" value={r.id} />
                  <input type="hidden" name="activar" value="si" />
                  <button className={botonSec}>Reactivar</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
