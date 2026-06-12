import { deriveDniFromCuit } from './cuit-checksum';

describe('deriveDniFromCuit', () => {
  it('extrae el DNI de un CUIT válido de 11 dígitos', () => {
    expect(deriveDniFromCuit('20123456786')).toBe('12345678');
  });

  it('tolera CUIT con separadores', () => {
    expect(deriveDniFromCuit('20-12345678-6')).toBe('12345678');
  });

  it('elimina ceros a la izquierda del DNI', () => {
    // slice(2,10) de '20001234567' = '00123456' -> '123456'
    expect(deriveDniFromCuit('20001234567')).toBe('123456');
  });

  it('devuelve null si no tiene 11 dígitos', () => {
    expect(deriveDniFromCuit('12345678')).toBeNull();
    expect(deriveDniFromCuit('')).toBeNull();
    expect(deriveDniFromCuit('2012345678')).toBeNull();
  });
});
