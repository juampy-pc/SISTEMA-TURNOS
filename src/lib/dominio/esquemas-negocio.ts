import { z } from 'zod';

/** Colores de marca que se ofrecen (contrastan con texto blanco). */
export const COLORES_MARCA = [
  { valor: '#1c1917', nombre: 'Negro' },
  { valor: '#1d4ed8', nombre: 'Azul' },
  { valor: '#047857', nombre: 'Verde' },
  { valor: '#b91c1c', nombre: 'Rojo' },
  { valor: '#be185d', nombre: 'Rosa' },
  { valor: '#7e22ce', nombre: 'Violeta' },
  { valor: '#c2410c', nombre: 'Naranja' },
  { valor: '#0f766e', nombre: 'Turquesa' },
] as const;

const COLORES = new Set<string>(COLORES_MARCA.map((c) => c.valor));

export const negocioSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto.').max(80, 'El nombre es muy largo.'),
  descripcion: z.string().trim().max(500, 'La descripción es muy larga (máximo 500).'),
  direccion: z.string().trim().max(120, 'La dirección es muy larga (máximo 120).'),
  // Acepta "@usuario", "usuario" o el link del perfil; guarda solo el usuario.
  instagram: z
    .string()
    .trim()
    .transform((s) => s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, ''))
    .refine((s) => s === '' || /^[A-Za-z0-9._]{1,30}$/.test(s), 'Revisá el usuario de Instagram.'),
  color: z.string().refine((c) => COLORES.has(c), 'Elegí un color de la lista.'),
  vende_productos: z.boolean(),
});

const dinero = (etiqueta: string) =>
  z.coerce
    .number({ error: `${etiqueta} inválido.` })
    .min(0, `${etiqueta}: no puede ser negativo.`)
    .max(99999999, `${etiqueta}: demasiado alto.`);

export const productoSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es muy corto.').max(80, 'El nombre es muy largo.'),
  descripcion: z.string().trim().max(500, 'La descripción es muy larga (máximo 500).'),
  precio: dinero('Precio'),
  // Vacío = sin costo cargado.
  costo: z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : Number(s)))
    .refine((n) => n === null || (Number.isFinite(n) && n >= 0 && n <= 99999999), 'Costo inválido.'),
  stock: z.coerce.number({ error: 'Stock inválido.' }).int('El stock tiene que ser un número entero.').min(0, 'El stock no puede ser negativo.').max(1000000, 'Stock demasiado alto.'),
});

export const ventaSchema = z.object({
  cantidad: z.coerce.number({ error: 'Cantidad inválida.' }).int('Cantidad inválida.').min(1, 'La cantidad mínima es 1.').max(1000, 'Cantidad demasiado alta.'),
  // Vacío = precio × cantidad.
  monto: z
    .string()
    .trim()
    .transform((s) => (s === '' ? null : Number(s)))
    .refine((n) => n === null || (Number.isFinite(n) && n >= 0 && n <= 99999999), 'Monto inválido.'),
});

export const TIPOS_IMAGEN = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
export const MAX_IMAGEN_BYTES = 2 * 1024 * 1024;

/** Valida tipo y tamaño de una imagen subida; devuelve la extensión o un error. */
export function validarImagen(tipo: string, bytes: number): { ok: true; ext: string } | { ok: false; error: string } {
  const ext = TIPOS_IMAGEN[tipo as keyof typeof TIPOS_IMAGEN];
  if (!ext) return { ok: false, error: 'La imagen tiene que ser JPG, PNG o WebP.' };
  if (bytes === 0) return { ok: false, error: 'Elegí una imagen.' };
  if (bytes > MAX_IMAGEN_BYTES) return { ok: false, error: 'La imagen pesa más de 2 MB.' };
  return { ok: true, ext };
}
