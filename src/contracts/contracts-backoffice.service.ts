import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { ContractsListQueryDto } from './dto/contracts-list-query.dto';

@Injectable()
export class ContractsBackofficeService {
  public constructor(private readonly dbService: DbService) {}

  public async list(query: ContractsListQueryDto): Promise<{
    ok: true;
    page: number;
    limit: number;
    rows: Array<{
      id: string;
      case_id: string;
      phone: string;
      status: string;
      provider: string;
      issued_at: string | null;
      expires_at: string | null;
      signed_at: string | null;
      created_at: string;
    }>;
  }> {
    const limit = query.limit;
    const page = query.page;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let p = 1;

    if (query.status?.trim()) {
      conditions.push(`cc.status = $${p}`);
      params.push(query.status.trim());
      p += 1;
    }

    if (query.q?.trim()) {
      const raw = query.q.trim();
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const or: string[] = [];
      if (uuidRe.test(raw)) {
        or.push(`cc.case_id = $${p}::uuid`);
        params.push(raw);
        p += 1;
        or.push(`cc.id = $${p}::uuid`);
        params.push(raw);
        p += 1;
      }
      const phoneIdx = p;
      or.push(`c.phone ILIKE $${phoneIdx}`);
      params.push(`%${raw}%`);
      p += 1;

      const extIdx = p;
      or.push(`COALESCE(cc.external_document_id, '') ILIKE $${extIdx}`);
      params.push(`%${raw}%`);
      p += 1;

      conditions.push(`(${or.join(' OR ')})`);
    }

    params.push(limit, offset);
    const limitIx = p;
    const offsetIx = p + 1;

    const result = await this.dbService.query<{
      id: string;
      case_id: string;
      phone: string;
      status: string;
      provider: string;
      issued_at: Date | string | null;
      expires_at: Date | string | null;
      signed_at: Date | string | null;
      created_at: Date | string;
    }>(
      `
      SELECT
        cc.id,
        cc.case_id,
        c.phone,
        cc.status,
        cc.provider,
        cc.issued_at,
        cc.expires_at,
        cc.signed_at,
        cc.created_at
      FROM case_contracts cc
      INNER JOIN cases c ON c.id = cc.case_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY cc.created_at DESC
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
        case_id: r.case_id,
        phone: r.phone,
        status: r.status,
        provider: r.provider,
        issued_at: r.issued_at
          ? r.issued_at instanceof Date
            ? r.issued_at.toISOString()
            : String(r.issued_at)
          : null,
        expires_at: r.expires_at
          ? r.expires_at instanceof Date
            ? r.expires_at.toISOString()
            : String(r.expires_at)
          : null,
        signed_at: r.signed_at
          ? r.signed_at instanceof Date
            ? r.signed_at.toISOString()
            : String(r.signed_at)
          : null,
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
      })),
    };
  }
}
