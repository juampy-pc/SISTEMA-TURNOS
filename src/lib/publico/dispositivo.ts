import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';

// Token del dispositivo del cliente: la cookie guarda el token y la base solo su hash.
const COOKIE = 'turnos_dispositivo';
const UN_ANIO = 60 * 60 * 24 * 365;

function hashDe(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Hash del token del dispositivo, si ya tiene uno (para precargar datos). */
export async function hashDispositivoActual(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? hashDe(token) : null;
}

/** Hash del token del dispositivo; si no tiene, crea uno. Solo desde una Server Action. */
export async function hashDispositivoOCrear(): Promise<string> {
  const actual = await hashDispositivoActual();
  if (actual) return actual;
  const token = randomBytes(32).toString('base64url');
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/b',
    maxAge: UN_ANIO,
  });
  return hashDe(token);
}
