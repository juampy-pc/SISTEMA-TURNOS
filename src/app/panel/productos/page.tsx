import Link from 'next/link';
import { redirect } from 'next/navigation';
import { esReciente, horaLocal, ZONA } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { anularVenta, crearProducto, venderProducto } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white';
const botonSec = 'min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm';

interface Params {
  ok?: string;
  error?: string;
  vender?: string;
  cantidad?: string;
  monto?: string;
  telefono?: string;
  confirmar?: string;
}

function pesos(n: number | string): string {
  return `$${Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

export default async function ProductosPage({ searchParams }: { searchParams: Promise<Params> }) {
  const ctx = await obtenerContexto();
  const vende = puede(ctx.rol, 'registrar_ventas');
  const edita = puede(ctx.rol, 'editar_catalogo');
  if (!vende && !edita) redirect('/panel');
  const p = await searchParams;

  if (!ctx.negocio.vende_productos) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Productos</h2>
        <p className="text-stone-600">
          Tu negocio no tiene activada la venta de productos.{' '}
          {puede(ctx.rol, 'editar_negocio') && <>Activala en <Link href="/panel/negocio" className="underline">Mi negocio</Link>.</>}
        </p>
      </div>
    );
  }

  const supabase = await crearClienteServidor();
  const [{ data: productosData }, { data: ventasData }] = await Promise.all([
    supabase.from('productos').select('id, nombre, precio, stock, foto_url, activo').order('activo', { ascending: false }).order('nombre'),
    vende
      ? supabase
          .from('ventas')
          .select('id, cantidad, monto, created_at, producto:productos(nombre), cliente:clientes(id, nombre)')
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const productos = productosData ?? [];
  const ventas = ventasData ?? [];
  const aConfirmar = p.confirmar === '1' ? productos.find((x) => x.id === p.vender) : undefined;

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">Productos</h2>
      {p.ok && <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-green-800">{p.ok}</p>}
      {p.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{p.error}</p>}

      {aConfirmar && (
        <section aria-label="Confirmar venta sin stock" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p>
            Quedan <strong>{aConfirmar.stock}</strong> de <strong>{aConfirmar.nombre}</strong> y querés vender {p.cantidad ?? '1'}.
            Si registrás la venta igual, el stock queda en 0.
          </p>
          <form action={venderProducto} className="flex flex-wrap gap-2">
            <input type="hidden" name="productoId" value={aConfirmar.id} />
            <input type="hidden" name="cantidad" value={p.cantidad ?? '1'} />
            <input type="hidden" name="monto" value={p.monto ?? ''} />
            <input type="hidden" name="telefono" value={p.telefono ?? ''} />
            <input type="hidden" name="forzar" value="1" />
            <button className={boton}>Registrar igual</button>
            <Link href="/panel/productos" className={botonSec}>Cancelar</Link>
          </form>
        </section>
      )}

      <section aria-label="Catálogo" className="space-y-3">
        {productos.length === 0 && <p className="text-stone-500">Todavía no cargaste productos.</p>}
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {productos.map((x) => (
            <li key={x.id} className={`space-y-2 p-3 ${x.activo ? '' : 'opacity-60'}`}>
              <div className="flex flex-wrap items-center gap-3">
                {x.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.foto_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                ) : (
                  <span aria-hidden className="h-12 w-12 rounded-lg bg-stone-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {edita ? <Link href={`/panel/productos/${x.id}`} className="underline">{x.nombre}</Link> : x.nombre}
                    {!x.activo && <span className="text-sm text-stone-500"> · oculto</span>}
                  </p>
                  <p className="text-sm text-stone-600">
                    {pesos(x.precio)} · <span className={x.stock === 0 ? 'text-red-700' : ''}>Stock: {x.stock}</span>
                  </p>
                </div>
                {vende && x.activo && (
                  <form action={venderProducto}>
                    <input type="hidden" name="productoId" value={x.id} />
                    <button className={boton} aria-label={`Vendí uno de ${x.nombre}`}>Vendí uno</button>
                  </form>
                )}
              </div>
              {vende && x.activo && (
                <details open={p.vender === x.id && !aConfirmar}>
                  <summary className="cursor-pointer text-sm text-stone-600 underline">Más opciones</summary>
                  <form action={venderProducto} className="mt-2 grid gap-2 sm:grid-cols-4">
                    <input type="hidden" name="productoId" value={x.id} />
                    <label className="text-sm">Cantidad<input name="cantidad" type="number" inputMode="numeric" min={1} max={1000} defaultValue={p.vender === x.id ? p.cantidad : '1'} className={input} /></label>
                    <label className="text-sm">Monto total ($)<input name="monto" type="number" inputMode="decimal" min={0} step="any" defaultValue={p.vender === x.id ? p.monto : ''} placeholder="Precio × cantidad" className={input} /></label>
                    <label className="text-sm">Teléfono del cliente (opcional)<input name="telefono" type="tel" inputMode="tel" defaultValue={p.vender === x.id ? p.telefono : ''} className={input} /></label>
                    <div className="flex items-end"><button className={botonSec}>Registrar venta</button></div>
                  </form>
                </details>
              )}
            </li>
          ))}
        </ul>
      </section>

      {edita && (
        <details className="rounded-xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer font-medium">Nuevo producto</summary>
          <form action={crearProducto} className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Nombre<input name="nombre" required minLength={2} maxLength={80} className={input} /></label>
            <label className="text-sm">Precio ($)<input name="precio" type="number" inputMode="decimal" min={0} step="any" required className={input} /></label>
            <label className="text-sm">Costo ($, opcional)<input name="costo" type="number" inputMode="decimal" min={0} step="any" className={input} /></label>
            <label className="text-sm">Stock inicial<input name="stock" type="number" inputMode="numeric" min={0} defaultValue={0} required className={input} /></label>
            <label className="text-sm sm:col-span-2">Descripción (opcional)<textarea name="descripcion" maxLength={500} rows={2} className={input} /></label>
            <div><button className={boton}>Crear producto</button></div>
          </form>
        </details>
      )}

      {vende && (
        <section aria-label="Últimas ventas" className="space-y-3">
          <h3 className="font-semibold">Últimas ventas</h3>
          {ventas.length === 0 && <p className="text-stone-500">Todavía no registraste ventas.</p>}
          <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
            {ventas.map((v) => {
              const producto = v.producto as unknown as { nombre: string } | null;
              const cliente = v.cliente as unknown as { id: string; nombre: string } | null;
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    {new Date(v.created_at).toLocaleDateString('es-AR', { timeZone: ZONA, day: 'numeric', month: 'short' })} {horaLocal(v.created_at)}
                    {' · '}{v.cantidad} × {producto?.nombre}
                    {cliente && <> · <Link href={`/panel/clientes/${cliente.id}`} className="underline">{cliente.nombre}</Link></>}
                  </span>
                  <span className="flex items-center gap-2">
                    <strong>{pesos(v.monto)}</strong>
                    {esReciente(v.created_at, 24) && (
                      <form action={anularVenta}>
                        <input type="hidden" name="ventaId" value={v.id} />
                        <button className={botonSec}>Anular</button>
                      </form>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
