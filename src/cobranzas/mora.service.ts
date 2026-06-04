import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { CuotaRow } from './repositories/cuotas.repository';
import { CuotasRepository } from './repositories/cuotas.repository';
import type { CuotaSums } from './repositories/pagos.repository';
import { PagosRepository } from './repositories/pagos.repository';
import type {
  CuotaVencidaActualizada,
  CuotaVigenteActualizada,
  SaldoActualizadoResponse,
} from './interfaces/saldo-actualizado.interface';

const IVA_MORA_RATE = 0.21;
const HORA_CORTE_AR = 17;
const DPD_SOLAPADA = 7;
const DPD_BONIFICABLE_MAX = 2;

interface LoanForMora {
  readonly id: string;
  readonly public_loan_number: string | null;
  readonly disbursed_at: Date | null;
  readonly tasa_nominal_anual: number;
}

export interface MoraResult {
  readonly dpd: number;
  readonly capital_vencido_impago: number;
  readonly interes_pendiente: number;
  readonly iva_interes_pendiente: number;
  readonly mora_base: number;
  readonly iva_mora: number;
  readonly total_mora: number;
  readonly saldo_actualizado: number;
  readonly es_bonificable: boolean;
  readonly es_solapada: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

@Injectable()
export class MoraService {
  public constructor(
    private readonly dbService: DbService,
    private readonly cuotasRepository: CuotasRepository,
    private readonly pagosRepository: PagosRepository,
  ) {}

  /**
   * Cálculo puro de mora para una cuota — sin acceso a DB.
   * tnaDecimal: TNA ya convertida a decimal (ej: 0.72 para 72% anual).
   * Mora = capital_vencido_impago * (TNA/365) * DPD.
   * Nunca sobre interés compensatorio ni IVA (regla 11).
   */
  public calcularMoraParaCuota(
    cuota: CuotaRow,
    tnaDecimal: number,
    sums: CuotaSums,
  ): MoraResult {
    const dpd = this.calcularDPD(cuota.fecha_vencimiento);
    const horaAR = this.getHoraArgentina();

    const esBonificable =
      dpd >= 1 && dpd <= DPD_BONIFICABLE_MAX && horaAR < HORA_CORTE_AR;
    const esSolapada = dpd >= DPD_SOLAPADA;

    const capital_vencido_impago = round2(
      Math.max(0, cuota.capital - sums.sum_capital_aplicado),
    );
    const interes_pendiente = round2(
      Math.max(0, cuota.interes - sums.sum_interes_aplicado),
    );
    const iva_interes_pendiente = round2(
      Math.max(0, cuota.iva_interes - sums.sum_iva_interes_aplicado),
    );

    const tasa_moratoria_diaria = tnaDecimal / 365;
    const mora_base_raw = esBonificable
      ? 0
      : capital_vencido_impago * tasa_moratoria_diaria * dpd;

    const mora_base = round2(mora_base_raw);
    const iva_mora = round2(mora_base * IVA_MORA_RATE);
    const total_mora = round2(mora_base + iva_mora);
    const saldo_actualizado = round2(
      capital_vencido_impago +
        interes_pendiente +
        iva_interes_pendiente +
        mora_base +
        iva_mora,
    );

    return {
      dpd,
      capital_vencido_impago,
      interes_pendiente,
      iva_interes_pendiente,
      mora_base,
      iva_mora,
      total_mora,
      saldo_actualizado,
      es_bonificable: esBonificable,
      es_solapada: esSolapada,
    };
  }

  public async calcularSaldoActualizado(
    loanId: string,
  ): Promise<SaldoActualizadoResponse> {
    const loan = await this.getLoanWithTNA(loanId);

    if (!loan.disbursed_at) {
      throw new BadRequestException(
        'El préstamo no ha sido desembolsado. No hay cuotas exigibles.',
      );
    }

    const cuotas = await this.cuotasRepository.findByLoanId(loanId);
    const tnaDecimal = Number(loan.tasa_nominal_anual) / 100;

    const cuotasVencidas: CuotaVencidaActualizada[] = [];
    let cuotaVigente: CuotaVigenteActualizada | null = null;
    let dpd_max = 0;

    for (const cuota of cuotas) {
      if (cuota.estado === 'pagada' || cuota.estado === 'refinanciada')
        continue;

      const dpd = this.calcularDPD(cuota.fecha_vencimiento);

      if (dpd > 0) {
        const sums = await this.pagosRepository.getSumsForCuota(cuota.id);
        const mora = this.calcularMoraParaCuota(cuota, tnaDecimal, sums);
        dpd_max = Math.max(dpd_max, mora.dpd);

        cuotasVencidas.push({
          numero_cuota: cuota.numero_cuota,
          fecha_vencimiento: cuota.fecha_vencimiento,
          capital_vencido_impago: mora.capital_vencido_impago,
          interes_pendiente: mora.interes_pendiente,
          iva_interes_pendiente: mora.iva_interes_pendiente,
          dpd: mora.dpd,
          mora_base: mora.mora_base,
          iva_mora: mora.iva_mora,
          total_mora: mora.total_mora,
          saldo_actualizado: mora.saldo_actualizado,
          es_bonificable: mora.es_bonificable,
          es_solapada: mora.es_solapada,
        });
      } else if (cuotaVigente === null) {
        cuotaVigente = {
          numero_cuota: cuota.numero_cuota,
          fecha_vencimiento: cuota.fecha_vencimiento,
          capital: cuota.capital,
          interes: cuota.interes,
          iva_interes: cuota.iva_interes,
          total_cuota: cuota.total_cuota,
          saldo_pendiente: cuota.saldo_pendiente,
        };
      }
    }

    const haySolapada = cuotasVencidas.some((c) => c.es_solapada);
    const capital_vencido_total = round2(
      cuotasVencidas.reduce((s, c) => s + c.capital_vencido_impago, 0),
    );
    const interes_vencido_total = round2(
      cuotasVencidas.reduce((s, c) => s + c.interes_pendiente, 0),
    );
    const iva_interes_vencido_total = round2(
      cuotasVencidas.reduce((s, c) => s + c.iva_interes_pendiente, 0),
    );
    const mora_total = round2(
      cuotasVencidas.reduce((s, c) => s + c.mora_base, 0),
    );
    const iva_mora_total = round2(
      cuotasVencidas.reduce((s, c) => s + c.iva_mora, 0),
    );
    const cuota_vigente_monto = cuotaVigente ? cuotaVigente.saldo_pendiente : 0;
    const total_vencido = round2(
      cuotasVencidas.reduce((s, c) => s + c.saldo_actualizado, 0),
    );
    const total_para_quedar_al_dia = haySolapada
      ? round2(total_vencido + cuota_vigente_monto)
      : total_vencido;

    // Para bonificables: saldo sin mora; para no bonificables: saldo_actualizado
    const total_bonificado = round2(
      cuotasVencidas.reduce((s, c) => {
        if (c.es_bonificable) {
          return (
            s +
            c.capital_vencido_impago +
            c.interes_pendiente +
            c.iva_interes_pendiente
          );
        }
        return s + c.saldo_actualizado;
      }, 0),
    );

    return {
      loan_id: loanId,
      public_loan_number: loan.public_loan_number,
      dpd_max,
      cuotas_vencidas: cuotasVencidas,
      cuota_vigente: cuotaVigente,
      totales: {
        capital_vencido_total,
        interes_vencido_total,
        iva_interes_vencido_total,
        mora_total,
        iva_mora_total,
        cuota_vigente_monto,
        total_para_quedar_al_dia,
        total_bonificado,
      },
    };
  }

  public calcularDPD(fechaVencimiento: string): number {
    const now = new Date();
    const todayUTC = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );
    const fv = new Date(fechaVencimiento + 'T12:00:00Z');
    const fvUTC = Date.UTC(
      fv.getUTCFullYear(),
      fv.getUTCMonth(),
      fv.getUTCDate(),
    );
    return Math.floor((todayUTC - fvUTC) / (1000 * 60 * 60 * 24));
  }

  public async getLoanWithTNA(loanId: string): Promise<LoanForMora> {
    const result = await this.dbService.query<LoanForMora>(
      `
      SELECT l.id,
             l.public_loan_number,
             l.disbursed_at,
             co.tasa_nominal_anual
      FROM loans l
      JOIN case_offers co ON co.id = l.offer_id
      WHERE l.id = $1
      `,
      [loanId],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Préstamo no encontrado.');
    return row;
  }

  private getHoraArgentina(): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: 'numeric',
      hour12: false,
    });
    const hora = parseInt(formatter.format(new Date()), 10);
    return isNaN(hora) ? 99 : hora;
  }
}
