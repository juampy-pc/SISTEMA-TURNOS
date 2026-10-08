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
