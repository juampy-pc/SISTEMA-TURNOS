import Link from 'next/link';
import { redirect } from 'next/navigation';
import { itemsDeConfiguracion } from '@/lib/dominio/menu';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';

export default async function ConfiguracionPage() {
  const ctx = await obtenerContexto();
  const items = itemsDeConfiguracion(ctx.rol);
  if (items.length === 0) redirect('/panel');
  const { recurso } = plantillaDe(ctx.negocio.tipo);

  return (
    <div className="space-y-8">
      <h2 className="titulo">Configuración</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="tarjeta block h-full space-y-1 transition-colors hover:border-niebla">
              <span className="subtitulo block text-xl">
                {i.href.endsWith('/recursos') ? recurso.plural : i.etiqueta}
              </span>
              <span className="block text-sm text-niebla">{i.descripcion}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
