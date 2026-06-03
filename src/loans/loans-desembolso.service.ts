import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CuotasService } from '../cobranzas/cuotas.service';
import type { CuotaRow } from '../cobranzas/repositories/cuotas.repository';
import { DbClient, DbService } from '../db/db.service';

interface LoanForDesembolso {
  readonly id: string;
  readonly case_id: string;
  readonly offer_id: string;
  readonly status: string;
  readonly public_loan_number: string | null;
  readonly disbursed_at: Date | null;
}

interface LoanDisbursedRow {
  readonly id: string;
  readonly status: string;
  readonly public_loan_number: string;
  readonly disbursed_at: Date;
}

export interface DesembolsoResponse {
  readonly ok: true;
  readonly loan_id: string;
  readonly public_loan_number: string;
  readonly status: string;
  readonly disbursed_at: string;
  readonly cuotas: CuotaRow[];
}

@Injectable()
export class LoansDesembolsoService {
  public constructor(
    private readonly dbService: DbService,
    private readonly cuotasService: CuotasService,
  ) {}

  public async registrarDesembolso(
    loanId: string,
  ): Promise<DesembolsoResponse> {
    return this.dbService.withTransaction(async (client: DbClient) => {
      const loan = await this.findLoanForUpdate(client, loanId);
      if (!loan) {
        throw new NotFoundException('Préstamo no encontrado.');
      }

      if (loan.status === 'DISBURSED') {
        throw new ConflictException('El préstamo ya fue desembolsado.');
      }

      if (loan.status !== 'CREATED') {
        throw new BadRequestException(
          `Estado inválido para desembolso: ${loan.status}. Se requiere CREATED.`,
        );
      }

      const offer = await this.findOffer(client, loan.offer_id);
      if (!offer) {
        throw new BadRequestException(
          'No se encontró la oferta asociada al préstamo.',
        );
      }

      const signedAt = await this.findSignedAt(client, loan.case_id);
      if (!signedAt) {
        throw new BadRequestException(
          'No se encontró contrato firmado para este préstamo.',
        );
      }

      const disbursedLoan = await this.disburseLoan(client, loanId);

      const cuotas = await this.cuotasService.generarSchedule(client, {
        loanId,
        fechaFirmaSignatura: signedAt,
        amount: Number(offer.amount),
        tasaNominalAnual: Number(offer.tasa_nominal_anual),
      });

      return {
        ok: true,
        loan_id: disbursedLoan.id,
        public_loan_number: disbursedLoan.public_loan_number,
        status: disbursedLoan.status,
        disbursed_at: disbursedLoan.disbursed_at.toISOString(),
        cuotas,
      };
    });
  }

  private async findLoanForUpdate(
    client: DbClient,
    loanId: string,
  ): Promise<LoanForDesembolso | null> {
    const result = await client.query<LoanForDesembolso>(
      `
      SELECT id, case_id, offer_id, status, public_loan_number, disbursed_at
      FROM loans
      WHERE id = $1
      FOR UPDATE
      `,
      [loanId],
    );
    return result.rows[0] ?? null;
  }

  private async findOffer(
    client: DbClient,
    offerId: string,
  ): Promise<{
    readonly amount: number;
    readonly tasa_nominal_anual: number;
  } | null> {
    const result = await client.query<{
      amount: number;
      tasa_nominal_anual: number;
    }>(
      `
      SELECT amount, tasa_nominal_anual
      FROM case_offers
      WHERE id = $1
      `,
      [offerId],
    );
    return result.rows[0] ?? null;
  }

  private async findSignedAt(
    client: DbClient,
    caseId: string,
  ): Promise<Date | null> {
    const result = await client.query<{ signed_at: Date }>(
      `
      SELECT signed_at
      FROM case_contracts
      WHERE case_id = $1
        AND status = 'SIGNED'
        AND signed_at IS NOT NULL
      ORDER BY signed_at DESC
      LIMIT 1
      `,
      [caseId],
    );
    return result.rows[0]?.signed_at ?? null;
  }

  private async disburseLoan(
    client: DbClient,
    loanId: string,
  ): Promise<LoanDisbursedRow> {
    const result = await client.query<LoanDisbursedRow>(
      `
      UPDATE loans
      SET public_loan_number = 'ZAGA-' || LPAD(nextval('loan_number_seq')::text, 6, '0'),
          disbursed_at        = now(),
          status              = 'DISBURSED',
          updated_at          = now()
      WHERE id = $1
        AND status = 'CREATED'
      RETURNING id, status, public_loan_number, disbursed_at
      `,
      [loanId],
    );

    const row = result.rows[0];
    if (!row) {
      throw new ConflictException(
        'No se pudo actualizar el préstamo. Posible condición de carrera.',
      );
    }

    return row;
  }
}
