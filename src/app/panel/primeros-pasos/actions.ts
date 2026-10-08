'use server';

import { z } from 'zod';
import { franjaSchema, servicioSchema } from '@/lib/dominio/esquemas-turnos';
import { crearVolver, exigirGestionServicios, type Volver } from '@/lib/panel/acciones';
import { crearClienteServidor } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

const volver: Volver = crearVolver('/panel/primeros-pasos');

export async function cargarPlantilla(formData: FormData) {
  await exigirGestionServicios(volver);

  const recursos = formData
    .getAll('recurso')
    .map((r) => String(r).trim())
    .filter(Boolean);
  if (recursos.length === 0) volver('error', 'Cargá al menos uno.');
  const nombresRecursos = z.array(z.string().min(2, 'El nombre es muy corto.').max(60, 'El nombre es muy largo.')).safeParse(recursos);
  if (!nombresRecursos.success) volver('error', nombresRecursos.error.issues[0].message);
  if (new Set(recursos.map((r) => r.toLowerCase())).size !== recursos.length) volver('error', 'Hay nombres repetidos.');

  const nombres = formData.getAll('servicio_nombre');
  const duraciones = formData.getAll('servicio_duracion');
  const precios = formData.getAll('servicio_precio');
  const servicios = [];
  for (let i = 0; i < nombres.length; i++) {
    if (!String(nombres[i]).trim()) continue; // fila vacía = no se carga
    const r = servicioSchema.safeParse({
      nombre: nombres[i],
      duracion_min: duraciones[i],
      precio: precios[i] || '0',
    });
    if (!r.success) volver('error', r.error.issues[0].message);
    servicios.push(r.data);
  }
  if (servicios.length === 0) volver('error', 'Cargá al menos un servicio.');
  if (new Set(servicios.map((s) => s.nombre.toLowerCase())).size !== servicios.length) volver('error', 'Hay servicios repetidos.');

  const dias = formData.getAll('dias').map(String);
  if (dias.length === 0) volver('error', 'Elegí al menos un día.');
  const franjas = dias.map((d) =>
    franjaSchema.safeParse({ dia_semana: d, desde: formData.get('desde'), hasta: formData.get('hasta') }),
  );
  const mala = franjas.find((f) => !f.success);
  if (mala && !mala.success) volver('error', mala.error.issues[0].message);
  const primera = franjas[0].success ? franjas[0].data : null;
  if (!primera) volver('error', 'Horario inválido.');

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('sembrar_plantilla', {
    p_recursos: recursos,
    p_servicios: servicios,
    p_dias: franjas.map((f) => (f.success ? f.data.dia_semana : 0)),
    p_desde_min: primera.desde_min,
    p_hasta_min: primera.hasta_min,
  });
  if (error) {
    volver('error', error.message.includes('ya_configurado') ? 'Ya cargaste tus datos.' : 'No se pudo guardar. Probá de nuevo.');
  }
  redirect('/panel');
}
