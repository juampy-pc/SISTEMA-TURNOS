'use server';

import { recursoSchema } from '@/lib/dominio/esquemas-turnos';
import { crearVolver, type Volver, exigirGestionServicios, leerUuid } from '@/lib/panel/acciones';
import { crearClienteServidor } from '@/lib/supabase/server';

const volver: Volver = crearVolver('/panel/recursos');
const solicitudInvalida = () => volver('error', 'Solicitud inválida.');

function leerNombre(formData: FormData) {
  const r = recursoSchema.safeParse({ nombre: formData.get('nombre') });
  if (!r.success) volver('error', r.error.issues[0].message);
  return r.data.nombre;
}

export async function crearRecurso(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const nombre = leerNombre(formData);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('recursos').insert({ nombre, negocio_id: ctx.negocio.id });
  if (error) volver('error', error.code === '23505' ? 'Ya tenés uno con ese nombre.' : 'No se pudo crear.');
  volver('ok', 'Creado.');
}

export async function renombrarRecurso(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const id = leerUuid(formData.get('recursoId'), solicitudInvalida);
  const nombre = leerNombre(formData);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('recursos')
    .update({ nombre })
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error) volver('error', error.code === '23505' ? 'Ya tenés uno con ese nombre.' : 'No se pudo guardar.');
  if (!data?.length) volver('error', 'No encontrado.');
  volver('ok', 'Guardado.');
}

export async function alternarRecurso(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const id = leerUuid(formData.get('recursoId'), solicitudInvalida);
  const activar = formData.get('activar') === 'si';
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('recursos')
    .update({ activo: activar })
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudo actualizar.');
  volver('ok', activar ? 'Reactivado.' : 'Desactivado.');
}

// Aplica solo la diferencia (altas y bajas) para no perder asignaciones si algo falla a medias.
export async function guardarServiciosDeRecurso(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const recursoId = leerUuid(formData.get('recursoId'), solicitudInvalida);
  const supabase = await crearClienteServidor();

  const { data: recurso } = await supabase
    .from('recursos')
    .select('id')
    .eq('id', recursoId)
    .eq('negocio_id', ctx.negocio.id)
    .maybeSingle();
  if (!recurso) volver('error', 'No encontrado.');

  const { data: servicios } = await supabase.from('servicios').select('id').eq('negocio_id', ctx.negocio.id);
  const elegidos = new Set(
    (servicios ?? []).map((s) => s.id).filter((id) => formData.get(`servicio_${id}`) === 'on'),
  );
  const { data: actuales, error: errLectura } = await supabase
    .from('recurso_servicio')
    .select('servicio_id')
    .eq('recurso_id', recursoId)
    .eq('negocio_id', ctx.negocio.id);
  if (errLectura) volver('error', 'No se pudo guardar.');
  const actualesIds = new Set((actuales ?? []).map((a) => a.servicio_id));

  const altas = [...elegidos].filter((id) => !actualesIds.has(id));
  const bajas = [...actualesIds].filter((id) => !elegidos.has(id));

  if (altas.length) {
    const { error } = await supabase
      .from('recurso_servicio')
      .insert(altas.map((servicio_id) => ({ negocio_id: ctx.negocio.id, recurso_id: recursoId, servicio_id })));
    if (error) volver('error', 'No se pudo guardar.');
  }
  if (bajas.length) {
    const { error } = await supabase
      .from('recurso_servicio')
      .delete()
      .eq('recurso_id', recursoId)
      .eq('negocio_id', ctx.negocio.id)
      .in('servicio_id', bajas);
    if (error) volver('error', 'No se pudo guardar.');
  }
  volver('ok', 'Servicios guardados.');
}
