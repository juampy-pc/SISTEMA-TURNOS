import Link from 'next/link';
import { redirect } from 'next/navigation';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { guardarStock } from './actions';

const celda = 'w-28 rounded-xl border border-linea bg-noche px-3 py-2';

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
      <h2 className="titulo">Stock y precios</h2>
      {ok && <p role="status" className="aviso-ok">{ok}</p>}
      {error && <p role="alert" className="aviso-error">{error}</p>}
      <p className="text-sm text-niebla">Cambiá los números que necesites y guardá todo junto. Para agregar productos andá a <Link href="/panel/productos" className="enlace">Productos</Link>.</p>

      {productos.length === 0 ? (
        <p className="text-niebla">No tenés productos visibles.</p>
      ) : (
        <form action={guardarStock} className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-linea bg-grafito">
            <table className="w-full text-sm">
              <thead className="bg-noche text-left">
                <tr><th className="p-3">Producto</th><th className="p-3">Stock</th><th className="p-3">Precio ($)</th></tr>
              </thead>
              <tbody className="divide-y divide-linea">
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
          <button className="boton">Guardar cambios</button>
        </form>
      )}
    </div>
  );
}
