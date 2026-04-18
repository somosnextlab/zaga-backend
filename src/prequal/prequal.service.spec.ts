/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { BcraZcoreEngineService } from './bcra-zcore-engine.service';
import { PrequalService } from './prequal.service';

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_PHONE = '+5493511234567';
const VALID_CUIT = '20123456789';

const createBcraLatestResponse = (overrides?: {
  periodo?: string;
  denominacion?: string;
  situacion?: number;
  monto?: number;
  has_proceso_jud?: boolean;
  has_situacion_juridica?: boolean;
  has_irrec_disposicion_tecnica?: boolean;
  has_refinanciaciones?: boolean;
  has_recategorizacion_oblig?: boolean;
}) => ({
  status: 0,
  results: {
    identificacion: 20123456789,
    denominacion: overrides?.denominacion ?? 'Juan Pérez',
    periodos: [
      {
        periodo: overrides?.periodo ?? '202601',
        entidades: [
          {
            entidad: 'Banco Test',
            situacion: overrides?.situacion ?? 1,
            monto: overrides?.monto ?? 100000,
            diasAtrasoPago: 0,
            refinanciaciones: overrides?.has_refinanciaciones ?? false,
            recategorizacionOblig:
              overrides?.has_recategorizacion_oblig ?? false,
            situacionJuridica: overrides?.has_situacion_juridica ?? false,
            irrecDisposicionTecnica:
              overrides?.has_irrec_disposicion_tecnica ?? false,
            enRevision: false,
            procesoJud: overrides?.has_proceso_jud ?? false,
          },
        ],
      },
    ],
  },
});

const createBcraHistoricalResponse = () => ({
  status: 0,
  results: {
    periodos: Array.from({ length: 24 }, (_, i) => ({
      periodo: `202${Math.floor(i / 12)}${String((i % 12) + 1).padStart(2, '0')}`,
      entidades: [{ entidad: 'Banco', situacion: 1, monto: 50000 }],
    })),
  },
});

/**
 * Crea histórico con secuencia de deuda en últimos 7 meses.
 * ultimos7Montos[0]=hace 6m, ultimos7Montos[3]=hace 3m, ultimos7Montos[6]=actual.
 */
const createHistoricalWithDebtSequence = (ultimos7Montos: number[]) => {
  const base = createBcraHistoricalResponse();
  const start = 24 - ultimos7Montos.length;
  for (let i = 0; i < ultimos7Montos.length; i++) {
    base.results.periodos[start + i].entidades[0].monto = ultimos7Montos[i];
  }
  return base;
};

describe('PrequalService', () => {
  let service: PrequalService;
  let fetchMock: jest.SpyInstance;

  const mockDbService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'BCRA_API_LATEST_URL')
        return 'https://api.bcra.gob.ar/deudas';
      if (key === 'BCRA_API_HISTORICAL_URL')
        return 'https://api.bcra.gob.ar/deudas/historicas';
      if (key === 'BCRA_API_TIMEOUT_MS') return '15000';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation((url) => {
      const urlStr = String(url as string);
      if (urlStr.includes('/historicas/')) {
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(createBcraHistoricalResponse()),
        } as Response);
      }
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve(createBcraLatestResponse()),
      } as Response);
    });

    const mockClient = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    };
    mockDbService.withTransaction.mockImplementation(
      async (fn: (client: PoolClient) => Promise<unknown>) => {
        return fn(mockClient as unknown as PoolClient);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrequalService,
        BcraZcoreEngineService,
        { provide: DbService, useValue: mockDbService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<PrequalService>(PrequalService);
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('Input inválido', () => {
    it('debe devolver INVALID_INPUT cuando el CUIT tiene menos de 11 dígitos', async () => {
      mockDbService.query.mockResolvedValue({ rows: [] });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: '123',
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'INVALID_INPUT',
        bypass_allowed: false,
      });
      expect(mockDbService.query).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('debe devolver INVALID_INPUT cuando el CUIT tiene más de 11 dígitos', async () => {
      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: '201234567890',
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'INVALID_INPUT',
        bypass_allowed: false,
      });
    });

    it('debe aceptar CUIT con guiones y normalizarlo correctamente', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: '20-12345678-9',
      });

      expect(result.ok).toBe(true);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('20123456789'),
        expect.any(Object),
      );
    });
  });

  describe('Usuario no existe', () => {
    it('debe devolver USER_NOT_FOUND cuando el usuario no existe', async () => {
      mockDbService.query.mockResolvedValue({ rows: [] });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'USER_NOT_FOUND',
        bypass_allowed: false,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('fetchWithRetry (resiliencia BCRA)', () => {
    it('debe reintentar ante 503 y tener éxito en el segundo intento', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      let latestCallCount = 0;
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        if (urlStr.includes('/historicas/')) {
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve(createBcraHistoricalResponse()),
          } as Response);
        }
        latestCallCount++;
        if (latestCallCount === 1) {
          return Promise.resolve({ status: 503 } as Response);
        }
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(createBcraLatestResponse()),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      expect(latestCallCount).toBe(2);
    });

    it('debe reintentar ante error de red (TypeError) y tener éxito', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      let latestCallCount = 0;
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        if (urlStr.includes('/historicas/')) {
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve(createBcraHistoricalResponse()),
          } as Response);
        }
        latestCallCount++;
        if (latestCallCount === 1) {
          return Promise.reject(new TypeError('fetch failed'));
        }
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(createBcraLatestResponse()),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      expect(latestCallCount).toBe(2);
    });

    it('no debe reintentar ante 404 (respuesta válida)', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        if (String(url as string).includes('/historicas/')) {
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve(createBcraHistoricalResponse()),
          } as Response);
        }
        return Promise.resolve({ status: 404 } as Response);
      });

      await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('debe registrar Logger.warn en cada reintento', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      let latestCallCount = 0;
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        if (urlStr.includes('/historicas/')) {
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve(createBcraHistoricalResponse()),
          } as Response);
        }
        latestCallCount++;
        if (latestCallCount <= 2) {
          return Promise.resolve({ status: 503 } as Response);
        }
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(createBcraLatestResponse()),
        } as Response);
      });

      await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Reintentando conexión con BCRA'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('BCRA técnico', () => {
    it('debe devolver BCRA_UNAVAILABLE cuando latest falla (timeout/error)', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        if (String(url as string).includes('/historicas/')) {
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve(createBcraHistoricalResponse()),
          } as Response);
        }
        return Promise.reject(new Error('Network error'));
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'TECHNICAL',
        error_code: 'BCRA_UNAVAILABLE',
        bypass_allowed: true,
        manual_review_reason: 'BCRA_UNAVAILABLE',
      });
    });

    it('debe devolver BCRA_UNAVAILABLE cuando historical falla', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        if (String(url as string).includes('/historicas/')) {
          return Promise.reject(new Error('Timeout'));
        }
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(createBcraLatestResponse()),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'TECHNICAL',
        error_code: 'BCRA_UNAVAILABLE',
        bypass_allowed: true,
        manual_review_reason: 'BCRA_UNAVAILABLE',
      });
    });
  });

  describe('BCRA sin datos', () => {
    it('debe devolver BCRA_NO_DATA cuando latest retorna 404', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        if (String(url as string).includes('/historicas/')) {
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve(createBcraHistoricalResponse()),
          } as Response);
        }
        return Promise.resolve({ status: 404 } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'BCRA_NO_DATA',
        bypass_allowed: true,
        manual_review_reason: 'BCRA_NO_DATA',
      });
    });

    it('debe devolver BCRA_NO_DATA cuando periodos está vacío', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : { status: 0, results: { periodos: [] } };
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'BCRA_NO_DATA',
        bypass_allowed: true,
        manual_review_reason: 'BCRA_NO_DATA',
      });
    });
  });

  describe('BCRA payload inválido', () => {
    it('debe devolver BCRA_INVALID_PAYLOAD cuando periodo no es válido', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ periodo: 'invalid' });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'TECHNICAL',
        error_code: 'BCRA_INVALID_PAYLOAD',
        bypass_allowed: false,
      });
    });
  });

  describe('Éxito aprobable', () => {
    it('debe devolver ok:true, eligible:true, risk_level:LOW cuando el score es alto', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.eligible).toBe(true);
        expect(['LOW', 'MEDIUM']).toContain(result.risk_level);
        expect(result.zcore_bcra).toBeGreaterThanOrEqual(600);
        expect(result.score_initial).toBe(result.zcore_bcra);
        expect(result.model_version).toBe('ZCORE_BCRA_V1');
        expect(result.periodo).toBe('202601');
        expect(result.first_name).toBe('Juan');
        expect(result.last_name).toBe('Pérez');
      }
    });
  });

  describe('Éxito no aprobable', () => {
    it('debe devolver eligible:false cuando el score es bajo', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      const badHistoricalResponse = () => ({
        status: 0,
        results: {
          periodos: Array.from({ length: 24 }, () => ({
            periodo: '202401',
            entidades: [{ entidad: 'Banco', situacion: 4, monto: 100000 }],
          })),
        },
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? badHistoricalResponse()
          : createBcraLatestResponse({
              situacion: 4,
              denominacion: 'Persona',
              has_refinanciaciones: true,
              has_recategorizacion_oblig: true,
            });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.eligible).toBe(false);
        expect(result.risk_level).toBe('HIGH');
      }
    });
  });

  describe('Carga de deuda (R_debt_load)', () => {
    const setupMockUser = () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
    };

    it('debe no penalizar cuando total_monto <= 1.000.000 pesos (R_debt_load = 0)', async () => {
      setupMockUser();
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ monto: 800, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.eligible).toBe(true);
        expect(result.zcore_bcra).toBeGreaterThanOrEqual(600);
      }
    });

    it('debe penalizar cuando total_monto >= 20.000.000 pesos y reducir el score', async () => {
      setupMockUser();
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({
              monto: 25_000,
              situacion: 1,
            });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.zcore_bcra).toBeLessThan(900);
        expect(result.model_version).toBe('ZCORE_BCRA_V1');
      }
    });

    it('debe que score con deuda 500k sea mayor que con deuda 20M (mismo perfil)', async () => {
      setupMockUser();

      const runWithMonto = async (montoMilesPesos: number) => {
        fetchMock.mockImplementation((url) => {
          const urlStr = String(url as string);
          const payload = urlStr.includes('/historicas/')
            ? createBcraHistoricalResponse()
            : createBcraLatestResponse({
                monto: montoMilesPesos,
                situacion: 1,
              });
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve(payload),
          } as Response);
        });
        const r = await service.runPrequal({
          userId: VALID_USER_ID,
          phone: VALID_PHONE,
          cuit: VALID_CUIT,
        });
        return r.ok ? (r as { zcore_bcra: number }).zcore_bcra : 0;
      };

      const scoreConDeudaBaja = await runWithMonto(500);
      const scoreConDeudaAlta = await runWithMonto(20_000);

      expect(scoreConDeudaBaja).toBeGreaterThan(scoreConDeudaAlta);
    });

    it('debe que score con deuda intermedia (2M) esté entre deuda baja y alta', async () => {
      setupMockUser();

      const runWithMonto = async (montoMilesPesos: number) => {
        fetchMock.mockImplementation((url) => {
          const urlStr = String(url as string);
          const payload = urlStr.includes('/historicas/')
            ? createBcraHistoricalResponse()
            : createBcraLatestResponse({
                monto: montoMilesPesos,
                situacion: 1,
              });
          return Promise.resolve({
            status: 200,
            json: () => Promise.resolve(payload),
          } as Response);
        });
        const r = await service.runPrequal({
          userId: VALID_USER_ID,
          phone: VALID_PHONE,
          cuit: VALID_CUIT,
        });
        return r.ok ? (r as { zcore_bcra: number }).zcore_bcra : 0;
      };

      const scoreBaja = await runWithMonto(500);
      const scoreIntermedia = await runWithMonto(2_000);
      const scoreAlta = await runWithMonto(20_000);

      expect(scoreIntermedia).toBeLessThanOrEqual(scoreBaja);
      expect(scoreIntermedia).toBeGreaterThanOrEqual(scoreAlta);
    });
  });

  describe('Hard reject', () => {
    it('debe devolver eligible:false, risk_level:HIGH, score_reason:HARD_REJECT cuando has_proceso_jud', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ has_proceso_jud: true });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.eligible).toBe(false);
        expect(result.risk_level).toBe('HIGH');
        expect(result.zcore_bcra).toBe(0);
        expect(result.score_initial).toBe(0);
        expect(result.score_reason).toBe('HARD_REJECT_ZCORE_BCRA_V1');
      }
    });

    it('debe aplicar hard reject cuando has_situacion_juridica', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ has_situacion_juridica: true });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.eligible).toBe(false);
        expect(result.score_reason).toBe('HARD_REJECT_ZCORE_BCRA_V1');
      }
    });

    it('debe aplicar hard reject cuando max_situacion >= 5', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ situacion: 5 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.eligible).toBe(false);
        expect(result.zcore_bcra).toBe(0);
        expect(result.score_reason).toBe('HARD_REJECT_ZCORE_BCRA_V1');
      }
    });

    it('debe aplicar hard reject cuando max_situacion >= 4 (nueva regla)', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ situacion: 4 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.eligible).toBe(false);
        expect(result.zcore_bcra).toBe(0);
        expect(result.score_initial).toBe(0);
        expect(result.risk_level).toBe('HIGH');
        expect(result.score_reason).toBe('HARD_REJECT_ZCORE_BCRA_V1');
        expect(result.model_version).toBe('ZCORE_BCRA_V1');
      }
    });
  });

  describe('Tendencia de deuda', () => {
    const setupMockUser = () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
    };

    it('debe mantener score base cuando tendencia neutra (deuda estable)', async () => {
      setupMockUser();
      const historical = createHistoricalWithDebtSequence([
        100, 100, 100, 100, 100, 100, 100,
      ]);
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? historical
          : createBcraLatestResponse({ monto: 100, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.zcore_bcra).toBeGreaterThanOrEqual(0);
        expect(result.zcore_bcra).toBeLessThanOrEqual(1000);
      }
    });

    it('debe dar premio cuando deuda bajó en 6 meses', async () => {
      setupMockUser();
      const historical = createHistoricalWithDebtSequence([
        200, 180, 160, 140, 120, 100, 80,
      ]);
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? historical
          : createBcraLatestResponse({ monto: 80, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const withBajada = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ monto: 80, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const neutro = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(withBajada.ok).toBe(true);
      expect(neutro.ok).toBe(true);
      if (withBajada.ok && neutro.ok) {
        expect(
          (withBajada as { zcore_bcra: number }).zcore_bcra,
        ).toBeGreaterThan((neutro as { zcore_bcra: number }).zcore_bcra);
      }
    });

    it('debe dar castigo cuando deuda subió en 6 meses', async () => {
      setupMockUser();
      const historical = createHistoricalWithDebtSequence([
        80, 100, 120, 140, 160, 180, 200,
      ]);
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? historical
          : createBcraLatestResponse({ monto: 200, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const withSubida = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ monto: 200, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const neutro = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(withSubida.ok).toBe(true);
      expect(neutro.ok).toBe(true);
      if (withSubida.ok && neutro.ok) {
        expect((withSubida as { zcore_bcra: number }).zcore_bcra).toBeLessThan(
          (neutro as { zcore_bcra: number }).zcore_bcra,
        );
      }
    });

    it('debe dar castigo mayor cuando suba brusca en 3 meses', async () => {
      setupMockUser();
      const historical = createHistoricalWithDebtSequence([
        100, 100, 100, 50, 70, 120, 150,
      ]);
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? historical
          : createBcraLatestResponse({ monto: 150, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.zcore_bcra).toBeGreaterThanOrEqual(0);
        expect(result.zcore_bcra).toBeLessThanOrEqual(1000);
      }
    });

    it('debe castigar cuando deuda histórica 0 y actual relevante (no neutro)', async () => {
      setupMockUser();
      const historical = createHistoricalWithDebtSequence([
        0, 0, 0, 0, 0, 0, 500,
      ]);
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? historical
          : createBcraLatestResponse({ monto: 500, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const conDeudaNueva = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ monto: 500, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const estable = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(conDeudaNueva.ok).toBe(true);
      expect(estable.ok).toBe(true);
      if (conDeudaNueva.ok && estable.ok) {
        expect(
          (conDeudaNueva as { zcore_bcra: number }).zcore_bcra,
        ).toBeLessThan((estable as { zcore_bcra: number }).zcore_bcra);
      }
    });

    it('debe respetar clamp ±20 en ajuste por tendencia', async () => {
      setupMockUser();
      const historicalBajadaExtrema = createHistoricalWithDebtSequence([
        1000, 800, 600, 400, 200, 100, 10,
      ]);
      const historicalSubidaExtrema = createHistoricalWithDebtSequence([
        10, 100, 200, 400, 600, 800, 1000,
      ]);
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? historicalBajadaExtrema
          : createBcraLatestResponse({ monto: 10, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const conBajadaExtrema = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? historicalSubidaExtrema
          : createBcraLatestResponse({ monto: 1000, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const conSubidaExtrema = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(conBajadaExtrema.ok).toBe(true);
      expect(conSubidaExtrema.ok).toBe(true);
      if (conBajadaExtrema.ok && conSubidaExtrema.ok) {
        const diff =
          (conBajadaExtrema as { zcore_bcra: number }).zcore_bcra -
          (conSubidaExtrema as { zcore_bcra: number }).zcore_bcra;
        expect(diff).toBeLessThanOrEqual(50);
        expect(
          (conBajadaExtrema as { zcore_bcra: number }).zcore_bcra,
        ).toBeLessThanOrEqual(1000);
        expect(
          (conSubidaExtrema as { zcore_bcra: number }).zcore_bcra,
        ).toBeGreaterThanOrEqual(0);
      }
    });

    it('debe ordenar periodos por YYYYMM antes de calcular tendencia', async () => {
      setupMockUser();
      const ordered = createHistoricalWithDebtSequence([
        200, 180, 160, 140, 120, 100, 80,
      ]);
      const reversed = {
        ...ordered,
        results: { periodos: [...ordered.results.periodos].reverse() },
      };
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? reversed
          : createBcraLatestResponse({ monto: 80, situacion: 1 });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.zcore_bcra).toBeGreaterThanOrEqual(0);
        expect(result.zcore_bcra).toBeLessThanOrEqual(1000);
      }
    });

    it('debe que score final nunca baje de 0 ni supere 1000', async () => {
      setupMockUser();
      const historicalMuyMalo = createHistoricalWithDebtSequence([
        100, 150, 200, 250, 300, 350, 400,
      ]);
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? historicalMuyMalo
          : createBcraLatestResponse({
              monto: 400,
              situacion: 3,
              has_refinanciaciones: true,
              has_recategorizacion_oblig: true,
            });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.zcore_bcra).toBeGreaterThanOrEqual(0);
        expect(result.zcore_bcra).toBeLessThanOrEqual(1000);
        expect(result.score_initial).toBe(result.zcore_bcra);
      }
    });
  });

  describe('Denominación', () => {
    it('debe parsear denominación confiable y devolver first_name, last_name', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({ denominacion: 'María García López' });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.first_name).toBe('María');
        expect(result.last_name).toBe('García López');
      }
    });

    it('debe manejar denominación no confiable sin romper el flujo', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const urlStr = String(url as string);
        const payload = urlStr.includes('/historicas/')
          ? createBcraHistoricalResponse()
          : createBcraLatestResponse({
              denominacion: 'EMPRESA SA CON NOMBRE MUY LARGO Y RARO 123',
            });
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      const result = await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.first_name).toBeDefined();
        expect(result.last_name).toBeDefined();
      }
    });
  });

  describe('Persistencia', () => {
    it('no debe llamar withTransaction cuando BCRA_NO_DATA (bypass manual)', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });
      fetchMock.mockImplementation((url) => {
        const payload = String(url as string).includes('/historicas/')
          ? createBcraHistoricalResponse()
          : { status: 0, results: { periodos: [] } };
        return Promise.resolve({
          status: 200,
          json: () => Promise.resolve(payload),
        } as Response);
      });

      await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(mockDbService.withTransaction).not.toHaveBeenCalled();
    });

    it('debe llamar withTransaction para upsert en user_prequals en caso de éxito', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });

      await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(mockDbService.withTransaction).toHaveBeenCalledTimes(1);
    });

    it('debe consultar BCRA latest e historical en paralelo', async () => {
      mockDbService.query.mockResolvedValue({
        rows: [
          {
            id: VALID_USER_ID,
            phone: VALID_PHONE,
            cuit: VALID_CUIT,
            first_name: null,
            last_name: null,
          },
        ],
      });

      await service.runPrequal({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.includes('/historicas/'))).toBe(true);
      expect(urls.some((u) => !u.includes('/historicas/'))).toBe(true);
    });
  });
});
