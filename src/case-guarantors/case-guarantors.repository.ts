/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import type { DbClient } from '../db/db.service';
import type {
  CaseForGuarantorEvaluationRow,
  CaseGuarantorAttemptRow,
  CaseGuarantorEvaluationPersisted,
  FinalizeCaseGuarantorEvaluationInput,
  InsertCaseGuarantorInput,
} from './interfaces/case-guarantors.interface';

function firstRowOrThrow<T>(rows: T[], message: string): T {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(message);
  }
  return row;
}

@Injectable()
export class CaseGuarantorsRepository {
  public async findCaseByIdForUpdate(
    client: DbClient,
    caseId: string,
  ): Promise<CaseForGuarantorEvaluationRow | null> {
    const result = await client.query<CaseForGuarantorEvaluationRow>(
      `
      SELECT c.id, c.status, c.requires_guarantor, u.cuit AS applicant_cuit
      FROM cases c
      INNER JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
      FOR UPDATE
      `,
      [caseId],
    );
    return result.rows[0] ?? null;
  }

  public async findCaseGuarantorsByCaseIdForUpdate(
    client: DbClient,
    caseId: string,
  ): Promise<CaseGuarantorAttemptRow[]> {
    const result = await client.query<CaseGuarantorAttemptRow>(
      `
      SELECT id, cuit, attempt_no, status, reviewed_by
      FROM case_guarantors
      WHERE case_id = $1
      ORDER BY attempt_no ASC
      FOR UPDATE
      `,
      [caseId],
    );
    return result.rows;
  }

  public async updateCaseStatus(
    client: DbClient,
    caseId: string,
    status: string,
  ): Promise<void> {
    await client.query(
      `UPDATE cases SET status = $2, updated_at = now() WHERE id = $1`,
      [caseId, status],
    );
  }

  public async markGuarantorApprovedByCeoForNosis(
    client: DbClient,
    input: { readonly candidateId: string; readonly reviewedBy: string },
  ): Promise<boolean> {
    const result = await client.query(
      `
      UPDATE case_guarantors
      SET reviewed_at = now(),
          reviewed_by = $2,
          updated_at = now()
      WHERE id = $1 AND status = 'APPROVED'
      RETURNING id
      `,
      [input.candidateId, input.reviewedBy],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async rejectGuarantorCandidateByCeo(
    client: DbClient,
    input: {
      readonly candidateId: string;
      readonly reviewedBy: string;
      readonly reviewReason: string;
    },
  ): Promise<boolean> {
    const result = await client.query(
      `
      UPDATE case_guarantors
      SET status = 'REJECTED',
          eligible = false,
          reviewed_at = now(),
          reviewed_by = $2,
          review_reason = $3,
          updated_at = now()
      WHERE id = $1 AND status = 'APPROVED'
      RETURNING id
      `,
      [input.candidateId, input.reviewedBy, input.reviewReason],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async applyAprobadoFinalFromPendingNosis(
    client: DbClient,
    caseId: string,
  ): Promise<
    | { readonly outcome: 'SUCCESS' }
    | {
        readonly outcome:
          | 'CASE_NOT_FOUND'
          | 'CASE_STATUS_INVALID'
          | 'CURRENT_OFFER_NOT_FOUND';
      }
  > {
    const locked = await client.query<{
      id: string;
      status: string;
      current_offer_id: string | null;
    }>(
      `SELECT id, status, current_offer_id FROM cases WHERE id = $1 FOR UPDATE`,
      [caseId],
    );
    const caseRow = locked.rows[0];
    if (!caseRow) {
      return { outcome: 'CASE_NOT_FOUND' };
    }
    if (caseRow.status !== 'PENDING_NOSIS') {
      return { outcome: 'CASE_STATUS_INVALID' };
    }
    if (!caseRow.current_offer_id) {
      return { outcome: 'CURRENT_OFFER_NOT_FOUND' };
    }

    await client.query(
      `UPDATE cases SET status = 'APROBADO_FINAL', updated_at = now() WHERE id = $1`,
      [caseId],
    );
    await client.query(
      `
      UPDATE case_offers
      SET status = 'ACCEPTED',
          accepted_at = COALESCE(accepted_at, now()),
          updated_at = now()
      WHERE id = $1 AND case_id = $2
      `,
      [caseRow.current_offer_id, caseId],
    );

    return { outcome: 'SUCCESS' };
  }

  public async insertEvaluatingCandidate(
    client: DbClient,
    input: InsertCaseGuarantorInput,
  ): Promise<{ id: string }> {
    const result = await client.query<{ id: string }>(
      `
      INSERT INTO case_guarantors (
        case_id, cuit, status, attempt_no, created_at, updated_at
      ) VALUES (
        $1, $2, 'EVALUATING', $3, now(), now()
      )
      RETURNING id
      `,
      [input.caseId, input.cuit, input.attemptNo],
    );

    return firstRowOrThrow(
      result.rows,
      'No se pudo crear el candidato garante en evaluación.',
    );
  }

  public async deleteCandidateById(
    client: DbClient,
    candidateId: string,
  ): Promise<void> {
    await client.query(`DELETE FROM case_guarantors WHERE id = $1`, [
      candidateId,
    ]);
  }

  public async finalizeEvaluation(
    client: DbClient,
    input: FinalizeCaseGuarantorEvaluationInput,
  ): Promise<CaseGuarantorEvaluationPersisted> {
    const result = await client.query<CaseGuarantorEvaluationPersisted>(
      `
      UPDATE case_guarantors
      SET status = $2,
          evaluation_engine = $3,
          eligible = $4,
          zcore_bcra = $5,
          risk_level = $6,
          score_reason = $7,
          periodo = $8,
          reviewed_at = now(),
          reviewed_by = $9,
          review_reason = $10,
          updated_at = now()
      WHERE id = $1
      RETURNING case_id, attempt_no, status, eligible, zcore_bcra, risk_level, score_reason, periodo
      `,
      [
        input.candidateId,
        input.candidateStatus,
        input.evaluationEngine,
        input.eligible,
        input.zcoreBcra,
        input.riskLevel,
        input.scoreReason,
        input.periodo,
        input.reviewedBy,
        input.reviewReason,
      ],
    );

    return firstRowOrThrow(
      result.rows,
      'No se pudo finalizar la evaluación del garante.',
    );
  }
}
