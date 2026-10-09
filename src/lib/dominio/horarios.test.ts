import { describe, expect, it } from 'vitest';
import { formatearHora, parseHora, validarFranjas } from './horarios';

describe('parseHora / formatearHora', () => {
  it('convierte HH:MM a minutos y viceversa', () => {
    expect(parseHora('09:30')).toBe(570);
    expect(parseHora('0:05')).toBe(5);
    expect(parseHora('24:00')).toBe(1440);
    expect(formatearHora(570)).toBe('09:30');
    expect(formatearHora(1440)).toBe('24:00');
  });
  it('rechaza horas inválidas', () => {
    for (const s of ['', '9', '25:00', '12:60', 'ab:cd', '24:01', '-1:00']) expect(parseHora(s)).toBeNull();
  });
});

describe('validarFranjas', () => {
  it('acepta franjas ordenadas y sin solape, incluso pegadas', () => {
    expect(validarFranjas([{ desde_min: 540, hasta_min: 780 }, { desde_min: 780, hasta_min: 1080 }])).toBeNull();
  });
  it('rechaza franjas invertidas o vacías', () => {
    expect(validarFranjas([{ desde_min: 1080, hasta_min: 540 }])).toMatch(/posterior/);
    expect(validarFranjas([{ desde_min: 540, hasta_min: 540 }])).toMatch(/posterior/);
  });
  it('rechaza solapes sin importar el orden de carga', () => {
    expect(validarFranjas([{ desde_min: 720, hasta_min: 1080 }, { desde_min: 540, hasta_min: 780 }])).toMatch(/superponen/);
  });
});
