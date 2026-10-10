import { describe, expect, it } from 'vitest';
import { negocioSchema, productoSchema, validarImagen, ventaSchema } from './esquemas-negocio';

const base = { nombre: 'Barbería', descripcion: '', direccion: '', instagram: '', color: '#1d4ed8', vende_productos: false };

describe('negocioSchema', () => {
  it('normaliza el Instagram desde @usuario o el link', () => {
    expect(negocioSchema.parse({ ...base, instagram: '@la.barberia' }).instagram).toBe('la.barberia');
    expect(negocioSchema.parse({ ...base, instagram: 'https://www.instagram.com/la_barberia/' }).instagram).toBe('la_barberia');
  });

  it('rechaza un Instagram inválido y un color fuera de la lista', () => {
    expect(negocioSchema.safeParse({ ...base, instagram: 'con espacios' }).success).toBe(false);
    expect(negocioSchema.safeParse({ ...base, color: '#123456' }).success).toBe(false);
  });
});

describe('productoSchema', () => {
  it('costo vacío es null y el stock tiene que ser entero', () => {
    const r = productoSchema.parse({ nombre: 'Cera', descripcion: '', precio: '5000', costo: '', stock: '3' });
    expect(r.costo).toBeNull();
    expect(r.precio).toBe(5000);
    expect(productoSchema.safeParse({ nombre: 'Cera', descripcion: '', precio: '1', costo: '', stock: '1.5' }).success).toBe(false);
  });
});

describe('ventaSchema', () => {
  it('monto vacío queda null; cantidad mínima 1', () => {
    expect(ventaSchema.parse({ cantidad: '2', monto: '' })).toEqual({ cantidad: 2, monto: null });
    expect(ventaSchema.safeParse({ cantidad: '0', monto: '' }).success).toBe(false);
  });
});

describe('validarImagen', () => {
  it('acepta JPG, PNG y WebP de hasta 2 MB', () => {
    expect(validarImagen('image/png', 1000)).toEqual({ ok: true, ext: 'png' });
    expect(validarImagen('image/gif', 1000).ok).toBe(false);
    expect(validarImagen('image/jpeg', 3 * 1024 * 1024).ok).toBe(false);
    expect(validarImagen('image/jpeg', 0).ok).toBe(false);
  });
});
