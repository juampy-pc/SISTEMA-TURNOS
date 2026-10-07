import { describe, expect, test } from 'vitest';
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
});
