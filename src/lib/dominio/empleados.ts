export const USUARIO_REGEX = /^[a-z0-9._-]{3,30}$/;

export function normalizarUsuario(valor: string): string {
  return valor.trim().toLowerCase();
}

// Los empleados no tienen email real: Supabase Auth necesita uno, así que se
// deriva del usuario y del slug del negocio. El dominio .invalid nunca resuelve.
export function emailInterno(usuario: string, slug: string): string {
  return `${usuario}@${slug}.staff.sistema-turnos.invalid`;
}
