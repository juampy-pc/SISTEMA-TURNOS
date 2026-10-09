export const ESTADOS_TURNO = ['pendiente', 'confirmado', 'completado', 'cancelado', 'no_vino'] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];

export const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  completado: 'Cobrado',
  cancelado: 'Cancelado',
  no_vino: 'No vino',
};

const TRANSICIONES: Record<EstadoTurno, EstadoTurno[]> = {
  pendiente: ['confirmado', 'cancelado'],
  confirmado: ['completado', 'no_vino', 'cancelado'],
  completado: [],
  cancelado: [],
  no_vino: [],
};

export function transicionesDe(estado: EstadoTurno): EstadoTurno[] {
  return TRANSICIONES[estado];
}

/** Los estados activos ocupan el hueco en la agenda (los mismos de la restricción de exclusión). */
export function ocupaHueco(estado: EstadoTurno): boolean {
  return estado === 'pendiente' || estado === 'confirmado' || estado === 'completado';
}

export function esEstadoTurno(valor: unknown): valor is EstadoTurno {
  return typeof valor === 'string' && (ESTADOS_TURNO as readonly string[]).includes(valor);
}
