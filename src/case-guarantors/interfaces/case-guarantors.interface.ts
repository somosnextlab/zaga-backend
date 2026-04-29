import type {
  CASE_APROBADO_FINAL_ERRORS,
  CASE_MANUAL_IDENTITY_ERRORS,
  CASE_GUARANTOR_ERRORS,
} from '../case-guarantors.constants';

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
  attempt_no: number;
  status: CaseGuarantorCandidateStatus;
  reviewed_by: string | null;
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

export type GuarantorManualResolutionAction =
  | 'GARANTE_APROBADO'
  | 'GARANTE_RECHAZADO';

export type GuarantorResolutionActor = 'CEO' | 'ASESORIA';

export type GuarantorCeoRejectReviewReason =
  | 'DISCARDED_BY_CEO'
  | 'CEO_REQUESTED_NEW_GUARANTOR';

export interface ResolveGuarantorSuccessApprovedResponse {
  ok: true;
  action: 'GARANTE_APROBADO';
  case_id: string;
  case_status: 'PENDING_NOSIS';
}

export interface ResolveGuarantorSuccessRejectedResponse {
  ok: true;
  action: 'GARANTE_RECHAZADO';
  case_id: string;
  case_status: 'PENDING_GUARANTOR_ANALYSIS';
  remaining_attempts: number;
  max_attempts_reached: boolean;
}

export type ResolveGuarantorSuccessResponse =
  | ResolveGuarantorSuccessApprovedResponse
  | ResolveGuarantorSuccessRejectedResponse;

export interface ResolveGuarantorBusinessErrorResponse {
  ok: false;
  error_type: 'BUSINESS';
  error_code: CaseGuarantorBusinessErrorCode;
}

export type ResolveGuarantorResponse =
  | ResolveGuarantorSuccessResponse
  | ResolveGuarantorBusinessErrorResponse;

export type CaseAprobadoFinalBusinessErrorCode =
  (typeof CASE_APROBADO_FINAL_ERRORS)[keyof typeof CASE_APROBADO_FINAL_ERRORS];

export interface ApplyAprobadoFinalSuccessResponse {
  ok: true;
  case_id: string;
  case_status: 'APROBADO_FINAL';
}

export interface ApplyAprobadoFinalBusinessErrorResponse {
  ok: false;
  error_type: 'BUSINESS';
  error_code: CaseAprobadoFinalBusinessErrorCode;
}

export type ApplyAprobadoFinalResponse =
  | ApplyAprobadoFinalSuccessResponse
  | ApplyAprobadoFinalBusinessErrorResponse;

export interface ManualIdentityUpdatedRow {
  case_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

export interface ManualIdentityUserRow {
  user_id: string;
  first_name: string;
  last_name: string;
}

export interface ApplyManualIdentitySuccessResponse {
  ok: true;
  case_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
}

export type CaseManualIdentityBusinessErrorCode =
  (typeof CASE_MANUAL_IDENTITY_ERRORS)[keyof typeof CASE_MANUAL_IDENTITY_ERRORS];

export interface ApplyManualIdentityBusinessErrorResponse {
  ok: false;
  error_type: 'BUSINESS';
  error_code: CaseManualIdentityBusinessErrorCode;
}

export type ApplyManualIdentityResponse =
  | ApplyManualIdentitySuccessResponse
  | ApplyManualIdentityBusinessErrorResponse;

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
