import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { BcraZcoreEngineService } from '../prequal/bcra-zcore-engine.service';
import { CaseGuarantorsRepository } from './case-guarantors.repository';
import { CaseGuarantorsService } from './case-guarantors.service';
import {
  ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION,
  CASE_GUARANTOR_ERRORS,
  CASE_GUARANTOR_EVALUATION_ENGINE,
  MAX_GUARANTOR_ATTEMPTS,
} from './case-guarantors.constants';

const CASE_ID = '550e8400-e29b-41d4-a716-446655440000';
const CANDIDATE_ID = '660e8400-e29b-41d4-a716-446655440001';
const VALID_CUIT = '20123456786';
const NORMALIZED_CUIT = '20123456786';

describe('CaseGuarantorsService', () => {
  let service: CaseGuarantorsService;

  const mockClient = { tag: 'tx-client' };

  const mockRepository = {
    findCaseByIdForUpdate: jest.fn(),
    findCaseGuarantorsByCaseIdForUpdate: jest.fn(),
    insertEvaluatingCandidate: jest.fn(),
    deleteCandidateById: jest.fn(),
    finalizeEvaluation: jest.fn(),
  };

  const mockBcraEngine = {
    normalizeCuit: jest.fn(),
    evaluateNormalizedCuit: jest.fn(),
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
        CaseGuarantorsService,
        { provide: DbService, useValue: mockDbService },
        { provide: CaseGuarantorsRepository, useValue: mockRepository },
        { provide: BcraZcoreEngineService, useValue: mockBcraEngine },
      ],
    }).compile();

    service = module.get(CaseGuarantorsService);
    mockBcraEngine.normalizeCuit.mockImplementation((cuit: string) => {
      const digits = cuit.replace(/\D/g, '');
      return digits.length === 11 ? digits : null;
    });
  });

  function stubReadyCaseAndEmptyAttempts(): void {
    mockRepository.findCaseByIdForUpdate.mockResolvedValue({
      id: CASE_ID,
      status: ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION[0],
      requires_guarantor: true,
      applicant_cuit: '20999888776',
    });
    mockRepository.findCaseGuarantorsByCaseIdForUpdate.mockResolvedValue([]);
    mockRepository.insertEvaluatingCandidate.mockResolvedValue({
      id: CANDIDATE_ID,
    });
  }

  it('ante fallo técnico BCRA borra el candidato, no finaliza evaluación y devuelve retryable', async () => {
    stubReadyCaseAndEmptyAttempts();
    mockBcraEngine.evaluateNormalizedCuit.mockResolvedValue({
      ok: false,
      error_type: 'TECHNICAL',
      error_code: 'BCRA_UNAVAILABLE',
    });

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'TECHNICAL',
      error_code: 'BCRA_UNAVAILABLE',
      retryable: true,
    });
    expect(mockRepository.deleteCandidateById).toHaveBeenCalledWith(
      mockClient,
      CANDIDATE_ID,
    );
    expect(mockRepository.finalizeEvaluation).not.toHaveBeenCalled();
  });

  it('ante payload inválido externo (técnico) borra candidato y no consume intento vía finalize', async () => {
    stubReadyCaseAndEmptyAttempts();
    mockBcraEngine.evaluateNormalizedCuit.mockResolvedValue({
      ok: false,
      error_type: 'TECHNICAL',
      error_code: 'BCRA_INVALID_PAYLOAD',
    });

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result).toMatchObject({
      ok: false,
      error_type: 'TECHNICAL',
      error_code: 'BCRA_INVALID_PAYLOAD',
      retryable: true,
    });
    expect(mockRepository.deleteCandidateById).toHaveBeenCalledWith(
      mockClient,
      CANDIDATE_ID,
    );
    expect(mockRepository.finalizeEvaluation).not.toHaveBeenCalled();
  });

  it('ante BCRA_NO_DATA finaliza como REJECTED de negocio y consume intento', async () => {
    stubReadyCaseAndEmptyAttempts();
    mockBcraEngine.evaluateNormalizedCuit.mockResolvedValue({
      ok: false,
      error_type: 'BUSINESS',
      error_code: 'BCRA_NO_DATA',
    });
    mockRepository.finalizeEvaluation.mockResolvedValue({
      case_id: CASE_ID,
      attempt_no: 1,
      status: 'REJECTED',
      eligible: false,
      zcore_bcra: 0,
      risk_level: 'HIGH',
      score_reason: 'BCRA_NO_DATA',
      periodo: null,
    });

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.candidate_status).toBe('REJECTED');
      expect(result.attempt_no).toBe(1);
      expect(result.remaining_attempts).toBe(MAX_GUARANTOR_ATTEMPTS - 1);
    }
    expect(mockRepository.deleteCandidateById).not.toHaveBeenCalled();
    expect(mockRepository.finalizeEvaluation).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        candidateId: CANDIDATE_ID,
        candidateStatus: 'REJECTED',
        evaluationEngine: CASE_GUARANTOR_EVALUATION_ENGINE,
        eligible: false,
        scoreReason: 'BCRA_NO_DATA',
      }),
    );
  });

  it('devuelve DUPLICATE_GUARANTOR_CUIT solo si el CUIT ya está persistido en el caso', async () => {
    mockRepository.findCaseByIdForUpdate.mockResolvedValue({
      id: CASE_ID,
      status: ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION[0],
      requires_guarantor: true,
      applicant_cuit: '20999888776',
    });
    mockRepository.findCaseGuarantorsByCaseIdForUpdate.mockResolvedValue([
      { id: 'other-id', cuit: NORMALIZED_CUIT },
    ]);

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: CASE_GUARANTOR_ERRORS.DUPLICATE_GUARANTOR_CUIT,
    });
    expect(mockRepository.insertEvaluatingCandidate).not.toHaveBeenCalled();
  });

  it('rechaza si el CUIT candidato coincide con el CUIT del solicitante y corta antes de BCRA', async () => {
    mockRepository.findCaseByIdForUpdate.mockResolvedValue({
      id: CASE_ID,
      status: ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION[0],
      requires_guarantor: true,
      applicant_cuit: NORMALIZED_CUIT,
    });

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: '20-12345678-6',
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: CASE_GUARANTOR_ERRORS.GUARANTOR_CUIT_MATCHES_APPLICANT_CUIT,
    });
    expect(
      mockRepository.findCaseGuarantorsByCaseIdForUpdate,
    ).not.toHaveBeenCalled();
    expect(mockRepository.insertEvaluatingCandidate).not.toHaveBeenCalled();
    expect(mockBcraEngine.evaluateNormalizedCuit).not.toHaveBeenCalled();
  });
});
