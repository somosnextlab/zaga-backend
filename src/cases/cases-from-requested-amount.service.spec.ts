import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { LeadStage } from '../lead-stage.enum';
import { CasesFromRequestedAmountService } from './cases-from-requested-amount.service';

const PHONE = '+5493516639755';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const CASE_ID = '660e8400-e29b-41d4-a716-446655440001';
const LEAD_ID = '770e8400-e29b-41d4-a716-446655440002';

type MockQueryCall = readonly [string, readonly unknown[] | undefined];

describe('CasesFromRequestedAmountService', () => {
  let service: CasesFromRequestedAmountService;

  const mockClient = {
    query: jest.fn(),
  };

  const mockDbService = {
    withTransaction: jest.fn(
      async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CasesFromRequestedAmountService,
        { provide: DbService, useValue: mockDbService },
      ],
    }).compile();

    service = module.get(CasesFromRequestedAmountService);
  });

  function stubHappyPathAutoOk(): void {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads')) {
        return Promise.resolve({
          rows: [
            {
              id: LEAD_ID,
              phone: PHONE,
              stage: LeadStage.WAITING_REQUESTED_AMOUNT,
              current_case_id: null,
              manual_review_reason: null,
            },
          ],
        });
      }
      if (sql.includes('FROM users')) {
        return Promise.resolve({
          rows: [
            {
              id: USER_ID,
              phone: PHONE,
              is_completed: true,
              first_name: 'Juan',
              last_name: 'Pérez',
              cuit: '20123456789',
            },
          ],
        });
      }
      if (sql.includes('INSERT INTO cases')) {
        return Promise.resolve({
          rows: [
            {
              id: CASE_ID,
              phone: PHONE,
              user_id: USER_ID,
              status: 'WAITING_CEO',
              requested_amount: 300000,
              prequal_mode: 'AUTO_OK',
              manual_review_reason: null,
            },
          ],
        });
      }
      if (sql.includes('UPDATE leads')) {
        return Promise.resolve({
          rows: [
            {
              phone: PHONE,
              stage: LeadStage.WAITING_CEO,
              current_case_id: CASE_ID,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  it('happy path AUTO_OK: crea CASE, actualiza lead, ok true', async () => {
    stubHappyPathAutoOk();

    const result = await service.createFromRequestedAmount({
      phone: PHONE,
      requested_amount: 300000,
    });

    expect(result).toEqual({
      ok: true,
      case_id: CASE_ID,
      phone: PHONE,
      user_id: USER_ID,
      requested_amount: 300000,
      case_status: 'WAITING_CEO',
      lead_stage: 'WAITING_CEO',
      prequal_mode: 'AUTO_OK',
      manual_review_reason: null,
    });

    const calls = mockClient.query.mock.calls as MockQueryCall[];
    const insertCall = calls.find(([q]) => q.includes('INSERT INTO cases'));
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]).toEqual([USER_ID, PHONE, 300000, 'AUTO_OK', null]);
  });

  it('happy path MANUAL_REVIEW: persiste manual_review_reason en CASE y limpia lead', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads')) {
        return Promise.resolve({
          rows: [
            {
              id: LEAD_ID,
              phone: PHONE,
              stage: LeadStage.WAITING_REQUESTED_AMOUNT_MANUAL_REVIEW,
              current_case_id: null,
              manual_review_reason: 'BCRA_NO_DATA',
            },
          ],
        });
      }
      if (sql.includes('FROM users')) {
        return Promise.resolve({
          rows: [
            {
              id: USER_ID,
              phone: PHONE,
              is_completed: true,
              first_name: 'Juan',
              last_name: 'Pérez',
              cuit: '20123456789',
            },
          ],
        });
      }
      if (sql.includes('INSERT INTO cases')) {
        return Promise.resolve({
          rows: [
            {
              id: CASE_ID,
              phone: PHONE,
              user_id: USER_ID,
              status: 'WAITING_CEO',
              requested_amount: 100000,
              prequal_mode: 'MANUAL_REVIEW',
              manual_review_reason: 'BCRA_NO_DATA',
            },
          ],
        });
      }
      if (sql.includes('UPDATE leads')) {
        return Promise.resolve({
          rows: [
            {
              phone: PHONE,
              stage: LeadStage.WAITING_CEO,
              current_case_id: CASE_ID,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.createFromRequestedAmount({
      phone: PHONE,
      requested_amount: 100000,
    });

    expect(result).toMatchObject({
      ok: true,
      prequal_mode: 'MANUAL_REVIEW',
      manual_review_reason: 'BCRA_NO_DATA',
    });

    const calls = mockClient.query.mock.calls as MockQueryCall[];
    const insertCall = calls.find(([q]) => q.includes('INSERT INTO cases'));
    expect(insertCall?.[1]).toEqual([
      USER_ID,
      PHONE,
      100000,
      'MANUAL_REVIEW',
      'BCRA_NO_DATA',
    ]);

    const updateCall = calls.find(([q]) => q.includes('UPDATE leads'));
    expect(updateCall?.[1]).toEqual([PHONE, LeadStage.WAITING_CEO, CASE_ID]);
  });

  it('requested_amount inválido: INVALID_REQUESTED_AMOUNT', async () => {
    await expect(
      service.createFromRequestedAmount({
        phone: PHONE,
        requested_amount: 150000,
      } as { phone: string; requested_amount: number }),
    ).rejects.toThrow(BadRequestException);

    expect(mockDbService.withTransaction).not.toHaveBeenCalled();
  });

  it('lead inexistente: LEAD_NOT_FOUND', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.createFromRequestedAmount({
      phone: PHONE,
      requested_amount: 200000,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: 'LEAD_NOT_FOUND',
    });
  });

  it('user inexistente: USER_NOT_FOUND', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads')) {
        return Promise.resolve({
          rows: [
            {
              id: LEAD_ID,
              phone: PHONE,
              stage: LeadStage.WAITING_REQUESTED_AMOUNT,
              current_case_id: null,
              manual_review_reason: null,
            },
          ],
        });
      }
      if (sql.includes('FROM users')) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.createFromRequestedAmount({
      phone: PHONE,
      requested_amount: 200000,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: 'USER_NOT_FOUND',
    });
  });

  it('user no completo: USER_NOT_COMPLETED', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads')) {
        return Promise.resolve({
          rows: [
            {
              id: LEAD_ID,
              phone: PHONE,
              stage: LeadStage.WAITING_REQUESTED_AMOUNT,
              current_case_id: null,
              manual_review_reason: null,
            },
          ],
        });
      }
      if (sql.includes('FROM users')) {
        return Promise.resolve({
          rows: [
            {
              id: USER_ID,
              phone: PHONE,
              is_completed: false,
              first_name: 'Juan',
              last_name: 'Pérez',
              cuit: '20123456789',
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.createFromRequestedAmount({
      phone: PHONE,
      requested_amount: 200000,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: 'USER_NOT_COMPLETED',
    });
  });

  it('stage inválido: INVALID_LEAD_STAGE_FOR_CASE_CREATION', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads')) {
        return Promise.resolve({
          rows: [
            {
              id: LEAD_ID,
              phone: PHONE,
              stage: LeadStage.NEED_DATA,
              current_case_id: null,
              manual_review_reason: null,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.createFromRequestedAmount({
      phone: PHONE,
      requested_amount: 200000,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: 'INVALID_LEAD_STAGE_FOR_CASE_CREATION',
    });
  });

  it('current_case_id existente: ACTIVE_CASE_ALREADY_EXISTS', async () => {
    mockClient.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM leads')) {
        return Promise.resolve({
          rows: [
            {
              id: LEAD_ID,
              phone: PHONE,
              stage: LeadStage.WAITING_REQUESTED_AMOUNT,
              current_case_id: 'aa0e8400-e29b-41d4-a716-446655440099',
              manual_review_reason: null,
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const result = await service.createFromRequestedAmount({
      phone: PHONE,
      requested_amount: 200000,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: 'ACTIVE_CASE_ALREADY_EXISTS',
    });
  });
});
