import { z } from 'zod';
import { normalizarUsuario, USUARIO_REGEX } from './empleados';
import { TIPOS_NEGOCIO } from './plantillas';
import { esSlugValido } from './slug';

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.');

export const registroSchema = z.object({
  email: z.email('Ingresá un email válido.').max(254),
  password: passwordSchema,
  nombreDueno: texto(2, 80),
  nombreNegocio: texto(2, 80),
  slug: z.string().refine(esSlugValido, 'El link solo admite minúsculas, números y guiones (3 a 40 caracteres).'),
  tipo: z.enum(TIPOS_NEGOCIO),
  vendeProductos: z.boolean(),
  modoTurnos: z.enum(['fijo', 'editable']),
});

export const empleadoSchema = z.object({
  nombre: texto(2, 80),
  usuario: z
    .string()
    .transform(normalizarUsuario)
    .refine((u) => USUARIO_REGEX.test(u), 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.'),
  password: passwordSchema,
  rolId: z.uuid('Elegí un rol.'),
});
