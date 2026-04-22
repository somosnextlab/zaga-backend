import type { CASE_GUARANTOR_ERRORS } from '../case-guarantors.constants';

export type CaseGuarantorCandidateStatus =
  | 'EVALUATING'
  | 'APPROVED'
  | 'REJECTED';

export interface CaseForGuarantorEvaluationRow {
  id: string;
  status: string;
  requires_guarantor: boolean;
  applicant_cuit: string | null;
}

export interface CaseGuarantorAttemptRow {
  id: string;
  cuit: string;
}

export interface InsertCaseGuarantorInput {
  caseId: string;
  cuit: string;
  attemptNo: number;
}

export interface FinalizeCaseGuarantorEvaluationInput {
  candidateId: string;
  candidateStatus: Exclude<CaseGuarantorCandidateStatus, 'EVALUATING'>;
  evaluationEngine: string;
  eligible: boolean;
  zcoreBcra: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  scoreReason: string;
  periodo: string | null;
  reviewedBy: string;
  reviewReason: string;
}

export interface CaseGuarantorEvaluationPersisted {
  case_id: string;
  attempt_no: number;
  status: Exclude<CaseGuarantorCandidateStatus, 'EVALUATING'>;
  eligible: boolean;
  zcore_bcra: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  score_reason: string;
  periodo: string | null;
}

export interface EvaluateCaseGuarantorSuccessResponse {
  ok: true;
  case_id: string;
  attempt_no: number;
  candidate_status: Exclude<CaseGuarantorCandidateStatus, 'EVALUATING'>;
  eligible: boolean;
  zcore_bcra: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  score_reason: string;
  periodo: string | null;
  remaining_attempts: number;
}

export type CaseGuarantorBusinessErrorCode =
  (typeof CASE_GUARANTOR_ERRORS)[keyof typeof CASE_GUARANTOR_ERRORS];

export interface EvaluateCaseGuarantorBusinessErrorResponse {
  ok: false;
  error_type: 'BUSINESS';
  error_code: CaseGuarantorBusinessErrorCode;
}

/** Códigos devueltos cuando falla BCRA u otra dependencia antes del score final. */
export type CaseGuarantorTechnicalErrorCode =
  | 'BCRA_UNAVAILABLE'
  | 'BCRA_INVALID_PAYLOAD';

export interface EvaluateCaseGuarantorTechnicalErrorResponse {
  ok: false;
  error_type: 'TECHNICAL';
  error_code: CaseGuarantorTechnicalErrorCode;
  /** Indica que n8n u orquestadores pueden reintentar con el mismo CUIT sin consumir cupo. */
  retryable: true;
}

export type EvaluateCaseGuarantorResponse =
  | EvaluateCaseGuarantorSuccessResponse
  | EvaluateCaseGuarantorBusinessErrorResponse
  | EvaluateCaseGuarantorTechnicalErrorResponse;
