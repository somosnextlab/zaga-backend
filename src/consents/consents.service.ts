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
}
