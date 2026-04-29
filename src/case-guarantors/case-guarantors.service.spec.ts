import { Test, TestingModule } from '@nestjs/testing';
import { DbService } from '../db/db.service';
import { BcraZcoreEngineService } from '../prequal/bcra-zcore-engine.service';
import { CaseGuarantorsRepository } from './case-guarantors.repository';
import { CaseGuarantorsService } from './case-guarantors.service';
import {
  ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION,
  CASE_APROBADO_FINAL_ERRORS,
  CASE_MANUAL_IDENTITY_ERRORS,
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
    updateCaseStatus: jest.fn(),
    markGuarantorApprovedByCeoForNosis: jest.fn(),
    rejectGuarantorCandidateByCeo: jest.fn(),
    applyAprobadoFinalFromPendingNosis: jest.fn(),
    findManualIdentityCaseByIdForUpdate: jest.fn(),
    updateUserManualIdentity: jest.fn(),
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
    expect(mockRepository.updateCaseStatus).toHaveBeenCalledWith(
      mockClient,
      CASE_ID,
      'PENDING_GUARANTOR_ANALYSIS',
    );
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
    expect(mockRepository.updateCaseStatus).toHaveBeenCalledWith(
      mockClient,
      CASE_ID,
      'PENDING_GUARANTOR_ANALYSIS',
    );
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
    expect(mockRepository.updateCaseStatus).toHaveBeenCalledTimes(1);
    expect(mockRepository.updateCaseStatus).toHaveBeenCalledWith(
      mockClient,
      CASE_ID,
      'PENDING_GUARANTOR_ANALYSIS',
    );
  });

  it('con zcore_bcra = 799 finaliza como REJECTED automático', async () => {
    stubReadyCaseAndEmptyAttempts();
    mockBcraEngine.evaluateNormalizedCuit.mockResolvedValue({
      ok: true,
      normalized_latest: { periodo: '202601' },
      score: {
        zcore_bcra: 799,
        eligible: true,
        risk_level: 'MEDIUM',
        score_reason: 'ZCORE_BCRA_V1',
      },
    });
    mockRepository.finalizeEvaluation.mockResolvedValue({
      case_id: CASE_ID,
      attempt_no: 1,
      status: 'REJECTED',
      eligible: false,
      zcore_bcra: 799,
      risk_level: 'MEDIUM',
      score_reason: 'ZCORE_BCRA_V1',
      periodo: '202601',
    });

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result.ok).toBe(true);
    expect(mockRepository.finalizeEvaluation).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        candidateId: CANDIDATE_ID,
        candidateStatus: 'REJECTED',
        eligible: false,
        zcoreBcra: 799,
        scoreReason: 'ZCORE_BCRA_V1',
      }),
    );
  });

  it('con zcore_bcra = 800 puede finalizar como APPROVED según la lógica vigente', async () => {
    stubReadyCaseAndEmptyAttempts();
    mockBcraEngine.evaluateNormalizedCuit.mockResolvedValue({
      ok: true,
      normalized_latest: { periodo: '202601' },
      score: {
        zcore_bcra: 800,
        eligible: true,
        risk_level: 'LOW',
        score_reason: 'ZCORE_BCRA_V1',
      },
    });
    mockRepository.finalizeEvaluation.mockResolvedValue({
      case_id: CASE_ID,
      attempt_no: 1,
      status: 'APPROVED',
      eligible: true,
      zcore_bcra: 800,
      risk_level: 'LOW',
      score_reason: 'ZCORE_BCRA_V1',
      periodo: '202601',
    });

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result.ok).toBe(true);
    expect(mockRepository.finalizeEvaluation).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        candidateId: CANDIDATE_ID,
        candidateStatus: 'APPROVED',
        eligible: true,
        zcoreBcra: 800,
        scoreReason: 'ZCORE_BCRA_V1',
      }),
    );
  });

  it('devuelve CASE_STATUS_INVALID si el caso está en PENDING_NOSIS', async () => {
    mockRepository.findCaseByIdForUpdate.mockResolvedValue({
      id: CASE_ID,
      status: 'PENDING_NOSIS',
      requires_guarantor: true,
      applicant_cuit: '20999888776',
    });

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: CASE_GUARANTOR_ERRORS.CASE_STATUS_INVALID,
    });
    expect(mockRepository.insertEvaluatingCandidate).not.toHaveBeenCalled();
    expect(mockRepository.updateCaseStatus).not.toHaveBeenCalled();
  });

  it('desde PENDING_GUARANTOR_ANALYSIS ante TECHNICAL borra candidato y deja caso en PENDING_GUARANTOR_ANALYSIS', async () => {
    mockRepository.findCaseByIdForUpdate.mockResolvedValue({
      id: CASE_ID,
      status: 'PENDING_GUARANTOR_ANALYSIS',
      requires_guarantor: true,
      applicant_cuit: '20999888776',
    });
    mockRepository.findCaseGuarantorsByCaseIdForUpdate.mockResolvedValue([]);
    mockRepository.insertEvaluatingCandidate.mockResolvedValue({
      id: CANDIDATE_ID,
    });
    mockBcraEngine.evaluateNormalizedCuit.mockResolvedValue({
      ok: false,
      error_type: 'TECHNICAL',
      error_code: 'BCRA_UNAVAILABLE',
    });

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result.ok).toBe(false);
    expect(mockRepository.updateCaseStatus).toHaveBeenCalledWith(
      mockClient,
      CASE_ID,
      'PENDING_GUARANTOR_ANALYSIS',
    );
  });

  it('bloquea nuevo CUIT si hay APPROVED pendiente de decisión CEO (reviewed_by system)', async () => {
    mockRepository.findCaseByIdForUpdate.mockResolvedValue({
      id: CASE_ID,
      status: ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION[0],
      requires_guarantor: true,
      applicant_cuit: '20999888776',
    });
    mockRepository.findCaseGuarantorsByCaseIdForUpdate.mockResolvedValue([
      {
        id: 'g1',
        cuit: '27999888769',
        attempt_no: 1,
        status: 'APPROVED',
        reviewed_by: 'system',
      },
    ]);

    const result = await service.evaluateCaseGuarantor({
      caseId: CASE_ID,
      cuit: VALID_CUIT,
    });

    expect(result).toEqual({
      ok: false,
      error_type: 'BUSINESS',
      error_code: CASE_GUARANTOR_ERRORS.APPROVED_GUARANTOR_PENDING_CEO_DECISION,
    });
    expect(mockRepository.insertEvaluatingCandidate).not.toHaveBeenCalled();
  });

  it('devuelve DUPLICATE_GUARANTOR_CUIT solo si el CUIT ya está persistido en el caso', async () => {
    mockRepository.findCaseByIdForUpdate.mockResolvedValue({
      id: CASE_ID,
      status: ALLOWED_CASE_STATUSES_FOR_GUARANTOR_EVALUATION[0],
      requires_guarantor: true,
      applicant_cuit: '20999888776',
    });
    mockRepository.findCaseGuarantorsByCaseIdForUpdate.mockResolvedValue([
      {
        id: 'other-id',
        cuit: NORMALIZED_CUIT,
        attempt_no: 1,
        status: 'REJECTED',
        reviewed_by: 'system',
      },
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

  describe('resolveCaseGuarantor', () => {
    it('GARANTE_APROBADO marca revisión CEO y mueve el caso a PENDING_NOSIS', async () => {
      mockRepository.findCaseByIdForUpdate.mockResolvedValue({
        id: CASE_ID,
        status: 'PENDING_GUARANTOR_ANALYSIS',
        requires_guarantor: true,
        applicant_cuit: '20999888776',
      });
      mockRepository.findCaseGuarantorsByCaseIdForUpdate.mockResolvedValue([
        {
          id: CANDIDATE_ID,
          cuit: NORMALIZED_CUIT,
          attempt_no: 1,
          status: 'APPROVED',
          reviewed_by: 'system',
        },
      ]);
      mockRepository.markGuarantorApprovedByCeoForNosis.mockResolvedValue(true);

      const result = await service.resolveCaseGuarantor({
        caseId: CASE_ID,
        action: 'GARANTE_APROBADO',
        actor: 'CEO',
      });

      expect(result).toEqual({
        ok: true,
        action: 'GARANTE_APROBADO',
        case_id: CASE_ID,
        case_status: 'PENDING_NOSIS',
      });
      expect(
        mockRepository.markGuarantorApprovedByCeoForNosis,
      ).toHaveBeenCalledWith(mockClient, {
        candidateId: CANDIDATE_ID,
        reviewedBy: 'CEO',
      });
      expect(mockRepository.updateCaseStatus).toHaveBeenCalledWith(
        mockClient,
        CASE_ID,
        'PENDING_NOSIS',
      );
    });

    it('GARANTE_RECHAZADO reclasifica el candidato y reporta intentos restantes', async () => {
      mockRepository.findCaseByIdForUpdate.mockResolvedValue({
        id: CASE_ID,
        status: 'PENDING_GUARANTOR_ANALYSIS',
        requires_guarantor: true,
        applicant_cuit: '20999888776',
      });
      mockRepository.findCaseGuarantorsByCaseIdForUpdate.mockResolvedValue([
        {
          id: CANDIDATE_ID,
          cuit: NORMALIZED_CUIT,
          attempt_no: 1,
          status: 'APPROVED',
          reviewed_by: 'system',
        },
      ]);
      mockRepository.rejectGuarantorCandidateByCeo.mockResolvedValue(true);

      const result = await service.resolveCaseGuarantor({
        caseId: CASE_ID,
        action: 'GARANTE_RECHAZADO',
        actor: 'ASESORIA',
        rejectReason: 'CEO_REQUESTED_NEW_GUARANTOR',
      });

      expect(result).toEqual({
        ok: true,
        action: 'GARANTE_RECHAZADO',
        case_id: CASE_ID,
        case_status: 'PENDING_GUARANTOR_ANALYSIS',
        remaining_attempts: MAX_GUARANTOR_ATTEMPTS - 1,
        max_attempts_reached: false,
      });
      expect(mockRepository.rejectGuarantorCandidateByCeo).toHaveBeenCalledWith(
        mockClient,
        {
          candidateId: CANDIDATE_ID,
          reviewedBy: 'ASESORIA',
          reviewReason: 'CEO_REQUESTED_NEW_GUARANTOR',
        },
      );
    });

    it('devuelve NO_APPROVED_GUARANTOR_TO_RESOLVE si no hay APPROVED pendiente de sistema', async () => {
      mockRepository.findCaseByIdForUpdate.mockResolvedValue({
        id: CASE_ID,
        status: 'PENDING_GUARANTOR_ANALYSIS',
        requires_guarantor: true,
        applicant_cuit: '20999888776',
      });
      mockRepository.findCaseGuarantorsByCaseIdForUpdate.mockResolvedValue([
        {
          id: CANDIDATE_ID,
          cuit: NORMALIZED_CUIT,
          attempt_no: 1,
          status: 'APPROVED',
          reviewed_by: 'CEO',
        },
      ]);

      const result = await service.resolveCaseGuarantor({
        caseId: CASE_ID,
        action: 'GARANTE_APROBADO',
        actor: 'CEO',
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: CASE_GUARANTOR_ERRORS.NO_APPROVED_GUARANTOR_TO_RESOLVE,
      });
    });
  });

  describe('applyAprobadoFinal', () => {
    it('devuelve ok cuando el caso pasa de PENDING_NOSIS a APROBADO_FINAL', async () => {
      mockRepository.applyAprobadoFinalFromPendingNosis.mockResolvedValue({
        outcome: 'SUCCESS',
      });

      const result = await service.applyAprobadoFinal({ caseId: CASE_ID });

      expect(result).toEqual({
        ok: true,
        case_id: CASE_ID,
        case_status: 'APROBADO_FINAL',
      });
    });

    it('devuelve CASE_STATUS_INVALID cuando el caso no está en PENDING_NOSIS', async () => {
      mockRepository.applyAprobadoFinalFromPendingNosis.mockResolvedValue({
        outcome: 'CASE_STATUS_INVALID',
      });

      const result = await service.applyAprobadoFinal({ caseId: CASE_ID });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: CASE_APROBADO_FINAL_ERRORS.CASE_STATUS_INVALID,
      });
    });
  });

  describe('applyManualIdentity', () => {
    it('actualiza identidad en caso manual válido', async () => {
      mockRepository.findManualIdentityCaseByIdForUpdate.mockResolvedValue({
        id: CASE_ID,
        user_id: '550e8400-e29b-41d4-a716-446655440999',
        prequal_mode: 'MANUAL_REVIEW',
        manual_review_reason: null,
      });
      mockRepository.updateUserManualIdentity.mockResolvedValue({
        case_id: CASE_ID,
        user_id: '550e8400-e29b-41d4-a716-446655440999',
        first_name: 'CRISTIAN DENIS',
        last_name: 'GIANOBOLI',
      });

      const result = await service.applyManualIdentity({
        caseId: CASE_ID,
        firstName: 'CRISTIAN DENIS',
        lastName: 'GIANOBOLI',
        actor: 'CEO',
      });

      expect(result).toEqual({
        ok: true,
        case_id: CASE_ID,
        user_id: '550e8400-e29b-41d4-a716-446655440999',
        first_name: 'CRISTIAN DENIS',
        last_name: 'GIANOBOLI',
      });
      expect(mockRepository.updateUserManualIdentity).toHaveBeenCalledWith(
        mockClient,
        {
          caseId: CASE_ID,
          userId: '550e8400-e29b-41d4-a716-446655440999',
          firstName: 'CRISTIAN DENIS',
          lastName: 'GIANOBOLI',
        },
      );
    });

    it('devuelve CASE_NOT_FOUND cuando el caso no existe', async () => {
      mockRepository.findManualIdentityCaseByIdForUpdate.mockResolvedValue(
        null,
      );

      const result = await service.applyManualIdentity({
        caseId: CASE_ID,
        firstName: 'CRISTIAN',
        lastName: 'GIANOBOLI',
        actor: 'CEO',
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: CASE_MANUAL_IDENTITY_ERRORS.CASE_NOT_FOUND,
      });
      expect(mockRepository.updateUserManualIdentity).not.toHaveBeenCalled();
    });

    it('devuelve CASE_NOT_IN_MANUAL_REVIEW cuando no está en carril manual', async () => {
      mockRepository.findManualIdentityCaseByIdForUpdate.mockResolvedValue({
        id: CASE_ID,
        user_id: '550e8400-e29b-41d4-a716-446655440999',
        prequal_mode: 'AUTOMATIC',
        manual_review_reason: null,
      });

      const result = await service.applyManualIdentity({
        caseId: CASE_ID,
        firstName: 'CRISTIAN',
        lastName: 'GIANOBOLI',
        actor: 'CEO',
      });

      expect(result).toEqual({
        ok: false,
        error_type: 'BUSINESS',
        error_code: CASE_MANUAL_IDENTITY_ERRORS.CASE_NOT_IN_MANUAL_REVIEW,
      });
      expect(mockRepository.updateUserManualIdentity).not.toHaveBeenCalled();
    });

    it('normaliza espacios múltiples en firstName y lastName', async () => {
      mockRepository.findManualIdentityCaseByIdForUpdate.mockResolvedValue({
        id: CASE_ID,
        user_id: '550e8400-e29b-41d4-a716-446655440999',
        prequal_mode: null,
        manual_review_reason: 'BCRA_NO_DATA',
      });
      mockRepository.updateUserManualIdentity.mockResolvedValue({
        case_id: CASE_ID,
        user_id: '550e8400-e29b-41d4-a716-446655440999',
        first_name: 'CRISTIAN DENIS',
        last_name: 'GIANOBOLI PEREZ',
      });

      const result = await service.applyManualIdentity({
        caseId: CASE_ID,
        firstName: '  CRISTIAN    DENIS  ',
        lastName: '  GIANOBOLI   PEREZ   ',
        actor: 'CEO',
      });

      expect(result).toMatchObject({
        ok: true,
        first_name: 'CRISTIAN DENIS',
        last_name: 'GIANOBOLI PEREZ',
      });
      expect(mockRepository.updateUserManualIdentity).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          firstName: 'CRISTIAN DENIS',
          lastName: 'GIANOBOLI PEREZ',
        }),
      );
    });
  });
});
