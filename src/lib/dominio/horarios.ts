export const DIAS = [
  { n: 1, corto: 'Lun', largo: 'Lunes' },
  { n: 2, corto: 'Mar', largo: 'Martes' },
  { n: 3, corto: 'Mié', largo: 'Miércoles' },
  { n: 4, corto: 'Jue', largo: 'Jueves' },
  { n: 5, corto: 'Vie', largo: 'Viernes' },
  { n: 6, corto: 'Sáb', largo: 'Sábado' },
  { n: 0, corto: 'Dom', largo: 'Domingo' },
] as const;

export function parseHora(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

export function formatearHora(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface Franja {
  desde_min: number;
  hasta_min: number;
}

export function validarFranjas(franjas: Franja[]): string | null {
  for (const f of franjas) {
    if (f.hasta_min <= f.desde_min) return 'La hora de cierre tiene que ser posterior a la de apertura.';
  }
  const orden = [...franjas].sort((a, b) => a.desde_min - b.desde_min);
  for (let i = 1; i < orden.length; i++) {
    if (orden[i].desde_min < orden[i - 1].hasta_min) return 'Hay franjas que se superponen.';
  }
  return null;
}
