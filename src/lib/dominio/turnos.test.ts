import { describe, expect, test } from 'vitest';
import { ESTADOS_TURNO, ocupaHueco, transicionesDe } from './turnos';

describe('transicionesDe', () => {
  test('pendiente se confirma o se cancela', () => {
    expect(transicionesDe('pendiente')).toEqual(['confirmado', 'cancelado']);
  });
  test('confirmado se completa, no vino o se cancela', () => {
    expect(transicionesDe('confirmado')).toEqual(['completado', 'no_vino', 'cancelado']);
  });
  test('los estados finales no tienen salida', () => {
    for (const e of ['completado', 'cancelado', 'no_vino'] as const) expect(transicionesDe(e)).toEqual([]);
  });
  test('toda transición apunta a un estado conocido', () => {
    for (const e of ESTADOS_TURNO) for (const t of transicionesDe(e)) expect(ESTADOS_TURNO).toContain(t);
  });
});

describe('ocupaHueco', () => {
  test('pendiente, confirmado y completado ocupan; cancelado y no_vino liberan', () => {
    expect(ESTADOS_TURNO.filter(ocupaHueco)).toEqual(['pendiente', 'confirmado', 'completado']);
  });
});
