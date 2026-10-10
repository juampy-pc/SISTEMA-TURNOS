'use server';

import { z } from 'zod';
import { puede } from '@/lib/dominio/permisos';
import { crearVolver, type Volver } from '@/lib/panel/acciones';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteServidor } from '@/lib/supabase/server';

const volver: Volver = crearVolver('/panel/stock');

const fila = z.object({
  stock: z.coerce.number().int().min(0).max(1000000),
  precio: z.coerce.number().min(0).max(99999999),
});

/** Guarda en bloque el stock y el precio de los productos que cambiaron. */
export async function guardarStock(formData: FormData) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'editar_catalogo')) volver('error', 'No tenés permiso para hacer esto.');

  const ids = formData.getAll('id').filter((v): v is string => typeof v === 'string' && z.uuid().safeParse(v).success);
  const cambios: { id: string; stock: number; precio: number }[] = [];
  for (const id of ids.slice(0, 500)) {
    const r = fila.safeParse({ stock: formData.get(`stock_${id}`), precio: formData.get(`precio_${id}`) });
    if (!r.success) volver('error', 'Revisá los valores: el stock tiene que ser un entero y el precio no puede ser negativo.');
    const antes = { stock: Number(formData.get(`stock_antes_${id}`)), precio: Number(formData.get(`precio_antes_${id}`)) };
    if (r.data.stock !== antes.stock || r.data.precio !== antes.precio) cambios.push({ id, ...r.data });
  }
  if (cambios.length === 0) volver('ok', 'No había cambios.');

  const supabase = await crearClienteServidor();
  const resultados = await Promise.all(
    cambios.map((c) =>
      supabase.from('productos').update({ stock: c.stock, precio: c.precio }).eq('id', c.id).eq('negocio_id', ctx.negocio.id).select('id'),
    ),
  );
  const fallidos = resultados.filter((r) => r.error || !r.data?.length).length;
  if (fallidos > 0) volver('error', `No se pudieron guardar ${fallidos} de ${cambios.length} productos.`);
  volver('ok', cambios.length === 1 ? 'Se actualizó 1 producto.' : `Se actualizaron ${cambios.length} productos.`);
}
