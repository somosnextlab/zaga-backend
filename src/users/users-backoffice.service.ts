import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { UsersListQueryDto } from './dto/users-list-query.dto';

@Injectable()
export class UsersBackofficeService {
  public constructor(private readonly dbService: DbService) {}

  public async list(query: UsersListQueryDto): Promise<{
    ok: true;
    page: number;
    limit: number;
    rows: Array<{
      id: string;
      phone: string;
      first_name: string | null;
      last_name: string | null;
      cuit: string | null;
      dni: string | null;
      employment_status: string | null;
      monthly_income_range: string | null;
      is_completed: boolean;
      created_at: string;
      updated_at: string;
    }>;
  }> {
    const limit = query.limit;
    const page = query.page;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let p = 1;

    if (query.q?.trim()) {
      const raw = query.q.trim();
      const like = `%${raw}%`;
      const digits = raw.replace(/\D/g, '');
      const likeIdx = p;
      const orParts: string[] = [
        `phone ILIKE $${likeIdx}`,
        `COALESCE(first_name, '') ILIKE $${likeIdx}`,
        `COALESCE(last_name, '') ILIKE $${likeIdx}`,
        `id::text ILIKE $${likeIdx}`,
      ];
      params.push(like);
      p += 1;

      if (digits.length > 0) {
        const digLike = `%${digits}%`;
        const digIdx = p;
        orParts.push(
          `regexp_replace(COALESCE(cuit, ''), '\\D', '', 'g') LIKE $${digIdx}`,
        );
        orParts.push(
          `regexp_replace(COALESCE(dni, ''), '\\D', '', 'g') LIKE $${digIdx}`,
        );
        params.push(digLike);
        p += 1;
      }

      conditions.push(`(${orParts.join(' OR ')})`);
    }

    params.push(limit, offset);
    const limitIx = p;
    const offsetIx = p + 1;

    const result = await this.dbService.query<{
      id: string;
      phone: string;
      first_name: string | null;
      last_name: string | null;
      cuit: string | null;
      dni: string | null;
      employment_status: string | null;
      monthly_income_range: string | null;
      is_completed: boolean;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `
      SELECT
        id,
        phone,
        first_name,
        last_name,
        cuit,
        dni,
        employment_status,
        monthly_income_range,
        is_completed,
        created_at,
        updated_at
      FROM users
      WHERE ${conditions.join(' AND ')}
      ORDER BY updated_at DESC
      LIMIT $${limitIx} OFFSET $${offsetIx}
      `,
      params,
    );

    return {
      ok: true,
      page,
      limit,
      rows: result.rows.map((r) => ({
        id: r.id,
        phone: r.phone,
        first_name: r.first_name,
        last_name: r.last_name,
        cuit: r.cuit,
        dni: r.dni,
        employment_status: r.employment_status,
        monthly_income_range: r.monthly_income_range,
        is_completed: r.is_completed,
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        updated_at:
          r.updated_at instanceof Date
            ? r.updated_at.toISOString()
            : String(r.updated_at),
      })),
    };
  }
}
