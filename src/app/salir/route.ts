import { NextResponse, type NextRequest } from 'next/server';
import { crearClienteServidor } from '@/lib/supabase/server';

// Se usa cuando hay sesión pero ya no hay acceso (miembro desactivado). Un Route Handler
// sí puede borrar las cookies; hacerlo desde un Server Component no.
export async function GET(request: NextRequest) {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login?aviso=sin-acceso', request.url));
}
