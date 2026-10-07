import { z } from 'zod';
import { normalizarUsuario, USUARIO_REGEX } from './empleados';
import { TIPOS_NEGOCIO } from './plantillas';
import { esSlugValido, SLUGS_RESERVADOS } from './slug';

const texto = (etiqueta: string, min: number, max: number, vacio: string) =>
  z
    .string()
    .trim()
    .min(1, { error: vacio, abort: true })
    .min(min, `El ${etiqueta} debe tener entre ${min} y ${max} caracteres.`)
    .max(max, `El ${etiqueta} debe tener entre ${min} y ${max} caracteres.`);

export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.');

export const registroSchema = z.object({
  email: z.email('Ingresá un email válido.').max(254),
  password: passwordSchema,
  nombreDueno: texto('nombre', 2, 80, 'Ingresá tu nombre.'),
  nombreNegocio: texto('nombre del negocio', 2, 80, 'Ingresá el nombre del negocio.'),
  slug: z.string().superRefine((slug, ctx) => {
    if ((SLUGS_RESERVADOS as readonly string[]).includes(slug)) {
      ctx.addIssue({ code: 'custom', message: 'Ese link está reservado, elegí otro.' });
    } else if (!esSlugValido(slug)) {
      ctx.addIssue({ code: 'custom', message: 'El link solo admite minúsculas, números y guiones (3 a 40 caracteres).' });
    }
  }),
  tipo: z.enum(TIPOS_NEGOCIO, { error: 'Elegí un tipo de negocio.' }),
  vendeProductos: z.boolean({ error: 'Indicá si vendés productos.' }),
  modoTurnos: z.enum(['fijo', 'editable'], { error: 'Elegí cómo son tus turnos.' }),
});

export const empleadoSchema = z.object({
  nombre: texto('nombre', 2, 80, 'Ingresá el nombre.'),
  usuario: z
    .string()
    .transform(normalizarUsuario)
    .refine((u) => USUARIO_REGEX.test(u), 'El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.'),
  password: passwordSchema,
  rolId: z.uuid('Elegí un rol.'),
});

const passwordLogin = z.string().min(1).max(200);

export const loginDuenoSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  password: passwordLogin,
});

export const loginEmpleadoSchema = z.object({
  usuario: z
    .string()
    .transform(normalizarUsuario)
    .refine((u) => USUARIO_REGEX.test(u)),
  codigo: z
    .string()
    .trim()
    .toLowerCase()
    .refine((s) => esSlugValido(s)),
  password: passwordLogin,
});
