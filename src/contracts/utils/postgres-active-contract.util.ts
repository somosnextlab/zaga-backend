/**
 * Índice único parcial en `case_contracts`: como máximo un registro activo
 * (`CREATED` / `SIGN_PENDING`) por `case_id`.
 */
export const UQ_CASE_CONTRACTS_ONE_ACTIVE_PER_CASE =
  'uq_case_contracts_one_active_per_case' as const;

export function isActiveCaseContractUniqueViolation(error: unknown): boolean {
  if (error === null || typeof error !== 'object') return false;
  const { code, constraint } = error as {
    readonly code?: string;
    readonly constraint?: string;
  };
  if (code !== '23505') return false;
  if (constraint === UQ_CASE_CONTRACTS_ONE_ACTIVE_PER_CASE) return true;
  return constraint === undefined || constraint === null;
}
