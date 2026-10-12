import { describe, expect, it, test } from 'vitest';
import { diasDesde, esFechaISO, esReciente, horaLocal, hoyISO, lunesDe, partesDia, rangoDelDia, sumarDias } from './fechas';

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

describe('días compactos', () => {
  it('partesDia da el día de la semana y el número', () => {
    expect(partesDia('2026-10-13')).toEqual({ semana: 'mar', numero: 13 });
    expect(partesDia('2026-10-11')).toEqual({ semana: 'dom', numero: 11 });
  });
  it('diasDesde arma días consecutivos y cruza de mes', () => {
    expect(diasDesde('2026-10-30', 3)).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
    expect(diasDesde('2026-10-30', 0)).toEqual([]);
  });
  it('lunesDe vuelve al lunes, y el domingo pertenece a la semana anterior', () => {
    expect(lunesDe('2026-10-14')).toBe('2026-10-12');
    expect(lunesDe('2026-10-12')).toBe('2026-10-12');
    expect(lunesDe('2026-10-18')).toBe('2026-10-12');
  });
});
