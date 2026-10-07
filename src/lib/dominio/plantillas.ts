export const TIPOS_NEGOCIO = ['cancha', 'peluqueria', 'estetica'] as const;
export type TipoNegocio = (typeof TIPOS_NEGOCIO)[number];
export type ModoTurnos = 'fijo' | 'editable';

export interface Plantilla {
  tipo: TipoNegocio;
  etiqueta: string;
  recurso: { singular: string; plural: string };
  reserva: { singular: string; plural: string };
  modoTurnosSugerido: ModoTurnos;
  vendeProductosSugerido: boolean;
  tips: string[];
}

export const PLANTILLAS: Record<TipoNegocio, Plantilla> = {
  cancha: {
    tipo: 'cancha',
    etiqueta: 'Canchas de fútbol',
    recurso: { singular: 'cancha', plural: 'canchas' },
    reserva: { singular: 'reserva', plural: 'reservas' },
    modoTurnosSugerido: 'fijo',
    vendeProductosSugerido: false,
    tips: [
      'Cargá cada cancha como un recurso aparte para que tus clientes elijan en cuál jugar.',
      'Con turnos fijos armás una grilla (por ejemplo, de una hora) y evitás superposiciones.',
      'Si vendés bebidas o accesorios, activá el catálogo para controlar el stock.',
    ],
  },
  peluqueria: {
    tipo: 'peluqueria',
    etiqueta: 'Peluquería / Barbería',
    recurso: { singular: 'profesional', plural: 'profesionales' },
    reserva: { singular: 'turno', plural: 'turnos' },
    modoTurnosSugerido: 'editable',
    vendeProductosSugerido: true,
    tips: [
      'Sumá a cada barbero o peluquero como profesional, con su propia agenda.',
      'Cargá tus servicios con duración y precio: el sistema calcula los horarios libres.',
      'Creá usuarios para tu equipo desde Empleados y elegí qué puede ver cada uno.',
    ],
  },
  estetica: {
    tipo: 'estetica',
    etiqueta: 'Estética',
    recurso: { singular: 'profesional', plural: 'profesionales' },
    reserva: { singular: 'turno', plural: 'turnos' },
    modoTurnosSugerido: 'editable',
    vendeProductosSugerido: true,
    tips: [
      'Cargá cada tratamiento como un servicio con su duración, así los turnos no se pisan.',
      'Sumá a cada profesional o cabina como recurso para que el cliente elija.',
      'Si vendés cosmética, activá el catálogo y llevá el stock en un solo lugar.',
    ],
  },
};

export function plantillaDe(tipo: TipoNegocio): Plantilla {
  return PLANTILLAS[tipo];
}

export function esTipoNegocio(valor: unknown): valor is TipoNegocio {
  return typeof valor === 'string' && (TIPOS_NEGOCIO as readonly string[]).includes(valor);
}
