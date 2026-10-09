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
  ejemplo: EjemploPlantilla;
}

export interface EjemploPlantilla {
  recursos: string[];
  servicios: { nombre: string; duracion_min: number; precio: number }[];
  horario: { dias: number[]; desde_min: number; hasta_min: number };
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
    ejemplo: {
      recursos: ['Cancha 1', 'Cancha 2'],
      servicios: [{ nombre: 'Alquiler 1 hora', duracion_min: 60, precio: 0 }],
      horario: { dias: [1, 2, 3, 4, 5, 6, 0], desde_min: 960, hasta_min: 1440 },
    },
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
    ejemplo: {
      recursos: ['Profesional 1'],
      servicios: [
        { nombre: 'Corte', duracion_min: 30, precio: 0 },
        { nombre: 'Corte y barba', duracion_min: 45, precio: 0 },
      ],
      horario: { dias: [1, 2, 3, 4, 5, 6], desde_min: 540, hasta_min: 1080 },
    },
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
    ejemplo: {
      recursos: ['Profesional 1'],
      servicios: [
        { nombre: 'Limpieza facial', duracion_min: 60, precio: 0 },
        { nombre: 'Depilación', duracion_min: 30, precio: 0 },
      ],
      horario: { dias: [1, 2, 3, 4, 5, 6], desde_min: 540, hasta_min: 1080 },
    },
  },
};

export function plantillaDe(tipo: TipoNegocio): Plantilla {
  return PLANTILLAS[tipo];
}

export function esTipoNegocio(valor: unknown): valor is TipoNegocio {
  return typeof valor === 'string' && (TIPOS_NEGOCIO as readonly string[]).includes(valor);
}
