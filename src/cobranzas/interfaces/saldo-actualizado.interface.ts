export interface CuotaVencidaActualizada {
  readonly numero_cuota: number;
  readonly fecha_vencimiento: string;
  readonly capital_vencido_impago: number;
  readonly interes_pendiente: number;
  readonly iva_interes_pendiente: number;
  readonly dpd: number;
  readonly mora_base: number;
  readonly iva_mora: number;
  readonly total_mora: number;
  readonly saldo_actualizado: number;
  readonly es_bonificable: boolean;
  readonly es_solapada: boolean;
}

export interface CuotaVigenteActualizada {
  readonly numero_cuota: number;
  readonly fecha_vencimiento: string;
  readonly capital: number;
  readonly interes: number;
  readonly iva_interes: number;
  readonly total_cuota: number;
  readonly saldo_pendiente: number;
}

export interface SaldoActualizadoTotales {
  readonly capital_vencido_total: number;
  readonly interes_vencido_total: number;
  readonly iva_interes_vencido_total: number;
  readonly mora_total: number;
  readonly iva_mora_total: number;
  readonly cuota_vigente_monto: number;
  readonly total_para_quedar_al_dia: number;
  readonly total_bonificado: number;
}

export interface SaldoActualizadoResponse {
  readonly loan_id: string;
  readonly public_loan_number: string | null;
  readonly dpd_max: number;
  readonly cuotas_vencidas: CuotaVencidaActualizada[];
  readonly cuota_vigente: CuotaVigenteActualizada | null;
  readonly totales: SaldoActualizadoTotales;
}
