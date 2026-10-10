import Link from 'next/link';
import { pasosIniciales } from '@/lib/dominio/checklist';
import { etiquetaDia, horaLocal, ZONA } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { cambiarEstado } from './turnos/actions';

const botonSec = 'min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm';

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
        <h2 className="text-2xl font-semibold">Hola, {ctx.miembro.nombre}</h2>
        <p className="text-stone-600">
          Acá vas a manejar tus {plantilla.reserva.plural} y tus {plantilla.recurso.plural}.
        </p>
      </section>

      {pendientes.length > 0 && (
        <section aria-label="Pendientes de confirmar" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold">Pendientes de confirmar ({pendientes.length})</h3>
          <ul className="space-y-3">
            {pendientes.map((t) => {
              const cliente = t.cliente as unknown as { id: string; nombre: string; telefono: string } | null;
              const servicio = t.servicio as unknown as { nombre: string } | null;
              const fecha = new Date(t.inicio).toLocaleDateString('en-CA', { timeZone: ZONA });
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
                  <span>
                    <span className="capitalize">{etiquetaDia(fecha)}</span> · {horaLocal(t.inicio)} · {servicio?.nombre}
                    <br />
                    {cliente && <Link href={`/panel/clientes/${cliente.id}`} className="underline">{cliente.nombre}</Link>}
                    {cliente && ` · ${cliente.telefono}`}
                    {t.nota_cliente && <span className="text-stone-600"> · “{t.nota_cliente}”</span>}
                  </span>
                  <span className="flex gap-2">
                    {(['confirmado', 'cancelado'] as const).map((estado) => (
                      <form key={estado} action={cambiarEstado}>
                        <input type="hidden" name="turnoId" value={t.id} />
                        <input type="hidden" name="estado" value={estado} />
                        <input type="hidden" name="fecha" value={fecha} />
                        <button className={botonSec}>{estado === 'confirmado' ? 'Confirmar' : 'Rechazar'}</button>
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
        <p className="text-sm text-stone-600">
          Tu página para pedir turnos:{' '}
          <a href={`/b/${ctx.negocio.slug}`} target="_blank" className="font-medium underline">/b/{ctx.negocio.slug}</a>
        </p>
      )}

      {pasos.length > 0 && (
        <section aria-label="Primeros pasos" className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Primeros pasos</h3>
          <ul className="space-y-2">
            {pasos.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span aria-hidden>{p.hecho ? '✅' : '⬜'}</span>
                {p.href && !p.hecho ? <Link href={p.href} className="underline">{p.texto}</Link> : <span>{p.texto}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Consejos" className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Consejos para {plantilla.etiqueta.toLowerCase()}</h3>
        <ul className="list-disc space-y-2 pl-5 text-stone-700">
          {plantilla.tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </div>
  );
}
