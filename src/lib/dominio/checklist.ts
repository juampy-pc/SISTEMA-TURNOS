export interface PasoInicial {
  id: string;
  texto: string;
  hecho: boolean;
  href?: string;
}

export interface EstadoChecklist {
  cantidadMiembros: number;
  cantidadServicios: number;
  cantidadRecursos: number;
  cantidadHorarios: number;
}

export function pasosIniciales(
  estado: EstadoChecklist,
  recurso: { plural: string } = { plural: 'recursos' },
): PasoInicial[] {
  return [
    { id: 'cuenta', texto: 'Creaste tu cuenta y tu negocio', hecho: true },
    {
      id: 'servicios',
      texto: 'Cargá tus servicios',
      hecho: estado.cantidadServicios > 0,
      href: '/panel/servicios',
    },
    {
      id: 'recursos',
      texto: `Cargá tus ${recurso.plural}`,
      hecho: estado.cantidadRecursos > 0,
      href: '/panel/recursos',
    },
    {
      id: 'horarios',
      texto: 'Definí tus horarios',
      hecho: estado.cantidadHorarios > 0,
      href: '/panel/horarios',
    },
    {
      id: 'equipo',
      texto: 'Sumá a tu equipo (opcional)',
      hecho: estado.cantidadMiembros > 1,
      href: '/panel/empleados',
    },
  ];
}
