import { describe, expect, test } from 'vitest';
import { servicioSchema } from './esquemas-turnos';
import { esTipoNegocio, plantillaDe, PLANTILLAS, TIPOS_NEGOCIO } from './plantillas';

describe('plantillas', () => {
  test('hay una plantilla completa por cada tipo de negocio', () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const p = plantillaDe(tipo);
      expect(p.tipo).toBe(tipo);
      expect(p.etiqueta.length).toBeGreaterThan(0);
      expect(p.recurso.singular.length).toBeGreaterThan(0);
      expect(p.recurso.plural.length).toBeGreaterThan(0);
      expect(p.tips.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('las canchas usan turnos fijos y llaman "cancha" a su recurso', () => {
    expect(PLANTILLAS.cancha.modoTurnosSugerido).toBe('fijo');
    expect(PLANTILLAS.cancha.recurso.singular).toBe('cancha');
  });

  test('peluquerías y estéticas sugieren turnos editables', () => {
    expect(PLANTILLAS.peluqueria.modoTurnosSugerido).toBe('editable');
    expect(PLANTILLAS.estetica.modoTurnosSugerido).toBe('editable');
  });

  test('esTipoNegocio acepta solo tipos válidos', () => {
    expect(esTipoNegocio('cancha')).toBe(true);
    expect(esTipoNegocio('gimnasio')).toBe(false);
    expect(esTipoNegocio(undefined)).toBe(false);
  });

  test('cada plantilla trae datos de ejemplo válidos', () => {
    for (const tipo of TIPOS_NEGOCIO) {
      const { ejemplo } = plantillaDe(tipo);
      expect(ejemplo.recursos.length).toBeGreaterThanOrEqual(1);
      expect(ejemplo.servicios.length).toBeGreaterThanOrEqual(1);
      for (const s of ejemplo.servicios) expect(servicioSchema.safeParse(s).success).toBe(true);
      expect(ejemplo.horario.hasta_min).toBeGreaterThan(ejemplo.horario.desde_min);
      expect(ejemplo.horario.dias.length).toBeGreaterThan(0);
    }
  });

  test('las canchas arrancan con un servicio de una hora (grilla fija)', () => {
    expect(PLANTILLAS.cancha.ejemplo.servicios.some((s) => s.duracion_min === 60)).toBe(true);
  });
});
