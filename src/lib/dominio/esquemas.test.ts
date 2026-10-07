import { describe, expect, test } from 'vitest';
import { empleadoSchema, registroSchema } from './esquemas';

const registroValido = {
  email: 'ana@example.com',
  password: 'clave-segura-1',
  nombreDueno: 'Ana',
  nombreNegocio: 'Barbería Uno',
  slug: 'barberia-uno',
  tipo: 'peluqueria',
  vendeProductos: true,
  modoTurnos: 'editable',
};

describe('registroSchema', () => {
  test('acepta un registro válido', () => {
    expect(registroSchema.safeParse(registroValido).success).toBe(true);
  });

  test.each([
    ['email', { email: 'no-es-email' }],
    ['password corta', { password: '1234567' }],
    ['password de más de 72 caracteres', { password: 'a'.repeat(73) }],
    ['slug con espacios', { slug: 'mal slug' }],
    ['slug con mayúsculas', { slug: 'Mal-Slug' }],
    ['tipo inexistente', { tipo: 'gimnasio' }],
    ['modo inexistente', { modoTurnos: 'libre' }],
    ['nombre de negocio vacío', { nombreNegocio: ' ' }],
  ])('rechaza %s', (_, cambio) => {
    expect(registroSchema.safeParse({ ...registroValido, ...cambio }).success).toBe(false);
  });
});

describe('empleadoSchema', () => {
  const valido = {
    nombre: 'Juan Pérez',
    usuario: '  Juan.Perez ',
    password: 'clave-segura-1',
    rolId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  };

  test('normaliza el usuario (espacios y mayúsculas)', () => {
    const r = empleadoSchema.safeParse(valido);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.usuario).toBe('juan.perez');
  });

  test.each([
    ['usuario corto', { usuario: 'ab' }],
    ['usuario con espacios internos', { usuario: 'juan perez' }],
    ['password corta', { password: 'corta' }],
    ['rol que no es uuid', { rolId: 'no-uuid' }],
  ])('rechaza %s', (_, cambio) => {
    expect(empleadoSchema.safeParse({ ...valido, ...cambio }).success).toBe(false);
  });
});
