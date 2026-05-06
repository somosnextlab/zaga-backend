/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { DbClient } from '../db/db.service';
import { DbService } from '../db/db.service';
import { LeadStage } from '../lead-stage.enum';
import { assertValidRequestedAmount } from './case-requested-amount';
import type { CreateCaseFromRequestedAmountDto } from './dto/create-case-from-requested-amount.dto';
import type {
  CreateCaseFromRequestedAmountBusinessErrorCode,
  CreateCaseFromRequestedAmountErrorResponse,
  CreateCaseFromRequestedAmountManualReviewReason,
  CreateCaseFromRequestedAmountResponse,
  CreateCaseFromRequestedAmountSuccessResponse,
} from './interfaces/create-case-from-requested-amount.interface';
import { normalizeCaseCreationPhone } from './phone-normalize';

const ALLOWED_LEAD_STAGES_FOR_CASE_CREATION: ReadonlySet<string> = new Set([
  LeadStage.WAITING_REQUESTED_AMOUNT,
  LeadStage.WAITING_REQUESTED_AMOUNT_MANUAL_REVIEW,
]);

type LeadRow = {
  id: string;
  phone: string;
  stage: string;
  current_case_id: string | null;
  manual_review_reason: string | null;
};

type UserRow = {
  id: string;
  phone: string;
  is_completed: boolean;
  first_name: string | null;
  last_name: string | null;
  cuit: string | null;
};

type InsertedCaseRow = {
  id: string;
  phone: string;
  user_id: string;
  status: string;
  requested_amount: string | number;
  prequal_mode: string | null;
  manual_review_reason: string | null;
};

@Injectable()
export class CasesFromRequestedAmountService {
  public constructor(private readonly dbService: DbService) {}

  public async createFromRequestedAmount(
    dto: CreateCaseFromRequestedAmountDto,
  ): Promise<CreateCaseFromRequestedAmountResponse> {
    assertValidRequestedAmount(dto.requested_amount);
    const phone = normalizeCaseCreationPhone(dto.phone);

    return this.dbService.withTransaction(
      async (
        client: DbClient,
      ): Promise<CreateCaseFromRequestedAmountResponse> => {
        const lead = await this.findLeadForUpdate(client, phone);
        if (!lead) {
          return this.businessError('LEAD_NOT_FOUND');
        }

        if (!ALLOWED_LEAD_STAGES_FOR_CASE_CREATION.has(lead.stage)) {
          return this.businessError('INVALID_LEAD_STAGE_FOR_CASE_CREATION');
        }

        if (lead.current_case_id !== null) {
          return this.businessError('ACTIVE_CASE_ALREADY_EXISTS');
        }

        const user = await this.findUserByPhone(client, phone);
        if (!user) {
          return this.businessError('USER_NOT_FOUND');
        }

        if (user.is_completed !== true) {
          return this.businessError('USER_NOT_COMPLETED');
        }

        const stage = lead.stage as LeadStage;
        const isManualReview =
          stage === LeadStage.WAITING_REQUESTED_AMOUNT_MANUAL_REVIEW;
        const prequal_mode = isManualReview ? 'MANUAL_REVIEW' : 'AUTO_OK';
        const manual_review_reason = isManualReview
          ? lead.manual_review_reason
          : null;

        const inserted = await this.insertCase(client, {
          userId: user.id,
          phone,
          requestedAmount: dto.requested_amount,
          prequalMode: prequal_mode,
          manualReviewReason: manual_review_reason,
        });

        const leadUpdated = await this.updateLeadAfterCaseCreation(
          client,
          phone,
          inserted.id,
        );

        if (!leadUpdated) {
          throw new InternalServerErrorException('CASE_CREATION_FAILED');
        }

        const success: CreateCaseFromRequestedAmountSuccessResponse = {
          ok: true,
          case_id: inserted.id,
          phone: inserted.phone,
          user_id: inserted.user_id,
          requested_amount: Number(inserted.requested_amount),
          case_status: 'WAITING_CEO',
          lead_stage: 'WAITING_CEO',
          prequal_mode:
            prequal_mode === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : 'AUTO_OK',
          manual_review_reason: this.asManualReviewReason(
            inserted.manual_review_reason,
          ),
        };
        return success;
      },
    );
  }

  private async findLeadForUpdate(
    client: DbClient,
    phone: string,
  ): Promise<LeadRow | null> {
    const result = await client.query<LeadRow>(
      `
      SELECT id, phone, stage, current_case_id, manual_review_reason
      FROM leads
      WHERE phone = $1
      LIMIT 1
      FOR UPDATE
      `,
      [phone],
    );
    return result.rows[0] ?? null;
  }

  private async findUserByPhone(
    client: DbClient,
    phone: string,
  ): Promise<UserRow | null> {
    const result = await client.query<UserRow>(
      `
      SELECT id, phone, is_completed, first_name, last_name, cuit
      FROM users
      WHERE phone = $1
      LIMIT 1
      `,
      [phone],
    );
    return result.rows[0] ?? null;
  }

  private async insertCase(
    client: DbClient,
    input: {
      readonly userId: string;
      readonly phone: string;
      readonly requestedAmount: number;
      readonly prequalMode: 'AUTO_OK' | 'MANUAL_REVIEW';
      readonly manualReviewReason: string | null;
    },
  ): Promise<InsertedCaseRow> {
    const result = await client.query<InsertedCaseRow>(
      `
      INSERT INTO cases (
        id,
        user_id,
        phone,
        case_type,
        refinances_loan_id,
        requested_amount,
        prequal_mode,
        manual_review_reason,
        requires_guarantor,
        status,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        'NEW',
        NULL,
        $3,
        $4,
        $5,
        false,
        'WAITING_CEO',
        now(),
        now()
      )
      RETURNING id, phone, user_id, status, requested_amount, prequal_mode, manual_review_reason
      `,
      [
        input.userId,
        input.phone,
        input.requestedAmount,
        input.prequalMode,
        input.manualReviewReason,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new InternalServerErrorException('CASE_CREATION_FAILED');
    }
    return row;
  }

  private async updateLeadAfterCaseCreation(
    client: DbClient,
    phone: string,
    caseId: string,
  ): Promise<{
    phone: string;
    stage: string;
    current_case_id: string | null;
  } | null> {
    const result = await client.query<{
      phone: string;
      stage: string;
      current_case_id: string | null;
    }>(
      `
      UPDATE leads
      SET stage = $2,
          current_case_id = $3,
          manual_review_reason = NULL,
          updated_at = now()
      WHERE phone = $1
      RETURNING phone, stage, current_case_id
      `,
      [phone, LeadStage.WAITING_CEO, caseId],
    );
    return result.rows[0] ?? null;
  }

  private asManualReviewReason(
    value: string | null,
  ): CreateCaseFromRequestedAmountManualReviewReason {
    if (value === 'BCRA_NO_DATA' || value === 'BCRA_UNAVAILABLE') {
      return value;
    }
    return null;
  }

  private businessError(
    code: CreateCaseFromRequestedAmountBusinessErrorCode,
  ): CreateCaseFromRequestedAmountErrorResponse {
    return { ok: false, error_type: 'BUSINESS', error_code: code };
  }
}
