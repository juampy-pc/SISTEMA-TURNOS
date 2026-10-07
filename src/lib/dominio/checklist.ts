export interface PasoInicial {
  id: string;
  texto: string;
  hecho: boolean;
  href?: string;
}

export function pasosIniciales(estado: { cantidadMiembros: number }): PasoInicial[] {
  return [
    { id: 'cuenta', texto: 'Creaste tu cuenta y tu negocio', hecho: true },
    {
      id: 'equipo',
      texto: 'Sumá a tu equipo (opcional)',
      hecho: estado.cantidadMiembros > 1,
      href: '/panel/empleados',
    },
  ];
}
