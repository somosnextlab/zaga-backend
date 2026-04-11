import {
  isActiveCaseContractUniqueViolation,
  UQ_CASE_CONTRACTS_ONE_ACTIVE_PER_CASE,
} from './postgres-active-contract.util';

describe('isActiveCaseContractUniqueViolation', () => {
  it('detecta 23505 con constraint del índice activo', () => {
    const err = Object.assign(new Error('dup'), {
      code: '23505',
      constraint: UQ_CASE_CONTRACTS_ONE_ACTIVE_PER_CASE,
    });
    expect(isActiveCaseContractUniqueViolation(err)).toBe(true);
  });

  it('detecta 23505 sin constraint (fallback)', () => {
    const err = Object.assign(new Error('dup'), { code: '23505' });
    expect(isActiveCaseContractUniqueViolation(err)).toBe(true);
  });

  it('ignora otro constraint con 23505', () => {
    const err = Object.assign(new Error('dup'), {
      code: '23505',
      constraint: 'otro_indice',
    });
    expect(isActiveCaseContractUniqueViolation(err)).toBe(false);
  });

  it('ignora errores sin código 23505', () => {
    expect(isActiveCaseContractUniqueViolation(new Error('x'))).toBe(false);
    expect(isActiveCaseContractUniqueViolation(null)).toBe(false);
  });
});
