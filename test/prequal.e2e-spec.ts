/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PoolClient } from 'pg';
import { AppModule } from '../src/app.module';
import { DbService } from '../src/db/db.service';

const VALID_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_PHONE = '+5493511234567';
const VALID_CUIT = '20123456789';

const createBcraLatestResponse = () => ({
  status: 0,
  results: {
    identificacion: 20123456789,
    denominacion: 'Juan Pérez',
    periodos: [
      {
        periodo: '202601',
        entidades: [
          {
            entidad: 'Banco Test',
            situacion: 1,
            monto: 100000,
            diasAtrasoPago: 0,
            refinanciaciones: false,
            recategorizacionOblig: false,
            situacionJuridica: false,
            irrecDisposicionTecnica: false,
            enRevision: false,
            procesoJud: false,
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

describe('PrequalController (e2e)', () => {
  let app: INestApplication<App>;
  let fetchMock: jest.SpyInstance;

  const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
  };

  const mockDbService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  beforeAll(() => {
    fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (url) => {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const urlStr = String(url);
        if (urlStr.includes('/historicas/')) {
          return {
            status: 200,
            json: () => Promise.resolve(createBcraHistoricalResponse()),
          } as Response;
        }
        return {
          status: 200,
          json: () => Promise.resolve(createBcraLatestResponse()),
        } as Response;
      });
  });

  afterAll(() => {
    fetchMock.mockRestore();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
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
    mockDbService.withTransaction.mockImplementation(
      async (fn: (client: PoolClient) => Promise<unknown>) => {
        return fn(mockClient as unknown as PoolClient);
      },
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DbService)
      .useValue(mockDbService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /internal/prequal/run con body válido debe devolver ok:true', () => {
    return request(app.getHttpServer())
      .post('/internal/prequal/run')
      .send({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          ok: true,
          eligible: expect.any(Boolean),
          risk_level: expect.stringMatching(/^(LOW|MEDIUM|HIGH)$/),
          zcore_bcra: expect.any(Number),
          score_initial: expect.any(Number),
          score_reason: expect.any(String),
          model_version: 'ZCORE_BCRA_V1',
          periodo: expect.any(String),
          first_name: expect.any(String),
          last_name: expect.any(String),
        });
      });
  });

  it('POST /internal/prequal/run con userId inválido (no UUID) debe devolver 400', () => {
    return request(app.getHttpServer())
      .post('/internal/prequal/run')
      .send({
        userId: 'not-a-uuid',
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      })
      .expect(400);
  });

  it('POST /internal/prequal/run con phone vacío debe devolver 400', () => {
    return request(app.getHttpServer())
      .post('/internal/prequal/run')
      .send({
        userId: VALID_USER_ID,
        phone: '',
        cuit: VALID_CUIT,
      })
      .expect(400);
  });

  it('POST /internal/prequal/run con cuit vacío debe devolver 400', () => {
    return request(app.getHttpServer())
      .post('/internal/prequal/run')
      .send({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: '',
      })
      .expect(400);
  });

  it('POST /internal/prequal/run con body incompleto debe devolver 400', () => {
    return request(app.getHttpServer())
      .post('/internal/prequal/run')
      .send({ userId: VALID_USER_ID })
      .expect(400);
  });

  it('POST /internal/prequal/run con usuario inexistente debe devolver 404, ok:false, USER_NOT_FOUND', () => {
    mockDbService.query.mockResolvedValue({ rows: [] });

    return request(app.getHttpServer())
      .post('/internal/prequal/run')
      .send({
        userId: VALID_USER_ID,
        phone: VALID_PHONE,
        cuit: VALID_CUIT,
      })
      .expect(404)
      .expect((res) => {
        expect(res.body).toEqual({
          ok: false,
          error_type: 'BUSINESS',
          error_code: 'USER_NOT_FOUND',
          bypass_allowed: false,
        });
      });
  });
});
