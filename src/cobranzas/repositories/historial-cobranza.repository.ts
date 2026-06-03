import { Injectable } from '@nestjs/common';
import { DbClient, DbService } from '../../db/db.service';
import type { TipoAccionHistorial } from '../dto/registrar-historial.dto';

export interface HistorialCobranzaRow {
  readonly id: string;
  readonly loan_id: string;
  readonly tipo_accion: string;
  readonly descripcion: string | null;
  readonly dpd_al_momento: number | null;
  readonly cuota_id: string | null;
  readonly pago_id: string | null;
  readonly compromiso_id: string | null;
  readonly realizado_por: string;
  readonly metadata: Record<string, unknown> | null;
  readonly created_at: string;
}

export interface InsertHistorialInput {
  readonly loan_id: string;
  readonly tipo_accion: TipoAccionHistorial;
  readonly descripcion?: string | null;
  readonly dpd_al_momento?: number | null;
  readonly cuota_id?: string | null;
  readonly pago_id?: string | null;
  readonly compromiso_id?: string | null;
  readonly realizado_por: string;
  readonly metadata?: Record<string, unknown> | null;
}

@Injectable()
export class HistorialCobranzaRepository {
  public constructor(private readonly dbService: DbService) {}

  public async insert(
    client: DbClient,
    input: InsertHistorialInput,
  ): Promise<HistorialCobranzaRow> {
    const result = await client.query<Record<string, unknown>>(
      `
      INSERT INTO historial_cobranza (
        loan_id, tipo_accion, descripcion, dpd_al_momento,
        cuota_id, pago_id, compromiso_id,
        realizado_por, metadata, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now()
      )
      RETURNING *
      `,
      [
        input.loan_id,
        input.tipo_accion,
        input.descripcion ?? null,
        input.dpd_al_momento ?? null,
        input.cuota_id ?? null,
        input.pago_id ?? null,
        input.compromiso_id ?? null,
        input.realizado_por,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );

    const row = result.rows[0];
    if (!row) throw new Error('No se pudo insertar en historial_cobranza.');

    return {
      id: row['id'] as string,
      loan_id: row['loan_id'] as string,
      tipo_accion: row['tipo_accion'] as string,
      descripcion: (row['descripcion'] as string | null) ?? null,
      dpd_al_momento:
        row['dpd_al_momento'] != null ? Number(row['dpd_al_momento']) : null,
      cuota_id: (row['cuota_id'] as string | null) ?? null,
      pago_id: (row['pago_id'] as string | null) ?? null,
      compromiso_id: (row['compromiso_id'] as string | null) ?? null,
      realizado_por: row['realizado_por'] as string,
      metadata:
        row['metadata'] != null &&
        typeof row['metadata'] === 'object' &&
        !Array.isArray(row['metadata'])
          ? (row['metadata'] as Record<string, unknown>)
          : null,
      created_at:
        row['created_at'] instanceof Date
          ? row['created_at'].toISOString()
          : String(row['created_at']),
    };
  }
}
