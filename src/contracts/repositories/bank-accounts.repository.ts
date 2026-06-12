import { Injectable } from '@nestjs/common';
import { DbClient } from '../../db/db.service';
import { BankAccountKind } from '../interfaces/contract-data.interface';

interface UpsertBankAccountInput {
  readonly userId: string;
  readonly accountKind: BankAccountKind | null;
  readonly cbuCvu: string;
  readonly alias?: string | null;
  readonly bankName: string;
}

@Injectable()
export class BankAccountsRepository {
  public async upsertBankAccount(
    client: DbClient,
    input: UpsertBankAccountInput,
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `
      INSERT INTO bank_accounts (user_id, account_kind, cbu_cvu, alias, bank_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (user_id, cbu_cvu) DO UPDATE
      SET alias = EXCLUDED.alias,
          bank_name = EXCLUDED.bank_name,
          is_active = true
      RETURNING id
      `,
      [
        input.userId,
        input.accountKind,
        input.cbuCvu,
        input.alias ?? null,
        input.bankName,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('No se pudo registrar la cuenta bancaria.');
    }
    return row.id;
  }

  public async setBankAccountForDisbursement(
    client: DbClient,
    caseId: string,
    bankAccountId: string,
  ): Promise<void> {
    await client.query(
      `
      UPDATE cases
      SET disbursement_bank_account_id = $1
      WHERE id = $2
      `,
      [bankAccountId, caseId],
    );
  }
}
