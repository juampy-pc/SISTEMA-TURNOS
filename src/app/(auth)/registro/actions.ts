'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ROLES_POR_DEFECTO } from '@/lib/dominio/permisos';
import { registroSchema } from '@/lib/dominio/esquemas';
import { esSlugValido } from '@/lib/dominio/slug';
import type { Json } from '@/lib/supabase/database.types';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { crearClienteServidor } from '@/lib/supabase/server';

export interface EstadoRegistro {
  error?: string;
  /** Paso del formulario donde está el problema. */
  paso?: 1 | 2 | 3;
}

export async function verificarSlug(slug: string): Promise<boolean> {
  const normal = slug.trim().toLowerCase();
  if (!esSlugValido(normal)) return false;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('slug_disponible', { p_slug: normal });
  return data === true;
}

const PASO_POR_CAMPO: Record<string, 1 | 2 | 3> = {
  nombreDueno: 1,
  email: 1,
  password: 1,
  nombreNegocio: 2,
  slug: 2,
  tipo: 2,
  vendeProductos: 3,
  modoTurnos: 3,
};

export async function registrar(_: EstadoRegistro, formData: FormData): Promise<EstadoRegistro> {
  const parsed = registroSchema.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: formData.get('password'),
    nombreDueno: formData.get('nombreDueno'),
    nombreNegocio: formData.get('nombreNegocio'),
    slug: String(formData.get('slug') ?? '').trim().toLowerCase(),
    tipo: formData.get('tipo'),
    vendeProductos: formData.get('vendeProductos') === 'si',
    modoTurnos: formData.get('modoTurnos'),
  });
  if (!parsed.success) {
    const campo = String(parsed.error.issues[0]?.path[0] ?? '');
    return { error: z.prettifyError(parsed.error), paso: PASO_POR_CAMPO[campo] ?? 3 };
  }
  const d = parsed.data;

  const admin = crearClienteAdmin();
  let userId: string | null = null;
  let supabase: Awaited<ReturnType<typeof crearClienteServidor>> | null = null;
  try {
    const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
    });
    if (errCrear || !creado.user) {
      return {
        error:
          errCrear?.code === 'email_exists'
            ? 'Ya existe una cuenta con ese email.'
            : 'No pudimos crear tu cuenta. Probá de nuevo.',
        paso: errCrear?.code === 'email_exists' ? 1 : 3,
      };
    }
    userId = creado.user.id;

    supabase = await crearClienteServidor();
    const { error: errLogin } = await supabase.auth.signInWithPassword({ email: d.email, password: d.password });
    if (errLogin) throw errLogin;

    const { error: errNegocio } = await supabase.rpc('crear_negocio', {
      p_nombre: d.nombreNegocio,
      p_slug: d.slug,
      p_tipo: d.tipo,
      p_vende_productos: d.vendeProductos,
      p_modo_turnos: d.modoTurnos,
      p_nombre_dueno: d.nombreDueno,
      p_roles: ROLES_POR_DEFECTO as unknown as Json,
    });
    if (errNegocio) {
      await limpiar(admin, supabase, userId);
      userId = null;
      const enUso = errNegocio.code === '23505' || errNegocio.message.includes('slug_reservado');
      return enUso
        ? { error: 'Ese link ya está en uso. Elegí otro.', paso: 2 }
        : { error: 'No pudimos crear tu negocio. Probá de nuevo.', paso: 3 };
    }
    userId = null; // éxito: el usuario queda
  } catch {
    if (userId) await limpiar(admin, supabase, userId);
    return { error: 'No pudimos crear tu cuenta. Probá de nuevo.', paso: 3 };
  }

  redirect('/panel');
}

// Nunca deja un usuario de Auth huérfano: cada paso se intenta aunque el anterior falle.
async function limpiar(
  admin: ReturnType<typeof crearClienteAdmin>,
  supabase: Awaited<ReturnType<typeof crearClienteServidor>> | null,
  userId: string,
) {
  try {
    await supabase?.auth.signOut();
  } catch {}
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {}
}
