import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { DbService } from '../db/db.service';
import { ContractsRepository } from './contracts.repository';
import { ContractsService } from './contracts.service';
import { CaseContractStatus } from './enums/case-contract-status.enum';
import type {
  CaseContractRow,
  CaseForContractRow,
  LoanRow,
} from './interfaces/contracts.interface';
import { SignaturaService } from './providers/signatura.service';
import { ContractPdfService } from './templates/contract-pdf.service';
import { ContractsErrors } from './utils/contracts-errors';

const VALID_CASE_ID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_OFFER_ID = '550e8400-e29b-41d4-a716-446655440001';
const VALID_CONTRACT_ID = '550e8400-e29b-41d4-a716-446655440002';
const VALID_DOCUMENT_ID = '550e8400-e29b-41d4-a716-446655440003';
const VALID_SIGNATURE_ID = '550e8400-e29b-41d4-a716-446655440004';
const VALID_LOAN_ID = '550e8400-e29b-41d4-a716-446655440005';
const WEBHOOK_SECRET = 'test-secret';
const WEBHOOK_RAW_BODY = Buffer.from('{}', 'utf8');

describe('ContractsService', () => {
  let service: ContractsService;

  const mockClient = {};

  const mockContractsRepository = {
    findCaseByIdForUpdate: jest.fn(),
    findAcceptedOfferByCaseIdForUpdate: jest.fn(),
    findActiveCaseContractByCaseIdForUpdate: jest.fn(),
    insertCaseContractCreated: jest.fn(),
    markCaseContractSignPending: jest.fn(),
    findCaseContractByCaseId: jest.fn(),
    findCaseContractByExternalIdsForUpdate: jest.fn(),
    updateProviderTracking: jest.fn(),
    markCaseContractFailed: jest.fn(),
    markCaseContractCanceled: jest.fn(),
    markCaseContractSigned: jest.fn(),
    findLoanByCaseIdForUpdate: jest.fn(),
    findLoanByRefinancesLoanIdForUpdate: jest.fn(),
    insertLoan: jest.fn(),
  };

  const mockContractPdfService = {
    generateContractPdf: jest.fn(),
  };

  const mockSignaturaService = {
    createDocument: jest.fn(),
    getDocument: jest.fn(),
    getBiometrics: jest.fn(),
    cancelDocument: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'SIGN_PROVIDER') return 'SIGNATURA';
      if (key === 'SIGNATURA_WEBHOOK_SECRET') return 'test-secret';
      return undefined;
    }),
  };

  const mockDbService = {
    withTransaction: jest.fn(
      async (fn: (client: unknown) => Promise<unknown>) => fn(mockClient),
    ),
  };

  const caseRow: CaseForContractRow = {
    id: VALID_CASE_ID,
    user_id: '550e8400-e29b-41d4-a716-446655440100',
    phone: '+5493511234567',
    status: 'APROBADO_FINAL',
    case_type: 'NEW',
    refinances_loan_id: null,
    current_offer_id: VALID_OFFER_ID,
    first_name: 'Juan',
    last_name: 'Perez',
    dni: '12345678',
    cuit: '20123456789',
  };

  const createdContract: CaseContractRow = {
    id: VALID_CONTRACT_ID,
    case_id: VALID_CASE_ID,
    offer_id: VALID_OFFER_ID,
    provider: 'SIGNATURA',
    status: CaseContractStatus.CREATED,
    contract_version: null,
    template_code: null,
    external_document_id: null,
    external_signature_id: null,
    provider_document_status: null,
    provider_signature_status: null,
    signature_url: null,
    issued_at: null,
    expires_at: null,
    signed_at: null,
    canceled_at: null,
    failed_at: null,
    failure_reason: null,
    biometric_status: null,
    biometric_payload: null,
    biometric_fetched_at: null,
    signed_document_url: null,
    audit_certificate_url: null,
    evidence_zip_url: null,
    provider_payload: null,
    provider_last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractsService,
        { provide: ContractsRepository, useValue: mockContractsRepository },
        { provide: ContractPdfService, useValue: mockContractPdfService },
        { provide: SignaturaService, useValue: mockSignaturaService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DbService, useValue: mockDbService },
      ],
    }).compile();

    service = module.get<ContractsService>(ContractsService);
  });

  const buildValidSignatureHeader = (): string =>
    createHmac('sha256', WEBHOOK_SECRET).update(WEBHOOK_RAW_BODY).digest('hex');

  it('startCaseContract crea contrato y lo deja SIGN_PENDING', async () => {
    mockContractsRepository.findCaseByIdForUpdate.mockResolvedValue(caseRow);
    mockContractsRepository.findAcceptedOfferByCaseIdForUpdate.mockResolvedValue(
      {
        id: VALID_OFFER_ID,
        case_id: VALID_CASE_ID,
        status: 'ACCEPTED',
        amount: 100000,
        installments: 12,
        tasa_nominal_anual: 210,
      },
    );
    mockContractsRepository.findActiveCaseContractByCaseIdForUpdate.mockResolvedValue(
      null,
    );
    mockContractsRepository.insertCaseContractCreated.mockResolvedValue(
      createdContract,
    );
    mockContractPdfService.generateContractPdf.mockResolvedValue({
      fileName: 'contract.pdf',
      pdfBase64: 'UEZERGF0YQ==',
      contractVersion: 'MUTUO_ZAGA_V1',
      templateCode: 'CONTRATO_MUTUO_ZAGA_V1',
    });
    mockSignaturaService.createDocument.mockResolvedValue({
      externalDocumentId: VALID_DOCUMENT_ID,
      externalSignatureId: VALID_SIGNATURE_ID,
      documentStatus: 'PE',
      signatureStatus: 'IN',
      signatureUrl: 'https://signatura/sign',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      raw: {},
    });
    mockContractsRepository.markCaseContractSignPending.mockResolvedValue({
      ...createdContract,
      status: CaseContractStatus.SIGN_PENDING,
      external_document_id: VALID_DOCUMENT_ID,
      external_signature_id: VALID_SIGNATURE_ID,
      signature_url: 'https://signatura/sign',
      issued_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    });

    const result = await service.startCaseContract(VALID_CASE_ID);

    expect(result.status).toBe(CaseContractStatus.SIGN_PENDING);
    expect(result.externalDocumentId).toBe(VALID_DOCUMENT_ID);
    expect(result.externalSignatureId).toBe(VALID_SIGNATURE_ID);
    expect(mockSignaturaService.createDocument).toHaveBeenCalledTimes(1);
  });

  it('startCaseContract falla si case no existe', async () => {
    mockContractsRepository.findCaseByIdForUpdate.mockResolvedValue(null);

    await expect(service.startCaseContract(VALID_CASE_ID)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockSignaturaService.createDocument).not.toHaveBeenCalled();
  });

  it('startCaseContract mapea violación única de índice activo (23505) a ConflictException', async () => {
    mockContractsRepository.findCaseByIdForUpdate.mockResolvedValue(caseRow);
    mockContractsRepository.findAcceptedOfferByCaseIdForUpdate.mockResolvedValue(
      {
        id: VALID_OFFER_ID,
        case_id: VALID_CASE_ID,
        status: 'ACCEPTED',
        amount: 100000,
        installments: 12,
        tasa_nominal_anual: 210,
      },
    );
    mockContractsRepository.findActiveCaseContractByCaseIdForUpdate.mockResolvedValue(
      null,
    );
    const pgError = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      {
        code: '23505',
        constraint: 'uq_case_contracts_one_active_per_case',
      },
    );
    mockContractsRepository.insertCaseContractCreated.mockRejectedValue(
      pgError,
    );

    try {
      await service.startCaseContract(VALID_CASE_ID);
      throw new Error('expected ConflictException');
    } catch (e: unknown) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).message).toBe(
        ContractsErrors.ACTIVE_CONTRACT_ALREADY_EXISTS,
      );
    }
    expect(mockContractPdfService.generateContractPdf).not.toHaveBeenCalled();
  });

  it('handleSignaturaWebhook marca FAILED si identidad no coincide', async () => {
    mockContractsRepository.findCaseContractByExternalIdsForUpdate.mockResolvedValue(
      {
        ...createdContract,
        status: CaseContractStatus.SIGN_PENDING,
        external_document_id: VALID_DOCUMENT_ID,
        external_signature_id: VALID_SIGNATURE_ID,
      },
    );
    mockContractsRepository.updateProviderTracking.mockResolvedValue({
      ...createdContract,
      status: CaseContractStatus.SIGN_PENDING,
      external_document_id: VALID_DOCUMENT_ID,
      external_signature_id: VALID_SIGNATURE_ID,
      provider_document_status: 'CO',
      provider_signature_status: 'CO',
    });
    mockSignaturaService.getDocument.mockResolvedValue({
      externalDocumentId: VALID_DOCUMENT_ID,
      documentStatus: 'CO',
      signatureStatus: 'CO',
      signatureUrl: 'https://signatura/sign',
      signedDocumentUrl: 'https://signatura/doc.pdf',
      auditCertificateUrl: 'https://signatura/cert.pdf',
      evidenceZipUrl: 'https://signatura/evidence.zip',
      raw: {},
    });
    mockSignaturaService.getBiometrics.mockResolvedValue({
      biometricStatus: 'CO',
      identityScore: null,
      fullName: 'Nombre Distinto',
      documentNumber: '12345678',
      cuit: '20123456789',
      raw: {},
    });
    mockContractsRepository.findCaseByIdForUpdate.mockResolvedValue(caseRow);
    mockContractsRepository.markCaseContractFailed.mockResolvedValue({
      ...createdContract,
      status: CaseContractStatus.FAILED,
      failed_at: new Date().toISOString(),
      failure_reason: 'IDENTITY_VALIDATION_FAILED',
    });

    const result = await service.handleSignaturaWebhook(
      buildValidSignatureHeader(),
      WEBHOOK_RAW_BODY,
      {
        externalDocumentId: VALID_DOCUMENT_ID,
        externalSignatureId: VALID_SIGNATURE_ID,
        providerDocumentStatus: 'CO',
        providerSignatureStatus: 'CO',
      },
    );

    expect(result.status).toBe(CaseContractStatus.FAILED);
    expect(result.loanId).toBeNull();
    expect(mockContractsRepository.markCaseContractFailed).toHaveBeenCalled();
  });

  it('handleSignaturaWebhook crea loan cuando contrato queda SIGNED y elegible', async () => {
    const insertedLoan: LoanRow = {
      id: VALID_LOAN_ID,
      case_id: VALID_CASE_ID,
      offer_id: VALID_OFFER_ID,
      user_id: caseRow.user_id,
      loan_type: 'NEW',
      refinances_loan_id: null,
      status: 'CREATED',
    };

    mockContractsRepository.findCaseContractByExternalIdsForUpdate.mockResolvedValue(
      {
        ...createdContract,
        status: CaseContractStatus.SIGN_PENDING,
        external_document_id: VALID_DOCUMENT_ID,
        external_signature_id: VALID_SIGNATURE_ID,
      },
    );
    mockContractsRepository.updateProviderTracking.mockResolvedValue({
      ...createdContract,
      status: CaseContractStatus.SIGN_PENDING,
      external_document_id: VALID_DOCUMENT_ID,
      external_signature_id: VALID_SIGNATURE_ID,
      provider_document_status: 'CO',
      provider_signature_status: 'CO',
    });
    mockSignaturaService.getDocument.mockResolvedValue({
      externalDocumentId: VALID_DOCUMENT_ID,
      documentStatus: 'CO',
      signatureStatus: 'CO',
      signatureUrl: 'https://signatura/sign',
      signedDocumentUrl: 'https://signatura/doc.pdf',
      auditCertificateUrl: 'https://signatura/cert.pdf',
      evidenceZipUrl: 'https://signatura/evidence.zip',
      raw: {},
    });
    mockSignaturaService.getBiometrics.mockResolvedValue({
      biometricStatus: 'CO',
      identityScore: null,
      fullName: 'Juan Perez',
      documentNumber: '12345678',
      cuit: '20123456789',
      raw: {},
    });
    mockContractsRepository.findCaseByIdForUpdate
      .mockResolvedValueOnce(caseRow)
      .mockResolvedValueOnce(caseRow);
    mockContractsRepository.markCaseContractSigned.mockResolvedValue({
      ...createdContract,
      status: CaseContractStatus.SIGNED,
      external_document_id: VALID_DOCUMENT_ID,
      external_signature_id: VALID_SIGNATURE_ID,
      signed_at: new Date().toISOString(),
    });
    mockContractsRepository.findLoanByCaseIdForUpdate.mockResolvedValue(null);
    mockContractsRepository.insertLoan.mockResolvedValue(insertedLoan);

    const result = await service.handleSignaturaWebhook(
      buildValidSignatureHeader(),
      WEBHOOK_RAW_BODY,
      {
        externalDocumentId: VALID_DOCUMENT_ID,
        externalSignatureId: VALID_SIGNATURE_ID,
        notification_action: 'DS',
      },
    );

    expect(result.status).toBe(CaseContractStatus.SIGNED);
    expect(result.loanId).toBe(VALID_LOAN_ID);
    expect(mockContractsRepository.insertLoan).toHaveBeenCalledTimes(1);
  });

  it('handleSignaturaWebhook rechaza firma inválida', async () => {
    await expect(
      service.handleSignaturaWebhook('invalid-signature', WEBHOOK_RAW_BODY, {
        externalDocumentId: VALID_DOCUMENT_ID,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('handleSignaturaWebhook SD lleva contrato a FAILED aun sin providerSignatureStatus explícito', async () => {
    mockContractsRepository.findCaseContractByExternalIdsForUpdate.mockResolvedValue(
      {
        ...createdContract,
        status: CaseContractStatus.SIGN_PENDING,
        external_document_id: VALID_DOCUMENT_ID,
        external_signature_id: VALID_SIGNATURE_ID,
      },
    );
    mockContractsRepository.updateProviderTracking.mockResolvedValue({
      ...createdContract,
      status: CaseContractStatus.SIGN_PENDING,
      external_document_id: VALID_DOCUMENT_ID,
      external_signature_id: VALID_SIGNATURE_ID,
      provider_document_status: 'PE',
      provider_signature_status: 'DE',
    });
    mockContractsRepository.markCaseContractFailed.mockResolvedValue({
      ...createdContract,
      status: CaseContractStatus.FAILED,
      failed_at: new Date().toISOString(),
      failure_reason: 'PROVIDER_BLOCKING_ERROR',
    });

    const result = await service.handleSignaturaWebhook(
      buildValidSignatureHeader(),
      WEBHOOK_RAW_BODY,
      {
        externalDocumentId: VALID_DOCUMENT_ID,
        externalSignatureId: VALID_SIGNATURE_ID,
        notification_action: 'SD',
      },
    );

    expect(result.status).toBe(CaseContractStatus.FAILED);
    expect(result.loanId).toBeNull();
    expect(
      mockContractsRepository.markCaseContractFailed,
    ).toHaveBeenCalledTimes(1);
  });
});
