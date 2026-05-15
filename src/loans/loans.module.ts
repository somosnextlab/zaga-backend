import { Module } from '@nestjs/common';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { LoansBackofficeController } from './loans-backoffice.controller';
import { LoansBackofficeService } from './loans-backoffice.service';

@Module({
  imports: [ZagaAuthModule],
  controllers: [LoansBackofficeController],
  providers: [LoansBackofficeService],
})
export class LoansModule {}
