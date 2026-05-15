import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminSessionsRepository } from '../repositories/admin-sessions.repository';
import type { ZagaRequestUser } from '../types/zaga-request.types';
import { hashSessionToken } from '../utils/zaga-token.util';

const BEARER = /^Bearer\s+(.+)$/i;

export const ZAGA_SESSION_ID_KEY = 'zagaSessionId';

@Injectable()
export class ZagaSessionGuard implements CanActivate {
  public constructor(
    private readonly sessionsRepository: AdminSessionsRepository,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (typeof header !== 'string' || !BEARER.test(header)) {
      throw new UnauthorizedException('Sesión requerida');
    }
    const match = BEARER.exec(header);
    const rawToken = match?.[1]?.trim();
    if (!rawToken) {
      throw new UnauthorizedException('Sesión requerida');
    }

    const tokenHash = hashSessionToken(rawToken);
    const row = await this.sessionsRepository.findActiveByTokenHash(tokenHash);
    if (!row) {
      throw new UnauthorizedException('Sesión inválida o vencida');
    }

    if (!row.is_active) {
      throw new ForbiddenException('Usuario inactivo');
    }

    const sessionUser: ZagaRequestUser = {
      id: row.user_id,
      email: row.email,
      password_hash: row.password_hash,
      full_name: row.full_name,
      role: row.role,
      is_active: row.is_active,
      failed_login_attempts: row.failed_login_attempts,
      locked_until: row.locked_until,
      last_login_at: row.last_login_at,
    };

    Object.assign(req, {
      zagaUser: sessionUser,
      [ZAGA_SESSION_ID_KEY]: row.session_id,
    });

    return true;
  }
}
