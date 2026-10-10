import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { guardarProducto, quitarFotoProducto, subirFotoProducto } from '../actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white';
const botonSec = 'min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm';

export default async function EditarProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'editar_catalogo')) redirect('/panel/productos');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { ok, error } = await searchParams;

  const supabase = await crearClienteServidor();
  const { data: x } = await supabase
    .from('productos')
    .select('id, nombre, descripcion, precio, costo, stock, foto_url, activo')
    .eq('id', id)
    .maybeSingle();
  if (!x) notFound();

  return (
    <div className="space-y-6">
      <p><Link href="/panel/productos" className="text-sm underline">← Productos</Link></p>
      <h2 className="text-2xl font-semibold">{x.nombre}</h2>
      {ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{ok}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}

      <form action={guardarProducto} className="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
        <input type="hidden" name="productoId" value={x.id} />
        <label className="text-sm">Nombre<input name="nombre" defaultValue={x.nombre} required minLength={2} maxLength={80} className={input} /></label>
        <label className="text-sm">Precio ($)<input name="precio" type="number" inputMode="decimal" min={0} step="any" defaultValue={Number(x.precio)} required className={input} /></label>
        <label className="text-sm">Costo ($, opcional)<input name="costo" type="number" inputMode="decimal" min={0} step="any" defaultValue={x.costo === null ? '' : Number(x.costo)} className={input} /></label>
        <label className="text-sm">Stock<input name="stock" type="number" inputMode="numeric" min={0} defaultValue={x.stock} required className={input} /></label>
        <label className="text-sm sm:col-span-2">Descripción<textarea name="descripcion" defaultValue={x.descripcion} maxLength={500} rows={3} className={input} /></label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="activo" defaultChecked={x.activo} className="h-4 w-4" />
          Visible (se puede vender y aparece en tu página)
        </label>
        <div><button className={boton}>Guardar</button></div>
      </form>

      <section aria-label="Foto" className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="font-semibold">Foto</h3>
        {x.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={x.foto_url} alt={x.nombre} className="h-32 w-32 rounded-xl border border-stone-200 object-cover" />
        ) : (
          <p className="text-sm text-stone-500">Sin foto.</p>
        )}
        <form action={subirFotoProducto} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="productoId" value={x.id} />
          <label className="text-sm">Subir foto (JPG, PNG o WebP, hasta 2 MB)
            <input type="file" name="foto" accept="image/jpeg,image/png,image/webp" required className="mt-1 block text-sm" />
          </label>
          <button className={boton}>Subir</button>
        </form>
        {x.foto_url && (
          <form action={quitarFotoProducto}>
            <input type="hidden" name="productoId" value={x.id} />
            <button className={botonSec}>Quitar foto</button>
          </form>
        )}
      </section>
    </div>
  );
}
