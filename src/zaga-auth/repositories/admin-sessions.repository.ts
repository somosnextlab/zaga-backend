import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import type { ZagaAdminUserRow } from '../types/zaga-auth.types';

export type AdminSessionWithUserRow = {
  session_id: string;
  admin_user_id: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  user_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: ZagaAdminUserRow['role'];
  is_active: boolean;
  failed_login_attempts: number;
  locked_until: Date | string | null;
  last_login_at: Date | string | null;
};

@Injectable()
export class AdminSessionsRepository {
  public constructor(private readonly dbService: DbService) {}

  public async createSession(input: {
    readonly adminUserId: string;
    readonly tokenHash: string;
    readonly expiresAt: Date;
    readonly ip: string | null;
    readonly userAgent: string | null;
  }): Promise<{ id: string }> {
    const result = await this.dbService.query<{ id: string }>(
      `
      INSERT INTO admin_sessions (
        admin_user_id, token_hash, expires_at, ip, user_agent
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
      `,
      [
        input.adminUserId,
        input.tokenHash,
        input.expiresAt.toISOString(),
        input.ip,
        input.userAgent,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error('No se pudo crear la sesión.');
    }
    return row;
  }

  public async findActiveByTokenHash(
    tokenHash: string,
  ): Promise<AdminSessionWithUserRow | null> {
    const result = await this.dbService.query<AdminSessionWithUserRow>(
      `
      SELECT
        s.id AS session_id,
        s.admin_user_id,
        s.expires_at,
        s.revoked_at,
        u.id AS user_id,
        u.email,
        u.password_hash,
        u.full_name,
        u.role,
        u.is_active,
        u.failed_login_attempts,
        u.locked_until,
        u.last_login_at
      FROM admin_sessions s
      INNER JOIN admin_users u ON u.id = s.admin_user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
      LIMIT 1
      `,
      [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  public async revokeSession(sessionId: string): Promise<boolean> {
    const result = await this.dbService.query(
      `
      UPDATE admin_sessions
      SET revoked_at = now()
      WHERE id = $1
        AND revoked_at IS NULL
      `,
      [sessionId],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
