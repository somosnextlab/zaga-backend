import { Module } from '@nestjs/common';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { LeadsBackofficeController } from './leads-backoffice.controller';
import { LeadsBackofficeService } from './leads-backoffice.service';

@Module({
  imports: [ZagaAuthModule],
  controllers: [LeadsBackofficeController],
  providers: [LeadsBackofficeService],
})
export class LeadsModule {}
