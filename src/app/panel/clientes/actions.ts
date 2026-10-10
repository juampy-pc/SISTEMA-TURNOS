'use server';

import { z } from 'zod';
import { puede } from '@/lib/dominio/permisos';
import { normalizarTelefono } from '@/lib/dominio/telefono';
import { crearVolver, leerUuid, type Volver } from '@/lib/panel/acciones';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';

function volverAFicha(id: string | null): Volver {
  return crearVolver(id ? `/panel/clientes/${id}` : '/panel/clientes');
}

async function exigirClientes(volver: Volver) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_clientes')) volver('error', 'No tenés permiso para hacer esto.');
  return ctx;
}

export async function guardarCliente(formData: FormData) {
  const crudo = formData.get('clienteId');
  const volver: Volver = volverAFicha(typeof crudo === 'string' ? crudo : null);
  const ctx = await exigirClientes(volver);
  const id = leerUuid(crudo, () => volver('error', 'Solicitud inválida.'));
  const r = z
    .object({
      nombre: z.string().trim().min(2, 'El nombre es muy corto.').max(80, 'El nombre es muy largo.'),
      notas: z.string().max(1000, 'Las notas son muy largas (máximo 1000).'),
    })
    .safeParse({ nombre: formData.get('nombre'), notas: formData.get('notas') ?? '' });
  if (!r.success) volver('error', r.error.issues[0].message);

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('clientes')
    .update(r.data)
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudo guardar.');
  volver('ok', 'Cliente actualizado.');
}

export async function unirClientes(formData: FormData) {
  const destinoCrudo = formData.get('destinoId');
  const volver: Volver = volverAFicha(typeof destinoCrudo === 'string' ? destinoCrudo : null);
  await exigirClientes(volver);
  const destino = leerUuid(destinoCrudo, () => volver('error', 'Solicitud inválida.'));
  const origen = leerUuid(formData.get('origenId'), () => volver('error', 'Solicitud inválida.'));
  if (origen === destino) volver('error', 'Solicitud inválida.');
  // El aislamiento entre negocios lo exige la función en la base (security definer + mi_negocio_id).
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('unir_clientes', { p_origen: origen, p_destino: destino });
  if (error) volver('error', 'No se pudieron unir los clientes.');
  volver('ok', 'Clientes unidos: los turnos y las notas quedaron en esta ficha.');
}

export async function crearCliente(formData: FormData) {
  const conservar: Record<string, string> = {
    nombre: typeof formData.get('nombre') === 'string' ? String(formData.get('nombre')).slice(0, 80) : '',
    telefono: typeof formData.get('telefono') === 'string' ? String(formData.get('telefono')).slice(0, 30) : '',
  };
  const base = crearVolver('/panel/clientes');
  const volver: Volver = (tipo, mensaje, extra) => base(tipo, mensaje, tipo === 'error' ? { ...conservar, ...extra } : extra);
  const ctx = await exigirClientes(volver);
  const r = z
    .object({
      nombre: z.string().trim().min(2, 'El nombre es muy corto.').max(80, 'El nombre es muy largo.'),
      notas: z.string().max(1000, 'Las notas son muy largas (máximo 1000).'),
    })
    .safeParse({ nombre: formData.get('nombre'), notas: formData.get('notas') ?? '' });
  if (!r.success) volver('error', r.error.issues[0].message);
  const tel = normalizarTelefono(conservar.telefono);
  if (!tel.ok) volver('error', tel.error);

  const supabase = await crearClienteServidor();
  const { data: existente } = await supabase
    .from('clientes')
    .select('id')
    .eq('negocio_id', ctx.negocio.id)
    .eq('telefono', tel.e164)
    .maybeSingle();
  if (existente) volverAFicha(existente.id)('error', 'Ya tenías un cliente con ese teléfono: esta es su ficha.');

  const { data: nuevo, error } = await supabase
    .from('clientes')
    .insert({ negocio_id: ctx.negocio.id, nombre: r.data.nombre, telefono: tel.e164, notas: r.data.notas })
    .select('id')
    .single();
  if (error?.code === '23505') volver('error', 'Ya existe un cliente con ese teléfono.');
  if (error || !nuevo) volver('error', 'No se pudo guardar al cliente.');
  volverAFicha(nuevo.id)('ok', 'Cliente agregado.');
}

export async function guardarDetalleTurno(formData: FormData) {
  const crudo = formData.get('clienteId');
  const volver: Volver = volverAFicha(typeof crudo === 'string' ? crudo : null);
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_turnos')) volver('error', 'No tenés permiso para hacer esto.');
  leerUuid(crudo, () => volver('error', 'Solicitud inválida.'));
  const id = leerUuid(formData.get('turnoId'), () => volver('error', 'Solicitud inválida.'));
  const notas = z.string().max(500, 'El detalle es muy largo (máximo 500).').safeParse(formData.get('notas') ?? '');
  if (!notas.success) volver('error', notas.error.issues[0].message);

  // RLS limita la edición a las agendas que el usuario puede ver.
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('turnos')
    .update({ notas: notas.data })
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudo guardar el detalle.');
  volver('ok', 'Detalle del turno guardado.');
}

export async function revocarDispositivo(formData: FormData) {
  const crudo = formData.get('clienteId');
  const volver: Volver = volverAFicha(typeof crudo === 'string' ? crudo : null);
  const ctx = await exigirClientes(volver);
  const clienteId = leerUuid(crudo, () => volver('error', 'Solicitud inválida.'));
  const id = leerUuid(formData.get('dispositivoId'), () => volver('error', 'Solicitud inválida.'));
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('dispositivos_confiables')
    .delete()
    .eq('id', id)
    .eq('cliente_id', clienteId)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudo quitar el dispositivo.');
  volver('ok', 'Dispositivo quitado: sus próximos pedidos van a quedar pendientes.');
}
