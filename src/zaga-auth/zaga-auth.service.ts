import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { AdminAuditRepository } from '../audit/admin-audit.repository';
import { AdminAuditAction } from '../audit/constants/admin-audit-actions';
import { ZAGA_AUTH } from './zaga-auth.constants';
import { ZagaLoginDto } from './dto/zaga-login.dto';
import { AdminSessionsRepository } from './repositories/admin-sessions.repository';
import { AdminUsersRepository } from './repositories/admin-users.repository';
import type {
  ZagaAuthMeUser,
  ZagaLoginOkResponse,
} from './types/zaga-auth.types';
import type { ZagaRequestUser } from './types/zaga-request.types';
import {
  generateSessionToken,
  hashSessionToken,
} from './utils/zaga-token.util';

/** Valores para columnas NOT NULL en esquemas de `admin_audit_logs` más estrictos. */
const AUDIT_ENTITY_TYPE_AUTH = 'auth';
const AUDIT_ENTITY_TYPE_ADMIN_USER = 'admin_user';
const AUDIT_ENTITY_ID_NA = 'n/a';

@Injectable()
export class ZagaAuthService {
  public constructor(
    private readonly usersRepository: AdminUsersRepository,
    private readonly sessionsRepository: AdminSessionsRepository,
    @Inject(forwardRef(() => AdminAuditRepository))
    private readonly auditRepository: AdminAuditRepository,
  ) {}

  public async login(
    dto: ZagaLoginDto,
    req: Request,
  ): Promise<ZagaLoginOkResponse> {
    const ip = this.extractClientIp(req);
    const userAgent = this.extractUserAgent(req);

    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user) {
      await this.auditRepository.insert({
        adminUserId: null,
        action: AdminAuditAction.ADMIN_LOGIN_FAILED,
        entityType: AUDIT_ENTITY_TYPE_AUTH,
        entityId: AUDIT_ENTITY_ID_NA,
        metadata: { reason: 'USER_NOT_FOUND' },
        ip,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.is_active) {
      await this.auditRepository.insert({
        adminUserId: user.id,
        action: AdminAuditAction.ADMIN_LOGIN_FAILED,
        entityType: AUDIT_ENTITY_TYPE_ADMIN_USER,
        entityId: user.id,
        metadata: { reason: 'INACTIVE' },
        ip,
      });
      throw new ForbiddenException('Usuario inactivo');
    }

    const lockedUntil = user.locked_until
      ? user.locked_until instanceof Date
        ? user.locked_until
        : new Date(user.locked_until)
      : null;
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      await this.auditRepository.insert({
        adminUserId: user.id,
        action: AdminAuditAction.ADMIN_LOGIN_FAILED,
        entityType: AUDIT_ENTITY_TYPE_ADMIN_USER,
        entityId: user.id,
        metadata: { reason: 'LOCKED' },
        ip,
      });
      throw new ForbiddenException('Cuenta temporalmente bloqueada');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordOk) {
      await this.usersRepository.incrementFailedAttempts(user.id);
      const fresh = await this.usersRepository.findById(user.id);
      const attempts =
        fresh?.failed_login_attempts ?? user.failed_login_attempts + 1;
      if (attempts >= ZAGA_AUTH.MAX_FAILED_ATTEMPTS) {
        const until = new Date(
          Date.now() + ZAGA_AUTH.LOCKOUT_MINUTES * 60 * 1000,
        );
        await this.usersRepository.setLockedUntil(user.id, until);
      }
      await this.auditRepository.insert({
        adminUserId: user.id,
        action: AdminAuditAction.ADMIN_LOGIN_FAILED,
        entityType: AUDIT_ENTITY_TYPE_ADMIN_USER,
        entityId: user.id,
        metadata: { reason: 'BAD_PASSWORD' },
        ip,
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    await this.usersRepository.resetAttemptsAndUnlocked(user.id);
    await this.usersRepository.markLastLogin(user.id);

    const plainToken = generateSessionToken();
    const tokenHash = hashSessionToken(plainToken);
    const expiresAt = new Date(
      Date.now() + ZAGA_AUTH.SESSION_TTL_HOURS * 60 * 60 * 1000,
    );

    await this.sessionsRepository.createSession({
      adminUserId: user.id,
      tokenHash,
      expiresAt,
      ip,
      userAgent,
    });

    await this.auditRepository.insert({
      adminUserId: user.id,
      action: AdminAuditAction.ADMIN_LOGIN_SUCCESS,
      entityType: AUDIT_ENTITY_TYPE_ADMIN_USER,
      entityId: user.id,
      ip,
    });

    return {
      ok: true,
      sessionToken: plainToken,
      expiresAt: expiresAt.toISOString(),
      user: this.toPublicUser(user),
    };
  }

  public me(sessionUser: ZagaRequestUser): {
    ok: true;
    user: ZagaAuthMeUser;
  } {
    return { ok: true, user: this.toPublicUser(sessionUser) };
  }

  public async logout(
    sessionUser: ZagaRequestUser,
    sessionId: string,
    req: Request,
  ): Promise<{ ok: true }> {
    const ip = this.extractClientIp(req);
    const revoked = await this.sessionsRepository.revokeSession(sessionId);
    if (revoked) {
      await this.auditRepository.insert({
        adminUserId: sessionUser.id,
        action: AdminAuditAction.ADMIN_SESSION_REVOKED,
        entityType: 'admin_session',
        entityId: sessionId,
        ip,
      });
    }
    await this.auditRepository.insert({
      adminUserId: sessionUser.id,
      action: AdminAuditAction.ADMIN_LOGOUT,
      entityType: AUDIT_ENTITY_TYPE_ADMIN_USER,
      entityId: sessionUser.id,
      ip,
    });
    return { ok: true };
  }

  private toPublicUser(user: ZagaRequestUser): ZagaAuthMeUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };
  }

  private extractClientIp(req: Request): string | null {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.length > 0) {
      return xff.split(',')[0]?.trim() ?? null;
    }
    return req.ip ?? null;
  }

  private extractUserAgent(req: Request): string | null {
    const ua = req.headers['user-agent'];
    return typeof ua === 'string' ? ua : null;
  }
}
