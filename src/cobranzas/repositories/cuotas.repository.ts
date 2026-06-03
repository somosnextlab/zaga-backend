/* eslint-disable @typescript-eslint/no-base-to-string */
import { Injectable } from '@nestjs/common';
import { DbClient, DbService } from '../../db/db.service';

export interface CuotaRow {
  readonly id: string;
  readonly loan_id: string;
  readonly numero_cuota: number;
  readonly fecha_vencimiento: string;
  readonly capital: number;
  readonly interes: number;
  readonly iva_interes: number;
  readonly total_cuota: number;
  readonly saldo_pendiente: number;
  readonly estado: string;
  readonly pagada_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface InsertCuotaInput {
  readonly loan_id: string;
  readonly numero_cuota: number;
  readonly fecha_vencimiento: string;
  readonly capital: number;
  readonly interes: number;
  readonly iva_interes: number;
  readonly total_cuota: number;
}

@Injectable()
export class CuotasRepository {
  public constructor(private readonly dbService: DbService) {}

  public async insertCuota(
    client: DbClient,
    input: InsertCuotaInput,
  ): Promise<CuotaRow> {
    const result = await client.query<Record<string, unknown>>(
      `
      INSERT INTO cuotas (
        loan_id, numero_cuota, fecha_vencimiento,
        capital, interes, iva_interes, total_cuota,
        saldo_pendiente, estado, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $7, 'pendiente', now(), now()
      )
      RETURNING *
      `,
      [
        input.loan_id,
        input.numero_cuota,
        input.fecha_vencimiento,
        input.capital,
        input.interes,
        input.iva_interes,
        input.total_cuota,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error('No se pudo insertar cuota.');
    return this.normalize(row);
  }

  public async findByLoanId(loanId: string): Promise<CuotaRow[]> {
    const result = await this.dbService.query<Record<string, unknown>>(
      `
      SELECT * FROM cuotas
      WHERE loan_id = $1
      ORDER BY numero_cuota ASC
      `,
      [loanId],
    );
    return result.rows.map((r) => this.normalize(r));
  }

  private normalize(row: Record<string, unknown>): CuotaRow {
    const fechaVen = row['fecha_vencimiento'];
    const pagadaAt = row['pagada_at'];
    return {
      id: row['id'] as string,
      loan_id: row['loan_id'] as string,
      numero_cuota: Number(row['numero_cuota']),
      fecha_vencimiento:
        fechaVen instanceof Date
          ? fechaVen.toISOString().split('T')[0]
          : String(fechaVen),
      capital: Number(row['capital']),
      interes: Number(row['interes']),
      iva_interes: Number(row['iva_interes']),
      total_cuota: Number(row['total_cuota']),
      saldo_pendiente: Number(row['saldo_pendiente']),
      estado: row['estado'] as string,
      pagada_at:
        pagadaAt == null
          ? null
          : pagadaAt instanceof Date
            ? pagadaAt.toISOString()
            : String(pagadaAt),
      created_at:
        row['created_at'] instanceof Date
          ? row['created_at'].toISOString()
          : String(row['created_at']),
      updated_at:
        row['updated_at'] instanceof Date
          ? row['updated_at'].toISOString()
          : String(row['updated_at']),
    };
  }
}
