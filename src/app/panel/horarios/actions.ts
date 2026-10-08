'use server';

import { bloqueoSchema, configTurnosSchema, franjaSchema } from '@/lib/dominio/esquemas-turnos';
import { validarFranjas } from '@/lib/dominio/horarios';
import { crearVolver, exigirGestionServicios, leerUuid, type Volver } from '@/lib/panel/acciones';
import { crearClienteServidor } from '@/lib/supabase/server';

const base = crearVolver('/panel/horarios');

// Conserva el recurso elegido al volver.
function volverA(recursoId: string | null): Volver {
  return (tipo, mensaje, extra = {}) => base(tipo, mensaje, recursoId ? { recurso: recursoId, ...extra } : extra);
}

async function recursoDelNegocio(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  negocioId: string,
  recursoId: string,
  volver: Volver,
) {
  const { data } = await supabase
    .from('recursos')
    .select('id')
    .eq('id', recursoId)
    .eq('negocio_id', negocioId)
    .maybeSingle();
  if (!data) volver('error', 'No encontrado.');
}

export async function agregarFranja(formData: FormData) {
  const rawRecurso = formData.get('recursoId');
  const volver: Volver = volverA(typeof rawRecurso === 'string' ? rawRecurso : null);
  const ctx = await exigirGestionServicios(volver);
  const recursoId = leerUuid(rawRecurso, () => volver('error', 'Solicitud inválida.'));
  const dias = formData.getAll('dias').map(String);
  if (dias.length === 0) volver('error', 'Elegí al menos un día.');

  const franjas = [];
  for (const dia of dias) {
    const r = franjaSchema.safeParse({ dia_semana: dia, desde: formData.get('desde'), hasta: formData.get('hasta') });
    if (!r.success) volver('error', r.error.issues[0].message);
    franjas.push(r.data);
  }

  const supabase = await crearClienteServidor();
  await recursoDelNegocio(supabase, ctx.negocio.id, recursoId, volver);
  const { data: existentes, error: errLectura } = await supabase
    .from('horarios')
    .select('dia_semana, desde_min, hasta_min')
    .eq('recurso_id', recursoId)
    .eq('negocio_id', ctx.negocio.id);
  if (errLectura) volver('error', 'No se pudo guardar.');

  for (const nueva of franjas) {
    const delDia = (existentes ?? []).filter((e) => e.dia_semana === nueva.dia_semana);
    const problema = validarFranjas([...delDia, nueva]);
    if (problema) volver('error', problema);
  }

  const { error } = await supabase
    .from('horarios')
    .insert(franjas.map((f) => ({ ...f, negocio_id: ctx.negocio.id, recurso_id: recursoId })));
  if (error) volver('error', error.code === '23P01' ? 'Esa franja se superpone con otra.' : 'No se pudo guardar.');
  volver('ok', 'Horario guardado.');
}

export async function quitarFranja(formData: FormData) {
  const rawRecurso = formData.get('recursoId');
  const volver: Volver = volverA(typeof rawRecurso === 'string' ? rawRecurso : null);
  const ctx = await exigirGestionServicios(volver);
  const id = leerUuid(formData.get('franjaId'), () => volver('error', 'Solicitud inválida.'));
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('horarios').delete().eq('id', id).eq('negocio_id', ctx.negocio.id);
  if (error) volver('error', 'No se pudo quitar la franja.');
  volver('ok', 'Franja quitada.');
}

export async function copiarHorario(formData: FormData) {
  const rawRecurso = formData.get('recursoId');
  const volver: Volver = volverA(typeof rawRecurso === 'string' ? rawRecurso : null);
  const ctx = await exigirGestionServicios(volver);
  const destino = leerUuid(rawRecurso, () => volver('error', 'Solicitud inválida.'));
  const origen = leerUuid(formData.get('origenId'), () => volver('error', 'Elegí de dónde copiar.'));
  if (origen === destino) volver('error', 'Elegí otro para copiar.');

  const supabase = await crearClienteServidor();
  await recursoDelNegocio(supabase, ctx.negocio.id, destino, volver);
  await recursoDelNegocio(supabase, ctx.negocio.id, origen, volver);

  const { data: franjas } = await supabase
    .from('horarios')
    .select('dia_semana, desde_min, hasta_min')
    .eq('recurso_id', origen)
    .eq('negocio_id', ctx.negocio.id);
  if (!franjas?.length) volver('error', 'Ese horario está vacío.');

  const { data: previas } = await supabase
    .from('horarios')
    .select('dia_semana, desde_min, hasta_min')
    .eq('recurso_id', destino)
    .eq('negocio_id', ctx.negocio.id);

  const { error: errBorrado } = await supabase
    .from('horarios')
    .delete()
    .eq('recurso_id', destino)
    .eq('negocio_id', ctx.negocio.id);
  if (errBorrado) volver('error', 'No se pudo copiar el horario.');

  const { error } = await supabase
    .from('horarios')
    .insert(franjas.map((f) => ({ ...f, negocio_id: ctx.negocio.id, recurso_id: destino })));
  if (error) {
    // Restaura lo que había para no dejar el recurso sin horario.
    if (previas?.length) {
      await supabase
        .from('horarios')
        .insert(previas.map((f) => ({ ...f, negocio_id: ctx.negocio.id, recurso_id: destino })));
    }
    volver('error', 'No se pudo copiar el horario.');
  }
  volver('ok', 'Horario copiado.');
}

export async function agregarBloqueo(formData: FormData) {
  const rawRecurso = formData.get('recursoId');
  const volver: Volver = volverA(typeof rawRecurso === 'string' && rawRecurso ? rawRecurso : null);
  const ctx = await exigirGestionServicios(volver);
  const r = bloqueoSchema.safeParse({
    desde: formData.get('desde'),
    hasta: formData.get('hasta'),
    motivo: formData.get('motivo') ?? '',
  });
  if (!r.success) volver('error', r.error.issues[0].message);

  const aplicaA = formData.get('aplicaA');
  let recursoId: string | null = null;
  if (typeof aplicaA === 'string' && aplicaA !== 'todos') {
    recursoId = leerUuid(aplicaA, () => volver('error', 'Solicitud inválida.'));
  }
  const supabase = await crearClienteServidor();
  if (recursoId) await recursoDelNegocio(supabase, ctx.negocio.id, recursoId, volver);

  const { error } = await supabase
    .from('bloqueos')
    .insert({ ...r.data, negocio_id: ctx.negocio.id, recurso_id: recursoId });
  if (error) volver('error', 'No se pudo guardar el bloqueo.');
  volver('ok', 'Bloqueo guardado.');
}

export async function quitarBloqueo(formData: FormData) {
  const rawRecurso = formData.get('recursoId');
  const volver: Volver = volverA(typeof rawRecurso === 'string' && rawRecurso ? rawRecurso : null);
  const ctx = await exigirGestionServicios(volver);
  const id = leerUuid(formData.get('bloqueoId'), () => volver('error', 'Solicitud inválida.'));
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('bloqueos').delete().eq('id', id).eq('negocio_id', ctx.negocio.id);
  if (error) volver('error', 'No se pudo quitar el bloqueo.');
  volver('ok', 'Bloqueo quitado.');
}

export async function guardarConfigTurnos(formData: FormData) {
  const rawRecurso = formData.get('recursoId');
  const volver: Volver = volverA(typeof rawRecurso === 'string' && rawRecurso ? rawRecurso : null);
  const ctx = await exigirGestionServicios(volver);
  const r = configTurnosSchema.safeParse({
    // En modo editable el paso no se muestra: se conserva el actual.
    paso_minutos: formData.get('paso_minutos') ?? '60',
    anticipacion_min_horas: formData.get('anticipacion_min_horas'),
    anticipacion_max_dias: formData.get('anticipacion_max_dias'),
  });
  if (!r.success) volver('error', r.error.issues[0].message);
  const cambios =
    formData.get('paso_minutos') === null
      ? { anticipacion_min_horas: r.data.anticipacion_min_horas, anticipacion_max_dias: r.data.anticipacion_max_dias }
      : r.data;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from('negocios').update(cambios).eq('id', ctx.negocio.id).select('id');
  if (error || !data?.length) volver('error', 'No se pudo guardar la configuración.');
  volver('ok', 'Configuración guardada.');
}
