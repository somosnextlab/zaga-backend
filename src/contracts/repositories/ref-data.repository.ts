import { Injectable } from '@nestjs/common';
import { DbClient } from '../../db/db.service';

@Injectable()
export class RefDataRepository {
  public async localidadExistsForProvincia(
    client: DbClient,
    nombre: string,
    provincia: string,
  ): Promise<boolean> {
    const result = await client.query<{ exists: boolean }>(
      `
      SELECT EXISTS(
        SELECT 1
        FROM ref_localidades
        WHERE LOWER(nombre) = LOWER($1)
          AND LOWER(provincia) = LOWER($2)
      ) AS exists
      `,
      [nombre, provincia],
    );
    return result.rows[0]?.exists ?? false;
  }

  public async findBancoByNombre(
    client: DbClient,
    nombre: string,
  ): Promise<{ id: string; nombre: string } | null> {
    const result = await client.query<{ id: string; nombre: string }>(
      `
      SELECT id, nombre
      FROM ref_bancos
      WHERE LOWER(nombre) = LOWER($1)
      `,
      [nombre],
    );
    return result.rows[0] ?? null;
  }
}
