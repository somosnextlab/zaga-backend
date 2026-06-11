/**
 * Conversión número → palabras en español (es-AR), pensada para montos de
 * contrato. Soporta enteros de 0 hasta el orden de los billones, suficiente
 * para cualquier capital prestado.
 *
 * `numberToSpanishWords` devuelve solo las palabras del número
 * (p. ej. 300000 -> "trescientos mil"); el texto legal de los contratos ya
 * antepone la palabra "pesos", por lo que el tag se completa con esta forma.
 * `pesosAmountToWords` agrega el sufijo "pesos" para usos donde se necesite la
 * frase completa.
 */

const UNIDADES = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];

const DECENAS = [
  '',
  '',
  '',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];

const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

/** 0..999 -> palabras. `apocope` usa "un" en vez de "uno" (para "un mil"/"un millón"). */
function threeDigitsToWords(n: number, apocope: boolean): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';

  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  const parts: string[] = [];
  if (hundreds > 0) parts.push(CENTENAS[hundreds]);

  if (rest > 0) {
    if (rest < 30) {
      let word = UNIDADES[rest];
      if (apocope && rest === 1) word = 'un';
      else if (apocope && rest === 21) word = 'veintiún';
      parts.push(word);
    } else {
      const tens = Math.floor(rest / 10);
      const units = rest % 10;
      if (units === 0) {
        parts.push(DECENAS[tens]);
      } else {
        const unitWord = units === 1 && apocope ? 'un' : UNIDADES[units];
        parts.push(`${DECENAS[tens]} y ${unitWord}`);
      }
    }
  }

  return parts.join(' ');
}

const SCALES: ReadonlyArray<{
  readonly value: number;
  readonly singular: string;
  readonly plural: string;
}> = [
  { value: 1_000_000_000_000, singular: 'billón', plural: 'billones' },
  { value: 1_000_000, singular: 'millón', plural: 'millones' },
  { value: 1_000, singular: 'mil', plural: 'mil' },
];

export function numberToSpanishWords(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error('numberToSpanishWords: monto no finito');
  }

  let n = Math.floor(Math.abs(amount));
  if (n === 0) return 'cero';

  const segments: string[] = [];

  for (const scale of SCALES) {
    if (n >= scale.value) {
      const count = Math.floor(n / scale.value);
      n %= scale.value;

      if (scale.singular === 'mil') {
        // "mil", "dos mil", "veintiún mil"… (sin "un" delante de "mil").
        const prefix = count === 1 ? '' : threeDigitsToWords(count, true);
        segments.push(prefix ? `${prefix} mil` : 'mil');
      } else {
        const prefix = threeDigitsToWords(count, true);
        const noun = count === 1 ? scale.singular : scale.plural;
        segments.push(`${prefix} ${noun}`.trim());
      }
    }
  }

  if (n > 0) {
    segments.push(threeDigitsToWords(n, false));
  }

  return segments.join(' ').replace(/\s+/g, ' ').trim();
}

export function pesosAmountToWords(amount: number): string {
  return `${numberToSpanishWords(amount)} pesos`;
}
