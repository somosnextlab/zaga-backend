/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import type {
  CaseOfferPayload,
  CreateCaseOfferResponse,
  ScheduleItem,
} from './interfaces/offer-engine-response.interface';
import {
  ALLOWED_CASE_STATUS_FOR_OFFER,
  IVA_RATE,
  MVP_INSTALLMENTS,
  MVP_PERIODICITY,
  PRICING_ENGINE_VERSION,
  WEEKS_PER_YEAR,
} from './offer-engine.constants';

export interface CreateCaseOfferInput {
  case_id: string;
  monto_pre_aprobado: number;
  tasa_nominal_anual: number;
  requires_guarantor?: boolean;
  created_by?: string;
  first_due_date?: string;
}

@Injectable()
export class OfferEngineService {
  private readonly logger = new Logger(OfferEngineService.name);

  public constructor(private readonly dbService: DbService) {}

  /**
   * Crea una oferta de préstamo para un caso en estado WAITING_CEO.
   * Ejecuta el motor ZagaTasas, calcula condiciones económicas con sistema francés,
   * IVA sobre interés, versiona ofertas previas y actualiza el caso.
   */
  public async createCaseOffer(
    input: CreateCaseOfferInput,
  ): Promise<CreateCaseOfferResponse> {
    try {
      return await this.dbService.withTransaction(
        async (client: PoolClient) => {
          const caseRow = await this.findCaseForOffer(client, input.case_id);

          if (!caseRow) {
            throw new NotFoundException('Caso no encontrado');
          }

          if (caseRow.status !== ALLOWED_CASE_STATUS_FOR_OFFER) {
            throw new BadRequestException(
              `El caso debe estar en estado ${ALLOWED_CASE_STATUS_FOR_OFFER} para crear una oferta`,
            );
          }

          const tnaDecimal = input.tasa_nominal_anual / 100;
          const periodRate = tnaDecimal / WEEKS_PER_YEAR;

          const schedule = this.buildFrenchSchedule(
            input.monto_pre_aprobado,
            periodRate,
            MVP_INSTALLMENTS,
            input.first_due_date ?? null,
          );

          const paymentAmount = schedule[0]?.gross_installment ?? 0;
          const totalInterest = schedule.reduce(
            (sum, s) => sum + s.interest,
            0,
          );
          const totalVat = schedule.reduce((sum, s) => sum + s.vat, 0);
          const totalPayable = schedule.reduce(
            (sum, s) => sum + s.gross_installment,
            0,
          );
          const cftoAmount = totalPayable - input.monto_pre_aprobado;
          const cftoPercent =
            input.monto_pre_aprobado > 0
              ? cftoAmount / input.monto_pre_aprobado
              : 0;

          const tea = Math.pow(1 + periodRate, WEEKS_PER_YEAR) - 1;
          const cftna = tnaDecimal * (1 + IVA_RATE);
          const cftea = tea * (1 + IVA_RATE);

          const maxVersionResult = await client.query<{
            max_version: number | null;
          }>(
            `SELECT MAX(version) as max_version FROM case_offers WHERE case_id = $1`,
            [input.case_id],
          );
          const maxVersion = maxVersionResult.rows[0]?.max_version ?? 0;
          const newVersion = maxVersion + 1;

          await client.query(
            `UPDATE case_offers
         SET status = 'SUPERSEDED'
         WHERE case_id = $1 AND status IN ('SENT', 'DRAFT')`,
            [input.case_id],
          );

          const createdBy = input.created_by ?? 'system';
          const requiresGuarantor = input.requires_guarantor ?? false;

          const insertResult = await client.query<{
            id: string;
            case_id: string;
            version: number;
            amount: number;
            installments: number;
            status: string;
            payment_periodicity: string;
            payment_amount: number;
            tasa_nominal_anual: number;
            costo_financiero_final_operacion: number;
            tea: number;
            cftna: number;
            cftea: number;
            total_interest: number;
            total_vat: number;
            total_payable: number;
            cfto_amount: number;
            cfto_percent: number;
            pricing_engine_version: string;
          }>(
            `INSERT INTO case_offers (
          case_id, version, amount, installments, status, created_by,
          created_at, sent_at, payment_periodicity, payment_amount, tasa_nominal_anual,
          costo_financiero_final_operacion, tea, cftna, cftea,
          total_interest, total_vat, total_payable, cfto_amount, cfto_percent,
          pricing_engine_version
        ) VALUES (
          $1, $2, $3, $4, 'SENT', $5, now(), now(), $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18
        ) RETURNING id, case_id, version, amount, installments, status,
          payment_periodicity, payment_amount, tasa_nominal_anual,
          costo_financiero_final_operacion, tea, cftna, cftea,
          total_interest, total_vat, total_payable, cfto_amount, cfto_percent,
          pricing_engine_version`,
            [
              input.case_id,
              newVersion,
              input.monto_pre_aprobado,
              MVP_INSTALLMENTS,
              createdBy,
              MVP_PERIODICITY,
              this.round2(paymentAmount),
              input.tasa_nominal_anual,
              this.round2(cftoAmount),
              this.round2(tea),
              this.round2(cftna),
              this.round2(cftea),
              this.round2(totalInterest),
              this.round2(totalVat),
              this.round2(totalPayable),
              this.round2(cftoAmount),
              this.round2(cftoPercent),
              PRICING_ENGINE_VERSION,
            ],
          );

          const offerRow = insertResult.rows[0];
          if (!offerRow) {
            this.logger.error('Insert case_offer no devolvió fila');
            throw new InternalServerErrorException(
              'Error al crear la oferta. Intente nuevamente.',
            );
          }

          await client.query(
            `UPDATE cases
         SET current_offer_id = $1, status = 'OFFER_SENT',
             requires_guarantor = $2, updated_at = now()
         WHERE id = $3`,
            [offerRow.id, requiresGuarantor, input.case_id],
          );

          const offer: CaseOfferPayload = {
            offer_id: offerRow.id,
            case_id: offerRow.case_id,
            version: offerRow.version,
            requires_guarantor: requiresGuarantor,
            amount: offerRow.amount,
            installments: offerRow.installments,
            payment_periodicity: offerRow.payment_periodicity,
            payment_amount: offerRow.payment_amount,
            tasa_nominal_anual: offerRow.tasa_nominal_anual,
            tea: offerRow.tea,
            cftna: offerRow.cftna,
            cftea: offerRow.cftea,
            total_interest: offerRow.total_interest,
            total_vat: offerRow.total_vat,
            total_payable: offerRow.total_payable,
            cfto_amount: offerRow.cfto_amount,
            cfto_percent: offerRow.cfto_percent,
            pricing_engine_version: offerRow.pricing_engine_version,
            schedule,
          };

          return { ok: true, offer };
        },
      );
    } catch (error) {
      const err = error as Error & { code?: string; detail?: string };
      this.logger.error(`createCaseOffer failed: ${err.message}`, err.stack);
      if (err.code) {
        this.logger.error(
          `DB code: ${err.code}, detail: ${err.detail ?? 'N/A'}`,
        );
      }
      throw error;
    }
  }

  /**
   * Calcula la tasa periódica semanal a partir de TNA en porcentaje.
   * TNA 210 => 2.10 decimal => periodRate = 2.10 / 52
   */
  public computePeriodRate(tnaPercent: number): number {
    const tnaDecimal = tnaPercent / 100;
    return tnaDecimal / WEEKS_PER_YEAR;
  }

  /**
   * Construye el schedule con sistema francés.
   * IVA solo sobre interés. Última cuota absorbe redondeos.
   * total amortization cierra exactamente contra principal.
   */
  private buildFrenchSchedule(
    principal: number,
    periodRate: number,
    installments: number,
    firstDueDate: string | null,
  ): ScheduleItem[] {
    const r = periodRate;
    const n = installments;

    const cuotaBase =
      r > 0 ? (principal * r) / (1 - Math.pow(1 + r, -n)) : principal / n;

    const schedule: ScheduleItem[] = [];
    let saldo = principal;

    for (let i = 1; i <= n; i++) {
      const interest = saldo * r;
      const isLast = i === n;
      const amortizationRaw = isLast ? saldo : cuotaBase - interest;
      const vat = interest * IVA_RATE;
      const baseInstallment = cuotaBase;
      const grossRaw = baseInstallment + vat;

      const closingBalance = saldo - amortizationRaw;

      schedule.push({
        installment_number: i,
        opening_balance: this.round2(saldo),
        interest: this.round2(interest),
        vat: this.round2(vat),
        amortization: this.round2(amortizationRaw),
        base_installment: this.round2(baseInstallment),
        gross_installment: this.round2(grossRaw),
        closing_balance: this.round2(Math.max(0, closingBalance)),
        due_date: firstDueDate ? this.addWeeks(firstDueDate, i - 1) : null,
      });

      saldo = closingBalance;
    }

    const lastIdx = schedule.length - 1;
    if (lastIdx >= 0) {
      const sumAmortization = schedule.reduce(
        (s, x, idx) => (idx < lastIdx ? s + x.amortization : s),
        0,
      );
      const lastAmortization = this.round2(principal - sumAmortization);
      schedule[lastIdx].amortization = lastAmortization;
      schedule[lastIdx].gross_installment = this.round2(
        lastAmortization + schedule[lastIdx].interest + schedule[lastIdx].vat,
      );
      schedule[lastIdx].closing_balance = 0;
    }

    return schedule;
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private addWeeks(isoDate: string, weeks: number): string {
    try {
      const d = new Date(isoDate);
      if (Number.isNaN(d.getTime())) return isoDate;
      d.setDate(d.getDate() + weeks * 7);
      return d.toISOString().split('T')[0] ?? isoDate;
    } catch {
      return isoDate;
    }
  }

  private async findCaseForOffer(
    client: PoolClient,
    caseId: string,
  ): Promise<{ id: string; status: string } | null> {
    const result = await client.query<{ id: string; status: string }>(
      `SELECT id, status FROM cases WHERE id = $1 FOR UPDATE`,
      [caseId],
    );
    return result.rows[0] ?? null;
  }
}
