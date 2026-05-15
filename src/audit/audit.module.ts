import { forwardRef, Module } from '@nestjs/common';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { AdminAuditRepository } from './admin-audit.repository';
import { AuditBackofficeController } from './audit-backoffice.controller';

@Module({
  imports: [forwardRef(() => ZagaAuthModule)],
  controllers: [AuditBackofficeController],
  providers: [AdminAuditRepository],
  exports: [AdminAuditRepository],
})
export class AuditModule {}
