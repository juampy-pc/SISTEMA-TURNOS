import { DIAS } from './horarios';

export interface RecursoConsultado {
  nombre: string;
  haceServicio: boolean;
  atiendeEseDia: boolean;
  bloqueado: boolean;
}

export interface ContextoSinHorarios {
  fecha: string;
  hoy: string;
  maxFecha: string;
  anticipacionMaxDias: number;
  servicio: string;
  /** Vocabulario del rubro, por ejemplo { singular: 'profesional', plural: 'profesionales' }. */
  recurso: { singular: string; plural: string };
  /** Un solo recurso elegido o todos ("cualquiera"). */
  elegido: RecursoConsultado | null;
  todos: RecursoConsultado[];
}

function mayuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Explica por qué no hay horarios libres, para que el dueño sepa qué corregir. */
export function motivoSinHorarios(c: ContextoSinHorarios): string {
  if (c.fecha < c.hoy) return 'Ese día ya pasó. Elegí otro día arriba.';
  if (c.fecha > c.maxFecha) {
    return `Solo se toman turnos hasta ${c.anticipacionMaxDias} días adelante. Lo cambiás en Configuración avanzada.`;
  }
  const nombreDia = DIAS.find((d) => d.n === new Date(`${c.fecha}T12:00:00Z`).getUTCDay())?.largo.toLowerCase() ?? 'día';
  const dia = nombreDia.endsWith('s') ? nombreDia : `${nombreDia}s`;
  const seccion = mayuscula(c.recurso.plural);
  const candidatos = c.elegido ? [c.elegido] : c.todos;

  const hacen = candidatos.filter((r) => r.haceServicio);
  if (hacen.length === 0) {
    return c.elegido
      ? `${c.elegido.nombre} no tiene asignado "${c.servicio}". Asignáselo en ${seccion}.`
      : `Ningún ${c.recurso.singular} tiene asignado "${c.servicio}". Asignalo en ${seccion}.`;
  }
  const libres = hacen.filter((r) => !r.bloqueado);
  if (libres.length === 0) return 'Hay un bloqueo cargado para ese día. Lo ves en Horarios.';
  if (!libres.some((r) => r.atiendeEseDia)) {
    return c.elegido
      ? `${c.elegido.nombre} no atiende los ${dia}. Cargá sus horarios en Horarios.`
      : `Nadie que haga "${c.servicio}" atiende los ${dia}. Cargá los horarios en Horarios.`;
  }
  if (c.fecha === c.hoy) {
    return 'Los horarios que quedaban hoy ya pasaron o están dentro de la anticipación mínima. Probá con otro día.';
  }
  return 'Todos los horarios de ese día están ocupados (o el servicio dura más que la franja de atención). Probá con otro día.';
}
