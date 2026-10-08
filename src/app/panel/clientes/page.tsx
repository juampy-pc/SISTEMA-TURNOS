import Link from 'next/link';
import { redirect } from 'next/navigation';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_clientes')) redirect('/panel');
  const { q } = await searchParams;
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
      <form className="flex gap-2">
        <input name="q" defaultValue={busqueda} placeholder="Buscar por nombre o teléfono" aria-label="Buscar clientes" className="min-w-0 flex-1 rounded-lg border border-stone-300 px-3 py-2" />
        <button className="min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Buscar</button>
      </form>
      {clientes.length === 0 && <p className="text-stone-500">{busqueda ? 'No encontramos clientes.' : 'Todavía no tenés clientes: se crean solos al cargar un turno.'}</p>}
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
