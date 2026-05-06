export type CreateCaseFromRequestedAmountBusinessErrorCode =
  | 'LEAD_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'USER_NOT_COMPLETED'
  | 'INVALID_LEAD_STAGE_FOR_CASE_CREATION'
  | 'ACTIVE_CASE_ALREADY_EXISTS';

export type CreateCaseFromRequestedAmountTechnicalErrorCode =
  'CASE_CREATION_FAILED';

export type CreateCaseFromRequestedAmountManualReviewReason =
  | 'BCRA_NO_DATA'
  | 'BCRA_UNAVAILABLE'
  | null;

export type CreateCaseFromRequestedAmountErrorResponse =
  | {
      ok: false;
      error_type: 'BUSINESS';
      error_code: CreateCaseFromRequestedAmountBusinessErrorCode;
    }
  | {
      ok: false;
      error_type: 'TECHNICAL';
      error_code: CreateCaseFromRequestedAmountTechnicalErrorCode;
    };

export type CreateCaseFromRequestedAmountSuccessResponse = {
  ok: true;
  case_id: string;
  phone: string;
  user_id: string;
  requested_amount: number;
  case_status: 'WAITING_CEO';
  lead_stage: 'WAITING_CEO';
  prequal_mode: 'AUTO_OK' | 'MANUAL_REVIEW';
  manual_review_reason: CreateCaseFromRequestedAmountManualReviewReason;
};

export type CreateCaseFromRequestedAmountResponse =
  | CreateCaseFromRequestedAmountSuccessResponse
  | CreateCaseFromRequestedAmountErrorResponse;
