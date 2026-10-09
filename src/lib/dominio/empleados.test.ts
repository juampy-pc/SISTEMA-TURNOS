import { describe, expect, test } from 'vitest';
import { emailInterno, normalizarUsuario, USUARIO_REGEX } from './empleados';

describe('normalizarUsuario', () => {
  test('recorta espacios y pasa a minúsculas', () => {
    expect(normalizarUsuario('  Juan.Perez ')).toBe('juan.perez');
  });
});

describe('USUARIO_REGEX', () => {
  test('acepta letras, números, punto, guion y guion bajo (3 a 30)', () => {
    expect(USUARIO_REGEX.test('juan_perez-2')).toBe(true);
  });

  test('rechaza espacios, @, tildes y largos fuera de rango', () => {
    for (const malo of ['ju', 'juan perez', 'juan@x', 'jóse', 'a'.repeat(31)]) {
      expect(USUARIO_REGEX.test(malo)).toBe(false);
    }
  });
});

describe('emailInterno', () => {
  test('es determinístico y separa usuario y negocio sin ambigüedad', () => {
    expect(emailInterno('juan', 'barberia-uno')).toBe('juan@barberia-uno.staff.sistema-turnos.invalid');
    expect(emailInterno('juan', 'a-b')).not.toBe(emailInterno('juan.a', 'b'));
  });

  test('el mismo usuario en dos negocios da emails distintos', () => {
    expect(emailInterno('juan', 'negocio-a')).not.toBe(emailInterno('juan', 'negocio-b'));
  });
});
