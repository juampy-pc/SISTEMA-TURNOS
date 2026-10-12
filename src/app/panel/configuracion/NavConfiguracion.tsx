'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavConfiguracion({ items }: { items: { href: string; etiqueta: string }[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Configuración" className="min-w-0 md:sticky md:top-36 md:self-start">
      <Link href="/panel/configuracion" className="etiqueta hidden md:block md:pb-3">Configuración</Link>
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0">
        {items.map((i) => {
          const activo = ruta.startsWith(i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={activo ? 'page' : undefined}
                className={`block whitespace-nowrap rounded-full px-4 py-2 text-sm transition-colors md:rounded-xl ${
                  activo ? 'bg-grafito text-blanco ring-1 ring-linea' : 'text-niebla hover:text-blanco'
                }`}
              >
                {i.etiqueta}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
