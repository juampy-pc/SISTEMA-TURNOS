import 'server-only';
import { randomUUID } from 'node:crypto';
import { validarImagen } from '@/lib/dominio/esquemas-negocio';
import { crearClienteAdmin } from '@/lib/supabase/admin';

const BUCKET = 'imagenes';

export type ResultadoImagen = { ok: true; url: string } | { ok: false; error: string };

/**
 * Sube una imagen a la carpeta del negocio y devuelve su URL pública. La sube el servidor con
 * service_role: quien llama tiene que haber verificado antes el permiso del usuario.
 */
export async function subirImagen(archivo: FormDataEntryValue | null, negocioId: string, prefijo: string): Promise<ResultadoImagen> {
  if (!(archivo instanceof File)) return { ok: false, error: 'Elegí una imagen.' };
  const v = validarImagen(archivo.type, archivo.size);
  if (!v.ok) return v;
  const ruta = `${negocioId}/${prefijo}-${randomUUID()}.${v.ext}`;
  const storage = crearClienteAdmin().storage.from(BUCKET);
  const { error } = await storage.upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (error) return { ok: false, error: 'No se pudo subir la imagen.' };
  return { ok: true, url: storage.getPublicUrl(ruta).data.publicUrl };
}

/** Borra una imagen anterior del negocio (si es nuestra). Si falla, queda huérfana: no es grave. */
export async function borrarImagen(url: string, negocioId: string): Promise<void> {
  const marca = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marca);
  if (i < 0) return;
  const ruta = url.slice(i + marca.length);
  if (!ruta.startsWith(`${negocioId}/`)) return;
  await crearClienteAdmin().storage.from(BUCKET).remove([ruta]);
}
