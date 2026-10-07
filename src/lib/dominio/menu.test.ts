import { describe, expect, test } from 'vitest';
import { itemsDeMenu, type ItemMenu } from './menu';

describe('itemsDeMenu', () => {
  test('el dueño ve Inicio y Empleados', () => {
    const hrefs = itemsDeMenu({ es_dueno: true, permisos: {} }).map((i) => i.href);
    expect(hrefs).toEqual(['/panel', '/panel/empleados']);
  });

  test('un empleado no ve Empleados', () => {
    const hrefs = itemsDeMenu({ es_dueno: false, permisos: { gestionar_turnos: true } }).map((i) => i.href);
    expect(hrefs).toEqual(['/panel']);
  });

  test('un ítem con permiso solo aparece para quien lo tiene', () => {
    const items: ItemMenu[] = [
      { href: '/panel', etiqueta: 'Inicio' },
      { href: '/panel/metricas', etiqueta: 'Métricas', permiso: 'ver_ingresos' },
    ];
    expect(itemsDeMenu({ es_dueno: false, permisos: {} }, items)).toHaveLength(1);
    expect(itemsDeMenu({ es_dueno: false, permisos: { ver_ingresos: true } }, items)).toHaveLength(2);
  });
});
