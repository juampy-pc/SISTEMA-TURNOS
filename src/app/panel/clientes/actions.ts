'use server';

import { z } from 'zod';
import { puede } from '@/lib/dominio/permisos';
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
