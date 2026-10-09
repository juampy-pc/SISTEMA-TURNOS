'use server';

import { z } from 'zod';
import { esFechaISO } from '@/lib/dominio/fechas';
import { puede } from '@/lib/dominio/permisos';
import { normalizarTelefono } from '@/lib/dominio/telefono';
import { esEstadoTurno, transicionesDe } from '@/lib/dominio/turnos';
import { crearVolver, leerUuid, type Volver } from '@/lib/panel/acciones';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';

const base: Volver = crearVolver('/panel/turnos');

function texto(valor: FormDataEntryValue | null, max: number): string {
  return typeof valor === 'string' ? valor.slice(0, max) : '';
}

export async function crearTurno(formData: FormData) {
  const fechaCruda = texto(formData.get('fecha'), 10);
  const conservar: Record<string, string> = {
    fecha: fechaCruda,
    servicio: texto(formData.get('servicioId'), 36),
    recurso: texto(formData.get('recursoSel'), 36),
    nombre: texto(formData.get('nombre'), 80),
    telefono: texto(formData.get('telefono'), 30),
    nota: texto(formData.get('nota'), 500),
  };
  const volver: Volver = (tipo, mensaje, extra) =>
    base(tipo, mensaje, tipo === 'error' ? { ...conservar, ...extra } : { fecha: fechaCruda, ...extra });

  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_turnos')) volver('error', 'No tenés permiso para hacer esto.');
  if (!esFechaISO(fechaCruda)) volver('error', 'Fecha inválida.');
  const servicioId = leerUuid(formData.get('servicioId'), () => volver('error', 'Elegí un servicio.'));

  const nombre = z.string().trim().min(2, 'Escribí el nombre del cliente.').max(80).safeParse(formData.get('nombre'));
  if (!nombre.success) volver('error', nombre.error.issues[0].message);
  const tel = normalizarTelefono(texto(formData.get('telefono'), 30));
  if (!tel.ok) volver('error', tel.error);

  const [recursoId, inicio] = texto(formData.get('slot'), 120).split('|');
  if (!recursoId || !inicio) volver('error', 'Elegí un horario.');
  leerUuid(recursoId, () => volver('error', 'Elegí un horario.'));

  const supabase = await crearClienteServidor();
  const { data: huecos } = await supabase.rpc('huecos_disponibles', {
    p_recurso: recursoId,
    p_servicio: servicioId,
    p_fecha: fechaCruda,
  });
  const hueco = (huecos ?? []).find((h) => new Date(h.inicio).getTime() === new Date(inicio).getTime());
  if (!hueco) volver('error', 'Ese horario se acaba de ocupar. Elegí otro.');

  // Busca el cliente por teléfono normalizado; si no existe, lo crea.
  let { data: cliente } = await supabase
    .from('clientes')
    .select('id')
    .eq('negocio_id', ctx.negocio.id)
    .eq('telefono', tel.e164)
    .maybeSingle();
  if (!cliente) {
    const { data: nuevo, error } = await supabase
      .from('clientes')
      .insert({ negocio_id: ctx.negocio.id, nombre: nombre.data, telefono: tel.e164 })
      .select('id')
      .single();
    if (error || !nuevo) volver('error', 'No se pudo guardar al cliente.');
    cliente = nuevo;
  }

  const { error } = await supabase.from('turnos').insert({
    negocio_id: ctx.negocio.id,
    recurso_id: recursoId,
    servicio_id: servicioId,
    cliente_id: cliente.id,
    inicio: hueco.inicio,
    fin: hueco.fin,
    estado: 'confirmado',
    notas: texto(formData.get('nota'), 500),
  });
  if (error) {
    volver(
      'error',
      error.code === '23P01'
        ? 'Ese horario se acaba de ocupar. Elegí otro.'
        : error.code === '42501'
          ? 'No tenés permiso sobre esa agenda.'
          : 'No se pudo crear el turno.',
    );
  }
  volver('ok', 'Turno creado.');
}

export async function cambiarEstado(formData: FormData) {
  const fecha = texto(formData.get('fecha'), 10);
  const volver: Volver = (tipo, mensaje, extra) => base(tipo, mensaje, { fecha, ...extra });
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_turnos')) volver('error', 'No tenés permiso para hacer esto.');
  const id = leerUuid(formData.get('turnoId'), () => volver('error', 'Solicitud inválida.'));
  const nuevo = formData.get('estado');
  if (!esEstadoTurno(nuevo)) volver('error', 'Estado inválido.');

  const supabase = await crearClienteServidor();
  const { data: turno } = await supabase
    .from('turnos')
    .select('estado, servicio:servicios(precio)')
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .maybeSingle();
  if (!turno || !esEstadoTurno(turno.estado)) volver('error', 'Turno no encontrado.');
  if (!transicionesDe(turno.estado).includes(nuevo)) volver('error', 'Ese cambio no está permitido.');

  const cambios: { estado: string; monto_cobrado?: number } = { estado: nuevo };
  if (nuevo === 'completado') {
    const precio = (turno.servicio as unknown as { precio: number } | null)?.precio ?? 0;
    const crudo = formData.get('monto');
    const monto = typeof crudo === 'string' && crudo.trim() !== '' ? Number(crudo) : Number(precio);
    if (!Number.isFinite(monto) || monto < 0) volver('error', 'Monto inválido.');
    cambios.monto_cobrado = monto;
  }
  const { data, error } = await supabase
    .from('turnos')
    .update(cambios)
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudo actualizar el turno.');
  volver('ok', 'Turno actualizado.');
}
