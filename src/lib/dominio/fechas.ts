// El negocio opera en hora argentina (sin horario de verano): UTC-3 fijo.
export const ZONA = 'America/Argentina/Buenos_Aires';

export function hoyISO(ahora: Date = new Date()): string {
  return ahora.toLocaleDateString('en-CA', { timeZone: ZONA });
}

export function esFechaISO(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(`${valor}T00:00:00Z`));
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Rango [desde, hasta) en UTC que cubre el día local `fecha`. */
export function rangoDelDia(fecha: string): { desde: string; hasta: string } {
  return {
    desde: new Date(`${fecha}T00:00:00-03:00`).toISOString(),
    hasta: new Date(`${sumarDias(fecha, 1)}T00:00:00-03:00`).toISOString(),
  };
}

export function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false });
}

export function etiquetaDia(fecha: string): string {
  return new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-AR', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  });
}

/** Si el instante `iso` ocurrió dentro de las últimas `horas`. */
export function esReciente(iso: string, horas: number, ahora: Date = new Date()): boolean {
  return ahora.getTime() - new Date(iso).getTime() < horas * 60 * 60 * 1000;
}

/** Si el turno de `inicio` a `fin` está en curso en este momento. */
export function estaEnCurso(inicio: string, fin: string, ahora: Date = new Date()): boolean {
  const t = ahora.getTime();
  return new Date(inicio).getTime() <= t && t < new Date(fin).getTime();
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Partes para mostrar un día compacto: "lun" y "12". */
export function partesDia(fecha: string): { semana: string; numero: number } {
  const d = new Date(`${fecha}T12:00:00Z`);
  return { semana: DIAS_CORTOS[d.getUTCDay()], numero: d.getUTCDate() };
}

/** Los `cantidad` días consecutivos desde `desde` (incluido). */
export function diasDesde(desde: string, cantidad: number): string[] {
  return Array.from({ length: Math.max(0, cantidad) }, (_, i) => sumarDias(desde, i));
}

/** Lunes de la semana de `fecha`. */
export function lunesDe(fecha: string): string {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  return sumarDias(fecha, dia === 0 ? -6 : 1 - dia);
}
