import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { LeadsListQueryDto } from './dto/leads-list-query.dto';

@Injectable()
export class LeadsBackofficeService {
  public constructor(private readonly dbService: DbService) {}

  public async list(query: LeadsListQueryDto): Promise<{
    ok: true;
    page: number;
    limit: number;
    rows: Array<{
      id: string;
      phone: string;
      stage: string;
      current_case_id: string | null;
      last_terms_sent_at: string | null;
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

    if (query.stage) {
      conditions.push(`stage = $${p}`);
      params.push(query.stage);
      p += 1;
    }

    if (query.q?.trim()) {
      const like = `%${query.q.trim()}%`;
      conditions.push(`(phone ILIKE $${p} OR id::text ILIKE $${p})`);
      params.push(like);
      p += 1;
    }

    params.push(limit, offset);
    const limitIx = p;
    const offsetIx = p + 1;

    const result = await this.dbService.query<{
      id: string;
      phone: string;
      stage: string;
      current_case_id: string | null;
      last_terms_sent_at: Date | string | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `
      SELECT
        id,
        phone,
        stage,
        current_case_id,
        last_terms_sent_at,
        created_at,
        updated_at
      FROM leads
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
        stage: r.stage,
        current_case_id: r.current_case_id,
        last_terms_sent_at: r.last_terms_sent_at
          ? r.last_terms_sent_at instanceof Date
            ? r.last_terms_sent_at.toISOString()
            : String(r.last_terms_sent_at)
          : null,
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
