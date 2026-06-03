import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';

export interface CompromisoPagoRow {
  readonly id: string;
  readonly loan_id: string;
  readonly cuota_id: string | null;
  readonly fecha_prometida: string;
  readonly monto_prometido: number;
  readonly canal: string | null;
  readonly texto_cliente: string | null;
  readonly estado: string;
  readonly registrado_por: string;
  readonly resuelto_at: string | null;
  readonly notas: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

@Injectable()
export class CompromisoPagoRepository {
  public constructor(private readonly dbService: DbService) {}
}
