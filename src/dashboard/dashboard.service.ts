import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { CaseContractStatus } from '../contracts/enums/case-contract-status.enum';
import { LeadStage } from '../lead-stage.enum';

export type DashboardSummaryResponse = {
  ok: true;
  leads: {
    total: number;
    needConsent: number;
    needData: number;
    dataComplete: number;
    waitingRequestedAmount: number;
    waitingRequestedAmountManualReview: number;
    waitingCeo: number;
    offerSent: number;
    rejected: number;
  };
  cases: {
    total: number;
    waitingCeo: number;
    offerSent: number;
    pendingNosis: number;
    pendingGuarantorAnalysis: number;
    aprobadoFinal: number;
    rechazadoFinal: number;
  };
  contracts: {
    total: number;
    created: number;
    signPending: number;
    signed: number;
    canceled: number;
    failed: number;
  };
  loans: {
    total: number;
    created: number;
    disbursed: number;
    active: number;
    paid: number;
    default: number;
    refinanced: number;
  };
};

export type GlobalSearchResult = {
  type: 'CASE' | 'LOAN';
  id: string;
  label: string;
  subtitle: string;
};

@Injectable()
export class DashboardService {
  public constructor(private readonly dbService: DbService) {}

  public async getSummary(): Promise<DashboardSummaryResponse> {
    const [leads, cases, contracts, loans] = await Promise.all([
      this.fetchLeadCounts(),
      this.fetchCaseCounts(),
      this.fetchContractCounts(),
      this.fetchLoanCounts(),
    ]);
    return { ok: true, leads, cases, contracts, loans };
  }

  public async globalSearch(qRaw: string): Promise<{
    ok: true;
    results: GlobalSearchResult[];
  }> {
    const q = qRaw.trim();
    if (q.length === 0) {
      return { ok: true, results: [] };
    }

    const limit = 40;
    const results: GlobalSearchResult[] = [];
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (uuidRe.test(q)) {
      const caseRows = await this.dbService.query<{
        id: string;
        phone: string;
        status: string;
        cuit: string | null;
      }>(
        `
        SELECT c.id, c.phone, c.status, u.cuit
        FROM cases c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE c.id = $1::uuid
        LIMIT 3
        `,
        [q],
      );
      for (const row of caseRows.rows) {
        results.push({
          type: 'CASE',
          id: row.id,
          label: `CASE ${row.id}`,
          subtitle: `Tel: ${row.phone} | CUIT: ${row.cuit ?? '—'} | Estado: ${row.status}`,
        });
      }

      const loanRows = await this.dbService.query<{
        id: string;
        phone: string;
        status: string;
        cuit: string | null;
      }>(
        `
        SELECT l.id, l.phone, l.status, u.cuit
        FROM loans l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.id = $1::uuid
        LIMIT 3
        `,
        [q],
      );
      for (const row of loanRows.rows) {
        results.push({
          type: 'LOAN',
          id: row.id,
          label: `LOAN ${row.id}`,
          subtitle: `Tel: ${row.phone} | CUIT: ${row.cuit ?? '—'} | Estado: ${row.status}`,
        });
      }
    }

    const phoneDigits = q.replace(/\D/g, '');
    if (phoneDigits.length >= 6) {
      const like = `%${phoneDigits}%`;
      const caseByPhone = await this.dbService.query<{
        id: string;
        phone: string;
        status: string;
        cuit: string | null;
      }>(
        `
        SELECT c.id, c.phone, c.status, u.cuit
        FROM cases c
        LEFT JOIN users u ON u.id = c.user_id
        WHERE regexp_replace(c.phone, '\\D', '', 'g') LIKE $1
        LIMIT 10
        `,
        [like],
      );
      for (const row of caseByPhone.rows) {
        results.push({
          type: 'CASE',
          id: row.id,
          label: `CASE ${row.id}`,
          subtitle: `Tel: ${row.phone} | CUIT: ${row.cuit ?? '—'} | Estado: ${row.status}`,
        });
      }

      const loanByPhone = await this.dbService.query<{
        id: string;
        phone: string;
        status: string;
        cuit: string | null;
      }>(
        `
        SELECT l.id, l.phone, l.status, u.cuit
        FROM loans l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE regexp_replace(l.phone, '\\D', '', 'g') LIKE $1
        LIMIT 10
        `,
        [like],
      );
      for (const row of loanByPhone.rows) {
        results.push({
          type: 'LOAN',
          id: row.id,
          label: `LOAN ${row.id}`,
          subtitle: `Tel: ${row.phone} | CUIT: ${row.cuit ?? '—'} | Estado: ${row.status}`,
        });
      }
    }

    const cuitClean = q.replace(/\D/g, '');
    if (cuitClean.length === 11) {
      const caseByCuit = await this.dbService.query<{
        id: string;
        phone: string;
        status: string;
        cuit: string | null;
      }>(
        `
        SELECT c.id, c.phone, c.status, u.cuit
        FROM cases c
        INNER JOIN users u ON u.id = c.user_id
        WHERE regexp_replace(COALESCE(u.cuit, ''), '\\D', '', 'g') = $1
        LIMIT 10
        `,
        [cuitClean],
      );
      for (const row of caseByCuit.rows) {
        results.push({
          type: 'CASE',
          id: row.id,
          label: `CASE ${row.id}`,
          subtitle: `Tel: ${row.phone} | CUIT: ${row.cuit ?? '—'} | Estado: ${row.status}`,
        });
      }

      const loanByCuit = await this.dbService.query<{
        id: string;
        phone: string;
        status: string;
        cuit: string | null;
      }>(
        `
        SELECT l.id, l.phone, l.status, u.cuit
        FROM loans l
        INNER JOIN users u ON u.id = l.user_id
        WHERE regexp_replace(COALESCE(u.cuit, ''), '\\D', '', 'g') = $1
        LIMIT 10
        `,
        [cuitClean],
      );
      for (const row of loanByCuit.rows) {
        results.push({
          type: 'LOAN',
          id: row.id,
          label: `LOAN ${row.id}`,
          subtitle: `Tel: ${row.phone} | CUIT: ${row.cuit ?? '—'} | Estado: ${row.status}`,
        });
      }
    }

    const dedup = new Map<string, GlobalSearchResult>();
    for (const r of results) {
      dedup.set(`${r.type}:${r.id}`, r);
      if (dedup.size >= limit) {
        break;
      }
    }

    return { ok: true, results: [...dedup.values()].slice(0, limit) };
  }

  private async fetchLeadCounts(): Promise<DashboardSummaryResponse['leads']> {
    const result = await this.dbService.query<Record<string, number>>(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE stage = $1)::int AS need_consent,
        COUNT(*) FILTER (WHERE stage = $2)::int AS need_data,
        COUNT(*) FILTER (WHERE stage = $3)::int AS data_complete,
        COUNT(*) FILTER (WHERE stage = $4)::int AS waiting_requested_amount,
        COUNT(*) FILTER (WHERE stage = $5)::int AS waiting_requested_amount_manual_review,
        COUNT(*) FILTER (WHERE stage = $6)::int AS waiting_ceo,
        COUNT(*) FILTER (WHERE stage = $7)::int AS offer_sent,
        COUNT(*) FILTER (WHERE stage = $8)::int AS rejected
      FROM leads
      `,
      [
        LeadStage.NEED_CONSENT,
        LeadStage.NEED_DATA,
        LeadStage.DATA_COMPLETE,
        LeadStage.WAITING_REQUESTED_AMOUNT,
        LeadStage.WAITING_REQUESTED_AMOUNT_MANUAL_REVIEW,
        LeadStage.WAITING_CEO,
        LeadStage.OFFER_SENT,
        LeadStage.REJECTED,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      return {
        total: 0,
        needConsent: 0,
        needData: 0,
        dataComplete: 0,
        waitingRequestedAmount: 0,
        waitingRequestedAmountManualReview: 0,
        waitingCeo: 0,
        offerSent: 0,
        rejected: 0,
      };
    }
    return {
      total: row.total ?? 0,
      needConsent: row.need_consent ?? 0,
      needData: row.need_data ?? 0,
      dataComplete: row.data_complete ?? 0,
      waitingRequestedAmount: row.waiting_requested_amount ?? 0,
      waitingRequestedAmountManualReview:
        row.waiting_requested_amount_manual_review ?? 0,
      waitingCeo: row.waiting_ceo ?? 0,
      offerSent: row.offer_sent ?? 0,
      rejected: row.rejected ?? 0,
    };
  }

  private async fetchCaseCounts(): Promise<DashboardSummaryResponse['cases']> {
    const result = await this.dbService.query<Record<string, number>>(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'WAITING_CEO')::int AS waiting_ceo,
        COUNT(*) FILTER (WHERE status = 'OFFER_SENT')::int AS offer_sent,
        COUNT(*) FILTER (WHERE status = 'PENDING_NOSIS')::int AS pending_nosis,
        COUNT(*) FILTER (WHERE status = 'PENDING_GUARANTOR_ANALYSIS')::int AS pending_guarantor_analysis,
        COUNT(*) FILTER (WHERE status = 'APROBADO_FINAL')::int AS aprobado_final,
        COUNT(*) FILTER (
          WHERE status = 'RECHAZADO_FINAL'
            OR final_decision = 'RECHAZADO_FINAL'
        )::int AS rechazado_final
      FROM cases
    `);

    const row = result.rows[0];
    if (!row) {
      return {
        total: 0,
        waitingCeo: 0,
        offerSent: 0,
        pendingNosis: 0,
        pendingGuarantorAnalysis: 0,
        aprobadoFinal: 0,
        rechazadoFinal: 0,
      };
    }
    return {
      total: row.total ?? 0,
      waitingCeo: row.waiting_ceo ?? 0,
      offerSent: row.offer_sent ?? 0,
      pendingNosis: row.pending_nosis ?? 0,
      pendingGuarantorAnalysis: row.pending_guarantor_analysis ?? 0,
      aprobadoFinal: row.aprobado_final ?? 0,
      rechazadoFinal: row.rechazado_final ?? 0,
    };
  }

  private async fetchContractCounts(): Promise<
    DashboardSummaryResponse['contracts']
  > {
    const result = await this.dbService.query<Record<string, number>>(
      `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = $1)::int AS created,
        COUNT(*) FILTER (WHERE status = $2)::int AS sign_pending,
        COUNT(*) FILTER (WHERE status = $3)::int AS signed,
        COUNT(*) FILTER (WHERE status = $4)::int AS canceled,
        COUNT(*) FILTER (WHERE status = $5)::int AS failed
      FROM case_contracts
      `,
      [
        CaseContractStatus.CREATED,
        CaseContractStatus.SIGN_PENDING,
        CaseContractStatus.SIGNED,
        CaseContractStatus.CANCELED,
        CaseContractStatus.FAILED,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      return {
        total: 0,
        created: 0,
        signPending: 0,
        signed: 0,
        canceled: 0,
        failed: 0,
      };
    }
    return {
      total: row.total ?? 0,
      created: row.created ?? 0,
      signPending: row.sign_pending ?? 0,
      signed: row.signed ?? 0,
      canceled: row.canceled ?? 0,
      failed: row.failed ?? 0,
    };
  }

  private async fetchLoanCounts(): Promise<DashboardSummaryResponse['loans']> {
    const result = await this.dbService.query<Record<string, number>>(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'CREATED')::int AS created,
        COUNT(*) FILTER (WHERE status = 'DISBURSED')::int AS disbursed,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
        COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid,
        COUNT(*) FILTER (WHERE status = 'DEFAULT')::int AS default_status,
        COUNT(*) FILTER (WHERE status = 'REFINANCED')::int AS refinanced
      FROM loans
    `);

    const row = result.rows[0];
    if (!row) {
      return {
        total: 0,
        created: 0,
        disbursed: 0,
        active: 0,
        paid: 0,
        default: 0,
        refinanced: 0,
      };
    }
    return {
      total: row.total ?? 0,
      created: row.created ?? 0,
      disbursed: row.disbursed ?? 0,
      active: row.active ?? 0,
      paid: row.paid ?? 0,
      default: row.default_status ?? 0,
      refinanced: row.refinanced ?? 0,
    };
  }
}
