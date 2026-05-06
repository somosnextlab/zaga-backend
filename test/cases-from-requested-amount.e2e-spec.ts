/* eslint-disable @typescript-eslint/require-await */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DbService } from '../src/db/db.service';
import { LeadStage } from '../src/lead-stage.enum';

const PHONE = '+5493516639755';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const CASE_ID = '660e8400-e29b-41d4-a716-446655440001';
const LEAD_ID = '770e8400-e29b-41d4-a716-446655440002';

describe('CasesInternal from-requested-amount (e2e)', () => {
  let app: INestApplication<App>;

  const mockClient = {
    query: jest.fn(),
  };

  const mockDbService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  function stubHappyPathAutoOk(): void {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM leads')) {
        return {
          rows: [
            {
              id: LEAD_ID,
              phone: PHONE,
              stage: LeadStage.WAITING_REQUESTED_AMOUNT,
              current_case_id: null,
              manual_review_reason: null,
            },
          ],
        };
      }
      if (sql.includes('FROM users')) {
        return {
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
        };
      }
      if (sql.includes('INSERT INTO cases')) {
        return {
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
        };
      }
      if (sql.includes('UPDATE leads')) {
        return {
          rows: [
            {
              phone: PHONE,
              stage: LeadStage.WAITING_CEO,
              current_case_id: CASE_ID,
            },
          ],
        };
      }
      return { rows: [] };
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDbService.withTransaction.mockImplementation(
      async (fn: (client: typeof mockClient) => Promise<unknown>) =>
        fn(mockClient),
    );
    stubHappyPathAutoOk();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DbService)
      .useValue(mockDbService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /internal/cases/from-requested-amount body válido → 200 ok:true', () => {
    return request(app.getHttpServer())
      .post('/internal/cases/from-requested-amount')
      .send({ phone: PHONE, requested_amount: 300000 })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          ok: true,
          case_id: CASE_ID,
          requested_amount: 300000,
          prequal_mode: 'AUTO_OK',
        });
      });
  });

  it('POST /internal/cases/from-requested-amount tolera prefijo whatsapp:', () => {
    return request(app.getHttpServer())
      .post('/internal/cases/from-requested-amount')
      .send({ phone: `whatsapp:${PHONE}`, requested_amount: 300000 })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ ok: true, phone: PHONE });
      });
  });

  it('POST /internal/cases/from-requested-amount monto inválido → 400', () => {
    return request(app.getHttpServer())
      .post('/internal/cases/from-requested-amount')
      .send({ phone: PHONE, requested_amount: 150000 })
      .expect(400);
  });

  it('POST /internal/cases/from-requested-amount sin lead → 200 ok:false LEAD_NOT_FOUND', () => {
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM leads')) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    return request(app.getHttpServer())
      .post('/internal/cases/from-requested-amount')
      .send({ phone: PHONE, requested_amount: 200000 })
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          ok: false,
          error_type: 'BUSINESS',
          error_code: 'LEAD_NOT_FOUND',
        });
      });
  });
});
