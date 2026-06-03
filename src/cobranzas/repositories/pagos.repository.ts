import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';

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

@Injectable()
export class PagosRepository {
  public constructor(private readonly dbService: DbService) {}
}
