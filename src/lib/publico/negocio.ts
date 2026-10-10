import 'server-only';
import { cache } from 'react';
import type { TipoNegocio } from '@/lib/dominio/plantillas';
import { crearClienteAdmin } from '@/lib/supabase/admin';

export interface NegocioPublico {
  id: string;
  nombre: string;
  tipo: TipoNegocio;
  whatsapp: string;
  anticipacion_max_dias: number;
  descripcion: string;
  direccion: string;
  instagram: string;
  color: string;
  logo_url: string;
  productos: { id: string; nombre: string; descripcion: string; precio: number; foto_url: string; hay_stock: boolean }[];
  servicios: { id: string; nombre: string; duracion_min: number; precio: number; recursos: string[] }[];
  recursos: { id: string; nombre: string }[];
}

/** Datos públicos del negocio por slug (null si no existe). Se cachea por pedido. */
export const cargarNegocio = cache(async (slug: string): Promise<NegocioPublico | null> => {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const { data } = await crearClienteAdmin().rpc('negocio_publico', { p_slug: slug });
  return (data as NegocioPublico | null) ?? null;
});
