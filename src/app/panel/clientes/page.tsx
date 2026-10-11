import Link from 'next/link';
import { redirect } from 'next/navigation';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { crearCliente } from './actions';


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
      <h2 className="titulo">Clientes</h2>
      {ok && <p role="status" className="aviso-ok">{ok}</p>}
      {error && <p role="alert" className="aviso-error">{error}</p>}
      <details open={Boolean(error)} className="tarjeta">
        <summary className="cursor-pointer font-medium">Nuevo cliente</summary>
        <form action={crearCliente} className="mt-3 space-y-3">
          <label className="block text-sm">Nombre<input name="nombre" defaultValue={nombre ?? ''} required minLength={2} maxLength={80} className="campo" /></label>
          <label className="block text-sm">Teléfono<input name="telefono" type="tel" inputMode="tel" defaultValue={telefono ?? ''} required className="campo" /></label>
          <label className="block text-sm">Notas (opcional)<textarea name="notas" maxLength={1000} rows={2} className="campo" /></label>
          <button className="boton">Agregar cliente</button>
        </form>
      </details>
      <form className="flex gap-2">
        <input name="q" defaultValue={busqueda} placeholder="Buscar por nombre o teléfono" aria-label="Buscar clientes" className="min-w-0 flex-1 rounded-xl border border-linea bg-noche px-3 py-2" />
        <button className="boton-sec">Buscar</button>
      </form>
      {clientes.length === 0 && <p className="text-niebla">{busqueda ? 'No encontramos clientes.' : 'Todavía no tenés clientes: agregalos acá o se crean solos al cargar un turno.'}</p>}
      <ul className="lista">
        {clientes.map((c) => (
          <li key={c.id}>
            <Link href={`/panel/clientes/${c.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 p-3 hover:bg-noche">
              <span className="font-medium">{c.nombre}</span>
              <span className="text-sm text-niebla">{c.telefono}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
