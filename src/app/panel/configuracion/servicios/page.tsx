import { redirect } from 'next/navigation';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { alternarServicio, crearServicio, editarServicio } from './actions';


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
      <h2 className="titulo">Servicios</h2>
      {ok && <p role="status" className="aviso-ok">{ok}</p>}
      {error && <p role="alert" className="aviso-error">{error}</p>}

      <section className="space-y-3">
        <h3 className="subtitulo">Nuevo servicio</h3>
        <form action={crearServicio} className="grid gap-3 sm:grid-cols-3">
          <label>Nombre<input name="nombre" required minLength={2} maxLength={80} className="campo" /></label>
          <label>Duración (minutos)<input name="duracion_min" type="number" inputMode="numeric" min={5} max={480} step={5} defaultValue={30} required className="campo" /></label>
          <label>Precio ($)<input name="precio" type="number" inputMode="decimal" min={0} step="any" placeholder="0" className="campo" /></label>
          <div className="sm:col-span-3"><button className="boton">Crear servicio</button></div>
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="subtitulo">Servicios activos</h3>
        {activos.length === 0 && <p className="text-niebla">Todavía no cargaste servicios.</p>}
        <ul className="lista">
          {activos.map((s) => (
            <li key={s.id} className="flex flex-wrap items-end gap-3 p-3">
              <form action={editarServicio} className="flex flex-1 flex-wrap items-end gap-2">
                <input type="hidden" name="servicioId" value={s.id} />
                <label className="min-w-40 flex-1 text-sm">Nombre<input name="nombre" defaultValue={s.nombre} required minLength={2} maxLength={80} className="campo" /></label>
                <label className="w-28 text-sm">Minutos<input name="duracion_min" type="number" inputMode="numeric" min={5} max={480} step={5} defaultValue={s.duracion_min} required className="campo" /></label>
                <label className="w-32 text-sm">Precio ($)<input name="precio" type="number" inputMode="decimal" min={0} step="any" defaultValue={Number(s.precio)} className="campo" /></label>
                <button className="boton-sec">Guardar</button>
              </form>
              <form action={alternarServicio}>
                <input type="hidden" name="servicioId" value={s.id} />
                <input type="hidden" name="activar" value="no" />
                <button className="boton-sec">Desactivar</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {inactivos.length > 0 && (
        <details className="tarjeta">
          <summary className="cursor-pointer font-medium">Servicios desactivados ({inactivos.length})</summary>
          <ul className="mt-3 space-y-2">
            {inactivos.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3">
                <span className="text-niebla">{s.nombre} · {s.duracion_min} min</span>
                <form action={alternarServicio}>
                  <input type="hidden" name="servicioId" value={s.id} />
                  <input type="hidden" name="activar" value="si" />
                  <button className="boton-sec">Reactivar</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
