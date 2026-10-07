import { describe, expect, test } from 'vitest';
import { pasosIniciales } from './checklist';

describe('pasosIniciales', () => {
  test('el paso de la cuenta siempre está hecho', () => {
    expect(pasosIniciales({ cantidadMiembros: 1 }).find((p) => p.id === 'cuenta')?.hecho).toBe(true);
  });

  test('el paso del equipo se completa al haber más de un miembro', () => {
    expect(pasosIniciales({ cantidadMiembros: 1 }).find((p) => p.id === 'equipo')?.hecho).toBe(false);
    expect(pasosIniciales({ cantidadMiembros: 2 }).find((p) => p.id === 'equipo')?.hecho).toBe(true);
  });
});
