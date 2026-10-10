import { describe, expect, it } from 'vitest';
import { linkWhatsapp } from './whatsapp';

describe('linkWhatsapp', () => {
  it('arma el link con solo dígitos y el mensaje codificado', () => {
    expect(linkWhatsapp('+5491144445555', 'Hola, pedí un turno')).toBe(
      'https://wa.me/5491144445555?text=Hola%2C%20ped%C3%AD%20un%20turno',
    );
  });

  it('sin número no hay link', () => {
    expect(linkWhatsapp('', 'Hola')).toBeNull();
  });
});
