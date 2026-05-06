import { BadRequestException } from '@nestjs/common';

export const ALLOWED_REQUESTED_AMOUNTS = [
  100000, 200000, 300000, 400000, 500000,
] as const;

export type AllowedRequestedAmount = (typeof ALLOWED_REQUESTED_AMOUNTS)[number];

const allowedSet = new Set<number>(ALLOWED_REQUESTED_AMOUNTS);

export function isAllowedRequestedAmount(value: number): boolean {
  return allowedSet.has(value);
}

/**
 * Valida `cases.requested_amount` contra los montos discretos permitidos.
 * Usar en creación/actualización de CASE; la DB también aplica CHECK.
 */
export function assertValidRequestedAmount(value: number): void {
  if (!allowedSet.has(value)) {
    throw new BadRequestException('INVALID_REQUESTED_AMOUNT');
  }
}
