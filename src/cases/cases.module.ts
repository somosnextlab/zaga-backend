import { Module } from '@nestjs/common';
import { CaseGuarantorsModule } from '../case-guarantors/case-guarantors.module';
import { OfferEngineModule } from '../offerEngine/offer-engine.module';
import { ZagaAuthModule } from '../zaga-auth/zaga-auth.module';
import { CaseOffersController } from './case-offers.controller';
import { CasesBackofficeController } from './cases-backoffice.controller';
import { CasesBackofficeService } from './cases-backoffice.service';
import { CasesController } from './cases.controller';
import { CasesFromRequestedAmountService } from './cases-from-requested-amount.service';

@Module({
  imports: [CaseGuarantorsModule, OfferEngineModule, ZagaAuthModule],
  controllers: [
    CasesController,
    CaseOffersController,
    CasesBackofficeController,
  ],
  providers: [CasesFromRequestedAmountService, CasesBackofficeService],
  exports: [CasesFromRequestedAmountService],
})
export class CasesModule {}
