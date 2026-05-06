import { Module } from '@nestjs/common';
import { CaseGuarantorsModule } from '../case-guarantors/case-guarantors.module';
import { OfferEngineModule } from '../offerEngine/offer-engine.module';
import { CaseOffersController } from './case-offers.controller';
import { CasesController } from './cases.controller';
import { CasesFromRequestedAmountService } from './cases-from-requested-amount.service';

@Module({
  imports: [CaseGuarantorsModule, OfferEngineModule],
  controllers: [CasesController, CaseOffersController],
  providers: [CasesFromRequestedAmountService],
  exports: [CasesFromRequestedAmountService],
})
export class CasesModule {}
