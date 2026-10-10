import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { esFechaISO, etiquetaDia, horaLocal, hoyISO, sumarDias } from '@/lib/dominio/fechas';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { hashDispositivoActual } from '@/lib/publico/dispositivo';
import { cargarNegocio } from '@/lib/publico/negocio';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { reservar } from './actions';

const input = 'w-full rounded-lg border border-stone-300 px-3 py-2';
const boton = 'min-h-11 rounded-lg bg-stone-900 px-4 py-2 text-white';
const botonSec = 'min-h-11 rounded-lg border border-stone-300 px-3 py-1.5 text-sm';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const negocio = await cargarNegocio((await params).slug);
  return { title: negocio ? `${negocio.nombre} · Pedí tu turno` : 'Negocio no encontrado' };
}

interface Params {
  servicio?: string;
  recurso?: string;
  fecha?: string;
  nombre?: string;
  telefono?: string;
  nota?: string;
  error?: string;
}

export default async function PaginaPublica({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Params>;
}) {
  const { slug } = await params;
  const negocio = await cargarNegocio(slug);
  if (!negocio) notFound();
  const p = await searchParams;
  const plantilla = plantillaDe(negocio.tipo);
  const hoy = hoyISO();
  const maxFecha = sumarDias(hoy, negocio.anticipacion_max_dias);
  const fecha = esFechaISO(p.fecha) && p.fecha >= hoy && p.fecha <= maxFecha ? p.fecha : null;

  const servicio = negocio.servicios.find((s) => s.id === p.servicio) ?? null;
  const recursosDelServicio = servicio ? negocio.recursos.filter((r) => servicio.recursos.includes(r.id)) : [];
  const recursoSel = recursosDelServicio.find((r) => r.id === p.recurso)?.id ?? 'cualquiera';
  const nombreRecurso = new Map(negocio.recursos.map((r) => [r.id, r.nombre]));

  const admin = crearClienteAdmin();
  let huecos: { recurso_id: string; inicio: string }[] = [];
  if (servicio && fecha) {
    const { data } = await admin.rpc('huecos_publicos', {
      p_negocio: negocio.id,
      p_servicio: servicio.id,
      // null = cualquiera; los tipos generados no lo reflejan.
      p_recurso: (recursoSel === 'cualquiera' ? null : recursoSel) as string,
      p_fecha: fecha,
    });
    // Un botón por horario: si hay varios recursos libres, el servidor asigna el primero.
    const vistos = new Set<string>();
    huecos = (data ?? []).filter((h) => (vistos.has(h.inicio) ? false : (vistos.add(h.inicio), true)));
  }

  // Dispositivo confiable: precarga nombre y teléfono.
  let precarga = { nombre: p.nombre ?? '', telefono: p.telefono ?? '' };
  if (!p.nombre && !p.telefono) {
    const hash = await hashDispositivoActual();
    if (hash) {
      const { data } = await admin.rpc('datos_dispositivo', { p_negocio: negocio.id, p_token_hash: hash });
      if (data?.[0]) precarga = { nombre: data[0].nombre, telefono: data[0].telefono };
    }
  }

  const reserva = plantilla.reserva.singular;
  const recursoEtiqueta = plantilla.recurso.singular.charAt(0).toUpperCase() + plantilla.recurso.singular.slice(1);

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 text-stone-900">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold">{negocio.nombre}</h1>
        <p className="text-stone-600">Pedí tu {reserva} en pocos pasos.</p>
      </header>
      {p.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{p.error}</p>}

      {negocio.servicios.length === 0 ? (
        <p className="text-stone-500">Este negocio todavía no cargó sus servicios.</p>
      ) : (
        <form method="get" className="space-y-3 rounded-xl border border-stone-200 bg-white p-4">
          <label className="block text-sm">Servicio
            <select name="servicio" defaultValue={servicio?.id ?? ''} required className={input}>
              <option value="" disabled>Elegí…</option>
              {negocio.servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} · {s.duracion_min} min{Number(s.precio) > 0 ? ` · $${Number(s.precio)}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">{recursoEtiqueta}
            <select name="recurso" defaultValue={recursoSel} className={input}>
              <option value="cualquiera">Cualquiera</option>
              {(servicio ? recursosDelServicio : negocio.recursos).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
          <label className="block text-sm">Día
            <input type="date" name="fecha" min={hoy} max={maxFecha} defaultValue={fecha ?? hoy} required className={input} />
          </label>
          <button className={botonSec}>Ver horarios</button>
        </form>
      )}

      {servicio && fecha && (
        <section aria-label="Horarios" className="space-y-4 rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="font-semibold capitalize">{etiquetaDia(fecha)}</h2>
          {huecos.length === 0 ? (
            <p className="text-stone-500">No quedan horarios libres ese día. Probá con otro día.</p>
          ) : (
            <form action={reservar} className="space-y-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="fecha" value={fecha} />
              <input type="hidden" name="servicioId" value={servicio.id} />
              <input type="hidden" name="recursoSel" value={recursoSel} />
              <fieldset className="flex flex-wrap gap-2">
                <legend className="mb-1 text-sm">Horario</legend>
                {huecos.map((h) => (
                  <label key={h.inicio} className="cursor-pointer">
                    <input type="radio" name="inicio" value={h.inicio} required className="peer sr-only" />
                    <span className="inline-block min-h-11 rounded-lg border border-stone-300 px-3 py-2 text-sm peer-checked:border-stone-900 peer-checked:bg-stone-900 peer-checked:text-white peer-focus-visible:ring-2">
                      {horaLocal(h.inicio)}
                      {recursoSel !== 'cualquiera' && <span className="sr-only"> con {nombreRecurso.get(h.recurso_id)}</span>}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="block text-sm">Tu nombre<input name="nombre" defaultValue={precarga.nombre} required minLength={2} maxLength={80} autoComplete="name" className={input} /></label>
              <label className="block text-sm">Tu teléfono (WhatsApp)<input name="telefono" type="tel" inputMode="tel" defaultValue={precarga.telefono} required autoComplete="tel" className={input} /></label>
              <label className="block text-sm">Nota para el negocio (opcional)<textarea name="nota" defaultValue={p.nota ?? ''} maxLength={500} rows={2} className={input} /></label>
              <button className={boton}>Pedir {reserva}</button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
