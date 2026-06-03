import { Module } from '@nestjs/common';
import { CobranzasModule } from '../cobranzas/cobranzas.module';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { LoansBackofficeController } from './loans-backoffice.controller';
import { LoansBackofficeService } from './loans-backoffice.service';
import { LoansDesembolsoController } from './loans-desembolso.controller';
import { LoansDesembolsoService } from './loans-desembolso.service';

@Module({
  imports: [ZagaAuthModule, CobranzasModule],
  controllers: [LoansBackofficeController, LoansDesembolsoController],
  providers: [LoansBackofficeService, LoansDesembolsoService],
})
export class LoansModule {}
