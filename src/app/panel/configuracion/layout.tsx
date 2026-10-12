import { itemsDeConfiguracion } from '@/lib/dominio/menu';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import NavConfiguracion from './NavConfiguracion';

export default async function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  const ctx = await obtenerContexto();
  const plural = plantillaDe(ctx.negocio.tipo).recurso.plural;
  const items = itemsDeConfiguracion(ctx.rol).map((i) => ({
    href: i.href,
    etiqueta: i.href.endsWith('/recursos') ? plural.charAt(0).toUpperCase() + plural.slice(1) : i.etiqueta,
  }));
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[12rem_1fr]">
      <NavConfiguracion items={items} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
