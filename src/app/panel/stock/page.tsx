import Link from 'next/link';
import { redirect } from 'next/navigation';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { guardarStock } from './actions';

const celda = 'w-28 rounded-lg border border-stone-300 px-2 py-2';

export default async function StockPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'editar_catalogo')) redirect('/panel');
  if (!ctx.negocio.vende_productos) redirect('/panel/productos');
  const { ok, error } = await searchParams;

  const supabase = await crearClienteServidor();
  const { data } = await supabase.from('productos').select('id, nombre, precio, stock').eq('activo', true).order('nombre');
  const productos = data ?? [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Stock y precios</h2>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}
      <p className="text-sm text-stone-600">Cambiá los números que necesites y guardá todo junto. Para agregar productos andá a <Link href="/panel/productos" className="underline">Productos</Link>.</p>

      {productos.length === 0 ? (
        <p className="text-stone-500">No tenés productos visibles.</p>
      ) : (
        <form action={guardarStock} className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left">
                <tr><th className="p-3">Producto</th><th className="p-3">Stock</th><th className="p-3">Precio ($)</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {productos.map((x) => (
                  <tr key={x.id}>
                    <td className="p-3">
                      {x.nombre}
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name={`stock_antes_${x.id}`} value={x.stock} />
                      <input type="hidden" name={`precio_antes_${x.id}`} value={Number(x.precio)} />
                    </td>
                    <td className="p-3"><input name={`stock_${x.id}`} type="number" inputMode="numeric" min={0} defaultValue={x.stock} aria-label={`Stock de ${x.nombre}`} required className={celda} /></td>
                    <td className="p-3"><input name={`precio_${x.id}`} type="number" inputMode="decimal" min={0} step="any" defaultValue={Number(x.precio)} aria-label={`Precio de ${x.nombre}`} required className={celda} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white">Guardar cambios</button>
        </form>
      )}
    </div>
  );
}
