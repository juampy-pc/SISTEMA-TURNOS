import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { etiquetaDia, horaLocal } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { posibleDuplicado } from '@/lib/dominio/telefono';
import { ETIQUETA_ESTADO, esEstadoTurno } from '@/lib/dominio/turnos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { guardarCliente, guardarDetalleTurno, revocarDispositivo, unirClientes } from '../actions';


export default async function FichaClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_clientes')) redirect('/panel');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { ok, error } = await searchParams;

  const supabase = await crearClienteServidor();
  const { data: cliente } = await supabase.from('clientes').select('id, nombre, telefono, notas, created_at').eq('id', id).maybeSingle();
  if (!cliente) notFound();

  const verVentas = ctx.negocio.vende_productos && (puede(ctx.rol, 'registrar_ventas') || puede(ctx.rol, 'ver_ingresos'));
  const [{ data: turnos }, { data: otros }, { data: dispositivos }, { data: compras }] = await Promise.all([
    supabase
      .from('turnos')
      .select('id, inicio, estado, notas, monto_cobrado, servicio:servicios(nombre), recurso:recursos(nombre)')
      .eq('cliente_id', id)
      .order('inicio', { ascending: false })
      .limit(50),
    supabase.from('clientes').select('id, nombre, telefono').neq('id', id).limit(2000),
    supabase.from('dispositivos_confiables').select('id, created_at').eq('cliente_id', id).eq('confiable', true).order('created_at'),
    verVentas
      ? supabase
          .from('ventas')
          .select('id, cantidad, monto, created_at, producto:productos(nombre)')
          .eq('cliente_id', id)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const editaTurnos = puede(ctx.rol, 'gestionar_turnos');
  const duplicados = (otros ?? []).filter((o) => posibleDuplicado(cliente.telefono, o.telefono));

  return (
    <div className="space-y-8">
      <p><Link href="/panel/clientes" className="enlace text-sm">← Clientes</Link></p>
      <h2 className="titulo">{cliente.nombre}</h2>
      {ok && <p role="status" className="aviso-ok">{ok}</p>}
      {error && <p role="alert" className="aviso-error">{error}</p>}

      <form action={guardarCliente} className="space-y-3 tarjeta">
        <input type="hidden" name="clienteId" value={cliente.id} />
        <p className="text-sm text-niebla">Teléfono: <strong>{cliente.telefono}</strong></p>
        <label className="block text-sm">Nombre<input name="nombre" defaultValue={cliente.nombre} required minLength={2} maxLength={80} className="campo" /></label>
        <label className="block text-sm">Notas<textarea name="notas" defaultValue={cliente.notas} maxLength={1000} rows={3} className="campo" /></label>
        <button className="boton">Guardar</button>
      </form>

      {duplicados.length > 0 && (
        <section aria-label="Posibles duplicados" className="space-y-3 rounded-2xl border border-senal bg-grafito p-4">
          <h3 className="subtitulo">Posibles duplicados</h3>
          <p className="text-sm text-niebla">Estos clientes tienen un teléfono muy parecido. Si son la misma persona, unilos: sus turnos y notas pasan a esta ficha.</p>
          <ul className="space-y-2">
            {duplicados.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{d.nombre} · {d.telefono}</span>
                <form action={unirClientes}>
                  <input type="hidden" name="destinoId" value={cliente.id} />
                  <input type="hidden" name="origenId" value={d.id} />
                  <button className="boton-sec">Unir en esta ficha</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(dispositivos ?? []).length > 0 && (
        <section aria-label="Dispositivos confiables" className="space-y-2 tarjeta text-sm">
          <h3 className="subtitulo">Dispositivos confiables</h3>
          <p className="text-niebla">Los turnos que pide desde estos dispositivos se confirman solos.</p>
          <ul className="space-y-2">
            {(dispositivos ?? []).map((d, i) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>Dispositivo {i + 1} · desde el {new Date(d.created_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}</span>
                <form action={revocarDispositivo}>
                  <input type="hidden" name="clienteId" value={cliente.id} />
                  <input type="hidden" name="dispositivoId" value={d.id} />
                  <button className="boton-sec">Quitar</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="subtitulo">Historial</h3>
        {(turnos ?? []).length === 0 && <p className="text-niebla">Todavía no tiene turnos.</p>}
        <ul className="lista">
          {(turnos ?? []).map((t) => {
            const servicio = t.servicio as unknown as { nombre: string } | null;
            const recurso = t.recurso as unknown as { nombre: string } | null;
            return (
              <li key={t.id} className="space-y-2 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="capitalize">{etiquetaDia(new Date(t.inicio).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }))} · {horaLocal(t.inicio)}</span>
                  <span>{servicio?.nombre} · {recurso?.nombre}</span>
                  <span className="text-niebla">
                    {esEstadoTurno(t.estado) ? ETIQUETA_ESTADO[t.estado] : t.estado}
                    {t.monto_cobrado !== null && ` · Cobrado $${Number(t.monto_cobrado)}`}
                  </span>
                </div>
                {t.notas && <p className="whitespace-pre-line rounded-lg bg-noche px-3 py-2 text-niebla">{t.notas}</p>}
                {editaTurnos && (
                  <details>
                    <summary className="cursor-pointer text-cielo">{t.notas ? 'Editar detalle' : 'Agregar detalle'}</summary>
                    <form action={guardarDetalleTurno} className="mt-2 space-y-2">
                      <input type="hidden" name="clienteId" value={cliente.id} />
                      <input type="hidden" name="turnoId" value={t.id} />
                      <textarea name="notas" defaultValue={t.notas} maxLength={500} rows={3} placeholder="Qué se hizo, productos usados, observaciones…" aria-label="Detalle del turno" className="campo" />
                      <button className="boton-sec">Guardar detalle</button>
                    </form>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {verVentas && (
        <section aria-label="Compras" className="space-y-3">
          <h3 className="subtitulo">Compras</h3>
          {(compras ?? []).length === 0 && <p className="text-niebla">Todavía no compró productos.</p>}
          <ul className="lista">
            {(compras ?? []).map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  {new Date(v.created_at).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                  {' · '}{v.cantidad} × {(v.producto as unknown as { nombre: string } | null)?.nombre}
                </span>
                <strong>${Number(v.monto).toLocaleString('es-AR')}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
