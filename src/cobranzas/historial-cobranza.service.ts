import { Injectable } from '@nestjs/common';
import { DbClient } from '../db/db.service';
import {
  HistorialCobranzaRepository,
  HistorialCobranzaRow,
  InsertHistorialInput,
} from './repositories/historial-cobranza.repository';

@Injectable()
export class HistorialCobranzaService {
  public constructor(
    private readonly historialCobranzaRepository: HistorialCobranzaRepository,
  ) {}

  /** Append-only — no UPDATE, no DELETE sobre historial_cobranza. */
  public registrar(
    client: DbClient,
    input: InsertHistorialInput,
  ): Promise<HistorialCobranzaRow> {
    return this.historialCobranzaRepository.insert(client, input);
  }
}
