import Link from 'next/link';
import { pasosIniciales } from '@/lib/dominio/checklist';
import { etiquetaDia, horaLocal, ZONA } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { cambiarEstado } from './turnos/actions';


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
        <h2 className="titulo">Hola, {ctx.miembro.nombre}</h2>
        <p className="text-niebla">
          Acá vas a manejar tus {plantilla.reserva.plural} y tus {plantilla.recurso.plural}.
        </p>
      </section>

      {pendientes.length > 0 && (
        <section aria-label="Pendientes de confirmar" className="space-y-3 rounded-2xl border border-senal bg-grafito p-4">
          <h3 className="subtitulo">Pendientes de confirmar ({pendientes.length})</h3>
          <ul className="space-y-3">
            {pendientes.map((t) => {
              const cliente = t.cliente as unknown as { id: string; nombre: string; telefono: string } | null;
              const servicio = t.servicio as unknown as { nombre: string } | null;
              const fecha = new Date(t.inicio).toLocaleDateString('en-CA', { timeZone: ZONA });
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-noche p-3 text-sm">
                  <span>
                    <span className="capitalize">{etiquetaDia(fecha)}</span> <span className="font-mono text-senal">{horaLocal(t.inicio)}</span> · {servicio?.nombre}
                    <br />
                    {cliente && <Link href={`/panel/clientes/${cliente.id}`} className="enlace">{cliente.nombre}</Link>}
                    {cliente && ` · ${cliente.telefono}`}
                    {t.nota_cliente && <span className="text-niebla"> · “{t.nota_cliente}”</span>}
                  </span>
                  <span className="flex gap-2">
                    {(['confirmado', 'cancelado'] as const).map((estado) => (
                      <form key={estado} action={cambiarEstado}>
                        <input type="hidden" name="turnoId" value={t.id} />
                        <input type="hidden" name="estado" value={estado} />
                        <input type="hidden" name="fecha" value={fecha} />
                        <button className={estado === 'confirmado' ? 'boton' : 'boton-sec'}>{estado === 'confirmado' ? 'Confirmar' : 'Rechazar'}</button>
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
        <p className="text-sm text-niebla">
          Tu página para pedir turnos:{' '}
          <a href={`/b/${ctx.negocio.slug}`} target="_blank" className="enlace font-mono">/b/{ctx.negocio.slug}</a>
        </p>
      )}

      {pasos.length > 0 && (
        <section aria-label="Primeros pasos" className="tarjeta">
          <h3 className="subtitulo mb-3">Primeros pasos</h3>
          <ul className="space-y-2">
            {pasos.map((p) => (
              <li key={p.id} className={`flex items-center gap-3 ${p.hecho ? 'text-niebla' : ''}`}>
                <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${p.hecho ? 'bg-cielo' : 'border border-niebla'}`} />
                <span className="sr-only">{p.hecho ? 'Hecho:' : 'Pendiente:'}</span>
                {p.href && !p.hecho ? <Link href={p.href} className="enlace">{p.texto}</Link> : <span>{p.texto}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Consejos" className="tarjeta">
        <h3 className="subtitulo mb-3">Consejos para {plantilla.etiqueta.toLowerCase()}</h3>
        <ul className="list-disc space-y-2 pl-5 text-niebla">
          {plantilla.tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </div>
  );
}
