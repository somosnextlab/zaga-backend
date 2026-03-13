/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';

type BcraClassification = 'SUCCESS' | 'BUSINESS' | 'TECHNICAL';

interface BcraLatestEntity {
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

interface BcraLatestPeriodo {
  periodo: string;
  entidades: BcraLatestEntity[];
}

interface BcraLatestResults {
  identificacion?: number;
  denominacion?: string;
  periodos?: BcraLatestPeriodo[];
}

interface BcraLatestResponse {
  status?: number;
  results?: BcraLatestResults;
}

interface BcraHistoricalEntity {
  entidad: string;
  situacion: number;
  monto: number;
  enRevision?: boolean;
  procesoJud?: boolean;
}

interface BcraHistoricalPeriodo {
  periodo: string;
  entidades: BcraHistoricalEntity[];
}

interface BcraHistoricalResults {
  periodos?: BcraHistoricalPeriodo[];
}

interface BcraHistoricalResponse {
  status?: number;
  results?: BcraHistoricalResults;
}

interface NormalizedLatest {
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

interface NormalizedHistorical {
  worst_historical_situation_24m: number;
  months_any_sit_2plus_24m: number;
  months_any_sit_3plus_24m: number;
  clean_months_24m: number;
  months_since_last_bad_event: number;
}

interface ParsedDenominacion {
  first_name: string;
  last_name: string;
  isReliable: boolean;
}

interface PrequalSuccessResponse {
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

interface PrequalErrorResponse {
  ok: false;
  error_type: 'TECHNICAL' | 'BUSINESS';
  error_code: string;
}

type PrequalResponse = PrequalSuccessResponse | PrequalErrorResponse;

const CUIT_DIGITS_LENGTH = 11;
const PERIODO_REGEX = /^\d{6}$/;

@Injectable()
export class PrequalService {
  private readonly bcraLatestUrl: string;
  private readonly bcraHistoricalUrl: string;
  private readonly bcraTimeoutMs: number;

  public constructor(
    private readonly dbService: DbService,
    private readonly configService: ConfigService,
  ) {
    this.bcraLatestUrl =
      this.configService.get<string>('BCRA_API_LATEST_URL') ??
      'https://api.bcra.gob.ar/centraldedeudores/v1.0/deudas';
    this.bcraHistoricalUrl =
      this.configService.get<string>('BCRA_API_HISTORICAL_URL') ??
      'https://api.bcra.gob.ar/centraldedeudores/v1.0/deudas/historicas';
    this.bcraTimeoutMs =
      Number(this.configService.get<string>('BCRA_API_TIMEOUT_MS')) || 15000;
  }

  public async runPrequal(input: {
    userId: string;
    phone: string;
    cuit: string;
  }): Promise<PrequalResponse> {
    const normalizedCuit = this.normalizeCuit(input.cuit);
    if (!normalizedCuit) {
      return {
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'INVALID_INPUT',
      };
    }

    const user = await this.findUserById(input.userId);
    if (!user) {
      return {
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'USER_NOT_FOUND',
      };
    }

    const [latestRes, historicalRes] = await Promise.all([
      this.fetchBcraLatest(normalizedCuit),
      this.fetchBcraHistorical24m(normalizedCuit),
    ]);

    const classification = this.classifyBcraResponses(latestRes, historicalRes);
    if (classification.type !== 'SUCCESS') {
      return {
        ok: false,
        error_type: classification.type,
        error_code: classification.code ?? 'UNKNOWN',
      };
    }

    const normalizedLatest = this.normalizeLatest(latestRes);
    if (!normalizedLatest) {
      return {
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'BCRA_INVALID_PAYLOAD',
      };
    }

    const normalizedHistorical = this.normalizeHistorical(historicalRes);
    const parsedName = this.parseDenominacion(normalizedLatest.denominacion);
    const scoreResult = this.computeZcoreBcraV1(
      normalizedLatest,
      normalizedHistorical,
    );

    const raw = {
      latest: latestRes,
      historical24m: historicalRes,
    };

    await this.dbService.withTransaction(async (client: PoolClient) => {
      if (
        this.shouldPersistParsedName(parsedName) &&
        (parsedName.first_name || parsedName.last_name)
      ) {
        await this.updateUserName(client, input.userId, parsedName);
      }
      await this.upsertUserPrequal(client, {
        user_id: input.userId,
        phone: input.phone,
        cuit: normalizedCuit,
        ...normalizedLatest,
        eligible: scoreResult.eligible,
        risk_level: scoreResult.risk_level,
        score_initial: scoreResult.score_initial,
        score_reason: scoreResult.score_reason,
        zcore_bcra: scoreResult.zcore_bcra,
        model_version: scoreResult.model_version,
        raw: JSON.stringify(raw),
      });
    });

    return {
      ok: true,
      eligible: scoreResult.eligible,
      risk_level: scoreResult.risk_level,
      zcore_bcra: scoreResult.zcore_bcra,
      score_initial: scoreResult.score_initial,
      score_reason: scoreResult.score_reason,
      model_version: scoreResult.model_version,
      periodo: normalizedLatest.periodo,
      first_name: parsedName.first_name,
      last_name: parsedName.last_name,
    };
  }

  private normalizeCuit(cuit: string): string | null {
    const digits = cuit.replace(/\D/g, '');
    return digits.length === CUIT_DIGITS_LENGTH ? digits : null;
  }

  private async findUserById(userId: string): Promise<{
    id: string;
    phone: string;
    cuit: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null> {
    const result = await this.dbService.query<{
      id: string;
      phone: string;
      cuit: string | null;
      first_name: string | null;
      last_name: string | null;
    }>(
      `SELECT id, phone, cuit, first_name, last_name
       FROM users
       WHERE id = $1`,
      [userId],
    );
    return result.rows[0] ?? null;
  }

  private async fetchBcraLatest(
    cuit: string,
  ): Promise<BcraLatestResponse | null> {
    const url = `${this.bcraLatestUrl}/${cuit}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.bcraTimeoutMs,
      );
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status === 404)
        return { results: { periodos: [] } } as BcraLatestResponse;
      if (res.status >= 500) throw new Error('BCRA 5xx');
      const json = (await res.json()) as BcraLatestResponse;
      return json;
    } catch {
      return null;
    }
  }

  private async fetchBcraHistorical24m(
    cuit: string,
  ): Promise<BcraHistoricalResponse | null> {
    const url = `${this.bcraHistoricalUrl}/${cuit}`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.bcraTimeoutMs,
      );
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.status === 404)
        return { results: { periodos: [] } } as BcraHistoricalResponse;
      if (res.status >= 500) throw new Error('BCRA 5xx');
      const json = (await res.json()) as BcraHistoricalResponse;
      return json;
    } catch {
      return null;
    }
  }

  private classifyBcraResponses(
    latest: BcraLatestResponse | null,
    historical: BcraHistoricalResponse | null,
  ): { type: BcraClassification; code?: string } {
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
      return { type: 'BUSINESS', code: 'BCRA_INVALID_PAYLOAD' };
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
      avg_situacion_weighted: avg_situacion_weighted,
      share_debt_sit_2plus,
      share_debt_sit_3plus,
      avg_dias_atraso_weighted,
      largest_entity_share,
    };
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

    const periodos = res.results.periodos;
    let worst = 0;
    let months_2plus = 0;
    let months_3plus = 0;
    let clean_months = 0;
    let months_since_bad = 24;

    for (const p of periodos) {
      const entidades = p.entidades ?? [];
      let periodWorst = 0;
      for (const e of entidades) {
        const sit = Number(e.situacion) || 0;
        if (sit > periodWorst) periodWorst = sit;
      }
      if (periodWorst > worst) worst = periodWorst;
      if (periodWorst >= 2) months_2plus += 1;
      if (periodWorst >= 3) months_3plus += 1;
      if (periodWorst <= 1) clean_months += 1;
    }

    for (let i = periodos.length - 1; i >= 0; i--) {
      const p = periodos[i];
      const entidades = p.entidades ?? [];
      let periodWorst = 0;
      for (const e of entidades) {
        const sit = Number(e.situacion) || 0;
        if (sit > periodWorst) periodWorst = sit;
      }
      if (periodWorst >= 2) {
        months_since_bad = periodos.length - 1 - i;
        break;
      }
    }

    return {
      worst_historical_situation_24m: worst,
      months_any_sit_2plus_24m: months_2plus,
      months_any_sit_3plus_24m: months_3plus,
      clean_months_24m: clean_months,
      months_since_last_bad_event: months_since_bad,
    };
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

    // Heurística: si la primera palabra está en MAYÚSCULAS → "APELLIDO NOMBRES"
    // Si no → "NOMBRES APELLIDO" (formato típico español)
    const esApellidoPrimero = primero === primero.toUpperCase();

    return {
      first_name: esApellidoPrimero ? resto : primero,
      last_name: esApellidoPrimero ? primero : resto,
      isReliable,
    };
  }

  private shouldPersistParsedName(parsed: ParsedDenominacion): boolean {
    return parsed.isReliable;
  }

  private computeZcoreBcraV1(
    latest: NormalizedLatest,
    historical: NormalizedHistorical,
  ): {
    zcore_bcra: number;
    score_initial: number;
    score_reason: string;
    model_version: string;
    eligible: boolean;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  } {
    const hardReject =
      latest.has_proceso_jud ||
      latest.has_situacion_juridica ||
      latest.has_irrec_disposicion_tecnica ||
      latest.max_situacion >= 5;

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

    /**
     * OJO:
     * latest.total_monto viene del BCRA en miles de pesos.
     * Para esta función convertimos a pesos reales antes de penalizar.
     */
    const normDebtLoad = (totalMontoBcra: number) => {
      const totalMontoPesos = Math.max(totalMontoBcra, 0) * 1000;

      /**
       * Escala de negocio en pesos:
       * - hasta 250.000 => penalización 0
       * - 15.000.000 o más => penalización 1
       *
       * La curva es logarítmica + potencia para endurecer el tramo alto.
       */
      const minDebt = 250_000;
      const maxDebt = 15_000_000;

      if (totalMontoPesos <= minDebt) return 0;
      if (totalMontoPesos >= maxDebt) return 1;

      const base =
        Math.log10(totalMontoPesos / minDebt) / Math.log10(maxDebt / minDebt);

      return Math.pow(base, 1.35);
    };

    const worst_current_situation = latest.max_situacion;
    const avg_current_situation_weighted = latest.avg_situacion_weighted;
    const share_debt_sit_2plus = latest.share_debt_sit_2plus;
    const share_debt_sit_3plus = latest.share_debt_sit_3plus;
    const max_days_past_due = latest.max_dias_atraso;
    const avg_days_past_due_weighted = latest.avg_dias_atraso_weighted;
    const entities_count_current = latest.entidades_count;
    const largest_entity_share = latest.largest_entity_share;
    const total_debt = latest.total_monto;

    const R_actual =
      0.45 * normSituation(worst_current_situation) +
      0.35 * normSituation(avg_current_situation_weighted) +
      0.1 * share_debt_sit_2plus +
      0.1 * share_debt_sit_3plus;

    const R_mora =
      0.6 * normDays(max_days_past_due) +
      0.4 * normDays(avg_days_past_due_weighted);

    const R_flags = Math.max(
      latest.has_refinanciaciones ? 0.45 : 0,
      latest.has_recategorizacion_oblig ? 0.75 : 0,
      latest.has_en_revision ? 0.15 : 0,
    );

    const R_history =
      0.3 * normSituation(historical.worst_historical_situation_24m) +
      0.25 * (historical.months_any_sit_2plus_24m / 24) +
      0.25 * (historical.months_any_sit_3plus_24m / 24) +
      0.2 * (1 - Math.min(historical.months_since_last_bad_event, 24) / 24);

    const R_structure =
      0.6 * normEntities(entities_count_current) + 0.4 * largest_entity_share;

    /**
     * Penalización explícita por carga de deuda total.
     */
    const R_debt_load = normDebtLoad(total_debt);

    /**
     * Mantenemos la recalibración que ya habíamos definido:
     * el endeudamiento pesa fuerte.
     */
    const R_total =
      0.24 * R_actual +
      0.14 * R_mora +
      0.1 * R_flags +
      0.17 * R_history +
      0.1 * R_structure +
      0.25 * R_debt_load;

    const zcore_bcra = Math.round(1000 * (1 - R_total));
    const eligible = zcore_bcra >= 600;

    let risk_level: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
    if (zcore_bcra >= 800) risk_level = 'LOW';
    else if (zcore_bcra >= 600) risk_level = 'MEDIUM';

    return {
      zcore_bcra,
      score_initial: zcore_bcra,
      score_reason: 'ZCORE_BCRA_V1',
      model_version: 'ZCORE_BCRA_V1',
      eligible,
      risk_level,
    };
  }

  private async updateUserName(
    client: PoolClient,
    userId: string,
    parsed: ParsedDenominacion,
  ): Promise<void> {
    await client.query(
      `UPDATE users SET first_name = $2, last_name = $3 WHERE id = $1`,
      [userId, parsed.first_name, parsed.last_name],
    );
  }

  private async upsertUserPrequal(
    client: PoolClient,
    row: {
      user_id: string;
      phone: string;
      cuit: string;
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
      eligible: boolean;
      risk_level: string;
      score_initial: number;
      score_reason: string;
      zcore_bcra: number;
      model_version: string;
      raw: string;
    },
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO user_prequals (
        user_id, phone, cuit, bcra_status, periodo, entidades_count,
        max_situacion, total_monto, max_dias_atraso, max_entity_amount,
        max_entity_name, has_refinanciaciones, has_recategorizacion_oblig,
        has_situacion_juridica, has_irrec_disposicion_tecnica, has_proceso_jud,
        has_en_revision, eligible, risk_level, score_initial, score_reason,
        zcore_bcra, model_version, raw, checked_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17, $18, $19, $20, $21, $22, $23, $24::jsonb, now()
      )
      ON CONFLICT (user_id, periodo) DO UPDATE SET
        bcra_status = EXCLUDED.bcra_status,
        entidades_count = EXCLUDED.entidades_count,
        max_situacion = EXCLUDED.max_situacion,
        total_monto = EXCLUDED.total_monto,
        max_dias_atraso = EXCLUDED.max_dias_atraso,
        max_entity_amount = EXCLUDED.max_entity_amount,
        max_entity_name = EXCLUDED.max_entity_name,
        has_refinanciaciones = EXCLUDED.has_refinanciaciones,
        has_recategorizacion_oblig = EXCLUDED.has_recategorizacion_oblig,
        has_situacion_juridica = EXCLUDED.has_situacion_juridica,
        has_irrec_disposicion_tecnica = EXCLUDED.has_irrec_disposicion_tecnica,
        has_proceso_jud = EXCLUDED.has_proceso_jud,
        has_en_revision = EXCLUDED.has_en_revision,
        eligible = EXCLUDED.eligible,
        risk_level = EXCLUDED.risk_level,
        score_initial = EXCLUDED.score_initial,
        score_reason = EXCLUDED.score_reason,
        zcore_bcra = EXCLUDED.zcore_bcra,
        model_version = EXCLUDED.model_version,
        raw = EXCLUDED.raw,
        checked_at = now()
      `,
      [
        row.user_id,
        row.phone,
        row.cuit,
        row.bcra_status,
        row.periodo,
        row.entidades_count,
        row.max_situacion,
        row.total_monto,
        row.max_dias_atraso,
        row.max_entity_amount,
        row.max_entity_name,
        row.has_refinanciaciones,
        row.has_recategorizacion_oblig,
        row.has_situacion_juridica,
        row.has_irrec_disposicion_tecnica,
        row.has_proceso_jud,
        row.has_en_revision,
        row.eligible,
        row.risk_level,
        row.score_initial,
        row.score_reason,
        row.zcore_bcra,
        row.model_version,
        row.raw,
      ],
    );
  }
}
