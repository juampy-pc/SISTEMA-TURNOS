import { describe, expect, test } from 'vitest';
import { pasosIniciales, type EstadoChecklist } from './checklist';

const vacio: EstadoChecklist = { cantidadMiembros: 1, cantidadServicios: 0, cantidadRecursos: 0, cantidadHorarios: 0 };
const paso = (e: EstadoChecklist, id: string) => pasosIniciales(e).find((p) => p.id === id);

describe('pasosIniciales', () => {
  test('el paso de la cuenta siempre está hecho', () => {
    expect(paso(vacio, 'cuenta')?.hecho).toBe(true);
  });

  test('el paso del equipo se completa al haber más de un miembro', () => {
    expect(paso(vacio, 'equipo')?.hecho).toBe(false);
    expect(paso({ ...vacio, cantidadMiembros: 2 }, 'equipo')?.hecho).toBe(true);
  });

  test('servicios, recursos y horarios se completan al haber al menos uno', () => {
    for (const [id, campo] of [
      ['servicios', 'cantidadServicios'],
      ['recursos', 'cantidadRecursos'],
      ['horarios', 'cantidadHorarios'],
    ] as const) {
      expect(paso(vacio, id)?.hecho).toBe(false);
      expect(paso({ ...vacio, [campo]: 1 }, id)?.hecho).toBe(true);
    }
  });

  test('el texto de recursos usa el vocabulario del rubro', () => {
    const textos = pasosIniciales(vacio, { plural: 'canchas' }).map((p) => p.texto);
    expect(textos).toContain('Cargá tus canchas');
  });
});
