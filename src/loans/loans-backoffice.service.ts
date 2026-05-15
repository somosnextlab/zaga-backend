import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { LoansListQueryDto } from './dto/loans-list-query.dto';

@Injectable()
export class LoansBackofficeService {
  public constructor(private readonly dbService: DbService) {}

  public async list(query: LoansListQueryDto): Promise<{
    ok: true;
    page: number;
    limit: number;
    rows: Array<{
      loan_id: string;
      case_id: string | null;
      user_id: string;
      phone: string;
      cuit: string | null;
      amount: number | null;
      status: string;
      created_at: string;
      disbursed_at: string | null;
    }>;
  }> {
    const limit = query.limit;
    const page = query.page;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let p = 1;

    if (query.status?.trim()) {
      conditions.push(`l.status = $${p}`);
      params.push(query.status.trim());
      p += 1;
    }

    if (query.q?.trim()) {
      const raw = query.q.trim();
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const or: string[] = [];
      if (uuidRe.test(raw)) {
        or.push(`l.id = $${p}::uuid`);
        params.push(raw);
        p += 1;
      }
      const phoneIdx = p;
      or.push(`l.phone ILIKE $${phoneIdx}`);
      params.push(`%${raw}%`);
      p += 1;

      const digits = raw.replace(/\D/g, '');
      if (digits.length > 0) {
        const cuitIdx = p;
        or.push(
          `regexp_replace(COALESCE(u.cuit, ''), '\\D', '', 'g') LIKE $${cuitIdx}`,
        );
        params.push(`%${digits}%`);
        p += 1;
      }

      conditions.push(`(${or.join(' OR ')})`);
    }

    params.push(limit, offset);
    const limitIx = p;
    const offsetIx = p + 1;

    const result = await this.dbService.query<{
      loan_id: string;
      case_id: string | null;
      user_id: string;
      phone: string;
      cuit: string | null;
      amount: string | number | null;
      status: string;
      created_at: Date | string;
    }>(
      `
      SELECT
        l.id AS loan_id,
        l.case_id,
        l.user_id,
        l.phone,
        u.cuit,
        co.amount,
        l.status,
        l.created_at
      FROM loans l
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN case_offers co ON co.id = l.offer_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY l.created_at DESC
      LIMIT $${limitIx} OFFSET $${offsetIx}
      `,
      params,
    );

    return {
      ok: true,
      page,
      limit,
      rows: result.rows.map((r) => ({
        loan_id: r.loan_id,
        case_id: r.case_id,
        user_id: r.user_id,
        phone: r.phone,
        cuit: r.cuit,
        amount:
          r.amount === null || r.amount === undefined ? null : Number(r.amount),
        status: r.status,
        created_at:
          r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        disbursed_at: null,
      })),
    };
  }
}
