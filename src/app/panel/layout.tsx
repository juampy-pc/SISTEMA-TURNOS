import Link from 'next/link';
import { itemsDeMenu } from '@/lib/dominio/menu';
import { obtenerContexto } from '@/lib/panel/contexto';
import { cerrarSesion } from './actions';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await obtenerContexto();
  const items = itemsDeMenu(ctx.rol);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-sm text-stone-500">{ctx.rol.nombre}</p>
            <h1 className="text-lg font-semibold">{ctx.negocio.nombre}</h1>
          </div>
          <form action={cerrarSesion}>
            <button className="min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm">Salir</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-stone-100">
              {i.etiqueta}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
