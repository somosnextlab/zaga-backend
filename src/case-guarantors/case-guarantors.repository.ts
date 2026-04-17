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
      SELECT id, status, requires_guarantor
      FROM cases
      WHERE id = $1
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
      SELECT id, cuit
      FROM case_guarantors
      WHERE case_id = $1
      ORDER BY attempt_no ASC
      FOR UPDATE
      `,
      [caseId],
    );
    return result.rows;
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
