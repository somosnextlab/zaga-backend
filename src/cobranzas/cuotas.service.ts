import { Injectable } from '@nestjs/common';
import { DbClient } from '../db/db.service';
import { CuotaRow, CuotasRepository } from './repositories/cuotas.repository';

const IVA_RATE = 0.21;
const WEEKS_PER_YEAR = 52;
const CUOTAS_COUNT = 12;

interface ScheduleItem {
  readonly amortization: number;
  readonly interest: number;
  readonly vat: number;
  readonly gross_installment: number;
  readonly due_date: string;
}

export interface GenerarScheduleInput {
  readonly loanId: string;
  readonly fechaFirmaSignatura: Date;
  readonly amount: number;
  readonly tasaNominalAnual: number;
}

@Injectable()
export class CuotasService {
  public constructor(private readonly cuotasRepository: CuotasRepository) {}

  /**
   * Genera el schedule de 12 cuotas semanales por préstamo.
   * Debe llamarse dentro de una transacción activa (client).
   * primer_vencimiento = fechaFirmaSignatura + 7 días corridos
   * Sistema francés con IVA solo sobre interés.
   */
  public async generarSchedule(
    client: DbClient,
    input: GenerarScheduleInput,
  ): Promise<CuotaRow[]> {
    const { loanId, fechaFirmaSignatura, amount, tasaNominalAnual } = input;

    const tnaDecimal = tasaNominalAnual / 100;
    const periodRate = tnaDecimal / WEEKS_PER_YEAR;

    const primerVencimiento = new Date(
      Date.UTC(
        fechaFirmaSignatura.getUTCFullYear(),
        fechaFirmaSignatura.getUTCMonth(),
        fechaFirmaSignatura.getUTCDate() + 7,
      ),
    );
    const firstDueDate = primerVencimiento.toISOString().split('T')[0];

    const schedule = this.buildFrenchSchedule(
      amount,
      periodRate,
      CUOTAS_COUNT,
      firstDueDate,
    );

    const cuotas: CuotaRow[] = [];
    for (let i = 0; i < schedule.length; i++) {
      const item = schedule[i];
      const cuota = await this.cuotasRepository.insertCuota(client, {
        loan_id: loanId,
        numero_cuota: i + 1,
        fecha_vencimiento: item.due_date,
        capital: item.amortization,
        interes: item.interest,
        iva_interes: item.vat,
        total_cuota: item.gross_installment,
      });
      cuotas.push(cuota);
    }

    return cuotas;
  }

  private buildFrenchSchedule(
    principal: number,
    periodRate: number,
    installments: number,
    firstDueDate: string,
  ): ScheduleItem[] {
    const r = periodRate;
    const n = installments;

    const cuotaBase =
      r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -n)) : principal / n;

    const schedule: Array<{
      amortization: number;
      interest: number;
      vat: number;
      gross_installment: number;
      due_date: string;
    }> = [];

    let saldo = principal;

    for (let i = 1; i <= n; i++) {
      const interest = saldo * r;
      const isLast = i === n;
      const amortizationRaw = isLast ? saldo : cuotaBase - interest;
      const vat = interest * IVA_RATE;

      schedule.push({
        amortization: this.round2(amortizationRaw),
        interest: this.round2(interest),
        vat: this.round2(vat),
        gross_installment: this.round2(amortizationRaw + interest + vat),
        due_date: this.addDays(firstDueDate, (i - 1) * 7),
      });

      saldo -= amortizationRaw;
    }

    // Cierre exacto contra principal — última cuota absorbe redondeos
    const lastIdx = schedule.length - 1;
    if (lastIdx >= 0) {
      const sumAmort = schedule.reduce(
        (s, x, idx) => (idx < lastIdx ? s + x.amortization : s),
        0,
      );
      const lastAmort = this.round2(principal - sumAmort);
      const last = schedule[lastIdx];
      schedule[lastIdx] = {
        ...last,
        amortization: lastAmort,
        gross_installment: this.round2(lastAmort + last.interest + last.vat),
      };
    }

    return schedule;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private addDays(isoDate: string, days: number): string {
    const d = new Date(isoDate + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }
}
