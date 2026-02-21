/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import { BadRequestException, Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';
import { DbService } from '../db/db.service';

@Injectable()
export class ConsentsService {
  public constructor(private readonly dbService: DbService) {}

  public async acceptConsent(input: {
    token: string;
    ip: string;
    userAgent: string;
  }): Promise<{ success: true }> {
    return this.dbService.withTransaction(async (client: PoolClient) => {
      const consent = await this.findConsentForUpdate(client, input.token);

      if (!consent) {
        throw new BadRequestException('Token inválido o vencido.');
      }

      if (consent.status === 'ACCEPTED') {
        return { success: true };
      }

      const expiresAt =
        consent.expires_at instanceof Date
          ? consent.expires_at
          : new Date(consent.expires_at);
      const isExpired =
        Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
      if (consent.status !== 'PENDING' || isExpired) {
        throw new BadRequestException('Token inválido o vencido.');
      }

      await client.query(
        `
          UPDATE consents
          SET status = $2,
              accepted_at = now(),
              ip = $3,
              user_agent = $4
          WHERE token = $1
        `,
        [input.token, 'ACCEPTED', input.ip, input.userAgent],
      );

      await client.query(
        `
          UPDATE leads
          SET stage = $2
          WHERE phone = $1
        `,
        [consent.phone, 'NEED_DATA'],
      );

      return { success: true };
    });
  }

  private async findConsentForUpdate(
    client: PoolClient,
    token: string,
  ): Promise<{
    phone: string;
    status: 'PENDING' | 'ACCEPTED';
    expires_at: Date | string;
  } | null> {
    const result = await client.query<{
      phone: string;
      status: 'PENDING' | 'ACCEPTED';
      expires_at: Date | string;
    }>(
      `
        SELECT phone, status, expires_at
        FROM consents
        WHERE token = $1
        FOR UPDATE
      `,
      [token],
    );

    return result.rows[0] ?? null;
  }

  public async getConsentByToken(token: string): Promise<{
    token: string;
    status: 'PENDING' | 'ACCEPTED';
    terms_version: string;
    terms_url: string | null;
    terms_hash: string | null;
    expires_at: string;
    is_valid: boolean;
  }> {
    return this.dbService.withTransaction(async (client: PoolClient) => {
      const result = await client.query<{
        token: string;
        status: 'PENDING' | 'ACCEPTED';
        terms_version: string;
        terms_url: string | null;
        terms_hash: string | null;
        expires_at: Date | string;
      }>(
        `
        SELECT token, status, terms_version, terms_url, terms_hash, expires_at
        FROM consents
        WHERE token = $1
      `,
        [token],
      );

      const row = result.rows[0];
      if (!row) {
        throw new BadRequestException('Token inválido o vencido.');
      }

      const expiresAt =
        row.expires_at instanceof Date
          ? row.expires_at
          : new Date(row.expires_at);

      const isExpired =
        Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();

      const isValid = row.status === 'PENDING' && !isExpired;

      return {
        token: row.token,
        status: row.status,
        terms_version: row.terms_version,
        terms_url: row.terms_url,
        terms_hash: row.terms_hash,
        expires_at: expiresAt.toISOString(),
        is_valid: isValid,
      };
    });
  }
}
