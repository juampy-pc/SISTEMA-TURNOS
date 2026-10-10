'use server';

import { revalidatePath } from 'next/cache';
import { negocioSchema } from '@/lib/dominio/esquemas-negocio';
import { puede } from '@/lib/dominio/permisos';
import { normalizarTelefono } from '@/lib/dominio/telefono';
import { crearVolver, type Volver } from '@/lib/panel/acciones';
import { obtenerContexto } from '@/lib/panel/contexto';
import { borrarImagen, subirImagen } from '@/lib/panel/imagenes';
import { crearClienteServidor } from '@/lib/supabase/server';

const volver: Volver = crearVolver('/panel/negocio');

async function exigirNegocio() {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'editar_negocio')) volver('error', 'No tenés permiso para hacer esto.');
  return ctx;
}

function texto(valor: FormDataEntryValue | null, max: number): string {
  return typeof valor === 'string' ? valor.slice(0, max) : '';
}

export async function guardarNegocio(formData: FormData) {
  await exigirNegocio();
  const r = negocioSchema.safeParse({
    nombre: texto(formData.get('nombre'), 100),
    descripcion: texto(formData.get('descripcion'), 600),
    direccion: texto(formData.get('direccion'), 150),
    instagram: texto(formData.get('instagram'), 100),
    color: texto(formData.get('color'), 7),
    vende_productos: formData.get('vende_productos') === 'on',
  });
  if (!r.success) volver('error', r.error.issues[0].message);
  const crudo = texto(formData.get('whatsapp'), 30).trim();
  let whatsapp = '';
  if (crudo) {
    const tel = normalizarTelefono(crudo);
    if (!tel.ok) volver('error', `WhatsApp: ${tel.error}`);
    whatsapp = tel.e164;
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('guardar_negocio', {
    p_nombre: r.data.nombre,
    p_descripcion: r.data.descripcion,
    p_direccion: r.data.direccion,
    p_instagram: r.data.instagram,
    p_color: r.data.color,
    p_whatsapp: whatsapp,
    p_vende_productos: r.data.vende_productos,
  });
  if (error) volver('error', 'No se pudieron guardar los datos.');
  // El nombre y el menú (productos) salen del layout del panel.
  revalidatePath('/panel', 'layout');
  volver('ok', 'Datos del negocio guardados.');
}

export async function subirLogo(formData: FormData) {
  const ctx = await exigirNegocio();
  const subida = await subirImagen(formData.get('logo'), ctx.negocio.id, 'logo');
  if (!subida.ok) volver('error', subida.error);
  const supabase = await crearClienteServidor();
  const { data: anterior } = await supabase.from('negocios').select('logo_url').eq('id', ctx.negocio.id).single();
  const { error } = await supabase.rpc('guardar_logo', { p_url: subida.url });
  if (error) {
    await borrarImagen(subida.url, ctx.negocio.id);
    volver('error', 'No se pudo guardar el logo.');
  }
  if (anterior?.logo_url) await borrarImagen(anterior.logo_url, ctx.negocio.id);
  volver('ok', 'Logo actualizado.');
}

export async function quitarLogo() {
  const ctx = await exigirNegocio();
  const supabase = await crearClienteServidor();
  const { data: anterior } = await supabase.from('negocios').select('logo_url').eq('id', ctx.negocio.id).single();
  const { error } = await supabase.rpc('guardar_logo', { p_url: '' });
  if (error) volver('error', 'No se pudo quitar el logo.');
  if (anterior?.logo_url) await borrarImagen(anterior.logo_url, ctx.negocio.id);
  volver('ok', 'Logo quitado.');
}
