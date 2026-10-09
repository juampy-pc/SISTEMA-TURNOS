import { NextResponse, type NextRequest } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/server';

// Se usa cuando hay sesión pero ya no hay acceso (miembro desactivado). Un Route Handler
// sí puede borrar las cookies; hacerlo desde un Server Component no.
export async function GET(request: NextRequest) {
  const respuesta = NextResponse.redirect(new URL('/login?aviso=sin-acceso', request.url));
  try {
    const supabase = await crearClienteServidor();
    // scope local: borra la sesión de este navegador sin depender de la red.
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.error('Falló el cierre de sesión, se borran las cookies a mano', e);
  }
  // Red de seguridad: si signOut no llegó a limpiar, se vencen las cookies de Supabase.
  for (const { name } of request.cookies.getAll()) {
    if (name.startsWith('sb-')) respuesta.cookies.set(name, '', { maxAge: 0, path: '/' });
  }
  return respuesta;
}
