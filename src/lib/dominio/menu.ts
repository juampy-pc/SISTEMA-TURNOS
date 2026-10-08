import { puede, type ClavePermiso, type RolConPermisos } from './permisos';

export interface ItemMenu {
  href: string;
  etiqueta: string;
  permiso?: ClavePermiso;
  soloDueno?: boolean;
}

export const ITEMS_MENU: ItemMenu[] = [
  { href: '/panel', etiqueta: 'Inicio' },
  { href: '/panel/turnos', etiqueta: 'Turnos', permiso: 'gestionar_turnos' },
  { href: '/panel/clientes', etiqueta: 'Clientes', permiso: 'gestionar_clientes' },
  { href: '/panel/servicios', etiqueta: 'Servicios', permiso: 'gestionar_servicios' },
  { href: '/panel/recursos', etiqueta: 'Recursos', permiso: 'gestionar_servicios' },
  { href: '/panel/horarios', etiqueta: 'Horarios', permiso: 'gestionar_servicios' },
  { href: '/panel/empleados', etiqueta: 'Empleados', soloDueno: true },
];

export function itemsDeMenu(rol: RolConPermisos, items: ItemMenu[] = ITEMS_MENU): ItemMenu[] {
  return items.filter(
    (i) => (!i.soloDueno || rol.es_dueno) && (!i.permiso || puede(rol, i.permiso)),
  );
}
