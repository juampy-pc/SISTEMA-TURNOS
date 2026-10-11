import { redirect } from 'next/navigation';
import { COLORES_MARCA } from '@/lib/dominio/esquemas-negocio';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';
import { guardarNegocio, quitarLogo, subirLogo } from './actions';

const ayuda = 'mt-1 block text-xs text-niebla';

export default async function MiNegocioPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'editar_negocio')) redirect('/panel');
  const { ok, error } = await searchParams;

  const supabase = await crearClienteServidor();
  const { data: n } = await supabase
    .from('negocios')
    .select('nombre, slug, descripcion, direccion, instagram, whatsapp, color, logo_url, vende_productos')
    .eq('id', ctx.negocio.id)
    .single();
  if (!n) redirect('/panel');

  return (
    <div className="space-y-6">
      <h2 className="titulo">Mi negocio</h2>
      {ok && <p role="status" className="aviso-ok">{ok}</p>}
      {error && <p role="alert" className="aviso-error">{error}</p>}

      <p className="text-sm text-niebla">
        Tu página para clientes:{' '}
        <a href={`/b/${n.slug}`} target="_blank" className="enlace font-mono">/b/{n.slug}</a>
      </p>

      <form action={guardarNegocio} className="grid gap-4 tarjeta sm:grid-cols-2">
        <label className="text-sm">Nombre del negocio
          <input name="nombre" defaultValue={n.nombre} required minLength={2} maxLength={80} className="campo" />
        </label>
        <label className="text-sm">WhatsApp del negocio
          <input name="whatsapp" type="tel" inputMode="tel" defaultValue={n.whatsapp} placeholder="11 4444-5555" className="campo" />
          <span className={ayuda}>Cuando alguien pide un turno, puede avisarte por acá. Vacío para no mostrarlo.</span>
        </label>
        <label className="text-sm sm:col-span-2">Descripción
          <textarea name="descripcion" defaultValue={n.descripcion} maxLength={500} rows={3} placeholder="Qué hacés, qué te diferencia…" className="campo" />
        </label>
        <label className="text-sm">Dirección
          <input name="direccion" defaultValue={n.direccion} maxLength={120} placeholder="Av. Siempre Viva 742, Resistencia" className="campo" />
        </label>
        <label className="text-sm">Instagram
          <input name="instagram" defaultValue={n.instagram ? `@${n.instagram}` : ''} maxLength={100} placeholder="@tunegocio" className="campo" />
        </label>
        <fieldset className="text-sm sm:col-span-2">
          <legend className="mb-2">Color de tu página</legend>
          <div className="flex flex-wrap gap-2">
            {COLORES_MARCA.map((c) => (
              <label key={c.valor} className="cursor-pointer">
                <input type="radio" name="color" value={c.valor} defaultChecked={n.color === c.valor} className="peer sr-only" />
                <span className="flex min-h-11 items-center gap-2 rounded-xl border border-linea bg-noche px-3 py-2 peer-checked:border-cielo peer-checked:ring-2 peer-checked:ring-cielo peer-focus-visible:ring-2">
                  <span aria-hidden className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: c.valor }} />
                  {c.nombre}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="vende_productos" defaultChecked={n.vende_productos} className="mt-1 h-4 w-4" />
          <span>
            Vendo productos
            <span className={ayuda}>Muestra Productos y Stock en el menú, y el catálogo en tu página.</span>
          </span>
        </label>
        <div className="sm:col-span-2"><button className="boton">Guardar</button></div>
      </form>

      <section aria-label="Logo" className="space-y-3 tarjeta">
        <h3 className="subtitulo">Logo</h3>
        {n.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={n.logo_url} alt={`Logo de ${n.nombre}`} className="h-24 w-24 rounded-xl border border-linea object-cover" />
        ) : (
          <p className="text-sm text-niebla">Todavía no subiste un logo.</p>
        )}
        <form action={subirLogo} className="flex flex-wrap items-end gap-2">
          <label className="text-sm">Subir logo (JPG, PNG o WebP, hasta 2 MB)
            <input type="file" name="logo" accept="image/jpeg,image/png,image/webp" required className="mt-1 block text-sm" />
          </label>
          <button className="boton">Subir</button>
        </form>
        {n.logo_url && (
          <form action={quitarLogo}><button className="boton-sec">Quitar logo</button></form>
        )}
      </section>
    </div>
  );
}
