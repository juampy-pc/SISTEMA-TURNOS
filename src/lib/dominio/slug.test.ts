import { describe, expect, test } from 'vitest';
import { esSlugValido, SLUGS_RESERVADOS, slugify } from './slug';

describe('slugify', () => {
  test('pasa a minúsculas, saca tildes y reemplaza símbolos por guiones', () => {
    expect(slugify('Barbería Los Pibes!')).toBe('barberia-los-pibes');
    expect(slugify('Ñandú')).toBe('nandu');
  });

  test('colapsa guiones y recorta los extremos', () => {
    expect(slugify('  --a--b--  ')).toBe('a-b');
  });

  test('limita a 40 caracteres sin dejar un guion al final', () => {
    const s = slugify('a'.repeat(39) + ' bbbb');
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith('-')).toBe(false);
  });

  test('un texto sin letras ni números da vacío', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('esSlugValido', () => {
  test('acepta slugs bien formados de 3 a 40 caracteres', () => {
    expect(esSlugValido('mi-cancha')).toBe(true);
    expect(esSlugValido('abc')).toBe(true);
  });

  test('rechaza mayúsculas, espacios, guiones dobles o en los extremos y largos fuera de rango', () => {
    for (const malo of ['Mi-Cancha', 'mi cancha', 'mi--cancha', '-mi', 'mi-', 'ab', 'a'.repeat(41), '']) {
      expect(esSlugValido(malo)).toBe(false);
    }
  });
});

describe('SLUGS_RESERVADOS', () => {
  test('coincide con la lista de la base (private.slugs_reservados)', () => {
    expect(SLUGS_RESERVADOS).toEqual(['panel', 'login', 'registro', 'salir', 'api', 'b', 'admin', 'app', 'www', 'static', 'assets', 'soporte']);
  });

  test('esSlugValido rechaza todos los slugs reservados', () => {
    for (const reservado of SLUGS_RESERVADOS) {
      expect(esSlugValido(reservado)).toBe(false);
    }
  });
});
