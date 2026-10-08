import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type ResultadoTelefono = { ok: true; e164: string } | { ok: false; error: string };

const ERROR = 'Revisá el teléfono: no parece un número válido.';

/**
 * Normaliza a E.164. País por defecto: Argentina. Los celulares argentinos se guardan siempre
 * con el 9 (+549...), tanto si el cliente lo escribió como si no, para que el mismo número
 * escrito de distintas formas sea un solo cliente.
 */
export function normalizarTelefono(entrada: string): ResultadoTelefono {
  const limpio = entrada.trim();
  if (!limpio) return { ok: false, error: ERROR };
  const numero = parsePhoneNumberFromString(limpio, 'AR');
  if (!numero || !numero.isValid()) return { ok: false, error: ERROR };
  let e164 = numero.number;
  if (e164.startsWith('+54') && !e164.startsWith('+549')) e164 = `+549${e164.slice(3)}`;
  return { ok: true, e164 };
}

/** Diferencia de a lo sumo un dígito (misma longitud) o mismos últimos 8 dígitos. */
export function posibleDuplicado(a: string, b: string): boolean {
  if (a === b) return false;
  const da = a.replace(/\D/g, '');
  const db = b.replace(/\D/g, '');
  if (da === db) return false;
  if (da.slice(-8) === db.slice(-8)) return true;
  if (da.length !== db.length) return false;
  let diferencias = 0;
  for (let i = 0; i < da.length; i++) if (da[i] !== db[i] && ++diferencias > 1) return false;
  return diferencias === 1;
}
