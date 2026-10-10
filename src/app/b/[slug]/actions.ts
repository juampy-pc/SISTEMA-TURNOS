'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { esFechaISO } from '@/lib/dominio/fechas';
import { normalizarTelefono } from '@/lib/dominio/telefono';
import { hashDispositivoOCrear } from '@/lib/publico/dispositivo';
import { crearClienteAdmin } from '@/lib/supabase/admin';

function texto(valor: FormDataEntryValue | null, max: number): string {
  return typeof valor === 'string' ? valor.slice(0, max) : '';
}

async function ipDelPedido(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim().slice(0, 64);
}

const MENSAJES: Record<string, string> = {
  horario_ocupado: 'Ese horario se acaba de ocupar. Elegí otro.',
  limite_alcanzado: 'Hiciste muchos pedidos seguidos. Esperá un rato o escribile al negocio.',
  datos_invalidos: 'Revisá los datos e intentá de nuevo.',
};

export async function reservar(formData: FormData) {
  const slug = texto(formData.get('slug'), 40);
  const fecha = texto(formData.get('fecha'), 10);
  const conservar = {
    servicio: texto(formData.get('servicioId'), 36),
    recurso: texto(formData.get('recursoSel'), 36),
    fecha,
    nombre: texto(formData.get('nombre'), 80),
    telefono: texto(formData.get('telefono'), 30),
    nota: texto(formData.get('nota'), 500),
  };
  const volver: (mensaje: string) => never = (mensaje) => {
    const qs = new URLSearchParams({ ...conservar, error: mensaje });
    redirect(`/b/${encodeURIComponent(slug)}?${qs.toString()}`);
  };

  if (!/^[a-z0-9-]{3,40}$/.test(slug) || !esFechaISO(fecha)) volver(MENSAJES.datos_invalidos);
  const servicioId = z.uuid().safeParse(conservar.servicio);
  if (!servicioId.success) volver('Elegí un servicio.');
  const recursoSel = conservar.recurso === 'cualquiera' ? null : z.uuid().safeParse(conservar.recurso);
  if (recursoSel && !recursoSel.success) volver('Elegí con quién.');
  const nombre = z.string().trim().min(2, 'Escribí tu nombre.').max(80).safeParse(conservar.nombre);
  if (!nombre.success) volver(nombre.error.issues[0].message);
  const tel = normalizarTelefono(conservar.telefono);
  if (!tel.ok) volver(tel.error);
  const inicio = z.iso.datetime({ offset: true }).safeParse(texto(formData.get('inicio'), 40));
  if (!inicio.success) volver('Elegí un horario.');

  const admin = crearClienteAdmin();
  const { data: negocio } = await admin.rpc('negocio_publico', { p_slug: slug });
  const negocioId = (negocio as { id?: string } | null)?.id;
  if (!negocioId) volver('No encontramos este negocio.');

  const tokenHash = await hashDispositivoOCrear();
  const { data, error } = await admin.rpc('reservar_publico', {
    p_negocio: negocioId,
    p_servicio: servicioId.data,
    // El RPC acepta null para "cualquiera"; los tipos generados no lo reflejan.
    p_recurso: (recursoSel?.data ?? null) as string,
    p_inicio: inicio.data,
    p_nombre: nombre.data,
    p_telefono: tel.e164,
    p_nota: conservar.nota,
    p_token_hash: tokenHash,
    p_ip: await ipDelPedido(),
  });
  if (error) {
    const clave = Object.keys(MENSAJES).find((k) => error.message.includes(k));
    volver(clave ? MENSAJES[clave] : 'No se pudo pedir el turno. Intentá de nuevo.');
  }
  const estado = data?.[0]?.estado === 'confirmado' ? 'confirmado' : 'pendiente';
  const qs = new URLSearchParams({ estado, inicio: inicio.data, nombre: nombre.data });
  redirect(`/b/${encodeURIComponent(slug)}/listo?${qs.toString()}`);
}
