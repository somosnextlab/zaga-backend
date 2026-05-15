import { Injectable } from '@nestjs/common';
import { DbService } from '../db/db.service';
import type { AdminAuditActionValue } from './constants/admin-audit-actions';

export type AdminAuditLogRow = {
  id: string;
  admin_user_id: string | null;
  admin_email: string | null;
  admin_full_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: Date | string;
};

export type InsertAdminAuditInput = {
  readonly adminUserId: string | null;
  readonly action: AdminAuditActionValue;
  readonly entityType?: string | null;
  readonly entityId?: string | null;
  readonly metadata?: Record<string, unknown> | null;
  readonly ip?: string | null;
  /** Algunos esquemas exigen NOT NULL; se envía '' si no hay cabecera. */
  readonly userAgent?: string | null;
};

@Injectable()
export class AdminAuditRepository {
  public constructor(private readonly dbService: DbService) {}

  public async insert(row: InsertAdminAuditInput): Promise<void> {
    const metadataJson = JSON.stringify(row.metadata ?? {});
    const userAgent = row.userAgent?.trim() ? row.userAgent : '';
    await this.dbService.query(
      `
      INSERT INTO admin_audit_logs (
        admin_user_id, action, entity_type, entity_id, metadata, ip, user_agent
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      `,
      [
        row.adminUserId,
        row.action,
        row.entityType ?? null,
        row.entityId ?? null,
        metadataJson,
        row.ip ?? null,
        userAgent,
      ],
    );
  }

  public async list(input: {
    readonly limit: number;
    readonly offset: number;
    readonly q: string | null;
    readonly action: string | null;
    readonly entityType: string | null;
    readonly entityId: string | null;
    readonly adminUserId: string | null;
  }): Promise<AdminAuditLogRow[]> {
    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let p = 1;

    if (input.action) {
      conditions.push(`a.action = $${p}`);
      params.push(input.action);
      p += 1;
    }
    if (input.entityType) {
      conditions.push(`a.entity_type = $${p}`);
      params.push(input.entityType);
      p += 1;
    }
    if (input.entityId) {
      conditions.push(`a.entity_id = $${p}`);
      params.push(input.entityId);
      p += 1;
    }
    if (input.adminUserId) {
      conditions.push(`a.admin_user_id = $${p}::uuid`);
      params.push(input.adminUserId);
      p += 1;
    }
    if (input.q) {
      const like = `%${input.q}%`;
      conditions.push(
        `(a.action ILIKE $${p} OR a.entity_id::text ILIKE $${p} OR COALESCE(u.email, '') ILIKE $${p})`,
      );
      params.push(like);
      p += 1;
    }

    params.push(input.limit, input.offset);
    const limitParam = p;
    const offsetParam = p + 1;

    const result = await this.dbService.query<AdminAuditLogRow>(
      `
      SELECT
        a.id,
        a.admin_user_id,
        u.email AS admin_email,
        u.full_name AS admin_full_name,
        a.action,
        a.entity_type,
        a.entity_id,
        a.metadata,
        a.ip,
        a.user_agent,
        a.created_at
      FROM admin_audit_logs a
      LEFT JOIN admin_users u ON u.id = a.admin_user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY a.created_at DESC
      LIMIT $${limitParam} OFFSET $${offsetParam}
      `,
      params,
    );

    return result.rows;
  }
}
