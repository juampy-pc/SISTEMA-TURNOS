import { Logo } from '@/components/marca/Logo';
import { itemsDeMenu } from '@/lib/dominio/menu';
import { obtenerContexto } from '@/lib/panel/contexto';
import { cerrarSesion } from './actions';
import NavPanel from './NavPanel';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const ctx = await obtenerContexto();
  const items = itemsDeMenu(ctx.rol, undefined, ctx.negocio.vende_productos);

  return (
    <div className="min-h-screen bg-noche text-blanco">
      <header className="sticky top-0 z-10 border-b border-linea bg-noche/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Logo className="h-6 w-auto shrink-0" />
            <span aria-hidden className="h-6 w-px bg-linea" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-xl leading-none font-bold tracking-[0.04em] uppercase">{ctx.negocio.nombre}</h1>
              <p className="etiqueta mt-1">{ctx.rol.nombre}</p>
            </div>
          </div>
          <form action={cerrarSesion}>
            <button className="boton-sec">Salir</button>
          </form>
        </div>
        <NavPanel
          items={items.map((i) => ({ href: i.href, etiqueta: i.etiqueta }))}
        />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
