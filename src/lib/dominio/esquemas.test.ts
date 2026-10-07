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

describe('registroSchema: mensajes en español', () => {
  const mensajes = (cambio: Record<string, unknown>) => {
    const r = registroSchema.safeParse({ ...registroValido, ...cambio });
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  test('un slug reservado se rechaza con mensaje claro', () => {
    expect(mensajes({ slug: 'panel' })).toEqual(['Ese link está reservado, elegí otro.']);
    expect(mensajes({ slug: 'b' })).toEqual(['Ese link está reservado, elegí otro.']);
  });

  test('un slug inválido (no reservado) mantiene su mensaje', () => {
    expect(mensajes({ slug: 'mal slug' })).toEqual(['El link solo admite minúsculas, números y guiones (3 a 40 caracteres).']);
  });

  test('tipo, vendeProductos y modoTurnos inválidos tienen mensaje en español', () => {
    expect(mensajes({ tipo: 'gimnasio' })).toEqual(['Elegí un tipo de negocio.']);
    expect(mensajes({ tipo: null })).toEqual(['Elegí un tipo de negocio.']);
    expect(mensajes({ vendeProductos: 'si' })).toEqual(['Indicá si vendés productos.']);
    expect(mensajes({ modoTurnos: 'libre' })).toEqual(['Elegí cómo son tus turnos.']);
    expect(mensajes({ modoTurnos: null })).toEqual(['Elegí cómo son tus turnos.']);
  });

  test('nombres vacíos o fuera de rango tienen mensaje en español', () => {
    expect(mensajes({ nombreDueno: ' ' })).toEqual(['Ingresá tu nombre.']);
    expect(mensajes({ nombreDueno: 'A' })).toEqual(['El nombre debe tener entre 2 y 80 caracteres.']);
    expect(mensajes({ nombreDueno: 'a'.repeat(81) })).toEqual(['El nombre debe tener entre 2 y 80 caracteres.']);
    expect(mensajes({ nombreNegocio: '' })).toEqual(['Ingresá el nombre del negocio.']);
    expect(mensajes({ nombreNegocio: 'A' })).toEqual(['El nombre del negocio debe tener entre 2 y 80 caracteres.']);
    expect(mensajes({ nombreNegocio: 'a'.repeat(81) })).toEqual(['El nombre del negocio debe tener entre 2 y 80 caracteres.']);
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
