export type {
  BcraClassification,
  BcraHistoricalEntity,
  BcraHistoricalPeriodo,
  BcraHistoricalResponse,
  BcraHistoricalResults,
  BcraLatestEntity,
  BcraLatestPeriodo,
  BcraLatestResponse,
  BcraLatestResults,
  BcraZcoreEvaluationError,
  BcraZcoreEvaluationResult,
  BcraZcoreEvaluationSuccess,
  NormalizedHistorical,
  NormalizedLatest,
  ParsedDenominacion,
  ZcoreBcraResult,
} from './prequal-engine.types';

export interface PrequalSuccessResponse {
  ok: true;
  eligible: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  zcore_bcra: number;
  score_initial: number;
  score_reason: string;
  model_version: string;
  periodo: string;
  first_name: string;
  last_name: string;
}

export interface PrequalErrorResponse {
  ok: false;
  error_type: 'TECHNICAL' | 'BUSINESS';
  error_code: string;
  bypass_allowed: boolean;
  manual_review_reason?: 'BCRA_NO_DATA' | 'BCRA_UNAVAILABLE';
}

export type PrequalResponse = PrequalSuccessResponse | PrequalErrorResponse;
