import { describe, expect, test } from 'vitest';
import { normalizarPermisos, puede, ROLES_POR_DEFECTO } from './permisos';

describe('puede', () => {
  test('el dueño puede todo aunque no tenga permisos listados', () => {
    expect(puede({ es_dueno: true, permisos: {} }, 'ver_ingresos')).toBe(true);
  });

  test('un rol no-dueño solo puede lo que tiene en true', () => {
    const rol = { es_dueno: false, permisos: { gestionar_turnos: true } };
    expect(puede(rol, 'gestionar_turnos')).toBe(true);
    expect(puede(rol, 'ver_ingresos')).toBe(false);
  });

  test('permisos corruptos se tratan como sin permisos', () => {
    expect(puede({ es_dueno: false, permisos: null }, 'gestionar_turnos')).toBe(false);
    expect(puede({ es_dueno: false, permisos: 'si' }, 'gestionar_turnos')).toBe(false);
  });
});

describe('normalizarPermisos', () => {
  test('descarta claves desconocidas y valores que no son true', () => {
    expect(
      normalizarPermisos({ gestionar_turnos: true, ver_ingresos: false, inventado: true, editar_negocio: 'true' }),
    ).toEqual({ gestionar_turnos: true });
  });

  test('entradas que no son objeto dan vacío', () => {
    expect(normalizarPermisos(null)).toEqual({});
    expect(normalizarPermisos([true])).toEqual({});
    expect(normalizarPermisos('x')).toEqual({});
  });
});

describe('ROLES_POR_DEFECTO', () => {
  test('hay exactamente un rol dueño y tres roles', () => {
    expect(ROLES_POR_DEFECTO).toHaveLength(3);
    expect(ROLES_POR_DEFECTO.filter((r) => r.es_dueno)).toHaveLength(1);
  });

  test('Recepción no ve ingresos y el Profesional no ve agendas ajenas', () => {
    const recepcion = ROLES_POR_DEFECTO.find((r) => r.nombre === 'Recepción')!;
    const profesional = ROLES_POR_DEFECTO.find((r) => r.nombre === 'Profesional')!;
    expect(puede(recepcion, 'ver_ingresos')).toBe(false);
    expect(puede(recepcion, 'gestionar_turnos')).toBe(true);
    expect(puede(profesional, 'ver_agendas_ajenas')).toBe(false);
    expect(puede(profesional, 'gestionar_turnos')).toBe(true);
  });
});
