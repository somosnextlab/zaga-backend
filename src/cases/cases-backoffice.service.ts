import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { CasesListQueryDto } from './dto/cases-list-query.dto';

function textForDetail(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return '';
}

type TimelineEvent = {
  kind: string;
  at: string;
  detail: string;
};

@Injectable()
export class CasesBackofficeService {
  public constructor(private readonly dbService: DbService) {}

  public async list(query: CasesListQueryDto): Promise<{
    ok: true;
    page: number;
    limit: number;
    rows: Array<{
      case_id: string;
      phone: string;
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      cuit: string | null;
      requested_amount: number;
      status: string;
      requires_guarantor: boolean;
      prequal_mode: string | null;
      manual_review_reason: string | null;
      current_offer_id: string | null;
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

    if (query.status?.trim()) {
      conditions.push(`c.status = $${p}`);
      params.push(query.status.trim());
      p += 1;
    }

    if (query.q?.trim()) {
      const raw = query.q.trim();
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const or: string[] = [];

      if (uuidRe.test(raw)) {
        or.push(`c.id = $${p}::uuid`);
        params.push(raw);
        p += 1;
      }

      const phoneIdx = p;
      or.push(`c.phone ILIKE $${phoneIdx}`);
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
      case_id: string;
      phone: string;
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      cuit: string | null;
      requested_amount: string | number;
      status: string;
      requires_guarantor: boolean;
      prequal_mode: string | null;
      manual_review_reason: string | null;
      current_offer_id: string | null;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `
      SELECT
        c.id AS case_id,
        c.phone,
        c.user_id,
        u.first_name,
        u.last_name,
        u.cuit,
        c.requested_amount,
        c.status,
        c.requires_guarantor,
        c.prequal_mode,
        c.manual_review_reason,
        c.current_offer_id,
        c.created_at,
        c.updated_at
      FROM cases c
      INNER JOIN users u ON u.id = c.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY c.updated_at DESC
      LIMIT $${limitIx} OFFSET $${offsetIx}
      `,
      params,
    );

    return {
      ok: true,
      page,
      limit,
      rows: result.rows.map((r) => ({
        case_id: r.case_id,
        phone: r.phone,
        user_id: r.user_id,
        first_name: r.first_name,
        last_name: r.last_name,
        cuit: r.cuit,
        requested_amount: Number(r.requested_amount),
        status: r.status,
        requires_guarantor: r.requires_guarantor,
        prequal_mode: r.prequal_mode,
        manual_review_reason: r.manual_review_reason,
        current_offer_id: r.current_offer_id,
        created_at: this.iso(r.created_at),
        updated_at: this.iso(r.updated_at),
      })),
    };
  }

  public async getDetail(caseId: string): Promise<{
    ok: true;
    case: Record<string, unknown>;
    user: Record<string, unknown> | null;
    lead: Record<string, unknown> | null;
    prequal: { exists: boolean; row: Record<string, unknown> | null };
    offers: Record<string, unknown>[];
    guarantors: Record<string, unknown>[];
    contract: { exists: boolean; row: Record<string, unknown> | null };
    loan: { exists: boolean; row: Record<string, unknown> | null };
  }> {
    const c = await this.dbService.query(
      `SELECT * FROM cases WHERE id = $1 LIMIT 1`,
      [caseId],
    );
    const caseRow = c.rows[0] as Record<string, unknown> | undefined;
    if (!caseRow) {
      throw new NotFoundException('Caso no encontrado');
    }

    const userId = String(caseRow['user_id']);
    const phone = String(caseRow['phone']);

    const [user, lead, prequal, offers, guarantors, contract, loan] =
      await Promise.all([
        this.dbService.query(`SELECT * FROM users WHERE id = $1`, [userId]),
        this.dbService.query(`SELECT * FROM leads WHERE phone = $1 LIMIT 1`, [
          phone,
        ]),
        this.dbService.query(
          `
          SELECT * FROM user_prequals
          WHERE user_id = $1
          ORDER BY checked_at DESC NULLS LAST
          LIMIT 1
          `,
          [userId],
        ),
        this.dbService.query(
          `SELECT * FROM case_offers WHERE case_id = $1 ORDER BY created_at ASC`,
          [caseId],
        ),
        this.dbService.query(
          `SELECT * FROM case_guarantors WHERE case_id = $1 ORDER BY attempt_no ASC`,
          [caseId],
        ),
        this.dbService.query(
          `
          SELECT * FROM case_contracts
          WHERE case_id = $1
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [caseId],
        ),
        this.dbService.query(
          `
          SELECT * FROM loans
          WHERE case_id = $1
          ORDER BY created_at DESC
          LIMIT 1
          `,
          [caseId],
        ),
      ]);

    const prequalRow = prequal.rows[0] as Record<string, unknown> | undefined;

    return {
      ok: true,
      case: this.serializeRow(caseRow),
      user: user.rows[0]
        ? this.serializeRow(user.rows[0] as Record<string, unknown>)
        : null,
      lead: lead.rows[0]
        ? this.serializeRow(lead.rows[0] as Record<string, unknown>)
        : null,
      prequal: {
        exists: Boolean(prequalRow),
        row: prequalRow ? this.serializeRow(prequalRow) : null,
      },
      offers: offers.rows.map((r) =>
        this.serializeRow(r as Record<string, unknown>),
      ),
      guarantors: guarantors.rows.map((r) =>
        this.serializeRow(r as Record<string, unknown>),
      ),
      contract: {
        exists: Boolean(contract.rows[0]),
        row: contract.rows[0]
          ? this.serializeRow(contract.rows[0] as Record<string, unknown>)
          : null,
      },
      loan: {
        exists: Boolean(loan.rows[0]),
        row: loan.rows[0]
          ? this.serializeRow(loan.rows[0] as Record<string, unknown>)
          : null,
      },
    };
  }

  public async getTimeline(caseId: string): Promise<{
    ok: true;
    events: TimelineEvent[];
  }> {
    const detail = await this.getDetail(caseId);
    const events: TimelineEvent[] = [];
    const caseRow = detail.case;
    const phone = textForDetail(caseRow['phone']);
    const userRow = detail.user;
    const leadRow = detail.lead;
    const prequalRow = detail.prequal.row;
    const offers = detail.offers;
    const guarantors = detail.guarantors;
    const contractRow = detail.contract.row;
    const loanRow = detail.loan.row;

    if (leadRow?.['created_at']) {
      events.push({
        kind: 'LEAD_CREATED',
        at: this.iso(leadRow['created_at']),
        detail: 'Lead creado',
      });
    }

    if (phone) {
      const consents = await this.dbService.query<{
        created_at: Date | string | null;
        accepted_at: Date | string | null;
      }>(
        `
        SELECT created_at, accepted_at
        FROM consents
        WHERE phone = $1
        ORDER BY created_at ASC NULLS LAST
        `,
        [phone],
      );
      for (const row of consents.rows) {
        if (row.created_at) {
          events.push({
            kind: 'TERMS_SENT',
            at: this.iso(row.created_at),
            detail: 'TyC enviado',
          });
        }
        if (row.accepted_at) {
          events.push({
            kind: 'TERMS_ACCEPTED',
            at: this.iso(row.accepted_at),
            detail: 'TyC aceptado',
          });
        }
      }
    }

    if (userRow?.['is_completed'] === true && userRow['updated_at']) {
      events.push({
        kind: 'ONBOARDING_COMPLETED',
        at: this.iso(userRow['updated_at']),
        detail: 'Onboarding completado',
      });
    }

    if (prequalRow?.['checked_at']) {
      events.push({
        kind: 'PREQUAL_RUN',
        at: this.iso(prequalRow['checked_at']),
        detail: 'Pre-calificación ejecutada',
      });
    }

    if (caseRow['created_at']) {
      events.push({
        kind: 'CASE_CREATED',
        at: this.iso(caseRow['created_at']),
        detail: 'Case creado',
      });
    }

    for (const offer of offers) {
      if (offer['sent_at']) {
        events.push({
          kind: 'OFFER_SENT',
          at: this.iso(offer['sent_at']),
          detail: `Oferta enviada (${textForDetail(offer['id'])})`,
        });
      }
      if (offer['accepted_at']) {
        events.push({
          kind: 'OFFER_ACCEPTED',
          at: this.iso(offer['accepted_at']),
          detail: `Oferta aceptada (${textForDetail(offer['id'])})`,
        });
      }
    }

    for (const g of guarantors) {
      if (g['created_at']) {
        events.push({
          kind: 'GUARANTOR_RECEIVED',
          at: this.iso(g['created_at']),
          detail: 'Datos de garante recibidos',
        });
      }
      if (g['reviewed_at'] && g['status'] !== 'EVALUATING') {
        events.push({
          kind: 'GUARANTOR_EVALUATED',
          at: this.iso(g['reviewed_at']),
          detail: `Garante evaluado (${textForDetail(g['status'])})`,
        });
      }
    }

    if (contractRow) {
      if (contractRow['created_at']) {
        events.push({
          kind: 'CONTRACT_CREATED',
          at: this.iso(contractRow['created_at']),
          detail: 'Contrato creado',
        });
      }
      if (
        contractRow['status'] === 'SIGN_PENDING' &&
        contractRow['issued_at']
      ) {
        events.push({
          kind: 'CONTRACT_SENT',
          at: this.iso(contractRow['issued_at']),
          detail: 'Contrato enviado a firma',
        });
      }
      if (contractRow['signed_at']) {
        events.push({
          kind: 'CONTRACT_SIGNED',
          at: this.iso(contractRow['signed_at']),
          detail: 'Contrato firmado',
        });
      }
      if (contractRow['failed_at']) {
        events.push({
          kind: 'CONTRACT_FAILED',
          at: this.iso(contractRow['failed_at']),
          detail: 'Contrato fallido',
        });
      }
      if (contractRow['canceled_at']) {
        events.push({
          kind: 'CONTRACT_CANCELED',
          at: this.iso(contractRow['canceled_at']),
          detail: 'Contrato cancelado',
        });
      }
    }

    if (loanRow?.['created_at']) {
      events.push({
        kind: 'LOAN_CREATED',
        at: this.iso(loanRow['created_at']),
        detail: 'Loan creado',
      });
    }

    events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return { ok: true, events };
  }

  private iso(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return '';
  }

  private serializeRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) {
        out[k] = v.toISOString();
      } else {
        out[k] = v;
      }
    }
    return out;
  }
}
