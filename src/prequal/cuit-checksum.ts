import { CUIT_DIGITS_LENGTH } from './prequal.constants';

const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export function normalizeCuit(cuit: string): string | null {
  const digits = cuit.replace(/\D/g, '');
  return digits.length === CUIT_DIGITS_LENGTH ? digits : null;
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
