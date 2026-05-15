import { forwardRef, Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ZagaSessionGuard } from './guards/zaga-session.guard';
import { AdminSessionsRepository } from './repositories/admin-sessions.repository';
import { AdminUsersRepository } from './repositories/admin-users.repository';
import { ZagaAuthController } from './zaga-auth.controller';
import { ZagaAuthService } from './zaga-auth.service';

@Module({
  imports: [forwardRef(() => AuditModule)],
  controllers: [ZagaAuthController],
  providers: [
    AdminUsersRepository,
    AdminSessionsRepository,
    ZagaAuthService,
    ZagaSessionGuard,
  ],
  exports: [ZagaSessionGuard, AdminSessionsRepository, AdminUsersRepository],
})
export class ZagaAuthModule {}
