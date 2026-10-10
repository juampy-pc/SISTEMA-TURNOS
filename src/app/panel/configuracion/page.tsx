import Link from 'next/link';
import { redirect } from 'next/navigation';
import { INTERVALOS_MINUTOS, PASOS_MINUTOS } from '@/lib/dominio/esquemas-turnos';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { guardarConfigTurnos } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white';
const ayuda = 'mt-1 block text-xs text-stone-500';

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_servicios')) redirect('/panel');
  const { ok, error } = await searchParams;

  const supabase = await crearClienteServidor();
  const { data: negocio } = await supabase
    .from('negocios')
    .select('paso_minutos, intervalo_min, anticipacion_min_horas, anticipacion_max_dias')
    .eq('id', ctx.negocio.id)
    .single();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Configuración avanzada</h2>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}

      {negocio && (
        <form action={guardarConfigTurnos} className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3">
          {ctx.negocio.modo_turnos === 'fijo' ? (
            <label className="text-sm">Duración de cada turno
              <select name="paso_minutos" defaultValue={negocio.paso_minutos} className={input}>
                {PASOS_MINUTOS.map((p) => <option key={p} value={p}>{p} minutos</option>)}
              </select>
              <span className={ayuda}>Todos los turnos duran lo mismo y arrancan uno detrás del otro.</span>
            </label>
          ) : (
            <label className="text-sm">Intervalo entre horarios
              <select name="intervalo_min" defaultValue={negocio.intervalo_min} className={input}>
                {INTERVALOS_MINUTOS.map((p) => <option key={p} value={p}>Cada {p} minutos</option>)}
              </select>
              <span className={ayuda}>Cada cuánto se ofrece un horario de inicio (por ejemplo 9:00, 9:15, 9:30…).</span>
            </label>
          )}
          <label className="text-sm">Anticipación mínima (horas)
            <input name="anticipacion_min_horas" type="number" inputMode="numeric" min={0} max={168} defaultValue={negocio.anticipacion_min_horas} required className={input} />
          </label>
          <label className="text-sm">Reservas hasta (días hacia adelante)
            <input name="anticipacion_max_dias" type="number" inputMode="numeric" min={1} max={365} defaultValue={negocio.anticipacion_max_dias} required className={input} />
          </label>
          <div className="sm:col-span-3"><button className={boton}>Guardar</button></div>
        </form>
      )}

      {puede(ctx.rol, 'editar_negocio') && (
        <p className="text-sm text-stone-600">
          El nombre, el WhatsApp, el logo y el link de tu página están en{' '}
          <Link href="/panel/negocio" className="underline">Mi negocio</Link>.
        </p>
      )}
    </div>
  );
}
