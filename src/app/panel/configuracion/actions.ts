'use server';

import { configTurnosSchema } from '@/lib/dominio/esquemas-turnos';
import { normalizarTelefono } from '@/lib/dominio/telefono';
import { crearVolver, exigirGestionServicios, type Volver } from '@/lib/panel/acciones';
import { crearClienteServidor } from '@/lib/supabase/server';

const volver: Volver = crearVolver('/panel/configuracion');

export async function guardarConfigTurnos(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const r = configTurnosSchema.safeParse({
    // Cada negocio ve solo uno de estos dos campos según su modo: el otro se conserva.
    paso_minutos: formData.get('paso_minutos') ?? '60',
    intervalo_min: formData.get('intervalo_min') ?? '15',
    anticipacion_min_horas: formData.get('anticipacion_min_horas'),
    anticipacion_max_dias: formData.get('anticipacion_max_dias'),
  });
  if (!r.success) volver('error', r.error.issues[0].message);
  const { paso_minutos, intervalo_min, ...comunes } = r.data;
  const cambios = {
    ...comunes,
    ...(formData.get('paso_minutos') !== null && { paso_minutos }),
    ...(formData.get('intervalo_min') !== null && { intervalo_min }),
  };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('negocios').update(cambios).eq('id', ctx.negocio.id).select('id');
  if (error || !data?.length) volver('error', 'No se pudo guardar la configuración.');
  volver('ok', 'Configuración guardada.');
}

export async function guardarWhatsapp(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const crudo = typeof formData.get('whatsapp') === 'string' ? String(formData.get('whatsapp')).slice(0, 30).trim() : '';
  let whatsapp = '';
  if (crudo) {
    const tel = normalizarTelefono(crudo);
    if (!tel.ok) volver('error', tel.error);
    whatsapp = tel.e164;
  }
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('negocios').update({ whatsapp }).eq('id', ctx.negocio.id).select('id');
  if (error || !data?.length) volver('error', 'No se pudo guardar el WhatsApp.');
  volver('ok', whatsapp ? 'WhatsApp guardado.' : 'WhatsApp borrado.');
}
