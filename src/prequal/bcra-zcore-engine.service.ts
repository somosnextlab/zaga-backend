import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BcraRequestQueue } from './bcra-request-queue';
import {
  BCRA_BACKOFF_BASE_MS,
  BCRA_BACKOFF_JITTER,
  BCRA_MAX_RETRIES,
  PERIODO_REGEX,
} from './prequal.constants';
import type {
  BcraClassification,
  BcraHistoricalPeriodo,
  BcraHistoricalResponse,
  BcraLatestResponse,
  BcraZcoreEvaluationResult,
  NormalizedHistorical,
  NormalizedLatest,
  ParsedDenominacion,
  ZcoreBcraResult,
} from './prequal-engine.types';
import { normalizeCuit } from './cuit-checksum';

@Injectable()
export class BcraZcoreEngineService {
  private readonly logger = new Logger(BcraZcoreEngineService.name);
  private readonly bcraLatestUrl: string;
  private readonly bcraHistoricalUrl: string;
  private readonly bcraTimeoutMs: number;
  private readonly bcraQueue: BcraRequestQueue;
  private readonly DEBT_RELEVANT_THRESHOLD_M = 5;

  public constructor(private readonly configService: ConfigService) {
    this.bcraLatestUrl =
      this.configService.get<string>('BCRA_API_LATEST_URL') ??
      'https://api.bcra.gob.ar/centraldedeudores/v1.0/deudas';
    this.bcraHistoricalUrl =
      this.configService.get<string>('BCRA_API_HISTORICAL_URL') ??
      'https://api.bcra.gob.ar/centraldedeudores/v1.0/deudas/historicas';
    this.bcraTimeoutMs =
      Number(this.configService.get<string>('BCRA_API_TIMEOUT_MS')) || 15000;
    const maxConcurrent =
      Number(this.configService.get<string>('BCRA_MAX_CONCURRENT_REQUESTS')) ||
      5;
    this.bcraQueue = new BcraRequestQueue(maxConcurrent);
  }

  public normalizeCuit(cuit: string): string | null {
    return normalizeCuit(cuit);
  }

  public async evaluateNormalizedCuit(
    normalizedCuit: string,
  ): Promise<BcraZcoreEvaluationResult> {
    const [latestRes, historicalRes] = await Promise.all([
      this.fetchBcraLatest(normalizedCuit),
      this.fetchBcraHistorical24m(normalizedCuit),
    ]);

    const classification = this.classifyBcraResponses(latestRes, historicalRes);
    if (classification.type !== 'SUCCESS') {
      return {
        ok: false,
        error_type: classification.type,
        error_code: classification.code ?? 'BCRA_UNAVAILABLE',
      };
    }

    const normalizedLatest = this.normalizeLatest(latestRes);
    if (!normalizedLatest) {
      return {
        ok: false,
        error_type: 'TECHNICAL',
        error_code: 'BCRA_INVALID_PAYLOAD',
      };
    }

    const normalizedHistorical = this.normalizeHistorical(historicalRes);
    const parsedName = this.parseDenominacion(normalizedLatest.denominacion);
    const score = this.computeZcoreBcraV1(
      normalizedLatest,
      normalizedHistorical,
    );

    return {
      ok: true,
      normalized_latest: normalizedLatest,
      normalized_historical: normalizedHistorical,
      parsed_denominacion: parsedName,
      score,
      raw: {
        latest: latestRes,
        historical24m: historicalRes,
      },
    };
  }

  private async fetchWithRetry(
    url: string,
    timeoutMs: number,
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= BCRA_MAX_RETRIES + 1; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await this.bcraQueue.add(() =>
          fetch(url, { signal: controller.signal }),
        );

        if (res.status >= 500 && attempt <= BCRA_MAX_RETRIES) {
          this.logger.warn(
            `Reintentando conexión con BCRA (Intento ${attempt})... status=${res.status}`,
          );
          await this.delayWithBackoff(attempt);
          continue;
        }
        return res;
      } catch (err) {
        lastError = err;
        const isRetryable =
          err instanceof TypeError ||
          (err instanceof Error && err.name === 'AbortError');
        if (isRetryable && attempt <= BCRA_MAX_RETRIES) {
          this.logger.warn(
            `Reintentando conexión con BCRA (Intento ${attempt})... error=${err instanceof Error ? err.message : String(err)}`,
          );
          await this.delayWithBackoff(attempt);
          continue;
        }
        throw lastError;
      } finally {
        clearTimeout(timeoutId);
      }
    }
    throw lastError;
  }

  private maskCuit(cuit: string): string {
    if (cuit.length <= 4) return '****';
    return '*'.repeat(cuit.length - 4) + cuit.slice(-4);
  }

  private delayWithBackoff(attempt: number): Promise<void> {
    const baseDelay = BCRA_BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
    const jitter = baseDelay * BCRA_BACKOFF_JITTER * (Math.random() * 2 - 1);
    const delayMs = Math.max(0, Math.round(baseDelay + jitter));
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private async fetchBcraLatest(
    cuit: string,
  ): Promise<BcraLatestResponse | null> {
    const url = `${this.bcraLatestUrl}/${cuit}`;
    try {
      const res = await this.fetchWithRetry(url, this.bcraTimeoutMs);
      if (res.status === 404)
        return { results: { periodos: [] } } as BcraLatestResponse;
      if (res.status >= 500) throw new Error(`BCRA ${res.status}`);
      return (await res.json()) as BcraLatestResponse;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errType = err instanceof Error ? err.name : 'unknown';
      this.logger.warn(
        `BCRA latest falló: endpoint=latest, cuit=${this.maskCuit(cuit)}, errorType=${errType}, error=${errMsg}`,
      );
      return null;
    }
  }

  private async fetchBcraHistorical24m(
    cuit: string,
  ): Promise<BcraHistoricalResponse | null> {
    const url = `${this.bcraHistoricalUrl}/${cuit}`;
    try {
      const res = await this.fetchWithRetry(url, this.bcraTimeoutMs);
      if (res.status === 404)
        return { results: { periodos: [] } } as BcraHistoricalResponse;
      if (res.status >= 500) throw new Error(`BCRA ${res.status}`);
      return (await res.json()) as BcraHistoricalResponse;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errType = err instanceof Error ? err.name : 'unknown';
      this.logger.warn(
        `BCRA historical falló: endpoint=historical, cuit=${this.maskCuit(cuit)}, errorType=${errType}, error=${errMsg}`,
      );
      return null;
    }
  }

  private classifyBcraResponses(
    latest: BcraLatestResponse | null,
    historical: BcraHistoricalResponse | null,
  ): {
    type: BcraClassification;
    code?: 'BCRA_UNAVAILABLE' | 'BCRA_NO_DATA' | 'BCRA_INVALID_PAYLOAD';
  } {
    if (latest === null || historical === null) {
      return { type: 'TECHNICAL', code: 'BCRA_UNAVAILABLE' };
    }
    const periodos = latest.results?.periodos ?? [];
    const hasValidPeriodo = periodos.some(
      (p) => p.periodo && PERIODO_REGEX.test(String(p.periodo)),
    );
    if (periodos.length === 0) {
      return { type: 'BUSINESS', code: 'BCRA_NO_DATA' };
    }
    if (!hasValidPeriodo) {
      return { type: 'TECHNICAL', code: 'BCRA_INVALID_PAYLOAD' };
    }
    return { type: 'SUCCESS' };
  }

  private normalizeLatest(
    res: BcraLatestResponse | null,
  ): NormalizedLatest | null {
    if (!res?.results?.periodos?.length) return null;
    const periodos = res.results.periodos;
    const firstWithPeriod = periodos.find(
      (p) => p.periodo && PERIODO_REGEX.test(String(p.periodo)),
    );
    if (!firstWithPeriod) return null;
    const periodo = String(firstWithPeriod.periodo);
    const entidades = firstWithPeriod.entidades ?? [];

    let max_situacion = 0;
    let total_monto = 0;
    let max_dias_atraso = 0;
    let max_entity_amount = 0;
    let max_entity_name = '';
    let has_refinanciaciones = false;
    let has_recategorizacion_oblig = false;
    let has_situacion_juridica = false;
    let has_irrec_disposicion_tecnica = false;
    let has_proceso_jud = false;
    let has_en_revision = false;
    let sum_sit_monto = 0;
    let sum_monto_sit2plus = 0;
    let sum_monto_sit3plus = 0;
    let sum_dias_monto = 0;

    for (const e of entidades) {
      const sit = Number(e.situacion) || 0;
      const monto = Number(e.monto) || 0;
      const dias = Number(e.diasAtrasoPago) || 0;
      if (sit > max_situacion) max_situacion = sit;
      total_monto += monto;
      if (dias > max_dias_atraso) max_dias_atraso = dias;
      if (monto > max_entity_amount) {
        max_entity_amount = monto;
        max_entity_name = String(e.entidad ?? '');
      }
      sum_sit_monto += sit * monto;
      if (sit >= 2) sum_monto_sit2plus += monto;
      if (sit >= 3) sum_monto_sit3plus += monto;
      sum_dias_monto += dias * monto;
      if (e.refinanciaciones) has_refinanciaciones = true;
      if (e.recategorizacionOblig) has_recategorizacion_oblig = true;
      if (e.situacionJuridica) has_situacion_juridica = true;
      if (e.irrecDisposicionTecnica) has_irrec_disposicion_tecnica = true;
      if (e.procesoJud) has_proceso_jud = true;
      if (e.enRevision) has_en_revision = true;
    }

    const denominacion = String(res.results?.denominacion ?? '').trim();
    const totalMontoSafe = total_monto || 1;
    const avg_situacion_weighted = sum_sit_monto / totalMontoSafe;
    const share_debt_sit_2plus = sum_monto_sit2plus / totalMontoSafe;
    const share_debt_sit_3plus = sum_monto_sit3plus / totalMontoSafe;
    const avg_dias_atraso_weighted = sum_dias_monto / totalMontoSafe;
    const largest_entity_share = max_entity_amount / totalMontoSafe;

    return {
      bcra_status: 0,
      periodo,
      entidades_count: entidades.length,
      max_situacion,
      total_monto,
      max_dias_atraso,
      max_entity_amount,
      max_entity_name,
      has_refinanciaciones,
      has_recategorizacion_oblig,
      has_situacion_juridica,
      has_irrec_disposicion_tecnica,
      has_proceso_jud,
      has_en_revision,
      denominacion,
      avg_situacion_weighted,
      share_debt_sit_2plus,
      share_debt_sit_3plus,
      avg_dias_atraso_weighted,
      largest_entity_share,
    };
  }

  private sortHistoricalPeriods(
    periodos: BcraHistoricalPeriodo[],
  ): BcraHistoricalPeriodo[] {
    return [...periodos].sort(
      (a, b) =>
        Number(String(a.periodo ?? '0')) - Number(String(b.periodo ?? '0')),
    );
  }

  private computeDebtTotalForPeriodo(p: BcraHistoricalPeriodo): number {
    const entidades = p.entidades ?? [];
    return entidades.reduce((sum, e) => sum + (Number(e.monto) || 0), 0);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private computeTrendAdjustmentPoints(
    historical: NormalizedHistorical,
  ): number {
    const curr = historical.debt_total_current;
    const d3 = historical.debt_total_3m_ago;
    const d6 = historical.debt_total_6m_ago;
    const consecutiveDown = historical.consecutive_months_down_6m ?? 0;
    const consecutiveUp = historical.consecutive_months_up_6m ?? 0;

    if (curr === undefined || d3 === undefined || d6 === undefined) {
      return 0;
    }

    let adj6 = 0;
    let adj3 = 0;
    let adjConsistency = 0;
    const isRelevant = curr >= this.DEBT_RELEVANT_THRESHOLD_M;

    if (d6 === 0) {
      adj6 = isRelevant ? -15 : 0;
    } else {
      const pct6 = ((curr - d6) / d6) * 100;
      if (pct6 <= -25) adj6 = 15;
      else if (pct6 <= -10) adj6 = 10;
      else if (pct6 <= -5) adj6 = 5;
      else if (pct6 >= 25) adj6 = -15;
      else if (pct6 >= 10) adj6 = -10;
      else if (pct6 >= 5) adj6 = -5;
    }

    if (d3 === 0) {
      adj3 = isRelevant ? -8 : 0;
    } else {
      const pct3 = ((curr - d3) / d3) * 100;
      if (pct3 <= -15) adj3 = 5;
      else if (pct3 <= -5) adj3 = 3;
      else if (pct3 >= 15) adj3 = -8;
      else if (pct3 >= 5) adj3 = -4;
    }

    if (consecutiveDown >= 5) adjConsistency = 4;
    else if (consecutiveDown >= 4) adjConsistency = 2;
    else if (consecutiveUp >= 5) adjConsistency = -4;
    else if (consecutiveUp >= 4) adjConsistency = -2;

    return this.clamp(adj6 + adj3 + adjConsistency, -20, 20);
  }

  private normalizeHistorical(
    res: BcraHistoricalResponse | null,
  ): NormalizedHistorical {
    const defaultVal: NormalizedHistorical = {
      worst_historical_situation_24m: 0,
      months_any_sit_2plus_24m: 0,
      months_any_sit_3plus_24m: 0,
      clean_months_24m: 24,
      months_since_last_bad_event: 24,
    };
    if (!res?.results?.periodos?.length) return defaultVal;

    const periodos = this.sortHistoricalPeriods(res.results.periodos);
    let worst = 0;
    let months2plus = 0;
    let months3plus = 0;
    let cleanMonths = 0;
    let monthsSinceBad = 24;
    const debtTotals = periodos.map((p) => this.computeDebtTotalForPeriodo(p));

    for (const p of periodos) {
      const entidades = p.entidades ?? [];
      let periodWorst = 0;
      for (const e of entidades) {
        const sit = Number(e.situacion) || 0;
        if (sit > periodWorst) periodWorst = sit;
      }
      if (periodWorst > worst) worst = periodWorst;
      if (periodWorst >= 2) months2plus += 1;
      if (periodWorst >= 3) months3plus += 1;
      if (periodWorst <= 1) cleanMonths += 1;
    }

    for (let i = periodos.length - 1; i >= 0; i--) {
      const entidades = periodos[i].entidades ?? [];
      let periodWorst = 0;
      for (const e of entidades) {
        const sit = Number(e.situacion) || 0;
        if (sit > periodWorst) periodWorst = sit;
      }
      if (periodWorst >= 2) {
        monthsSinceBad = periodos.length - 1 - i;
        break;
      }
    }

    const out: NormalizedHistorical = {
      worst_historical_situation_24m: worst,
      months_any_sit_2plus_24m: months2plus,
      months_any_sit_3plus_24m: months3plus,
      clean_months_24m: cleanMonths,
      months_since_last_bad_event: monthsSinceBad,
    };

    if (periodos.length >= 7) {
      const lastIdx = periodos.length - 1;
      const curr = debtTotals[lastIdx];
      const d3 = debtTotals[lastIdx - 3];
      const d6 = debtTotals[lastIdx - 6];
      out.debt_total_current = curr;
      out.debt_total_3m_ago = d3;
      out.debt_total_6m_ago = d6;

      if (d6 > 0) out.pct_change_6m = ((curr - d6) / d6) * 100;
      if (d3 > 0) out.pct_change_3m = ((curr - d3) / d3) * 100;

      let consecutiveDown = 0;
      let consecutiveUp = 0;
      for (let i = lastIdx; i >= 1 && i > lastIdx - 6; i--) {
        const diff = debtTotals[i] - debtTotals[i - 1];
        if (diff < 0) {
          if (consecutiveUp > 0) break;
          consecutiveDown++;
        } else if (diff > 0) {
          if (consecutiveDown > 0) break;
          consecutiveUp++;
        } else {
          break;
        }
      }
      if (consecutiveDown > 0) out.consecutive_months_down_6m = consecutiveDown;
      if (consecutiveUp > 0) out.consecutive_months_up_6m = consecutiveUp;
    }

    return out;
  }

  private parseDenominacion(denominacion: string): ParsedDenominacion {
    const trimmed = denominacion.trim();
    if (!trimmed) return { first_name: '', last_name: '', isReliable: false };

    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length === 0)
      return { first_name: '', last_name: '', isReliable: false };
    if (parts.length === 1) {
      const unico = parts[0];
      return {
        first_name: unico,
        last_name: '',
        isReliable:
          unico.length >= 2 && /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s-]+$/.test(unico),
      };
    }

    const primero = parts[0];
    const resto = parts.slice(1).join(' ');
    const alphaOnly = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s-]+$/;
    const isReliable =
      primero.length >= 2 &&
      resto.length >= 2 &&
      alphaOnly.test(primero) &&
      alphaOnly.test(resto) &&
      parts.length <= 5;
    const esApellidoPrimero = primero === primero.toUpperCase();

    return {
      first_name: esApellidoPrimero ? resto : primero,
      last_name: esApellidoPrimero ? primero : resto,
      isReliable,
    };
  }

  private computeZcoreBcraV1(
    latest: NormalizedLatest,
    historical: NormalizedHistorical,
  ): ZcoreBcraResult {
    const hardReject =
      latest.has_proceso_jud ||
      latest.has_situacion_juridica ||
      latest.has_irrec_disposicion_tecnica ||
      latest.max_situacion >= 4;

    if (hardReject) {
      return {
        zcore_bcra: 0,
        score_initial: 0,
        score_reason: 'HARD_REJECT_ZCORE_BCRA_V1',
        model_version: 'ZCORE_BCRA_V1',
        eligible: false,
        risk_level: 'HIGH',
      };
    }

    const normSituation = (x: number) => (Math.min(Math.max(x, 1), 5) - 1) / 4;
    const normDays = (x: number) => Math.min(Math.max(x, 0), 180) / 180;
    const normEntities = (x: number) => Math.min(Math.max(x, 0), 8) / 8;
    const normDebtLoad = (totalMontoBcra: number) => {
      const totalMontoPesos = Math.max(totalMontoBcra, 0) * 1000;
      const minDebt = 1_000_000;
      const maxDebt = 15_000_000;
      if (totalMontoPesos <= minDebt) return 0;
      if (totalMontoPesos >= maxDebt) return 1;
      const base =
        Math.log10(totalMontoPesos / minDebt) / Math.log10(maxDebt / minDebt);
      return Math.pow(base, 1.35);
    };

    const rActual =
      0.45 * normSituation(latest.max_situacion) +
      0.35 * normSituation(latest.avg_situacion_weighted) +
      0.1 * latest.share_debt_sit_2plus +
      0.1 * latest.share_debt_sit_3plus;
    const rMora =
      0.6 * normDays(latest.max_dias_atraso) +
      0.4 * normDays(latest.avg_dias_atraso_weighted);
    const rFlags = Math.max(
      latest.has_refinanciaciones ? 0.45 : 0,
      latest.has_recategorizacion_oblig ? 0.75 : 0,
      latest.has_en_revision ? 0.15 : 0,
    );
    const rHistory =
      0.3 * normSituation(historical.worst_historical_situation_24m) +
      0.25 * (historical.months_any_sit_2plus_24m / 24) +
      0.25 * (historical.months_any_sit_3plus_24m / 24) +
      0.2 * (1 - Math.min(historical.months_since_last_bad_event, 24) / 24);
    const rStructure =
      0.6 * normEntities(latest.entidades_count) +
      0.4 * latest.largest_entity_share;
    const rDebtLoad = normDebtLoad(latest.total_monto);

    const rTotal =
      0.25 * rActual +
      0.15 * rMora +
      0.12 * rFlags +
      0.2 * rHistory +
      0.095 * rStructure +
      0.185 * rDebtLoad;

    const zcoreBase = Math.round(1000 * (1 - rTotal));
    const trendAdjustmentPoints = this.computeTrendAdjustmentPoints(historical);
    const zcoreBcra = this.clamp(zcoreBase + trendAdjustmentPoints, 0, 1000);
    const eligible = zcoreBcra >= 600;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
    if (zcoreBcra >= 800) riskLevel = 'LOW';
    else if (zcoreBcra >= 600) riskLevel = 'MEDIUM';

    return {
      zcore_bcra: zcoreBcra,
      score_initial: zcoreBcra,
      score_reason: 'ZCORE_BCRA_V1',
      model_version: 'ZCORE_BCRA_V1',
      eligible,
      risk_level: riskLevel,
    };
  }
}
