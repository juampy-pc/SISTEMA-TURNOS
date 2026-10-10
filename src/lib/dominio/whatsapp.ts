/** Link de wa.me a un número E.164 con un mensaje precargado; null si el negocio no cargó WhatsApp. */
export function linkWhatsapp(e164: string, mensaje: string): string | null {
  const digitos = e164.replace(/\D/g, '');
  if (!digitos) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}
