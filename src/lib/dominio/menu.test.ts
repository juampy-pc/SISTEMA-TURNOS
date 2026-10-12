import { describe, expect, test } from 'vitest';
import { itemsDeConfiguracion, itemsDeMenu, type ItemMenu } from './menu';

describe('itemsDeMenu', () => {
  test('el dueño ve el trabajo del día y Configuración', () => {
    const hrefs = itemsDeMenu({ es_dueno: true, permisos: {} }).map((i) => i.href);
    expect(hrefs).toEqual(['/panel', '/panel/turnos', '/panel/clientes', '/panel/configuracion']);
  });

  test('Productos y Stock aparecen solo si el negocio vende productos', () => {
    const dueno = { es_dueno: true, permisos: {} };
    expect(itemsDeMenu(dueno).map((i) => i.href)).not.toContain('/panel/productos');
    const hrefs = itemsDeMenu(dueno, undefined, true).map((i) => i.href);
    expect(hrefs).toContain('/panel/productos');
    expect(hrefs).toContain('/panel/stock');
    const vendedor = itemsDeMenu({ es_dueno: false, permisos: { registrar_ventas: true } }, undefined, true).map((i) => i.href);
    expect(vendedor).toEqual(['/panel', '/panel/productos']);
  });

  test('sin ninguna sección de configuración, no aparece Configuración', () => {
    const hrefs = itemsDeMenu({ es_dueno: false, permisos: { gestionar_turnos: true } }).map((i) => i.href);
    expect(hrefs).toEqual(['/panel', '/panel/turnos']);
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

describe('itemsDeConfiguracion', () => {
  test('el dueño ve todas las secciones', () => {
    expect(itemsDeConfiguracion({ es_dueno: true, permisos: {} }).map((i) => i.etiqueta)).toEqual([
      'Mi negocio', 'Servicios', 'Recursos', 'Horarios y bloqueos', 'Reservas', 'Empleados',
    ]);
  });

  test('gestionar_servicios ve servicios, recursos, horarios y reservas, pero no Empleados', () => {
    const rol = { es_dueno: false, permisos: { gestionar_servicios: true } };
    expect(itemsDeConfiguracion(rol).map((i) => i.etiqueta)).toEqual(['Servicios', 'Recursos', 'Horarios y bloqueos', 'Reservas']);
    expect(itemsDeMenu(rol).map((i) => i.href)).toContain('/panel/configuracion');
  });
});
