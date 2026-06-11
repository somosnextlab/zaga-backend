import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DbClient } from '../../db/db.service';
import {
  ContractDataSubject,
  ContractDataTokenStatus,
} from '../interfaces/contract-data.interface';

interface InsertTokenInput {
  readonly caseId: string;
  readonly subject: ContractDataSubject;
  readonly expiresAt: Date;
}

interface InsertedTokenRow {
  readonly token: string;
  readonly subject: ContractDataSubject;
  readonly expires_at: Date;
}

interface ValidTokenRow {
  readonly token: string;
  readonly case_id: string;
  readonly subject: ContractDataSubject;
  readonly status: ContractDataTokenStatus;
  readonly expires_at: Date;
}

interface PendingTokenRow {
  readonly token: string;
  readonly subject: ContractDataSubject;
  readonly expires_at: Date;
}

@Injectable()
export class ContractDataTokensRepository {
  public async insertTokens(
    client: DbClient,
    tokens: InsertTokenInput[],
  ): Promise<InsertedTokenRow[]> {
    if (tokens.length === 0) {
      return [];
    }

    const params: unknown[] = [];
    const valueRows = tokens.map((token, index) => {
      const base = index * 4;
      params.push(randomUUID(), token.caseId, token.subject, token.expiresAt);
      return `($${base + 1}, $${base + 2}, $${base + 3}, 'PENDING', $${base + 4})`;
    });

    const result = await client.query<InsertedTokenRow>(
      `
      INSERT INTO contract_data_tokens (token, case_id, subject, status, expires_at)
      VALUES ${valueRows.join(', ')}
      RETURNING token, subject, expires_at
      `,
      params,
    );
    return result.rows;
  }

  public async findValidToken(
    client: DbClient,
    tokenValue: string,
    subject: ContractDataSubject,
  ): Promise<ValidTokenRow | null> {
    const result = await client.query<ValidTokenRow>(
      `
      SELECT token, case_id, subject, status, expires_at
      FROM contract_data_tokens
      WHERE token = $1
        AND subject = $2
      FOR UPDATE
      `,
      [tokenValue, subject],
    );
    return result.rows[0] ?? null;
  }

  public async markTokenUsed(
    client: DbClient,
    tokenValue: string,
  ): Promise<void> {
    await client.query(
      `
      UPDATE contract_data_tokens
      SET status = 'USED', used_at = now()
      WHERE token = $1
      `,
      [tokenValue],
    );
  }

  public async findPendingTokensByCaseId(
    client: DbClient,
    caseId: string,
  ): Promise<PendingTokenRow[]> {
    const result = await client.query<PendingTokenRow>(
      `
      SELECT token, subject, expires_at
      FROM contract_data_tokens
      WHERE case_id = $1
        AND status = 'PENDING'
      `,
      [caseId],
    );
    return result.rows;
  }

  /**
   * Sujetos cuyo token ya fue consumido (status USED). Permite no regenerar un
   * token de un sujeto que ya completó el formulario (idempotencia por sujeto).
   */
  public async findUsedSubjectsByCaseId(
    client: DbClient,
    caseId: string,
  ): Promise<ContractDataSubject[]> {
    const result = await client.query<{ subject: ContractDataSubject }>(
      `
      SELECT DISTINCT subject
      FROM contract_data_tokens
      WHERE case_id = $1
        AND status = 'USED'
      `,
      [caseId],
    );
    return result.rows.map((row) => row.subject);
  }

  public async expireTokenBySubject(
    client: DbClient,
    caseId: string,
    subject: ContractDataSubject,
  ): Promise<void> {
    await client.query(
      `
      UPDATE contract_data_tokens
      SET status = 'EXPIRED'
      WHERE case_id = $1
        AND subject = $2
        AND status = 'PENDING'
      `,
      [caseId, subject],
    );
  }

  public async expireTokensByCaseId(
    client: DbClient,
    caseId: string,
  ): Promise<void> {
    await client.query(
      `
      UPDATE contract_data_tokens
      SET status = 'EXPIRED'
      WHERE case_id = $1
        AND status = 'PENDING'
      `,
      [caseId],
    );
  }

  public async countUsedTokensByCaseId(
    client: DbClient,
    caseId: string,
  ): Promise<{ total: number; used: number }> {
    const result = await client.query<{ total: number; used: number }>(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'USED')::int AS used
      FROM contract_data_tokens
      WHERE case_id = $1
      `,
      [caseId],
    );
    const row = result.rows[0];
    return { total: row?.total ?? 0, used: row?.used ?? 0 };
  }
}
