import Link from 'next/link';
import { pasosIniciales } from '@/lib/dominio/checklist';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';

export default async function InicioPage() {
  const ctx = await obtenerContexto();
  const plantilla = plantillaDe(ctx.negocio.tipo);

  let pasos: ReturnType<typeof pasosIniciales> = [];
  if (ctx.rol.es_dueno) {
    const supabase = await crearClienteServidor();
    const { count } = await supabase.from('miembros').select('id', { count: 'exact', head: true });
    pasos = pasosIniciales({ cantidadMiembros: count ?? 1 });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-2xl font-semibold">Hola, {ctx.miembro.nombre}</h2>
        <p className="text-stone-600">
          Acá vas a manejar tus {plantilla.reserva.plural} y tus {plantilla.recurso.plural}.
        </p>
      </section>

      {pasos.length > 0 && (
        <section aria-label="Primeros pasos" className="rounded-xl border border-stone-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Primeros pasos</h3>
          <ul className="space-y-2">
            {pasos.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <span aria-hidden>{p.hecho ? '✅' : '⬜'}</span>
                {p.href && !p.hecho ? <Link href={p.href} className="underline">{p.texto}</Link> : <span>{p.texto}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Consejos" className="rounded-xl border border-stone-200 bg-white p-4">
        <h3 className="mb-3 font-semibold">Consejos para {plantilla.etiqueta.toLowerCase()}</h3>
        <ul className="list-disc space-y-2 pl-5 text-stone-700">
          {plantilla.tips.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </section>
    </div>
  );
}
