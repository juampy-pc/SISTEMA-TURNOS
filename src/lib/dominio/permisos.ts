export const PERMISOS = [
  { clave: 'ver_ingresos', etiqueta: 'Ver ingresos y métricas' },
  { clave: 'gestionar_turnos', etiqueta: 'Gestionar turnos' },
  { clave: 'ver_agendas_ajenas', etiqueta: 'Ver las agendas de otros' },
  { clave: 'gestionar_clientes', etiqueta: 'Gestionar clientes' },
  { clave: 'gestionar_servicios', etiqueta: 'Gestionar servicios y horarios' },
  { clave: 'registrar_ventas', etiqueta: 'Registrar ventas' },
  { clave: 'editar_catalogo', etiqueta: 'Editar catálogo y stock' },
  { clave: 'editar_negocio', etiqueta: 'Editar datos y marca del negocio' },
] as const;

export type ClavePermiso = (typeof PERMISOS)[number]['clave'];
export type Permisos = Partial<Record<ClavePermiso, boolean>>;

export interface RolBase {
  nombre: string;
  es_dueno: boolean;
  permisos: Permisos;
}

export interface RolConPermisos {
  es_dueno: boolean;
  permisos: unknown;
}

const CLAVES = new Set<string>(PERMISOS.map((p) => p.clave));

export function normalizarPermisos(entrada: unknown): Permisos {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) return {};
  const salida: Permisos = {};
  for (const [clave, valor] of Object.entries(entrada)) {
    if (CLAVES.has(clave) && valor === true) salida[clave as ClavePermiso] = true;
  }
  return salida;
}

export function puede(rol: RolConPermisos, clave: ClavePermiso): boolean {
  return rol.es_dueno || normalizarPermisos(rol.permisos)[clave] === true;
}

export const ROLES_POR_DEFECTO: RolBase[] = [
  { nombre: 'Dueño', es_dueno: true, permisos: {} },
  {
    nombre: 'Recepción',
    es_dueno: false,
    permisos: {
      gestionar_turnos: true,
      ver_agendas_ajenas: true,
      gestionar_clientes: true,
      registrar_ventas: true,
      editar_catalogo: true,
    },
  },
  { nombre: 'Profesional', es_dueno: false, permisos: { gestionar_turnos: true } },
];
