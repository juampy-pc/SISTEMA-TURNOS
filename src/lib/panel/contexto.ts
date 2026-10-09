import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { crearClienteServidor } from '@/lib/supabase/server';
import { normalizarPermisos, type Permisos } from '@/lib/dominio/permisos';
import type { ModoTurnos, TipoNegocio } from '@/lib/dominio/plantillas';

export interface Contexto {
  userId: string;
  miembro: { id: string; nombre: string; usuario: string };
  negocio: {
    id: string;
    slug: string;
    nombre: string;
    tipo: TipoNegocio;
    vende_productos: boolean;
    modo_turnos: ModoTurnos;
  };
  rol: { id: string; nombre: string; es_dueno: boolean; permisos: Permisos };
}

interface FilaContexto {
  id: string;
  nombre: string;
  usuario: string;
  activo: boolean;
  negocio: Contexto['negocio'];
  rol: { id: string; nombre: string; es_dueno: boolean; permisos: unknown };
}

export const obtenerContexto = cache(async (): Promise<Contexto> => {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS devuelve vacío si el miembro está desactivado o no existe.
  const { data, error } = await supabase
    .from('miembros')
    .select(
      'id, nombre, usuario, activo, negocio:negocios(id, slug, nombre, tipo, vende_productos, modo_turnos), rol:roles(id, nombre, es_dueno, permisos)',
    )
    .eq('auth_user_id', user.id)
    .maybeSingle();

  // Un error de la base (red, timeout) no es lo mismo que "sin acceso": no se cierra la sesión.
  if (error) throw new Error(`No se pudo cargar el contexto del panel: ${error.message}`);

  const fila = data as unknown as FilaContexto | null;
  if (!fila || !fila.activo || !fila.negocio || !fila.rol) redirect('/salir');

  return {
    userId: user.id,
    miembro: { id: fila.id, nombre: fila.nombre, usuario: fila.usuario },
    negocio: fila.negocio,
    rol: { ...fila.rol, permisos: normalizarPermisos(fila.rol.permisos) },
  };
});
