export type BcraClassification = 'SUCCESS' | 'BUSINESS' | 'TECHNICAL';

export interface BcraLatestEntity {
  entidad: string;
  situacion: number;
  monto: number;
  diasAtrasoPago?: number;
  refinanciaciones?: boolean;
  recategorizacionOblig?: boolean;
  situacionJuridica?: boolean;
  irrecDisposicionTecnica?: boolean;
  enRevision?: boolean;
  procesoJud?: boolean;
}

export interface BcraLatestPeriodo {
  periodo: string;
  entidades: BcraLatestEntity[];
}

export interface BcraLatestResults {
  identificacion?: number;
  denominacion?: string;
  periodos?: BcraLatestPeriodo[];
}

export interface BcraLatestResponse {
  status?: number;
  results?: BcraLatestResults;
}

export interface BcraHistoricalEntity {
  entidad: string;
  situacion: number;
  monto: number;
  enRevision?: boolean;
  procesoJud?: boolean;
}

export interface BcraHistoricalPeriodo {
  periodo: string;
  entidades: BcraHistoricalEntity[];
}

export interface BcraHistoricalResults {
  periodos?: BcraHistoricalPeriodo[];
}

export interface BcraHistoricalResponse {
  status?: number;
  results?: BcraHistoricalResults;
}

export interface NormalizedLatest {
  bcra_status: number;
  periodo: string;
  entidades_count: number;
  max_situacion: number;
  total_monto: number;
  max_dias_atraso: number;
  max_entity_amount: number;
  max_entity_name: string;
  has_refinanciaciones: boolean;
  has_recategorizacion_oblig: boolean;
  has_situacion_juridica: boolean;
  has_irrec_disposicion_tecnica: boolean;
  has_proceso_jud: boolean;
  has_en_revision: boolean;
  denominacion: string;
  avg_situacion_weighted: number;
  share_debt_sit_2plus: number;
  share_debt_sit_3plus: number;
  avg_dias_atraso_weighted: number;
  largest_entity_share: number;
}

export interface NormalizedHistorical {
  worst_historical_situation_24m: number;
  months_any_sit_2plus_24m: number;
  months_any_sit_3plus_24m: number;
  clean_months_24m: number;
  months_since_last_bad_event: number;
  debt_total_current?: number;
  debt_total_3m_ago?: number;
  debt_total_6m_ago?: number;
  pct_change_3m?: number;
  pct_change_6m?: number;
  consecutive_months_down_6m?: number;
  consecutive_months_up_6m?: number;
}

export interface ParsedDenominacion {
  first_name: string;
  last_name: string;
  isReliable: boolean;
}

export interface ZcoreBcraResult {
  zcore_bcra: number;
  score_initial: number;
  score_reason: string;
  model_version: string;
  eligible: boolean;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface BcraZcoreEvaluationSuccess {
  ok: true;
  normalized_latest: NormalizedLatest;
  normalized_historical: NormalizedHistorical;
  parsed_denominacion: ParsedDenominacion;
  score: ZcoreBcraResult;
  raw: {
    latest: BcraLatestResponse | null;
    historical24m: BcraHistoricalResponse | null;
  };
}

export interface BcraZcoreEvaluationError {
  ok: false;
  error_type: 'TECHNICAL' | 'BUSINESS';
  error_code: 'BCRA_UNAVAILABLE' | 'BCRA_NO_DATA' | 'BCRA_INVALID_PAYLOAD';
}

export type BcraZcoreEvaluationResult =
  | BcraZcoreEvaluationSuccess
  | BcraZcoreEvaluationError;
