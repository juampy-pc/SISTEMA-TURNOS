import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { diasDesde, esFechaISO, etiquetaDia, horaLocal, hoyISO, sumarDias } from '@/lib/dominio/fechas';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { hashDispositivoActual } from '@/lib/publico/dispositivo';
import { cargarNegocio } from '@/lib/publico/negocio';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { Logo } from '@/components/marca/Logo';
import { SelectorDias } from '@/components/marca/SelectorDias';
import { reservar } from './actions';

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
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 text-blanco">
      <header className="space-y-3">
        <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: negocio.color }} aria-hidden />
        <div className="flex items-center gap-4">
          {negocio.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={negocio.logo_url} alt={`Logo de ${negocio.nombre}`} className="h-16 w-16 rounded-xl object-cover" />
          )}
          <div className="space-y-2">
            <h1 className="titulo">{negocio.nombre}</h1>
            <p className="text-niebla">Pedí tu {reserva} en pocos pasos.</p>
          </div>
        </div>
        {negocio.descripcion && <p className="whitespace-pre-line text-niebla">{negocio.descripcion}</p>}
        {(negocio.direccion || negocio.instagram) && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-niebla">
            {negocio.direccion && (
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(negocio.direccion)}`} target="_blank" rel="noopener noreferrer" className="enlace">
                {negocio.direccion}
              </a>
            )}
            {negocio.instagram && (
              <a href={`https://instagram.com/${negocio.instagram}`} target="_blank" rel="noopener noreferrer" className="enlace">
                @{negocio.instagram}
              </a>
            )}
          </p>
        )}
      </header>
      {p.error && <p role="alert" className="aviso-error">{p.error}</p>}

      {negocio.servicios.length === 0 ? (
        <p className="text-niebla">Este negocio todavía no cargó sus servicios.</p>
      ) : (
        <form method="get" className="space-y-3 tarjeta">
          <label className="block text-sm">Servicio
            <select name="servicio" defaultValue={servicio?.id ?? ''} required className="campo">
              <option value="" disabled>Elegí…</option>
              {negocio.servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre} · {s.duracion_min} min · {Number(s.precio) > 0 ? `$${Number(s.precio).toLocaleString('es-AR')}` : 'precio a consultar'}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">{recursoEtiqueta}
            <select name="recurso" defaultValue={recursoSel} className="campo">
              <option value="cualquiera">Cualquiera</option>
              {(servicio ? recursosDelServicio : negocio.recursos).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </label>
          <SelectorDias
            etiqueta="Día"
            nombre="fecha"
            hoy={hoy}
            dias={diasDesde(hoy, Math.min(negocio.anticipacion_max_dias, 60) + 1)}
            seleccionado={fecha ?? hoy}
          />
          <button className="boton">Ver horarios</button>
        </form>
      )}

      {servicio && fecha && (
        <section aria-label="Horarios" className="space-y-4 tarjeta">
          <h2 className="subtitulo">{etiquetaDia(fecha)}</h2>
          {huecos.length === 0 ? (
            <p className="text-niebla">No quedan horarios libres ese día. Probá con otro día.</p>
          ) : (
            <form action={reservar} className="space-y-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="fecha" value={fecha} />
              <input type="hidden" name="servicioId" value={servicio.id} />
              <input type="hidden" name="recursoSel" value={recursoSel} />
              <fieldset className="flex flex-wrap gap-2">
                <legend className="etiqueta mb-2">Horarios libres</legend>
                {huecos.map((h) => (
                  <label key={h.inicio} className="cursor-pointer">
                    <input type="radio" name="inicio" value={h.inicio} required className="peer sr-only" />
                    <span className="inline-flex min-h-11 items-center rounded-full border border-cielo px-4 py-2 font-mono text-sm text-cielo transition-colors hover:bg-cielo/10 peer-checked:bg-cielo peer-checked:text-noche peer-focus-visible:ring-2 peer-focus-visible:ring-cielo">
                      {horaLocal(h.inicio)}
                      {recursoSel !== 'cualquiera' && <span className="sr-only"> con {nombreRecurso.get(h.recurso_id)}</span>}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="block text-sm">Tu nombre<input name="nombre" defaultValue={precarga.nombre} required minLength={2} maxLength={80} autoComplete="name" className="campo" /></label>
              <label className="block text-sm">Tu teléfono (WhatsApp)<input name="telefono" type="tel" inputMode="tel" defaultValue={precarga.telefono} required autoComplete="tel" className="campo" /></label>
              <label className="block text-sm">Nota para el negocio (opcional)<textarea name="nota" defaultValue={p.nota ?? ''} maxLength={500} rows={2} className="campo" /></label>
              <button className="boton w-full sm:w-auto">Pedir {reserva}</button>
            </form>
          )}
        </section>
      )}

      {negocio.productos.length > 0 && (
        <section aria-label="Productos" className="space-y-3">
          <h2 className="subtitulo">Productos</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {negocio.productos.map((x) => (
              <li key={x.id} className="flex gap-3 tarjeta">
                {x.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={x.foto_url} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span aria-hidden className="h-20 w-20 shrink-0 rounded-lg bg-linea" />
                )}
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-medium">{x.nombre}</p>
                  {Number(x.precio) > 0 && <p className="font-mono text-cielo">${Number(x.precio).toLocaleString('es-AR')}</p>}
                  {x.descripcion && <p className="text-niebla">{x.descripcion}</p>}
                  {!x.hay_stock && <p className="text-xs text-niebla">Sin stock por ahora</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="flex items-center gap-2 border-t border-linea pt-6 text-xs text-niebla">
        Turnos con <Logo className="h-3.5 w-auto" />
      </footer>
    </main>
  );
}
