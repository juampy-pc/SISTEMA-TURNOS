import Link from 'next/link';
import { notFound } from 'next/navigation';
import { etiquetaDia, horaLocal, ZONA } from '@/lib/dominio/fechas';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { linkWhatsapp } from '@/lib/dominio/whatsapp';
import { cargarNegocio } from '@/lib/publico/negocio';

export default async function ReservaLista({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ estado?: string; inicio?: string; nombre?: string }>;
}) {
  const { slug } = await params;
  const negocio = await cargarNegocio(slug);
  if (!negocio) notFound();
  const { estado, inicio, nombre } = await searchParams;
  const fechaHora = inicio && !Number.isNaN(Date.parse(inicio)) ? new Date(inicio) : null;
  const reserva = plantillaDe(negocio.tipo).reserva.singular;
  const cuando = fechaHora
    ? `${etiquetaDia(fechaHora.toLocaleDateString('en-CA', { timeZone: ZONA }))} a las ${horaLocal(fechaHora.toISOString())}`
    : '';
  const confirmado = estado === 'confirmado';
  const fem = reserva.endsWith('a');
  const whatsapp = linkWhatsapp(
    negocio.whatsapp,
    `Hola! Soy ${(nombre ?? '').slice(0, 80)}. Pedí ${fem ? 'una' : 'un'} ${reserva} para el ${cuando} desde la página.`,
  );

  return (
    <main className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 text-stone-900">
      <h1 className="text-3xl font-semibold">{negocio.nombre}</h1>
      <section role="status" className={`space-y-2 rounded-xl p-4 ${confirmado ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}>
        <h2 className="text-xl font-semibold">{confirmado ? `¡Tu ${reserva} está ${fem ? 'confirmada' : 'confirmado'}!` : `Pediste tu ${reserva}`}</h2>
        {cuando && <p className="capitalize">{cuando}</p>}
        <p>
          {confirmado
            ? 'Te esperamos.'
            : `El negocio tiene que ${fem ? 'confirmarla' : 'confirmarlo'}. ${whatsapp ? 'Avisale por WhatsApp para que lo vea más rápido.' : 'Te va a contactar al teléfono que dejaste.'}`}
        </p>
      </section>
      {!confirmado && whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-block min-h-11 rounded-lg bg-green-600 px-4 py-2 text-white">
          Avisar por WhatsApp
        </a>
      )}
      <p><Link href={`/b/${slug}`} className="text-sm underline">Pedir {fem ? 'otra' : 'otro'} {reserva}</Link></p>
    </main>
  );
}
