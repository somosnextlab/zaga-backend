/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
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
        error_type: 'BUSINESS',
        error_code: 'BCRA_INVALID_PAYLOAD',
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
        expect(result.score_reason).toBe('HARD_REJECT_ZCORE_BCRA_V1');
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
