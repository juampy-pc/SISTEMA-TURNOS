import 'server-only';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { puede } from '@/lib/dominio/permisos';
import { obtenerContexto } from '@/lib/panel/contexto';

// Helpers compartidos por las Server Actions del panel.
// Nota: redirect() lanza una excepción; nunca llamar a volver() dentro de un try/catch.
// El tipo explícito es necesario para que TypeScript estreche tras llamar a volver().
export type Volver = (tipo: 'ok' | 'error', mensaje: string, extra?: Record<string, string>) => never;

export function crearVolver(ruta: string): Volver {
  return function volver(tipo, mensaje, extra = {}) {
    revalidatePath(ruta);
    const qs = new URLSearchParams({ [tipo]: mensaje, ...extra });
    redirect(`${ruta}?${qs.toString()}`);
  };
}

export function leerUuid(valor: FormDataEntryValue | null, falla: () => never): string {
  const r = z.uuid().safeParse(valor);
  if (!r.success) falla();
  return r.data;
}

export async function exigirGestionServicios(volver: Volver) {
  const ctx = await obtenerContexto();
  if (!puede(ctx.rol, 'gestionar_servicios')) volver('error', 'No tenés permiso para hacer esto.');
  return ctx;
}
