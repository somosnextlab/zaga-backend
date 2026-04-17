import type { CASE_GUARANTOR_ERRORS } from '../case-guarantors.constants';

export type CaseGuarantorCandidateStatus =
  | 'EVALUATING'
  | 'APPROVED'
  | 'REJECTED';

export interface CaseForGuarantorEvaluationRow {
  id: string;
  status: string;
  requires_guarantor: boolean;
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

export interface EvaluateCaseGuarantorErrorResponse {
  ok: false;
  error_type: 'BUSINESS';
  error_code: CaseGuarantorBusinessErrorCode;
}

export type EvaluateCaseGuarantorResponse =
  | EvaluateCaseGuarantorSuccessResponse
  | EvaluateCaseGuarantorErrorResponse;
