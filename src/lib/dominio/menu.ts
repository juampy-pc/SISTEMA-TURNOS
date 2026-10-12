import { puede, type ClavePermiso, type RolConPermisos } from './permisos';

export interface ItemMenu {
  href: string;
  etiqueta: string;
  permiso?: ClavePermiso;
  soloDueno?: boolean;
  /** Solo si el negocio vende productos. */
  conProductos?: boolean;
}

/** Menú principal: el trabajo del día. Todo lo que se configura vive en Configuración. */
export const ITEMS_MENU: ItemMenu[] = [
  { href: '/panel', etiqueta: 'Inicio' },
  { href: '/panel/turnos', etiqueta: 'Turnos', permiso: 'gestionar_turnos' },
  { href: '/panel/clientes', etiqueta: 'Clientes', permiso: 'gestionar_clientes' },
  { href: '/panel/productos', etiqueta: 'Productos', permiso: 'registrar_ventas', conProductos: true },
  { href: '/panel/stock', etiqueta: 'Stock y precios', permiso: 'editar_catalogo', conProductos: true },
];

export const RUTA_CONFIGURACION = '/panel/configuracion';

/** Secciones de Configuración, en el orden en que se recorren al arrancar. */
export const ITEMS_CONFIGURACION: (ItemMenu & { descripcion: string })[] = [
  { href: '/panel/configuracion/negocio', etiqueta: 'Mi negocio', permiso: 'editar_negocio', descripcion: 'Nombre, WhatsApp, logo y cómo se ve tu página.' },
  { href: '/panel/configuracion/servicios', etiqueta: 'Servicios', permiso: 'gestionar_servicios', descripcion: 'Qué ofrecés, cuánto dura y cuánto sale.' },
  { href: '/panel/configuracion/recursos', etiqueta: 'Recursos', permiso: 'gestionar_servicios', descripcion: 'Quién atiende y qué servicios hace cada uno.' },
  { href: '/panel/configuracion/horarios', etiqueta: 'Horarios y bloqueos', permiso: 'gestionar_servicios', descripcion: 'Cuándo atendés y los días u horas sin atención.' },
  { href: '/panel/configuracion/reservas', etiqueta: 'Reservas', permiso: 'gestionar_servicios', descripcion: 'Intervalos y con cuánta anticipación te pueden pedir.' },
  { href: '/panel/configuracion/empleados', etiqueta: 'Empleados', soloDueno: true, descripcion: 'Usuarios de tu equipo y qué puede hacer cada rol.' },
];

function filtrar<T extends ItemMenu>(rol: RolConPermisos, items: T[], vendeProductos: boolean): T[] {
  return items.filter(
    (i) =>
      (!i.soloDueno || rol.es_dueno) && (!i.permiso || puede(rol, i.permiso)) && (!i.conProductos || vendeProductos),
  );
}

export function itemsDeConfiguracion(rol: RolConPermisos) {
  return filtrar(rol, ITEMS_CONFIGURACION, false);
}

/** Menú principal; suma Configuración si el rol puede ver al menos una sección. */
export function itemsDeMenu(rol: RolConPermisos, items: ItemMenu[] = ITEMS_MENU, vendeProductos = false): ItemMenu[] {
  const principal = filtrar(rol, items, vendeProductos);
  if (items !== ITEMS_MENU || itemsDeConfiguracion(rol).length === 0) return principal;
  return [...principal, { href: RUTA_CONFIGURACION, etiqueta: 'Configuración' }];
}
