/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { BcraZcoreEngineService } from './bcra-zcore-engine.service';
import type {
  ParsedDenominacion,
  PrequalResponse,
  PrequalSuccessResponse,
} from './prequal.types';

@Injectable()
export class PrequalService {
  public constructor(
    private readonly dbService: DbService,
    private readonly bcraZcoreEngineService: BcraZcoreEngineService,
  ) {}

  public async runPrequal(input: {
    userId: string;
    phone: string;
    cuit: string;
  }): Promise<PrequalResponse> {
    const normalizedCuit = this.bcraZcoreEngineService.normalizeCuit(
      input.cuit,
    );
    if (!normalizedCuit) {
      return {
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'INVALID_INPUT',
        bypass_allowed: false,
      };
    }

    const user = await this.findUserById(input.userId);
    if (!user) {
      return {
        ok: false,
        error_type: 'BUSINESS',
        error_code: 'USER_NOT_FOUND',
        bypass_allowed: false,
      };
    }

    const evaluation =
      await this.bcraZcoreEngineService.evaluateNormalizedCuit(normalizedCuit);

    if (!evaluation.ok) {
      const bypassAllowed =
        evaluation.error_code === 'BCRA_NO_DATA' ||
        evaluation.error_code === 'BCRA_UNAVAILABLE';
      const manualReviewReason =
        evaluation.error_code === 'BCRA_NO_DATA' ||
        evaluation.error_code === 'BCRA_UNAVAILABLE'
          ? evaluation.error_code
          : undefined;

      return {
        ok: false,
        error_type: evaluation.error_type,
        error_code: evaluation.error_code,
        bypass_allowed: bypassAllowed,
        ...(manualReviewReason && {
          manual_review_reason: manualReviewReason,
        }),
      };
    }

    await this.dbService.withTransaction(async (client: PoolClient) => {
      if (
        this.shouldPersistParsedName(evaluation.parsed_denominacion) &&
        (evaluation.parsed_denominacion.first_name ||
          evaluation.parsed_denominacion.last_name)
      ) {
        await this.updateUserName(
          client,
          input.userId,
          evaluation.parsed_denominacion,
        );
      }
      await this.upsertUserPrequal(client, {
        user_id: input.userId,
        phone: input.phone,
        cuit: normalizedCuit,
        ...evaluation.normalized_latest,
        eligible: evaluation.score.eligible,
        risk_level: evaluation.score.risk_level,
        score_initial: evaluation.score.score_initial,
        score_reason: evaluation.score.score_reason,
        zcore_bcra: evaluation.score.zcore_bcra,
        model_version: evaluation.score.model_version,
        raw: JSON.stringify(evaluation.raw),
      });

      if (!evaluation.score.eligible) {
        await this.setLeadRejected(client, input.phone);
      }
    });

    const response: PrequalSuccessResponse = {
      ok: true,
      eligible: evaluation.score.eligible,
      risk_level: evaluation.score.risk_level,
      zcore_bcra: evaluation.score.zcore_bcra,
      score_initial: evaluation.score.score_initial,
      score_reason: evaluation.score.score_reason,
      model_version: evaluation.score.model_version,
      periodo: evaluation.normalized_latest.periodo,
      first_name: evaluation.parsed_denominacion.first_name,
      last_name: evaluation.parsed_denominacion.last_name,
    };

    return response;
  }

  private shouldPersistParsedName(parsed: ParsedDenominacion): boolean {
    return parsed.isReliable;
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

  private async setLeadRejected(
    client: PoolClient,
    phone: string,
  ): Promise<void> {
    await client.query(
      `
      UPDATE leads
      SET stage = 'REJECTED',
          updated_at = now()
      WHERE phone = $1
        AND stage IN (
          'DATA_COMPLETE',
          'WAITING_AMOUNT_RANGE',
          'WAITING_AMOUNT_RANGE_MANUAL_REVIEW',
          'REJECTED'
        )
      `,
      [phone],
    );
  }
}
