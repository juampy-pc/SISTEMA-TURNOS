import { z } from 'zod';
import { parseHora } from './horarios';

export const PASOS_MINUTOS = [15, 20, 30, 45, 60, 90, 120] as const;

const nombre = (max: number) =>
  z.string().trim().min(2, 'El nombre es muy corto.').max(max, `El nombre es muy largo (máximo ${max}).`);

export const servicioSchema = z.object({
  nombre: nombre(80),
  duracion_min: z.coerce
    .number({ error: 'Duración inválida.' })
    .int('Duración inválida.')
    .min(5, 'La duración mínima es de 5 minutos.')
    .max(480, 'La duración máxima es de 8 horas.'),
  precio: z.coerce
    .number({ error: 'Precio inválido.' })
    .min(0, 'El precio no puede ser negativo.')
    .max(99999999, 'Precio demasiado alto.'),
});

export const recursoSchema = z.object({ nombre: nombre(60) });

const hora = z.string().transform((s, ctx) => {
  const m = parseHora(s);
  if (m === null) ctx.addIssue({ code: 'custom', message: 'Hora inválida.' });
  return m ?? 0;
});

export const franjaSchema = z
  .object({ dia_semana: z.coerce.number().int().min(0).max(6), desde: hora, hasta: hora })
  .refine((f) => f.hasta > f.desde, {
    message: 'La hora de cierre tiene que ser posterior a la de apertura.',
  })
  .transform((f) => ({ dia_semana: f.dia_semana, desde_min: f.desde, hasta_min: f.hasta }));

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida.');

export const bloqueoSchema = z
  .object({ desde: fecha, hasta: fecha, motivo: z.string().trim().max(80).default('') })
  .refine((b) => b.hasta >= b.desde, {
    message: 'La fecha de fin no puede ser anterior a la de inicio.',
  });

export const configTurnosSchema = z.object({
  paso_minutos: z.coerce
    .number()
    .refine((n) => (PASOS_MINUTOS as readonly number[]).includes(n), 'Paso inválido.'),
  anticipacion_min_horas: z.coerce.number().int().min(0).max(168),
  anticipacion_max_dias: z.coerce.number().int().min(1).max(365),
});
