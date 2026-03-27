import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ContractsService } from '../src/contracts/contracts.service';
import { CaseContractStatus } from '../src/contracts/enums/case-contract-status.enum';
import { SignaturaService } from '../src/contracts/providers/signatura.service';
import { DbService } from '../src/db/db.service';

const VALID_CASE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('ContractsController (e2e)', () => {
  let app: INestApplication<App>;

  const mockContractsService = {
    startCaseContract: jest.fn(),
    getCaseContractStatus: jest.fn(),
    handleSignaturaWebhook: jest.fn(),
  };

  const mockDbService = {
    query: jest.fn(),
    withTransaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockContractsService.startCaseContract.mockResolvedValue({
      caseId: VALID_CASE_ID,
      caseContractId: '550e8400-e29b-41d4-a716-446655440010',
      status: CaseContractStatus.SIGN_PENDING,
      externalDocumentId: '550e8400-e29b-41d4-a716-446655440011',
      externalSignatureId: '550e8400-e29b-41d4-a716-446655440012',
      signatureUrl: 'https://signatura/sign',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    });
    mockContractsService.getCaseContractStatus.mockResolvedValue({
      caseId: VALID_CASE_ID,
      caseContractId: '550e8400-e29b-41d4-a716-446655440010',
      status: CaseContractStatus.SIGN_PENDING,
      providerDocumentStatus: 'PE',
      providerSignatureStatus: 'IN',
      signatureUrl: 'https://signatura/sign',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      signedAt: null,
      canceledAt: null,
      failedAt: null,
      failureReason: null,
    });
    mockContractsService.handleSignaturaWebhook.mockResolvedValue({
      accepted: true,
      contractFound: true,
      caseContractId: '550e8400-e29b-41d4-a716-446655440010',
      status: CaseContractStatus.SIGN_PENDING,
      loanId: null,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DbService)
      .useValue(mockDbService)
      .overrideProvider(SignaturaService)
      .useValue({})
      .overrideProvider(ContractsService)
      .useValue(mockContractsService)
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

  const readStringField = (
    value: unknown,
    field: string,
  ): string | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const fieldValue = (value as Record<string, unknown>)[field];
    return typeof fieldValue === 'string' ? fieldValue : undefined;
  };

  const readBooleanField = (
    value: unknown,
    field: string,
  ): boolean | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const fieldValue = (value as Record<string, unknown>)[field];
    return typeof fieldValue === 'boolean' ? fieldValue : undefined;
  };

  it('POST /case-contracts/start retorna 200 con body válido', () => {
    return request(app.getHttpServer())
      .post('/case-contracts/start')
      .send({ caseId: VALID_CASE_ID })
      .expect(200)
      .expect((res) => {
        expect(readStringField(res.body, 'caseId')).toBe(VALID_CASE_ID);
        expect(mockContractsService.startCaseContract).toHaveBeenCalledWith(
          VALID_CASE_ID,
        );
      });
  });

  it('POST /case-contracts/start retorna 400 con caseId inválido', () => {
    return request(app.getHttpServer())
      .post('/case-contracts/start')
      .send({ caseId: 'invalid-case-id' })
      .expect(400);
  });

  it('GET /case-contracts/:caseId retorna 200 con caseId válido', () => {
    return request(app.getHttpServer())
      .get(`/case-contracts/${VALID_CASE_ID}`)
      .expect(200)
      .expect((res) => {
        expect(readStringField(res.body, 'caseId')).toBe(VALID_CASE_ID);
      });
  });

  it('GET /case-contracts/:caseId retorna 400 con caseId inválido', () => {
    return request(app.getHttpServer())
      .get('/case-contracts/not-a-uuid')
      .expect(400);
  });

  it('POST /case-contracts/webhooks/signatura acepta payload webhook Signatura', () => {
    return request(app.getHttpServer())
      .post('/case-contracts/webhooks/signatura')
      .set('x-signatura-signature', 'test-signature')
      .send({
        notification_action: 'DS',
        document_id: '550e8400-e29b-41d4-a716-446655440011',
        signature_id: '550e8400-e29b-41d4-a716-446655440012',
      })
      .expect(200)
      .expect((res) => {
        expect(readBooleanField(res.body, 'accepted')).toBe(true);
        expect(mockContractsService.handleSignaturaWebhook).toHaveBeenCalled();
      });
  });
});
