import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DIAS, formatearHora } from '@/lib/dominio/horarios';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { cargarPlantilla } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-4 py-2 text-white';

export default async function PrimerosPasosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_servicios')) redirect('/panel');
  const { error } = await searchParams;

  const supabase = await crearClienteServidor();
  const [{ count: recursos }, { count: servicios }] = await Promise.all([
    supabase.from('recursos').select('id', { count: 'exact', head: true }),
    supabase.from('servicios').select('id', { count: 'exact', head: true }),
  ]);
  if ((recursos ?? 0) > 0 || (servicios ?? 0) > 0) redirect('/panel');

  const plantilla = plantillaDe(ctx.negocio.tipo);
  const { ejemplo } = plantilla;
  const horaFin = ejemplo.horario.hasta_min >= 1440 ? '23:59' : formatearHora(ejemplo.horario.hasta_min);
  // Filas extra vacías para sumar más sin tocar nada más.
  const filasServicio = [...ejemplo.servicios, { nombre: '', duracion_min: 30, precio: 0 }];
  const filasRecurso = [...ejemplo.recursos, ''];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Armemos tu negocio</h2>
        <p className="text-stone-600">
          Te dejamos un ejemplo para {plantilla.etiqueta.toLowerCase()}. Cambialo a tu gusto o seguí tal cual: después
          lo podés editar cuando quieras.
        </p>
      </header>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}

      <form action={cargarPlantilla} className="space-y-8">
        <section className="space-y-3">
          <h3 className="font-semibold capitalize">{plantilla.recurso.plural}</h3>
          {filasRecurso.map((nombre, i) => (
            <label key={i} className="block text-sm">
              {i < ejemplo.recursos.length ? `${plantilla.recurso.singular[0].toUpperCase()}${plantilla.recurso.singular.slice(1)} ${i + 1}` : `Otra (opcional)`}
              <input name="recurso" defaultValue={nombre} maxLength={60} className={input} />
            </label>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Servicios</h3>
          {filasServicio.map((s, i) => (
            <div key={i} className="grid grid-cols-6 gap-2">
              <label className="col-span-6 text-sm sm:col-span-3">Nombre
                <input name="servicio_nombre" defaultValue={s.nombre} maxLength={80} className={input} />
              </label>
              <label className="col-span-3 text-sm sm:col-span-1">Minutos
                <input name="servicio_duracion" type="number" inputMode="numeric" min={5} max={480} step={5} defaultValue={s.duracion_min} className={input} />
              </label>
              <label className="col-span-3 text-sm sm:col-span-2">Precio ($)
                <input name="servicio_precio" type="number" inputMode="decimal" min={0} step="any" defaultValue={s.precio || ''} placeholder="a definir" className={input} />
              </label>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Horario de atención</h3>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1 text-sm">Días</legend>
            {DIAS.map((d) => (
              <label key={d.n} className="flex min-h-8 items-center gap-1 text-sm">
                <input type="checkbox" name="dias" value={d.n} defaultChecked={ejemplo.horario.dias.includes(d.n)} />
                {d.corto}
              </label>
            ))}
          </fieldset>
          <div className="grid max-w-sm grid-cols-2 gap-3">
            <label className="text-sm">Desde<input name="desde" type="time" defaultValue={formatearHora(ejemplo.horario.desde_min)} required className={input} /></label>
            <label className="text-sm">Hasta<input name="hasta" type="time" defaultValue={horaFin} required className={input} /></label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-4">
          <button className={boton}>Cargar y seguir</button>
          <Link href="/panel" className="text-sm underline">Prefiero cargarlo yo</Link>
        </div>
      </form>
    </div>
  );
}
