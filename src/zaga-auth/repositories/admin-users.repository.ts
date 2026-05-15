import { Injectable } from '@nestjs/common';
import { DbService } from '../../db/db.service';
import type { ZagaAdminUserRow } from '../types/zaga-auth.types';

@Injectable()
export class AdminUsersRepository {
  public constructor(private readonly dbService: DbService) {}

  public async findByEmail(email: string): Promise<ZagaAdminUserRow | null> {
    const normalized = email.trim().toLowerCase();
    const result = await this.dbService.query<ZagaAdminUserRow>(
      `
      SELECT
        id,
        email,
        password_hash,
        full_name,
        role,
        is_active,
        failed_login_attempts,
        locked_until,
        last_login_at
      FROM admin_users
      WHERE lower(email) = $1
      LIMIT 1
      `,
      [normalized],
    );
    return result.rows[0] ?? null;
  }

  public async findById(id: string): Promise<ZagaAdminUserRow | null> {
    const result = await this.dbService.query<ZagaAdminUserRow>(
      `
      SELECT
        id,
        email,
        password_hash,
        full_name,
        role,
        is_active,
        failed_login_attempts,
        locked_until,
        last_login_at
      FROM admin_users
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );
    return result.rows[0] ?? null;
  }

  public async incrementFailedAttempts(userId: string): Promise<void> {
    await this.dbService.query(
      `
      UPDATE admin_users
      SET failed_login_attempts = failed_login_attempts + 1,
          updated_at = now()
      WHERE id = $1
      `,
      [userId],
    );
  }

  public async resetAttemptsAndUnlocked(userId: string): Promise<void> {
    await this.dbService.query(
      `
      UPDATE admin_users
      SET failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = now()
      WHERE id = $1
      `,
      [userId],
    );
  }

  public async setLockedUntil(
    userId: string,
    lockedUntil: Date,
  ): Promise<void> {
    await this.dbService.query(
      `
      UPDATE admin_users
      SET locked_until = $2,
          updated_at = now()
      WHERE id = $1
      `,
      [userId, lockedUntil.toISOString()],
    );
  }

  public async markLastLogin(userId: string): Promise<void> {
    await this.dbService.query(
      `
      UPDATE admin_users
      SET last_login_at = now(),
          updated_at = now()
      WHERE id = $1
      `,
      [userId],
    );
  }
}
