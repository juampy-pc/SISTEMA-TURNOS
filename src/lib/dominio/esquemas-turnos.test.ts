import { describe, expect, it } from 'vitest';
import { bloqueoSchema, configTurnosSchema, franjaSchema, recursoSchema, servicioSchema } from './esquemas-turnos';

describe('servicioSchema', () => {
  it('acepta un servicio válido y recorta el nombre', () => {
    const r = servicioSchema.parse({ nombre: '  Corte  ', duracion_min: '30', precio: '8000' });
    expect(r).toEqual({ nombre: 'Corte', duracion_min: 30, precio: 8000 });
  });
  it.each([
    [{ nombre: '   ', duracion_min: '30', precio: '1' }],
    [{ nombre: 'Corte', duracion_min: '0', precio: '1' }],
    [{ nombre: 'Corte', duracion_min: '-5', precio: '1' }],
    [{ nombre: 'Corte', duracion_min: '600', precio: '1' }],
    [{ nombre: 'Corte', duracion_min: '30', precio: '-1' }],
    [{ nombre: 'Corte', duracion_min: '30', precio: 'abc' }],
  ])('rechaza %j', (entrada) => {
    expect(servicioSchema.safeParse(entrada).success).toBe(false);
  });
});

describe('recursoSchema', () => {
  it('exige nombre de 2 a 60 caracteres', () => {
    expect(recursoSchema.safeParse({ nombre: 'Cancha 1' }).success).toBe(true);
    expect(recursoSchema.safeParse({ nombre: ' ' }).success).toBe(false);
  });
});

describe('franjaSchema', () => {
  it('convierte HH:MM y valida orden', () => {
    expect(franjaSchema.parse({ dia_semana: '1', desde: '09:00', hasta: '13:00' })).toEqual({
      dia_semana: 1, desde_min: 540, hasta_min: 780,
    });
    expect(franjaSchema.parse({ dia_semana: '1', desde: '16:00', hasta: '23:59' }).hasta_min).toBe(1440);
    expect(franjaSchema.safeParse({ dia_semana: '1', desde: '13:00', hasta: '09:00' }).success).toBe(false);
    expect(franjaSchema.safeParse({ dia_semana: '7', desde: '09:00', hasta: '10:00' }).success).toBe(false);
  });
});

describe('bloqueoSchema', () => {
  it('rechaza fin anterior al inicio', () => {
    expect(bloqueoSchema.safeParse({ desde: '2026-12-25', hasta: '2026-12-24', motivo: '' }).success).toBe(false);
    expect(bloqueoSchema.safeParse({ desde: '2026-12-25', hasta: '2026-12-25', motivo: 'Navidad' }).success).toBe(true);
  });
});

describe('configTurnosSchema', () => {
  it('valida paso y anticipación', () => {
    expect(configTurnosSchema.safeParse({ paso_minutos: '60', anticipacion_min_horas: '1', anticipacion_max_dias: '30' }).success).toBe(true);
    expect(configTurnosSchema.safeParse({ paso_minutos: '7', anticipacion_min_horas: '1', anticipacion_max_dias: '30' }).success).toBe(false);
    expect(configTurnosSchema.safeParse({ paso_minutos: '60', anticipacion_min_horas: '-1', anticipacion_max_dias: '30' }).success).toBe(false);
  });
});
