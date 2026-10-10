'use server';

import { servicioSchema } from '@/lib/dominio/esquemas-turnos';
import { plantillaDe } from '@/lib/dominio/plantillas';
import { crearVolver, type Volver, exigirGestionServicios, leerUuid } from '@/lib/panel/acciones';
import { crearClienteServidor } from '@/lib/supabase/server';

const volver: Volver = crearVolver('/panel/servicios');

function leerServicio(formData: FormData) {
  const r = servicioSchema.safeParse({
    nombre: formData.get('nombre'),
    duracion_min: formData.get('duracion_min'),
    precio: formData.get('precio') || '0',
  });
  if (!r.success) volver('error', r.error.issues[0].message);
  return r.data;
}

export async function crearServicio(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const datos = leerServicio(formData);
  const supabase = await crearClienteServidor();
  const { data: nuevo, error } = await supabase
    .from('servicios')
    .insert({ ...datos, negocio_id: ctx.negocio.id })
    .select('id')
    .single();
  if (error || !nuevo) volver('error', error?.code === '23505' ? 'Ya tenés un servicio con ese nombre.' : 'No se pudo crear el servicio.');
  // Por defecto lo hacen todos los recursos activos: así aparece enseguida en la agenda.
  const plural = plantillaDe(ctx.negocio.tipo).recurso.plural;
  const seccion = plural.charAt(0).toUpperCase() + plural.slice(1);
  const { data: recursos } = await supabase.from('recursos').select('id').eq('activo', true);
  if (recursos?.length) {
    const { error: errorVinculos } = await supabase
      .from('recurso_servicio')
      .insert(recursos.map((r) => ({ negocio_id: ctx.negocio.id, recurso_id: r.id, servicio_id: nuevo.id })));
    if (errorVinculos) volver('ok', `Servicio creado. Asignáselo a quien lo hace en ${seccion}.`);
  }
  volver('ok', recursos?.length ? `Servicio creado y asignado a todos. Podés cambiarlo en ${seccion}.` : 'Servicio creado.');
}

export async function editarServicio(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const id = leerUuid(formData.get('servicioId'), () => volver('error', 'Solicitud inválida.'));
  const datos = leerServicio(formData);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('servicios')
    .update(datos)
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error) volver('error', error.code === '23505' ? 'Ya tenés un servicio con ese nombre.' : 'No se pudo guardar el servicio.');
  if (!data?.length) volver('error', 'Servicio no encontrado.');
  volver('ok', 'Servicio actualizado.');
}

export async function alternarServicio(formData: FormData) {
  const ctx = await exigirGestionServicios(volver);
  const id = leerUuid(formData.get('servicioId'), () => volver('error', 'Solicitud inválida.'));
  const activar = formData.get('activar') === 'si';
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('servicios')
    .update({ activo: activar })
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudo actualizar el servicio.');
  volver('ok', activar ? 'Servicio reactivado.' : 'Servicio desactivado.');
}
