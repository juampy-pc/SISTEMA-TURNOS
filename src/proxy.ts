import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function redirigir(request: NextRequest, destino: string, desde: NextResponse) {
  const respuesta = NextResponse.redirect(new URL(destino, request.url));
  desde.cookies.getAll().forEach((c) => respuesta.cookies.set(c));
  return respuesta;
}

export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Usuario baneado (empleado desactivado): getUser falla y la cookie sigue ahí. /salir la borra y
  // muestra el aviso; /salir no pasa por este proxy, así que no hay bucle de redirecciones.
  if (!user && error?.code === 'user_banned' && pathname.startsWith('/panel')) {
    return redirigir(request, '/salir', respuesta);
  }
  if (!user && pathname.startsWith('/panel')) return redirigir(request, '/login', respuesta);
  if (user && (pathname === '/login' || pathname === '/registro')) return redirigir(request, '/panel', respuesta);
  return respuesta;
}

export const config = { matcher: ['/panel/:path*', '/login', '/registro'] };
