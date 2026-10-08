import { describe, expect, test } from 'vitest';
import { itemsDeMenu, type ItemMenu } from './menu';

describe('itemsDeMenu', () => {
  test('el dueño ve todo el menú', () => {
    const hrefs = itemsDeMenu({ es_dueno: true, permisos: {} }).map((i) => i.href);
    expect(hrefs).toEqual([
      '/panel',
      '/panel/servicios',
      '/panel/recursos',
      '/panel/horarios',
      '/panel/empleados',
    ]);
  });

  test('servicios, recursos y horarios requieren gestionar_servicios', () => {
    const con = itemsDeMenu({ es_dueno: false, permisos: { gestionar_servicios: true } }).map((i) => i.href);
    expect(con).toEqual(['/panel', '/panel/servicios', '/panel/recursos', '/panel/horarios']);
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
