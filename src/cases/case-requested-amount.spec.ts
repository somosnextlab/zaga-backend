import { BadRequestException } from '@nestjs/common';
import {
  ALLOWED_REQUESTED_AMOUNTS,
  assertValidRequestedAmount,
  isAllowedRequestedAmount,
} from './case-requested-amount';

describe('case-requested-amount', () => {
  it('isAllowedRequestedAmount debe aceptar solo los cinco montos oficiales', () => {
    for (const amount of ALLOWED_REQUESTED_AMOUNTS) {
      expect(isAllowedRequestedAmount(amount)).toBe(true);
    }
    expect(isAllowedRequestedAmount(150000)).toBe(false);
    expect(isAllowedRequestedAmount(99_999)).toBe(false);
    expect(isAllowedRequestedAmount(500_001)).toBe(false);
  });

  it('assertValidRequestedAmount debe lanzar BadRequestException con INVALID_REQUESTED_AMOUNT', () => {
    expect(() => assertValidRequestedAmount(150000)).toThrow(
      BadRequestException,
    );
    try {
      assertValidRequestedAmount(150000);
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).message).toBe(
        'INVALID_REQUESTED_AMOUNT',
      );
    }
  });

  it('assertValidRequestedAmount no debe lanzar para montos permitidos', () => {
    expect(() => assertValidRequestedAmount(300000)).not.toThrow();
  });
});
