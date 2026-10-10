'use server';

import { productoSchema, ventaSchema } from '@/lib/dominio/esquemas-negocio';
import { puede, type ClavePermiso } from '@/lib/dominio/permisos';
import { normalizarTelefono } from '@/lib/dominio/telefono';
import { crearVolver, leerUuid, type Volver } from '@/lib/panel/acciones';
import { obtenerContexto } from '@/lib/panel/contexto';
import { borrarImagen, subirImagen } from '@/lib/panel/imagenes';
import { crearClienteServidor } from '@/lib/supabase/server';

const lista: Volver = crearVolver('/panel/productos');

function texto(valor: FormDataEntryValue | null, max: number): string {
  return typeof valor === 'string' ? valor.slice(0, max) : '';
}

async function exigir(permiso: ClavePermiso, volver: Volver) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, permiso)) volver('error', 'No tenés permiso para hacer esto.');
  return ctx;
}

function leerProducto(formData: FormData) {
  return productoSchema.safeParse({
    nombre: texto(formData.get('nombre'), 100),
    descripcion: texto(formData.get('descripcion'), 600),
    precio: texto(formData.get('precio'), 20),
    costo: texto(formData.get('costo'), 20),
    stock: texto(formData.get('stock'), 10),
  });
}

export async function crearProducto(formData: FormData) {
  const ctx = await exigir('editar_catalogo', lista);
  const r = leerProducto(formData);
  if (!r.success) lista('error', r.error.issues[0].message);
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from('productos').insert({ negocio_id: ctx.negocio.id, ...r.data });
  if (error) lista('error', error.code === '23505' ? 'Ya tenés un producto con ese nombre.' : 'No se pudo crear el producto.');
  lista('ok', 'Producto creado.');
}

export async function guardarProducto(formData: FormData) {
  const id = leerUuid(formData.get('productoId'), () => lista('error', 'Solicitud inválida.'));
  const volver: Volver = crearVolver(`/panel/productos/${id}`);
  const ctx = await exigir('editar_catalogo', volver);
  const r = leerProducto(formData);
  if (!r.success) volver('error', r.error.issues[0].message);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('productos')
    .update({ ...r.data, activo: formData.get('activo') === 'on' })
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', error?.code === '23505' ? 'Ya tenés un producto con ese nombre.' : 'No se pudo guardar.');
  volver('ok', 'Producto guardado.');
}

export async function subirFotoProducto(formData: FormData) {
  const id = leerUuid(formData.get('productoId'), () => lista('error', 'Solicitud inválida.'));
  const volver: Volver = crearVolver(`/panel/productos/${id}`);
  const ctx = await exigir('editar_catalogo', volver);
  const supabase = await crearClienteServidor();
  const { data: anterior } = await supabase.from('productos').select('foto_url').eq('id', id).maybeSingle();
  if (!anterior) volver('error', 'Producto no encontrado.');
  const subida = await subirImagen(formData.get('foto'), ctx.negocio.id, 'producto');
  if (!subida.ok) volver('error', subida.error);
  const { data, error } = await supabase
    .from('productos')
    .update({ foto_url: subida.url })
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) {
    await borrarImagen(subida.url, ctx.negocio.id);
    volver('error', 'No se pudo guardar la foto.');
  }
  if (anterior.foto_url) await borrarImagen(anterior.foto_url, ctx.negocio.id);
  volver('ok', 'Foto actualizada.');
}

export async function quitarFotoProducto(formData: FormData) {
  const id = leerUuid(formData.get('productoId'), () => lista('error', 'Solicitud inválida.'));
  const volver: Volver = crearVolver(`/panel/productos/${id}`);
  const ctx = await exigir('editar_catalogo', volver);
  const supabase = await crearClienteServidor();
  const { data: anterior } = await supabase.from('productos').select('foto_url').eq('id', id).maybeSingle();
  const { data, error } = await supabase
    .from('productos')
    .update({ foto_url: '' })
    .eq('id', id)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudo quitar la foto.');
  if (anterior?.foto_url) await borrarImagen(anterior.foto_url, ctx.negocio.id);
  volver('ok', 'Foto quitada.');
}

export async function venderProducto(formData: FormData) {
  const productoId = leerUuid(formData.get('productoId'), () => lista('error', 'Solicitud inválida.'));
  const conservar = {
    cantidad: texto(formData.get('cantidad'), 6) || '1',
    monto: texto(formData.get('monto'), 20),
    telefono: texto(formData.get('telefono'), 30),
  };
  const volver: Volver = (tipo, mensaje, extra) =>
    lista(tipo, mensaje, tipo === 'error' ? { vender: productoId, ...conservar, ...extra } : extra);
  const ctx = await exigir('registrar_ventas', volver);
  const r = ventaSchema.safeParse({ cantidad: conservar.cantidad, monto: conservar.monto });
  if (!r.success) volver('error', r.error.issues[0].message);

  const supabase = await crearClienteServidor();
  let clienteId: string | null = null;
  if (conservar.telefono.trim()) {
    const tel = normalizarTelefono(conservar.telefono);
    if (!tel.ok) volver('error', tel.error);
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('negocio_id', ctx.negocio.id)
      .eq('telefono', tel.e164)
      .maybeSingle();
    if (!cliente) volver('error', 'No encontramos un cliente con ese teléfono. Dejalo vacío o cargalo en Clientes.');
    clienteId = cliente.id;
  }

  const { data: stock, error } = await supabase.rpc('registrar_venta', {
    p_producto: productoId,
    p_cantidad: r.data.cantidad,
    // null = precio × cantidad; los tipos generados no reflejan los null.
    p_monto: r.data.monto as number,
    p_cliente: clienteId as string,
    p_forzar: formData.get('forzar') === '1',
  });
  if (error) {
    if (error.message.includes('stock_insuficiente')) volver('error', 'No hay stock suficiente.', { confirmar: '1' });
    volver('error', 'No se pudo registrar la venta.');
  }
  volver('ok', `Venta registrada. Quedan ${stock} en stock.`);
}

export async function anularVenta(formData: FormData) {
  await exigir('registrar_ventas', lista);
  const id = leerUuid(formData.get('ventaId'), () => lista('error', 'Solicitud inválida.'));
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc('anular_venta', { p_venta: id });
  if (error) lista('error', 'No se pudo anular la venta (solo se anulan las de las últimas 24 horas).');
  lista('ok', 'Venta anulada: el stock volvió.');
}
