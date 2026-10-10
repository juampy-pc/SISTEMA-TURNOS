import { describe, expect, test } from 'vitest';
import { esFechaISO, esReciente, horaLocal, hoyISO, rangoDelDia, sumarDias } from './fechas';

describe('fechas', () => {
  test('hoyISO usa la hora argentina (a las 01:00 UTC todavía es el día anterior)', () => {
    expect(hoyISO(new Date('2026-10-08T01:00:00Z'))).toBe('2026-10-07');
    expect(hoyISO(new Date('2026-10-08T12:00:00Z'))).toBe('2026-10-08');
  });
  test('esFechaISO rechaza basura y fechas imposibles', () => {
    expect(esFechaISO('2026-10-08')).toBe(true);
    for (const v of ['', 'hoy', '2026-13-01', '2026-02-31x', undefined]) expect(esFechaISO(v)).toBe(false);
  });
  test('sumarDias cruza mes y año', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });
  test('rangoDelDia cubre 24 horas desde las 03:00 UTC', () => {
    expect(rangoDelDia('2026-10-08')).toEqual({ desde: '2026-10-08T03:00:00.000Z', hasta: '2026-10-09T03:00:00.000Z' });
  });
  test('horaLocal formatea en hora argentina', () => {
    expect(horaLocal('2026-10-08T13:30:00Z')).toBe('10:30');
  });
});

describe('esReciente', () => {
  test('compara contra las últimas N horas', () => {
    const ahora = new Date('2026-10-10T12:00:00Z');
    expect(esReciente('2026-10-10T00:30:00Z', 24, ahora)).toBe(true);
    expect(esReciente('2026-10-09T11:00:00Z', 24, ahora)).toBe(false);
  });
});
