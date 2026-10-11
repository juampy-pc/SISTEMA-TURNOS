import Link from 'next/link';
import { notFound } from 'next/navigation';
import { etiquetaDia, horaLocal, ZONA } from '@/lib/dominio/fechas';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { linkWhatsapp } from '@/lib/dominio/whatsapp';
import { cargarNegocio } from '@/lib/publico/negocio';
import { Isotipo } from '@/components/marca/Logo';

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
  const reservaCap = reserva.charAt(0).toUpperCase() + reserva.slice(1);
  const whatsapp = linkWhatsapp(
    negocio.whatsapp,
    `Hola! Soy ${(nombre ?? '').slice(0, 80)}. Pedí ${fem ? 'una' : 'un'} ${reserva} para el ${cuando} desde la página.`,
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 py-12 text-center text-blanco">
      <Isotipo className="h-28 w-28" />
      <section role="status" className="w-full space-y-6">
        <h1 className="titulo">{`${reservaCap} ${confirmado ? (fem ? 'confirmada' : 'confirmado') : fem ? 'pedida' : 'pedido'}`}</h1>
        <div className="tarjeta space-y-1 text-left">
          {fechaHora && (
            <p className="etiqueta">
              {etiquetaDia(fechaHora.toLocaleDateString('en-CA', { timeZone: ZONA }))} · <span className="text-cielo">{horaLocal(fechaHora.toISOString())}</span>
            </p>
          )}
          <p className="text-lg font-medium">{negocio.nombre}</p>
          <p className="text-niebla">
            {confirmado
              ? 'Te esperamos.'
              : `El negocio tiene que ${fem ? 'confirmarla' : 'confirmarlo'}. ${whatsapp ? 'Avisale por WhatsApp para que lo vea más rápido.' : 'Te va a contactar al teléfono que dejaste.'}`}
          </p>
        </div>
      </section>
      {!confirmado && whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="boton w-full">
          Avisar por WhatsApp
        </a>
      )}
      <p><Link href={`/b/${slug}`} className="enlace text-sm">Pedir {fem ? 'otra' : 'otro'} {reserva}</Link></p>
    </main>
  );
}
