import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { OfferEngineService } from './offer-engine.service';

const VALID_CASE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('OfferEngineService', () => {
  let service: OfferEngineService;

  const mockDbService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockClient = {
      query: jest.fn(),
    };
    mockDbService.withTransaction.mockImplementation(
      async (fn: (client: PoolClient) => Promise<unknown>) => {
        return fn(mockClient as unknown as PoolClient);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OfferEngineService,
        { provide: DbService, useValue: mockDbService },
      ],
    }).compile();

    service = module.get<OfferEngineService>(OfferEngineService);
  });

  describe('computePeriodRate', () => {
    it('debe calcular periodRate correctamente: TNA 210 => 2.10/52', () => {
      const rate = service.computePeriodRate(210);
      expect(rate).toBeCloseTo(2.1 / 52, 10);
    });

    it('debe calcular periodRate para TNA 170', () => {
      const rate = service.computePeriodRate(170);
      expect(rate).toBeCloseTo(1.7 / 52, 10);
    });

    it('debe devolver 0 para TNA 0', () => {
      const rate = service.computePeriodRate(0);
      expect(rate).toBe(0);
    });
  });

  describe('createCaseOffer - validaciones', () => {
    it('debe lanzar NotFoundException cuando el case no existe', async () => {
      const mockClient = { query: jest.fn() };
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      await expect(
        service.createCaseOffer({
          case_id: VALID_CASE_ID,
          monto_pre_aprobado: 500000,
          tasa_nominal_anual: 210,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, status FROM cases'),
        [VALID_CASE_ID],
      );
    });

    it('debe lanzar BadRequestException cuando el case no está en WAITING_CEO', async () => {
      const mockClient = { query: jest.fn() };
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: VALID_CASE_ID, status: 'OFFER_SENT' }],
        })
        .mockResolvedValue({ rows: [] });

      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      await expect(
        service.createCaseOffer({
          case_id: VALID_CASE_ID,
          monto_pre_aprobado: 500000,
          tasa_nominal_anual: 210,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, status FROM cases'),
        [VALID_CASE_ID],
      );
    });
  });

  describe('createCaseOffer - cálculo y versionado', () => {
    const setupSuccessMocks = (mockClient: { query: jest.Mock }) => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: VALID_CASE_ID, status: 'WAITING_CEO' }],
        })
        .mockResolvedValueOnce({ rows: [{ max_version: 2 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'offer-uuid-123',
              case_id: VALID_CASE_ID,
              version: 3,
              amount: 500000,
              installments: 12,
              status: 'SENT',
              payment_periodicity: 'SEMANAL',
              payment_amount: 52000,
              tasa_nominal_anual: 210,
              costo_financiero_final_operacion: 124000,
              tea: 7.5,
              cftna: 2.54,
              cftea: 9.08,
              total_interest: 102479,
              total_vat: 21520,
              total_payable: 623999,
              cfto_amount: 123999,
              cfto_percent: 0.248,
              pricing_engine_version: 'ZagaTasas_v1',
            },
          ],
        })
        .mockResolvedValue({ rows: [] });
    };

    it('debe crear 12 cuotas en el schedule', async () => {
      const mockClient = { query: jest.fn() };
      setupSuccessMocks(mockClient);

      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      const result = await service.createCaseOffer({
        case_id: VALID_CASE_ID,
        monto_pre_aprobado: 500000,
        tasa_nominal_anual: 210,
      });

      expect(result.ok).toBe(true);
      expect(result.offer.schedule).toHaveLength(12);
      expect(result.offer.schedule[0].installment_number).toBe(1);
      expect(result.offer.schedule[11].installment_number).toBe(12);
    });

    it('debe devolver TEA, CFTNA, CFTEA calculadas', async () => {
      const mockClient = { query: jest.fn() };
      setupSuccessMocks(mockClient);

      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      const result = await service.createCaseOffer({
        case_id: VALID_CASE_ID,
        monto_pre_aprobado: 500000,
        tasa_nominal_anual: 210,
      });

      expect(result.ok).toBe(true);
      expect(result.offer.tea).toBeDefined();
      expect(result.offer.cftna).toBeDefined();
      expect(result.offer.cftea).toBeDefined();
      expect(typeof result.offer.tea).toBe('number');
      expect(typeof result.offer.cftna).toBe('number');
      expect(typeof result.offer.cftea).toBe('number');
    });

    it('debe superseder ofertas previas SENT/DRAFT', async () => {
      const mockClient = { query: jest.fn() };
      setupSuccessMocks(mockClient);

      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      await service.createCaseOffer({
        case_id: VALID_CASE_ID,
        monto_pre_aprobado: 500000,
        tasa_nominal_anual: 210,
      });

      const updateSupersedeCall = mockClient.query.mock.calls.find(
        (call: [string]) =>
          typeof call[0] === 'string' &&
          call[0].includes("status = 'SUPERSEDED'") &&
          call[0].includes("status IN ('SENT', 'DRAFT')"),
      );
      expect(updateSupersedeCall).toBeDefined();
    });

    it('debe devolver version = max_version + 1', async () => {
      const mockClient = { query: jest.fn() };
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: VALID_CASE_ID, status: 'WAITING_CEO' }],
        })
        .mockResolvedValueOnce({ rows: [{ max_version: 5 }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'offer-uuid-456',
              case_id: VALID_CASE_ID,
              version: 6,
              amount: 500000,
              installments: 12,
              status: 'SENT',
              payment_periodicity: 'SEMANAL',
              payment_amount: 52000,
              tasa_nominal_anual: 210,
              costo_financiero_final_operacion: 124000,
              tea: 7.5,
              cftna: 2.54,
              cftea: 9.08,
              total_interest: 102479,
              total_vat: 21520,
              total_payable: 623999,
              cfto_amount: 123999,
              cfto_percent: 0.248,
              pricing_engine_version: 'ZagaTasas_v1',
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      const result = await service.createCaseOffer({
        case_id: VALID_CASE_ID,
        monto_pre_aprobado: 500000,
        tasa_nominal_anual: 210,
      });

      expect(result.ok).toBe(true);
      expect(result.offer.version).toBe(6);

      const insertCall = mockClient.query.mock.calls.find(
        (call: [string]) =>
          typeof call[0] === 'string' && call[0].includes('INSERT INTO case_offers'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1]).toContain(6);
    });

    it('debe incluir requires_guarantor en el payload', async () => {
      const mockClient = { query: jest.fn() };
      setupSuccessMocks(mockClient);

      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      const result = await service.createCaseOffer({
        case_id: VALID_CASE_ID,
        monto_pre_aprobado: 500000,
        tasa_nominal_anual: 210,
        requires_guarantor: true,
      });

      expect(result.ok).toBe(true);
      expect(result.offer.requires_guarantor).toBe(true);
    });
  });

  describe('createCaseOffer - schedule consistencia', () => {
    it('debe que total amortization cierre contra principal', async () => {
      const mockClient = { query: jest.fn() };
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: VALID_CASE_ID, status: 'WAITING_CEO' }],
        })
        .mockResolvedValueOnce({ rows: [{ max_version: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'offer-uuid',
              case_id: VALID_CASE_ID,
              version: 1,
              amount: 100000,
              installments: 12,
              status: 'SENT',
              payment_periodicity: 'SEMANAL',
              payment_amount: 9500,
              tasa_nominal_anual: 210,
              costo_financiero_final_operacion: 14000,
              tea: 7.5,
              cftna: 2.54,
              cftea: 9.08,
              total_interest: 20479,
              total_vat: 4300,
              total_payable: 123779,
              cfto_amount: 23779,
              cfto_percent: 0.238,
              pricing_engine_version: 'ZagaTasas_v1',
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      const principal = 100000;
      const result = await service.createCaseOffer({
        case_id: VALID_CASE_ID,
        monto_pre_aprobado: principal,
        tasa_nominal_anual: 210,
      });

      const totalAmortization = result.offer.schedule.reduce(
        (sum, s) => sum + s.amortization,
        0,
      );
      expect(Math.abs(totalAmortization - principal)).toBeLessThan(0.02);
    });

    it('debe que cada item del schedule tenga los campos requeridos', async () => {
      const mockClient = { query: jest.fn() };
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ id: VALID_CASE_ID, status: 'WAITING_CEO' }],
        })
        .mockResolvedValueOnce({ rows: [{ max_version: null }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'offer-uuid',
              case_id: VALID_CASE_ID,
              version: 1,
              amount: 100000,
              installments: 12,
              status: 'SENT',
              payment_periodicity: 'SEMANAL',
              payment_amount: 9500,
              tasa_nominal_anual: 210,
              costo_financiero_final_operacion: 14000,
              tea: 7.5,
              cftna: 2.54,
              cftea: 9.08,
              total_interest: 20479,
              total_vat: 4300,
              total_payable: 123779,
              cfto_amount: 23779,
              cfto_percent: 0.238,
              pricing_engine_version: 'ZagaTasas_v1',
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      mockDbService.withTransaction.mockImplementation(
        async (fn: (client: PoolClient) => Promise<unknown>) =>
          fn(mockClient as unknown as PoolClient),
      );

      const result = await service.createCaseOffer({
        case_id: VALID_CASE_ID,
        monto_pre_aprobado: 100000,
        tasa_nominal_anual: 210,
      });

      const requiredFields = [
        'installment_number',
        'opening_balance',
        'interest',
        'vat',
        'amortization',
        'base_installment',
        'gross_installment',
        'closing_balance',
        'due_date',
      ];

      for (const item of result.offer.schedule) {
        for (const field of requiredFields) {
          expect(item).toHaveProperty(field);
        }
      }
    });
  });
});
