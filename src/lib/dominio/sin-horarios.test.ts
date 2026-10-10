import { describe, expect, test } from 'vitest';
import { motivoSinHorarios, type ContextoSinHorarios, type RecursoConsultado } from './sin-horarios';

const juan: RecursoConsultado = { nombre: 'Juan', haceServicio: true, atiendeEseDia: true, bloqueado: false };
// 2026-10-12 es lunes.
const base: ContextoSinHorarios = {
  fecha: '2026-10-12',
  hoy: '2026-10-10',
  maxFecha: '2026-11-09',
  anticipacionMaxDias: 30,
  servicio: 'Corte',
  recurso: { singular: 'profesional', plural: 'profesionales' },
  elegido: juan,
  todos: [juan],
};

describe('motivoSinHorarios', () => {
  test('día pasado y fuera de la anticipación máxima', () => {
    expect(motivoSinHorarios({ ...base, fecha: '2026-10-09' })).toContain('ya pasó');
    expect(motivoSinHorarios({ ...base, fecha: '2026-12-01' })).toContain('hasta 30 días');
  });

  test('el profesional no tiene el servicio asignado', () => {
    const r = { ...juan, haceServicio: false };
    expect(motivoSinHorarios({ ...base, elegido: r, todos: [r] })).toBe('Juan no tiene asignado "Corte". Asignáselo en Profesionales.');
    expect(motivoSinHorarios({ ...base, elegido: null, todos: [r] })).toBe('Ningún profesional tiene asignado "Corte". Asignalo en Profesionales.');
  });

  test('bloqueo y día sin atención', () => {
    expect(motivoSinHorarios({ ...base, elegido: { ...juan, bloqueado: true } })).toContain('bloqueo');
    expect(motivoSinHorarios({ ...base, elegido: { ...juan, atiendeEseDia: false } })).toBe('Juan no atiende los lunes. Cargá sus horarios en Horarios.');
    expect(motivoSinHorarios({ ...base, fecha: '2026-10-18', elegido: { ...juan, atiendeEseDia: false } })).toContain('los domingos');
  });

  test('hoy sin horarios y día completo', () => {
    expect(motivoSinHorarios({ ...base, fecha: '2026-10-10' })).toContain('hoy ya pasaron');
    expect(motivoSinHorarios(base)).toContain('ocupados');
  });
});
