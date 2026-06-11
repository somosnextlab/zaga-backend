/// <reference types="jest" />

import { numberToSpanishWords, pesosAmountToWords } from './number-to-words';

describe('numberToSpanishWords', () => {
  it.each<[number, string]>([
    [0, 'cero'],
    [1, 'uno'],
    [15, 'quince'],
    [21, 'veintiuno'],
    [31, 'treinta y uno'],
    [100, 'cien'],
    [101, 'ciento uno'],
    [200, 'doscientos'],
    [500, 'quinientos'],
    [1000, 'mil'],
    [2000, 'dos mil'],
    [21000, 'veintiún mil'],
    [100000, 'cien mil'],
    [300000, 'trescientos mil'],
    [1000000, 'un millón'],
    [2500000, 'dos millones quinientos mil'],
  ])('convierte %s -> "%s"', (input, expected) => {
    expect(numberToSpanishWords(input)).toBe(expected);
  });

  it('redondea hacia abajo la parte decimal', () => {
    expect(numberToSpanishWords(300000.99)).toBe('trescientos mil');
  });

  it('pesosAmountToWords agrega el sufijo "pesos"', () => {
    expect(pesosAmountToWords(300000)).toBe('trescientos mil pesos');
  });
});
