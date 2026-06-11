import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DbClient, DbService } from '../db/db.service';
import { HistorialCobranzaRepository } from './repositories/historial-cobranza.repository';
import type { CuotaRow } from './repositories/cuotas.repository';
import { CuotasRepository } from './repositories/cuotas.repository';
import type { PagoRow } from './repositories/pagos.repository';
import {
  InsertPagoInput,
  PagosRepository,
} from './repositories/pagos.repository';
import { MoraService } from './mora.service';
import type { RegistrarPagoDto } from './dto/registrar-pago.dto';
import type { ValidarPagoDto } from './dto/validar-pago.dto';

const ESTADOS_IMPUTABLES = ['recibido', 'pendiente_validacion', 'dudoso'];
const PAGO_PARCIAL_MINIMO = 0.4;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ImputarResponse {
  readonly ok: true;
  readonly pago_id: string;
  readonly cuotas_imputadas: number;
  readonly saldo_restante: number;
}

@Injectable()
export class PagosService {
  public constructor(
    private readonly dbService: DbService,
    private readonly pagosRepository: PagosRepository,
    private readonly cuotasRepository: CuotasRepository,
    private readonly historialRepository: HistorialCobranzaRepository,
    private readonly moraService: MoraService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /loans/:loanId/pagos — registrar comprobante recibido
  // ---------------------------------------------------------------------------
  public async registrar(
    loanId: string,
    dto: RegistrarPagoDto,
    registradoPor: string,
  ): Promise<PagoRow> {
    return this.dbService.withTransaction(async (client: DbClient) => {
      const loan = await this.findLoanDisbursed(client, loanId);
      if (!loan) throw new NotFoundException('Préstamo no encontrado.');
      if (!loan.disbursed_at) {
        throw new BadRequestException(
          'El préstamo no ha sido desembolsado. No se pueden registrar pagos.',
        );
      }

      const input: InsertPagoInput = {
        loan_id: loanId,
        monto: dto.monto,
        fecha_accion: dto.fecha_accion ?? null,
        comprobante_url: dto.comprobante_url ?? null,
        medio_pago: dto.medio_pago ?? null,
        cuenta_origen: dto.cuenta_origen ?? null,
        notas: dto.notas ?? null,
        registrado_por: registradoPor,
      };

      const pago = await this.pagosRepository.insertPago(client, input);

      await this.historialRepository.insert(client, {
        loan_id: loanId,
        tipo_accion: 'comprobante_recibido',
        descripcion: `Comprobante recibido por $${dto.monto.toFixed(2)} vía ${dto.medio_pago ?? 'sin especificar'}.`,
        pago_id: pago.id,
        realizado_por: registradoPor,
      });

      return pago;
    });
  }

  // ---------------------------------------------------------------------------
  // PATCH /pagos/:id/validar — validar o rechazar comprobante (staff)
  // ---------------------------------------------------------------------------
  public async validar(
    pagoId: string,
    dto: ValidarPagoDto,
    realizadoPor: string,
  ): Promise<PagoRow> {
    const updated = await this.dbService.withTransaction(
      async (client: DbClient) => {
        const pago = await this.pagosRepository.findByIdForUpdate(
          client,
          pagoId,
        );
        if (!pago) throw new NotFoundException('Pago no encontrado.');

        if (!ESTADOS_IMPUTABLES.includes(pago.estado)) {
          throw new ConflictException(
            `El pago ya tiene estado '${pago.estado}' y no puede ser validado/rechazado.`,
          );
        }

        const result = await this.pagosRepository.updateEstado(client, pagoId, {
          estado: dto.estado,
          fecha_acreditacion: dto.fecha_acreditacion ?? null,
          notas: dto.notas ?? null,
        });

        const tipoAccion =
          dto.estado === 'validado'
            ? 'pago_validado'
            : dto.estado === 'rechazado'
              ? 'pago_rechazado'
              : 'pago_dudoso';

        await this.historialRepository.insert(client, {
          loan_id: pago.loan_id,
          tipo_accion: tipoAccion,
          descripcion: dto.notas ?? null,
          pago_id: pagoId,
          realizado_por: realizadoPor,
        });

        return result;
      },
    );

    if (dto.estado === 'validado') {
      await this.imputar(pagoId, 'sistema_automatico');
    }

    return updated;
  }

  // ---------------------------------------------------------------------------
  // POST /pagos/:id/imputar — imputar pago validado a cuotas
  // ---------------------------------------------------------------------------
  public async imputar(
    pagoId: string,
    realizadoPor: string,
  ): Promise<ImputarResponse> {
    return this.dbService.withTransaction(async (client: DbClient) => {
      const pago = await this.pagosRepository.findByIdForUpdate(client, pagoId);
      if (!pago) throw new NotFoundException('Pago no encontrado.');

      if (pago.estado !== 'validado') {
        throw new ConflictException(
          `El pago debe estar en estado 'validado' para imputar. Estado actual: '${pago.estado}'.`,
        );
      }
      if (pago.imputado) {
        throw new ConflictException('El pago ya fue imputado.');
      }

      const loan = await this.moraService.getLoanWithTNA(pago.loan_id);
      if (!loan.disbursed_at) {
        throw new BadRequestException(
          'El préstamo no ha sido desembolsado. No se puede imputar.',
        );
      }

      const tnaDecimal = Number(loan.tasa_nominal_anual) / 100;

      // Cuotas activas ordenadas por fecha_vencimiento ASC (FOR UPDATE)
      const cuotas = await this.cuotasRepository.findByLoanIdForUpdate(
        client,
        pago.loan_id,
      );

      // Calcular total adeudado actualizado para validar regla 40%
      const totalAdeudado = await this.calcularTotalAdeudado(
        client,
        cuotas,
        tnaDecimal,
      );

      const minimo = round2(totalAdeudado * PAGO_PARCIAL_MINIMO);
      if (pago.monto < minimo) {
        throw new UnprocessableEntityException(
          `El pago de $${pago.monto.toFixed(2)} es menor al mínimo requerido del 40% ($${minimo.toFixed(2)}) del total adeudado actualizado ($${totalAdeudado.toFixed(2)}).`,
        );
      }

      const esParcial = round2(pago.monto) < totalAdeudado;

      let saldoDisponible = pago.monto;
      let cuotasImputadas = 0;

      for (const cuota of cuotas) {
        if (saldoDisponible <= 0) break;

        const sums = await this.pagosRepository.getSumsForCuota(
          cuota.id,
          client,
        );
        const dpd = this.moraService.calcularDPD(cuota.fecha_vencimiento);

        // Mora solo para cuotas vencidas
        let moraPendiente = 0;
        let ivaMoraPendiente = 0;
        if (dpd > 0) {
          const mora = this.moraService.calcularMoraParaCuota(
            cuota,
            tnaDecimal,
            sums,
          );
          moraPendiente = round2(
            Math.max(0, mora.mora_base - sums.sum_mora_aplicada),
          );
          ivaMoraPendiente = round2(
            Math.max(0, mora.iva_mora - sums.sum_iva_mora_aplicada),
          );
        }

        const interesPendiente = round2(
          Math.max(0, cuota.interes - sums.sum_interes_aplicado),
        );
        const ivaInteresPendiente = round2(
          Math.max(0, cuota.iva_interes - sums.sum_iva_interes_aplicado),
        );
        const capitalPendiente = round2(
          Math.max(0, cuota.capital - sums.sum_capital_aplicado),
        );

        const totalPendienteCuota =
          moraPendiente +
          ivaMoraPendiente +
          interesPendiente +
          ivaInteresPendiente +
          capitalPendiente;

        if (totalPendienteCuota <= 0) continue;

        // Aplicar en orden contractual: mora → IVA mora → interés → IVA interés → capital
        const moraAplicada = round2(Math.min(saldoDisponible, moraPendiente));
        saldoDisponible = round2(saldoDisponible - moraAplicada);

        const ivaMoraAplicada = round2(
          Math.min(saldoDisponible, ivaMoraPendiente),
        );
        saldoDisponible = round2(saldoDisponible - ivaMoraAplicada);

        const interesAplicado = round2(
          Math.min(saldoDisponible, interesPendiente),
        );
        saldoDisponible = round2(saldoDisponible - interesAplicado);

        const ivaInteresAplicado = round2(
          Math.min(saldoDisponible, ivaInteresPendiente),
        );
        saldoDisponible = round2(saldoDisponible - ivaInteresAplicado);

        const capitalAplicado = round2(
          Math.min(saldoDisponible, capitalPendiente),
        );
        saldoDisponible = round2(saldoDisponible - capitalAplicado);

        const montoAplicado = round2(
          moraAplicada +
            ivaMoraAplicada +
            interesAplicado +
            ivaInteresAplicado +
            capitalAplicado,
        );

        if (montoAplicado <= 0) continue;

        await this.pagosRepository.insertPagoCuota(client, {
          pago_id: pago.id,
          cuota_id: cuota.id,
          monto_aplicado: montoAplicado,
          mora_aplicada: moraAplicada,
          iva_mora_aplicada: ivaMoraAplicada,
          interes_aplicado: interesAplicado,
          iva_interes_aplicado: ivaInteresAplicado,
          capital_aplicado: capitalAplicado,
        });

        // Nuevo saldo_pendiente = solo capital + interés + IVA restantes
        const newCapitalPend = round2(capitalPendiente - capitalAplicado);
        const newInteresPend = round2(interesPendiente - interesAplicado);
        const newIvaInteresPend = round2(
          ivaInteresPendiente - ivaInteresAplicado,
        );
        const newSaldo = round2(
          newCapitalPend + newInteresPend + newIvaInteresPend,
        );

        // Estado: solo actualizar si se pagó algo del núcleo (capital/interés/IVA)
        const nucleoPagado =
          capitalAplicado + interesAplicado + ivaInteresAplicado;
        const newEstado = this.resolverEstadoCuota(
          cuota,
          newSaldo,
          nucleoPagado,
        );
        const pagadaAt = newEstado === 'pagada' ? new Date() : null;

        await this.cuotasRepository.updateSaldoAndEstado(
          client,
          cuota.id,
          newSaldo,
          newEstado,
          pagadaAt,
        );

        await this.historialRepository.insert(client, {
          loan_id: cuota.loan_id,
          tipo_accion: 'pago_imputado',
          descripcion: `Imputación $${montoAplicado.toFixed(2)} a cuota #${cuota.numero_cuota}`,
          dpd_al_momento: dpd,
          cuota_id: cuota.id,
          pago_id: pago.id,
          realizado_por: realizadoPor,
          metadata: {
            mora_aplicada: moraAplicada,
            iva_mora_aplicada: ivaMoraAplicada,
            interes_aplicado: interesAplicado,
            iva_interes_aplicado: ivaInteresAplicado,
            capital_aplicado: capitalAplicado,
            saldo_pendiente_resultante: newSaldo,
          },
        });

        cuotasImputadas++;
      }

      await this.pagosRepository.markImputado(client, pago.id, esParcial);

      return {
        ok: true,
        pago_id: pago.id,
        cuotas_imputadas: cuotasImputadas,
        saldo_restante: round2(saldoDisponible),
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private async calcularTotalAdeudado(
    client: DbClient,
    cuotas: CuotaRow[],
    tnaDecimal: number,
  ): Promise<number> {
    let total = 0;
    let haySolapada = false;
    let cuotaVigenteAportada = false;

    for (const cuota of cuotas) {
      const dpd = this.moraService.calcularDPD(cuota.fecha_vencimiento);
      if (dpd > 0) {
        const sums = await this.pagosRepository.getSumsForCuota(
          cuota.id,
          client,
        );
        const mora = this.moraService.calcularMoraParaCuota(
          cuota,
          tnaDecimal,
          sums,
        );
        total = round2(total + mora.saldo_actualizado);
        if (mora.es_solapada) haySolapada = true;
      } else if (!cuotaVigenteAportada) {
        if (haySolapada) {
          // Solapamiento: incluir cuota vigente en el total
          total = round2(total + cuota.saldo_pendiente);
        }
        cuotaVigenteAportada = true;
      }
    }

    return total;
  }

  private resolverEstadoCuota(
    cuota: CuotaRow,
    newSaldo: number,
    nucleoPagado: number,
  ): string {
    if (newSaldo <= 0) return 'pagada';
    if (nucleoPagado > 0) return 'parcialmente_pagada';
    return cuota.estado; // Si solo se pagó mora, el estado permanece igual
  }

  private async findLoanDisbursed(
    client: DbClient,
    loanId: string,
  ): Promise<{ disbursed_at: Date | null } | null> {
    const result = await client.query<{ disbursed_at: Date | null }>(
      'SELECT disbursed_at FROM loans WHERE id = $1',
      [loanId],
    );
    return result.rows[0] ?? null;
  }
}
