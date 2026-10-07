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
}

export async function verificarSlug(slug: string): Promise<boolean> {
  const normal = slug.trim().toLowerCase();
  if (!esSlugValido(normal)) return false;
  const supabase = await crearClienteServidor();
  const { data } = await supabase.rpc('slug_disponible', { p_slug: normal });
  return data === true;
}

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
    return { error: z.prettifyError(parsed.error) };
  }
  const d = parsed.data;

  const admin = crearClienteAdmin();
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
    };
  }
  const userId = creado.user.id;

  const supabase = await crearClienteServidor();
  const { error: errLogin } = await supabase.auth.signInWithPassword({ email: d.email, password: d.password });
  if (errLogin) {
    await admin.auth.admin.deleteUser(userId);
    return { error: 'No pudimos iniciar tu sesión. Probá de nuevo.' };
  }

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
    await supabase.auth.signOut();
    await admin.auth.admin.deleteUser(userId);
    const enUso = errNegocio.code === '23505' || errNegocio.message.includes('slug_reservado');
    return {
      error: enUso
        ? 'Ese link ya está en uso. Elegí otro.'
        : 'No pudimos crear tu negocio. Probá de nuevo.',
    };
  }

  redirect('/panel');
}
