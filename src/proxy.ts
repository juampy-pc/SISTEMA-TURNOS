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
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith('/panel')) return redirigir(request, '/login', respuesta);
  if (user && (pathname === '/login' || pathname === '/registro')) return redirigir(request, '/panel', respuesta);
  return respuesta;
}

export const config = { matcher: ['/panel/:path*', '/login', '/registro'] };
