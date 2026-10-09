import { describe, expect, test } from 'vitest';
import { normalizarTelefono, posibleDuplicado } from './telefono';

describe('normalizarTelefono', () => {
  test.each([
    ['011 15-4444-5555', '+5491144445555'],
    ['+54 9 11 4444-5555', '+5491144445555'],
    ['1144445555', '+5491144445555'],
    ['(011) 4444-5555', '+5491144445555'],
    ['+5491144445555', '+5491144445555'],
    ['0351 15 612 3456', '+5493516123456'],
    ['  11 4444 5555  ', '+5491144445555'],
  ])('%s → %s', (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toEqual({ ok: true, e164: esperado });
  });

  test('acepta números de otros países con prefijo internacional', () => {
    expect(normalizarTelefono('+598 99 123 456')).toEqual({ ok: true, e164: '+59899123456' });
  });

  test.each(['', '   ', 'abc', '123', '0000000000', '+54 9 11 4444'])('rechaza %j', (entrada) => {
    const r = normalizarTelefono(entrada);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/teléfono/i);
  });
});

describe('posibleDuplicado', () => {
  test('mismo número no es "posible duplicado" (es el mismo cliente)', () => {
    expect(posibleDuplicado('+5491144445555', '+5491144445555')).toBe(false);
  });
  test('un dígito de diferencia', () => {
    expect(posibleDuplicado('+5491144445555', '+5491144445556')).toBe(true);
  });
  test('mismos últimos 8 dígitos con distinto prefijo', () => {
    expect(posibleDuplicado('+5491144445555', '+541144445555')).toBe(true);
  });
  test('números distintos', () => {
    expect(posibleDuplicado('+5491144445555', '+5491166667777')).toBe(false);
  });
});
