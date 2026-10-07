'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { emailInterno } from '@/lib/dominio/empleados';
import { empleadoSchema, passwordSchema } from '@/lib/dominio/esquemas';
import { normalizarPermisos, PERMISOS } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';
import { crearClienteAdmin } from '@/lib/supabase/admin';
import { crearClienteServidor } from '@/lib/supabase/server';

// Nota: redirect() lanza una excepción; nunca llamar a volver() dentro de un try/catch.
function volver(tipo: 'ok' | 'error', mensaje: string, extra: Record<string, string> = {}): never {
  revalidatePath('/panel/empleados');
  const qs = new URLSearchParams({ [tipo]: mensaje, ...extra });
  redirect(`/panel/empleados?${qs.toString()}`);
}

async function exigirDueno() {
  const ctx = await obtenerContexto();
  if (!ctx.rol.es_dueno) volver('error', 'Solo el dueño puede gestionar empleados.');
  return ctx;
}

function uuid(valor: FormDataEntryValue | null): string {
  const r = z.uuid().safeParse(valor);
  if (!r.success) volver('error', 'Solicitud inválida.');
  return r.data;
}

async function borrarUsuario(admin: ReturnType<typeof crearClienteAdmin>, userId: string) {
  try {
    await admin.auth.admin.deleteUser(userId);
  } catch {}
}

export async function crearEmpleado(formData: FormData) {
  const ctx = await exigirDueno();
  const nombreCrudo = formData.get('nombre');
  const usuarioCrudo = formData.get('usuario');
  // Se devuelven en la URL (sin la contraseña) para no perder lo tipeado si falla.
  const conservar = {
    nombre: typeof nombreCrudo === 'string' ? nombreCrudo.slice(0, 80) : '',
    usuario: typeof usuarioCrudo === 'string' ? usuarioCrudo.slice(0, 30) : '',
  };
  function fallar(m: string): never {
    return volver('error', m, conservar);
  }

  const parsed = empleadoSchema.safeParse({
    nombre: formData.get('nombre'),
    usuario: formData.get('usuario') ?? '',
    password: formData.get('password'),
    rolId: formData.get('rolId'),
  });
  if (!parsed.success) fallar(parsed.error.issues[0].message);
  const { nombre, usuario, password, rolId } = parsed.data;

  // El rol debe ser del negocio del que llama (RLS + filtro explícito) y no ser Dueño.
  const supabase = await crearClienteServidor();
  const { data: rol } = await supabase
    .from('roles')
    .select('id, es_dueno')
    .eq('id', rolId)
    .eq('negocio_id', ctx.negocio.id)
    .maybeSingle();
  if (!rol || rol.es_dueno) fallar('Rol inválido.');

  const admin = crearClienteAdmin();
  let userId: string | null = null;
  let mensajeError: string | null = null;
  try {
    const { data: creado, error } = await admin.auth.admin.createUser({
      email: emailInterno(usuario, ctx.negocio.slug),
      password,
      email_confirm: true,
    });
    if (error || !creado.user) {
      mensajeError = error?.code === 'email_exists' ? 'Ese usuario ya existe.' : 'No se pudo crear el usuario.';
    } else {
      userId = creado.user.id;
      const { error: errMiembro } = await admin.from('miembros').insert({
        negocio_id: ctx.negocio.id,
        auth_user_id: userId,
        rol_id: rolId,
        nombre,
        usuario,
      });
      if (errMiembro) {
        await borrarUsuario(admin, userId);
        userId = null;
        mensajeError = errMiembro.code === '23505' ? 'Ese usuario ya existe.' : 'No se pudo crear el empleado.';
      }
    }
  } catch {
    if (userId) await borrarUsuario(admin, userId);
    mensajeError = 'No se pudo crear el empleado.';
  }
  if (mensajeError) fallar(mensajeError);
  volver('ok', 'Empleado creado.');
}

export async function cambiarRol(formData: FormData) {
  const ctx = await exigirDueno();
  const miembroId = uuid(formData.get('miembroId'));
  const rolId = uuid(formData.get('rolId'));
  const supabase = await crearClienteServidor();
  const { data: rol } = await supabase
    .from('roles')
    .select('id, es_dueno')
    .eq('id', rolId)
    .eq('negocio_id', ctx.negocio.id)
    .maybeSingle();
  if (!rol || rol.es_dueno) volver('error', 'Rol inválido.');
  const { data, error } = await supabase
    .from('miembros')
    .update({ rol_id: rolId })
    .eq('id', miembroId)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudo cambiar el rol.');
  volver('ok', 'Rol actualizado.');
}

export async function alternarActivo(formData: FormData) {
  const ctx = await exigirDueno();
  const miembroId = uuid(formData.get('miembroId'));
  const activar = formData.get('activar') === 'si';
  // El update va por RLS: rechaza otros negocios y al miembro Dueño.
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('miembros')
    .update({ activo: activar })
    .eq('id', miembroId)
    .eq('negocio_id', ctx.negocio.id)
    .select('id, auth_user_id');
  if (error || !data?.length) volver('error', 'No se pudo actualizar al empleado.');

  // Además del bloqueo por RLS, se banea al usuario para que no pueda iniciar sesión.
  let baneoOk = true;
  try {
    const admin = crearClienteAdmin();
    const { error: errBan } = await admin.auth.admin.updateUserById(data[0].auth_user_id, {
      ban_duration: activar ? 'none' : '876000h',
    });
    baneoOk = !errBan;
  } catch {
    baneoOk = false;
  }
  if (!baneoOk && activar) {
    // No dejar "activo" a alguien que sigue baneado.
    await supabase.from('miembros').update({ activo: false }).eq('id', miembroId);
    volver('error', 'No se pudo activar al empleado. Probá de nuevo.');
  }
  if (!baneoOk) {
    volver('ok', 'Empleado desactivado. Ya no puede acceder al panel.');
  }
  volver('ok', activar ? 'Empleado activado.' : 'Empleado desactivado.');
}

export async function resetearPassword(formData: FormData) {
  const ctx = await exigirDueno();
  const miembroId = uuid(formData.get('miembroId'));
  const password = passwordSchema.safeParse(formData.get('password'));
  if (!password.success) volver('error', password.error.issues[0].message);

  const supabase = await crearClienteServidor();
  const { data: miembro } = await supabase
    .from('miembros')
    .select('auth_user_id, rol_id')
    .eq('id', miembroId)
    .eq('negocio_id', ctx.negocio.id)
    .maybeSingle();
  if (!miembro) volver('error', 'Empleado no encontrado.');
  const { data: rol } = await supabase
    .from('roles')
    .select('es_dueno')
    .eq('id', miembro.rol_id)
    .eq('negocio_id', ctx.negocio.id)
    .maybeSingle();
  if (!rol || rol.es_dueno) volver('error', 'No se puede cambiar esa contraseña desde acá.');

  let fallo = false;
  try {
    const admin = crearClienteAdmin();
    const { error } = await admin.auth.admin.updateUserById(miembro.auth_user_id, { password: password.data });
    fallo = !!error;
  } catch {
    fallo = true;
  }
  if (fallo) volver('error', 'No se pudo cambiar la contraseña.');
  volver('ok', 'Contraseña actualizada.');
}

export async function guardarPermisos(formData: FormData) {
  const ctx = await exigirDueno();
  const rolId = uuid(formData.get('rolId'));
  const permisos = normalizarPermisos(
    Object.fromEntries(PERMISOS.map((p) => [p.clave, formData.get(p.clave) === 'on'])),
  );
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from('roles')
    .update({ permisos })
    .eq('id', rolId)
    .eq('negocio_id', ctx.negocio.id)
    .select('id');
  if (error || !data?.length) volver('error', 'No se pudieron guardar los permisos.');
  volver('ok', 'Permisos guardados.');
}
