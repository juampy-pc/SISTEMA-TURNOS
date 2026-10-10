import Link from 'next/link';
import { redirect } from 'next/navigation';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearCliente } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; ok?: string; error?: string; nombre?: string; telefono?: string }> }) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_clientes')) redirect('/panel');
  const { q, ok, error, nombre, telefono } = await searchParams;
  const busqueda = (q ?? '').trim().slice(0, 40);

  const supabase = await crearClienteServidor();
  let consulta = supabase.from('clientes').select('id, nombre, telefono').order('nombre').limit(200);
  if (busqueda) {
    // Se quitan los caracteres que tienen sentido en el filtro de PostgREST.
    const seguro = busqueda.replace(/[,()%*\\]/g, ' ').trim();
    const digitos = seguro.replace(/\D/g, '');
    consulta = consulta.or(
      [`nombre.ilike.%${seguro}%`, digitos.length >= 3 ? `telefono.ilike.%${digitos}%` : null].filter(Boolean).join(','),
    );
  }
  const { data } = await consulta;
  const clientes = data ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Clientes</h2>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}
      <details open={Boolean(error)} className="rounded-xl border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer font-medium">Nuevo cliente</summary>
        <form action={crearCliente} className="mt-3 space-y-3">
          <label className="block text-sm">Nombre<input name="nombre" defaultValue={nombre ?? ''} required minLength={2} maxLength={80} className={input} /></label>
          <label className="block text-sm">Teléfono<input name="telefono" type="tel" inputMode="tel" defaultValue={telefono ?? ''} required className={input} /></label>
          <label className="block text-sm">Notas (opcional)<textarea name="notas" maxLength={1000} rows={2} className={input} /></label>
          <button className="min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white">Agregar cliente</button>
        </form>
      </details>
      <form className="flex gap-2">
        <input name="q" defaultValue={busqueda} placeholder="Buscar por nombre o teléfono" aria-label="Buscar clientes" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2" />
        <button className="min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Buscar</button>
      </form>
      {clientes.length === 0 && <p className="text-stone-500">{busqueda ? 'No encontramos clientes.' : 'Todavía no tenés clientes: agregalos acá o se crean solos al cargar un turno.'}</p>}
      <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {clientes.map((c) => (
          <li key={c.id}>
            <Link href={`/panel/clientes/${c.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 p-3 hover:bg-stone-50">
              <span className="font-medium">{c.nombre}</span>
              <span className="text-sm text-stone-500">{c.telefono}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
