import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { MoraService } from './mora.service';

type BucketKey =
  | 'al_dia'
  | 'por_vencer'
  | 'mora_inicial'
  | 'mora_blanda'
  | 'mora_solapada'
  | 'mora_dura'
  | 'mora_critica'
  | 'legal'
  | 'legal_diferido'
  | 'referencia_regulatoria';

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function asignarBucket(dpd: number): BucketKey {
  if (dpd >= 90) return 'referencia_regulatoria';
  if (dpd >= 45) return 'legal_diferido';
  if (dpd >= 30) return 'legal';
  if (dpd >= 21) return 'mora_critica';
  if (dpd >= 14) return 'mora_dura';
  if (dpd >= 7) return 'mora_solapada';
  if (dpd >= 3) return 'mora_blanda';
  if (dpd >= 1) return 'mora_inicial';
  if (dpd >= -3) return 'por_vencer';
  return 'al_dia';
}

function proximaAccionSugerida(dpd: number): string {
  if (dpd < -3) return 'Sin acción inmediata';
  if (dpd <= 0) return 'Preventivo: verificar vencimiento próximo';
  if (dpd <= 2)
    return 'Bonificación D+1/D+2: contactar para pago sin mora antes de las 17hs AR';
  if (dpd <= 6) return 'Mora blanda: enviar WhatsApp gestión cobranza';
  if (dpd <= 13)
    return 'Mora solapada: gestión urgente, riesgo de bloqueo de nuevo crédito';
  if (dpd <= 20) return 'Mora dura ZAGA: gestión intensiva';
  if (dpd <= 29) return 'Mora crítica: evaluar derivación a legal';
  if (dpd <= 44) return 'Legal: iniciar proceso legal';
  if (dpd <= 89) return 'Legal diferido: seguimiento legal';
  return 'Referencia regulatoria: proceso formal';
}

export interface CarteraLoanItem {
  readonly loan_id: string;
  readonly public_loan_number: string | null;
  readonly phone: string;
  readonly cuit: string | null;
  readonly first_name: string | null;
  readonly last_name: string | null;
  readonly monto_prestamo: number;
  readonly disbursed_at: string;
  readonly dpd_max: number;
  readonly bucket: BucketKey;
  readonly cuotas_vencidas: number;
  readonly saldo_pendiente_total: number;
}

export interface CarteraResponse {
  readonly total: number;
  readonly resumen: Record<BucketKey, number>;
  readonly loans: CarteraLoanItem[];
}

@Injectable()
export class CobranzasBackofficeService {
  public constructor(
    private readonly dbService: DbService,
    private readonly moraService: MoraService,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /private/cobranzas — Cartera activa con buckets DPD
  // ---------------------------------------------------------------------------
  public async getCarteraActiva(): Promise<CarteraResponse> {
    const result = await this.dbService.query<{
      loan_id: string;
      public_loan_number: string | null;
      phone: string;
      cuit: string | null;
      first_name: string | null;
      last_name: string | null;
      monto_prestamo: string | number | null;
      disbursed_at: Date | string;
      dpd_max_overdue: string | number | null;
      dias_proxima: string | number | null;
      cuotas_vencidas: string | number;
      saldo_pendiente_total: string | number | null;
    }>(
      `
      SELECT
        l.id                            AS loan_id,
        l.public_loan_number,
        l.phone,
        u.cuit,
        u.first_name,
        u.last_name,
        co.amount                       AS monto_prestamo,
        l.disbursed_at,
        MAX(CURRENT_DATE - c.fecha_vencimiento)
          FILTER (WHERE c.estado NOT IN ('pagada', 'refinanciada')
                    AND c.fecha_vencimiento < CURRENT_DATE) AS dpd_max_overdue,
        MIN(c.fecha_vencimiento - CURRENT_DATE)
          FILTER (WHERE c.estado NOT IN ('pagada', 'refinanciada')
                    AND c.fecha_vencimiento >= CURRENT_DATE) AS dias_proxima,
        COUNT(c.id)
          FILTER (WHERE c.estado NOT IN ('pagada', 'refinanciada')
                    AND c.fecha_vencimiento < CURRENT_DATE) AS cuotas_vencidas,
        SUM(c.saldo_pendiente)
          FILTER (WHERE c.estado NOT IN ('pagada', 'refinanciada')) AS saldo_pendiente_total
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      JOIN case_offers co ON co.id = l.offer_id
      LEFT JOIN cuotas c ON c.loan_id = l.id
      WHERE l.disbursed_at IS NOT NULL
        AND l.status NOT IN ('PAID')
      GROUP BY
        l.id, l.public_loan_number, l.phone, u.cuit,
        u.first_name, u.last_name, co.amount, l.disbursed_at
      ORDER BY dpd_max_overdue DESC NULLS LAST, dias_proxima ASC NULLS LAST
      `,
    );

    const resumen: Record<BucketKey, number> = {
      al_dia: 0,
      por_vencer: 0,
      mora_inicial: 0,
      mora_blanda: 0,
      mora_solapada: 0,
      mora_dura: 0,
      mora_critica: 0,
      legal: 0,
      legal_diferido: 0,
      referencia_regulatoria: 0,
    };

    const loans: CarteraLoanItem[] = result.rows.map((r) => {
      const dpdMaxOverdue =
        r.dpd_max_overdue !== null ? Number(r.dpd_max_overdue) : null;
      const diasProxima =
        r.dias_proxima !== null ? Number(r.dias_proxima) : null;

      let effectiveDpd: number;
      if (dpdMaxOverdue !== null && dpdMaxOverdue > 0) {
        effectiveDpd = dpdMaxOverdue;
      } else if (diasProxima !== null) {
        effectiveDpd = -diasProxima;
      } else {
        effectiveDpd = -999;
      }

      const bucket = asignarBucket(effectiveDpd);
      resumen[bucket]++;

      return {
        loan_id: r.loan_id,
        public_loan_number: r.public_loan_number,
        phone: r.phone,
        cuit: r.cuit,
        first_name: r.first_name,
        last_name: r.last_name,
        monto_prestamo: r.monto_prestamo != null ? Number(r.monto_prestamo) : 0,
        disbursed_at:
          r.disbursed_at instanceof Date
            ? r.disbursed_at.toISOString()
            : String(r.disbursed_at),
        dpd_max: dpdMaxOverdue ?? 0,
        bucket,
        cuotas_vencidas: Number(r.cuotas_vencidas),
        saldo_pendiente_total:
          r.saldo_pendiente_total != null ? Number(r.saldo_pendiente_total) : 0,
      };
    });

    return { total: loans.length, resumen, loans };
  }

  // ---------------------------------------------------------------------------
  // GET /private/cobranzas/:loanId — Detalle CEO del préstamo
  // ---------------------------------------------------------------------------
  public async getLoanDetail(loanId: string): Promise<object> {
    const loanResult = await this.dbService.query<{
      loan_id: string;
      public_loan_number: string | null;
      status: string;
      phone: string;
      cuit: string | null;
      first_name: string | null;
      last_name: string | null;
      dni: string | null;
      disbursed_at: Date | string | null;
      monto_prestamo: string | number | null;
      refinanciacion_usada: boolean;
    }>(
      `
      SELECT
        l.id                              AS loan_id,
        l.public_loan_number,
        l.status,
        l.phone,
        u.cuit,
        u.first_name,
        u.last_name,
        u.dni,
        l.disbursed_at,
        co.amount                         AS monto_prestamo,
        (ca.refinances_loan_id IS NOT NULL) AS refinanciacion_usada
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      JOIN case_offers co ON co.id = l.offer_id
      JOIN cases ca ON ca.id = l.case_id
      WHERE l.id = $1
      `,
      [loanId],
    );

    if (!loanResult.rows[0]) {
      throw new NotFoundException('Préstamo no encontrado.');
    }
    const loan = loanResult.rows[0];

    const saldo = await this.moraService.calcularSaldoActualizado(loanId);

    const cuotaVencidaMasAntigua =
      saldo.cuotas_vencidas.length > 0
        ? saldo.cuotas_vencidas.reduce((oldest, c) =>
            c.dpd > oldest.dpd ? c : oldest,
          )
        : null;

    const total_vencido_actualizado = round2(
      saldo.totales.capital_vencido_total +
        saldo.totales.interes_vencido_total +
        saldo.totales.iva_interes_vencido_total +
        saldo.totales.mora_total +
        saldo.totales.iva_mora_total,
    );

    const [
      pagosResult,
      compromisosResult,
      pagosParcialesResult,
      historialResult,
    ] = await Promise.all([
      this.dbService.query<{
        id: string;
        monto: string | number;
        estado: string;
        medio_pago: string | null;
        fecha_comprobante_recibido: Date | string | null;
      }>(
        `
          SELECT id, monto, estado, medio_pago, fecha_comprobante_recibido
          FROM pagos
          WHERE loan_id = $1
            AND estado NOT IN ('validado', 'rechazado')
          ORDER BY created_at ASC
          `,
        [loanId],
      ),

      this.dbService.query<{
        id: string;
        fecha_prometida: string;
        monto_prometido: string | number;
        canal: string | null;
        estado: string;
        created_at: Date | string;
      }>(
        `
          SELECT id, fecha_prometida, monto_prometido, canal, estado, created_at
          FROM compromisos_pago
          WHERE loan_id = $1
            AND estado IN ('pendiente', 'roto')
          ORDER BY fecha_prometida ASC
          `,
        [loanId],
      ),

      this.dbService.query<{
        count: string | number;
        monto_total: string | number | null;
      }>(
        `
          SELECT COUNT(*) AS count, SUM(monto) AS monto_total
          FROM pagos
          WHERE loan_id = $1
            AND es_parcial = true
          `,
        [loanId],
      ),

      this.dbService.query<{
        id: string;
        tipo_accion: string;
        descripcion: string | null;
        dpd_al_momento: number | null;
        realizado_por: string;
        created_at: Date | string;
      }>(
        `
          SELECT id, tipo_accion, descripcion, dpd_al_momento, realizado_por, created_at
          FROM historial_cobranza
          WHERE loan_id = $1
          ORDER BY created_at DESC
          LIMIT 10
          `,
        [loanId],
      ),
    ]);

    const toIso = (v: Date | string | null | undefined): string | null => {
      if (v == null) return null;
      return v instanceof Date ? v.toISOString() : String(v);
    };

    const ppRow = pagosParcialesResult.rows[0];
    const compromisosActivos = compromisosResult.rows.filter(
      (c) => c.estado === 'pendiente',
    );
    const compromisosRotos = compromisosResult.rows.filter(
      (c) => c.estado === 'roto',
    );

    return {
      cliente: {
        phone: loan.phone,
        cuit: loan.cuit,
        first_name: loan.first_name,
        last_name: loan.last_name,
        dni: loan.dni,
      },
      loan_id: loan.loan_id,
      public_loan_number: loan.public_loan_number,
      status: loan.status,
      monto_prestamo:
        loan.monto_prestamo != null ? Number(loan.monto_prestamo) : null,
      disbursed_at: toIso(loan.disbursed_at),
      refinanciacion_usada: loan.refinanciacion_usada,

      dpd_max: saldo.dpd_max,
      cuota_vencida_mas_antigua: cuotaVencidaMasAntigua
        ? {
            numero_cuota: cuotaVencidaMasAntigua.numero_cuota,
            fecha_vencimiento: cuotaVencidaMasAntigua.fecha_vencimiento,
            dpd: cuotaVencidaMasAntigua.dpd,
          }
        : null,
      cantidad_cuotas_vencidas: saldo.cuotas_vencidas.length,
      cuota_vigente: saldo.cuota_vigente,

      interes_moratorio_total: saldo.totales.mora_total,
      iva_moratorio_total: saldo.totales.iva_mora_total,
      total_vencido_actualizado,
      total_para_quedar_al_dia: saldo.totales.total_para_quedar_al_dia,

      comprobantes_pendientes: pagosResult.rows.map((p) => ({
        id: p.id,
        monto: Number(p.monto),
        estado: p.estado,
        medio_pago: p.medio_pago,
        fecha_recibido: toIso(p.fecha_comprobante_recibido),
      })),
      pagos_parciales_registrados: {
        cantidad: Number(ppRow?.count ?? 0),
        monto_total: ppRow?.monto_total != null ? Number(ppRow.monto_total) : 0,
      },
      promesas_activas: compromisosActivos.map((c) => ({
        id: c.id,
        fecha_prometida: c.fecha_prometida,
        monto_prometido: Number(c.monto_prometido),
        canal: c.canal,
        created_at: toIso(c.created_at),
      })),
      promesas_rotas: compromisosRotos.map((c) => ({
        id: c.id,
        fecha_prometida: c.fecha_prometida,
        monto_prometido: Number(c.monto_prometido),
        canal: c.canal,
        created_at: toIso(c.created_at),
      })),
      codeudor: null,

      historial_reciente: historialResult.rows.map((h) => ({
        id: h.id,
        tipo_accion: h.tipo_accion,
        descripcion: h.descripcion,
        dpd_al_momento: h.dpd_al_momento,
        realizado_por: h.realizado_por,
        created_at: toIso(h.created_at),
      })),

      proxima_accion_sugerida: proximaAccionSugerida(saldo.dpd_max),
    };
  }
}
