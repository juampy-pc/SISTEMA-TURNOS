import { redirect } from 'next/navigation';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { alternarServicio, crearServicio, editarServicio } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white';
const botonSec = 'min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm';

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_servicios')) redirect('/panel');
  const { ok, error } = await searchParams;

  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from('servicios')
    .select('id, nombre, duracion_min, precio, activo')
    .order('nombre');
  const servicios = data ?? [];
  const activos = servicios.filter((s) => s.activo);
  const inactivos = servicios.filter((s) => !s.activo);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">Servicios</h2>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}

      <section className="space-y-3">
        <h3 className="font-semibold">Nuevo servicio</h3>
        <form action={crearServicio} className="grid gap-3 sm:grid-cols-3">
          <label>Nombre<input name="nombre" required minLength={2} maxLength={80} className={input} /></label>
          <label>Duración (minutos)<input name="duracion_min" type="number" inputMode="numeric" min={5} max={480} step={5} defaultValue={30} required className={input} /></label>
          <label>Precio ($)<input name="precio" type="number" inputMode="decimal" min={0} step="any" placeholder="0" className={input} /></label>
          <div className="sm:col-span-3"><button className={boton}>Crear servicio</button></div>
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Servicios activos</h3>
        {activos.length === 0 && <p className="text-stone-500">Todavía no cargaste servicios.</p>}
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {activos.map((s) => (
            <li key={s.id} className="flex flex-wrap items-end gap-3 p-3">
              <form action={editarServicio} className="flex flex-1 flex-wrap items-end gap-2">
                <input type="hidden" name="servicioId" value={s.id} />
                <label className="min-w-40 flex-1 text-sm">Nombre<input name="nombre" defaultValue={s.nombre} required minLength={2} maxLength={80} className={input} /></label>
                <label className="w-28 text-sm">Minutos<input name="duracion_min" type="number" inputMode="numeric" min={5} max={480} step={5} defaultValue={s.duracion_min} required className={input} /></label>
                <label className="w-32 text-sm">Precio ($)<input name="precio" type="number" inputMode="decimal" min={0} step="any" defaultValue={Number(s.precio)} className={input} /></label>
                <button className={botonSec}>Guardar</button>
              </form>
              <form action={alternarServicio}>
                <input type="hidden" name="servicioId" value={s.id} />
                <input type="hidden" name="activar" value="no" />
                <button className={botonSec}>Desactivar</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {inactivos.length > 0 && (
        <details className="rounded-xl border border-stone-200 bg-white p-3">
          <summary className="cursor-pointer font-medium">Servicios desactivados ({inactivos.length})</summary>
          <ul className="mt-3 space-y-2">
            {inactivos.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="text-stone-600">{s.nombre} · {s.duracion_min} min</span>
                <form action={alternarServicio}>
                  <input type="hidden" name="servicioId" value={s.id} />
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
