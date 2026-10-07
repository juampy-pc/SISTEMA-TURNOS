'use server';

import { redirect } from 'next/navigation';
import { emailInterno } from '@/lib/dominio/empleados';
import { loginDuenoSchema, loginEmpleadoSchema } from '@/lib/dominio/esquemas';
import { crearClienteServidor } from '@/lib/supabase/server';

export interface EstadoLogin {
  error?: string;
}

// Mensaje único: no revela si el email/usuario/negocio existe.
const ERROR = 'Los datos no son correctos.';

export async function iniciarSesion(_: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  let email: string;
  let password: string;

  if (formData.get('modo') === 'empleado') {
    const r = loginEmpleadoSchema.safeParse({
      usuario: String(formData.get('usuario') ?? ''),
      codigo: String(formData.get('codigo') ?? ''),
      password: String(formData.get('password') ?? ''),
    });
    if (!r.success) return { error: ERROR };
    email = emailInterno(r.data.usuario, r.data.codigo);
    password = r.data.password;
  } else {
    const r = loginDuenoSchema.safeParse({
      email: String(formData.get('email') ?? ''),
      password: String(formData.get('password') ?? ''),
    });
    if (!r.success) return { error: ERROR };
    email = r.data.email;
    password = r.data.password;
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: ERROR };
  redirect('/panel');
}
