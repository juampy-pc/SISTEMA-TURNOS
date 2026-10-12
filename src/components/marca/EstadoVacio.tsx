import { Isotipo } from './Logo';

// Un vacío es una invitación a actuar: qué pasa y qué hacer.
export function EstadoVacio({ titulo, children }: { titulo: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-dashed border-linea px-5 py-6">
      <Isotipo className="h-10 w-10 shrink-0" />
      <div className="space-y-1">
        <p className="font-medium">{titulo}</p>
        {children && <div className="text-sm text-niebla">{children}</div>}
      </div>
    </div>
  );
}
