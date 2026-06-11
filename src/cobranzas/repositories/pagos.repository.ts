import { Injectable } from '@nestjs/common';
import { DbClient, DbService } from '../../db/db.service';

export interface PagoRow {
  readonly id: string;
  readonly loan_id: string;
  readonly monto: number;
  readonly fecha_accion: string | null;
  readonly fecha_comprobante_recibido: string | null;
  readonly fecha_acreditacion: string | null;
  readonly comprobante_url: string | null;
  readonly estado: string;
  readonly medio_pago: string | null;
  readonly referencia_externa: string | null;
  readonly cuenta_origen: string | null;
  readonly es_parcial: boolean;
  readonly imputado: boolean;
  readonly imputado_at: string | null;
  readonly registrado_por: string;
  readonly notas: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface PagoCuotaRow {
  readonly id: string;
  readonly pago_id: string;
  readonly cuota_id: string;
  readonly monto_aplicado: number;
  readonly mora_aplicada: number;
  readonly iva_mora_aplicada: number;
  readonly gastos_aplicados: number;
  readonly interes_aplicado: number;
  readonly iva_interes_aplicado: number;
  readonly capital_aplicado: number;
  readonly created_at: string;
}

export interface CuotaSums {
  readonly sum_mora_aplicada: number;
  readonly sum_iva_mora_aplicada: number;
  readonly sum_interes_aplicado: number;
  readonly sum_iva_interes_aplicado: number;
  readonly sum_capital_aplicado: number;
}

export interface InsertPagoInput {
  readonly loan_id: string;
  readonly monto: number;
  readonly fecha_accion?: string | null;
  readonly comprobante_url?: string | null;
  readonly medio_pago?: string | null;
  readonly cuenta_origen?: string | null;
  readonly notas?: string | null;
  readonly registrado_por: string;
}

export interface UpdateEstadoPagoInput {
  readonly estado: string;
  readonly fecha_acreditacion?: string | null;
  readonly notas?: string | null;
}

export interface InsertPagoCuotaInput {
  readonly pago_id: string;
  readonly cuota_id: string;
  readonly monto_aplicado: number;
  readonly mora_aplicada: number;
  readonly iva_mora_aplicada: number;
  readonly interes_aplicado: number;
  readonly iva_interes_aplicado: number;
  readonly capital_aplicado: number;
}

@Injectable()
export class PagosRepository {
  public constructor(private readonly dbService: DbService) {}

  public async insertPago(
    client: DbClient,
    input: InsertPagoInput,
  ): Promise<PagoRow> {
    const result = await client.query<Record<string, unknown>>(
      `
      INSERT INTO pagos (
        loan_id, monto, fecha_accion, fecha_comprobante_recibido,
        comprobante_url, estado, medio_pago, cuenta_origen,
        es_parcial, imputado, registrado_por, notas, created_at, updated_at
      ) VALUES (
        $1, $2, $3, now(), $4, 'recibido', $5, $6,
        false, false, $7, $8, now(), now()
      )
      RETURNING *
      `,
      [
        input.loan_id,
        input.monto,
        input.fecha_accion ?? null,
        input.comprobante_url ?? null,
        input.medio_pago ?? null,
        input.cuenta_origen ?? null,
        input.registrado_por,
        input.notas ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('No se pudo insertar el pago.');
    return this.normalizePago(row);
  }

  public async findById(pagoId: string): Promise<PagoRow | null> {
    const result = await this.dbService.query<Record<string, unknown>>(
      'SELECT * FROM pagos WHERE id = $1',
      [pagoId],
    );
    return result.rows[0] ? this.normalizePago(result.rows[0]) : null;
  }

  public async findByIdForUpdate(
    client: DbClient,
    pagoId: string,
  ): Promise<PagoRow | null> {
    const result = await client.query<Record<string, unknown>>(
      'SELECT * FROM pagos WHERE id = $1 FOR UPDATE',
      [pagoId],
    );
    return result.rows[0] ? this.normalizePago(result.rows[0]) : null;
  }

  public async updateEstado(
    client: DbClient,
    pagoId: string,
    input: UpdateEstadoPagoInput,
  ): Promise<PagoRow> {
    const result = await client.query<Record<string, unknown>>(
      `
      UPDATE pagos
      SET estado            = $2,
          fecha_acreditacion = COALESCE($3::timestamptz, fecha_acreditacion),
          notas             = COALESCE($4, notas),
          updated_at        = now()
      WHERE id = $1
      RETURNING *
      `,
      [
        pagoId,
        input.estado,
        input.fecha_acreditacion ?? null,
        input.notas ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new Error(`Pago ${pagoId} no encontrado al actualizar estado.`);
    return this.normalizePago(row);
  }

  public async markImputado(
    client: DbClient,
    pagoId: string,
    esParcial: boolean,
  ): Promise<void> {
    await client.query(
      `
      UPDATE pagos
      SET imputado    = true,
          imputado_at = now(),
          es_parcial  = $2,
          updated_at  = now()
      WHERE id = $1
      `,
      [pagoId, esParcial],
    );
  }

  public async insertPagoCuota(
    client: DbClient,
    input: InsertPagoCuotaInput,
  ): Promise<PagoCuotaRow> {
    const result = await client.query<Record<string, unknown>>(
      `
      INSERT INTO pagos_cuotas (
        pago_id, cuota_id, monto_aplicado,
        mora_aplicada, iva_mora_aplicada, gastos_aplicados,
        interes_aplicado, iva_interes_aplicado, capital_aplicado,
        created_at
      ) VALUES (
        $1, $2, $3, $4, $5, 0, $6, $7, $8, now()
      )
      RETURNING *
      `,
      [
        input.pago_id,
        input.cuota_id,
        input.monto_aplicado,
        input.mora_aplicada,
        input.iva_mora_aplicada,
        input.interes_aplicado,
        input.iva_interes_aplicado,
        input.capital_aplicado,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('No se pudo insertar pagos_cuotas.');
    return this.normalizePagoCuota(row);
  }

  public async getSumsForCuota(
    cuotaId: string,
    client?: DbClient,
  ): Promise<CuotaSums> {
    const db = client ?? this.dbService;
    const result = await db.query<Record<string, unknown>>(
      `
      SELECT
        COALESCE(SUM(mora_aplicada), 0)         AS sum_mora_aplicada,
        COALESCE(SUM(iva_mora_aplicada), 0)     AS sum_iva_mora_aplicada,
        COALESCE(SUM(interes_aplicado), 0)      AS sum_interes_aplicado,
        COALESCE(SUM(iva_interes_aplicado), 0)  AS sum_iva_interes_aplicado,
        COALESCE(SUM(capital_aplicado), 0)      AS sum_capital_aplicado
      FROM pagos_cuotas
      WHERE cuota_id = $1
      `,
      [cuotaId],
    );
    const row = result.rows[0] ?? {};
    return {
      sum_mora_aplicada: Number(row['sum_mora_aplicada'] ?? 0),
      sum_iva_mora_aplicada: Number(row['sum_iva_mora_aplicada'] ?? 0),
      sum_interes_aplicado: Number(row['sum_interes_aplicado'] ?? 0),
      sum_iva_interes_aplicado: Number(row['sum_iva_interes_aplicado'] ?? 0),
      sum_capital_aplicado: Number(row['sum_capital_aplicado'] ?? 0),
    };
  }

  private normalizePago(row: Record<string, unknown>): PagoRow {
    const toIso = (v: unknown): string | null => {
      if (v == null) return null;
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return v instanceof Date ? v.toISOString() : String(v);
    };
    return {
      id: row['id'] as string,
      loan_id: row['loan_id'] as string,
      monto: Number(row['monto']),
      fecha_accion: toIso(row['fecha_accion']),
      fecha_comprobante_recibido: toIso(row['fecha_comprobante_recibido']),
      fecha_acreditacion: toIso(row['fecha_acreditacion']),
      comprobante_url: (row['comprobante_url'] as string | null) ?? null,
      estado: row['estado'] as string,
      medio_pago: (row['medio_pago'] as string | null) ?? null,
      referencia_externa: (row['referencia_externa'] as string | null) ?? null,
      cuenta_origen: (row['cuenta_origen'] as string | null) ?? null,
      es_parcial: Boolean(row['es_parcial']),
      imputado: Boolean(row['imputado']),
      imputado_at: toIso(row['imputado_at']),
      registrado_por: row['registrado_por'] as string,
      notas: (row['notas'] as string | null) ?? null,
      created_at: toIso(row['created_at']) ?? '',
      updated_at: toIso(row['updated_at']) ?? '',
    };
  }

  private normalizePagoCuota(row: Record<string, unknown>): PagoCuotaRow {
    return {
      id: row['id'] as string,
      pago_id: row['pago_id'] as string,
      cuota_id: row['cuota_id'] as string,
      monto_aplicado: Number(row['monto_aplicado']),
      mora_aplicada: Number(row['mora_aplicada']),
      iva_mora_aplicada: Number(row['iva_mora_aplicada']),
      gastos_aplicados: Number(row['gastos_aplicados']),
      interes_aplicado: Number(row['interes_aplicado']),
      iva_interes_aplicado: Number(row['iva_interes_aplicado']),
      capital_aplicado: Number(row['capital_aplicado']),
      created_at:
        row['created_at'] instanceof Date
          ? row['created_at'].toISOString()
          : String(row['created_at']),
    };
  }
}
