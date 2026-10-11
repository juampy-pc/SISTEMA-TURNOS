'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavPanel({ items }: { items: { href: string; etiqueta: string }[] }) {
  const ruta = usePathname();
  return (
    <nav aria-label="Secciones" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-3">
      {items.map((i) => {
        const activo = i.href === '/panel' ? ruta === '/panel' : ruta.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={activo ? 'page' : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-colors ${
              activo ? 'bg-cielo text-noche' : 'text-niebla hover:text-blanco'
            }`}
          >
            {i.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
