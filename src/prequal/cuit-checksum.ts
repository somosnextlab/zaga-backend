import { CUIT_DIGITS_LENGTH } from './prequal.constants';

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export function normalizeCuit(cuit: string): string | null {
  const digits = cuit.replace(/\D/g, '');
  return digits.length === CUIT_DIGITS_LENGTH ? digits : null;
}

// CUIT (11 díg) = tipo(2) + DNI(8) + verificador(1). DNI = dígitos 3 a 10.
export function deriveDniFromCuit(cuit: string): string | null {
  const d = (cuit ?? '').replace(/\D/g, '');
  if (d.length !== 11) return null;
  return d.slice(2, 10).replace(/^0+/, '') || null; // sin ceros a la izquierda
}

export function isValidCuitChecksum(normalizedCuit: string): boolean {
  if (!/^\d{11}$/.test(normalizedCuit)) {
    return false;
  }

  const baseDigits = normalizedCuit.slice(0, 10);
  const verifierDigit = Number(normalizedCuit[10]);

  let sum = 0;
  for (let i = 0; i < CUIT_WEIGHTS.length; i++) {
    const digit = Number(baseDigits[i]);
    sum += digit * CUIT_WEIGHTS[i];
  }

  const mod = sum % 11;
  const computed = mod === 0 ? 0 : mod === 1 ? 9 : 11 - mod;
  return computed === verifierDigit;
}
